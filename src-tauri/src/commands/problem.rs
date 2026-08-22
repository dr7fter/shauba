use crate::services::{
    get_question, get_total_question_count, get_favorite_count,
    toggle_favorite, save_note,
};
use crate::db::Question;
use rusqlite::Connection;
use tauri::State;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

/// Get question by ID (Tauri command)
#[tauri::command]
pub fn cmd_get_question(
    state: State<AppState>,
    question_id: i64,
) -> Result<Option<Question>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_question(&conn, question_id)
}

/// Get total question count (Tauri command)
#[tauri::command]
pub fn cmd_get_question_count(state: State<AppState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_total_question_count(&conn)
}

/// Get favorite count (Tauri command)
#[tauri::command]
pub fn cmd_get_favorite_count(state: State<AppState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_favorite_count(&conn)
}

/// Toggle question favorite (Tauri command)
#[tauri::command]
pub fn cmd_toggle_favorite(
    state: State<AppState>,
    question_id: i64,
    favorite: bool,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    toggle_favorite(&conn, question_id, favorite)
}

/// Save question note (Tauri command)
#[tauri::command]
pub fn cmd_save_note(
    state: State<AppState>,
    question_id: i64,
    note: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    save_note(&conn, question_id, &note)
}
