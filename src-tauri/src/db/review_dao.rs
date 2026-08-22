use rusqlite::Connection;
use super::AttemptInput;
use chrono::Local;

/// Insert an attempt record
pub fn insert_attempt(conn: &Connection, input: &AttemptInput) -> Result<(), String> {
    conn.execute(
        "INSERT INTO attempts (
            question_id, duration_seconds, result, self_rating,
            selected_answer, mode, outcome, evidence_source,
            fluency_rating, confidence, session_id, diagnosis_id, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            input.question_id,
            input.duration_seconds,
            input.result,
            input.self_rating,
            input.selected_answer,
            input.mode,
            input.outcome,
            input.evidence_source,
            input.fluency_rating,
            input.confidence,
            input.session_id,
            input.diagnosis_id,
            Local::now().to_rfc3339(),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Query today's statistics (question count, total minutes)
pub fn query_today_stats(conn: &Connection) -> Result<(i64, i64), String> {
    let mut stmt = conn
        .prepare(
            "SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
             FROM attempts
             WHERE DATE(created_at) = DATE('now')"
        )
        .map_err(|e| e.to_string())?;

    stmt.query_row([], |row| {
        let count: i64 = row.get(0)?;
        let total_seconds: i64 = row.get(1)?;
        Ok((count, total_seconds / 60))
    })
    .map_err(|e| e.to_string())
}

/// Query attempts for a specific question
pub fn query_attempts_by_question(
    conn: &Connection,
    question_id: i64,
    limit: i64,
) -> Result<Vec<AttemptInput>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT question_id, duration_seconds, result, self_rating,
                    selected_answer, mode, outcome, evidence_source,
                    fluency_rating, confidence, session_id, diagnosis_id
             FROM attempts
             WHERE question_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2"
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![question_id, limit], |row| {
            Ok(AttemptInput {
                question_id: row.get(0)?,
                duration_seconds: row.get(1)?,
                result: row.get(2)?,
                self_rating: row.get(3)?,
                selected_answer: row.get(4)?,
                mode: row.get(5)?,
                outcome: row.get(6)?,
                evidence_source: row.get(7)?,
                fluency_rating: row.get(8)?,
                confidence: row.get(9)?,
                session_id: row.get(10)?,
                diagnosis_id: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
