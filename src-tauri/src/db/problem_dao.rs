use rusqlite::Connection;
use super::Question;

/// Query a single question by ID
pub fn query_question(conn: &Connection, question_id: i64) -> Result<Option<Question>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, content, answer, explanation, difficulty, tags, source,
                    COALESCE(favorite, 0) as favorite, note
             FROM questions
             WHERE id = ?1"
        )
        .map_err(|e| e.to_string())?;

    let result = stmt.query_row([question_id], |row| {
        Ok(Question {
            id: row.get(0)?,
            content: row.get(1)?,
            answer: row.get(2)?,
            explanation: row.get(3)?,
            difficulty: row.get(4)?,
            tags: row.get(5)?,
            source: row.get(6)?,
            favorite: row.get::<_, i64>(7)? != 0,
            note: row.get(8)?,
        })
    });

    match result {
        Ok(question) => Ok(Some(question)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Count total questions
pub fn query_question_count(conn: &Connection) -> Result<i64, String> {
    let mut stmt = conn
        .prepare("SELECT COUNT(*) FROM questions")
        .map_err(|e| e.to_string())?;

    stmt.query_row([], |row| row.get(0))
        .map_err(|e| e.to_string())
}

/// Count favorite questions
pub fn query_favorite_count(conn: &Connection) -> Result<i64, String> {
    let mut stmt = conn
        .prepare("SELECT COUNT(*) FROM questions WHERE favorite = 1")
        .map_err(|e| e.to_string())?;

    stmt.query_row([], |row| row.get(0))
        .map_err(|e| e.to_string())
}

/// Update favorite status
pub fn update_favorite_status(
    conn: &Connection,
    question_id: i64,
    favorite: bool,
) -> Result<(), String> {
    conn.execute(
        "UPDATE questions SET favorite = ?1 WHERE id = ?2",
        rusqlite::params![favorite as i64, question_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Update question note
pub fn update_note(conn: &Connection, question_id: i64, note: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE questions SET note = ?1 WHERE id = ?2",
        rusqlite::params![note, question_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
