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
pub const RATING_MAX: f64 = 2.50;
#[allow(dead_code)]
pub const RATING_AVERAGE: f64 = 1.0;

const DIFFICULTY_MULTIPLIER_MIN: f64 = 0.94;
const DIFFICULTY_MULTIPLIER_MAX: f64 = 1.10;

// ---- Rating 3.0 阶段一重标定（docs/v1.7.0 §02，参数经 336 条真实作答回放验证）----

/// 节奏中性值从 100 下调至 85：「恰好按基准耗时完成」不该与 AI 满分速度同值，
/// 正是旧标定让 31 秒秒杀和 10 分钟磨出拿到同一个分。
const PACING_NEUTRAL: f64 = 85.0;
const PACING_MIN: f64 = 45.0;
const PACING_MAX: f64 = 135.0;
/// 主客观融合：客观耗时略占优，杜绝「AI 说快就是快、实际磨 20 分钟」的虚高。
const PACING_AI_WEIGHT: f64 = 0.45;
const PACING_TIME_WEIGHT: f64 = 0.55;
/// 草率护栏：做错时的「快」是草率不是效率，节奏分封顶在中性值。
const PACING_RUSH_CAP_ON_WRONG: f64 = 85.0;
/// 难度软压缩取代硬 clamp：区间 [0.92, 1.10] 内原样，超出部分按 45% 折算，
/// 上封顶 1.24。保留攻克难题的额外回报（回放：难题做对摆动是普通题的 2 倍），
/// 同时防止 AI 提交的极端难度（实测有 1.2~1.5）失控。
const SOFT_DIFF_FLOOR: f64 = 0.92;
const SOFT_DIFF_CEIL: f64 = 1.10;
const SOFT_DIFF_CAP: f64 = 1.24;
const SOFT_DIFF_SLOPE: f64 = 0.45;
/// Donk 门槛从物理不可达的 125（pacing 上限曾是 115）下调至 118 ≈ 0.7×基准耗时，
/// 并移除 technique_level ≥ 4 的附加条件——回放确认 336 条中仅 1 条触发，依然稀有。
const DONK_PACING_THRESHOLD: f64 = 118.0;
/// 情境乘子：修复旧错 ×1.04；当日连对每多一连 +1.5%，封顶 +6%。
const REDEEM_MULTIPLIER: f64 = 1.04;
const STREAK_STEP: f64 = 0.015;
const STREAK_BONUS_CAP: f64 = 0.06;
/// 当日连对的前 2 连不加成，从第 3 连开始给正反馈。
const STREAK_FREE_COUNT: u32 = 2;

/// 难度软压缩（Rating 3.0 ③）：取代 [0.94, 1.10] 硬 clamp。
fn soft_diff(difficulty: f64) -> f64 {
    let compressed = if difficulty < SOFT_DIFF_FLOOR {
        SOFT_DIFF_FLOOR + (difficulty - SOFT_DIFF_FLOOR) * SOFT_DIFF_SLOPE
    } else if difficulty > SOFT_DIFF_CEIL {
        SOFT_DIFF_CEIL + (difficulty - SOFT_DIFF_CEIL) * SOFT_DIFF_SLOPE
    } else {
        difficulty
    };
    compressed.min(SOFT_DIFF_CAP)
}

/// 情境乘子（Rating 3.0 ⑥）：修复旧错与当日连对手感，只奖励 correct 结果。
/// 只作用于「当前水平评分链」（`aggregate_question_rating`）；
/// ELO 结算链路（lib.rs `settle_elo`）不经过此处，保持 v1.6.9 已回放验证的行为。
pub fn apply_rating_context(
    rating: f64,
    outcome: &str,
    repaired: bool,
    streak_correct_today: u32,
) -> f64 {
    if outcome != "correct" {
        return rating;
    }
    let mut multiplied = rating;
    if repaired {
        multiplied *= REDEEM_MULTIPLIER;
    }
    let bonus = ((streak_correct_today.saturating_sub(STREAK_FREE_COUNT)) as f64 * STREAK_STEP)
        .min(STREAK_BONUS_CAP);
    round2((multiplied * (1.0 + bonus)).clamp(RATING_MIN, RATING_MAX))
}
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

pub struct AttemptEvidence {
    pub outcome: String,
    pub fluency: i32,
    pub duration_seconds: Option<i64>,
    pub benchmark_seconds: i64,
    pub ai_rating: Option<f64>,
    pub dims: DimensionEvidence,
    pub difficulty_multiplier: Option<f64>,
    pub attempted_date: Option<NaiveDate>,
    /// 情境乘子（阶段一 ⑥）：本题此前是否有做错记录（本次做对即「修复旧错」）。
    pub repaired: bool,
    /// 本次作答之前、同一天的连续做对次数（0 = 无连对手感加成）。
    pub streak_correct_today: u32,
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
        // 情境乘子只进「当前水平评分链」；ELO 结算链路不经过此函数。
        let rating = apply_rating_context(
            rating,
            &item.outcome,
            item.repaired,
            item.streak_correct_today,
        );
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
            "SELECT a.id, a.question_id, substr(a.attempted_at,1,10), COALESCE(a.outcome,a.result),
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
                r.get::<_, i64>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i32>(4)?,
                r.get::<_, Option<f64>>(5)?,
                r.get::<_, Option<i64>>(6)?,
                r.get::<_, String>(7)?,
                r.get::<_, Option<f64>>(8)?,
                r.get::<_, Option<f64>>(9)?,
                r.get::<_, Option<f64>>(10)?,
                r.get::<_, Option<f64>>(11)?,
                r.get::<_, Option<f64>>(12)?,
                r.get::<_, Option<f64>>(13)?,
                r.get::<_, Option<i32>>(14)?,
                r.get::<_, Option<f64>>(15)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    // 情境乘子上下文（阶段一 ⑥）：
    // 连对手感按全局时间序统计（同一天内连续做对，错题/换天清零）；
    // 修复标记按同题历史判断（此前做错、本次做对）。
    let mut chronological: Vec<(String, i64, &str)> = rows
        .iter()
        .map(|(id, _qid, day, outcome, ..)| (day.clone().unwrap_or_default(), *id, outcome.as_str()))
        .collect();
    chronological.sort();
    let mut streak_by_id: HashMap<i64, u32> = HashMap::new();
    let mut streak: u32 = 0;
    let mut current_day = String::new();
    for (day, id, outcome) in chronological {
        let is_correct = outcome == "correct";
        streak = if !is_correct {
            0
        } else if day == current_day {
            streak + 1
        } else {
            1
        };
        current_day = day;
        if is_correct {
            streak_by_id.insert(id, streak.saturating_sub(1));
        }
    }

    let mut by_question: HashMap<i64, Vec<AttemptEvidence>> = HashMap::new();
    let mut ever_wrong: HashMap<i64, bool> = HashMap::new();
    for (id, question_id, date_str, outcome, fluency, ai_rating, duration, question_type, rigor, computation, modeling, method_use, speed, strategy_insight, technique_level, difficulty_multiplier) in
        rows
    {
        let is_correct = outcome == "correct";
        let repaired = is_correct && ever_wrong.get(&question_id).copied().unwrap_or(false);
        if outcome == "wrong" || outcome == "incorrect" {
            ever_wrong.insert(question_id, true);
        }
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
            repaired,
            streak_correct_today: streak_by_id.get(&id).copied().unwrap_or(0),
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

/// HLTV Rating 3.0 风格的五维战术复合模型：
/// `P = 0.35×得分产出(Cast) + 0.25×破局影响(Impact) + 0.20×防白给稳定性(KAST) + 0.20×节奏效率(Pacing) − 经济拖累(EcoDrag)`，
/// `rating = clamp(0.26 + 0.0165×P) × 难度系数`。
/// 兼顾得分产出、上限突破（Clutch 残局加成）、严谨防守与时间黑洞惩罚。
const HLTV3_W_CAST: f64 = 0.38;
const HLTV3_W_IMPACT: f64 = 0.22;
const HLTV3_W_KAST: f64 = 0.20;
const HLTV3_W_PACING: f64 = 0.20;
const HLTV3_INTERCEPT: f64 = 0.26;
const HLTV3_SLOPE: f64 = 0.0125;

/// 计时可信区间（秒）。低于下界的记录多半来自批量导入、误触或计时未启动；
/// 高于上界的记录多半是漏停计时器。
const PACING_MIN_PLAUSIBLE_SECONDS: f64 = 5.0;
const PACING_MAX_PLAUSIBLE_SECONDS: f64 = 1800.0;

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
    // 难度软压缩（阶段一 ③）：区间内原样，超出按 45% 折算封顶 1.24
    let diff = soft_diff(difficulty_multiplier.unwrap_or(1.0));

    // 1. Cast (得分产出值)
    let comp_hint = dims.computation.unwrap_or(50.0);
    let cast = match outcome {
        "correct" => 100.0,
        "partial" => 38.0 + (comp_hint / 100.0) * 12.0,
        "uncertain" => 30.0,
        _ => 10.0,
    };

    // 2. Impact (破局突破与技巧，含 Clutch 残局加成)
    let strategy = dims.strategy_insight.unwrap_or(match outcome {
        "correct" => 65.0,
        "partial" => 45.0,
        "uncertain" => 30.0,
        _ => 18.0,
    });
    let method = dims.method_use.unwrap_or(match outcome {
        "correct" => 65.0,
        "partial" => 45.0,
        "uncertain" => 30.0,
        _ => 18.0,
    });
    let mut impact = 0.60 * strategy + 0.40 * method;
    if dims.technique_level.unwrap_or(0) >= 4 {
        impact += 6.0;
    }
    // 难题残局突破加成 (Clutch)
    if diff >= 1.06 && outcome != "wrong" {
        impact += 6.0;
    }
    let impact = impact.clamp(0.0, 100.0);

    // 3. KAST (严谨防白给率: 严谨性50% + 计算力30% + 审题建模20%)
    let rigor = dims.rigor.unwrap_or(match outcome {
        "correct" => 75.0,
        "partial" => 48.0,
        "uncertain" => 35.0,
        _ => 25.0,
    });
    let computation = dims.computation.unwrap_or(match outcome {
        "correct" => 75.0,
        "partial" => 48.0,
        "uncertain" => 35.0,
        _ => 25.0,
    });
    let modeling = dims.modeling.unwrap_or(match outcome {
        "correct" => 75.0,
        "partial" => 48.0,
        "uncertain" => 35.0,
        _ => 25.0,
    });
    let kast = (0.50 * rigor + 0.30 * computation + 0.20 * modeling).clamp(0.0, 100.0);

    // 4. Pacing (时间节奏分) — 阶段一 ①②：重标定 + 主客观融合
    let duration = duration_seconds.max(1) as f64;
    let bench = benchmark_seconds.max(1) as f64;
    // 计时护栏：纸笔作答的最短路程不可能在 5 秒内完成，超过 30 分钟多半是漏停计时器。
    // 这类记录的耗时不可信，此前会被 (bench/duration) 直接顶到满分上限，
    // 导致脏数据反而拿到最高节奏分。这里回落到中性值。
    let timing_plausible =
        duration >= PACING_MIN_PLAUSIBLE_SECONDS && duration <= PACING_MAX_PLAUSIBLE_SECONDS;
    let p_time = if timing_plausible {
        ((bench / duration) * PACING_NEUTRAL).clamp(PACING_MIN, PACING_MAX)
    } else {
        PACING_NEUTRAL
    };
    // AI 的 speed 维（0-100）映射到 [45, 135] 后与客观耗时融合，客观略占优：
    // 「AI 说快但实际磨了 20 分钟」再也拿不到满分节奏。
    let pacing = match dims.speed {
        Some(speed) => {
            let p_ai = PACING_MIN + (speed.clamp(0.0, 100.0) / 100.0) * (PACING_MAX - PACING_MIN);
            PACING_AI_WEIGHT * p_ai + PACING_TIME_WEIGHT * p_time
        }
        None => p_time,
    };
    // 草率护栏（阶段一 ⑤）：做错时「快」是草率不是效率，节奏分封顶在中性值。
    let pacing = if outcome == "wrong" || outcome == "incorrect" {
        pacing.min(PACING_RUSH_CAP_ON_WRONG)
    } else {
        pacing
    };

    // 5. EcoDrag (经济黑洞非线性惩罚: 做错且超时严重)
    let eco_drag = if outcome == "wrong" || outcome == "incorrect" {
        // 计时不可信时（漏停表等）不据此加重惩罚，只按「做错」的基础档计
        if timing_plausible && duration > bench * 1.2 {
            (((duration / bench) - 1.0).clamp(0.0, 1.5)) * 24.0
        } else {
            8.0
        }
    } else {
        0.0
    };

    let composite = HLTV3_W_CAST * cast
        + HLTV3_W_IMPACT * impact
        + HLTV3_W_KAST * kast
        + HLTV3_W_PACING * pacing
        - eco_drag;

    let base_raw = HLTV3_INTERCEPT + HLTV3_SLOPE * composite;
    // Donk-tier 极端高光爆发（阶段一 ④）：门槛 125 → 118（约 0.7×基准耗时），移除
    // technique_level ≥ 4 限制。回放验证：336 条中仅 1 条（31 秒秒杀满分六维）触达 2.05。
    let rating = if outcome == "correct" && base_raw > 1.40 && pacing >= DONK_PACING_THRESHOLD {
        let burst = (base_raw - 1.40).powf(0.82) * 1.55;
        (1.40 + burst) * diff
    } else {
        base_raw * diff
    };

    round2(rating.clamp(RATING_MIN, RATING_MAX))
}

/// 考场 150 分预测分映射算法 (单调平滑分段函数)
#[allow(dead_code)]
pub fn predicted_exam_score(rating: f64, kast: Option<f64>) -> i32 {
    let k = kast.unwrap_or(75.0).clamp(40.0, 100.0) / 100.0;
    let r = rating.clamp(0.0, RATING_MAX);
    let base = if r <= 0.80 {
        (r / 0.80) * 65.0
    } else if r <= 1.20 {
        65.0 + ((r - 0.80) / 0.40) * 50.0 // 0.80 -> 65, 1.00 -> 90, 1.17 -> 111.3, 1.20 -> 115
    } else if r <= 1.50 {
        115.0 + ((r - 1.20) / 0.30) * 28.0 // 1.20 -> 115, 1.35 -> 129, 1.50 -> 143
    } else {
        143.0 + ((r - 1.50) / 0.20).clamp(0.0, 1.0) * 7.0 // 1.50 -> 143, 1.70+ -> 150
    };
    let stability = (k / 0.75).powf(0.12);
    let score = base * stability;
    score.round().clamp(0.0, 150.0) as i32
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
    fn benchmark_seconds_pins_the_math_one_timing_table() {
        // 基准耗时被提示词、压力报告与前端 utils.ts::benchmarkSeconds 三处引用；
        // 这条测试把内核侧钉死，任何一侧改数值都会在这里露出来。
        assert_eq!(benchmark_seconds("single_choice"), 180);
        assert_eq!(benchmark_seconds("multiple_choice"), 240);
        assert_eq!(benchmark_seconds("fill_in"), 300);
        assert_eq!(benchmark_seconds("subjective"), 600);
        // 未知题型回退解答题基准，绝不能给 0（会让 pace 除零失真）
        assert_eq!(benchmark_seconds(""), 600);
        assert_eq!(benchmark_seconds("unknown_type"), 600);
    }

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
        // 阶段一重标定后的锚点（pacing 中性 85 / Donk 118 / 软难度）：
        // 部分正确、无维度证据：略低于均值 1.00（pacing 85 使其比旧版低约 0.03）
        let partial = hltv_rating("partial", &DimensionEvidence::default(), 600, 600, None);
        assert!((0.88..=0.98).contains(&partial), "partial should sit near 1.00: {partial}");
        // 普通全对（无维度）：约 1.31（旧标定 1.35——中性节奏不再是满分）
        let correct = hltv_rating("correct", &DimensionEvidence::default(), 600, 600, None);
        assert!((1.28..=1.35).contains(&correct), "plain correct: {correct}");
        // 六维全优 + 高技巧等级 + 半倍基准耗时：冲刺 Donk 区间边缘（软难度 1.10 下约 1.93）
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
        assert!((1.85..=2.00).contains(&elite), "elite should reach the Donk rim: {elite}");
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
    fn soft_diff_compresses_extremes_without_touching_the_band() {
        assert_eq!(soft_diff(1.0), 1.0);
        assert_eq!(soft_diff(0.94), 0.94);
        // 区间上方 45% 折算：1.2 → 1.145，极端值封顶 1.24
        assert!((soft_diff(1.2) - 1.145).abs() < 1e-9);
        assert_eq!(soft_diff(1.5), SOFT_DIFF_CAP);
        // 区间下方同样折算，不再一刀切回 0.94
        assert!((soft_diff(0.5) - (SOFT_DIFF_FLOOR - 0.42 * SOFT_DIFF_SLOPE)).abs() < 1e-9);
    }

    #[test]
    fn context_multipliers_reward_redeem_and_hot_streaks_only_for_corrects() {
        assert_eq!(apply_rating_context(1.0, "correct", true, 0), 1.04);
        // 前 2 连不加成，第 3 连起每连 +1.5%，封顶 +6%
        assert_eq!(apply_rating_context(1.0, "correct", false, 2), 1.0);
        assert_eq!(apply_rating_context(1.2, "correct", false, 3), 1.22);
        assert_eq!(apply_rating_context(1.0, "correct", false, 100), 1.06);
        // 做错不享受任何情境加成
        assert_eq!(apply_rating_context(1.0, "wrong", true, 100), 1.0);
        assert_eq!(apply_rating_context(1.0, "partial", false, 8), 1.0);
    }

    #[test]
    fn rushing_a_wrong_answer_earns_no_pacing_credit() {
        // 草率护栏：「秒错」与「按基准磨出做错」节奏分同为中性值 85，
        // 快而错不再伪装成高效率。
        let rushed = hltv_rating(
            "wrong",
            &DimensionEvidence {
                speed: Some(100.0),
                ..Default::default()
            },
            60,
            600,
            None,
        );
        let unhurried = hltv_rating("wrong", &DimensionEvidence::default(), 600, 600, None);
        assert_eq!(rushed, unhurried, "a fast wrong must not outscore a slow wrong");
    }

    #[test]
    fn subjective_speed_cannot_overrule_objective_overtime() {
        // 主客观融合（客观 0.55 占优）：AI 给满分速度但实际耗时 2 倍基准，
        // 融合 pacing = 0.45*135 + 0.55*45 = 85.5 ≈ 中性，不得分。
        let fast_claim_slow_reality = hltv_rating(
            "correct",
            &DimensionEvidence {
                speed: Some(100.0),
                ..Default::default()
            },
            1200,
            600,
            None,
        );
        let neutral = hltv_rating("correct", &DimensionEvidence::default(), 600, 600, None);
        assert!(
            fast_claim_slow_reality < neutral + 0.02,
            "claiming speed while being slow must not beat neutral pacing: {fast_claim_slow_reality} vs {neutral}"
        );
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
                repaired: false,
                streak_correct_today: 0,
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
                // 此前做错、本次做对 → 修复旧错，×1.04
                repaired: true,
                streak_correct_today: 0,
            },
        ];
        let rating = aggregate_question_rating(&evidence, today).unwrap();
        // the recent 1.6 dominates the two-month-old low attempt (redeem adds ×1.04)
        assert!(rating > 1.5, "recent evidence should dominate: {rating}");
        assert!(aggregate_question_rating(&[], today).is_none());
    }

    #[test]
    fn donk_burst_reaches_two_plus_under_god_mode() {
        // Donk 级神仙表现：压轴难题（软压缩后 1.2 → 1.145）+ 极速秒杀 + 满分六维。
        // 门槛 118 在 pacing 重标定后真实可达，但 2.00+ 仍需难度与速度同时到位。
        let donk = hltv_rating(
            "correct",
            &DimensionEvidence {
                rigor: Some(100.0),
                computation: Some(100.0),
                modeling: Some(100.0),
                strategy_insight: Some(98.0),
                method_use: Some(95.0),
                technique_level: Some(5),
                speed: Some(100.0),
            },
            180,
            600,
            Some(1.2),
        );
        assert!(donk >= 2.00, "donk mode should breakthrough 2.00+: {donk}");
        // 反向护栏：六维再完美，慢速做对也绝不触发 Donk 爆发公式
        //（base ≈ 1.47，Clutch+软难度抬到 1.62，仍远低于 Donk 区间下沿 ~1.85）。
        let grinding = hltv_rating(
            "correct",
            &DimensionEvidence {
                rigor: Some(100.0),
                computation: Some(100.0),
                modeling: Some(100.0),
                strategy_insight: Some(100.0),
                method_use: Some(100.0),
                technique_level: Some(5),
                ..Default::default()
            },
            600,
            600,
            Some(1.10),
        );
        assert!(grinding < 1.75, "slow perfect work must stay below Donk: {grinding}");
    }

    #[test]
    fn predicted_exam_score_maps_realistically() {
        assert!(predicted_exam_score(0.60, Some(50.0)) <= 52);
        let average = predicted_exam_score(1.00, Some(75.0));
        assert!((85..=95).contains(&average), "1.00 should map to ~85-95: {average}");
        let user_grade = predicted_exam_score(1.17, Some(86.0));
        assert!((110..=116).contains(&user_grade), "1.17 should map to 110-116: {user_grade}");
        let high = predicted_exam_score(1.30, Some(85.0));
        assert!((122..=132).contains(&high), "1.30 should map to ~122-132: {high}");
        let perfect = predicted_exam_score(1.60, Some(100.0));
        assert!(perfect >= 145, "1.60+ should map to 145-150: {perfect}");
    }
}

