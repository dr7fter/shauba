use rusqlite::{params, Connection, Result};

/// Get count of questions due for review
pub fn get_due_review_count(conn: &Connection, now: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM srs_progress WHERE next_review <= ?1",
        [now],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Update SRS progress after review
pub fn update_srs_progress(
    conn: &Connection,
    question_id: i64,
    mastery: i32,
    next_review: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO srs_progress(question_id, mastery, next_review, last_reviewed)
         VALUES(?1, ?2, ?3, datetime('now'))
         ON CONFLICT(question_id) DO UPDATE SET mastery=excluded.mastery, next_review=excluded.next_review, last_reviewed=excluded.last_reviewed",
        params![question_id, mastery, next_review],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get SRS progress for a question
pub fn get_srs_progress(conn: &Connection, question_id: i64) -> Result<Option<(i32, String)>, String> {
    conn.query_row(
        "SELECT mastery, next_review FROM srs_progress WHERE question_id=?1",
        [question_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .optional()
    .map_err(|e| e.to_string())
}

/// Get review intervals configuration
pub fn get_review_intervals(conn: &Connection) -> Result<Vec<i64>, String> {
    let intervals_str: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key='review_intervals'",
            [],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "1,3,7,15,30,60".to_string());

    let intervals: Vec<i64> = intervals_str
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    Ok(intervals)
}

/// Update review intervals configuration
pub fn update_review_intervals(conn: &Connection, intervals: &[i64]) -> Result<(), String> {
    let intervals_str = intervals
        .iter()
        .map(|i| i.to_string())
        .collect::<Vec<_>>()
        .join(",");

    conn.execute(
        "INSERT INTO settings(key, value) VALUES('review_intervals', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [intervals_str],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
