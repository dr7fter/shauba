// Data Access Layer - SQL queries only
use serde::{Deserialize, Serialize};

// Re-export DAO modules
pub mod session_dao;
pub mod problem_dao;
pub mod review_dao;

pub use session_dao::*;
pub use problem_dao::*;
pub use review_dao::*;

// ===== Shared Data Structures =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Question {
    pub id: i64,
    pub content: String,
    pub answer: String,
    pub explanation: Option<String>,
    pub difficulty: Option<i32>,
    pub tags: Option<String>,
    pub source: Option<String>,
    pub favorite: bool,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PracticeSessionQueueItem {
    pub question_id: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PracticeSessionState {
    pub queue: Vec<PracticeSessionQueueItem>,
    pub current_index: usize,
    pub attempt_mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttemptInput {
    pub question_id: i64,
    pub duration_seconds: i32,
    pub result: String,
    pub self_rating: i32,
    pub selected_answer: Option<String>,
    pub mode: Option<String>,
    pub outcome: Option<String>,
    pub evidence_source: Option<String>,
    pub fluency_rating: Option<i32>,
    pub confidence: Option<i32>,
    pub session_id: Option<String>,
    pub diagnosis_id: Option<String>,
}
