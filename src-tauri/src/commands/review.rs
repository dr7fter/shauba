use crate::services::{record_practice_attempt, get_today_stats};
use crate::db::AttemptInput;
use rusqlite::Connection;
use tauri::State;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

/// Record a practice attempt (Tauri command)
#[tauri::command]
pub fn cmd_record_attempt(
    state: State<AppState>,
    attempt: AttemptInput,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    record_practice_attempt(&conn, &attempt)
}

/// Get today's study statistics (Tauri command)
#[tauri::command]
pub fn cmd_get_today_stats(state: State<AppState>) -> Result<(i64, i64), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_today_stats(&conn)
}
