use crate::services::{get_review_intervals, update_review_intervals};
use rusqlite::Connection;
use tauri::State;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

/// Get review intervals configuration (Tauri command)
#[tauri::command]
pub fn cmd_get_review_intervals(state: State<AppState>) -> Result<Vec<i64>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_review_intervals(&conn)
}

/// Update review intervals configuration (Tauri command)
#[tauri::command]
pub fn cmd_update_review_intervals(
    state: State<AppState>,
    intervals: Vec<i64>,
) -> Result<(), String> {
    if intervals.is_empty() {
        return Err("Review intervals cannot be empty".to_string());
    }

    if intervals.iter().any(|&i| i <= 0) {
        return Err("All intervals must be positive".to_string());
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    update_review_intervals(&conn, &intervals)
}
