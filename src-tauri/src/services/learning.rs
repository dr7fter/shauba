use chrono::{DateTime, Duration, Local, Utc};
use rusqlite::{params, Connection, OptionalExtension};

/// Minimum confidence at which Codex evidence may affect the deterministic learning projection.
/// Below this threshold the raw evidence/diagnosis is retained for audit, but core state is unchanged.
pub const CORE_CONFIDENCE_THRESHOLD: f64 = 0.75;

/// Confidence is deliberately tiered: eligible but uncertain evidence is adopted at
/// reduced weight, while highly confident evidence receives full deterministic weight.
pub fn adoption_weight(confidence: f64, outcome: &str) -> f64 {
    if !confidence_allows_core(confidence, outcome) {
        0.0
    } else if confidence < 0.90 {
        0.50
    } else {
        1.0
    }
}

#[derive(Debug, Clone)]
pub struct AttemptEvidenceInput {
    pub evidence_key: String,
    pub task_id: Option<String>,
    pub question_id: i64,
    pub attempt_id: i64,
    pub category_key: String,
    pub source: String,
    pub outcome: String,
    pub confidence: f64,
    pub self_rating: i32,
    pub mode: String,
    pub occurred_at: String,
    pub normalized_error_class: Option<String>,
    pub next_action: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DiagnosisInput {
    pub task_id: String,
    pub question_id: i64,
    pub attempt_id: Option<i64>,
    pub category_key: String,
    pub verdict: Option<String>,
    pub error_tags: Vec<String>,
    pub weakness_tags: Vec<String>,
    pub earliest_error: Option<String>,
    pub confidence: f64,
    pub is_variant: bool,
    pub is_delayed_review: bool,
    pub created_at: String,
}

/// Context copied from the immutable attempt row when Codex later adjudicates that attempt.
/// It deliberately does not mutate `attempts` or any ELO event: the learning sidecar keeps
/// its own append-only correction evidence and rebuilds only the affected skill projection.
#[derive(Debug, Clone)]
pub struct CodexAdjudicationInput {
    pub diagnosis: DiagnosisInput,
    pub self_rating: i32,
    pub mode: String,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DiagnosisUpsertResult {
    pub inserted: bool,
    pub semantic_changed: bool,
}

pub fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS learning_evidence (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           evidence_key TEXT NOT NULL UNIQUE,
           task_id TEXT,
           question_id INTEGER NOT NULL,
           attempt_id INTEGER,
           category_key TEXT NOT NULL,
           source TEXT NOT NULL,
           evidence_kind TEXT NOT NULL DEFAULT 'attempt',
           supersedes_attempt_id INTEGER,
           outcome TEXT NOT NULL,
           confidence REAL NOT NULL DEFAULT 1.0,
           adoption_weight REAL NOT NULL DEFAULT 0.0,
           mastery_signal REAL NOT NULL DEFAULT 0.0,
           fluency_signal REAL NOT NULL DEFAULT 0.0,
           transfer_signal REAL NOT NULL DEFAULT 0.0,
           retention_signal REAL NOT NULL DEFAULT 0.0,
           is_variant INTEGER NOT NULL DEFAULT 0,
           is_delayed_review INTEGER NOT NULL DEFAULT 0,
           normalized_error_class TEXT NOT NULL DEFAULT 'uncertain',
           next_action TEXT NOT NULL DEFAULT 'manual_check',
           occurred_at TEXT NOT NULL,
           created_at TEXT NOT NULL,
           projection_applied INTEGER NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS learning_diagnoses (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           task_id TEXT NOT NULL,
           question_id INTEGER NOT NULL,
           attempt_id INTEGER,
           category_key TEXT NOT NULL,
           verdict TEXT,
           normalized_error_class TEXT NOT NULL DEFAULT 'uncertain',
           next_action TEXT NOT NULL DEFAULT 'manual_check',
           earliest_error TEXT,
           error_tags_json TEXT NOT NULL DEFAULT '[]',
           weakness_tags_json TEXT NOT NULL DEFAULT '[]',
           confidence REAL NOT NULL DEFAULT 0.0,
           is_variant INTEGER NOT NULL DEFAULT 0,
           is_delayed_review INTEGER NOT NULL DEFAULT 0,
           semantic_fingerprint TEXT NOT NULL DEFAULT '',
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL,
           UNIQUE(task_id, question_id)
         );
         CREATE TABLE IF NOT EXISTS skill_states (
           category_key TEXT PRIMARY KEY,
           category_id INTEGER,
           state TEXT NOT NULL DEFAULT 'unseen',
           mastery REAL NOT NULL DEFAULT 0.0,
           fluency REAL NOT NULL DEFAULT 0.0,
           transfer REAL NOT NULL DEFAULT 0.0,
           retention REAL NOT NULL DEFAULT 0.0,
           confidence REAL NOT NULL DEFAULT 0.0,
           evidence_count INTEGER NOT NULL DEFAULT 0,
           recent_failure_count INTEGER NOT NULL DEFAULT 0,
           last_evidence_at TEXT,
           last_successful_review_at TEXT,
           next_review_at TEXT,
           updated_at TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS review_tasks (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           task_id TEXT NOT NULL,
           question_id INTEGER NOT NULL,
           category_key TEXT NOT NULL,
           stage TEXT NOT NULL DEFAULT 'diagnosed',
           status TEXT NOT NULL DEFAULT 'pending',
           next_action TEXT NOT NULL DEFAULT 'manual_check',
           is_variant INTEGER NOT NULL DEFAULT 0,
           delayed_review_required INTEGER NOT NULL DEFAULT 0,
           last_outcome TEXT,
           last_attempt_id INTEGER,
           next_review_at TEXT,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL,
           UNIQUE(task_id, question_id)
         );",
    )?;

    // Current v1.5.0 development builds may already have partial learning tables.
    // Keep every later field additive and repeatable: CREATE TABLE IF NOT EXISTS does
    // not repair a table produced by an interrupted early development build.
    for (table, column, ddl) in [
        ("learning_evidence", "evidence_kind", "TEXT NOT NULL DEFAULT 'attempt'"),
        ("learning_evidence", "supersedes_attempt_id", "INTEGER"),
        ("learning_evidence", "adoption_weight", "REAL NOT NULL DEFAULT 0.0"),
        ("learning_evidence", "mastery_signal", "REAL NOT NULL DEFAULT 0.0"),
        ("learning_evidence", "fluency_signal", "REAL NOT NULL DEFAULT 0.0"),
        ("learning_evidence", "transfer_signal", "REAL NOT NULL DEFAULT 0.0"),
        ("learning_evidence", "retention_signal", "REAL NOT NULL DEFAULT 0.0"),
        ("learning_evidence", "is_variant", "INTEGER NOT NULL DEFAULT 0"),
        ("learning_evidence", "is_delayed_review", "INTEGER NOT NULL DEFAULT 0"),
        ("learning_evidence", "normalized_error_class", "TEXT NOT NULL DEFAULT 'uncertain'"),
        ("learning_evidence", "next_action", "TEXT NOT NULL DEFAULT 'manual_check'"),
        ("learning_evidence", "projection_applied", "INTEGER NOT NULL DEFAULT 0"),
        ("learning_diagnoses", "attempt_id", "INTEGER"),
        ("learning_diagnoses", "normalized_error_class", "TEXT NOT NULL DEFAULT 'uncertain'"),
        ("learning_diagnoses", "next_action", "TEXT NOT NULL DEFAULT 'manual_check'"),
        ("learning_diagnoses", "earliest_error", "TEXT"),
        ("learning_diagnoses", "error_tags_json", "TEXT NOT NULL DEFAULT '[]'"),
        ("learning_diagnoses", "weakness_tags_json", "TEXT NOT NULL DEFAULT '[]'"),
        ("learning_diagnoses", "confidence", "REAL NOT NULL DEFAULT 0.0"),
        ("learning_diagnoses", "is_variant", "INTEGER NOT NULL DEFAULT 0"),
        ("learning_diagnoses", "is_delayed_review", "INTEGER NOT NULL DEFAULT 0"),
        ("learning_diagnoses", "semantic_fingerprint", "TEXT NOT NULL DEFAULT ''"),
        ("review_tasks", "stage", "TEXT NOT NULL DEFAULT 'diagnosed'"),
        ("review_tasks", "status", "TEXT NOT NULL DEFAULT 'pending'"),
        ("review_tasks", "next_action", "TEXT NOT NULL DEFAULT 'manual_check'"),
        ("review_tasks", "is_variant", "INTEGER NOT NULL DEFAULT 0"),
        ("review_tasks", "delayed_review_required", "INTEGER NOT NULL DEFAULT 0"),
        ("review_tasks", "last_outcome", "TEXT"),
        ("review_tasks", "last_attempt_id", "INTEGER"),
        ("review_tasks", "next_review_at", "TEXT"),
        ("skill_states", "category_id", "INTEGER"),
        ("skill_states", "state", "TEXT NOT NULL DEFAULT 'unseen'"),
        ("skill_states", "mastery", "REAL NOT NULL DEFAULT 0.0"),
        ("skill_states", "fluency", "REAL NOT NULL DEFAULT 0.0"),
        ("skill_states", "transfer", "REAL NOT NULL DEFAULT 0.0"),
        ("skill_states", "retention", "REAL NOT NULL DEFAULT 0.0"),
        ("skill_states", "confidence", "REAL NOT NULL DEFAULT 0.0"),
        ("skill_states", "evidence_count", "INTEGER NOT NULL DEFAULT 0"),
        ("skill_states", "recent_failure_count", "INTEGER NOT NULL DEFAULT 0"),
        ("skill_states", "last_evidence_at", "TEXT"),
        ("skill_states", "last_successful_review_at", "TEXT"),
        ("skill_states", "next_review_at", "TEXT"),
        ("skill_states", "updated_at", "TEXT NOT NULL DEFAULT ''"),
    ] {
        ensure_column(conn, table, column, ddl)?;
    }
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS learning_projection_failures (
           evidence_key TEXT PRIMARY KEY,
           category_key TEXT NOT NULL,
           attempts INTEGER NOT NULL DEFAULT 0,
           last_error TEXT NOT NULL,
           first_failed_at TEXT NOT NULL,
           last_failed_at TEXT NOT NULL,
           resolved INTEGER NOT NULL DEFAULT 0,
           resolved_at TEXT
         );
         CREATE INDEX IF NOT EXISTS idx_learning_evidence_category ON learning_evidence(category_key, occurred_at DESC);
         CREATE INDEX IF NOT EXISTS idx_learning_evidence_question ON learning_evidence(question_id, occurred_at DESC);
         CREATE INDEX IF NOT EXISTS idx_learning_evidence_attempt ON learning_evidence(attempt_id, id DESC);
         CREATE INDEX IF NOT EXISTS idx_learning_evidence_supersedes ON learning_evidence(supersedes_attempt_id, id DESC);
         CREATE INDEX IF NOT EXISTS idx_learning_diagnoses_question ON learning_diagnoses(question_id, updated_at DESC);
         CREATE INDEX IF NOT EXISTS idx_learning_diagnoses_attempt ON learning_diagnoses(attempt_id, updated_at DESC);
         CREATE INDEX IF NOT EXISTS idx_review_tasks_due ON review_tasks(status, next_review_at);
         CREATE INDEX IF NOT EXISTS idx_review_tasks_question ON review_tasks(question_id, updated_at DESC);
         CREATE INDEX IF NOT EXISTS idx_review_tasks_attempt ON review_tasks(last_attempt_id, updated_at DESC);
         CREATE INDEX IF NOT EXISTS idx_learning_projection_failures_pending ON learning_projection_failures(resolved, last_failed_at DESC);",
    )
}

fn ensure_column(conn: &Connection, table: &str, column: &str, ddl: &str) -> rusqlite::Result<()> {
    let pragma = format!("PRAGMA table_info({table})");
    let mut statement = conn.prepare(&pragma)?;
    let exists = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?
        .iter()
        .any(|name| name == column);
    if !exists {
        // `table`, `column` and `ddl` are compile-time migration constants, never user input.
        conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {column} {ddl}"))?;
    }
    Ok(())
}

/// The normalized class is intentionally small and deterministic. AI tags remain intact in the
/// diagnosis table; this class is the stable key used by future recommendation rules.
pub fn normalize_error_class(error_tags: &[String], verdict: Option<&str>) -> &'static str {
    let joined = error_tags.join(" ").to_ascii_lowercase();
    if joined.contains("瞄准")
        || joined.contains("计算")
        || joined.contains("笔误")
        || joined.contains("sign")
        || joined.contains("arithmetic")
    {
        "aiming"
    } else if joined.contains("概念")
        || joined.contains("定理")
        || joined.contains("边界")
        || joined.contains("concept")
    {
        "concept"
    } else if joined.contains("战术")
        || joined.contains("方法")
        || joined.contains("绕路")
        || joined.contains("超时")
        || joined.contains("tactic")
    {
        "tactics"
    } else if joined.is_empty() && matches!(verdict, Some("correct")) {
        "none"
    } else if joined.is_empty() {
        "uncertain"
    } else {
        "mixed"
    }
}

pub fn normalize_outcome(outcome: &str) -> &'static str {
    match outcome.to_ascii_lowercase().as_str() {
        "correct" | "right" => "correct",
        "partial" => "partial",
        "uncertain" | "unknown" => "uncertain",
        _ => "wrong",
    }
}

pub fn confidence_allows_core(confidence: f64, outcome: &str) -> bool {
    normalize_outcome(outcome) != "uncertain"
        && confidence.is_finite()
        && confidence >= CORE_CONFIDENCE_THRESHOLD
}

#[cfg(test)]
pub fn is_delayed_review(previous_success_at: Option<&str>, occurred_at: &str) -> bool {
    let Some(previous) = previous_success_at else {
        return false;
    };
    let Ok(previous) = DateTime::parse_from_rfc3339(previous) else {
        return false;
    };
    let Ok(current) = DateTime::parse_from_rfc3339(occurred_at) else {
        return false;
    };
    current.signed_duration_since(previous) >= Duration::hours(24)
}

pub fn next_action_for(
    error_class: &str,
    outcome: &str,
    confidence: f64,
    variant: bool,
    delayed: bool,
) -> &'static str {
    if !confidence_allows_core(confidence, outcome) {
        return "manual_check";
    }
    if normalize_outcome(outcome) == "correct" {
        if delayed {
            "move_on"
        } else if variant {
            "schedule_delayed_review"
        } else {
            "practice_variant"
        }
    } else {
        match error_class {
            "concept" => "review_concept",
            "tactics" => "timed_retry",
            "aiming" => "quick_retry",
            _ => "practice_similar",
        }
    }
}

pub fn record_attempt_evidence(
    conn: &Connection,
    input: AttemptEvidenceInput,
) -> rusqlite::Result<bool> {
    let now = Local::now().to_rfc3339();
    record_attempt_evidence_at(conn, input, &now)
}

pub fn record_attempt_evidence_at(
    conn: &Connection,
    input: AttemptEvidenceInput,
    created_at: &str,
) -> rusqlite::Result<bool> {
    record_evidence_at(conn, input, created_at, "attempt", None, None, None)
}

/// Appends the Codex ruling for one already-recorded attempt. The original user-reported
/// evidence stays immutable. Effective projections select this latest ruling instead of the
/// superseded attempt evidence, so correction is deterministic, replayable and never double-counted.
#[allow(dead_code)]
pub fn record_codex_adjudication(
    conn: &Connection,
    input: CodexAdjudicationInput,
) -> rusqlite::Result<bool> {
    record_codex_adjudication_with_projection(conn, input, true)
}

/// Appends only the immutable raw Codex evidence.  This is used by callers that
/// already hold a wider transaction containing the signal and diagnosis: projection
/// remains explicitly eventually-consistent (`projection_applied=0`) so a transient
/// projection fault cannot split those source-of-truth facts.
pub fn record_codex_adjudication_raw(
    conn: &Connection,
    input: CodexAdjudicationInput,
) -> rusqlite::Result<bool> {
    record_codex_adjudication_with_projection(conn, input, false)
}

fn record_codex_adjudication_with_projection(
    conn: &Connection,
    input: CodexAdjudicationInput,
    project_now: bool,
) -> rusqlite::Result<bool> {
    let Some(attempt_id) = input.diagnosis.attempt_id else {
        return Ok(false);
    };
    let class = normalize_error_class(
        &input.diagnosis.error_tags,
        input.diagnosis.verdict.as_deref(),
    );
    let fingerprint = diagnosis_fingerprint(&input.diagnosis, class);
    // v1.5.0 does not yet persist a variant-of relation or controlled review-task
    // completion id. `mode` is only a display label, never lifecycle evidence, so
    // it cannot make transfer/retention/stable progress. Keep both false until a
    // future structured task relation can be validated here.
    let variant = false;
    let delayed = false;
    let verdict = input
        .diagnosis
        .verdict
        .as_deref()
        .unwrap_or("uncertain")
        .to_string();
    let evidence = AttemptEvidenceInput {
        evidence_key: format!(
            "analysis:{}:{}:{}:{}",
            input.diagnosis.task_id, input.diagnosis.question_id, attempt_id, fingerprint
        ),
        task_id: Some(input.diagnosis.task_id.clone()),
        question_id: input.diagnosis.question_id,
        attempt_id,
        category_key: input.diagnosis.category_key.clone(),
        source: "codex_adjudication".into(),
        outcome: verdict,
        confidence: input.diagnosis.confidence,
        self_rating: input.self_rating,
        mode: input.mode,
        occurred_at: input.occurred_at,
        normalized_error_class: Some(class.into()),
        next_action: Some(
            next_action_for(
                class,
                input.diagnosis.verdict.as_deref().unwrap_or("uncertain"),
                input.diagnosis.confidence,
                variant,
                delayed,
            )
            .into(),
        ),
    };
    record_evidence_at_with_projection(
        conn,
        evidence,
        &input.diagnosis.created_at,
        "codex_adjudication",
        Some(attempt_id),
        Some(variant),
        Some(delayed),
        project_now,
    )
}

fn record_evidence_at(
    conn: &Connection,
    input: AttemptEvidenceInput,
    created_at: &str,
    evidence_kind: &str,
    supersedes_attempt_id: Option<i64>,
    _variant_override: Option<bool>,
    _delayed_override: Option<bool>,
) -> rusqlite::Result<bool> {
    record_evidence_at_with_projection(
        conn,
        input,
        created_at,
        evidence_kind,
        supersedes_attempt_id,
        _variant_override,
        _delayed_override,
        true,
    )
}

fn record_evidence_at_with_projection(
    conn: &Connection,
    input: AttemptEvidenceInput,
    created_at: &str,
    evidence_kind: &str,
    supersedes_attempt_id: Option<i64>,
    _variant_override: Option<bool>,
    _delayed_override: Option<bool>,
    project_now: bool,
) -> rusqlite::Result<bool> {
    let outcome = normalize_outcome(&input.outcome);
    // Preserve the source label for audit input, but do not infer lifecycle state
    // from it. Only a future structured relation may set transfer/retention flags.
    let _source_mode = input.mode.as_str();
    // There is no structured variant relationship/review-task id in this phase.
    // In particular, a string such as `mode=review` or `mode=variant` is not proof
    // of transfer or a >=24h controlled delayed review.
    let variant = false;
    let delayed = false;
    let confidence = if input.confidence.is_finite() {
        input.confidence.clamp(0.0, 1.0)
    } else {
        0.0
    };
    let class = input.normalized_error_class.as_deref().unwrap_or_else(|| {
        if outcome == "correct" {
            "none"
        } else {
            "uncertain"
        }
    });
    let next_action = input
        .next_action
        .as_deref()
        .unwrap_or_else(|| next_action_for(class, outcome, confidence, variant, delayed));
    let weight = adoption_weight(confidence, outcome);
    let correct = outcome == "correct";
    let mastery_signal = match outcome {
        "correct" => 1.0,
        "partial" => 0.35,
        _ => 0.0,
    };
    let fluency_signal = match outcome {
        "correct" => (input.self_rating.clamp(1, 4) as f64 / 4.0).clamp(0.0, 1.0),
        "partial" => (input.self_rating.clamp(1, 4) as f64 / 16.0).clamp(0.0, 0.25),
        _ => 0.0,
    };
    let transfer_signal = if variant && correct { 1.0 } else { 0.0 };
    let retention_signal = if delayed && correct { 1.0 } else { 0.0 };
    let inserted = conn.execute(
        "INSERT OR IGNORE INTO learning_evidence(
           evidence_key,task_id,question_id,attempt_id,category_key,source,evidence_kind,supersedes_attempt_id,
           outcome,confidence,adoption_weight,mastery_signal,fluency_signal,transfer_signal,retention_signal,
           is_variant,is_delayed_review,normalized_error_class,next_action,occurred_at,created_at,projection_applied
         ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,0)",
        params![
            &input.evidence_key,
            input.task_id.as_deref(),
            input.question_id,
            input.attempt_id,
            &input.category_key,
            &input.source,
            evidence_kind,
            supersedes_attempt_id,
            outcome,
            confidence,
            weight,
            mastery_signal,
            fluency_signal,
            transfer_signal,
            retention_signal,
            if variant { 1 } else { 0 },
            if delayed { 1 } else { 0 },
            class,
            next_action,
            &input.occurred_at,
            created_at,
        ],
    )?;
    if weight == 0.0 || !project_now {
        return Ok(inserted > 0);
    }

    // A duplicate key may be an earlier raw write whose projection failed. Re-attempting it
    // is safe: the marker update is conditional and the full category projection is rebuilt.
    let projection_applied: Option<i64> = conn
        .query_row(
            "SELECT projection_applied FROM learning_evidence WHERE evidence_key=?1",
            [&input.evidence_key],
            |row| row.get(0),
        )
        .optional()?;
    if projection_applied != Some(0) {
        return Ok(inserted > 0);
    }
    project_pending_evidence(conn, &input.evidence_key, &input.category_key)?;
    Ok(inserted > 0)
}

fn project_pending_evidence(
    conn: &Connection,
    evidence_key: &str,
    category_key: &str,
) -> rusqlite::Result<()> {
    // The raw evidence exists before this savepoint. If rebuilding fails, rollback leaves it
    // untouched with projection_applied=0; a later idempotent retry can safely consume it once.
    conn.execute_batch("SAVEPOINT learning_projection")?;
    let projection = (|| {
        let changed = conn.execute(
            "UPDATE learning_evidence SET projection_applied=1
             WHERE evidence_key=?1 AND projection_applied=0",
            [evidence_key],
        )?;
        if changed == 0 {
            return Ok(());
        }
        rebuild_skill_projection(conn, category_key)
    })();
    match projection {
        Ok(()) => conn.execute_batch("RELEASE learning_projection"),
        Err(error) => {
            let _ =
                conn.execute_batch("ROLLBACK TO learning_projection; RELEASE learning_projection");
            Err(error)
        }
    }
}

/// Retries only raw, core-eligible evidence. This is safe to call during startup:
/// each successful retry atomically flips its marker and rebuilds the category once.
/// A corrupted legacy row must not create queue-head blocking for later evidence.
pub fn retry_pending_projections(conn: &Connection) -> rusqlite::Result<usize> {
    let mut statement = conn.prepare(
        "SELECT evidence_key,category_key FROM learning_evidence
         WHERE projection_applied=0 AND adoption_weight>0
         ORDER BY id ASC",
    )?;
    let pending = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(statement);

    let mut projected = 0;
    for (evidence_key, category_key) in pending {
        match project_pending_evidence(conn, &evidence_key, &category_key) {
            Ok(()) => {
                projected += 1;
                let now = Local::now().to_rfc3339();
                conn.execute(
                    "UPDATE learning_projection_failures
                     SET resolved=1,resolved_at=?1,last_failed_at=?1
                     WHERE evidence_key=?2 AND resolved=0",
                    params![now, evidence_key],
                )?;
            }
            Err(error) => {
                let now = Local::now().to_rfc3339();
                conn.execute(
                    "INSERT INTO learning_projection_failures(
                       evidence_key,category_key,attempts,last_error,first_failed_at,last_failed_at,resolved,resolved_at
                     ) VALUES(?1,?2,1,?3,?4,?4,0,NULL)
                     ON CONFLICT(evidence_key) DO UPDATE SET
                       category_key=excluded.category_key,
                       attempts=learning_projection_failures.attempts+1,
                       last_error=excluded.last_error,
                       last_failed_at=excluded.last_failed_at,
                       resolved=0,resolved_at=NULL",
                    params![evidence_key, category_key, error.to_string(), now],
                )?;
            }
        }
    }
    Ok(projected)
}
#[derive(Debug)]
struct EffectiveEvidence {
    question_id: i64,
    outcome: String,
    confidence: f64,
    adoption_weight: f64,
    mastery_signal: f64,
    fluency_signal: f64,
    is_variant: bool,
    is_delayed_review: bool,
    occurred_at: String,
}

pub fn effective_evidence_sql() -> &'static str {
    "SELECT e.question_id,e.outcome,e.confidence,e.adoption_weight,e.mastery_signal,e.fluency_signal,
            e.is_variant,e.is_delayed_review,e.occurred_at
     FROM learning_evidence e
     WHERE e.category_key=?1 AND e.projection_applied=1 AND (
       (e.source='codex_adjudication' AND NOT EXISTS(
          SELECT 1 FROM learning_evidence newer
          WHERE newer.source='codex_adjudication'
            AND newer.supersedes_attempt_id=e.supersedes_attempt_id
            AND newer.projection_applied=1 AND newer.id>e.id
       ))
       OR
       (e.source<>'codex_adjudication' AND NOT EXISTS(
          SELECT 1 FROM learning_evidence ruling
          WHERE ruling.source='codex_adjudication'
            AND ruling.supersedes_attempt_id=e.attempt_id
            AND ruling.projection_applied=1
       ))
     )
     ORDER BY e.occurred_at ASC,e.id ASC"
}

/// Same authoritative effective-evidence predicate as the projection query, but
/// with dashboard DTO columns. Keeping this next to `effective_evidence_sql` makes
/// dashboard readers unable to accidentally count raw or superseded evidence.
pub fn effective_evidence_dashboard_sql() -> &'static str {
    "SELECT e.id,e.source,e.evidence_kind,e.task_id,e.question_id,e.attempt_id,e.outcome,e.confidence,
            e.mastery_signal,e.fluency_signal,e.occurred_at
     FROM learning_evidence e
     WHERE e.projection_applied=1 AND (
       (e.source='codex_adjudication' AND NOT EXISTS(
          SELECT 1 FROM learning_evidence newer
          WHERE newer.source='codex_adjudication'
            AND newer.supersedes_attempt_id=e.supersedes_attempt_id
            AND newer.projection_applied=1 AND newer.id>e.id
       ))
       OR
       (e.source<>'codex_adjudication' AND NOT EXISTS(
          SELECT 1 FROM learning_evidence ruling
          WHERE ruling.source='codex_adjudication'
            AND ruling.supersedes_attempt_id=e.attempt_id
            AND ruling.projection_applied=1
       ))
     )"
}

fn effective_evidence_for_category(
    conn: &Connection,
    category_key: &str,
) -> rusqlite::Result<Vec<EffectiveEvidence>> {
    let mut statement = conn.prepare(effective_evidence_sql())?;
    let rows = statement.query_map([category_key], |row| {
        Ok(EffectiveEvidence {
            question_id: row.get(0)?,
            outcome: row.get(1)?,
            confidence: row.get(2)?,
            adoption_weight: row.get(3)?,
            mastery_signal: row.get(4)?,
            fluency_signal: row.get(5)?,
            is_variant: row.get::<_, i64>(6)? != 0,
            is_delayed_review: row.get::<_, i64>(7)? != 0,
            occurred_at: row.get(8)?,
        })
    })?;
    rows.collect()
}

fn rebuild_skill_projection(conn: &Connection, category_key: &str) -> rusqlite::Result<()> {
    let evidence = effective_evidence_for_category(conn, category_key)?;
    if evidence.is_empty() {
        conn.execute(
            "DELETE FROM skill_states WHERE category_key=?1",
            [category_key],
        )?;
        return Ok(());
    }

    let mut mastery = 0.0;
    let mut fluency = 0.0;
    let mut transfer = 0.0;
    let mut retention = 0.0;
    let mut confidence = 0.0;
    let mut distinct_questions = std::collections::HashSet::new();
    let mut variant_success = 0_i64;
    let mut delayed_success = 0_i64;
    let mut recent_failures = 0_i64;
    let mut last_successful_review_at = None;
    let now = Utc::now();
    for item in &evidence {
        let alpha = 0.30 * item.adoption_weight;
        mastery = mastery * (1.0 - alpha) + item.mastery_signal * alpha;
        fluency = fluency * (1.0 - alpha) + item.fluency_signal * alpha;
        if item.is_variant {
            transfer = transfer * (1.0 - alpha)
                + if item.outcome == "correct" {
                    alpha
                } else {
                    0.0
                };
        }
        if item.is_delayed_review {
            retention = retention * (1.0 - alpha)
                + if item.outcome == "correct" {
                    alpha
                } else {
                    0.0
                };
            if item.outcome == "correct" {
                last_successful_review_at = Some(item.occurred_at.clone());
            }
        }
        confidence = confidence * (1.0 - alpha) + item.confidence * alpha;
        distinct_questions.insert(item.question_id);
        if item.is_variant && item.outcome == "correct" {
            variant_success += 1;
        }
        if item.is_delayed_review && item.outcome == "correct" {
            delayed_success += 1;
        }
        if item.outcome == "wrong"
            && DateTime::parse_from_rfc3339(&item.occurred_at)
                .map(|at| now.signed_duration_since(at.with_timezone(&Utc)) <= Duration::days(14))
                .unwrap_or(false)
        {
            recent_failures += 1;
        }
    }
    let last = evidence
        .last()
        .expect("non-empty evidence is checked above");
    let state = if recent_failures >= 2 && mastery < 0.70 {
        "remediating"
    } else if evidence.len() >= 3
        && distinct_questions.len() >= 2
        && variant_success >= 1
        && delayed_success >= 1
        && mastery >= 0.75
    {
        "stable"
    } else if mastery >= 0.60 {
        "unstable"
    } else {
        "learning"
    };
    let next_review = (Utc::now().date_naive()
        + Duration::days(if last.outcome != "correct" {
            1
        } else if last.is_delayed_review {
            7
        } else if last.is_variant {
            3
        } else {
            1
        }))
    .to_string();
    conn.execute(
        "INSERT INTO skill_states(category_key,state,mastery,fluency,transfer,retention,confidence,evidence_count,recent_failure_count,last_evidence_at,last_successful_review_at,next_review_at,updated_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
         ON CONFLICT(category_key) DO UPDATE SET
           state=excluded.state,mastery=excluded.mastery,fluency=excluded.fluency,transfer=excluded.transfer,
           retention=excluded.retention,confidence=excluded.confidence,evidence_count=excluded.evidence_count,
           recent_failure_count=excluded.recent_failure_count,last_evidence_at=excluded.last_evidence_at,
           last_successful_review_at=excluded.last_successful_review_at,next_review_at=excluded.next_review_at,
           updated_at=excluded.updated_at",
        params![
            category_key,
            state,
            mastery,
            fluency,
            transfer,
            retention,
            confidence,
            evidence.len() as i64,
            recent_failures,
            &last.occurred_at,
            last_successful_review_at,
            next_review,
            Local::now().to_rfc3339(),
        ],
    )?;
    Ok(())
}

fn diagnosis_fingerprint(input: &DiagnosisInput, class: &str) -> String {
    let verdict = input
        .verdict
        .as_deref()
        .map(normalize_outcome)
        .unwrap_or("uncertain");
    let next_action = next_action_for(
        class,
        verdict,
        input.confidence,
        input.is_variant,
        input.is_delayed_review,
    );
    let confidence_tier = if !confidence_allows_core(input.confidence, verdict) {
        "raw"
    } else if input.confidence < 0.90 {
        "reduced"
    } else {
        "full"
    };
    let tags = serde_json::to_string(&input.error_tags).unwrap_or_else(|_| "[]".into());
    let weak = serde_json::to_string(&input.weakness_tags).unwrap_or_else(|_| "[]".into());
    let earliest = input.earliest_error.as_deref().unwrap_or("");
    let canonical = format!(
        "{verdict}\u{1f}{class}\u{1f}{next_action}\u{1f}{confidence_tier}\u{1f}{}\u{1f}{}\u{1f}{earliest}\u{1f}{tags}\u{1f}{weak}",
        input.is_variant as u8,
        input.is_delayed_review as u8,
    );
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in canonical.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub fn upsert_diagnosis(
    conn: &Connection,
    input: DiagnosisInput,
) -> rusqlite::Result<DiagnosisUpsertResult> {
    let confidence = if input.confidence.is_finite() {
        input.confidence.clamp(0.0, 1.0)
    } else {
        0.0
    };
    let class = normalize_error_class(&input.error_tags, input.verdict.as_deref());
    let normalized_outcome = input
        .verdict
        .as_deref()
        .map(normalize_outcome)
        .unwrap_or("uncertain");
    let next_action = next_action_for(
        class,
        normalized_outcome,
        confidence,
        input.is_variant,
        input.is_delayed_review,
    );
    let now = if input.created_at.is_empty() {
        Local::now().to_rfc3339()
    } else {
        input.created_at.clone()
    };
    let fingerprint = diagnosis_fingerprint(&input, class);
    let existing: Option<(String, Option<i64>)> = conn
        .query_row(
            "SELECT semantic_fingerprint,attempt_id FROM learning_diagnoses WHERE task_id=?1 AND question_id=?2",
            params![&input.task_id, input.question_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let inserted = existing.is_none();
    let legacy_missing_fingerprint = existing
        .as_ref()
        .map(|(old, _)| old.is_empty())
        .unwrap_or(false);
    let semantic_changed = existing
        .as_ref()
        .map(|(old, _)| !old.is_empty() && old != &fingerprint)
        .unwrap_or(false);

    if inserted {
        conn.execute(
            "INSERT INTO learning_diagnoses(task_id,question_id,attempt_id,category_key,verdict,normalized_error_class,next_action,earliest_error,error_tags_json,weakness_tags_json,confidence,is_variant,is_delayed_review,semantic_fingerprint,created_at,updated_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)",
            params![&input.task_id,input.question_id,input.attempt_id,&input.category_key,&input.verdict,class,next_action,&input.earliest_error,serde_json::to_string(&input.error_tags).unwrap_or_else(|_| "[]".into()),serde_json::to_string(&input.weakness_tags).unwrap_or_else(|_| "[]".into()),confidence,if input.is_variant {1}else{0},if input.is_delayed_review {1}else{0},&fingerprint,&now],
        )?;
    } else if semantic_changed {
        conn.execute(
            "UPDATE learning_diagnoses SET attempt_id=COALESCE(?1,attempt_id),category_key=?2,verdict=?3,normalized_error_class=?4,next_action=?5,earliest_error=?6,error_tags_json=?7,weakness_tags_json=?8,confidence=?9,is_variant=?10,is_delayed_review=?11,semantic_fingerprint=?12,updated_at=?13 WHERE task_id=?14 AND question_id=?15",
            params![input.attempt_id,&input.category_key,&input.verdict,class,next_action,&input.earliest_error,serde_json::to_string(&input.error_tags).unwrap_or_else(|_| "[]".into()),serde_json::to_string(&input.weakness_tags).unwrap_or_else(|_| "[]".into()),confidence,if input.is_variant {1}else{0},if input.is_delayed_review {1}else{0},&fingerprint,&now,&input.task_id,input.question_id],
        )?;
    } else if legacy_missing_fingerprint {
        // Older rows have no semantic baseline. Backfill only that baseline and an
        // optional immutable attempt binding; preserve all diagnostic content and
        // never reopen completed/closed/archived review work merely for migration.
        conn.execute(
            "UPDATE learning_diagnoses SET attempt_id=COALESCE(?1,attempt_id),semantic_fingerprint=?2,updated_at=?3 WHERE task_id=?4 AND question_id=?5",
            params![input.attempt_id, &fingerprint, &now, &input.task_id, input.question_id],
        )?;
    } else if existing.and_then(|(_, attempt_id)| attempt_id).is_none()
        && input.attempt_id.is_some()
    {
        conn.execute(
            "UPDATE learning_diagnoses SET attempt_id=?1,updated_at=?2 WHERE task_id=?3 AND question_id=?4",
            params![input.attempt_id, &now, &input.task_id, input.question_id],
        )?;
    }

    if confidence_allows_core(confidence, normalized_outcome) {
        let stage = match next_action {
            "review_concept" => "concept_repair",
            "quick_retry" => "original_retry",
            "timed_retry" => "similar_retry",
            _ => "diagnosed",
        };
        let existing_task: Option<String> = conn
            .query_row(
                "SELECT status FROM review_tasks WHERE task_id=?1 AND question_id=?2",
                params![&input.task_id, input.question_id],
                |row| row.get(0),
            )
            .optional()?;
        if existing_task.is_none() {
            conn.execute(
                "INSERT INTO review_tasks(task_id,question_id,category_key,stage,status,next_action,is_variant,delayed_review_required,last_outcome,last_attempt_id,next_review_at,created_at,updated_at)
                 VALUES(?1,?2,?3,?4,'pending',?5,?6,?7,?8,?9,NULL,?10,?10)",
                params![&input.task_id,input.question_id,&input.category_key,stage,next_action,if input.is_variant {1}else{0},if input.is_delayed_review {1}else{0},&input.verdict,input.attempt_id,&now],
            )?;
        } else if semantic_changed {
            // Only a genuine diagnostic change re-opens a completed/closed/archived task.
            conn.execute(
                "UPDATE review_tasks SET category_key=?1,stage=?2,status='pending',next_action=?3,is_variant=?4,delayed_review_required=?5,last_outcome=?6,last_attempt_id=COALESCE(?7,last_attempt_id),next_review_at=NULL,updated_at=?8 WHERE task_id=?9 AND question_id=?10",
                params![&input.category_key,stage,next_action,if input.is_variant {1}else{0},if input.is_delayed_review {1}else{0},&input.verdict,input.attempt_id,&now,&input.task_id,input.question_id],
            )?;
        } else if input.attempt_id.is_some() {
            // Binding an older diagnosis to a newly located attempt is metadata-only, never a reopen.
            conn.execute(
                "UPDATE review_tasks SET last_attempt_id=COALESCE(last_attempt_id,?1),updated_at=updated_at WHERE task_id=?2 AND question_id=?3",
                params![input.attempt_id,&input.task_id,input.question_id],
            )?;
        }
    }
    Ok(DiagnosisUpsertResult {
        inserted,
        semantic_changed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn
    }

    fn attempt(
        key: &str,
        question_id: i64,
        mode: &str,
        outcome: &str,
        at: &str,
        confidence: f64,
    ) -> AttemptEvidenceInput {
        AttemptEvidenceInput {
            evidence_key: key.into(),
            task_id: None,
            question_id,
            attempt_id: question_id,
            category_key: "高等数学/定积分".into(),
            source: "test".into(),
            outcome: outcome.into(),
            confidence,
            self_rating: 4,
            mode: mode.into(),
            occurred_at: at.into(),
            normalized_error_class: None,
            next_action: None,
        }
    }

    #[test]
    fn original_retry_does_not_increase_transfer() {
        let conn = conn();
        record_attempt_evidence_at(
            &conn,
            attempt(
                "a1",
                1,
                "review",
                "correct",
                "2026-08-20T10:00:00+08:00",
                1.0,
            ),
            "2026-08-20T10:00:00+08:00",
        )
        .unwrap();
        record_attempt_evidence_at(
            &conn,
            attempt(
                "a2",
                1,
                "review",
                "correct",
                "2026-08-21T10:00:00+08:00",
                1.0,
            ),
            "2026-08-21T10:00:00+08:00",
        )
        .unwrap();
        let transfer: f64 = conn
            .query_row(
                "SELECT transfer FROM skill_states WHERE category_key='高等数学/定积分'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(transfer, 0.0);
    }

    #[test]
    fn mode_variant_does_not_add_transfer_without_structured_link() {
        let conn = conn();
        record_attempt_evidence_at(
            &conn,
            attempt(
                "v1",
                2,
                "variant",
                "correct",
                "2026-08-20T10:00:00+08:00",
                1.0,
            ),
            "2026-08-20T10:00:00+08:00",
        )
        .unwrap();
        let transfer: f64 = conn
            .query_row(
                "SELECT transfer FROM skill_states WHERE category_key='高等数学/定积分'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(transfer, 0.0);
        let (is_variant, is_delayed): (i64, i64) = conn
            .query_row(
                "SELECT is_variant,is_delayed_review FROM learning_evidence WHERE evidence_key='v1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!((is_variant, is_delayed), (0, 0));
    }

    #[test]
    fn delayed_review_is_detected_after_one_day() {
        assert!(is_delayed_review(
            Some("2026-08-20T10:00:00+08:00"),
            "2026-08-21T10:00:00+08:00"
        ));
        assert!(!is_delayed_review(
            Some("2026-08-20T10:00:00+08:00"),
            "2026-08-20T18:00:00+08:00"
        ));
    }

    #[test]
    fn low_confidence_and_uncertain_do_not_project() {
        let conn = conn();
        record_attempt_evidence_at(
            &conn,
            attempt(
                "l1",
                1,
                "practice",
                "correct",
                "2026-08-20T10:00:00+08:00",
                0.60,
            ),
            "2026-08-20T10:00:00+08:00",
        )
        .unwrap();
        record_attempt_evidence_at(
            &conn,
            attempt(
                "u1",
                2,
                "practice",
                "uncertain",
                "2026-08-20T11:00:00+08:00",
                1.0,
            ),
            "2026-08-20T11:00:00+08:00",
        )
        .unwrap();
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM skill_states", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM learning_evidence WHERE projection_applied=0",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            2
        );
    }

    #[test]
    fn wrong_answer_with_high_self_rating_does_not_increase_fluency() {
        let conn = conn();
        record_attempt_evidence_at(
            &conn,
            attempt(
                "wrong-fluent",
                1,
                "practice",
                "wrong",
                "2026-08-20T10:00:00+08:00",
                1.0,
            ),
            "2026-08-20T10:00:00+08:00",
        )
        .unwrap();
        let (raw_signal, fluency): (f64, f64) = conn
            .query_row(
                "SELECT e.fluency_signal,s.fluency FROM learning_evidence e JOIN skill_states s ON s.category_key=e.category_key WHERE e.evidence_key='wrong-fluent'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(raw_signal, 0.0);
        assert_eq!(fluency, 0.0);
    }

    #[test]
    fn medium_confidence_uses_reduced_adoption_weight() {
        let conn = conn();
        let medium = attempt(
            "medium",
            1,
            "practice",
            "correct",
            "2026-08-20T10:00:00+08:00",
            0.80,
        );
        record_attempt_evidence_at(&conn, medium, "2026-08-20T10:00:00+08:00").unwrap();
        let mut high = attempt(
            "high",
            2,
            "practice",
            "correct",
            "2026-08-20T10:00:00+08:00",
            0.95,
        );
        high.category_key = "线性代数/矩阵".into();
        record_attempt_evidence_at(&conn, high, "2026-08-20T10:00:00+08:00").unwrap();
        let medium_mastery: f64 = conn
            .query_row(
                "SELECT mastery FROM skill_states WHERE category_key='高等数学/定积分'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let high_mastery: f64 = conn
            .query_row(
                "SELECT mastery FROM skill_states WHERE category_key='线性代数/矩阵'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let weight: f64 = conn
            .query_row(
                "SELECT adoption_weight FROM learning_evidence WHERE evidence_key='medium'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!((weight - 0.50).abs() < f64::EPSILON);
        assert!((medium_mastery - 0.15).abs() < 1e-9);
        assert!((high_mastery - 0.30).abs() < 1e-9);
    }

    #[test]
    fn failed_projection_keeps_raw_evidence_unapplied() {
        let conn = conn();
        conn.execute_batch("DROP TABLE skill_states").unwrap();
        assert!(record_attempt_evidence_at(
            &conn,
            attempt(
                "projection-failure",
                1,
                "practice",
                "correct",
                "2026-08-20T10:00:00+08:00",
                1.0,
            ),
            "2026-08-20T10:00:00+08:00",
        )
        .is_err());
        let marker: i64 = conn
            .query_row(
                "SELECT projection_applied FROM learning_evidence WHERE evidence_key='projection-failure'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(marker, 0);
        init_schema(&conn).unwrap();
        assert!(!record_attempt_evidence_at(
            &conn,
            attempt(
                "projection-failure",
                1,
                "practice",
                "correct",
                "2026-08-20T10:00:00+08:00",
                1.0,
            ),
            "2026-08-20T10:00:00+08:00",
        )
        .unwrap());
        let (marker, count, evidence_count): (i64, i64, i64) = conn
            .query_row(
                "SELECT
                    (SELECT projection_applied FROM learning_evidence WHERE evidence_key='projection-failure'),
                    (SELECT COUNT(*) FROM learning_evidence WHERE evidence_key='projection-failure'),
                    (SELECT evidence_count FROM skill_states WHERE category_key='高等数学/定积分')",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!((marker, count, evidence_count), (1, 1, 1));
    }

    #[test]
    fn duplicate_evidence_is_ignored() {
        let conn = conn();
        assert!(record_attempt_evidence_at(
            &conn,
            attempt(
                "same",
                1,
                "practice",
                "correct",
                "2026-08-20T10:00:00+08:00",
                1.0
            ),
            "2026-08-20T10:00:00+08:00"
        )
        .unwrap());
        assert!(!record_attempt_evidence_at(
            &conn,
            attempt(
                "same",
                1,
                "practice",
                "correct",
                "2026-08-20T10:00:00+08:00",
                1.0
            ),
            "2026-08-20T10:00:00+08:00"
        )
        .unwrap());
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM learning_evidence", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            conn.query_row("SELECT evidence_count FROM skill_states", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
    }

    fn diagnosis(
        task_id: &str,
        question_id: i64,
        attempt_id: Option<i64>,
        verdict: &str,
    ) -> DiagnosisInput {
        DiagnosisInput {
            task_id: task_id.into(),
            question_id,
            attempt_id,
            category_key: "高等数学/定积分".into(),
            verdict: Some(verdict.into()),
            error_tags: vec!["概念盲区".into()],
            weakness_tags: vec!["定积分".into()],
            earliest_error: Some("第 2 行".into()),
            confidence: 0.95,
            is_variant: false,
            is_delayed_review: false,
            created_at: "2026-08-20T10:00:00+08:00".into(),
        }
    }

    #[test]
    fn confidence_threshold_boundaries_are_exact() {
        let conn = conn();
        let cases = [
            ("below-75", 0.749_999, "correct", 0_i64),
            ("at-75", 0.75, "correct", 1_i64),
            ("below-90", 0.899_999, "correct", 1_i64),
            ("at-90", 0.90, "correct", 1_i64),
            ("uncertain", 1.0, "uncertain", 0_i64),
        ];
        for (offset, (key, confidence, outcome, applied)) in cases.into_iter().enumerate() {
            record_attempt_evidence_at(
                &conn,
                attempt(
                    key,
                    100 + offset as i64,
                    "practice",
                    outcome,
                    "2026-08-20T10:00:00+08:00",
                    confidence,
                ),
                "2026-08-20T10:00:00+08:00",
            )
            .unwrap();
            let (weight, projection_applied): (f64, i64) = conn
                .query_row(
                    "SELECT adoption_weight,projection_applied FROM learning_evidence WHERE evidence_key=?1",
                    [key],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();
            assert_eq!(projection_applied, applied, "{key}");
            let expected = match key {
                "at-75" | "below-90" => 0.50,
                "at-90" => 1.0,
                _ => 0.0,
            };
            assert!((weight - expected).abs() < f64::EPSILON, "{key}: {weight}");
        }
    }

    #[test]
    fn high_confidence_codex_ruling_rebuilds_without_double_counting() {
        let conn = conn();
        let original = attempt(
            "attempt:42",
            42,
            "practice",
            "correct",
            "2026-08-20T10:00:00+08:00",
            1.0,
        );
        record_attempt_evidence_at(&conn, original, "2026-08-20T10:00:00+08:00").unwrap();
        let initial_mastery: f64 = conn
            .query_row(
                "SELECT mastery FROM skill_states WHERE category_key='高等数学/定积分'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(initial_mastery > 0.0);

        let diagnosis = diagnosis("SB-42", 42, Some(42), "incorrect");
        upsert_diagnosis(&conn, diagnosis.clone()).unwrap();
        record_codex_adjudication(
            &conn,
            CodexAdjudicationInput {
                diagnosis,
                self_rating: 4,
                mode: "practice".into(),
                occurred_at: "2026-08-20T10:00:00+08:00".into(),
            },
        )
        .unwrap();

        let (mastery, fluency, evidence_count): (f64, f64, i64) = conn
            .query_row(
                "SELECT mastery,fluency,evidence_count FROM skill_states WHERE category_key='高等数学/定积分'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(mastery, 0.0);
        assert_eq!(fluency, 0.0);
        assert_eq!(evidence_count, 1);
        let (raw_count, ruling_count, superseded): (i64, i64, i64) = conn
            .query_row(
                "SELECT
                    SUM(CASE WHEN evidence_kind='attempt' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN evidence_kind='codex_adjudication' THEN 1 ELSE 0 END),
                    MAX(CASE WHEN evidence_kind='codex_adjudication' THEN supersedes_attempt_id END)
                 FROM learning_evidence WHERE attempt_id=42",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!((raw_count, ruling_count, superseded), (1, 1, 42));
    }

    #[test]
    fn completed_review_task_is_not_reopened_by_same_payload() {
        let conn = conn();
        let input = diagnosis("SB-complete", 99, Some(712), "incorrect");
        assert!(upsert_diagnosis(&conn, input.clone()).unwrap().inserted);
        conn.execute(
            "UPDATE review_tasks SET status='completed' WHERE task_id=?1 AND question_id=?2",
            params!["SB-complete", 99],
        )
        .unwrap();
        let result = upsert_diagnosis(&conn, input).unwrap();
        assert!(!result.inserted);
        assert!(!result.semantic_changed);
        let (status, last_attempt_id): (String, Option<i64>) = conn
            .query_row(
                "SELECT status,last_attempt_id FROM review_tasks WHERE task_id=?1 AND question_id=?2",
                params!["SB-complete", 99],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(status, "completed");
        assert_eq!(last_attempt_id, Some(712));
    }

    #[test]
    fn legacy_empty_fingerprint_only_backfills_without_reopening_lifecycle_state() {
        for status in ["completed", "closed", "archived"] {
            let conn = conn();
            let task_id = format!("SB-legacy-{status}");
            let original = diagnosis(&task_id, 321, None, "incorrect");
            assert!(upsert_diagnosis(&conn, original).unwrap().inserted);
            conn.execute(
                "UPDATE learning_diagnoses SET semantic_fingerprint='' WHERE task_id=?1 AND question_id=321",
                [&task_id],
            )
            .unwrap();
            conn.execute(
                "UPDATE review_tasks SET status=?1 WHERE task_id=?2 AND question_id=321",
                params![status, &task_id],
            )
            .unwrap();

            let migrated = diagnosis(&task_id, 321, Some(881), "incorrect");
            let result = upsert_diagnosis(&conn, migrated).unwrap();
            assert!(!result.inserted);
            assert!(!result.semantic_changed);

            let (fingerprint, attempt_id): (String, Option<i64>) = conn
                .query_row(
                    "SELECT semantic_fingerprint,attempt_id FROM learning_diagnoses WHERE task_id=?1 AND question_id=321",
                    [&task_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();
            let (actual_status, last_attempt_id): (String, Option<i64>) = conn
                .query_row(
                    "SELECT status,last_attempt_id FROM review_tasks WHERE task_id=?1 AND question_id=321",
                    [&task_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();
            assert!(!fingerprint.is_empty());
            assert_eq!(attempt_id, Some(881));
            assert_eq!(actual_status, status);
            assert_eq!(last_attempt_id, Some(881));
        }
    }

    #[test]
    fn diagnosis_and_review_task_keep_bound_attempt_id() {
        let conn = conn();
        upsert_diagnosis(&conn, diagnosis("SB-bind", 123, Some(456), "incorrect")).unwrap();
        let diagnosis_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT attempt_id FROM learning_diagnoses WHERE task_id='SB-bind' AND question_id=123",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let task_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT last_attempt_id FROM review_tasks WHERE task_id='SB-bind' AND question_id=123",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(diagnosis_attempt_id, Some(456));
        assert_eq!(task_attempt_id, Some(456));
    }

    #[test]
    fn diagnosis_is_unique_by_task_and_question() {
        let conn = conn();
        let input = DiagnosisInput {
            task_id: "task".into(),
            question_id: 1,
            attempt_id: None,
            category_key: "高等数学".into(),
            verdict: Some("incorrect".into()),
            error_tags: vec!["概念盲区".into()],
            weakness_tags: vec![],
            earliest_error: None,
            confidence: 0.95,
            is_variant: false,
            is_delayed_review: false,
            created_at: "2026-08-20T10:00:00+08:00".into(),
        };
        assert!(upsert_diagnosis(&conn, input.clone()).unwrap().inserted);
        assert!(!upsert_diagnosis(&conn, input).unwrap().inserted);
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM learning_diagnoses", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM review_tasks", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
    }


    #[test]
    fn retry_pending_projection_audits_one_failure_and_projects_later_evidence() {
        let conn = conn();
        conn.execute_batch(
            "CREATE TRIGGER fail_bad_projection BEFORE INSERT ON skill_states
             WHEN NEW.category_key='坏分类'
             BEGIN SELECT RAISE(ABORT,'forced bad projection'); END;",
        )
        .unwrap();
        let mut bad = attempt("bad-pending", 1, "practice", "correct", "2026-08-20T10:00:00+08:00", 1.0);
        bad.category_key = "坏分类".into();
        assert!(record_attempt_evidence_at(&conn, bad, "2026-08-20T10:00:00+08:00").is_err());
        let mut good = attempt("good-pending", 2, "practice", "correct", "2026-08-20T11:00:00+08:00", 1.0);
        good.category_key = "好分类".into();
        record_attempt_evidence_at(&conn, good, "2026-08-20T11:00:00+08:00").unwrap();
        conn.execute("UPDATE learning_evidence SET projection_applied=0 WHERE evidence_key='good-pending'", []).unwrap();

        assert_eq!(retry_pending_projections(&conn).unwrap(), 1);
        let markers: (i64, i64) = conn.query_row(
            "SELECT (SELECT projection_applied FROM learning_evidence WHERE evidence_key='bad-pending'),
                    (SELECT projection_applied FROM learning_evidence WHERE evidence_key='good-pending')",
            [], |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();
        assert_eq!(markers, (0, 1));
        let audit: (i64, i64, String) = conn.query_row(
            "SELECT attempts,resolved,last_error FROM learning_projection_failures WHERE evidence_key='bad-pending'",
            [], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap();
        assert_eq!(audit.0, 1);
        assert_eq!(audit.1, 0);
        assert!(audit.2.contains("forced bad projection"));
    }

    #[test]
    fn init_schema_adds_all_runtime_columns_to_early_v150_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE learning_evidence (id INTEGER PRIMARY KEY AUTOINCREMENT,evidence_key TEXT NOT NULL UNIQUE,task_id TEXT,question_id INTEGER NOT NULL,attempt_id INTEGER,category_key TEXT NOT NULL,source TEXT NOT NULL,outcome TEXT NOT NULL,confidence REAL NOT NULL DEFAULT 1.0,occurred_at TEXT NOT NULL,created_at TEXT NOT NULL);
             CREATE TABLE learning_diagnoses (id INTEGER PRIMARY KEY AUTOINCREMENT,task_id TEXT NOT NULL,question_id INTEGER NOT NULL,category_key TEXT NOT NULL,verdict TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(task_id, question_id));
             CREATE TABLE review_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT,task_id TEXT NOT NULL,question_id INTEGER NOT NULL,category_key TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(task_id, question_id));
             CREATE TABLE skill_states (category_key TEXT PRIMARY KEY);",
        ).unwrap();
        init_schema(&conn).unwrap();
        for (table, required) in [
            ("learning_evidence", ["evidence_kind", "supersedes_attempt_id", "adoption_weight", "mastery_signal", "fluency_signal", "transfer_signal", "retention_signal", "is_variant", "is_delayed_review", "normalized_error_class", "next_action", "projection_applied"].as_slice()),
            ("learning_diagnoses", ["attempt_id", "normalized_error_class", "next_action", "earliest_error", "error_tags_json", "weakness_tags_json", "confidence", "is_variant", "is_delayed_review", "semantic_fingerprint"].as_slice()),
            ("review_tasks", ["stage", "status", "next_action", "is_variant", "delayed_review_required", "last_outcome", "last_attempt_id", "next_review_at"].as_slice()),
            ("skill_states", ["state", "mastery", "fluency", "transfer", "retention", "confidence", "evidence_count", "recent_failure_count", "last_evidence_at", "last_successful_review_at", "next_review_at", "updated_at"].as_slice()),
        ] {
            let mut statement = conn.prepare(&format!("PRAGMA table_info({table})")).unwrap();
            let columns = statement.query_map([], |row| row.get::<_, String>(1)).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
            for column in required { assert!(columns.iter().any(|actual| actual == column), "{table}.{column} must be migrated"); }
        }
        assert!(record_attempt_evidence_at(&conn, attempt("early-schema-runtime", 1, "practice", "correct", "2026-08-20T10:00:00+08:00", 1.0), "2026-08-20T10:00:00+08:00").unwrap());
        assert!(upsert_diagnosis(&conn, diagnosis("early-schema-diagnosis", 1, Some(1), "incorrect")).unwrap().inserted);
    }

}
