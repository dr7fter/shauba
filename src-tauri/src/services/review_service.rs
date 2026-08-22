use crate::db::{insert_attempt, query_today_stats, AttemptInput};
use rusqlite::Connection;
use chrono::Local;

/// Record a practice attempt
pub fn record_practice_attempt(conn: &Connection, input: &AttemptInput) -> Result<(), String> {
    // Validate input
    if input.duration_seconds <= 0 || input.duration_seconds > 1800 {
        return Err("Duration must be between 1 and 1800 seconds".to_string());
    }

    if input.self_rating < 1 || input.self_rating > 4 {
        return Err("Self rating must be between 1 and 4".to_string());
    }

    // Insert attempt record
    insert_attempt(conn, input)?;

    // Update progress if correct/incorrect (not uncertain)
    if input.result != "uncertain" {
        update_progress_after_attempt(conn, input)?;
    }

    Ok(())
}

/// Get today's study statistics (questions done, minutes spent)
pub fn get_today_stats(conn: &Connection) -> Result<(i64, i64), String> {
    query_today_stats(conn)
}

/// Update progress after an attempt (internal helper)
fn update_progress_after_attempt(conn: &Connection, input: &AttemptInput) -> Result<(), String> {
    let fluency = input.fluency_rating.unwrap_or(input.self_rating).clamp(1, 4);

    // Correctness controls mastery direction; fluency only refines confirmed result
    let progress_rating = if input.result == "correct" {
        fluency
    } else {
        fluency.min(2)
    };

    // Update progress record (simplified SRS logic placeholder)
    conn.execute(
        "INSERT OR REPLACE INTO progress (question_id, mastery, last_reviewed_at, review_count)
         VALUES (?1, ?2, ?3, COALESCE((SELECT review_count FROM progress WHERE question_id=?1), 0) + 1)",
        rusqlite::params![
            input.question_id,
            progress_rating,
            Local::now().to_rfc3339(),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_attempt_validation() {
        let input = AttemptInput {
            question_id: 1,
            duration_seconds: 0, // Invalid
            result: "correct".to_string(),
            self_rating: 3,
            selected_answer: None,
            mode: None,
            outcome: None,
            evidence_source: None,
            fluency_rating: None,
            confidence: None,
            session_id: None,
            diagnosis_id: None,
        };

        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let result = record_practice_attempt(&conn, &input);
        assert!(result.is_err());
    }
}
