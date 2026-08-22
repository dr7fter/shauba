use crate::db::{
    save_session_state, load_session_state, delete_session_state,
    PracticeSessionQueueItem, PracticeSessionState,
};
use rusqlite::Connection;
use std::collections::HashSet;

/// Save practice session to database
pub fn save_session(
    conn: &Connection,
    queue: &[PracticeSessionQueueItem],
    current_index: usize,
    attempt_mode: &str,
) -> Result<(), String> {
    save_session_state(conn, queue, current_index, attempt_mode)
}

/// Load practice session from database
pub fn load_session(conn: &Connection) -> Result<Option<PracticeSessionState>, String> {
    load_session_state(conn)
}

/// Clear practice session from database
pub fn clear_session(conn: &Connection) -> Result<(), String> {
    delete_session_state(conn)
}

/// Validate session queue (no duplicates, not empty)
pub fn validate_session_queue(queue: &[PracticeSessionQueueItem]) -> bool {
    if queue.is_empty() {
        return false;
    }

    let mut seen = HashSet::new();
    for item in queue {
        if !seen.insert(item.question_id) {
            return false; // Duplicate found
        }
    }

    true
}

/// Calculate session progress percentage
pub fn calculate_session_progress(current_index: usize, total_questions: usize) -> f64 {
    if total_questions == 0 {
        return 0.0;
    }
    ((current_index as f64) / (total_questions as f64) * 100.0).min(100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_session_queue() {
        let valid = vec![
            PracticeSessionQueueItem { question_id: 1 },
            PracticeSessionQueueItem { question_id: 2 },
            PracticeSessionQueueItem { question_id: 3 },
        ];
        assert!(validate_session_queue(&valid));

        let empty: Vec<PracticeSessionQueueItem> = vec![];
        assert!(!validate_session_queue(&empty));

        let duplicate = vec![
            PracticeSessionQueueItem { question_id: 1 },
            PracticeSessionQueueItem { question_id: 1 },
        ];
        assert!(!validate_session_queue(&duplicate));
    }

    #[test]
    fn test_calculate_session_progress() {
        assert_eq!(calculate_session_progress(0, 10), 0.0);
        assert_eq!(calculate_session_progress(5, 10), 50.0);
        assert_eq!(calculate_session_progress(10, 10), 100.0);
        assert_eq!(calculate_session_progress(0, 0), 0.0);
    }
}
