use rusqlite::Connection;
use super::{PracticeSessionQueueItem, PracticeSessionState};

/// Save practice session state to database
pub fn save_session_state(
    conn: &Connection,
    queue: &[PracticeSessionQueueItem],
    current_index: usize,
    attempt_mode: &str,
) -> Result<(), String> {
    let queue_json = serde_json::to_string(queue).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO practice_session (id, queue, current_index, attempt_mode, saved_at)
         VALUES (1, ?1, ?2, ?3, datetime('now'))",
        rusqlite::params![queue_json, current_index as i64, attempt_mode],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Load practice session state from database
pub fn load_session_state(conn: &Connection) -> Result<Option<PracticeSessionState>, String> {
    let mut stmt = conn
        .prepare("SELECT queue, current_index, attempt_mode FROM practice_session WHERE id = 1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([], |row| {
            let queue_json: String = row.get(0)?;
            let current_index: i64 = row.get(1)?;
            let attempt_mode: String = row.get(2)?;

            let queue: Vec<PracticeSessionQueueItem> =
                serde_json::from_str(&queue_json).map_err(|e| {
                    rusqlite::Error::ToSqlConversionFailure(Box::new(e))
                })?;

            Ok(PracticeSessionState {
                queue,
                current_index: current_index as usize,
                attempt_mode,
            })
        });

    match result {
        Ok(state) => Ok(Some(state)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete practice session state from database
pub fn delete_session_state(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM practice_session WHERE id = 1", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}
