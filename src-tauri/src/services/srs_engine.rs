use rusqlite::Connection;
use chrono::{DateTime, Local, Duration};

/// Calculate next review time based on mastery level
pub fn calculate_next_review(mastery: i32, review_count: i32) -> DateTime<Local> {
    let intervals = [1, 3, 7, 14]; // days for mastery levels 1-4
    let base_interval = intervals.get((mastery - 1).max(0) as usize).unwrap_or(&14);

    // Exponential growth based on review count
    let multiplier = 2_i32.pow(review_count.max(0) as u32 / 3);
    let days = base_interval * multiplier;

    Local::now() + Duration::days(days as i64)
}

/// Get review intervals from settings
pub fn get_review_intervals(conn: &Connection) -> Result<Vec<i64>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'review_intervals'")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([], |row| {
            let json_str: String = row.get(0)?;
            serde_json::from_str(&json_str)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
        });

    match result {
        Ok(intervals) => Ok(intervals),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(vec![1, 3, 7, 14]), // Default intervals
        Err(e) => Err(e.to_string()),
    }
}

/// Update review intervals in settings
pub fn update_review_intervals(conn: &Connection, intervals: &[i64]) -> Result<(), String> {
    if intervals.len() != 4 {
        return Err("Must provide exactly 4 intervals".to_string());
    }

    if intervals.iter().any(|&i| i < 1 || i > 365) {
        return Err("Intervals must be between 1 and 365 days".to_string());
    }

    let json_str = serde_json::to_string(intervals).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('review_intervals', ?1)",
        rusqlite::params![json_str],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_next_review() {
        let next = calculate_next_review(1, 0);
        assert!(next > Local::now());

        let next2 = calculate_next_review(4, 0);
        assert!(next2 > next);
    }

    #[test]
    fn test_update_intervals_validation() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        ).unwrap();

        // Wrong count
        let result = update_review_intervals(&conn, &[1, 3, 7]);
        assert!(result.is_err());

        // Out of range
        let result = update_review_intervals(&conn, &[1, 3, 7, 400]);
        assert!(result.is_err());

        // Valid
        let result = update_review_intervals(&conn, &[1, 3, 7, 14]);
        assert!(result.is_ok());
    }
}
