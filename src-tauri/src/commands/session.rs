use crate::services::{
    save_session, load_session, clear_session,
    validate_session_queue, calculate_session_progress,
};
use crate::db::{PracticeSessionQueueItem, PracticeSessionState};
use rusqlite::Connection;
use tauri::State;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

/// Save practice session state (Tauri command)
#[tauri::command]
pub fn cmd_save_practice_session(
    state: State<AppState>,
    queue: Vec<PracticeSessionQueueItem>,
    current_index: usize,
    attempt_mode: String,
) -> Result<(), String> {
    if !validate_session_queue(&queue) {
        return Err("Invalid session queue: empty or contains duplicates".to_string());
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    save_session(&conn, &queue, current_index, &attempt_mode)
}

/// Load practice session state (Tauri command)
#[tauri::command]
pub fn cmd_load_practice_session(
    state: State<AppState>,
) -> Result<Option<PracticeSessionState>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    load_session(&conn)
}

/// Clear practice session state (Tauri command)
#[tauri::command]
pub fn cmd_clear_practice_session(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    clear_session(&conn)
}

/// Calculate session progress percentage (utility for frontend)
#[tauri::command]
pub fn cmd_calculate_session_progress(
    current_index: usize,
    total_questions: usize,
) -> Result<f64, String> {
    Ok(calculate_session_progress(current_index, total_questions))
}
