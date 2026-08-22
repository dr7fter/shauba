use crate::db::{
    query_question, query_question_count, query_favorite_count,
    update_favorite_status, update_note,
    Question,
};
use rusqlite::Connection;

/// Get question by ID
pub fn get_question(conn: &Connection, question_id: i64) -> Result<Option<Question>, String> {
    query_question(conn, question_id)
}

/// Get total question count
pub fn get_total_question_count(conn: &Connection) -> Result<i64, String> {
    query_question_count(conn)
}

/// Get favorite count
pub fn get_favorite_count(conn: &Connection) -> Result<i64, String> {
    query_favorite_count(conn)
}

/// Toggle question favorite status
pub fn toggle_favorite(conn: &Connection, question_id: i64, favorite: bool) -> Result<(), String> {
    update_favorite_status(conn, question_id, favorite)
}

/// Save question note
pub fn save_note(conn: &Connection, question_id: i64, note: &str) -> Result<(), String> {
    if note.len() > 10000 {
        return Err("Note too long (max 10000 characters)".to_string());
    }
    update_note(conn, question_id, note)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_note_validation() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();

        // Test note length limit
        let long_note = "a".repeat(10001);
        let result = save_note(&conn, 1, &long_note);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too long"));
    }
}
