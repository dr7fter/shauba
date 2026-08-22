//! CS-like rating kernel — the single source of truth for the 0.00–2.00 scale.
//!
//! The curve mirrors the frontend report curve in `src/utils.ts` (average stays
//! 1.00, quartic upper tail so 2.00 is reserved for near-perfect work). It
//! replaces the old linear fluency fallback in the mastery-map SQL, where
//! `self_rating = 4` mapped straight to 2.00 and inflated chapter ratings that
//! the report view would never show.

use std::collections::HashMap;

use chrono::NaiveDate;
use rusqlite::Connection;

pub const RATING_MIN: f64 = 0.0;
pub const RATING_MAX: f64 = 2.0;
pub const RATING_AVERAGE: f64 = 1.0;

const DIFFICULTY_MULTIPLIER_MIN: f64 = 0.94;
const DIFFICULTY_MULTIPLIER_MAX: f64 = 1.10;
/// How many recent attempts participate in one question's rating.
const RATING_ATTEMPT_WINDOW: usize = 8;
/// Daily decay applied to older attempts while averaging; without the floor a
/// one-month-old attempt keeps ~16% of its weight.
const RATING_DAY_DECAY: f64 = 0.94;
const RATING_MIN_WEIGHT: f64 = 0.08;

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

/// Quartic upper tail, linear lower region — identical shape to the frontend
/// `ratingCurve` so chapter ratings and report ratings finally agree.
pub fn rating_curve(performance_score: f64, difficulty_multiplier: f64) -> f64 {
    let score = performance_score.clamp(0.0, 100.0);
    let base = if score <= 60.0 {
        0.25 + (score / 60.0) * 0.75
    } else {
        1.0 + ((score - 60.0) / 40.0).powi(4) * 0.82
    };
    let difficulty = difficulty_multiplier.clamp(DIFFICULTY_MULTIPLIER_MIN, DIFFICULTY_MULTIPLIER_MAX);
    round2((base * difficulty).clamp(RATING_MIN, RATING_MAX))
}

/// Fluency must not outrank the confirmed outcome: reporting "一眼看透" on a
/// wrong answer still counts as a lapse.
pub fn calibrated_fluency(fluency: i32, outcome: &str) -> i32 {
    let clamped = fluency.clamp(1, 4);
    match outcome {
        "correct" => clamped,
        "partial" => clamped.min(3),
        _ => clamped.min(2),
    }
}

/// Benchmark seconds per question type (单选3分 / 多选4分 / 填空5分 / 解答10分),
/// matching the pacing labels used in Codex task prompts.
pub fn benchmark_seconds(question_type: &str) -> i64 {
    match question_type {
        "single_choice" => 180,
        "multiple_choice" => 240,
        "fill_in" => 300,
        _ => 600,
    }
}

/// Per-attempt rating from objective evidence: outcome 55% + calibrated
/// fluency 25% + speed 20%, the same weights as the frontend
/// `deriveGradeCsRating`.
pub fn attempt_rating(outcome: &str, fluency: i32, duration_seconds: i64, benchmark_seconds: i64) -> f64 {
    let outcome_score = match outcome {
        "correct" => 92.0,
        "partial" => 62.0,
        "uncertain" => 35.0,
        _ => 20.0,
    };
    let fluency_score = calibrated_fluency(fluency, outcome) as f64 / 4.0 * 100.0;
    let duration = duration_seconds.max(1) as f64;
    let bench = benchmark_seconds.max(1) as f64;
    let speed_score = ((bench / duration) * 100.0).clamp(45.0, 115.0);
    let performance = outcome_score * 0.55 + fluency_score * 0.25 + speed_score * 0.2;
    rating_curve(performance, 1.0)
}

struct AttemptEvidence {
    outcome: String,
    fluency: i32,
    duration_seconds: Option<i64>,
    benchmark_seconds: i64,
    ai_rating: Option<f64>,
    dims: DimensionEvidence,
    difficulty_multiplier: Option<f64>,
    attempted_date: Option<NaiveDate>,
}

/// Fold one question's recent attempts into a single decay-weighted rating.
/// Codex `ai_rating` values are trusted directly; attempts without one are
/// scored from objective evidence. Older attempts count progressively less so
/// improvement is reflected faster than the old all-time plain AVG.
pub fn aggregate_question_rating(evidence: &[AttemptEvidence], today: NaiveDate) -> Option<f64> {
    if evidence.is_empty() {
        return None;
    }
    let mut weight_sum = 0.0;
    let mut weighted_sum = 0.0;
    for item in evidence.iter().rev().take(RATING_ATTEMPT_WINDOW) {
        let age_days = item
            .attempted_date
            .map(|d| (today - d).num_days().clamp(0, 3650) as i32)
            .unwrap_or(0);
        let weight = RATING_DAY_DECAY.powi(age_days).max(RATING_MIN_WEIGHT);
        let duration = item.duration_seconds.unwrap_or(item.benchmark_seconds);
        // 评分回退链：六维 HLTV 合成 > Codex rating > 特征曲线合成
        let rating = if !item.dims.is_empty() {
            hltv_rating(
                &item.outcome,
                &item.dims,
                duration,
                item.benchmark_seconds,
                item.difficulty_multiplier,
            )
        } else {
            match item.ai_rating {
                Some(value) if (RATING_MIN..=RATING_MAX).contains(&value) => value,
                _ => attempt_rating(&item.outcome, item.fluency, duration, item.benchmark_seconds),
            }
        };
        weighted_sum += rating * weight;
        weight_sum += weight;
    }
    if weight_sum <= f64::EPSILON {
        return None;
    }
    Some(round2((weighted_sum / weight_sum).clamp(RATING_MIN, RATING_MAX)))
}

/// Per-question rating for every attempted question (uncertain attempts are
/// excluded, consistent with accuracy and mastery calculations).
pub fn compute_question_ratings(conn: &Connection, today: NaiveDate) -> Result<HashMap<i64, f64>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT a.question_id, substr(a.attempted_at,1,10), COALESCE(a.outcome,a.result),
                    COALESCE(a.fluency_rating,a.self_rating), a.ai_rating, a.duration_seconds, q.question_type,
                    a.dim_rigor, a.dim_computation, a.dim_modeling, a.dim_method_use, a.dim_speed,
                    a.dim_strategy_insight, a.technique_level, a.difficulty_multiplier
             FROM attempts a JOIN questions q ON q.id=a.question_id
             WHERE COALESCE(a.outcome,a.result)<>'uncertain'
             ORDER BY a.question_id, a.id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, Option<String>>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i32>(3)?,
                r.get::<_, Option<f64>>(4)?,
                r.get::<_, Option<i64>>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, Option<f64>>(7)?,
                r.get::<_, Option<f64>>(8)?,
                r.get::<_, Option<f64>>(9)?,
                r.get::<_, Option<f64>>(10)?,
                r.get::<_, Option<f64>>(11)?,
                r.get::<_, Option<f64>>(12)?,
                r.get::<_, Option<i32>>(13)?,
                r.get::<_, Option<f64>>(14)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut by_question: HashMap<i64, Vec<AttemptEvidence>> = HashMap::new();
    for (question_id, date_str, outcome, fluency, ai_rating, duration, question_type, rigor, computation, modeling, method_use, speed, strategy_insight, technique_level, difficulty_multiplier) in
        rows
    {
        by_question.entry(question_id).or_default().push(AttemptEvidence {
            outcome,
            fluency,
            duration_seconds: duration,
            benchmark_seconds: benchmark_seconds(&question_type),
            ai_rating,
            dims: DimensionEvidence {
                rigor,
                computation,
                modeling,
                method_use,
                speed,
                strategy_insight,
                technique_level,
            },
            difficulty_multiplier,
            attempted_date: date_str
                .as_deref()
                .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()),
        });
    }

    Ok(by_question
        .into_iter()
        .filter_map(|(question_id, evidence)| {
            aggregate_question_rating(&evidence, today).map(|rating| (question_id, rating))
        })
        .collect())
}

fn average_ratings_by_group(
    conn: &Connection,
    today: NaiveDate,
    group_question_pairs_sql: &str,
) -> Result<HashMap<i64, f64>, String> {
    let question_ratings = compute_question_ratings(conn, today)?;
    let mut stmt = conn.prepare(group_question_pairs_sql).map_err(|e| e.to_string())?;
    let pairs = stmt
        .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut sums: HashMap<i64, (f64, i64)> = HashMap::new();
    for (group_id, question_id) in pairs {
        if let Some(rating) = question_ratings.get(&question_id) {
            let entry = sums.entry(group_id).or_insert((0.0, 0));
            entry.0 += rating;
            entry.1 += 1;
        }
    }
    Ok(sums
        .into_iter()
        .filter_map(|(group_id, (sum, count))| {
            (count > 0).then(|| (group_id, round2(sum / count as f64)))
        })
        .collect())
}

/// Average per-question rating for every math1 chapter (top-level children).
pub fn chapter_ratings(conn: &Connection, today: NaiveDate) -> Result<HashMap<i64, f64>, String> {
    average_ratings_by_group(
        conn,
        today,
        "WITH RECURSIVE cat_descendants(ancestor_id, descendant_id) AS (
           SELECT id, id FROM categories WHERE math1=1
           UNION ALL
           SELECT cd.ancestor_id, c.id
           FROM categories c
           JOIN cat_descendants cd ON c.parent_id = cd.descendant_id
           WHERE c.math1=1
         )
         SELECT DISTINCT c.id, qc.question_id
         FROM categories c
         JOIN cat_descendants cd ON cd.ancestor_id = c.id
         JOIN question_categories qc ON qc.category_id = cd.descendant_id
         WHERE c.parent_id IN (SELECT id FROM categories WHERE depth=0 AND math1=1) AND c.math1=1",
    )
}

/// Average per-question rating for every math1 taxonomy node.
pub fn node_ratings(conn: &Connection, today: NaiveDate) -> Result<HashMap<i64, f64>, String> {
    average_ratings_by_group(
        conn,
        today,
        "WITH RECURSIVE ancestry(id,parent_id,chapter_id,name,path,root_name,depth) AS (
           SELECT id,parent_id,id,name,path,root_name,depth FROM categories c
           WHERE c.parent_id IN (SELECT id FROM categories WHERE depth=0 AND math1=1) AND c.math1=1
           UNION ALL
           SELECT c.id,c.parent_id,a.chapter_id,c.name,c.path,a.root_name,c.depth
           FROM categories c JOIN ancestry a ON c.parent_id=a.id WHERE c.math1=1
         ), cat_descendants(ancestor_id, descendant_id) AS (
           SELECT id, id FROM categories WHERE math1=1
           UNION ALL
           SELECT cd.ancestor_id, c.id
           FROM categories c
           JOIN cat_descendants cd ON c.parent_id = cd.descendant_id
           WHERE c.math1=1
         )
         SELECT DISTINCT a.id, qc.question_id
         FROM ancestry a
         JOIN cat_descendants cd ON cd.ancestor_id = a.id
         JOIN question_categories qc ON qc.category_id = cd.descendant_id",
    )
}

/// HLTV Rating 2.0 风格的六维线性合成：
/// `P = 0.42×解决 + 0.18×严谨 + 0.18×影响力 − 0.22×错误代价`，
/// `rating = clamp(0.24 + 0.0168×P) × 难度系数`。权重按 Rating 3.0 的
/// 「产出 60% / 代价 40%」理念配平：部分正确恰好落在均值 1.00，
/// 全维满分的普通全对约 1.45，六维全优约 1.55，做错沉到 0.4 一档。
const HLTV_W_SOLVING: f64 = 0.42;
const HLTV_W_RIGOR: f64 = 0.18;
const HLTV_W_IMPACT: f64 = 0.18;
const HLTV_W_COST: f64 = 0.22;
const HLTV_INTERCEPT: f64 = 0.30;
const HLTV_SLOPE: f64 = 0.016;

/// Codex 六维证据（0-100），任一存在即走 HLTV 合成。
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct DimensionEvidence {
    pub rigor: Option<f64>,
    pub computation: Option<f64>,
    pub modeling: Option<f64>,
    pub method_use: Option<f64>,
    pub speed: Option<f64>,
    pub strategy_insight: Option<f64>,
    pub technique_level: Option<i32>,
}

impl DimensionEvidence {
    pub fn is_empty(&self) -> bool {
        self.rigor.is_none()
            && self.computation.is_none()
            && self.modeling.is_none()
            && self.method_use.is_none()
            && self.speed.is_none()
            && self.strategy_insight.is_none()
    }
}

pub fn hltv_rating(
    outcome: &str,
    dims: &DimensionEvidence,
    duration_seconds: i64,
    benchmark_seconds: i64,
    difficulty_multiplier: Option<f64>,
) -> f64 {
    let solving = match outcome {
        "correct" => 100.0,
        "partial" => 62.0,
        "uncertain" => 35.0,
        _ => 25.0,
    };
    let base_cost = match outcome {
        "correct" => 0.0,
        "partial" => 40.0,
        "uncertain" => 60.0,
        _ => 100.0,
    };
    let duration = duration_seconds.max(1) as f64;
    let bench = benchmark_seconds.max(1) as f64;
    let time_cost = (((duration / bench) - 1.0).clamp(0.0, 1.0)) * 100.0;
    let cost = base_cost * 0.75 + time_cost * 0.25;

    // 维度缺失时按结果回退，保证公式对任何输入都可计算
    let rigor = dims.rigor.unwrap_or(match outcome {
        "correct" => 75.0,
        "partial" => 60.0,
        "uncertain" => 50.0,
        _ => 55.0,
    });
    let mut impact = 0.6 * dims.strategy_insight.unwrap_or(match outcome {
        "correct" => 60.0,
        "partial" => 50.0,
        "uncertain" => 45.0,
        _ => 40.0,
    }) + 0.4 * dims.method_use.unwrap_or(match outcome {
        "correct" => 60.0,
        "partial" => 50.0,
        "uncertain" => 45.0,
        _ => 40.0,
    });
    if dims.technique_level.unwrap_or(0) >= 4 {
        impact += 5.0;
    }
    let impact = impact.clamp(0.0, 100.0);

    let composite = HLTV_W_SOLVING * solving
        + HLTV_W_RIGOR * rigor
        + HLTV_W_IMPACT * impact
        - HLTV_W_COST * cost;
    let difficulty = difficulty_multiplier
        .unwrap_or(1.0)
        .clamp(DIFFICULTY_MULTIPLIER_MIN, DIFFICULTY_MULTIPLIER_MAX);
    round2(((HLTV_INTERCEPT + HLTV_SLOPE * composite) * difficulty).clamp(RATING_MIN, RATING_MAX))
}

/// 完美平台段位分界：D <1000，D+ 1000-1200，C 1201-1400，C+ 1401-1600，
/// B 1601-1800，B+ 1801-2000，A 2001-2200，A+ 2201-2400，S ≥2400。
/// 跨索引升段会触发 ELO 晋级保护。
pub fn rank_band_index(rating: f64) -> usize {
    const BANDS: [f64; 8] = [1000.0, 1201.0, 1401.0, 1601.0, 1801.0, 2001.0, 2201.0, 2401.0];
    let mut index = 0;
    for (i, band) in BANDS.iter().enumerate() {
        if rating >= *band {
            index = i + 1;
        }
    }
    index
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn curve_keeps_average_at_one_and_reserves_the_top() {
        assert_eq!(rating_curve(0.0, 1.0), 0.25);
        assert_eq!(rating_curve(60.0, 1.0), 1.0);
        // 1.50 already requires an exceptional performance score
        assert!(rating_curve(95.0, 1.0) < 1.55);
        assert_eq!(rating_curve(100.0, 1.0), 1.82);
        // difficulty multiplier is clamped to the shared band
        assert_eq!(rating_curve(60.0, 1.5), 1.1);
        assert_eq!(rating_curve(60.0, 0.1), 0.94);
    }

    #[test]
    fn fluency_never_outranks_outcome() {
        assert_eq!(calibrated_fluency(4, "wrong"), 2);
        assert_eq!(calibrated_fluency(4, "partial"), 3);
        assert_eq!(calibrated_fluency(4, "correct"), 4);
        assert_eq!(calibrated_fluency(0, "correct"), 1);
    }

    #[test]
    fn wrong_answer_with_confident_self_rating_scores_below_correct() {
        let wrong = attempt_rating("wrong", 4, 180, 180);
        let correct = attempt_rating("correct", 4, 180, 180);
        assert!(correct > 1.45, "fluent correct should reach the upper tail: {correct}");
        assert!(wrong < 0.85, "wrong must stay below average despite self-rating 4: {wrong}");
    }

    #[test]
    fn hltv_composite_anchors_the_distribution() {
        // 部分正确、无维度证据：略低于均值 1.00
        let partial = hltv_rating("partial", &DimensionEvidence::default(), 600, 600, None);
        assert!((0.88..=0.98).contains(&partial), "partial should sit near 1.00: {partial}");
        // 普通全对（无维度）：约 1.36
        let correct = hltv_rating("correct", &DimensionEvidence::default(), 600, 600, None);
        assert!((1.30..=1.42).contains(&correct), "plain correct: {correct}");
        // 六维全优 + 高技巧等级：逼近 1.55，难度系数可再抬一档
        let elite = hltv_rating(
            "correct",
            &DimensionEvidence {
                rigor: Some(100.0),
                strategy_insight: Some(100.0),
                method_use: Some(100.0),
                technique_level: Some(5),
                ..Default::default()
            },
            300,
            600,
            Some(1.10),
        );
        assert!(elite >= 1.55, "elite should reach 1.55+: {elite}");
        // 做错且超时：沉到 0.4 一档
        let wrong = hltv_rating("wrong", &DimensionEvidence::default(), 900, 600, None);
        assert!(wrong <= 0.45, "wrong should sink: {wrong}");
        // 六维证据拉不开的部分正确也应在均值附近
        let partial_detailed = hltv_rating(
            "partial",
            &DimensionEvidence {
                rigor: Some(60.0),
                strategy_insight: Some(55.0),
                method_use: Some(55.0),
                ..Default::default()
            },
            600,
            600,
            None,
        );
        assert!((0.85..=1.05).contains(&partial_detailed), "{partial_detailed}");
    }

    #[test]
    fn aggregate_trusts_ai_rating_and_decays_old_attempts() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 22).unwrap();
        let evidence = vec![
            AttemptEvidence {
                outcome: "wrong".into(),
                fluency: 3,
                duration_seconds: Some(600),
                benchmark_seconds: 600,
                ai_rating: None,
                dims: DimensionEvidence::default(),
                difficulty_multiplier: None,
                attempted_date: Some(NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()),
            },
            AttemptEvidence {
                outcome: "correct".into(),
                fluency: 3,
                duration_seconds: Some(600),
                benchmark_seconds: 600,
                ai_rating: Some(1.6),
                dims: DimensionEvidence::default(),
                difficulty_multiplier: None,
                attempted_date: Some(NaiveDate::from_ymd_opt(2026, 8, 20).unwrap()),
            },
        ];
        let rating = aggregate_question_rating(&evidence, today).unwrap();
        // the recent 1.6 dominates the two-month-old low attempt
        assert!(rating > 1.5, "recent evidence should dominate: {rating}");
        assert!(aggregate_question_rating(&[], today).is_none());
    }
}
