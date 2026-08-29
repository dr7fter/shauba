// Three-tier architecture modules (v1.0.0)
mod services; // Business Logic Layer（评分内核等）

use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::{Datelike, Duration, Local, TimeZone};
use rand::Rng;
use reqwest::{blocking::Client, Method, StatusCode, Url};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};
use tauri::{Manager, State};

const DEFAULT_LIBRARY: &str = r"E:\考研资料\题库-大观园";
const CATEGORY_SCHEMA_VERSION: &str = "2";
const AI_RATING_MIN: f64 = 0.0;
const AI_RATING_MAX: f64 = 2.50;

#[allow(dead_code)]
fn clamp_ai_rating(value: f64) -> f64 {
    value.clamp(AI_RATING_MIN, AI_RATING_MAX)
}

struct AppState {
    db: Mutex<Connection>,
    supplemental_db: Mutex<Connection>,
    data_dir: PathBuf,
    library_dir: Mutex<PathBuf>,
    image_cache: Mutex<HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OptionItem {
    id: String,
    label: String,
    #[serde(rename(serialize = "contentMd", deserialize = "content_md"))]
    content_md: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Question {
    id: i64,
    stem: String,
    options: Vec<OptionItem>,
    correct_answer: String,
    explanation: String,
    source: String,
    question_type: String,
    category_path: String,
    image_paths: Vec<String>,
    is_core: bool,
    difficulty: i32,
    favorite: bool,
    attempts: i32,
    accuracy: Option<f64>,
    mastery: Option<i32>,
    next_review: Option<String>,
    note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecommendedQuestion {
    question: Question,
    score: f64,
    reason: String,
    reason_code: String,
    /// AI 给这道题指定的角色（diagnosis / method_choice / consolidate /
    /// integration / transfer / timed / challenge / review），只有 AI 题组的题才有值。
    question_role: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapData {
    library_dir: String,
    library_ready: bool,
    question_count: i64,
    image_count: usize,
    today_done: i64,
    today_minutes: i64,
    due_count: i64,
    favorite_count: i64,
    inbox_count: i64,
    inbox_failed_count: i64,
    review_intervals: Vec<i64>,
    daily_mode: String,
    daily_problem_target: i64,
    daily_minute_target: i64,
    data_dir: String,
    inbox_dir: String,
    current_chapter_id: Option<i64>,
    current_chapter_name: Option<String>,
    current_focus_category_ids: Vec<i64>,
    custom_queue_count: i64,
    supplemental_question_count: i64,
    supplemental_db_path: String,
    active_recommendation: Option<RecommendationBatch>,
    recommendations: Vec<RecommendedQuestion>,
    excluded_duration_count: i64,
    reward_events_count: i64,
}

/// 六维证据分（0-100），来自 Codex 批改 payload，落库到 attempts 的 dim_* 列。
#[derive(Debug, Deserialize, Serialize, Clone, Copy, Default, PartialEq)]
struct AttemptDimensions {
    rigor: Option<f64>,
    computation: Option<f64>,
    modeling: Option<f64>,
    method_use: Option<f64>,
    speed: Option<f64>,
    strategy_insight: Option<f64>,
}

impl AttemptDimensions {
    #[allow(dead_code)]
    fn is_empty(&self) -> bool {
        self.rigor.is_none()
            && self.computation.is_none()
            && self.modeling.is_none()
            && self.method_use.is_none()
            && self.speed.is_none()
            && self.strategy_insight.is_none()
    }

    fn from_dimension_map(map: &HashMap<String, RatingDimension>) -> Self {
        let pick = |key: &str| {
            map.get(key)
                .and_then(|d| d.score)
                .filter(|s| (0.0..=100.0).contains(s))
        };
        AttemptDimensions {
            rigor: pick("rigor"),
            computation: pick("computation"),
            modeling: pick("modeling"),
            method_use: pick("methodUse"),
            speed: pick("speed"),
            strategy_insight: pick("strategyInsight"),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordAttemptResult {
    question: Question,
    attempt_id: i64,
}

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct AttemptInput {
    question_id: i64,
    duration_seconds: i64,
    result: String,
    self_rating: i32,
    #[serde(default)]
    selected_answer: Option<String>,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    outcome: Option<String>,
    #[serde(default)]
    evidence_source: Option<String>,
    #[serde(default)]
    fluency_rating: Option<i32>,
    #[serde(default)]
    confidence: Option<f64>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    diagnosis_id: Option<String>,
    #[serde(default)]
    ai_rating: Option<f64>,
    #[serde(default)]
    difficulty_multiplier: Option<f64>,
    #[serde(default)]
    technique_level: Option<i32>,
    #[serde(default)]
    dimensions: Option<AttemptDimensions>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RewardEvent {
    event_id: String,
    reward_type: String,
    amount: i64,
    meta_json: Option<String>,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RewardSummary {
    total_claimed_exp: i64,
    newly_claimed: bool,
    event_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PracticeSessionInput {
    question_ids: Vec<i64>,
    reasons: Vec<String>,
    reason_codes: Vec<String>,
    scores: Vec<f64>,
    current_index: usize,
    attempt_mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PracticeSessionState {
    queue: Vec<RecommendedQuestion>,
    current_index: usize,
    attempt_mode: String,
    saved_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PracticeSessionQueueItem {
    question_id: i64,
    reason: String,
    reason_code: String,
    score: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupInfo {
    file_name: String,
    path: String,
    size_bytes: u64,
    created_at: String,
    backup_type: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreResult {
    success: bool,
    pre_restore_backup_path: String,
    message: String,
    restored_attempts: i64,
    restored_progress: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PaperAttempt {
    question_id: i64,
    result: String,
    self_rating: i32,
    #[serde(default)]
    duration_seconds: i64,
    #[serde(default)]
    selected_answer: Option<String>,
    #[serde(default)]
    diagnosis: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct BatchAttempt {
    question_id: i64,
    result: String,
    self_rating: i32,
    #[serde(default)]
    duration_seconds: i64,
    summary: String,
    #[serde(default)]
    verdict: Option<String>,
    #[serde(default)]
    earliest_error: Option<String>,
    #[serde(default)]
    error_tags: Vec<String>,
    #[serde(default)]
    weakness_tags: Vec<String>,
    #[serde(default)]
    advice: Option<String>,
    #[serde(default)]
    better_solution: Option<String>,
    confidence: f64,
    #[serde(default)]
    rating: Option<f64>,
    #[serde(default)]
    rating_tier: Option<String>,
    #[serde(default)]
    difficulty_multiplier: Option<f64>,
    #[serde(default)]
    dimensions: HashMap<String, RatingDimension>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RatingDimension {
    #[serde(default)]
    score: Option<f64>,
    #[serde(default)]
    confidence: f64,
    #[serde(default)]
    evidence: String,
    #[serde(default)]
    advice: Option<String>,
    #[serde(default)]
    technique_level: Option<i32>,
    #[serde(default)]
    independent_discovery: Option<String>,
}

#[derive(Debug)]
struct PressureBatchContext {
    session_id: String,
    question_ids: Vec<i64>,
    durations: HashMap<i64, i64>,
}

enum PressureTaskMatch {
    Current(PressureBatchContext),
    Stale {
        session_id: String,
        current_task_id: Option<String>,
    },
    /// A v1.5 pressure task has immutable main-db context but its supplemental
    /// task link disappeared.  Do not fall back to a mutable session lookup.
    LinkMissing { session_id: Option<String> },
    None,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoalInput {
    daily_mode: String,
    daily_problem_target: i64,
    daily_minute_target: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LearningTaskInput {
    request: String,
    available_minutes: i32,
    category_id: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LearningCandidateQuestion {
    question_id: i64,
    category_path: String,
    stem: String,
    question_type: String,
    difficulty: i32,
    attempts: i64,
    accuracy: Option<f64>,
    mastery: Option<i64>,
    last_result: Option<String>,
    has_images: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct CodexPayload {
    schema_version: i32,
    kind: String,
    task_id: String,
    question_id: Option<i64>,
    summary: String,
    verdict: Option<String>,
    earliest_error: Option<String>,
    #[serde(default)]
    error_tags: Vec<String>,
    #[serde(default)]
    weakness_tags: Vec<String>,
    advice: Option<String>,
    #[serde(default)]
    better_solution: Option<String>,
    #[serde(default)]
    confidence: f64,
    #[serde(default)]
    recommended_question_ids: Vec<i64>,
    recommendation_reason: Option<String>,
    #[serde(default)]
    goal: Option<String>,
    #[serde(default)]
    estimated_minutes: Option<i32>,
    #[serde(default)]
    question_roles: HashMap<String, String>,
    #[serde(default)]
    recommendation_order: Vec<i64>,
    #[serde(default)]
    coverage: Vec<Value>,
    #[serde(default)]
    novelty_plan: Vec<String>,
    #[serde(default)]
    success_criteria: Vec<String>,
    #[serde(default)]
    source_evidence_ids: Vec<String>,
    #[serde(default)]
    excluded_question_ids: Vec<i64>,
    #[serde(default)]
    fallback_plan: Option<String>,
    #[serde(default)]
    paper_title: Option<String>,
    #[serde(default)]
    paper_attempts: Vec<PaperAttempt>,
    #[serde(default)]
    batch_attempts: Vec<BatchAttempt>,
    #[serde(default)]
    rating: Option<f64>,
    #[serde(default)]
    rating_tier: Option<String>,
    #[serde(default)]
    difficulty_multiplier: Option<f64>,
    #[serde(default)]
    dimensions: HashMap<String, RatingDimension>,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct InboxItem {
    id: i64,
    task_id: String,
    kind: String,
    question_id: Option<i64>,
    summary: String,
    verdict: Option<String>,
    earliest_error: Option<String>,
    error_tags: Vec<String>,
    weakness_tags: Vec<String>,
    advice: Option<String>,
    better_solution: Option<String>,
    confidence: f64,
    status: String,
    created_at: String,
    paper_title: Option<String>,
    paper_attempts: Vec<PaperAttempt>,
    batch_attempts: Vec<BatchAttempt>,
    recommendation_question_count: Option<i64>,
    recommendation_batch_status: Option<String>,
    rating: Option<f64>,
    rating_tier: Option<String>,
    difficulty_multiplier: Option<f64>,
    dimensions: HashMap<String, RatingDimension>,
    goal: Option<String>,
    estimated_minutes: Option<i32>,
    question_roles: HashMap<String, String>,
    recommendation_order: Vec<i64>,
    coverage: Vec<Value>,
    novelty_plan: Vec<String>,
    success_criteria: Vec<String>,
    fallback_plan: Option<String>,
    recommended_question_ids: Vec<i64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RecommendationBatch {
    task_id: String,
    title: String,
    summary: String,
    recommendation_reason: String,
    status: String,
    created_at: String,
    total_count: i64,
    completed_count: i64,
    remaining_count: i64,
    result_context_path: Option<String>,
    result_exported_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexTask {
    task_id: String,
    question_id: Option<i64>,
    question_count: usize,
    prompt: String,
    inbox_dir: String,
    output_file: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InsightPoint {
    name: String,
    attempts: i64,
    accuracy: f64,
    average_rating: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewDay {
    date: String,
    count: i64,
    correct_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewHistoryItem {
    attempt_id: i64,
    question_id: i64,
    attempted_at: String,
    stem: String,
    category_path: String,
    source: String,
    result: String,
    self_rating: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewHistory {
    days: Vec<ReviewDay>,
    items: Vec<ReviewHistoryItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewPlanDay {
    date: String,
    count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewPlanItem {
    question_id: i64,
    stem: String,
    category_path: String,
    source: String,
    scheduled_date: String,
    next_review: String,
    self_rating: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewPlan {
    days: Vec<ReviewPlanDay>,
    items: Vec<ReviewPlanItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyLogDay {
    date: String,
    count: i64,
    correct_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyLogItem {
    question_id: i64,
    stem: String,
    category_path: String,
    source: String,
    result: String,
    self_rating: i32,
    mode: Option<String>,
    attempted_at: String,
    ai_verdict: Option<String>,
    ai_summary: Option<String>,
    ai_earliest_error: Option<String>,
    ai_error_tags: Vec<String>,
    ai_weakness_tags: Vec<String>,
    ai_advice: Option<String>,
    ai_confidence: Option<f64>,
    ai_confirmed_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyLog {
    days: Vec<DailyLogDay>,
    items: Vec<DailyLogItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CategoryNode {
    id: i64,
    parent_id: Option<i64>,
    name: String,
    path: String,
    root_name: String,
    depth: i32,
    question_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuestionPage {
    items: Vec<Question>,
    total: i64,
    page: i64,
    page_size: i64,
    page_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MasteryChapter {
    id: i64,
    name: String,
    root_name: String,
    total: i64,
    attempted: i64,
    correct_attempts: i64,
    attempt_count: i64,
    due_count: i64,
    weak_count: i64,
    coverage: f64,
    accuracy: Option<f64>,
    rating: Option<f64>,
    mastery_score: Option<f64>,
    evidence: String,
    evidence_level: String,
    evidence_sources: Vec<String>,
    retest_correct_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MasteryNode {
    id: i64,
    parent_id: Option<i64>,
    chapter_id: i64,
    name: String,
    path: String,
    depth: i32,
    total: i64,
    attempted: i64,
    attempt_count: i64,
    due_count: i64,
    weak_count: i64,
    coverage: f64,
    accuracy: Option<f64>,
    rating: Option<f64>,
    mastery_score: Option<f64>,
    evidence_level: String,
    evidence_sources: Vec<String>,
    retest_correct_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WeaknessTagStat {
    tag: String,
    count: i64,
    recent_count: i64,
    last_seen: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WeaknessTagCount {
    tag: String,
    count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WeaknessTrendPoint {
    date: String,
    error_tags: Vec<WeaknessTagCount>,
    weakness_tags: Vec<WeaknessTagCount>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WeaknessRadar {
    error_tags: Vec<WeaknessTagStat>,
    weakness_tags: Vec<WeaknessTagStat>,
    trend: Vec<WeaknessTrendPoint>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SupplementalQuestionInput {
    stem: String,
    correct_answer: String,
    explanation: String,
    source: String,
    question_type: String,
    category_path: String,
    image_paths: Vec<String>,
    difficulty: i32,
}

fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=NORMAL;
         PRAGMA cache_size=10000;
         PRAGMA temp_store=MEMORY;
         CREATE TABLE IF NOT EXISTS questions (
           id INTEGER PRIMARY KEY,
           stem TEXT NOT NULL,
           options_json TEXT NOT NULL DEFAULT '[]',
           correct_answer TEXT NOT NULL,
           explanation TEXT NOT NULL,
           source TEXT NOT NULL,
           question_type TEXT NOT NULL,
           category_path TEXT NOT NULL,
           image_paths_json TEXT NOT NULL DEFAULT '[]',
           is_core INTEGER NOT NULL DEFAULT 0,
           difficulty INTEGER NOT NULL DEFAULT 2,
           content_hash TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_path);
         CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(source);
         CREATE TABLE IF NOT EXISTS categories (
           id INTEGER PRIMARY KEY,
           parent_id INTEGER,
           name TEXT NOT NULL,
           path TEXT NOT NULL,
           root_name TEXT NOT NULL,
           depth INTEGER NOT NULL,
           sort_key INTEGER NOT NULL DEFAULT 0,
           math1 INTEGER NOT NULL DEFAULT 0
         );
         CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
         CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(path);
         CREATE TABLE IF NOT EXISTS question_categories (
           question_id INTEGER NOT NULL,
           category_id INTEGER NOT NULL,
           PRIMARY KEY(question_id, category_id),
           FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
           FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
         );
         CREATE INDEX IF NOT EXISTS idx_question_categories_category ON question_categories(category_id);
         CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            attempted_at TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            result TEXT NOT NULL,
            self_rating INTEGER NOT NULL,
            selected_answer TEXT,
            mode TEXT NOT NULL DEFAULT 'paper',
            outcome TEXT,
            evidence_source TEXT,
            fluency_rating INTEGER,
            confidence REAL,
            session_id TEXT,
            diagnosis_id TEXT,
            ai_rating REAL,
            difficulty_multiplier REAL,
            technique_level INTEGER,
            dim_rigor REAL,
            dim_computation REAL,
            dim_modeling REAL,
            dim_method_use REAL,
            dim_speed REAL,
            dim_strategy_insight REAL,
            FOREIGN KEY(question_id) REFERENCES questions(id)
          );
         CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id);
         CREATE INDEX IF NOT EXISTS idx_attempts_question_time ON attempts(question_id, attempted_at DESC);
         CREATE TABLE IF NOT EXISTS progress (
           question_id INTEGER PRIMARY KEY,
           favorite INTEGER NOT NULL DEFAULT 0,
           mastery INTEGER,
           last_attempt_at TEXT,
           next_review TEXT,
           review_count INTEGER NOT NULL DEFAULT 0,
           note TEXT,
           FOREIGN KEY(question_id) REFERENCES questions(id)
          );
         CREATE TABLE IF NOT EXISTS codex_inbox (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           task_id TEXT NOT NULL UNIQUE,
           kind TEXT NOT NULL,
           question_id INTEGER,
           payload_json TEXT NOT NULL,
           status TEXT NOT NULL DEFAULT 'pending',
           created_at TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS learning_task_candidates (
           task_id TEXT NOT NULL,
           question_id INTEGER NOT NULL,
           created_at TEXT NOT NULL,
           PRIMARY KEY(task_id, question_id),
           FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
         );
         CREATE INDEX IF NOT EXISTS idx_learning_task_candidates_task ON learning_task_candidates(task_id);
         CREATE TABLE IF NOT EXISTS codex_analysis_signals (
           task_id TEXT PRIMARY KEY,
           question_id INTEGER NOT NULL,
           error_tags_json TEXT NOT NULL DEFAULT '[]',
           weakness_tags_json TEXT NOT NULL DEFAULT '[]',
           confidence REAL NOT NULL,
           confirmed_at TEXT NOT NULL,
           FOREIGN KEY(question_id) REFERENCES questions(id)
         );
         CREATE INDEX IF NOT EXISTS idx_codex_analysis_signals_confirmed ON codex_analysis_signals(confirmed_at DESC);
         CREATE TABLE IF NOT EXISTS codex_batch_applications (
           task_id TEXT NOT NULL,
           question_id INTEGER NOT NULL,
           applied_at TEXT NOT NULL,
           PRIMARY KEY(task_id, question_id)
         );
         -- Audit record for isolated startup backfill failures.  A bad historical
         -- inbox payload must never block later confirmed records from recovery.
         CREATE TABLE IF NOT EXISTS codex_backfill_failures (
           inbox_id INTEGER PRIMARY KEY,
           task_id TEXT,
           stage TEXT NOT NULL,
           error TEXT NOT NULL,
           attempts INTEGER NOT NULL DEFAULT 1,
           last_failed_at TEXT NOT NULL,
           resolved INTEGER NOT NULL DEFAULT 0,
           resolved_at TEXT
         );
         CREATE INDEX IF NOT EXISTS idx_codex_backfill_failures_open ON codex_backfill_failures(resolved,last_failed_at);
         -- Main-database receipt for the two-database pressure grading saga.  The
         -- formal attempt/ELO transaction and `main_applied` state change together.
         CREATE TABLE IF NOT EXISTS pressure_batch_receipts (
           task_id TEXT PRIMARY KEY,
           session_id TEXT NOT NULL,
           payload_hash TEXT NOT NULL,
           state TEXT NOT NULL,
           inbox_id INTEGER,
           last_error TEXT,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_pressure_batch_receipts_state ON pressure_batch_receipts(state,updated_at);
         -- Immutable task-time binding. Codex may adjudicate the bound attempt,
         -- but may never search for or mutate a newer attempt when its response returns.
         CREATE TABLE IF NOT EXISTS codex_task_context (
           task_id TEXT NOT NULL,
           question_id INTEGER NOT NULL,
           attempt_id INTEGER,
           task_kind TEXT NOT NULL,
           requested_at TEXT NOT NULL,
           source_mode TEXT NOT NULL,
           PRIMARY KEY(task_id, question_id)
         );
         CREATE INDEX IF NOT EXISTS idx_codex_task_context_attempt ON codex_task_context(attempt_id, requested_at DESC);
         CREATE TABLE IF NOT EXISTS elo_events (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           attempt_id INTEGER,
           question_id INTEGER NOT NULL,
           delta REAL NOT NULL,
           rating_after REAL NOT NULL,
           performance REAL NOT NULL,
           expected REAL NOT NULL,
           created_at TEXT NOT NULL,
           session_id TEXT,
           reason TEXT NOT NULL DEFAULT 'match'
         );
         CREATE TABLE IF NOT EXISTS season_history (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           season_name TEXT NOT NULL,
           started_at TEXT NOT NULL,
           ended_at TEXT NOT NULL,
           peak_rating REAL NOT NULL,
           final_rating REAL NOT NULL,
           rank_index INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS recommendation_overrides (
           question_id INTEGER PRIMARY KEY,
           reason TEXT NOT NULL,
           task_id TEXT NOT NULL,
           created_at TEXT NOT NULL,
           consumed INTEGER NOT NULL DEFAULT 0,
           FOREIGN KEY(question_id) REFERENCES questions(id)
         );
         CREATE TABLE IF NOT EXISTS recommendation_batches (
           task_id TEXT PRIMARY KEY,
           title TEXT NOT NULL,
           summary TEXT NOT NULL,
           recommendation_reason TEXT NOT NULL,
           status TEXT NOT NULL DEFAULT 'pending',
           created_at TEXT NOT NULL,
           started_at TEXT,
           completed_at TEXT,
           result_context_path TEXT,
           result_exported_at TEXT
         );
         CREATE INDEX IF NOT EXISTS idx_recommendation_batches_status ON recommendation_batches(status,started_at);
         CREATE TABLE IF NOT EXISTS recommendation_batch_items (
           task_id TEXT NOT NULL,
           question_id INTEGER NOT NULL,
           position INTEGER NOT NULL,
           role TEXT,
           completed_at TEXT,
           attempt_id INTEGER,
           result TEXT,
           outcome TEXT,
           self_rating INTEGER,
           duration_seconds INTEGER,
           attempt_mode TEXT,
           evidence_source TEXT,
           PRIMARY KEY(task_id,question_id),
           UNIQUE(task_id,position),
           FOREIGN KEY(task_id) REFERENCES recommendation_batches(task_id) ON DELETE CASCADE,
           FOREIGN KEY(question_id) REFERENCES questions(id)
         );
         CREATE INDEX IF NOT EXISTS idx_recommendation_batch_items_pending ON recommendation_batch_items(task_id,position,completed_at);
         CREATE TABLE IF NOT EXISTS custom_queue (
           question_id INTEGER PRIMARY KEY,
           position INTEGER NOT NULL,
           added_at TEXT NOT NULL,
           FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
         );
          CREATE TABLE IF NOT EXISTS reward_events (
            event_id TEXT PRIMARY KEY,
            reward_type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            meta_json TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_reward_events_created ON reward_events(created_at);
          CREATE TABLE IF NOT EXISTS practice_sessions (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            queue_json TEXT NOT NULL,
            current_index INTEGER NOT NULL,
            attempt_mode TEXT NOT NULL,
            saved_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
          INSERT OR IGNORE INTO settings(key,value) VALUES
            ('daily_mode','problems'),('daily_problem_target','20'),('daily_minute_target','90'),
            ('current_chapter_id',''),('category_schema_version','0'),('last_attempt_id','');",
    )?;
    services::learning::init_schema(conn)
}

fn ensure_column(conn: &Connection, table: &str, column: &str, ddl: &str) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let exists = stmt
        .query_map([], |r| r.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?
        .iter()
        .any(|name| name == column);
    if !exists {
        conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {ddl};"))?;
    }
    Ok(())
}

fn migrate_schema(conn: &Connection) -> rusqlite::Result<()> {
    migrate_schema_impl(conn, false)
}

fn migrate_schema_impl(conn: &Connection, inject_failure: bool) -> rusqlite::Result<()> {
    conn.execute_batch("BEGIN IMMEDIATE")?;
    let result = (|| {
        ensure_column(conn, "progress", "note", "note TEXT")?;
        ensure_column(conn, "attempts", "outcome", "outcome TEXT")?;
        if inject_failure {
            conn.execute_batch("THIS IS AN INTENTIONAL MIGRATION FAILURE")?;
        }
        ensure_column(conn, "attempts", "evidence_source", "evidence_source TEXT")?;
        ensure_column(conn, "attempts", "fluency_rating", "fluency_rating INTEGER")?;
        ensure_column(conn, "attempts", "confidence", "confidence REAL")?;
        ensure_column(conn, "attempts", "session_id", "session_id TEXT")?;
        ensure_column(conn, "attempts", "diagnosis_id", "diagnosis_id TEXT")?;
        ensure_column(conn, "attempts", "ai_rating", "ai_rating REAL")?;
        ensure_column(
            conn,
            "attempts",
            "difficulty_multiplier",
            "difficulty_multiplier REAL",
        )?;
        ensure_column(
            conn,
            "attempts",
            "technique_level",
            "technique_level INTEGER",
        )?;
        ensure_column(conn, "attempts", "dim_rigor", "dim_rigor REAL")?;
        ensure_column(conn, "attempts", "dim_computation", "dim_computation REAL")?;
        ensure_column(conn, "attempts", "dim_modeling", "dim_modeling REAL")?;
        ensure_column(conn, "attempts", "dim_method_use", "dim_method_use REAL")?;
        ensure_column(conn, "attempts", "dim_speed", "dim_speed REAL")?;
        ensure_column(
            conn,
            "attempts",
            "dim_strategy_insight",
            "dim_strategy_insight REAL",
        )?;
        ensure_column(conn, "recommendation_batches", "result_context_path", "result_context_path TEXT")?;
        ensure_column(conn, "recommendation_batches", "result_exported_at", "result_exported_at TEXT")?;
        ensure_column(conn, "recommendation_batch_items", "attempt_id", "attempt_id INTEGER")?;
        ensure_column(conn, "recommendation_batch_items", "result", "result TEXT")?;
        ensure_column(conn, "recommendation_batch_items", "outcome", "outcome TEXT")?;
        ensure_column(conn, "recommendation_batch_items", "self_rating", "self_rating INTEGER")?;
        ensure_column(conn, "recommendation_batch_items", "duration_seconds", "duration_seconds INTEGER")?;
        ensure_column(conn, "recommendation_batch_items", "attempt_mode", "attempt_mode TEXT")?;
        ensure_column(conn, "recommendation_batch_items", "evidence_source", "evidence_source TEXT")?;
        ensure_column(conn, "recommendation_batch_items", "role", "role TEXT")?;
        ensure_column(conn, "elo_events", "session_id", "session_id TEXT")?;
        ensure_column(
            conn,
            "elo_events",
            "reason",
            "reason TEXT NOT NULL DEFAULT 'match'",
        )?;
        // 一次性迁移：万位 CS2 刻度 → 完美平台千位刻度
        if setting(conn, "elo_wanmei_migrated", "") != "1" {
            conn.execute_batch(
                "UPDATE elo_events
                 SET rating_after = 1400.0 + (rating_after - 10000.0) * 0.1,
                     delta = delta * 0.1;
                 INSERT INTO settings(key,value) VALUES('elo_wanmei_migrated','1')
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value;",
            )?;
        }
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS codex_batch_applications (
               task_id TEXT NOT NULL,
               question_id INTEGER NOT NULL,
               applied_at TEXT NOT NULL,
               PRIMARY KEY(task_id, question_id)
             );
             CREATE TABLE IF NOT EXISTS codex_task_context (
               task_id TEXT NOT NULL,
               question_id INTEGER NOT NULL,
               attempt_id INTEGER,
               task_kind TEXT NOT NULL,
               requested_at TEXT NOT NULL,
               source_mode TEXT NOT NULL,
               PRIMARY KEY(task_id, question_id)
             );
             CREATE INDEX IF NOT EXISTS idx_codex_task_context_attempt ON codex_task_context(attempt_id, requested_at DESC);",
        )?;

        services::learning::init_schema(conn)?;
        conn.execute_batch(
            "UPDATE attempts SET outcome = result WHERE outcome IS NULL;
             UPDATE attempts SET evidence_source = 'legacy' WHERE evidence_source IS NULL;
             UPDATE attempts SET fluency_rating = self_rating WHERE fluency_rating IS NULL;",
        )?;
        backfill_recommendation_item_roles(conn)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(e))))?;
        Ok(())
    })();

    match result {
        Ok(()) => conn.execute_batch("COMMIT"),
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

fn create_rolling_backup(data_dir: &Path) -> rusqlite::Result<Option<PathBuf>> {
    let db_path = data_dir.join("shuaba.db");
    if !db_path.exists() {
        return Ok(None);
    }
    let rolling_dir = data_dir.join("backups").join("rolling");
    fs::create_dir_all(&rolling_dir)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let stamp = Local::now().format("%Y%m%d-%H%M%S-%3f");
    let backup_path = rolling_dir.join(format!("backup-startup-{stamp}.db"));

    fs::copy(&db_path, &backup_path)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    prune_rolling_backups(&rolling_dir);
    Ok(Some(backup_path))
}

fn prune_rolling_backups(rolling_dir: &Path) {
    let Ok(entries) = fs::read_dir(rolling_dir) else {
        return;
    };
    let mut files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("db") {
            let modified = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            files.push((path, modified));
        }
    }
    files.sort_by(|a, b| b.1.cmp(&a.1));
    let dates: Vec<chrono::DateTime<Local>> = files
        .iter()
        .map(|(_, modified)| chrono::DateTime::<Local>::from(*modified))
        .collect();
    let keep = rolling_backup_keep_indices(&dates);
    for (index, (path, _)) in files.iter().enumerate() {
        if !keep.contains(&index) {
            let _ = fs::remove_file(path);
        }
    }
}

fn rolling_backup_keep_indices(dates: &[chrono::DateTime<Local>]) -> HashSet<usize> {
    let mut keep: HashSet<usize> = (0..dates.len().min(7)).collect();
    let mut weekly = HashSet::new();
    for (index, date) in dates.iter().enumerate() {
        let iso = date.iso_week();
        if weekly.len() < 4 && weekly.insert((iso.year(), iso.week())) {
            keep.insert(index);
        }
    }
    keep
}

fn init_supplemental_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS supplemental_questions (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           stem TEXT NOT NULL,
           correct_answer TEXT NOT NULL,
           explanation TEXT NOT NULL,
           source TEXT NOT NULL,
           question_type TEXT NOT NULL,
           category_path TEXT NOT NULL,
           image_paths_json TEXT NOT NULL DEFAULT '[]',
           difficulty INTEGER NOT NULL DEFAULT 2,
           created_at TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_supplemental_category ON supplemental_questions(category_path);
         CREATE TABLE IF NOT EXISTS pressure_sessions (
            session_id TEXT PRIMARY KEY,
            question_ids TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            status TEXT NOT NULL,
            task_id TEXT,
            created_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS pressure_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            user_answer TEXT NOT NULL,
            duration INTEGER NOT NULL,
            submit_time INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES pressure_sessions(session_id)
         );
         CREATE TABLE IF NOT EXISTS pressure_reports (
            session_id TEXT PRIMARY KEY,
            report_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES pressure_sessions(session_id)
         );
         CREATE TABLE IF NOT EXISTS pressure_task_links (
            task_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            is_current INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES pressure_sessions(session_id)
         );
         CREATE INDEX IF NOT EXISTS idx_pressure_sessions_created_at ON pressure_sessions(created_at);
         CREATE INDEX IF NOT EXISTS idx_pressure_answers_session ON pressure_answers(session_id);
         CREATE INDEX IF NOT EXISTS idx_pressure_task_links_session ON pressure_task_links(session_id, is_current);",
    )
    // Existing 0.9 databases were created before task_id and task history existed.
    // Keep the migration additive so retry tasks can supersede old tasks safely.
    .and_then(|_| ensure_column(conn, "pressure_sessions", "task_id", "task_id TEXT"))
    .and_then(|_| {
        conn.execute_batch(
            "INSERT OR IGNORE INTO pressure_task_links(task_id,session_id,is_current,created_at)
             SELECT task_id,session_id,1,created_at
             FROM pressure_sessions
             WHERE task_id IS NOT NULL AND task_id<>'';
             UPDATE pressure_task_links
             SET is_current=CASE WHEN task_id=(
                 SELECT ps.task_id FROM pressure_sessions ps
                 WHERE ps.session_id=pressure_task_links.session_id
             ) THEN 1 ELSE 0 END;",
        )
    })
}

fn setting(conn: &Connection, key: &str, fallback: &str) -> String {
    conn.query_row("SELECT value FROM settings WHERE key=?1", [key], |r| {
        r.get(0)
    })
    .unwrap_or_else(|_| fallback.to_owned())
}

fn flatten_math1_ids(value: &Value, ids: &mut HashSet<i64>) {
    let Some(nodes) = value.as_array() else {
        return;
    };
    for node in nodes {
        let explicit = node
            .get("effective_exam_subjects")
            .map(|v| v.to_string().contains("math_1"))
            .unwrap_or(false);
        if explicit {
            if let Some(id) = node.get("id").and_then(Value::as_i64) {
                ids.insert(id);
            }
        }
        if let Some(children) = node.get("children") {
            flatten_math1_ids(children, ids);
        }
    }
}

fn collect_categories(
    value: &Value,
    parent_id: Option<i64>,
    parent_path: &str,
    root_name: &str,
    depth: i32,
    rows: &mut Vec<(i64, Option<i64>, String, String, String, i32, i64, bool)>,
) {
    let Some(nodes) = value.as_array() else {
        return;
    };
    for node in nodes {
        let Some(id) = node.get("id").and_then(Value::as_i64) else {
            continue;
        };
        let name = node
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("未命名")
            .to_owned();
        let path = if parent_path.is_empty() {
            name.clone()
        } else {
            format!("{parent_path} / {name}")
        };
        let root = if depth == 0 {
            name.clone()
        } else {
            root_name.to_owned()
        };
        let math1 = node
            .get("effective_exam_subjects")
            .map(|v| v.to_string().contains("math_1"))
            .unwrap_or(false);
        let sort_key = node.get("sort_key").and_then(Value::as_i64).unwrap_or(0);
        rows.push((
            id,
            parent_id,
            name,
            path.clone(),
            root.clone(),
            depth,
            sort_key,
            math1,
        ));
        if let Some(children) = node.get("children") {
            collect_categories(children, Some(id), &path, &root, depth + 1, rows);
        }
    }
}

fn import_category_metadata(conn: &mut Connection, library: &Path) -> Result<(), String> {
    let categories_raw =
        fs::read_to_string(library.join("categories.json")).map_err(|e| e.to_string())?;
    let questions_raw = fs::read_to_string(library.join("all_questions_20260813.json"))
        .map_err(|e| e.to_string())?;
    let categories: Value = serde_json::from_str(categories_raw.trim_start_matches('\u{feff}'))
        .map_err(|e| e.to_string())?;
    let questions: Value = serde_json::from_str(questions_raw.trim_start_matches('\u{feff}'))
        .map_err(|e| e.to_string())?;
    let mut rows = Vec::new();
    collect_categories(&categories, None, "", "", 0, &mut rows);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM question_categories", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM categories", [])
        .map_err(|e| e.to_string())?;
    {
        let mut category_stmt = tx.prepare("INSERT INTO categories(id,parent_id,name,path,root_name,depth,sort_key,math1) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)").map_err(|e|e.to_string())?;
        for (id, parent, name, path, root, depth, sort_key, math1) in rows {
            category_stmt
                .execute(params![
                    id,
                    parent,
                    name,
                    path,
                    root,
                    depth,
                    sort_key,
                    i32::from(math1)
                ])
                .map_err(|e| e.to_string())?;
        }
    }
    {
        let mut link_stmt = tx.prepare("INSERT OR IGNORE INTO question_categories(question_id,category_id) SELECT ?1,?2 WHERE EXISTS(SELECT 1 FROM questions WHERE id=?1) AND EXISTS(SELECT 1 FROM categories WHERE id=?2 AND math1=1)").map_err(|e|e.to_string())?;
        if let Some(items) = questions.get("questions").and_then(Value::as_array) {
            for q in items {
                let Some(question_id) = q.get("id").and_then(Value::as_i64) else {
                    continue;
                };
                if let Some(ids) = q.get("category_ids").and_then(Value::as_array) {
                    for category_id in ids.iter().filter_map(Value::as_i64) {
                        link_stmt
                            .execute(params![question_id, category_id])
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
    }
    tx.execute(
        "UPDATE questions SET category_path=COALESCE((
           SELECT c.path FROM question_categories qc JOIN categories c ON c.id=qc.category_id
           WHERE qc.question_id=questions.id AND c.root_name IN ('高等数学','线性代数','概率统计')
           ORDER BY c.depth DESC, length(c.path) DESC LIMIT 1
         ),category_path)",
        [],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR REPLACE INTO settings(key,value) VALUES('category_schema_version',?1)",
        [CATEGORY_SCHEMA_VERSION],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

fn infer_difficulty(source: &str, is_core: bool, question_type: &str) -> i32 {
    if source.contains("强化") || source.contains("重点") || is_core {
        3
    } else if question_type == "subjective" && !source.contains("基础") {
        2
    } else {
        1
    }
}

fn import_library(conn: &mut Connection, library: &Path) -> Result<i64, String> {
    let question_path = library.join("all_questions_20260813.json");
    let categories_path = library.join("categories.json");
    let raw_questions = fs::read_to_string(&question_path).map_err(|e| e.to_string())?;
    let raw_categories = fs::read_to_string(&categories_path).map_err(|e| e.to_string())?;
    let root: Value = serde_json::from_str(raw_questions.trim_start_matches('\u{feff}'))
        .map_err(|e| e.to_string())?;
    let categories: Value = serde_json::from_str(raw_categories.trim_start_matches('\u{feff}'))
        .map_err(|e| e.to_string())?;
    let mut math1_ids = HashSet::new();
    flatten_math1_ids(&categories, &mut math1_ids);
    let questions = root
        .get("questions")
        .and_then(Value::as_array)
        .ok_or("题库缺少 questions 数组")?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    // 通过 content_hash 增量同步题库，保留本地 progress/attempts 等用户数据。
    let mut inserted = 0_i64;
    {
        let mut stmt = tx
            .prepare("INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(id) DO UPDATE SET stem=excluded.stem,options_json=excluded.options_json,correct_answer=excluded.correct_answer,explanation=excluded.explanation,source=excluded.source,question_type=excluded.question_type,category_path=excluded.category_path,image_paths_json=excluded.image_paths_json,is_core=excluded.is_core,difficulty=excluded.difficulty,content_hash=excluded.content_hash WHERE questions.content_hash IS NULL OR questions.content_hash<>excluded.content_hash")
            .map_err(|e| e.to_string())?;
        for q in questions {
            let eligible = q
                .get("category_ids")
                .and_then(Value::as_array)
                .map(|values| {
                    values
                        .iter()
                        .filter_map(Value::as_i64)
                        .any(|id| math1_ids.contains(&id))
                })
                .unwrap_or(false);
            if !eligible {
                continue;
            }
            let id = q.get("id").and_then(Value::as_i64).unwrap_or_default();
            let options = q.get("options").cloned().unwrap_or(Value::Array(vec![]));
            let refs = q
                .pointer("/document/asset_refs")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let image_paths: Vec<String> = refs
                .iter()
                .filter_map(Value::as_str)
                .map(|r| {
                    let hash = r.rsplit('/').next().unwrap_or(r);
                    library
                        .join("images")
                        .join(format!("{hash}.png"))
                        .to_string_lossy()
                        .into_owned()
                })
                .collect();
            let source = q.get("source").and_then(Value::as_str).unwrap_or("");
            let qtype = q
                .get("question_type")
                .and_then(Value::as_str)
                .unwrap_or("subjective");
            let core = q.get("is_core").and_then(Value::as_bool).unwrap_or(false);
            stmt.execute(params![
                id,
                q.get("stem").and_then(Value::as_str).unwrap_or(""),
                options.to_string(),
                q.get("correct_answer")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
                q.get("answer_explanation")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
                source,
                qtype,
                q.get("category_full_path")
                    .and_then(Value::as_str)
                    .unwrap_or("未分类"),
                serde_json::to_string(&image_paths).unwrap_or_else(|_| "[]".into()),
                i32::from(core),
                infer_difficulty(source, core, qtype),
                q.get("content_hash").and_then(Value::as_str).unwrap_or("")
            ])
            .map_err(|e| e.to_string())?;
            inserted += 1;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    import_category_metadata(conn, library)?;
    Ok(inserted)
}

fn row_to_question(row: &rusqlite::Row<'_>) -> rusqlite::Result<Question> {
    let options_json: String = row.get(2)?;
    let images_json: String = row.get(8)?;
    Ok(Question {
        id: row.get(0)?,
        stem: row.get(1)?,
        options: serde_json::from_str(&options_json).unwrap_or_default(),
        correct_answer: row.get(3)?,
        explanation: row.get(4)?,
        source: row.get(5)?,
        question_type: row.get(6)?,
        category_path: row.get(7)?,
        image_paths: serde_json::from_str(&images_json).unwrap_or_default(),
        is_core: row.get::<_, i32>(9)? != 0,
        difficulty: row.get(10)?,
        favorite: row.get::<_, i32>(11)? != 0,
        attempts: row.get(12)?,
        accuracy: row.get(13)?,
        mastery: row.get(14)?,
        next_review: row.get(15)?,
        note: row.get(16)?,
    })
}

const QUESTION_SELECT: &str = "SELECT q.id,q.stem,q.options_json,q.correct_answer,q.explanation,q.source,q.question_type,q.category_path,q.image_paths_json,q.is_core,q.difficulty,COALESCE(p.favorite,0),COUNT(a.id),AVG(CASE WHEN COALESCE(a.outcome,a.result)='uncertain' THEN NULL WHEN COALESCE(a.outcome,a.result)='correct' THEN 1.0 ELSE 0.0 END),p.mastery,p.next_review,p.note FROM questions q LEFT JOIN progress p ON p.question_id=q.id LEFT JOIN attempts a ON a.question_id=q.id";

fn question_by_id(conn: &Connection, id: i64) -> Result<Question, String> {
    conn.query_row(
        &format!("{QUESTION_SELECT} WHERE q.id=?1 GROUP BY q.id"),
        [id],
        row_to_question,
    )
    .map_err(|e| e.to_string())
}

fn recommendation_batch_title(summary: &str) -> String {
    let title: String = summary.chars().take(42).collect();
    if title.trim().is_empty() {
        "Codex 推荐题组".into()
    } else {
        title
    }
}

/// 回填历史 AI 题组的角色标签。
///
/// `role` 列是后来加的，早先导入的题组（包括正在做的那批）items 上 role 为 NULL。
/// 角色原本只存在于 `codex_inbox.payload_json` 里，这里把它搬到 items 上，
/// 老题组不用重新推送就能显示标签。
fn backfill_recommendation_item_roles(conn: &Connection) -> Result<(), String> {
    let task_ids: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT task_id FROM recommendation_batch_items
                 WHERE role IS NULL OR role=''",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    for task_id in task_ids {
        let raw: Option<String> = conn
            .query_row(
                "SELECT payload_json FROM codex_inbox WHERE task_id=?1 ORDER BY id DESC LIMIT 1",
                [task_id.as_str()],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .flatten();
        let Some(raw) = raw else { continue };
        let Ok(payload) = serde_json::from_str::<CodexPayload>(&raw) else {
            continue;
        };
        for (question_id, role) in &payload.question_roles {
            let Ok(parsed) = question_id.parse::<i64>() else {
                continue;
            };
            conn.execute(
                "UPDATE recommendation_batch_items SET role=?1
                 WHERE task_id=?2 AND question_id=?3 AND (role IS NULL OR role='')",
                params![role, task_id, parsed],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn create_recommendation_batch(conn: &Connection, payload: &CodexPayload) -> Result<(), String> {
    if payload.recommended_question_ids.is_empty() {
        return Err("推荐题组没有有效题目".into());
    }

    if let Some(minutes) = payload.estimated_minutes {
        if !(5..=240).contains(&minutes) {
            return Err("AI 推荐题组预计时间超出 5-240 分钟范围".into());
        }
    }
    let requested_order = if payload.recommendation_order.is_empty() {
        &payload.recommended_question_ids
    } else {
        &payload.recommendation_order
    };
    let mut question_ids = Vec::new();
    let mut seen = HashSet::new();
    for question_id in requested_order {
        if !seen.insert(*question_id) {
            continue;
        }
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM questions WHERE id=?1",
                [question_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Err(format!("推荐题号不存在: {question_id}"));
        }
        let candidate_count: i64 = conn.query_row("SELECT COUNT(*) FROM learning_task_candidates WHERE task_id=?1", [payload.task_id.as_str()], |row| row.get(0)).unwrap_or(0);
        if candidate_count > 0 {
            let allowed: i64 = conn.query_row("SELECT COUNT(*) FROM learning_task_candidates WHERE task_id=?1 AND question_id=?2", params![payload.task_id, question_id], |row| row.get(0)).unwrap_or(0);
            if allowed == 0 {
                return Err(format!("AI 推荐题号 {question_id} 不在本次候选题上下文中"));
            }
        }
        question_ids.push(*question_id);
    }
    if question_ids.is_empty() {
        return Err("推荐题组没有可用题目".into());
    }
    if question_ids.len() > 30 {
        return Err("AI 推荐题组最多 30 道题".into());
    }
    let excluded: HashSet<i64> = payload.excluded_question_ids.iter().copied().collect();
    if question_ids.iter().any(|id| excluded.contains(id)) {
        return Err("推荐题组同时包含 excludedQuestionIds 中的题目".into());
    }
    for (question_id, role) in &payload.question_roles {
        let parsed = question_id.parse::<i64>().map_err(|_| format!("questionRoles 包含无效题号：{question_id}"))?;
        if !question_ids.contains(&parsed) {
            return Err(format!("questionRoles 包含不在题组中的题号：{parsed}"));
        }
        if !matches!(role.as_str(), "diagnosis" | "method_choice" | "consolidate" | "integration" | "transfer" | "timed" | "challenge" | "review") {
            return Err(format!("题目 {parsed} 的角色无效：{role}"));
        }
    }
    for coverage in &payload.coverage {
        if let Some(ids) = coverage.get("questionIds").and_then(Value::as_array) {
            for id in ids.iter().filter_map(Value::as_i64) {
                if !question_ids.contains(&id) {
                    return Err(format!("coverage 引用了不在题组中的题号：{id}"));
                }
            }
        }
    }

    let inserted = conn
        .execute(
            "INSERT OR IGNORE INTO recommendation_batches(task_id,title,summary,recommendation_reason,status,created_at) VALUES(?1,?2,?3,?4,'pending',?5)",
            params![
                payload.task_id,
                recommendation_batch_title(payload.goal.as_deref().unwrap_or(&payload.summary)),
                payload.summary,
                payload.recommendation_reason.as_deref().unwrap_or(&payload.summary),
                Local::now().to_rfc3339(),
            ],
        )
        .map_err(|e| e.to_string())?;
    if inserted == 0 {
        return Ok(());
    }

    for (position, question_id) in question_ids.iter().enumerate() {
        let role = payload.question_roles.get(&question_id.to_string()).cloned();
        conn.execute(
            "INSERT INTO recommendation_batch_items(task_id,question_id,position,role) VALUES(?1,?2,?3,?4)",
            params![payload.task_id, question_id, position as i64, role],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn recommendation_batch_by_task(
    conn: &Connection,
    task_id: &str,
) -> Result<Option<RecommendationBatch>, String> {
    conn.query_row(
        "SELECT b.task_id,b.title,b.summary,b.recommendation_reason,b.status,b.created_at,
                b.result_context_path,b.result_exported_at,
                COUNT(i.question_id),COALESCE(SUM(CASE WHEN i.completed_at IS NOT NULL THEN 1 ELSE 0 END),0)
         FROM recommendation_batches b
         LEFT JOIN recommendation_batch_items i ON i.task_id=b.task_id
         WHERE b.task_id=?1
         GROUP BY b.task_id,b.title,b.summary,b.recommendation_reason,b.status,b.created_at",
        [task_id],
        |row| {
            let total_count: i64 = row.get(8)?;
            let completed_count: i64 = row.get(9)?;
            Ok(RecommendationBatch {
                task_id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                recommendation_reason: row.get(3)?,
                status: row.get(4)?,
                created_at: row.get(5)?,
                result_context_path: row.get(6)?,
                result_exported_at: row.get(7)?,
                total_count,
                completed_count,
                remaining_count: total_count - completed_count,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn active_recommendation_queue(
    conn: &Connection,
) -> Result<Option<Vec<RecommendedQuestion>>, String> {
    let task_id: Option<String> = conn
        .query_row(
            "SELECT task_id FROM recommendation_batches WHERE status='active' ORDER BY started_at DESC,created_at DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(task_id) = task_id else {
        return Ok(None);
    };
    let batch = recommendation_batch_by_task(conn, &task_id)?.ok_or("找不到活动 AI 题组")?;
    let sql = format!(
        "{QUESTION_SELECT} JOIN recommendation_batch_items rbi ON rbi.question_id=q.id WHERE rbi.task_id=?1 AND rbi.completed_at IS NULL GROUP BY q.id,rbi.position ORDER BY rbi.position"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([task_id], row_to_question)
        .map_err(|e| e.to_string())?;
    let questions = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    if questions.is_empty() {
        conn.execute(
            "UPDATE recommendation_batches SET status='completed',completed_at=?1 WHERE task_id=?2",
            params![Local::now().to_rfc3339(), batch.task_id],
        )
        .map_err(|e| e.to_string())?;
        return Ok(None);
    }
    // AI 题组的每道题带一个角色标签（诊断 / 巩固 / 攻坚 …），做题时直接显示在题号旁，
    // 让用户一眼知道这道题该怎么对待。角色只在该题被编入 AI 题组时才有值。
    let mut role_map: HashMap<i64, String> = HashMap::new();
    {
        let mut role_stmt = conn
            .prepare(
                "SELECT question_id, role FROM recommendation_batch_items
                 WHERE task_id=?1 AND role IS NOT NULL AND role<>''",
            )
            .map_err(|e| e.to_string())?;
        let role_rows = role_stmt
            .query_map([batch.task_id.as_str()], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        for entry in role_rows {
            let (qid, role) = entry.map_err(|e| e.to_string())?;
            role_map.insert(qid, role);
        }
    }
    Ok(Some(
        questions
            .into_iter()
            .enumerate()
            .map(|(position, question)| {
                let question_role = role_map.get(&question.id).cloned();
                RecommendedQuestion {
                    question,
                    score: 120.0 - position as f64,
                    reason: batch.recommendation_reason.clone(),
                    reason_code: "codex".into(),
                    question_role,
                }
            })
            .collect(),
    ))
}

/// 考研数学一各科分值占比（高等数学 56% / 线性代数 22% / 概率统计 22%）。
///
/// 用于按「覆盖缺口」加权出题：覆盖度越低于其分值权重的科目，抽中概率越高。
///
/// 背景（v1.6.8）：实测题库 5388 题中，高等数学已做 194 题、线性代数仅 14 题、
/// 概率统计 **0 题**——而概率在数一中约占 33 分。原打分函数完全没有科目维度，
/// 新题靠 `ORDER BY RANDOM()` 抽取，这类结构性失衡不会被自动纠正，只会被固化。
/// "历年真题"不在此列：它是三科混合，单独加权会重复计入。
const SUBJECT_EXAM_WEIGHTS: [(&str, f64); 3] = [
    ("高等数学", 0.56),
    ("线性代数", 0.22),
    ("概率统计", 0.22),
];

/// 缺口权重放大系数。缺口 0.22（概率当前状态）约产生 +9.9 分——足以让完全未触达的
/// 科目稳定进入今日队列，又不足以霸占队列：到期复习题的 due_score 为 28、
/// 昨日错题变式为 160，优先级都高于它。
const SUBJECT_GAP_WEIGHT: f64 = 45.0;

/// 取 category_path 的一级科目名，如 "高等数学 / 一元微分 / ..." → "高等数学"。
fn subject_of(category_path: &str) -> &str {
    category_path.split('/').next().unwrap_or("").trim()
}

/// 计算各科覆盖缺口：`max(0, 考研分值占比 − 该科在已做题目中的占比)`。
///
/// 只奖励缺口、不惩罚超额（`max(0, ..)`），避免高数这类题量本就最大的科目被过度压制。
/// 随着薄弱科目被逐步覆盖，缺口自动收敛、权重自然回落，无需人工干预。
fn subject_gap_scores(conn: &Connection) -> Result<HashMap<String, f64>, String> {
    let mut attempted: HashMap<String, f64> = HashMap::new();
    let mut total_attempted = 0.0_f64;
    let mut stmt = conn
        .prepare(
            "SELECT q.category_path, COUNT(*) FROM attempts a
             JOIN questions q ON q.id = a.question_id
             GROUP BY q.category_path",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (path, count) = row.map_err(|e| e.to_string())?;
        *attempted
            .entry(subject_of(&path).to_string())
            .or_insert(0.0) += count as f64;
        total_attempted += count as f64;
    }
    drop(stmt);

    let mut gaps = HashMap::new();
    for (subject, exam_weight) in SUBJECT_EXAM_WEIGHTS {
        let share = if total_attempted > 0.0 {
            attempted.get(subject).copied().unwrap_or(0.0) / total_attempted
        } else {
            // 冷启动：没有任何作答时按分值占比直接铺开，天然均衡
            0.0
        };
        gaps.insert(subject.to_string(), (exam_weight - share).max(0.0));
    }
    Ok(gaps)
}

fn recommendations(conn: &Connection, limit: usize) -> Result<Vec<RecommendedQuestion>, String> {
    if let Some(queue) = active_recommendation_queue(conn)? {
        return Ok(queue);
    }
    let today = Local::now().date_naive().to_string();
    // Due questions must never be skipped by the random candidate draw: pull all
    // of them unconditionally, then top up the rest with random not-yet-done ones.
    let mut stmt = conn.prepare(&format!("{QUESTION_SELECT} WHERE p.next_review<=?1 AND NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=q.id AND substr(at.attempted_at,1,10)=?1) GROUP BY q.id")).map_err(|e| e.to_string())?;
    let due_rows = stmt
        .query_map([&today], row_to_question)
        .map_err(|e| e.to_string())?;
    let mut candidates: Vec<Question> = due_rows
        .map(|q| q.map_err(|e| e.to_string()))
        .collect::<Result<_, _>>()?;
    drop(stmt);
    let remaining = limit + 220usize.max(limit * 10);
    let mut seen: HashSet<i64> = candidates.iter().map(|q| q.id).collect();
    stmt = conn.prepare(&format!("{QUESTION_SELECT} WHERE (p.next_review IS NULL OR p.next_review>?1) AND NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=q.id AND substr(at.attempted_at,1,10)=?1) GROUP BY q.id ORDER BY RANDOM() LIMIT ?2")).map_err(|e| e.to_string())?;
    let random_rows = stmt
        .query_map(params![today, remaining as i64], row_to_question)
        .map_err(|e| e.to_string())?;
    for item in random_rows {
        let q = item.map_err(|e| e.to_string())?;
        if seen.insert(q.id) {
            candidates.push(q);
            if candidates.len() >= remaining {
                break;
            }
        }
    }
    let diagnosis_paths = accepted_diagnosis_paths(conn)?;
    let subject_gaps = subject_gap_scores(conn)?;
    let mut scored = Vec::new();
    for q in candidates {
        let due = q
            .next_review
            .as_deref()
            .map(|d| d <= Local::now().date_naive().to_string().as_str())
            .unwrap_or(false);
        let weakness = q.accuracy.map(|a| (1.0 - a) * 32.0).unwrap_or(12.0);
        let mastery_gap = q
            .mastery
            .map(|m| (4 - m).max(0) as f64 * 6.0)
            .unwrap_or(8.0);
        let exploration = if q.attempts == 0 { 17.0 } else { 5.0 };
        let due_score = if due { 28.0 } else { 0.0 };
        let difficulty_fit = if q.difficulty == 2 { 10.0 } else { 6.0 };
        let diagnosis_score = diagnosis_paths
            .iter()
            .map(|path| diagnosis_match_score(path, &q.category_path))
            .fold(0.0_f64, f64::max);
        // 科目缺口加权：该科在考研中占分越高、而你练得越少，这道题越该出现。
        let subject_gap_score = subject_gaps
            .get(subject_of(&q.category_path))
            .copied()
            .unwrap_or(0.0)
            * SUBJECT_GAP_WEIGHT;
        let score = due_score
            + weakness
            + mastery_gap
            + exploration
            + difficulty_fit
            + diagnosis_score
            + subject_gap_score
            + rand::rng().random_range(0.0..6.0);
        let (reason, code) = if due {
            ("到了该回看的时间，先把记忆接上", "due")
        } else if diagnosis_score > 0.0 {
            ("针对 Codex 已确认的薄弱板块安排", "diagnosis")
        } else if q.attempts > 0 && q.accuracy.unwrap_or(1.0) < 0.65 {
            ("命中你近期不稳定的题型", "weakness")
        } else if q.attempts == 0 && subject_gap_score > 6.0 {
            ("这门课在考研里占比不低，但你的覆盖还很低", "subject_gap")
        } else if q.attempts == 0 {
            ("补齐尚未触达的数一范围", "explore")
        } else {
            ("难度与当前训练节奏匹配", "fit")
        };
        scored.push(RecommendedQuestion {
            question: q,
            score,
            reason: reason.into(),
            reason_code: code.into(),
            question_role: None,
        });
    }

    // Check if there was a wrong attempt yesterday to insert a retest variant question
    let yesterday = (Local::now().date_naive() - chrono::Duration::days(1)).to_string();
    let yesterday_wrong_q: Option<i64> = conn
        .query_row(
            "SELECT question_id FROM attempts WHERE result='wrong' AND substr(attempted_at,1,10)=?1 ORDER BY id DESC LIMIT 1",
            [&yesterday],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(wrong_id) = yesterday_wrong_q {
        if let Ok(variants) = variant_queue(conn, wrong_id, 1) {
            if let Some(mut var_item) = variants.into_iter().next() {
                let var_id = var_item.question.id;
                var_item.score = 160.0;
                var_item.reason_code = "yesterday_wrong".into();
                var_item.reason = "昨日错题同考点变式重测".into();
                scored.retain(|item| item.question.id != var_id);
                scored.push(var_item);
            }
        }
    }

    scored.sort_by(|a, b| b.score.total_cmp(&a.score));
    scored.truncate(limit);
    Ok(scored)
}

fn accepted_diagnosis_paths(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT q.category_path FROM codex_analysis_signals s JOIN questions q ON q.id=s.question_id ORDER BY s.confirmed_at DESC LIMIT 5",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

fn diagnosis_match_score(signal_path: &str, candidate_path: &str) -> f64 {
    let shared_depth = signal_path
        .split(" / ")
        .zip(candidate_path.split(" / "))
        .take_while(|(left, right)| left == right)
        .count();
    match shared_depth {
        4.. => 30.0,
        3 => 21.0,
        2 => 12.0,
        1 => 4.0,
        _ => 0.0,
    }
}

#[derive(Debug, Clone)]
struct BoundAttemptContext {
    attempt_id: i64,
    self_rating: i32,
    mode: String,
    occurred_at: String,
}

/// Add a task-time association exactly once. A task context is immutable evidence of
/// which attempt (if any) Codex was asked to review; response-time code must never
/// substitute a newer retry by question id.
fn insert_codex_task_context(
    conn: &Connection,
    task_id: &str,
    question_id: i64,
    attempt_id: Option<i64>,
    task_kind: &str,
    requested_at: &str,
    source_mode: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO codex_task_context(task_id,question_id,attempt_id,task_kind,requested_at,source_mode)
         VALUES(?1,?2,?3,?4,?5,?6)",
        params![
            task_id,
            question_id,
            attempt_id,
            task_kind,
            requested_at,
            source_mode
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn task_context_attempt_id(
    conn: &Connection,
    task_id: &str,
    question_id: i64,
) -> Result<Option<i64>, String> {
    // No context means legacy / unprovable provenance. It must remain unbound rather
    // than guessing from the current latest attempt.
    conn.query_row(
        "SELECT attempt_id FROM codex_task_context WHERE task_id=?1 AND question_id=?2",
        params![task_id, question_id],
        |row| row.get(0),
    )
    .optional()
    .map(|row| row.flatten())
    .map_err(|e| e.to_string())
}

fn latest_attempt_binding(
    conn: &Connection,
    question_id: i64,
) -> Result<Option<(i64, String)>, String> {
    conn.query_row(
        "SELECT id,mode FROM attempts WHERE question_id=?1 ORDER BY attempted_at DESC,id DESC LIMIT 1",
        [question_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn resolve_analysis_attempt_id(
    conn: &Connection,
    payload: &CodexPayload,
) -> Result<Option<i64>, String> {
    let Some(question_id) = payload.question_id else {
        return Ok(None);
    };
    task_context_attempt_id(conn, &payload.task_id, question_id)
}

fn bound_attempt_context(
    conn: &Connection,
    attempt_id: i64,
) -> Result<Option<BoundAttemptContext>, String> {
    conn.query_row(
        "SELECT COALESCE(fluency_rating,self_rating),mode,attempted_at FROM attempts WHERE id=?1",
        [attempt_id],
        |row| {
            Ok(BoundAttemptContext {
                attempt_id,
                self_rating: row.get(0)?,
                mode: row.get(1)?,
                occurred_at: row.get(2)?,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

/// Writes the source-of-truth analysis sidecar into the caller's transaction.
/// `codex_analysis_signals`, diagnosis/review-task state and immutable raw evidence
/// are one all-or-nothing unit.  Projection is deliberately deferred: a later retry
/// may set `projection_applied=1`, but cannot erase or split the raw audit trail.
fn save_analysis_signal_raw(
    conn: &Connection,
    payload: &CodexPayload,
    attempt_id: Option<i64>,
) -> Result<(), String> {
    let Some(question_id) = payload.question_id else {
        return Ok(());
    };
    let bound_context = match attempt_id {
        Some(id) => bound_attempt_context(conn, id)?,
        None => None,
    };
    let bound_attempt_id = bound_context.as_ref().map(|context| context.attempt_id);
    // This schema has no structured variant/review relation yet.  Never infer either
    // lifecycle proof from a mode string or a stale historical task.
    let is_variant = false;
    let is_delayed_review = false;

    conn.execute(
        "INSERT OR REPLACE INTO codex_analysis_signals(task_id,question_id,error_tags_json,weakness_tags_json,confidence,confirmed_at) VALUES(?1,?2,?3,?4,?5,?6)",
        params![
            payload.task_id,
            question_id,
            serde_json::to_string(&payload.error_tags).map_err(|e| e.to_string())?,
            serde_json::to_string(&payload.weakness_tags).map_err(|e| e.to_string())?,
            payload.confidence.clamp(0.0, 1.0),
            Local::now().to_rfc3339(),
        ],
    )
    .map_err(|e| e.to_string())?;
    let category_key = conn
        .query_row(
            "SELECT category_path FROM questions WHERE id=?1",
            [question_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "未分类".into());
    let diagnosis = services::learning::DiagnosisInput {
        task_id: payload.task_id.clone(),
        question_id,
        attempt_id: bound_attempt_id,
        category_key,
        verdict: payload.verdict.clone(),
        error_tags: payload.error_tags.clone(),
        weakness_tags: payload.weakness_tags.clone(),
        earliest_error: payload.earliest_error.clone(),
        confidence: payload.confidence,
        is_variant,
        is_delayed_review,
        created_at: Local::now().to_rfc3339(),
    };
    services::learning::upsert_diagnosis(conn, diagnosis.clone()).map_err(|e| e.to_string())?;
    if let Some(context) = bound_context {
        services::learning::record_codex_adjudication_raw(
            conn,
            services::learning::CodexAdjudicationInput {
                diagnosis,
                self_rating: context.self_rating,
                mode: context.mode,
                occurred_at: context.occurred_at,
            },
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn retry_learning_projections_best_effort(conn: &Connection) {
    if let Err(error) = services::learning::retry_pending_projections(conn) {
        // Source facts have already committed.  This is intentionally not promoted
        // to a confirmation failure: retry on later startup/confirmation is safe.
        eprintln!("learning projection retry deferred: {error}");
    }
}

fn save_analysis_signal(
    conn: &Connection,
    payload: &CodexPayload,
    attempt_id: Option<i64>,
) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    save_analysis_signal_raw(&tx, payload, attempt_id)?;
    tx.commit().map_err(|e| e.to_string())?;
    retry_learning_projections_best_effort(conn);
    Ok(())
}

fn apply_analysis_payload_sidecar(conn: &Connection, payload: &CodexPayload) -> Result<(), String> {
    let attempt_id = resolve_analysis_attempt_id(conn, payload)?;
    save_analysis_signal(conn, payload, attempt_id)
}

fn record_backfill_failure(
    conn: &Connection,
    inbox_id: i64,
    task_id: &str,
    stage: &str,
    error: &str,
) {
    let now = Local::now().to_rfc3339();
    if let Err(audit_error) = conn.execute(
        "INSERT INTO codex_backfill_failures(inbox_id,task_id,stage,error,attempts,last_failed_at,resolved,resolved_at)
         VALUES(?1,?2,?3,?4,1,?5,0,NULL)
         ON CONFLICT(inbox_id) DO UPDATE SET task_id=excluded.task_id,stage=excluded.stage,error=excluded.error,
           attempts=codex_backfill_failures.attempts+1,last_failed_at=excluded.last_failed_at,resolved=0,resolved_at=NULL",
        params![inbox_id, task_id, stage, error, now],
    ) {
        eprintln!("cannot audit Codex backfill failure for inbox {inbox_id}: {audit_error}");
    }
}

fn resolve_backfill_failure(conn: &Connection, inbox_id: i64) {
    if let Err(error) = conn.execute(
        "UPDATE codex_backfill_failures SET resolved=1,resolved_at=?1 WHERE inbox_id=?2 AND resolved=0",
        params![Local::now().to_rfc3339(), inbox_id],
    ) {
        eprintln!("cannot resolve Codex backfill audit for inbox {inbox_id}: {error}");
    }
}

fn backfill_confirmed_analysis_signals(conn: &Connection) -> Result<(), String> {
    // A projection fault is intentionally isolated from replay.  It must not make
    // startup fail or suppress diagnosis recovery for the next inbox record.
    retry_learning_projections_best_effort(conn);
    let mut stmt = conn
        .prepare(
            "SELECT id,task_id,payload_json FROM codex_inbox
             WHERE kind='analysis' AND status='confirmed' ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);
    for (inbox_id, task_id, raw) in rows {
        let payload = match serde_json::from_str::<CodexPayload>(&raw) {
            Ok(payload) => payload,
            Err(error) => {
                record_backfill_failure(conn, inbox_id, &task_id, "parse_payload", &error.to_string());
                continue;
            }
        };
        match apply_analysis_payload_sidecar(conn, &payload) {
            Ok(()) => resolve_backfill_failure(conn, inbox_id),
            Err(error) => record_backfill_failure(conn, inbox_id, &task_id, "apply_sidecar", &error),
        }
    }
    Ok(())
}

fn scan_inbox(state: &AppState) -> Result<(), String> {
    let inbox = state.data_dir.join("codex-inbox");
    let processed = inbox.join("processed");
    let failed = inbox.join("failed");
    fs::create_dir_all(&processed).map_err(|e| e.to_string())?;
    fs::create_dir_all(&failed).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(&inbox).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if !path.is_file() || path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let raw = match fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(error) => {
                let _ = fs::rename(&path, failed.join(path.file_name().unwrap_or_default()));
                log::warn!("无法读取 Codex 回传 {}: {error}", path.display());
                continue;
            }
        };
        let payload = match serde_json::from_str::<CodexPayload>(&raw) {
            Ok(payload) => payload,
            Err(error) => {
                log::warn!("无法解析 Codex 回传 {}: {error}", path.display());
                let dest = failed.join(path.file_name().unwrap_or_default());
                let _ = fs::rename(&path, dest);
                continue;
            }
        };
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let saved = insert_codex_payload(&conn, &payload);
        drop(conn);
        if saved.is_ok() {
            let dest = processed.join(path.file_name().unwrap_or_default());
            let _ = fs::rename(&path, dest);
        } else if let Err(error) = saved {
            log::warn!("无法导入 Codex 回传 {}: {error}", path.display());
        }
    }
    Ok(())
}

fn inbox_failed_count(state: &AppState) -> i64 {
    let dir = state.data_dir.join("codex-inbox").join("failed");
    fs::read_dir(&dir)
        .map(|it| {
            it.filter_map(Result::ok)
                .filter(|entry| entry.path().extension().and_then(|e| e.to_str()) == Some("json"))
                .count() as i64
        })
        .unwrap_or(0)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FailedInboxItem {
    file_name: String,
    error: String,
}

#[tauri::command]
fn get_failed_inbox(state: State<AppState>) -> Result<Vec<FailedInboxItem>, String> {
    let dir = state.data_dir.join("codex-inbox").join("failed");
    let mut items = Vec::new();
    if let Ok(reader) = fs::read_dir(&dir) {
        for entry in reader.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let file_name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            let error = fs::read_to_string(&path)
                .ok()
                .and_then(|raw| serde_json::from_str::<Value>(&raw).err())
                .map(|e| e.to_string())
                .unwrap_or_else(|| "JSON 格式或字段不完整".into());
            items.push(FailedInboxItem { file_name, error });
        }
    }
    items.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    Ok(items)
}

/// Codex batch feedback is untrusted until result and verdict agree.  A pressure
/// batch is allowed to create formal attempts/ELO, so this check must run before
/// opening its write transaction; normal batches use the same gate to avoid
/// persisting misleading diagnoses or review evidence.
fn validate_batch_attempt_result_verdict(attempt: &BatchAttempt) -> Result<(), String> {
    let result = attempt.result.as_str();
    let verdict = attempt.verdict.as_deref().ok_or_else(|| {
        format!(
            "题号 {} 的 result/verdict 不可信：缺少 verdict",
            attempt.question_id
        )
    })?;

    if !matches!(verdict, "correct" | "partial" | "incorrect" | "uncertain") {
        return Err(format!(
            "题号 {} 的 result/verdict 不可信：verdict `{verdict}` 不在允许枚举中",
            attempt.question_id
        ));
    }

    let consistent = matches!(
        (result, verdict),
        ("uncertain", "uncertain")
            | ("correct", "correct" | "partial")
            | ("wrong", "partial" | "incorrect")
    );
    if !consistent {
        return Err(format!(
            "题号 {} 的 result/verdict 不可信：result `{result}` 与 verdict `{verdict}` 冲突或 result 未知",
            attempt.question_id
        ));
    }

    Ok(())
}

fn insert_codex_payload(conn: &Connection, payload: &CodexPayload) -> Result<(), String> {
    if !matches!(
        payload.kind.as_str(),
        "analysis" | "recommendation" | "paper" | "batch"
    ) {
        return Err("不支持的 Codex 回传类型".into());
    }
    if payload.kind == "paper" {
        if payload.paper_attempts.is_empty() {
            return Err("套卷回传缺少题目结果".into());
        }
        for attempt in &payload.paper_attempts {
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM questions WHERE id=?1",
                    [attempt.question_id],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            if exists == 0 {
                return Err(format!("套卷包含未知题号 {}", attempt.question_id));
            }
            if !matches!(attempt.result.as_str(), "correct" | "wrong") {
                return Err(format!("题号 {} 的作答结果无效", attempt.question_id));
            }
        }
    }
    if payload.kind == "batch" {
        if payload.batch_attempts.is_empty() {
            return Err("整组回传缺少题目结果".into());
        }
        for attempt in &payload.batch_attempts {
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM questions WHERE id=?1",
                    [attempt.question_id],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            if exists == 0 {
                return Err(format!("整组回传包含未知题号 {}", attempt.question_id));
            }
            validate_batch_attempt_result_verdict(attempt)?;
            if !(1..=4).contains(&attempt.self_rating) {
                return Err(format!("题号 {} 的自评等级无效", attempt.question_id));
            }
            if let Some(rating) = attempt.rating {
                if !(AI_RATING_MIN..=AI_RATING_MAX).contains(&rating) {
                    return Err(format!(
                        "题号 {} 的 CS rating 必须在 0.00–2.00",
                        attempt.question_id
                    ));
                }
            }
            if let Some(multiplier) = attempt.difficulty_multiplier {
                if !(0.5..=1.5).contains(&multiplier) {
                    return Err(format!(
                        "题号 {} 的 difficultyMultiplier 超出合理范围",
                        attempt.question_id
                    ));
                }
            }
            for (key, dimension) in &attempt.dimensions {
                if let Some(score) = dimension.score {
                    if !(0.0..=100.0).contains(&score) {
                        return Err(format!(
                            "题号 {} 的维度 {} 分数无效",
                            attempt.question_id, key
                        ));
                    }
                }
                if !(0.0..=1.0).contains(&dimension.confidence) {
                    return Err(format!(
                        "题号 {} 的维度 {} 置信度无效",
                        attempt.question_id, key
                    ));
                }
            }
        }
    }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR IGNORE INTO codex_inbox(task_id,kind,question_id,payload_json,status,created_at) VALUES(?1,?2,?3,?4,'pending',?5)",
        params![payload.task_id,payload.kind,payload.question_id,serde_json::to_string(payload).map_err(|e|e.to_string())?,Local::now().to_rfc3339()],
    ).map_err(|e| e.to_string())?;
    if payload.kind == "recommendation" {
        create_recommendation_batch(&tx, payload)?;
        clear_recommendation_overrides(&tx, &payload.task_id)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn resolved_batch_duration(
    attempt: &BatchAttempt,
    pressure_durations: Option<&HashMap<i64, i64>>,
) -> i64 {
    let duration = if attempt.duration_seconds > 0 {
        attempt.duration_seconds
    } else {
        pressure_durations
            .and_then(|durations| durations.get(&attempt.question_id).copied())
            .unwrap_or(30)
    };
    duration.clamp(1, 1800)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BatchApplicationMode {
    /// Pressure batches have no pre-recorded normal attempts, so a confirmed batch is
    /// still the authoritative source for formal attempts/progress/ELO settlement.
    FormalPressureAttempt,
    /// Normal training already wrote its attempts. Codex can only append a sidecar
    /// diagnosis/adjudication for a task-time-bound attempt.
    BoundNonPressureAdjudication,
}

fn task_has_kind(conn: &Connection, task_id: &str, task_kind: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT 1 FROM codex_task_context WHERE task_id=?1 AND task_kind=?2 LIMIT 1",
        params![task_id, task_kind],
        |_| Ok(()),
    )
    .optional()
    .map(|row| row.is_some())
    .map_err(|e| e.to_string())
}

fn apply_batch_payload(
    conn: &Connection,
    payload: &CodexPayload,
    pressure_durations: Option<&HashMap<i64, i64>>,
    application_mode: BatchApplicationMode,
) -> Result<(), String> {
    // Validate before the outer transaction and before any idempotency marker: one
    // untrusted batch item rejects the entire formal settlement.
    for attempt in &payload.batch_attempts {
        validate_batch_attempt_result_verdict(attempt)?;
    }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    apply_batch_payload_in_tx(&tx, payload, pressure_durations, application_mode)?;
    tx.commit().map_err(|e| e.to_string())?;
    retry_learning_projections_best_effort(conn);
    Ok(())
}

fn apply_batch_payload_in_tx(
    conn: &Connection,
    payload: &CodexPayload,
    pressure_durations: Option<&HashMap<i64, i64>>,
    application_mode: BatchApplicationMode,
) -> Result<(), String> {
    for attempt in &payload.batch_attempts {
        // The application marker and all writes for one batch live in the same
        // main-database transaction. If confirmation is retried after a crash,
        // the sidecar verdict or the pressure attempt cannot be applied twice.
        let inserted = conn
            .execute(
                "INSERT OR IGNORE INTO codex_batch_applications(task_id,question_id,applied_at) VALUES(?1,?2,?3)",
                params![
                    &payload.task_id,
                    attempt.question_id,
                    Local::now().to_rfc3339()
                ],
            )
            .map_err(|e| e.to_string())?;
        if inserted == 0 {
            continue;
        }

        // Every returned question keeps a diagnosis signal, including uncertain
        // results. An unbound normal question remains diagnosis-only; it must not
        // attach itself to an older same-question attempt.
        let signal = CodexPayload {
            schema_version: 1,
            kind: "analysis".into(),
            task_id: format!("{}-{}", payload.task_id, attempt.question_id),
            question_id: Some(attempt.question_id),
            summary: attempt.summary.clone(),
            verdict: attempt.verdict.clone(),
            earliest_error: attempt.earliest_error.clone(),
            error_tags: attempt.error_tags.clone(),
            weakness_tags: attempt.weakness_tags.clone(),
            advice: attempt.advice.clone(),
            better_solution: attempt.better_solution.clone(),
            confidence: attempt.confidence,
            recommended_question_ids: vec![],
            recommendation_reason: None,
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![],
            rating: attempt.rating,
            rating_tier: attempt.rating_tier.clone(),
            difficulty_multiplier: attempt.difficulty_multiplier,
            dimensions: attempt.dimensions.clone(),
            ..Default::default()
        };

        match application_mode {
            BatchApplicationMode::BoundNonPressureAdjudication => {
                let attempt_id =
                    task_context_attempt_id(conn, &payload.task_id, attempt.question_id)?;
                if let Some(existing_attempt_id) = attempt_id {
                    save_analysis_signal_raw(conn, &signal, Some(existing_attempt_id))?;
                    complete_active_recommendation_item(conn, attempt.question_id, existing_attempt_id)?;
                } else if attempt.result != "uncertain" {
                    let new_attempt_id = record_attempt_row(
                        conn,
                        &AttemptInput {
                            question_id: attempt.question_id,
                            duration_seconds: resolved_batch_duration(attempt, pressure_durations),
                            result: attempt.result.clone(),
                            self_rating: attempt.self_rating,
                            selected_answer: None,
                            mode: Some("paper-codex".into()),
                            outcome: Some(
                                attempt
                                    .verdict
                                    .clone()
                                    .unwrap_or_else(|| attempt.result.clone()),
                            ),
                            evidence_source: Some("codex".into()),
                            fluency_rating: Some(attempt.self_rating),
                            confidence: Some(attempt.confidence),
                            session_id: Some(payload.task_id.clone()),
                            diagnosis_id: Some(format!("{}-{}", payload.task_id, attempt.question_id)),
                            ai_rating: attempt.rating,
                            difficulty_multiplier: attempt.difficulty_multiplier,
                            technique_level: attempt
                                .dimensions
                                .get("strategyInsight")
                                .and_then(|d| d.technique_level),
                            dimensions: Some(AttemptDimensions::from_dimension_map(
                                &attempt.dimensions,
                            )),
                        },
                    )?;
                    save_analysis_signal_raw(conn, &signal, Some(new_attempt_id))?;
                } else {
                    save_analysis_signal_raw(conn, &signal, None)?;
                    complete_active_recommendation_item(conn, attempt.question_id, 0)?;
                }
            }
            BatchApplicationMode::FormalPressureAttempt => {
                if attempt.result == "uncertain" {
                    save_analysis_signal_raw(conn, &signal, None)?;
                    continue;
                }
                let attempt_id = record_attempt_row(
                    conn,
                    &AttemptInput {
                        question_id: attempt.question_id,
                        duration_seconds: resolved_batch_duration(attempt, pressure_durations),
                        result: attempt.result.clone(),
                        self_rating: attempt.self_rating,
                        selected_answer: None,
                        mode: Some("paper-codex".into()),
                        outcome: Some(
                            attempt
                                .verdict
                                .clone()
                                .unwrap_or_else(|| attempt.result.clone()),
                        ),
                        evidence_source: Some("codex".into()),
                        fluency_rating: Some(attempt.self_rating),
                        confidence: Some(attempt.confidence),
                        session_id: Some(payload.task_id.clone()),
                        diagnosis_id: Some(format!("{}-{}", payload.task_id, attempt.question_id)),
                        ai_rating: attempt.rating,
                        difficulty_multiplier: attempt.difficulty_multiplier,
                        technique_level: attempt
                            .dimensions
                            .get("strategyInsight")
                            .and_then(|d| d.technique_level),
                        dimensions: Some(AttemptDimensions::from_dimension_map(
                            &attempt.dimensions,
                        )),
                    },
                )?;
                save_analysis_signal_raw(conn, &signal, Some(attempt_id))?;
            }
        }
    }
    Ok(())
}

#[allow(dead_code)]
fn pressure_task_match(conn: &Connection, task_id: &str) -> Result<PressureTaskMatch, String> {
    pressure_task_match_with_link_requirement(conn, task_id, false)
}

fn pressure_task_match_with_link_requirement(
    conn: &Connection,
    task_id: &str,
    require_link: bool,
) -> Result<PressureTaskMatch, String> {
    let linked: Option<(String, bool)> = conn
        .query_row(
            "SELECT session_id,is_current FROM pressure_task_links WHERE task_id=?1",
            [task_id],
            |row| Ok((row.get(0)?, row.get::<_, i64>(1)? != 0)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let session_id = if let Some((session_id, is_current)) = linked {
        if !is_current {
            let current_task_id = conn
                .query_row(
                    "SELECT task_id FROM pressure_sessions WHERE session_id=?1",
                    [&session_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?
                .flatten();
            return Ok(PressureTaskMatch::Stale {
                session_id,
                current_task_id,
            });
        }
        session_id
    } else {
        // Explicit legacy boundary: only callers without a v1.5 immutable task
        // context may fall back to `pressure_sessions.task_id`.  New tasks must
        // retain their pressure_task_links row or enter reconciliation.
        let legacy_session = conn
            .query_row(
                "SELECT session_id FROM pressure_sessions WHERE task_id=?1",
                [task_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if require_link {
            return Ok(PressureTaskMatch::LinkMissing { session_id: legacy_session });
        }
        match legacy_session {
            Some(session_id) => session_id,
            None => return Ok(PressureTaskMatch::None),
        }
    };

    let (question_ids_json, status, current_task_id): (String, String, Option<String>) = conn
        .query_row(
            "SELECT question_ids,status,task_id FROM pressure_sessions WHERE session_id=?1",
            [&session_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;
    if current_task_id.as_deref() != Some(task_id)
        || !matches!(
            status.as_str(),
            "awaiting_codex" | "graded" | "graded_partial"
        )
    {
        return Ok(PressureTaskMatch::Stale {
            session_id,
            current_task_id,
        });
    }

    let question_ids: Vec<i64> = serde_json::from_str(&question_ids_json)
        .map_err(|e| format!("压力会话题目列表损坏: {e}"))?;
    let mut durations = HashMap::new();
    let mut stmt = conn
        .prepare("SELECT question_id,duration FROM pressure_answers WHERE session_id=?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&session_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (question_id, duration) = row.map_err(|e| e.to_string())?;
        durations.insert(question_id, duration.clamp(1, 1800));
    }

    Ok(PressureTaskMatch::Current(PressureBatchContext {
        session_id,
        question_ids,
        durations,
    }))
}

fn validate_pressure_batch_payload(
    context: &PressureBatchContext,
    payload: &CodexPayload,
) -> Result<(), String> {
    let expected: HashSet<i64> = context.question_ids.iter().copied().collect();
    let mut returned = HashSet::new();
    for attempt in &payload.batch_attempts {
        if !expected.contains(&attempt.question_id) {
            return Err(format!(
                "题号 {} 不属于压力会话 {}",
                attempt.question_id, context.session_id
            ));
        }
        if !returned.insert(attempt.question_id) {
            return Err(format!("整组回传重复包含题号 {}", attempt.question_id));
        }
    }
    Ok(())
}

fn push_unique_nonempty(items: &mut Vec<String>, value: &str) {
    let value = value.trim();
    if !value.is_empty() && !items.iter().any(|item| item == value) {
        items.push(value.to_owned());
    }
}

fn batch_grade_class(attempt: &BatchAttempt) -> &'static str {
    if attempt.result == "uncertain" || attempt.verdict.as_deref() == Some("uncertain") {
        "uncertain"
    } else {
        match attempt.verdict.as_deref() {
            Some("partial") => "partial",
            Some("incorrect") => "wrong",
            Some("correct") => "correct",
            _ if attempt.result == "correct" => "correct",
            _ => "wrong",
        }
    }
}

fn build_pressure_grading_report(
    context: &PressureBatchContext,
    payload: &CodexPayload,
    now: i64,
) -> (String, Value) {
    let returned_by_id: HashMap<i64, &BatchAttempt> = payload
        .batch_attempts
        .iter()
        .map(|attempt| (attempt.question_id, attempt))
        .collect();
    let returned_ids: HashSet<i64> = returned_by_id.keys().copied().collect();
    let ungraded_question_ids: Vec<i64> = context
        .question_ids
        .iter()
        .copied()
        .filter(|question_id| !returned_ids.contains(question_id))
        .collect();
    let status = if ungraded_question_ids.is_empty() {
        "graded"
    } else {
        "graded_partial"
    };

    let mut correct_count = 0_i64;
    let mut partial_count = 0_i64;
    let mut wrong_count = 0_i64;
    let mut uncertain_count = 0_i64;
    let mut strengths = Vec::new();
    let mut weaknesses = Vec::new();
    let mut suggestions = Vec::new();
    let mut grades = Vec::new();
    let mut resolved_durations = context.durations.clone();

    for attempt in &payload.batch_attempts {
        resolved_durations.insert(
            attempt.question_id,
            resolved_batch_duration(attempt, Some(&context.durations)),
        );
    }

    for question_id in &context.question_ids {
        let Some(attempt) = returned_by_id.get(question_id).copied() else {
            continue;
        };
        let grade_class = batch_grade_class(attempt);
        match grade_class {
            "correct" => {
                correct_count += 1;
                push_unique_nonempty(&mut strengths, &attempt.summary);
            }
            "partial" => partial_count += 1,
            "uncertain" => uncertain_count += 1,
            _ => wrong_count += 1,
        }
        for weakness in &attempt.weakness_tags {
            push_unique_nonempty(&mut weaknesses, weakness);
        }
        if let Some(advice) = attempt.advice.as_deref() {
            push_unique_nonempty(&mut suggestions, advice);
        }
        grades.push(json!({
            "questionId": attempt.question_id,
            "correct": grade_class == "correct",
            "userAnswer": "",
            "correctAnswer": "",
            "feedback": attempt.summary,
            "duration": resolved_durations.get(question_id).copied().unwrap_or(30),
            "result": attempt.result,
            "verdict": attempt.verdict,
            "selfRating": attempt.self_rating,
            "earliestError": attempt.earliest_error,
            "errorTags": attempt.error_tags,
            "weaknessTags": attempt.weakness_tags,
            "advice": attempt.advice,
            "betterSolution": attempt.better_solution,
            "confidence": attempt.confidence.clamp(0.0, 1.0),
            "rating": attempt.rating.map(|value| value.clamp(AI_RATING_MIN, AI_RATING_MAX)),
            "ratingTier": attempt.rating_tier,
            "difficultyMultiplier": attempt.difficulty_multiplier,
            "dimensions": attempt.dimensions,
        }));
    }

    let total_count = context.question_ids.len() as i64;
    let graded_count = correct_count + partial_count + wrong_count;
    let accuracy = if graded_count > 0 {
        correct_count as f64 * 100.0 / graded_count as f64
    } else {
        0.0
    };
    let total_duration: i64 = context
        .question_ids
        .iter()
        .map(|question_id| resolved_durations.get(question_id).copied().unwrap_or(0))
        .sum();
    let average_duration = if total_count > 0 {
        total_duration as f64 / total_count as f64
    } else {
        0.0
    };

    (
        status.into(),
        json!({
            "sessionId": context.session_id,
            "sourceTaskId": payload.task_id,
            "status": status,
            "questionIds": context.question_ids,
            "ungradedQuestionIds": ungraded_question_ids,
            "grades": grades,
            "summary": {
                "correctCount": correct_count,
                "partialCount": partial_count,
                "wrongCount": wrong_count,
                "uncertainCount": uncertain_count,
                "gradedCount": graded_count,
                "totalCount": total_count,
                "accuracy": accuracy,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "suggestions": suggestions,
                "totalDuration": total_duration,
                "averageDuration": average_duration,
            },
            "confirmedAt": now,
            "createdAt": now,
        }),
    )
}

fn save_pressure_batch_report(
    conn: &Connection,
    context: &PressureBatchContext,
    payload: &CodexPayload,
) -> Result<String, String> {
    validate_pressure_batch_payload(context, payload)?;
    let now = Local::now().timestamp_millis();
    let (status, report) = build_pressure_grading_report(context, payload, now);
    let report_json = serde_json::to_string(&report).map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let updated = tx
        .execute(
            "UPDATE pressure_sessions SET status=?1 WHERE session_id=?2 AND task_id=?3 AND status IN ('awaiting_codex','graded','graded_partial')",
            params![&status, &context.session_id, &payload.task_id],
        )
        .map_err(|e| e.to_string())?;
    if updated != 1 {
        return Err("压力会话已变化，无法保存当前批改报告".into());
    }
    tx.execute(
        "INSERT OR REPLACE INTO pressure_reports(session_id,report_json,created_at) VALUES(?1,?2,?3)",
        params![&context.session_id, report_json, now],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(status)
}

#[derive(Debug, Clone)]
struct PressureBatchReceipt {
    session_id: String,
    payload_hash: String,
    state: String,
}

fn write_canonical_json(value: &Value, output: &mut String) -> Result<(), String> {
    match value {
        Value::Null => output.push_str("null"),
        Value::Bool(value) => output.push_str(if *value { "true" } else { "false" }),
        Value::Number(value) => output.push_str(&value.to_string()),
        Value::String(value) => output.push_str(&serde_json::to_string(value).map_err(|e| e.to_string())?),
        Value::Array(values) => {
            output.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 { output.push(','); }
                write_canonical_json(value, output)?;
            }
            output.push(']');
        }
        Value::Object(values) => {
            let mut keys = values.keys().collect::<Vec<_>>();
            keys.sort_unstable();
            output.push('{');
            for (index, key) in keys.into_iter().enumerate() {
                if index > 0 { output.push(','); }
                output.push_str(&serde_json::to_string(key).map_err(|e| e.to_string())?);
                output.push(':');
                write_canonical_json(&values[key], output)?;
            }
            output.push('}');
        }
    }
    Ok(())
}

fn pressure_payload_hash(payload: &CodexPayload) -> Result<String, String> {
    // Receipt identity must survive a persisted JSON payload being parsed into
    // HashMap-backed dimensions and serialized again during crash recovery.
    // Canonical object-key ordering makes it an identity guard, not a signature.
    let value = serde_json::to_value(payload).map_err(|e| e.to_string())?;
    let mut serialized = String::new();
    write_canonical_json(&value, &mut serialized)?;
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in serialized.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    Ok(format!("fnv1a64-canonical:{hash:016x}"))
}

fn pressure_receipt(conn: &Connection, task_id: &str) -> Result<Option<PressureBatchReceipt>, String> {
    conn.query_row(
        "SELECT session_id,payload_hash,state FROM pressure_batch_receipts WHERE task_id=?1",
        [task_id],
        |row| Ok(PressureBatchReceipt { session_id: row.get(0)?, payload_hash: row.get(1)?, state: row.get(2)? }),
    ).optional().map_err(|e| e.to_string())
}

fn update_pressure_receipt_state(
    conn: &Connection,
    task_id: &str,
    state: &str,
    last_error: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE pressure_batch_receipts SET state=?1,last_error=?2,updated_at=?3 WHERE task_id=?4",
        params![state,last_error,Local::now().to_rfc3339(),task_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn mark_pressure_receipt_reconciliation(
    conn: &Connection,
    inbox_id: i64,
    payload: &CodexPayload,
    session_id: Option<&str>,
    reason: &str,
) -> Result<(), String> {
    let Some(session_id) = session_id else {
        // No safe session binding exists; retaining the pending inbox item is the
        // auditable boundary.  Never manufacture a session id and never confirm it.
        return Err(format!("压力任务缺少可验证会话绑定，需要人工对账：{reason}"));
    };
    let hash = pressure_payload_hash(payload)?;
    let now = Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO pressure_batch_receipts(task_id,session_id,payload_hash,state,inbox_id,last_error,created_at,updated_at)
         VALUES(?1,?2,?3,'reconciliation_required',?4,?5,?6,?6)
         ON CONFLICT(task_id) DO UPDATE SET state='reconciliation_required',last_error=excluded.last_error,updated_at=excluded.updated_at",
        params![&payload.task_id,session_id,hash,inbox_id,reason,now],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Applies only the main-database half of a formal pressure batch.  The receipt
/// transition to `main_applied` is in exactly the same transaction as attempts,
/// progress, ELO, sidecars and per-question idempotency markers.
fn retain_stale_pressure_inbox(
    conn: &Connection,
    inbox_id: i64,
    payload: &CodexPayload,
    session_id: &str,
    current_task_id: Option<String>,
) -> Result<String, String> {
    let reason = format!(
        "压力任务已过期（会话 {} 当前任务：{}）",
        session_id,
        current_task_id.unwrap_or_else(|| "无".into())
    );
    let _ = mark_pressure_receipt_reconciliation(conn, inbox_id, payload, Some(session_id), &reason);
    Ok(format!("{reason}；已保留待确认回传，未自动 dismiss"))
}

fn apply_pressure_batch_main_with_receipt(
    conn: &Connection,
    inbox_id: i64,
    context: &PressureBatchContext,
    payload: &CodexPayload,
) -> Result<String, String> {
    validate_pressure_batch_payload(context, payload)?;
    for attempt in &payload.batch_attempts { validate_batch_attempt_result_verdict(attempt)?; }
    let hash = pressure_payload_hash(payload)?;
    if let Some(existing) = pressure_receipt(conn, &payload.task_id)? {
        if existing.session_id != context.session_id || existing.payload_hash != hash {
            update_pressure_receipt_state(conn, &payload.task_id, "reconciliation_required", Some("task/session/payload hash conflict"))?;
            return Err("压力批改回执与当前任务、会话或载荷不一致，需要人工对账".into());
        }
        match existing.state.as_str() {
            "main_applied" | "report_applied" | "confirmed" => return Ok(existing.state),
            "reconciliation_required" => return Err("压力批改回执处于人工对账状态，拒绝自动重放".into()),
            _ => {}
        }
    }
    let result = (|| -> Result<(), String> {
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        let now = Local::now().to_rfc3339();
        tx.execute(
            "INSERT INTO pressure_batch_receipts(task_id,session_id,payload_hash,state,inbox_id,last_error,created_at,updated_at)
             VALUES(?1,?2,?3,'applying',?4,NULL,?5,?5)
             ON CONFLICT(task_id) DO UPDATE SET state='applying',inbox_id=excluded.inbox_id,last_error=NULL,updated_at=excluded.updated_at",
            params![&payload.task_id,&context.session_id,&hash,inbox_id,now],
        ).map_err(|e| e.to_string())?;
        apply_batch_payload_in_tx(&tx, payload, Some(&context.durations), BatchApplicationMode::FormalPressureAttempt)?;
        tx.execute(
            "UPDATE pressure_batch_receipts SET state='main_applied',last_error=NULL,updated_at=?1 WHERE task_id=?2 AND session_id=?3 AND payload_hash=?4",
            params![Local::now().to_rfc3339(),&payload.task_id,&context.session_id,&hash],
        ).map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    })();
    if let Err(error) = result {
        // This small retryable receipt contains no main writes because the formal
        // transaction above rolled back as a unit.
        let now = Local::now().to_rfc3339();
        let _ = conn.execute(
            "INSERT INTO pressure_batch_receipts(task_id,session_id,payload_hash,state,inbox_id,last_error,created_at,updated_at)
             VALUES(?1,?2,?3,'failed_retryable',?4,?5,?6,?6)
             ON CONFLICT(task_id) DO UPDATE SET state='failed_retryable',last_error=excluded.last_error,updated_at=excluded.updated_at",
            params![&payload.task_id,&context.session_id,&hash,inbox_id,&error,now],
        );
        return Err(error);
    }
    retry_learning_projections_best_effort(conn);
    Ok("main_applied".into())
}

fn confirm_pressure_batch_receipt_and_inbox(
    conn: &Connection,
    inbox_id: i64,
    payload: &CodexPayload,
) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let updated = tx.execute(
        "UPDATE codex_inbox SET status='confirmed' WHERE id=?1 AND status='pending'",
        [inbox_id],
    ).map_err(|e| e.to_string())?;
    if updated != 1 {
        return Err("压力回传已被其他操作处理，未自动确认".into());
    }
    let receipt_updated = tx.execute(
        "UPDATE pressure_batch_receipts SET state='confirmed',last_error=NULL,updated_at=?1
         WHERE task_id=?2 AND state IN ('report_applied','confirmed')",
        params![Local::now().to_rfc3339(),&payload.task_id],
    ).map_err(|e| e.to_string())?;
    if receipt_updated != 1 {
        return Err("压力报告回执不是可确认状态，拒绝确认收件箱".into());
    }
    tx.commit().map_err(|e| e.to_string())
}

/// Resumable two-database saga.  The supplemental report is written only after the
/// immutable main settlement has committed; a crash in either window resumes from
/// the persisted receipt without re-running attempts/progress/ELO.
fn confirm_pressure_batch_saga(
    conn: &Connection,
    supplemental: &Connection,
    inbox_id: i64,
    context: &PressureBatchContext,
    payload: &CodexPayload,
) -> Result<(), String> {
    let mut state = apply_pressure_batch_main_with_receipt(conn, inbox_id, context, payload)?;
    if state == "confirmed" {
        return Ok(());
    }
    if state == "main_applied" || state == "failed_retryable" {
        if let Err(error) = save_pressure_batch_report(supplemental, context, payload) {
            // Main settlement stays exactly-once.  Keeping `main_applied` makes the
            // next retry resume at the report leg rather than reapplying ELO.
            let _ = update_pressure_receipt_state(conn, &payload.task_id, "main_applied", Some(&error));
            return Err(format!("主库已结算，压力报告待重试：{error}"));
        }
        update_pressure_receipt_state(conn, &payload.task_id, "report_applied", None)?;
        state = "report_applied".into();
    }
    if state == "report_applied" {
        return confirm_pressure_batch_receipt_and_inbox(conn, inbox_id, payload);
    }
    Err(format!("未知压力批改回执状态：{state}"))
}

fn clear_recommendation_overrides(conn: &Connection, task_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM recommendation_overrides WHERE task_id=?1",
        params![task_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn start_recommendation_batch_row(
    conn: &Connection,
    task_id: &str,
) -> Result<RecommendationBatch, String> {
    let batch = recommendation_batch_by_task(conn, task_id)?.ok_or("找不到该 AI 推荐题组")?;
    if matches!(batch.status.as_str(), "dismissed" | "completed") {
        return Err("该 AI 推荐题组已结束，不能再次开始".into());
    }
    if batch.remaining_count == 0 {
        conn.execute(
            "UPDATE recommendation_batches SET status='completed',completed_at=?1 WHERE task_id=?2",
            params![Local::now().to_rfc3339(), task_id],
        )
        .map_err(|e| e.to_string())?;
        return Err("该 AI 推荐题组已经完成".into());
    }

    let now = Local::now().to_rfc3339();
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE recommendation_batches SET status='paused' WHERE status='active' AND task_id!=?1",
        [task_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE recommendation_batches SET status='active',started_at=COALESCE(started_at,?1),completed_at=NULL WHERE task_id=?2",
        params![now, task_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE codex_inbox SET status='confirmed' WHERE task_id=?1",
        [task_id],
    )
    .map_err(|e| e.to_string())?;
    clear_recommendation_overrides(&tx, task_id)?;
    tx.commit().map_err(|e| e.to_string())?;
    recommendation_batch_by_task(conn, task_id)?.ok_or("无法读取已开始的 AI 推荐题组".into())
}

fn dismiss_recommendation_batch_row(conn: &Connection, task_id: &str) -> Result<(), String> {
    let exists = recommendation_batch_by_task(conn, task_id)?.is_some();
    if !exists {
        return Err("找不到该 AI 推荐题组".into());
    }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE recommendation_batches SET status='dismissed' WHERE task_id=?1",
        [task_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE codex_inbox SET status='dismissed' WHERE task_id=?1",
        [task_id],
    )
    .map_err(|e| e.to_string())?;
    clear_recommendation_overrides(&tx, task_id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn complete_active_recommendation_item(conn: &Connection, question_id: i64, attempt_id: i64) -> Result<(), String> {
    let now = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE recommendation_batch_items
         SET completed_at=?1,
             attempt_id=?3,
             result=(SELECT result FROM attempts WHERE id=?3),
             outcome=(SELECT outcome FROM attempts WHERE id=?3),
             self_rating=(SELECT self_rating FROM attempts WHERE id=?3),
             duration_seconds=(SELECT duration_seconds FROM attempts WHERE id=?3),
             attempt_mode=(SELECT mode FROM attempts WHERE id=?3),
             evidence_source=(SELECT evidence_source FROM attempts WHERE id=?3)
         WHERE question_id=?2 AND completed_at IS NULL",
        params![now, question_id, attempt_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE recommendation_batches
         SET status='completed', completed_at=?1
         WHERE status='active'
           AND NOT EXISTS(SELECT 1 FROM recommendation_batch_items WHERE task_id=recommendation_batches.task_id AND completed_at IS NULL)",
        params![now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn write_completed_recommendation_contexts(conn: &Connection, data_dir: &Path) -> Result<(), String> {
    let task_ids: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT task_id FROM recommendation_batches
             WHERE status='completed' AND completed_at IS NOT NULL
               AND result_context_path IS NULL
             ORDER BY completed_at ASC",
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    if task_ids.is_empty() { return Ok(()); }
    let dir = data_dir.join("codex-tasks");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for task_id in task_ids {
        let batch: (String, String, String, String, String) = conn.query_row(
            "SELECT title,summary,recommendation_reason,status,completed_at FROM recommendation_batches WHERE task_id=?1",
            [&task_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        ).map_err(|e| e.to_string())?;

        let orig_payload: Option<CodexPayload> = conn.query_row(
            "SELECT payload_json FROM codex_inbox WHERE task_id=?1 ORDER BY id DESC LIMIT 1",
            [&task_id],
            |r| {
                let s: String = r.get(0)?;
                Ok(serde_json::from_str(&s).ok())
            },
        ).optional().map_err(|e| e.to_string())?.flatten();

        let question_roles = orig_payload.as_ref().map(|p| p.question_roles.clone()).unwrap_or_default();
        let coverage = orig_payload.as_ref().map(|p| p.coverage.clone()).unwrap_or_default();
        let novelty_plan = orig_payload.as_ref().map(|p| p.novelty_plan.clone()).unwrap_or_default();
        let success_criteria = orig_payload.as_ref().map(|p| p.success_criteria.clone()).unwrap_or_default();
        let goal = orig_payload.as_ref().and_then(|p| p.goal.clone()).unwrap_or_else(|| batch.0.clone());

        let mut stmt = conn.prepare(
            "SELECT rbi.position,rbi.question_id,q.category_path,q.stem,
                    rbi.attempt_id,rbi.result,rbi.outcome,rbi.self_rating,rbi.duration_seconds,
                    rbi.attempt_mode,rbi.evidence_source,rbi.completed_at
             FROM recommendation_batch_items rbi
             JOIN questions q ON q.id=rbi.question_id
             WHERE rbi.task_id=?1 ORDER BY rbi.position",
        ).map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        let mut total_count = 0usize;
        let mut verified_count = 0usize;
        let mut high_risk_count = 0usize;

        let rows = stmt.query_map([task_id.as_str()], |row| {
            let pos: i64 = row.get(0)?;
            let qid: i64 = row.get(1)?;
            let cat: String = row.get(2)?;
            let stem: String = row.get(3)?;
            let attempt_id: Option<i64> = row.get(4)?;
            let result: Option<String> = row.get(5)?;
            let outcome: Option<String> = row.get(6)?;
            let self_rating: Option<i64> = row.get(7)?;
            let duration_seconds: Option<i64> = row.get(8)?;
            let attempt_mode: Option<String> = row.get(9)?;
            let evidence_source: Option<String> = row.get(10)?;
            let completed_at: Option<String> = row.get(11)?;
            Ok((pos, qid, cat, stem, attempt_id, result, outcome, self_rating, duration_seconds, attempt_mode, evidence_source, completed_at))
        }).map_err(|e| e.to_string())?;

        for row in rows {
            let (pos, qid, cat, stem, attempt_id, result, outcome, self_rating, duration_seconds, attempt_mode, evidence_source, completed_at) = row.map_err(|e| e.to_string())?;
            total_count += 1;
            let role = question_roles.get(&qid.to_string()).cloned().unwrap_or_else(|| "consolidate".to_string());

            let (grading_verdict, earliest_error, error_tags) = if let Some(att_id) = attempt_id {
                let diag: Option<(Option<String>, Option<String>, String)> = conn.query_row(
                    "SELECT verdict, earliest_error, error_tags_json FROM learning_diagnoses WHERE attempt_id=?1 ORDER BY id DESC LIMIT 1",
                    [att_id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                ).optional().map_err(|e| e.to_string())?;

                if let Some((v, e, tags_json)) = diag {
                    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                    (v, e, tags)
                } else {
                    (None, None, vec![])
                }
            } else {
                (None, None, vec![])
            };

            let eff_outcome = outcome.as_deref().or(result.as_deref());
            let rating_val = self_rating.unwrap_or(2);
            let coverage_status = if eff_outcome == Some("wrong") || grading_verdict.as_deref() == Some("incorrect") {
                high_risk_count += 1;
                "high_risk"
            } else if eff_outcome == Some("uncertain") || grading_verdict.as_deref() == Some("uncertain") {
                "uncertain"
            } else if eff_outcome == Some("correct") && rating_val >= 3 {
                verified_count += 1;
                "verified"
            } else {
                "unverified"
            };

            items.push(json!({
                "position": pos,
                "questionId": qid,
                "questionRole": role,
                "categoryPath": cat,
                "stem": stem,
                "attemptId": attempt_id,
                "result": result,
                "outcome": outcome,
                "durationSeconds": duration_seconds,
                "selfRating": self_rating,
                "attemptMode": attempt_mode.unwrap_or_else(|| "paper".into()),
                "evidenceSource": evidence_source.unwrap_or_else(|| "self_report".into()),
                "sawSolution": serde_json::Value::Null,
                "gradingVerdict": grading_verdict,
                "earliestError": earliest_error,
                "errorTags": error_tags,
                "coverageStatus": coverage_status,
                "completedAt": completed_at,
            }));
        }

        let is_goal_achieved = high_risk_count == 0 && verified_count >= (total_count / 2).max(1);
        let next_suggested_action = if high_risk_count > 0 {
            "针对高风险考法安排方法辨析与漏洞修复题，避免继续盲目推进"
        } else if verified_count == total_count && total_count > 0 {
            "当前考法已稳定验证，建议进入迁移挑战或扩大新考法覆盖"
        } else {
            "继续安排同考法巩固题，验证方法迁移稳定性"
        };

        let context = json!({
            "schemaVersion": 2,
            "kind": "recommendationResult",
            "taskId": task_id,
            "title": batch.0,
            "summary": batch.1,
            "goal": goal,
            "recommendationReason": batch.2,
            "status": batch.3,
            "completedAt": batch.4,
            "coverage": coverage,
            "noveltyPlan": novelty_plan,
            "successCriteria": success_criteria,
            "isGoalAchieved": is_goal_achieved,
            "verifiedCount": verified_count,
            "highRiskCount": high_risk_count,
            "totalCount": total_count,
            "nextSuggestedAction": next_suggested_action,
            "items": items,
            "rules": [
                "独立作答结果优先于看解析后的正确",
                "一次正确不能直接证明考法稳定",
                "根据结果区分修复、方法辨析、巩固和迁移，不要按章节盲抽",
                "下一轮只能使用 App 提供的候选题号"
            ]
        });
        let path = dir.join(format!("{task_id}.result.context.json"));
        fs::write(&path, serde_json::to_string_pretty(&context).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE recommendation_batches SET result_context_path=?1,result_exported_at=?2 WHERE task_id=?3 AND result_context_path IS NULL",
            params![path.to_string_lossy(), Local::now().to_rfc3339(), task_id],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// 启动加载与每次刷新都会走这里，需要汇总题库、作答、推荐等多张表。声明为 async 后由
// Tauri 调度到异步运行时，避免这类重量级查询直接卡住主线程造成界面停顿。
#[tauri::command]
async fn bootstrap(state: State<'_, AppState>) -> Result<BootstrapData, String> {
    scan_inbox(&state)?;
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut count: i64 = conn
        .query_row("SELECT COUNT(*) FROM questions", [], |r| r.get(0))
        .unwrap_or(0);
    let mut library = state.library_dir.lock().map_err(|e| e.to_string())?.clone();
    let mut ready = library.join("all_questions_20260813.json").exists();
    if !ready {
        let candidate_adjacent = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()));
        let candidate_cwd = std::env::current_dir().ok();
        if let Some(detected) = [
            candidate_adjacent.as_ref().map(|d| d.join("题库-大观园")),
            candidate_adjacent.as_ref().map(|d| d.join("library")),
            candidate_cwd.as_ref().map(|d| d.join("题库-大观园")),
            candidate_cwd.as_ref().map(|d| d.join("library")),
        ]
        .into_iter()
        .flatten()
        .find(|p| p.join("all_questions_20260813.json").exists())
        {
            library = detected.clone();
            ready = true;
            *state.library_dir.lock().map_err(|e| e.to_string())? = detected;
        }
    }
    if ready {
        // 每次启动按 content_hash 增量同步，题库内容更新时不会继续使用旧题面。
        count = import_library(&mut conn, &library)?;
    }
    let today = Local::now().date_naive().to_string();
    let today_done = conn
        .query_row(
            "SELECT COUNT(*) FROM attempts WHERE substr(attempted_at,1,10)=?1",
            [&today],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let today_seconds: i64 = conn.query_row("SELECT COALESCE(SUM(duration_seconds),0) FROM attempts WHERE substr(attempted_at,1,10)=?1 AND duration_seconds BETWEEN 1 AND 1800", [&today], |r| r.get(0)).unwrap_or(0);
    let excluded_duration_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM attempts WHERE duration_seconds > 1800 OR duration_seconds < 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let reward_events_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM reward_events", [], |r| r.get(0))
        .unwrap_or(0);
    let due_count = conn
        .query_row(
            "SELECT COUNT(*) FROM progress p WHERE p.next_review<=?1 AND NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=p.question_id AND substr(at.attempted_at,1,10)=?1)",
            [&today],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let favorite_count = conn
        .query_row("SELECT COUNT(*) FROM progress WHERE favorite=1", [], |r| {
            r.get(0)
        })
        .unwrap_or(0);
    let inbox_count = conn
        .query_row(
            "SELECT COUNT(*) FROM codex_inbox WHERE status='pending'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let image_count = fs::read_dir(library.join("images"))
        .map(|it| it.filter_map(Result::ok).count())
        .unwrap_or(0);
    let current_chapter_id = setting(&conn, "current_chapter_id", "").parse::<i64>().ok();
    let current_chapter_name = current_chapter_id.and_then(|id| {
        conn.query_row("SELECT name FROM categories WHERE id=?1", [id], |r| {
            r.get(0)
        })
        .optional()
        .ok()
        .flatten()
    });
    let custom_queue_count = conn
        .query_row(
            "SELECT COUNT(*) FROM custom_queue cq WHERE NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=cq.question_id AND substr(at.attempted_at,1,10)=?1)",
            [&today],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let inbox_failed = inbox_failed_count(&state);
    let intervals: Vec<i64> = review_intervals(&conn).to_vec();
    let supplemental_question_count = state
        .supplemental_db
        .lock()
        .ok()
        .and_then(|db| {
            db.query_row("SELECT COUNT(*) FROM supplemental_questions", [], |r| {
                r.get(0)
            })
            .ok()
        })
        .unwrap_or(0);
    let active_queue = active_recommendation_queue(&conn)?;
    let active_recommendation = if active_queue.is_some() {
        let task_id: Option<String> = conn
            .query_row(
                "SELECT task_id FROM recommendation_batches WHERE status='active' ORDER BY started_at DESC,created_at DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        match task_id {
            Some(task_id) => recommendation_batch_by_task(&conn, &task_id)?,
            None => None,
        }
    } else {
        None
    };
    let focus_json = setting(&conn, "current_focus_category_ids", "");
    let current_focus_category_ids: Vec<i64> =
        serde_json::from_str(&focus_json).unwrap_or_default();
    let recs = if let Some(queue) = active_queue {
        queue
    } else if !current_focus_category_ids.is_empty() {
        let q = focus_queue(&conn, &current_focus_category_ids, 12).unwrap_or_default();
        if !q.is_empty() {
            q
        } else if let Some(id) = current_chapter_id {
            chapter_queue(&conn, id, 12).or_else(|_| recommendations(&conn, 12))?
        } else {
            recommendations(&conn, 12)?
        }
    } else if let Some(id) = current_chapter_id {
        chapter_queue(&conn, id, 12).or_else(|_| recommendations(&conn, 12))?
    } else {
        recommendations(&conn, 12)?
    };
    Ok(BootstrapData {
        library_dir: library.to_string_lossy().into_owned(),
        library_ready: ready,
        question_count: count,
        image_count,
        today_done,
        today_minutes: (today_seconds + 59) / 60,
        due_count,
        favorite_count,
        inbox_count,
        inbox_failed_count: inbox_failed,
        review_intervals: intervals,
        daily_mode: setting(&conn, "daily_mode", "problems"),
        daily_problem_target: setting(&conn, "daily_problem_target", "20")
            .parse()
            .unwrap_or(20),
        daily_minute_target: setting(&conn, "daily_minute_target", "90")
            .parse()
            .unwrap_or(90),
        data_dir: state.data_dir.to_string_lossy().into_owned(),
        inbox_dir: state
            .data_dir
            .join("codex-inbox")
            .to_string_lossy()
            .into_owned(),
        current_chapter_id,
        current_chapter_name,
        current_focus_category_ids,
        custom_queue_count,
        supplemental_question_count,
        supplemental_db_path: state
            .data_dir
            .join("supplemental.db")
            .to_string_lossy()
            .into_owned(),
        active_recommendation,
        recommendations: recs,
        excluded_duration_count,
        reward_events_count,
    })
}

#[tauri::command]
fn get_categories(root: String, state: State<AppState>) -> Result<Vec<CategoryNode>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt=conn.prepare(
        "SELECT c.id,c.parent_id,c.name,c.path,c.root_name,c.depth,
         (SELECT COUNT(DISTINCT qc.question_id) FROM question_categories qc JOIN categories leaf ON leaf.id=qc.category_id WHERE leaf.path=c.path OR leaf.path LIKE c.path||' / %') count
         FROM categories c WHERE c.math1=1 AND (?1='' OR c.root_name=?1)
         ORDER BY CASE c.root_name WHEN '高等数学' THEN 1 WHEN '线性代数' THEN 2 WHEN '概率统计' THEN 3 WHEN '历年真题' THEN 4 ELSE 5 END,c.depth,c.sort_key,c.id"
    ).map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([root], |r| {
            Ok(CategoryNode {
                id: r.get(0)?,
                parent_id: r.get(1)?,
                name: r.get(2)?,
                path: r.get(3)?,
                root_name: r.get(4)?,
                depth: r.get(5)?,
                question_count: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn search_question_page(
    query: String,
    category_id: Option<i64>,
    status: String,
    scope: String,
    page: i64,
    page_size: i64,
    state: State<AppState>,
) -> Result<QuestionPage, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let like = format!("%{}%", query.trim());
    let selected_path: Option<String> = category_id.and_then(|id| {
        conn.query_row("SELECT path FROM categories WHERE id=?1", [id], |r| {
            r.get(0)
        })
        .optional()
        .ok()
        .flatten()
    });
    let path = selected_path.unwrap_or_default();
    let status_clause="(?3='all' OR (?3='favorite' AND EXISTS(SELECT 1 FROM progress px WHERE px.question_id=q.id AND px.favorite=1)) OR (?3='wrong' AND EXISTS(SELECT 1 FROM attempts ax WHERE ax.question_id=q.id AND ax.result!='correct')) OR (?3='unseen' AND NOT EXISTS(SELECT 1 FROM attempts ax WHERE ax.question_id=q.id)) OR (?3='noted' AND COALESCE((SELECT note FROM progress pn WHERE pn.question_id=q.id),'')!=''))";
    let scope_clause="(?4='complete' OR (?4='core' AND q.is_core=1) OR (?4='truth' AND EXISTS(SELECT 1 FROM question_categories qct JOIN categories ct ON ct.id=qct.category_id WHERE qct.question_id=q.id AND ct.root_name='历年真题')))";
    let category_clause="(?2='' OR EXISTS(SELECT 1 FROM question_categories qcc JOIN categories cc ON cc.id=qcc.category_id WHERE qcc.question_id=q.id AND (cc.path=?2 OR cc.path LIKE ?2||' / %')))";
    let filter=format!("(?1='%%' OR q.stem LIKE ?1 OR q.source LIKE ?1 OR CAST(q.id AS TEXT)=trim(?1,'%')) AND {category_clause} AND {status_clause} AND {scope_clause}");
    let total: i64 = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM questions q WHERE {filter}"),
            params![like, path, status, scope],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let size = page_size.clamp(20, 200);
    let current = page.max(1);
    let offset = (current - 1) * size;
    let sql =
        format!("{QUESTION_SELECT} WHERE {filter} GROUP BY q.id ORDER BY q.id LIMIT ?5 OFFSET ?6");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(
            params![like, path, status, scope, size, offset],
            row_to_question,
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(QuestionPage {
        items,
        total,
        page: current,
        page_size: size,
        page_count: if total == 0 {
            0
        } else {
            (total + size - 1) / size
        },
    })
}

fn dynamic_mastery_score(
    attempted: i64,
    attempts: i64,
    correct: i64,
    rating: Option<f64>,
    recent_correct: i64,
    recent_attempts: i64,
    last_attempt_at: Option<&str>,
    today: &str,
    due_ratio: f64,
) -> Option<f64> {
    if attempted == 0 || attempts == 0 || attempts < 2 {
        return None;
    }
    let overall_accuracy = correct as f64 / attempts as f64;
    let recent_accuracy = if recent_attempts > 0 {
        recent_correct as f64 / recent_attempts as f64
    } else {
        overall_accuracy
    };
    // Without rating evidence the weight goes back to accuracy instead of
    // fabricating an average rating for chapters that never produced one.
    let mut score = match rating {
        Some(value) => {
            let rating_norm = value.clamp(AI_RATING_MIN, AI_RATING_MAX) / AI_RATING_MAX;
            (recent_accuracy * 0.55 + rating_norm * 0.30 + overall_accuracy * 0.15) * 100.0
        }
        None => (recent_accuracy * 0.70 + overall_accuracy * 0.30) * 100.0,
    };

    let days_since = last_attempt_at
        .and_then(|s| s.get(0..10))
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .and_then(|d| {
            chrono::NaiveDate::parse_from_str(today, "%Y-%m-%d")
                .ok()
                .map(|t| (t - d).num_days())
        })
        .unwrap_or(i64::MAX);

    // Forgetting curve: the longer since the last encounter, the more mastery decays.
    if days_since > 7 {
        score *= (1.0 - 0.06 * (days_since - 7) as f64).max(0.45);
    }
    // If a large share of the unit is already due, assume active forgetting.
    if due_ratio > 0.4 {
        score *= 0.92;
    } else if due_ratio > 0.2 {
        score *= 0.97;
    }
    Some(score.clamp(0.0, 100.0))
}

fn mastery_evidence_summary(
    attempt_count: i64,
    retest_correct_count: i64,
    source_counts: [i64; 5],
) -> (String, Vec<String>) {
    let labels = ["屏幕判定", "人工确认", "Codex", "自评", "旧记录"];
    let sources = labels
        .into_iter()
        .zip(source_counts)
        .filter_map(|(label, count)| (count > 0).then(|| format!("{label} {count}")))
        .collect::<Vec<_>>();
    let level = if attempt_count == 0 {
        "无可评分证据"
    } else if retest_correct_count > 0 {
        "间隔后仍能做对"
    } else if attempt_count >= 3 {
        "多次独立作答"
    } else {
        "初步作答证据"
    };
    (level.into(), sources)
}

#[tauri::command]
fn get_mastery_map(state: State<AppState>) -> Result<Vec<MasteryChapter>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today_date = Local::now().date_naive();
    let today = today_date.to_string();
    let chapter_ratings = services::rating::chapter_ratings(&conn, today_date)?;
    let recent_start = (Local::now().date_naive() - Duration::days(6)).to_string();
    let mut stmt = conn
        .prepare(
            "WITH RECURSIVE cat_descendants(ancestor_id, descendant_id) AS (
               SELECT id, id FROM categories WHERE math1=1
               UNION ALL
               SELECT cd.ancestor_id, c.id
               FROM categories c
               JOIN cat_descendants cd ON c.parent_id = cd.descendant_id
               WHERE c.math1=1
             ), chapter_questions AS (
               SELECT DISTINCT c.id chapter_id,c.name chapter_name,c.root_name,c.sort_key,qc.question_id
               FROM categories c
               JOIN cat_descendants cd ON cd.ancestor_id = c.id
               JOIN question_categories qc ON qc.category_id = cd.descendant_id
               WHERE c.parent_id IN (SELECT id FROM categories WHERE depth=0 AND math1=1) AND c.math1=1
             ), attempt_stats AS (
               SELECT question_id,COUNT(*) raw_attempt_count,
                      SUM(CASE WHEN COALESCE(outcome,result)<>'uncertain' THEN 1 ELSE 0 END) attempt_count,
                      SUM(CASE WHEN COALESCE(outcome,result)='correct' THEN 1 ELSE 0 END) correct_attempts,
                      MAX(attempted_at) last_attempt_at,
                      SUM(CASE WHEN COALESCE(outcome,result)='correct' AND attempted_at>=?2 THEN 1 ELSE 0 END) recent_correct,
                      SUM(CASE WHEN COALESCE(outcome,result)<>'uncertain' AND attempted_at>=?2 THEN 1 ELSE 0 END) recent_attempts,
                      SUM(CASE WHEN mode='review' AND COALESCE(outcome,result)='correct' THEN 1 ELSE 0 END) retest_correct,
                      SUM(CASE WHEN evidence_source='digital_answer' THEN 1 ELSE 0 END) digital_count,
                      SUM(CASE WHEN evidence_source='manual_confirmed' THEN 1 ELSE 0 END) manual_count,
                      SUM(CASE WHEN evidence_source='codex' THEN 1 ELSE 0 END) codex_count,
                      SUM(CASE WHEN evidence_source='self_report' THEN 1 ELSE 0 END) self_report_count,
                      SUM(CASE WHEN evidence_source='legacy' OR evidence_source IS NULL THEN 1 ELSE 0 END) legacy_count
               FROM attempts GROUP BY question_id
             )
             SELECT cq.chapter_id,cq.chapter_name,cq.root_name,COUNT(DISTINCT cq.question_id) total,
                    SUM(CASE WHEN ast.raw_attempt_count IS NOT NULL THEN 1 ELSE 0 END) attempted,
                    COALESCE(SUM(ast.correct_attempts),0) correct_attempts,
                    COALESCE(SUM(ast.attempt_count),0) attempt_count,
                    SUM(CASE WHEN p.next_review<=?1 THEN 1 ELSE 0 END) due_count,
                    SUM(CASE WHEN p.mastery<=2 THEN 1 ELSE 0 END) weak_count,
                    COALESCE(SUM(ast.recent_correct),0) recent_correct,
                    COALESCE(SUM(ast.recent_attempts),0) recent_attempts,
                    MAX(ast.last_attempt_at) last_attempt_at,
                    COALESCE(SUM(ast.retest_correct),0) retest_correct,
                    COALESCE(SUM(ast.digital_count),0) digital_count,
                    COALESCE(SUM(ast.manual_count),0) manual_count,
                    COALESCE(SUM(ast.codex_count),0) codex_count,
                    COALESCE(SUM(ast.self_report_count),0) self_report_count,
                    COALESCE(SUM(ast.legacy_count),0) legacy_count
             FROM chapter_questions cq
             LEFT JOIN attempt_stats ast ON ast.question_id=cq.question_id
             LEFT JOIN progress p ON p.question_id=cq.question_id
             GROUP BY cq.chapter_id,cq.chapter_name,cq.root_name,cq.sort_key
             ORDER BY cq.root_name,cq.sort_key,cq.chapter_id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![today, recent_start], |r| {
            let chapter_id: i64 = r.get(0)?;
            let total: i64 = r.get(3)?;
            let attempted: i64 = r.get(4)?;
            let correct: i64 = r.get(5)?;
            let attempts: i64 = r.get(6)?;
            let due_count: i64 = r.get(7)?;
            let weak_count: i64 = r.get(8)?;
            let rating: Option<f64> = chapter_ratings.get(&chapter_id).copied();
            let recent_correct: i64 = r.get(9)?;
            let recent_attempts: i64 = r.get(10)?;
            let last_attempt_at: Option<String> = r.get(11)?;
            let retest_correct_count: i64 = r.get(12)?;
            let (evidence_level, evidence_sources) = mastery_evidence_summary(
                attempts,
                retest_correct_count,
                [r.get(13)?, r.get(14)?, r.get(15)?, r.get(16)?, r.get(17)?],
            );
            let coverage = if total > 0 {
                attempted as f64 / total as f64
            } else {
                0.0
            };
            let accuracy = if attempts > 0 {
                Some(correct as f64 / attempts as f64)
            } else {
                None
            };
            let due_ratio = if attempted > 0 {
                due_count as f64 / attempted as f64
            } else {
                0.0
            };
            let mastery_score = dynamic_mastery_score(
                attempted,
                attempts,
                correct,
                rating,
                recent_correct,
                recent_attempts,
                last_attempt_at.as_deref(),
                &today,
                due_ratio,
            );
            let evidence = if attempted == 0 {
                "尚未开始".into()
            } else if attempted < 3 {
                format!("仅 {attempted} 道样本，暂定掌握分")
            } else {
                let recent_desc = if recent_attempts > 0 {
                    format!("近 7 天 {recent_correct}/{recent_attempts} 正确")
                } else {
                    "近 7 天无作答".to_string()
                };
                let last_desc = match last_attempt_at.as_deref().and_then(|s| s.get(0..10)) {
                    Some(d) => format!("上次 {d}"),
                    None => "暂无记录".to_string(),
                };
                format!("{recent_desc} · {last_desc} · {attempted}/{total} 题有样本")
            };
            Ok(MasteryChapter {
                id: chapter_id,
                name: r.get(1)?,
                root_name: r.get(2)?,
                total,
                attempted,
                correct_attempts: correct,
                attempt_count: attempts,
                due_count,
                weak_count,
                coverage,
                accuracy,
                rating,
                mastery_score,
                evidence,
                evidence_level,
                evidence_sources,
                retest_correct_count,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_mastery_nodes(state: State<AppState>) -> Result<Vec<MasteryNode>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today_date = Local::now().date_naive();
    let today = today_date.to_string();
    let node_ratings = services::rating::node_ratings(&conn, today_date)?;
    let recent_start = (Local::now().date_naive() - Duration::days(6)).to_string();
    let mut stmt = conn
        .prepare(
            "WITH RECURSIVE ancestry(id,parent_id,chapter_id,name,path,root_name,depth) AS (
               SELECT id,parent_id,id,name,path,root_name,depth FROM categories c WHERE c.parent_id IN (SELECT id FROM categories WHERE depth=0 AND math1=1) AND math1=1
               UNION ALL
               SELECT c.id,c.parent_id,a.chapter_id,c.name,c.path,a.root_name,c.depth
               FROM categories c JOIN ancestry a ON c.parent_id=a.id WHERE c.math1=1
             ), cat_descendants(ancestor_id, descendant_id) AS (
               SELECT id, id FROM categories WHERE math1=1
               UNION ALL
               SELECT cd.ancestor_id, c.id
               FROM categories c
               JOIN cat_descendants cd ON c.parent_id = cd.descendant_id
               WHERE c.math1=1
             ), node_questions AS (
               SELECT DISTINCT a.id,a.parent_id,a.chapter_id,a.name,a.path,a.root_name,a.depth,qc.question_id
               FROM ancestry a
               JOIN cat_descendants cd ON cd.ancestor_id = a.id
               JOIN question_categories qc ON qc.category_id = cd.descendant_id
             ), attempt_stats AS (
               SELECT question_id,COUNT(*) raw_attempt_count,
                      SUM(CASE WHEN COALESCE(outcome,result)<>'uncertain' THEN 1 ELSE 0 END) attempt_count,
                      SUM(CASE WHEN COALESCE(outcome,result)='correct' THEN 1 ELSE 0 END) correct_attempts,
                      MAX(attempted_at) last_attempt_at,
                      SUM(CASE WHEN COALESCE(outcome,result)='correct' AND attempted_at>=?2 THEN 1 ELSE 0 END) recent_correct,
                      SUM(CASE WHEN COALESCE(outcome,result)<>'uncertain' AND attempted_at>=?2 THEN 1 ELSE 0 END) recent_attempts,
                      SUM(CASE WHEN mode='review' AND COALESCE(outcome,result)='correct' THEN 1 ELSE 0 END) retest_correct,
                      SUM(CASE WHEN evidence_source='digital_answer' THEN 1 ELSE 0 END) digital_count,
                      SUM(CASE WHEN evidence_source='manual_confirmed' THEN 1 ELSE 0 END) manual_count,
                      SUM(CASE WHEN evidence_source='codex' THEN 1 ELSE 0 END) codex_count,
                      SUM(CASE WHEN evidence_source='self_report' THEN 1 ELSE 0 END) self_report_count,
                      SUM(CASE WHEN evidence_source='legacy' OR evidence_source IS NULL THEN 1 ELSE 0 END) legacy_count
               FROM attempts GROUP BY question_id
             )
             SELECT nq.id,nq.parent_id,nq.chapter_id,nq.name,nq.path,nq.depth,COUNT(DISTINCT nq.question_id) total,
                    SUM(CASE WHEN ast.raw_attempt_count IS NOT NULL THEN 1 ELSE 0 END) attempted,
                    COALESCE(SUM(ast.attempt_count),0) attempt_count,
                    SUM(CASE WHEN p.next_review<=?1 THEN 1 ELSE 0 END) due_count,
                    SUM(CASE WHEN p.mastery<=2 THEN 1 ELSE 0 END) weak_count,
                    COALESCE(SUM(ast.correct_attempts),0) correct_attempts,
                    COALESCE(SUM(ast.recent_correct),0) recent_correct,
                    COALESCE(SUM(ast.recent_attempts),0) recent_attempts,
                    MAX(ast.last_attempt_at) last_attempt_at,
                    COALESCE(SUM(ast.retest_correct),0) retest_correct,
                    COALESCE(SUM(ast.digital_count),0) digital_count,
                    COALESCE(SUM(ast.manual_count),0) manual_count,
                    COALESCE(SUM(ast.codex_count),0) codex_count,
                    COALESCE(SUM(ast.self_report_count),0) self_report_count,
                    COALESCE(SUM(ast.legacy_count),0) legacy_count
             FROM node_questions nq
             LEFT JOIN attempt_stats ast ON ast.question_id=nq.question_id
             LEFT JOIN progress p ON p.question_id=nq.question_id
             GROUP BY nq.id,nq.parent_id,nq.chapter_id,nq.name,nq.path,nq.depth
             HAVING COUNT(*)>0
             ORDER BY nq.root_name,nq.chapter_id,nq.depth,nq.path",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![today, recent_start], |r| {
            let node_id: i64 = r.get(0)?;
            let total: i64 = r.get(6)?;
            let attempted: i64 = r.get(7)?;
            let attempts: i64 = r.get(8)?;
            let due_count: i64 = r.get(9)?;
            let weak_count: i64 = r.get(10)?;
            let correct: i64 = r.get(11)?;
            let rating: Option<f64> = node_ratings.get(&node_id).copied();
            let recent_correct: i64 = r.get(12)?;
            let recent_attempts: i64 = r.get(13)?;
            let last_attempt_at: Option<String> = r.get(14)?;
            let retest_correct_count: i64 = r.get(15)?;
            let (evidence_level, evidence_sources) = mastery_evidence_summary(
                attempts,
                retest_correct_count,
                [r.get(16)?, r.get(17)?, r.get(18)?, r.get(19)?, r.get(20)?],
            );
            let coverage = if total > 0 {
                attempted as f64 / total as f64
            } else {
                0.0
            };
            let accuracy = if attempts > 0 {
                Some(correct as f64 / attempts as f64)
            } else {
                None
            };
            let due_ratio = if attempted > 0 {
                due_count as f64 / attempted as f64
            } else {
                0.0
            };
            let mastery_score = dynamic_mastery_score(
                attempted,
                attempts,
                correct,
                rating,
                recent_correct,
                recent_attempts,
                last_attempt_at.as_deref(),
                &today,
                due_ratio,
            );
            Ok(MasteryNode {
                id: node_id,
                parent_id: r.get(1)?,
                chapter_id: r.get(2)?,
                name: r.get(3)?,
                path: r.get(4)?,
                depth: r.get(5)?,
                total,
                attempted,
                attempt_count: attempts,
                due_count,
                weak_count,
                coverage,
                accuracy,
                rating,
                mastery_score,
                evidence_level,
                evidence_sources,
                retest_correct_count,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_custom_queue(state: State<AppState>) -> Result<Vec<Question>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive().to_string();
    let sql = format!("{QUESTION_SELECT} JOIN custom_queue cq ON cq.question_id=q.id WHERE NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=q.id AND substr(at.attempted_at,1,10)=?1) GROUP BY q.id ORDER BY cq.position,cq.added_at");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([today], row_to_question)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_to_custom_queue(question_id: i64, state: State<AppState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM questions WHERE id=?1",
            [question_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err("题目不存在".into());
    }
    let position: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(position),0)+1 FROM custom_queue",
            [],
            |r| r.get(0),
        )
        .unwrap_or(1);
    conn.execute(
        "INSERT OR IGNORE INTO custom_queue(question_id,position,added_at) VALUES(?1,?2,?3)",
        params![question_id, position, Local::now().to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row("SELECT COUNT(*) FROM custom_queue", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_from_custom_queue(question_id: i64, state: State<AppState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM custom_queue WHERE question_id=?1",
        [question_id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row("SELECT COUNT(*) FROM custom_queue", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_custom_queue(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM custom_queue", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn add_supplemental_question(
    input: SupplementalQuestionInput,
    state: State<AppState>,
) -> Result<i64, String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO supplemental_questions(stem,correct_answer,explanation,source,question_type,category_path,image_paths_json,difficulty,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![input.stem,input.correct_answer,input.explanation,input.source,input.question_type,input.category_path,serde_json::to_string(&input.image_paths).map_err(|e|e.to_string())?,input.difficulty.clamp(1,3),Local::now().to_rfc3339()]
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn get_chapter_queue(
    category_id: i64,
    limit: usize,
    state: State<AppState>,
) -> Result<Vec<RecommendedQuestion>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    chapter_queue(&conn, category_id, limit)
}

#[tauri::command]
fn get_focus_queue(
    category_ids: Vec<i64>,
    limit: usize,
    state: State<AppState>,
) -> Result<Vec<RecommendedQuestion>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    focus_queue(&conn, &category_ids, limit)
}

#[tauri::command]
fn get_variant_queue(
    question_id: i64,
    limit: Option<usize>,
    state: State<AppState>,
) -> Result<Vec<RecommendedQuestion>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    variant_queue(&conn, question_id, limit.unwrap_or(3))
}

#[tauri::command]
fn set_focus_branches(category_ids: Vec<i64>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let json_val = if category_ids.is_empty() {
        String::new()
    } else {
        serde_json::to_string(&category_ids).map_err(|e| e.to_string())?
    };
    conn.execute(
        "INSERT OR REPLACE INTO settings(key,value) VALUES('current_focus_category_ids',?1)",
        [json_val],
    )
    .map_err(|e| e.to_string())?;
    if !category_ids.is_empty() {
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES('current_chapter_id','')",
            [],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn focus_queue(
    conn: &Connection,
    category_ids: &[i64],
    limit: usize,
) -> Result<Vec<RecommendedQuestion>, String> {
    if category_ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut path_conditions = Vec::new();
    let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();
    let mut names = Vec::new();

    for id in category_ids {
        if let Ok((name, path)) =
            conn.query_row("SELECT name, path FROM categories WHERE id=?1", [id], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
        {
            names.push(name);
            path_conditions.push("(cc.path = ? OR cc.path LIKE ? || ' / %')");
            params_vec.push(rusqlite::types::Value::Text(path.clone()));
            params_vec.push(rusqlite::types::Value::Text(path));
        }
    }

    if path_conditions.is_empty() {
        return Ok(Vec::new());
    }

    let today = Local::now().date_naive().to_string();
    let path_cond_str = path_conditions.join(" OR ");
    params_vec.push(rusqlite::types::Value::Text(today.clone()));
    params_vec.push(rusqlite::types::Value::Text(today));
    params_vec.push(rusqlite::types::Value::Integer(limit.min(100) as i64));

    let sql = format!(
        "{QUESTION_SELECT} WHERE EXISTS(SELECT 1 FROM question_categories qcc JOIN categories cc ON cc.id=qcc.category_id WHERE qcc.question_id=q.id AND ({path_cond_str})) AND NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=q.id AND substr(at.attempted_at,1,10)=?) GROUP BY q.id ORDER BY CASE WHEN COUNT(a.id)=0 THEN 0 WHEN p.next_review<=? THEN 1 WHEN COALESCE(p.mastery,0)<=2 THEN 2 ELSE 3 END, q.difficulty, q.id LIMIT ?"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params_vec), row_to_question)
        .map_err(|e| e.to_string())?;

    let reason_label = if names.len() == 1 {
        format!("专项训练 · {}", names[0])
    } else if names.len() <= 3 {
        format!("专项训练 · {}", names.join(" + "))
    } else {
        format!("专项训练 · 已选 {} 个子考点", names.len())
    };

    rows.map(|q| {
        q.map(|question| RecommendedQuestion {
            question,
            score: 100.0,
            reason: reason_label.clone(),
            reason_code: "focus_branch".into(),
            question_role: None,
        })
    })
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

fn variant_queue(
    conn: &Connection,
    question_id: i64,
    limit: usize,
) -> Result<Vec<RecommendedQuestion>, String> {
    let limit = limit.clamp(1, 20);
    let today = Local::now().date_naive().to_string();

    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.path, c.depth
             FROM question_categories qc
             JOIN categories c ON qc.category_id = c.id
             WHERE qc.question_id = ?1 AND c.math1 = 1
             ORDER BY c.depth DESC",
        )
        .map_err(|e| e.to_string())?;

    let cats: Vec<(i64, String, String, i64)> = stmt
        .query_map([question_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if cats.is_empty() {
        return Ok(Vec::new());
    }

    let target_cat = &cats[0];
    let reason_label = format!("同考点变式巩固 · {}", target_cat.1);

    let query_sql = format!(
        "{QUESTION_SELECT}
         JOIN question_categories qc ON qc.question_id = q.id
         JOIN categories c ON qc.category_id = c.id
         WHERE (c.path = ?1 OR c.path LIKE ?1 || ' / %')
           AND q.id != ?2
           AND NOT EXISTS (
               SELECT 1 FROM attempts a
               WHERE a.question_id = q.id AND substr(a.attempted_at, 1, 10) = ?3
           )
         GROUP BY q.id
         ORDER BY (CASE WHEN p.mastery <= 2 THEN 0 WHEN p.question_id IS NULL THEN 1 ELSE 2 END),
                  q.difficulty,
                  RANDOM()
         LIMIT ?4"
    );

    let mut q_stmt = conn.prepare(&query_sql).map_err(|e| e.to_string())?;
    let mut questions = q_stmt
        .query_map(
            params![target_cat.2, question_id, today, limit as i64],
            row_to_question,
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if questions.len() < limit && cats.len() > 1 {
        let parent_cat = &cats[1];
        let remaining = limit - questions.len();
        let existing_ids: Vec<i64> = questions.iter().map(|q| q.id).collect();
        let fallback_sql = format!(
            "{QUESTION_SELECT}
             JOIN question_categories qc ON qc.question_id = q.id
             JOIN categories c ON qc.category_id = c.id
             WHERE (c.path = ?1 OR c.path LIKE ?1 || ' / %')
               AND q.id != ?2
               AND NOT EXISTS (
                   SELECT 1 FROM attempts a
                   WHERE a.question_id = q.id AND substr(a.attempted_at, 1, 10) = ?3
               )
             GROUP BY q.id
             ORDER BY (CASE WHEN p.mastery <= 2 THEN 0 WHEN p.question_id IS NULL THEN 1 ELSE 2 END),
                      q.difficulty,
                      RANDOM()
             LIMIT ?4"
        );
        let mut fb_stmt = conn.prepare(&fallback_sql).map_err(|e| e.to_string())?;
        let more = fb_stmt
            .query_map(
                params![parent_cat.2, question_id, today, (remaining + 5) as i64],
                row_to_question,
            )
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for q in more {
            if questions.len() >= limit {
                break;
            }
            if !existing_ids.contains(&q.id) {
                questions.push(q);
            }
        }
    }

    Ok(questions
        .into_iter()
        .map(|question| RecommendedQuestion {
            question,
            score: 100.0,
            reason: reason_label.clone(),
            reason_code: "variant_practice".into(),
            question_role: None,
        })
        .collect())
}

fn chapter_queue(
    conn: &Connection,
    category_id: i64,
    limit: usize,
) -> Result<Vec<RecommendedQuestion>, String> {
    let (path, root_name): (String, String) = conn
        .query_row(
            "SELECT path, root_name FROM categories WHERE id=?1",
            [category_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let today = Local::now().date_naive().to_string();
    let sql=format!("{QUESTION_SELECT} WHERE EXISTS(SELECT 1 FROM question_categories qcc JOIN categories cc ON cc.id=qcc.category_id WHERE qcc.question_id=q.id AND (cc.path=?1 OR cc.path LIKE ?1||' / %')) AND NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=q.id AND substr(at.attempted_at,1,10)=?2) GROUP BY q.id ORDER BY CASE WHEN COUNT(a.id)=0 THEN 0 WHEN p.next_review<=?2 THEN 1 WHEN COALESCE(p.mastery,0)<=2 THEN 2 ELSE 3 END,q.difficulty,q.id LIMIT ?3");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![path, today, limit.min(100) as i64], row_to_question)
        .map_err(|e| e.to_string())?;
    rows.map(|q| {
        q.map(|question| RecommendedQuestion {
            question,
            score: 100.0,
            reason: format!("当前章节首轮 · {root_name}"),
            reason_code: "chapter".into(),
            question_role: None,
        })
    })
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

fn review_queue(conn: &Connection, limit: usize) -> Result<Vec<RecommendedQuestion>, String> {
    let today = Local::now().date_naive().to_string();
    let sql = format!(
        "{QUESTION_SELECT} WHERE p.next_review<=?1 AND NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=q.id AND substr(at.attempted_at,1,10)=?1) GROUP BY q.id ORDER BY ((julianday(?1) - julianday(p.next_review) + 1.0) * (CASE WHEN q.difficulty=3 THEN 1.5 WHEN q.difficulty=2 THEN 1.2 ELSE 1.0 END)) DESC, p.next_review ASC, q.difficulty DESC, q.id ASC LIMIT ?2"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![today, limit.min(100) as i64], row_to_question)
        .map_err(|e| e.to_string())?;
    rows.map(|row| {
        row.map(|question| RecommendedQuestion {
            question,
            score: 110.0,
            reason: "今天到期，按遗忘节奏复习".into(),
            reason_code: "due".into(),
            question_role: None,
        })
    })
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

fn review_history(conn: &Connection) -> Result<ReviewHistory, String> {
    let today = Local::now().date_naive();
    let first_day = (today - Duration::days(6)).to_string();
    let mut days = Vec::with_capacity(7);
    for offset in (0..7).rev() {
        let date = (today - Duration::days(offset)).to_string();
        let (count, correct_count) = conn
            .query_row(
                "SELECT COUNT(*),COALESCE(SUM(CASE WHEN result='correct' THEN 1 ELSE 0 END),0) FROM attempts WHERE mode='review' AND substr(attempted_at,1,10)=?1",
                [&date],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;
        days.push(ReviewDay {
            date,
            count,
            correct_count,
        });
    }
    let mut stmt = conn
        .prepare(
            "SELECT a.id,a.question_id,a.attempted_at,q.stem,q.category_path,q.source,a.result,a.self_rating FROM attempts a JOIN questions q ON q.id=a.question_id WHERE a.mode='review' AND substr(a.attempted_at,1,10)>=?1 ORDER BY a.attempted_at DESC,a.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([first_day], |row| {
            Ok(ReviewHistoryItem {
                attempt_id: row.get(0)?,
                question_id: row.get(1)?,
                attempted_at: row.get(2)?,
                stem: row.get(3)?,
                category_path: row.get(4)?,
                source: row.get(5)?,
                result: row.get(6)?,
                self_rating: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(ReviewHistory {
        days,
        items: rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TodayAttemptItem {
    pub(crate) attempt_id: i64,
    pub(crate) question_id: i64,
    pub(crate) outcome: String,
    pub(crate) self_rating: i64,
    pub(crate) duration_seconds: i64,
    pub(crate) attempted_at: String,
    pub(crate) session_id: Option<String>,
    pub(crate) question: Question,
}

#[tauri::command]
fn get_today_attempted_questions(state: State<AppState>) -> Result<Vec<TodayAttemptItem>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive().to_string();
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.question_id, COALESCE(a.outcome, a.result, 'wrong'), COALESCE(a.self_rating, 2), COALESCE(a.duration_seconds, 30), a.attempted_at, a.session_id
             FROM attempts a
             WHERE substr(a.attempted_at, 1, 10) = ?1
             ORDER BY a.id DESC"
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&today], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, Option<String>>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for (attempt_id, q_id, outcome, self_rating, duration, attempted_at, session_id) in rows {
        if let Ok(q) = question_by_id(&conn, q_id) {
            result.push(TodayAttemptItem {
                attempt_id,
                question_id: q_id,
                outcome,
                self_rating,
                duration_seconds: duration,
                attempted_at,
                session_id,
                question: q,
            });
        }
    }

    Ok(result)
}

#[derive(Default)]
struct AiSignal {
    verdict: Option<String>,
    summary: Option<String>,
    earliest_error: Option<String>,
    error_tags: Vec<String>,
    weakness_tags: Vec<String>,
    advice: Option<String>,
    confidence: Option<f64>,
    confirmed_at: Option<String>,
}

fn collect_ai_signals(conn: &Connection) -> Result<HashMap<i64, AiSignal>, String> {
    let mut signals: HashMap<i64, AiSignal> = HashMap::new();
    let payload_rows = {
        let mut stmt = conn
            .prepare(
                "SELECT payload_json,created_at FROM codex_inbox WHERE status='confirmed' AND kind IN ('analysis','batch') ORDER BY created_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        mapped
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    for (raw, created_at) in payload_rows {
        let Ok(payload) = serde_json::from_str::<CodexPayload>(&raw) else {
            continue;
        };
        if payload.kind == "analysis" {
            if let Some(question_id) = payload.question_id {
                let entry = signals.entry(question_id).or_default();
                if entry.confirmed_at.is_none() {
                    entry.confirmed_at = Some(created_at.clone());
                    entry.verdict = payload.verdict;
                    entry.summary = Some(payload.summary);
                    entry.earliest_error = payload.earliest_error;
                    entry.error_tags = payload.error_tags;
                    entry.weakness_tags = payload.weakness_tags;
                    entry.advice = payload.advice;
                    entry.confidence = Some(payload.confidence);
                }
            }
        } else if payload.kind == "batch" {
            for attempt in &payload.batch_attempts {
                let entry = signals.entry(attempt.question_id).or_default();
                if entry.confirmed_at.is_none() {
                    entry.confirmed_at = Some(created_at.clone());
                    entry.verdict = attempt.verdict.clone();
                    entry.summary = Some(attempt.summary.clone());
                    entry.earliest_error = attempt.earliest_error.clone();
                    entry.error_tags = attempt.error_tags.clone();
                    entry.weakness_tags = attempt.weakness_tags.clone();
                    entry.advice = attempt.advice.clone();
                    entry.confidence = Some(attempt.confidence);
                }
            }
        }
    }
    let confirmed_rows = {
        let mut stmt = conn
            .prepare(
                "SELECT question_id,error_tags_json,weakness_tags_json,confidence,confirmed_at FROM codex_analysis_signals ORDER BY confirmed_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        mapped
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    for (question_id, error_tags_json, weakness_tags_json, confidence, confirmed_at) in
        confirmed_rows
    {
        let entry = signals.entry(question_id).or_default();
        if entry
            .confirmed_at
            .as_deref()
            .map(|time| time < confirmed_at.as_str())
            .unwrap_or(true)
        {
            entry.confirmed_at = Some(confirmed_at);
            entry.error_tags = serde_json::from_str(&error_tags_json).unwrap_or_default();
            entry.weakness_tags = serde_json::from_str(&weakness_tags_json).unwrap_or_default();
            entry.confidence = Some(confidence);
        }
    }
    Ok(signals)
}

fn daily_log(conn: &Connection) -> Result<DailyLog, String> {
    let signals = collect_ai_signals(conn)?;
    let rows = {
        let mut stmt = conn
            .prepare(
                "SELECT q.id,q.stem,q.category_path,q.source,a.result,a.self_rating,a.mode,a.attempted_at FROM attempts a JOIN questions q ON q.id=a.question_id ORDER BY a.attempted_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, i32>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, String>(7)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        mapped
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    let mut days: Vec<DailyLogDay> = Vec::new();
    let mut items: Vec<DailyLogItem> = Vec::new();
    for (question_id, stem, category_path, source, result, self_rating, mode, attempted_at) in rows
    {
        let date = attempted_at.get(0..10).unwrap_or("").to_string();
        match days.last_mut() {
            Some(day) if day.date == date => {
                day.count += 1;
                if result == "correct" {
                    day.correct_count += 1;
                }
            }
            _ => days.push(DailyLogDay {
                date,
                count: 1,
                correct_count: if result == "correct" { 1 } else { 0 },
            }),
        }
        let signal = signals.get(&question_id);
        items.push(DailyLogItem {
            question_id,
            stem,
            category_path,
            source,
            result,
            self_rating,
            mode,
            attempted_at,
            ai_verdict: signal.and_then(|s| s.verdict.clone()),
            ai_summary: signal.and_then(|s| s.summary.clone()),
            ai_earliest_error: signal.and_then(|s| s.earliest_error.clone()),
            ai_error_tags: signal.map(|s| s.error_tags.clone()).unwrap_or_default(),
            ai_weakness_tags: signal.map(|s| s.weakness_tags.clone()).unwrap_or_default(),
            ai_advice: signal.and_then(|s| s.advice.clone()),
            ai_confidence: signal.and_then(|s| s.confidence),
            ai_confirmed_at: signal.and_then(|s| s.confirmed_at.clone()),
        });
    }
    items.reverse();
    Ok(DailyLog { days, items })
}

fn review_plan(conn: &Connection) -> Result<ReviewPlan, String> {
    let today = Local::now().date_naive();
    let today_text = today.to_string();
    let last_day = (today + Duration::days(6)).to_string();
    let mut days = Vec::with_capacity(7);
    for offset in 0..7 {
        let date = (today + Duration::days(offset)).to_string();
        let count: i64 = if offset == 0 {
            conn.query_row(
                "SELECT COUNT(*) FROM progress p WHERE p.next_review<=?1 AND NOT EXISTS(SELECT 1 FROM attempts a WHERE a.question_id=p.question_id AND substr(a.attempted_at,1,10)=?1)",
                [&date],
                |row| row.get(0),
            )
        } else {
            conn.query_row(
                "SELECT COUNT(*) FROM progress WHERE next_review=?1",
                [&date],
                |row| row.get(0),
            )
        }
        .map_err(|e| e.to_string())?;
        days.push(ReviewPlanDay { date, count });
    }
    let mut stmt = conn
        .prepare(
            "SELECT q.id,q.stem,q.category_path,q.source,CASE WHEN p.next_review<=?1 THEN ?1 ELSE p.next_review END,p.next_review,p.mastery FROM progress p JOIN questions q ON q.id=p.question_id WHERE p.next_review<=?2 AND (p.next_review>?1 OR NOT EXISTS(SELECT 1 FROM attempts a WHERE a.question_id=p.question_id AND substr(a.attempted_at,1,10)=?1)) ORDER BY CASE WHEN p.next_review<=?1 THEN 0 ELSE 1 END,p.next_review,q.id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![today_text, last_day], |row| {
            Ok(ReviewPlanItem {
                question_id: row.get(0)?,
                stem: row.get(1)?,
                category_path: row.get(2)?,
                source: row.get(3)?,
                scheduled_date: row.get(4)?,
                next_review: row.get(5)?,
                self_rating: row.get::<_, Option<i32>>(6)?.unwrap_or(1),
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(ReviewPlan {
        days,
        items: rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?,
    })
}

#[tauri::command]
fn get_review_queue(
    limit: usize,
    state: State<AppState>,
) -> Result<Vec<RecommendedQuestion>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    review_queue(&conn, limit)
}

#[tauri::command]
fn get_review_history(state: State<AppState>) -> Result<ReviewHistory, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    review_history(&conn)
}

#[tauri::command]
fn get_daily_log(state: State<AppState>) -> Result<DailyLog, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    daily_log(&conn)
}

#[tauri::command]
fn get_review_plan(state: State<AppState>) -> Result<ReviewPlan, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    review_plan(&conn)
}

#[tauri::command]
fn set_current_chapter(category_id: Option<i64>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings(key,value) VALUES('current_focus_category_ids','')",
        [],
    )
    .map_err(|e| e.to_string())?;
    if let Some(id) = category_id {
        let valid: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE id=?1 AND parent_id IN (SELECT id FROM categories WHERE depth=0 AND math1=1) AND math1=1",
                [id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if valid == 0 {
            return Err("只能选择数一的一级章节".into());
        }
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES('current_chapter_id',?1)",
            [id.to_string()],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES('current_chapter_id','')",
            [],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_question(id: i64, state: State<AppState>) -> Result<Question, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    question_by_id(&conn, id)
}

#[tauri::command]
fn get_recommendations(
    limit: usize,
    state: State<AppState>,
) -> Result<Vec<RecommendedQuestion>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    // If an AI batch is active, it always wins over chapter mode.
    if active_recommendation_queue(&conn)?.is_some() {
        return recommendations(&conn, limit.min(50));
    }
    // Check multi-branch focus category IDs first
    let focus_json = setting(&conn, "current_focus_category_ids", "");
    if let Ok(ids) = serde_json::from_str::<Vec<i64>>(&focus_json) {
        if !ids.is_empty() {
            let queue = focus_queue(&conn, &ids, limit.min(50))?;
            if !queue.is_empty() {
                return Ok(queue);
            }
        }
    }
    // Keep chapter-first mode alive when the current queue runs out.
    if let Some(id) = setting(&conn, "current_chapter_id", "").parse::<i64>().ok() {
        return chapter_queue(&conn, id, limit.min(50));
    }
    recommendations(&conn, limit.min(50))
}

#[tauri::command]
fn record_attempt(
    input: AttemptInput,
    state: State<AppState>,
) -> Result<RecordAttemptResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let attempt_id = record_attempt_row(&conn, &input)?;
    // A completed AI batch becomes the immutable input for the next AI round.
    // Export failure must never roll back the user's attempt.
    if let Err(error) = write_completed_recommendation_contexts(&conn, &state.data_dir) {
        eprintln!("recommendation result context export skipped: {error}");
    }
    let question = question_by_id(&conn, input.question_id)?;
    Ok(RecordAttemptResult {
        question,
        attempt_id,
    })
}

#[tauri::command]
fn undo_last_attempt(question_id: i64, state: State<AppState>) -> Result<Question, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    undo_last_attempt_row(&conn, question_id)?;
    question_by_id(&conn, question_id)
}

fn undo_last_attempt_row(conn: &Connection, question_id: i64) -> Result<(), String> {
    let now = Local::now().to_rfc3339();
    let today = Local::now().date_naive().to_string();
    let deleted = conn
        .execute(
            "DELETE FROM attempts WHERE id IN (
               SELECT id FROM attempts WHERE question_id=?1 AND substr(attempted_at,1,10)=?2
               ORDER BY id DESC LIMIT 1
             )",
            params![question_id, today],
        )
        .map_err(|e| e.to_string())?;
    if deleted == 0 {
        return Err("今天还没有为这道题提交过记录，无法撤销".into());
    }
    recompute_progress_after_removal(conn, question_id, &now)?;
    let target_batch: Option<String> = conn
        .query_row(
            "SELECT task_id FROM recommendation_batch_items WHERE question_id=?1 AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1",
            [question_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if let Some(task_id) = target_batch {
        conn.execute(
            "UPDATE recommendation_batch_items
             SET completed_at=NULL,attempt_id=NULL,result=NULL,outcome=NULL,self_rating=NULL,
                 duration_seconds=NULL,attempt_mode=NULL,evidence_source=NULL
             WHERE task_id=?1 AND question_id=?2",
            params![task_id, question_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE recommendation_batches SET status='active',completed_at=NULL
             ,result_context_path=NULL,result_exported_at=NULL
             WHERE task_id=?1 AND status='completed'",
            params![task_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn recompute_progress_after_removal(
    conn: &Connection,
    question_id: i64,
    now: &str,
) -> Result<(), String> {
    let latest: Option<(String, i32)> = conn
        .query_row(
            "SELECT attempted_at,self_rating FROM attempts WHERE question_id=?1 ORDER BY id DESC LIMIT 1",
            [question_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let review_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM attempts WHERE question_id=?1",
            [question_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let today = Local::now().date_naive();
    let has_remaining = latest.is_some();
    let (mastery, last_attempt_at, next_review) = match latest {
        Some((attempted, rating)) => {
            let intervals = review_intervals(conn);
            let days = match rating {
                1 => intervals[0],
                2 => intervals[1],
                3 => intervals[2],
                _ => intervals[3],
            };
            let date = attempted
                .chars()
                .take(10)
                .collect::<String>()
                .parse::<chrono::NaiveDate>()
                .unwrap_or(today);
            (
                Some(rating),
                Some(attempted),
                Some((date + Duration::days(days)).to_string()),
            )
        }
        None => (None, None, None),
    };
    conn.execute(
        "INSERT INTO progress(question_id,mastery,last_attempt_at,next_review,review_count) VALUES(?1,?2,?3,?4,?5)
         ON CONFLICT(question_id) DO UPDATE SET mastery=excluded.mastery,last_attempt_at=excluded.last_attempt_at,next_review=excluded.next_review,review_count=excluded.review_count",
        params![question_id, mastery, last_attempt_at, next_review, review_count],
    )
    .map_err(|e| e.to_string())?;
    if !has_remaining {
        // Keep the progress row if it still carries a favorite or a personal
        // note – those are user intent, not derived state.
        conn.execute(
            "DELETE FROM progress WHERE question_id=?1 AND favorite=0 AND (note IS NULL OR note='')",
            [question_id],
        )
        .map_err(|e| e.to_string())?;
    }
    let _ = now;
    Ok(())
}

fn review_intervals(conn: &Connection) -> [i64; 4] {
    let mut result = [1, 3, 7, 15];
    for (index, key) in [
        "review_interval_1",
        "review_interval_2",
        "review_interval_3",
        "review_interval_4",
    ]
    .iter()
    .enumerate()
    {
        if let Ok(value) = setting(conn, key, "").parse::<i64>() {
            result[index] = value.clamp(1, 180);
        }
    }
    result
}

#[tauri::command]
fn claim_reward_event(
    state: State<AppState>,
    event_id: String,
    reward_type: String,
    amount: i64,
    meta_json: Option<String>,
) -> Result<RewardSummary, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = Local::now().to_rfc3339();
    let rows_affected = conn.execute(
        "INSERT OR IGNORE INTO reward_events(event_id, reward_type, amount, meta_json, created_at) VALUES(?1, ?2, ?3, ?4, ?5)",
        params![event_id, reward_type, amount, meta_json, now],
    ).map_err(|e| e.to_string())?;

    let total_claimed: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM reward_events",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(RewardSummary {
        total_claimed_exp: total_claimed,
        newly_claimed: rows_affected > 0,
        event_id,
    })
}

#[tauri::command]
fn get_reward_events(state: State<AppState>) -> Result<Vec<RewardEvent>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT event_id, reward_type, amount, meta_json, created_at FROM reward_events ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(RewardEvent {
                event_id: r.get(0)?,
                reward_type: r.get(1)?,
                amount: r.get(2)?,
                meta_json: r.get(3)?,
                created_at: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn save_practice_session_row(
    conn: &Connection,
    input: &PracticeSessionInput,
) -> Result<(), String> {
    if input.question_ids.is_empty() {
        conn.execute("DELETE FROM practice_sessions WHERE id=1", [])
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    if input.question_ids.len() != input.reasons.len()
        || input.question_ids.len() != input.reason_codes.len()
        || input.question_ids.len() != input.scores.len()
    {
        return Err("会话队列字段长度不一致".into());
    }
    let queue: Vec<PracticeSessionQueueItem> = input
        .question_ids
        .iter()
        .enumerate()
        .map(|(index, question_id)| PracticeSessionQueueItem {
            question_id: *question_id,
            reason: input.reasons[index].clone(),
            reason_code: input.reason_codes[index].clone(),
            score: input.scores[index],
        })
        .collect();
    let queue_json = serde_json::to_string(&queue).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO practice_sessions(id,queue_json,current_index,attempt_mode,saved_at)
         VALUES(1,?1,?2,?3,?4)
         ON CONFLICT(id) DO UPDATE SET queue_json=excluded.queue_json,current_index=excluded.current_index,attempt_mode=excluded.attempt_mode,saved_at=excluded.saved_at",
        params![
            queue_json,
            input.current_index.min(input.question_ids.len().saturating_sub(1)) as i64,
            input.attempt_mode,
            Local::now().to_rfc3339()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn load_practice_session_row(conn: &Connection) -> Result<Option<PracticeSessionState>, String> {
    let stored: Option<(String, i64, String, String)> = conn
        .query_row(
            "SELECT queue_json,current_index,attempt_mode,saved_at FROM practice_sessions WHERE id=1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some((queue_json, current_index, attempt_mode, saved_at)) = stored else {
        return Ok(None);
    };
    let descriptors: Vec<PracticeSessionQueueItem> =
        serde_json::from_str(&queue_json).map_err(|e| e.to_string())?;
    let mut queue = Vec::with_capacity(descriptors.len());
    for item in descriptors {
        if let Ok(question) = question_by_id(conn, item.question_id) {
            queue.push(RecommendedQuestion {
                question,
                score: item.score,
                reason: item.reason,
                reason_code: item.reason_code,
                question_role: None,
            });
        }
    }
    if queue.is_empty() {
        conn.execute("DELETE FROM practice_sessions WHERE id=1", [])
            .map_err(|e| e.to_string())?;
        return Ok(None);
    }
    Ok(Some(PracticeSessionState {
        current_index: (current_index.max(0) as usize).min(queue.len() - 1),
        queue,
        attempt_mode,
        saved_at,
    }))
}

#[tauri::command]
fn save_practice_session(
    input: PracticeSessionInput,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    save_practice_session_row(&conn, &input)
}

#[tauri::command]
fn load_practice_session(state: State<AppState>) -> Result<Option<PracticeSessionState>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    load_practice_session_row(&conn)
}

#[tauri::command]
fn clear_practice_session(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM practice_sessions WHERE id=1", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn inspect_database_backup(source_path: &Path) -> Result<(i64, i64), String> {
    let test_conn =
        Connection::open_with_flags(source_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("备份文件无法作为有效 SQLite 数据库打开: {e}"))?;
    let integrity: String = test_conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|e| format!("备份完整性检查失败: {e}"))?;
    if integrity != "ok" {
        return Err(format!("备份完整性检查失败: {integrity}"));
    }
    for required_table in ["attempts", "progress", "settings"] {
        let exists: i64 = test_conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [required_table],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Err(format!("备份缺少必要数据表: {required_table}"));
        }
    }
    let attempts_count = test_conn
        .query_row("SELECT COUNT(*) FROM attempts", [], |row| row.get(0))
        .map_err(|e| format!("无法读取备份作答记录: {e}"))?;
    let progress_count = test_conn
        .query_row("SELECT COUNT(*) FROM progress", [], |row| row.get(0))
        .map_err(|e| format!("无法读取备份进度记录: {e}"))?;
    Ok((attempts_count, progress_count))
}

#[tauri::command]
fn restore_database_backup(
    state: State<AppState>,
    backup_path: String,
) -> Result<RestoreResult, String> {
    let source_path = PathBuf::from(&backup_path);
    if !source_path.exists() {
        return Err(format!("备份文件不存在: {backup_path}"));
    }

    let (attempts_count, progress_count) = inspect_database_backup(&source_path)?;

    let current_db_path = state.data_dir.join("shuaba.db");
    let backups_dir = state.data_dir.join("backups");
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    let stamp = Local::now().format("%Y%m%d-%H%M%S-%3f");
    let pre_restore_backup = backups_dir.join(format!("pre-restore-{stamp}.db"));
    let staged_path = state.data_dir.join(format!("restore-staged-{stamp}.db"));
    let replaced_path = state.data_dir.join(format!("restore-replaced-{stamp}.db"));

    fs::copy(&source_path, &staged_path).map_err(|e| format!("无法创建恢复暂存副本: {e}"))?;
    let staged_result = (|| -> Result<(), String> {
        let staged_conn = Connection::open(&staged_path).map_err(|e| e.to_string())?;
        init_schema(&staged_conn).map_err(|e| e.to_string())?;
        migrate_schema(&staged_conn).map_err(|e| e.to_string())?;
        let integrity: String = staged_conn
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        if integrity != "ok" {
            return Err(format!("迁移后完整性检查失败: {integrity}"));
        }
        Ok(())
    })();
    if let Err(error) = staged_result {
        let _ = fs::remove_file(&staged_path);
        return Err(format!("恢复预检失败，当前数据库未更改: {error}"));
    }

    let mut conn_guard = state.db.lock().map_err(|e| e.to_string())?;
    conn_guard
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| format!("恢复前无法完成数据库检查点: {e}"))?;
    if current_db_path.exists() {
        fs::copy(&current_db_path, &pre_restore_backup)
            .map_err(|e| format!("无法创建恢复前安全快照: {e}"))?;
    }
    let old_conn = std::mem::replace(
        &mut *conn_guard,
        Connection::open_in_memory().map_err(|e| e.to_string())?,
    );
    drop(old_conn);
    for suffix in ["-wal", "-shm"] {
        let _ = fs::remove_file(format!("{}{}", current_db_path.to_string_lossy(), suffix));
    }

    if current_db_path.exists() {
        fs::rename(&current_db_path, &replaced_path)
            .map_err(|e| format!("无法暂存当前数据库: {e}"))?;
    }
    if let Err(error) = fs::rename(&staged_path, &current_db_path) {
        if replaced_path.exists() {
            let _ = fs::rename(&replaced_path, &current_db_path);
        }
        *conn_guard = Connection::open(&current_db_path).map_err(|e| e.to_string())?;
        return Err(format!("无法切换至恢复数据库，已保留当前数据库: {error}"));
    }

    match Connection::open(&current_db_path) {
        Ok(restored_conn) => {
            *conn_guard = restored_conn;
            let _ = fs::remove_file(&replaced_path);
        }
        Err(error) => {
            let _ = fs::remove_file(&current_db_path);
            if replaced_path.exists() {
                fs::rename(&replaced_path, &current_db_path)
                    .map_err(|rollback| format!("恢复失败且回退失败: {error}; {rollback}"))?;
            }
            *conn_guard = Connection::open(&current_db_path).map_err(|e| e.to_string())?;
            return Err(format!("恢复失败，已回退当前数据库: {error}"));
        }
    }

    Ok(RestoreResult {
        success: true,
        pre_restore_backup_path: pre_restore_backup.to_string_lossy().into_owned(),
        message: format!(
            "数据库已成功恢复：包含 {attempts_count} 条作答与 {progress_count} 条进度记录"
        ),
        restored_attempts: attempts_count,
        restored_progress: progress_count,
    })
}

#[tauri::command]
fn list_database_backups(state: State<AppState>) -> Result<Vec<BackupInfo>, String> {
    let mut list = Vec::new();
    let backups_dir = state.data_dir.join("backups");
    let rolling_dir = backups_dir.join("rolling");

    for dir in &[backups_dir, rolling_dir] {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("db") {
                    let file_name = path
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();
                    let metadata = entry.metadata().ok();
                    let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                    let modified = metadata
                        .and_then(|m| m.modified().ok())
                        .map(|t| chrono::DateTime::<Local>::from(t).to_rfc3339())
                        .unwrap_or_default();
                    let backup_type = if file_name.contains("startup") {
                        "startup_rolling".into()
                    } else if file_name.contains("pre-restore") {
                        "pre_restore".into()
                    } else {
                        "manual_export".into()
                    };
                    list.push(BackupInfo {
                        file_name,
                        path: path.to_string_lossy().into_owned(),
                        size_bytes,
                        created_at: modified,
                        backup_type,
                    });
                }
            }
        }
    }
    list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(list)
}

/// CS-Premier-style career ELO. Every graded attempt settles like a match:
/// `delta = K * (performance - expected)`. Expected performance derives from
/// the question difficulty and your mastery of its chapter — beating a hard
/// question in a weak chapter pays much more than stomping an easy one.
/// Consecutive same-direction results apply a momentum multiplier, and a
/// fresh promotion grants three settlements of loss protection.
/// 完美平台式天梯分：千位刻度，定级起点 1400（C 段），每题结算 ±5-15 分，
/// 九段 D→S 每 200 分一段。历史万位分已按 1400 + (old-10000)×0.1 迁移。
const ELO_START: f64 = 1400.0;
const ELO_K_CALIBRATION: f64 = 30.0;
const ELO_CALIBRATION_SETTLEMENTS: i64 = 10;
const ELO_K: f64 = 10.0;
/// 期望基准：均值性能（Rating 1.00 折算 score 0.50）对应基准期望 0.50；
/// 掌握度越高（熟题）期望略微提高 +0.04；难度系数越大（难题）期望降低，收敛到 [0.20, 0.80]。
///
/// 难度步长校准记录（v1.6.8）：原值 0.25 使难度杠杆形同虚设——难度系数实际只落在
/// 0.94~1.10 区间，对期望的影响仅 ±0.04，导致「攻克难题收益最大」的设计意图完全失效
/// （实测最难题与最易题的期望差仅 0.073）。放大到 2.50 后，同样区间可产生 ±0.40 的
/// 真实差距：简单题做对几乎不涨分、做错重罚；难题做对大涨、做错轻罚。
const ELO_EXPECTED_BASE: f64 = 0.50;
const ELO_EXPECTED_MASTERY_STEP: f64 = 0.04;
const ELO_EXPECTED_DIFFICULTY_STEP: f64 = 2.50;
const ELO_EXPECTED_MIN: f64 = 0.20;
const ELO_EXPECTED_MAX: f64 = 0.80;
const ELO_REVIEW_BONUS: f64 = 0.06;
const ELO_MOMENTUM_MULTIPLIER: f64 = 1.15;
const ELO_MOMENTUM_MIN_STREAK: usize = 3;
const ELO_PROMOTION_PROTECTION: i64 = 3;

/// 结果闸门：防止 ELO 退化为「打卡计数器」。
///
/// 背景（v1.6.8 修复）：实测 94 次结算中做对 44 次**全部涨分、零次扣分**，
/// 做错 50 次里仍有 24 次（48%）在涨分，ELO 呈单向棘轮——同期正确率从 75% 跌到
/// 37.5%，天梯分反而从 1455 涨到 1612。根因是 performance 分布中心（≈1.30）远高于
/// expected 基线（≈0.50），使 score − expected 恒为正。
///
/// 闸门直接对 delta 的**符号**设下界：做错至少扣 ELO_WRONG_DELTA_FLOOR 分，
/// 做对至少加 ELO_CORRECT_DELTA_FLOOR 分。晋级保护（升段后 3 次免负分）在其后生效，
/// 仍可把扣分归零——那是刻意保留的设计。
const ELO_WRONG_DELTA_FLOOR: f64 = -1.0;
const ELO_CORRECT_DELTA_FLOOR: f64 = 0.5;

/// 自适应期望锚点：用自己近期的真实水平替代固定的 0.50 基线。
///
/// 为什么需要（v1.6.9，基于 94 次真实结算的离线回放）：
/// 固定 0.50 基线假设「Rating 1.00 是常规水平」，但 performance 的实际分布中心在
/// 1.30，导致 `score − expected` 恒为正、分数只涨不跌。回放显示，在正确率崩塌到
/// 平均 35% 的四天里，仅有结果闸门的版本仍让 ELO 涨了 14 分；改用自适应锚点后
/// 同期为 −10 分，分数才真正跟着水平走。
///
/// 取**中位数**而非均值：表现分里有约 21% 落在崩盘区（<0.8），均值会被极端值拉偏。
/// 混合 30% 固定基线：防止锚点自身跟着分布漂走——否则长期退步的人会感觉不到退步。
const ELO_ANCHOR_WINDOW: usize = 30;
const ELO_ANCHOR_MIN_SAMPLES: usize = 10;
const ELO_ANCHOR_BLEND: f64 = 0.70;

/// 计算自适应期望锚点：近 `ELO_ANCHOR_WINDOW` 次 performance 折算 score 后的中位数，
/// 与固定基线按 `ELO_ANCHOR_BLEND` 混合。样本不足（定级期）时退回固定基线，
/// 保证冷启动行为与从前一致。
fn adaptive_anchor(conn: &Connection) -> Result<f64, String> {
    let mut stmt = conn
        .prepare("SELECT performance FROM elo_events ORDER BY id DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([ELO_ANCHOR_WINDOW as i64], |row| row.get::<_, f64>(0))
        .map_err(|e| e.to_string())?;
    let mut scores: Vec<f64> = Vec::new();
    for item in rows {
        scores.push(item.map_err(|e| e.to_string())? / 2.0);
    }
    drop(stmt);
    if scores.len() < ELO_ANCHOR_MIN_SAMPLES {
        return Ok(ELO_EXPECTED_BASE);
    }
    scores.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median = scores[scores.len() / 2];
    Ok(ELO_ANCHOR_BLEND * median + (1.0 - ELO_ANCHOR_BLEND) * ELO_EXPECTED_BASE)
}

fn current_elo(conn: &Connection) -> Result<(i64, f64), String> {
    let settlements: i64 = conn
        .query_row("SELECT COUNT(*) FROM elo_events", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let current: f64 = conn
        .query_row(
            "SELECT rating_after FROM elo_events ORDER BY id DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(ELO_START);
    Ok((settlements, current))
}

fn settle_elo(
    conn: &Connection,
    input: &AttemptInput,
    outcome: &str,
    fluency_rating: i32,
    duration: i64,
    attempt_id: i64,
) -> Result<(), String> {
    let question_type: Option<String> = conn
        .query_row(
            "SELECT question_type FROM questions WHERE id=?1",
            [input.question_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let bench = services::rating::benchmark_seconds(question_type.as_deref().unwrap_or("solution"));
    // 评分回退链与掌握度内核一致：六维 HLTV 合成 > Codex rating > 特征曲线
    let dims = input.dimensions.unwrap_or_default();
    let dims_evidence = services::rating::DimensionEvidence {
        rigor: dims.rigor,
        computation: dims.computation,
        modeling: dims.modeling,
        method_use: dims.method_use,
        speed: dims.speed,
        strategy_insight: dims.strategy_insight,
        technique_level: input.technique_level,
    };
    let performance = if !dims_evidence.is_empty() {
        services::rating::hltv_rating(
            outcome,
            &dims_evidence,
            duration,
            bench,
            input.difficulty_multiplier,
        )
    } else {
        input
            .ai_rating
            .filter(|value| {
                (services::rating::RATING_MIN..=services::rating::RATING_MAX).contains(value)
            })
            .unwrap_or_else(|| {
                services::rating::attempt_rating(outcome, fluency_rating, duration, bench)
            })
    };
    let score = (performance / 2.0).clamp(0.0, 1.25);
    // 期望由题目难度与章节掌握度共同决定：薄弱章节的难题期望更低，攻克收益最大
    let mastery: f64 = conn
        .query_row(
            "SELECT mastery FROM progress WHERE question_id=?1",
            [input.question_id],
            |r| r.get::<_, i64>(0).map(|v| v as f64),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(2.0);
    let dm = input.difficulty_multiplier.unwrap_or(1.0);
    let mastery_offset = mastery - 2.0;
    let diff_offset = dm - 1.0;
    // 期望基线锚定在自己近期的真实水平上，而非写死的 0.50
    let anchor = adaptive_anchor(conn)?;
    let mut expected = anchor + ELO_EXPECTED_MASTERY_STEP * mastery_offset
        - ELO_EXPECTED_DIFFICULTY_STEP * diff_offset;
    if input.mode.as_deref() == Some("review") {
        expected += ELO_REVIEW_BONUS;
    }
    let expected = expected.clamp(ELO_EXPECTED_MIN, ELO_EXPECTED_MAX);

    let (settlements, current) = current_elo(conn)?;
    let mut k = if settlements < ELO_CALIBRATION_SETTLEMENTS {
        ELO_K_CALIBRATION
    } else {
        ELO_K
    };
    // 连胜/连败动量：连续 3 次同向结算说明状态火热（或崩盘），波动放大
    if settlements > 0 {
        let mut stmt = conn
            .prepare("SELECT delta FROM elo_events ORDER BY id DESC LIMIT 5")
            .map_err(|e| e.to_string())?;
        let recent: Vec<f64> = stmt
            .query_map([], |r| r.get::<_, f64>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        let head = recent.first().copied().unwrap_or(0.0);
        if head != 0.0 {
            let streak = recent
                .iter()
                .take_while(|d| d.signum() == head.signum())
                .count();
            if streak >= ELO_MOMENTUM_MIN_STREAK {
                k *= ELO_MOMENTUM_MULTIPLIER;
            }
        }
    }

    let mut delta = (k * (score - expected)).round();
    // 结果闸门：对 delta 的符号设下界。只有当公式本身已经给出正确方向且幅度更大时才放行，
    // 避免 performance 分布整体右移时把 ELO 变成「做题就涨分」的打卡计数器。
    // 晋级保护在其后生效，仍可把扣分归零——那是刻意保留的设计，不在此处绕过。
    match outcome {
        "wrong" | "incorrect" => {
            if delta > ELO_WRONG_DELTA_FLOOR {
                log::debug!(
                    "ELO 闸门介入：做错本应 {delta:+} 分，已下压至 {ELO_WRONG_DELTA_FLOOR:+}（qid={}, score={score:.3}, expected={expected:.3}）",
                    input.question_id
                );
                delta = ELO_WRONG_DELTA_FLOOR;
            }
        }
        "correct" => {
            if delta < ELO_CORRECT_DELTA_FLOOR {
                log::debug!(
                    "ELO 闸门介入：做对本应 {delta:+} 分，已上抬至 {ELO_CORRECT_DELTA_FLOOR:+}（qid={}, score={score:.3}, expected={expected:.3}）",
                    input.question_id
                );
                delta = ELO_CORRECT_DELTA_FLOOR;
            }
        }
        // partial / uncertain 不设闸门：居中的结果本就该由公式自由裁定
        _ => {}
    }
    // 晋级保护：刚升段的 3 次结算内不因失误掉分
    let mut protection_left: i64 = setting(conn, "elo_protection_left", "0")
        .parse()
        .unwrap_or(0);
    let band_before = services::rating::rank_band_index(current);
    let band_after = services::rating::rank_band_index(current + delta);
    if band_after > band_before {
        protection_left = ELO_PROMOTION_PROTECTION;
    } else if delta < 0.0 && protection_left > 0 {
        delta = 0.0;
        protection_left -= 1;
    }
    conn.execute(
        "INSERT INTO settings(key,value) VALUES('elo_protection_left',?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [protection_left.to_string()],
    )
    .map_err(|e| e.to_string())?;

    let rating_after = (current + delta).max(0.0);
    conn.execute(
        "INSERT INTO elo_events(attempt_id,question_id,delta,rating_after,performance,expected,created_at,session_id,reason)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,'match')",
        params![
            attempt_id,
            input.question_id,
            delta,
            rating_after,
            performance,
            expected,
            Local::now().to_rfc3339(),
            input.session_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EloHistoryPoint {
    date: String,
    rating: f64,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct LearningCenterSnapshot {
    generated_at: String,
    today: Value,
    recommendations: Value,
    metrics: Value,
    mistake_chains: Value,
    training: Value,
    competitive: Value,
    incentive: Value,
    friend_events: Value,
    capabilities: Value,
    recent_evidence: Value,
    integrity: Value,
    section_errors: Vec<Value>,
}

const LEARNING_CENTER_STABLE_GATE_REASONS: [&str; 2] = [
    "当前版本缺少结构化 variant_of_question_id 关系，不能验证变式迁移。",
    "当前版本缺少受控 review_task 间隔证明，不能验证至少 24 小时后的延迟复习。",
];

fn learning_center_empty_metrics() -> Value {
    json!(["mastery", "fluency", "transfer", "retention", "confidence"].map(|key| json!({
        "key": key, "value": Value::Null, "state": "unseen", "evidenceCount": 0,
        "lastEvidenceAt": Value::Null, "delta": Value::Null, "deltaReason": Value::Null,
        "description": "无满足置信度门控的核心学习证据。"
    })))
}

fn learning_center_metrics_and_evidence(conn: &Connection) -> Result<(Value, Value, Value), String> {
    // Share the projection's effective-evidence semantics: only projected facts
    // count, a Codex ruling supersedes its immutable attempt, and the latest
    // projected ruling for an attempt is the only ruling that survives.
    let mut stmt = conn.prepare(&format!(
        "SELECT id,source,evidence_kind,task_id,question_id,attempt_id,outcome,confidence,mastery_signal,fluency_signal,occurred_at
         FROM ({}) effective ORDER BY occurred_at DESC,id DESC",
        services::learning::effective_evidence_dashboard_sql(),
    )).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok((
        row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, Option<String>>(3)?, row.get::<_, i64>(4)?, row.get::<_, Option<i64>>(5)?, row.get::<_, String>(6)?, row.get::<_, f64>(7)?, row.get::<_, f64>(8)?, row.get::<_, f64>(9)?, row.get::<_, String>(10)?
    ))).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    // Raw low-confidence/uncertain totals are audit-only. They never feed metrics.
    let (uncertain, low): (i64, i64) = conn.query_row(
        "SELECT SUM(CASE WHEN lower(outcome) IN ('uncertain','unknown') THEN 1 ELSE 0 END), SUM(CASE WHEN lower(outcome) NOT IN ('uncertain','unknown') AND confidence < ?1 THEN 1 ELSE 0 END) FROM learning_evidence",
        [services::learning::CORE_CONFIDENCE_THRESHOLD],
        |row| Ok((row.get::<_, Option<i64>>(0)?.unwrap_or(0), row.get::<_, Option<i64>>(1)?.unwrap_or(0))),
    ).map_err(|e| e.to_string())?;
    let mut sums = [0.0; 3]; let mut weights = [0.0; 3]; let mut last: [Option<String>; 3] = [None, None, None];
    let mut accepted = 0_i64; let mut recent = Vec::new();
    for (id, source, kind, task_id, question_id, attempt_id, outcome, confidence, mastery, fluency, occurred_at) in rows {
        let normalized = services::learning::normalize_outcome(&outcome);
        let accepted_now = services::learning::confidence_allows_core(confidence, &outcome);
        if !accepted_now { continue; }
        accepted += 1;
        let weight = services::learning::adoption_weight(confidence, &outcome);
        for (i, value) in [mastery, fluency, confidence.clamp(0.0, 1.0)].into_iter().enumerate() {
            sums[i] += value.clamp(0.0, 1.0) * weight; weights[i] += weight;
            if last[i].is_none() { last[i] = Some(occurred_at.clone()); }
        }
        if recent.len() < 12 {
            let display_source = if source == "codex_adjudication" { "codex" } else if source == "pressure" { "pressure" } else { match kind.as_str() { "review" => "review", "variant" => "variant", "delayed_review" => "delayed_review", _ => "attempt" } };
            recent.push(json!({"id": format!("evidence:{}", id), "source": display_source, "questionId": question_id, "attemptId": attempt_id, "sessionId": task_id, "observedAt": occurred_at, "confidence": confidence, "accepted": true, "note": if normalized == "uncertain" { "不确定证据不会进入有效学习投影。" } else { "已按确定性置信度门控与有效裁决规则纳入核心学习证据。" }}));
        }
    }
    let descriptions = ["掌握：仅聚合已投影、未被有效裁决覆盖的学习证据。", "流畅：仅聚合已投影、未被有效裁决覆盖的作答流畅度证据。", "迁移：当前无受控 variant_of 关系，数值不可证明。", "保持：当前无受控且可验证 >=24h 的复习关系，数值不可证明。", "置信：仅展示有效投影中通过门控的证据置信度。"];
    let mut metrics = Vec::new();
    for (i,key) in ["mastery", "fluency"].iter().enumerate() {
        let count = if weights[i] > 0.0 { accepted } else { 0 };
        let value = if weights[i] > 0.0 { Value::from(((sums[i] / weights[i]) * 10000.0).round() / 100.0) } else { Value::Null };
        metrics.push(json!({"key":key,"value":value,"state":if count==0{"unseen"}else if count<3{"initial"}else{"unstable"},"evidenceCount":count,"lastEvidenceAt":last[i],"delta":Value::Null,"deltaReason":Value::Null,"description":descriptions[i]}));
    }
    for (key,description) in [("transfer",descriptions[2]),("retention",descriptions[3])] { metrics.push(json!({"key":key,"value":Value::Null,"state":"blocked","evidenceCount":0,"lastEvidenceAt":Value::Null,"delta":Value::Null,"deltaReason":Value::Null,"description":description})); }
    let count = if weights[2] > 0.0 { accepted } else { 0 };
    let confidence_value = if weights[2] > 0.0 { Value::from(((sums[2] / weights[2]) * 10000.0).round() / 100.0) } else { Value::Null };
    metrics.push(json!({"key":"confidence","value":confidence_value,"state":if count==0{"unseen"}else if count<3{"initial"}else{"unstable"},"evidenceCount":count,"lastEvidenceAt":last[2],"delta":Value::Null,"deltaReason":Value::Null,"description":descriptions[4]}));
    Ok((Value::Array(metrics),Value::Array(recent),json!({"stableGateStatus":"blocked","stableGateReasons":LEARNING_CENTER_STABLE_GATE_REASONS,"acceptedEvidenceCount":accepted,"lowConfidenceEvidenceCount":low,"uncertainEvidenceCount":uncertain,"structuredVariantEvidence":false,"structuredDelayedReviewEvidence":false})))
}

fn learning_center_mistake_chains(conn: &Connection) -> Result<Value, String> {
    let mut stmt = conn.prepare(
        "SELECT d.task_id,d.question_id,d.category_key,d.normalized_error_class,d.next_action,d.earliest_error,d.confidence,d.created_at,d.updated_at,r.stage,r.status,r.last_outcome,r.next_review_at
         FROM learning_diagnoses d LEFT JOIN review_tasks r ON r.task_id=d.task_id AND r.question_id=d.question_id ORDER BY d.updated_at DESC,d.id DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?,r.get::<_, i64>(1)?,r.get::<_, String>(2)?,r.get::<_, String>(3)?,r.get::<_, String>(4)?,r.get::<_, Option<String>>(5)?,r.get::<_, f64>(6)?,r.get::<_, String>(7)?,r.get::<_, String>(8)?,r.get::<_, Option<String>>(9)?,r.get::<_, Option<String>>(10)?,r.get::<_, Option<String>>(11)?,r.get::<_, Option<String>>(12)?))).map_err(|e| e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for (task_id, qid, category, error_class, next_action, earliest, confidence, created, updated, stage, status, last, next_review) in rows {
        let closed = stage.as_deref() == Some("closed") || status.as_deref() == Some("closed");
        let repeated_count: i64 = conn.query_row("SELECT COUNT(*) FROM attempts WHERE question_id=?1", [qid], |r| r.get(0)).unwrap_or(1).max(1);
        let evidence_count: i64 = conn.query_row("SELECT COUNT(*) FROM learning_evidence WHERE question_id=?1", [qid], |r| r.get(0)).unwrap_or(0);
        let advice: Option<String> = conn.query_row(
            "SELECT json_extract(payload, '$.advice') FROM codex_inbox WHERE (status='applied' OR status='confirmed') AND (json_extract(payload, '$.questionId')=?1 OR json_extract(payload, '$.question_id')=?1) ORDER BY id DESC LIMIT 1",
            [qid],
            |r| r.get(0),
        ).optional().unwrap_or(None).or_else(|| {
            conn.query_row(
                "SELECT json_extract(value, '$.advice') FROM codex_inbox, json_each(json_extract(payload, '$.batchAttempts')) WHERE (status='applied' OR status='confirmed') AND (json_extract(value, '$.questionId')=?1 OR json_extract(value, '$.question_id')=?1) ORDER BY codex_inbox.id DESC LIMIT 1",
                [qid],
                |r| r.get(0),
            ).optional().unwrap_or(None)
        });
        result.push(json!({
            "id": format!("{}:{}", task_id, qid),
            "categoryId": Value::Null,
            "categoryPath": category,
            "label": format!("{} · 题目 {}", category, qid),
            "errorClass": match error_class.as_str() { "aiming" | "concept" | "tactics" | "mixed" => error_class, _ => "uncertain".into() },
            "stage": if closed { "remediating" } else { stage.as_deref().unwrap_or("diagnosed") },
            "statusLabel": if closed { "已降级：缺少稳定关闭所需的结构化证据" } else { "等待受控复习验证" },
            "firstExposedAt": created,
            "lastObservedAt": updated,
            "nextReviewAt": next_review,
            "repeatedCount": repeated_count,
            "evidenceCount": evidence_count,
            "confidence": confidence,
            "earliestError": earliest,
            "advice": advice,
            "nextAction": next_action,
            "originalRetryPassed": last.as_deref() == Some("correct"),
            "similarPassed": false,
            "transferPassed": false,
            "delayedReviewPassed": false,
            "stableClosedAt": Value::Null,
            "relapseAt": Value::Null,
            "blockedReason": LEARNING_CENTER_STABLE_GATE_REASONS.join("；")
        }));
    }
    Ok(Value::Array(result))
}

fn learning_center_shadow(conn: &Connection) -> Result<(Value, Vec<Value>), String> {
    let category: Option<String> = conn.query_row("SELECT category_key FROM learning_diagnoses WHERE normalized_error_class<>'none' ORDER BY updated_at DESC,id DESC LIMIT 1", [], |r| r.get(0)).optional().map_err(|e| e.to_string())?
        .or(conn.query_row("SELECT category_key FROM skill_states ORDER BY mastery ASC,updated_at ASC LIMIT 1", [], |r| r.get(0)).optional().map_err(|e| e.to_string())?)
        .or(conn.query_row("SELECT category_path FROM questions ORDER BY id ASC LIMIT 1", [], |r| r.get(0)).optional().map_err(|e| e.to_string())?);
    let weights = json!({"repair":40,"consolidate":25,"transfer":20,"challenge":15});
    let Some(category) = category else { return Ok((json!({"weights":weights,"items":[],"emptyReason":"尚无可验证类别候选；影子推荐不会伪造题号或写入队列。"}),vec![])); };
    let specs = [
        ("repair", "修复", "practice_similar", "先修复已诊断的断点。"),
        ("consolidate", "巩固", "quick_retry", "巩固当前薄弱类别。"),
        ("transfer", "迁移", "practice_variant", "迁移需要受控变式关系。"),
        ("challenge", "挑战", "practice_challenge", "突破压轴高难真题。"),
    ];
    let mut items = Vec::new();
    let mut objectives = Vec::new();
    for (i, (track, title, action, why)) in specs.iter().enumerate() {
        let candidate_id: Option<i64> = match *track {
            "repair" => {
                conn.query_row(
                    "SELECT q.id FROM questions q JOIN attempts a ON a.question_id=q.id WHERE (lower(a.result)='wrong' OR lower(a.outcome)='wrong') AND (q.category_path=?1 OR ?1='') ORDER BY a.id DESC LIMIT 1",
                    [&category],
                    |r| r.get(0),
                ).optional().unwrap_or(None)
                .or_else(|| conn.query_row("SELECT id FROM questions WHERE category_path=?1 ORDER BY id ASC LIMIT 1", [&category], |r| r.get(0)).optional().unwrap_or(None))
            },
            "consolidate" => {
                conn.query_row(
                    "SELECT q.id FROM questions q JOIN progress p ON p.question_id=q.id WHERE p.mastery <= 3 AND (q.category_path=?1 OR ?1='') ORDER BY p.mastery ASC LIMIT 1",
                    [&category],
                    |r| r.get(0),
                ).optional().unwrap_or(None)
                .or_else(|| conn.query_row("SELECT id FROM questions WHERE category_path=?1 ORDER BY id DESC LIMIT 1", [&category], |r| r.get(0)).optional().unwrap_or(None))
            },
            "transfer" => {
                // 迁移轨道必须遵循结构化变式门控：无受控变式关系时不伪造变式推荐
                None
            },
            "challenge" => {
                conn.query_row(
                    "SELECT id FROM questions WHERE difficulty >= 2 AND (category_path=?1 OR category_path LIKE ?2) ORDER BY difficulty DESC, id ASC LIMIT 1",
                    params![category, format!("{}%", category.split(" / ").next().unwrap_or(&category))],
                    |r| r.get(0),
                ).optional().unwrap_or(None)
                .or_else(|| conn.query_row("SELECT id FROM questions ORDER BY difficulty DESC, id ASC LIMIT 1", [], |r| r.get(0)).optional().unwrap_or(None))
            },
            _ => None,
        };
        let is_available = candidate_id.is_some();
        let qid_val = candidate_id.map(Value::from).unwrap_or(Value::Null);
        let qids_vec = candidate_id.map(|id| vec![id]).unwrap_or_default();
        let state = if is_available { "available" } else { "blocked" };
        let status = if is_available { "ready" } else { "blocked" };
        let actions = if is_available { json!(["start", "open_detail"]) } else { json!(["open_detail"]) };
        let blocked_reason = if *track == "transfer" {
            Value::from("当前没有受控变式关系，迁移训练需等待结构化变式支持。")
        } else if is_available {
            Value::Null
        } else {
            Value::from("暂无可用的题库题目；请先导入题库。")
        };
        let score = match *track { "repair" => 40, "consolidate" => 25, "transfer" => 20, _ => 15 };

        items.push(json!({
            "id": format!("shadow:{}:{}", track, category),
            "questionId": qid_val,
            "title": format!("{} · {}", title, category),
            "categoryPath": category,
            "track": track,
            "score": score,
            "estimatedMinutes": 15,
            "state": state,
            "reason": {
                "track": track,
                "targetCategoryId": Value::Null,
                "evidenceText": why,
                "goalText": why,
                "successCriteria": "形成新的有效学习证据。",
                "sourceEvidenceIds": [],
                "confidence": Value::Null
            },
            "variantOfQuestionId": Value::Null,
            "isDifferentQuestion": false,
            "isDifferentStructure": false,
            "actions": actions
        }));
        objectives.push(json!({
            "id": format!("objective:{}:{}", track, category),
            "order": i + 1,
            "track": track,
            "title": format!("{}：{}", title, category),
            "categoryId": Value::Null,
            "categoryPath": category,
            "status": status,
            "estimatedMinutes": 15,
            "plannedItemCount": if is_available { 1 } else { 0 },
            "completedItemCount": 0,
            "whyNow": why,
            "evidenceIds": [],
            "successCriteria": "形成新的有效学习证据。",
            "nextAction": action,
            "questionIds": qids_vec,
            "isUserPinned": false,
            "blockedReason": blocked_reason
        }));
    }
    Ok((json!({"weights": weights, "items": items, "emptyReason": Value::Null}), objectives))
}

fn learning_center_training(conn: &Connection, today: &str) -> Result<Value, String> {
    let counted = "lower(COALESCE(outcome,result)) NOT IN ('uncertain','unknown')";
    let problems: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM attempts WHERE substr(attempted_at,1,10)=?1 AND {counted}"), [today], |r| r.get(0)).map_err(|e| e.to_string())?;
    let seconds: i64 = conn.query_row(&format!("SELECT COALESCE(SUM(duration_seconds),0) FROM attempts WHERE substr(attempted_at,1,10)=?1 AND {counted} AND duration_seconds BETWEEN 1 AND 1800"), [today], |r| r.get(0)).map_err(|e| e.to_string())?;
    let weekly: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM attempts WHERE date(attempted_at)>=date(?1,'-6 days') AND {counted}"), [today], |r| r.get(0)).map_err(|e| e.to_string())?;
    let weekly_seconds: i64 = conn.query_row(&format!("SELECT COALESCE(SUM(duration_seconds),0) FROM attempts WHERE date(attempted_at)>=date(?1,'-6 days') AND {counted} AND duration_seconds BETWEEN 1 AND 1800"), [today], |r| r.get(0)).map_err(|e| e.to_string())?;
    let due: i64 = conn.query_row("SELECT COUNT(*) FROM review_tasks WHERE status<>'closed' AND next_review_at IS NOT NULL AND next_review_at<=?1", [today], |r| r.get(0)).map_err(|e| e.to_string())?;
    let active_chains: i64 = conn.query_row("SELECT COUNT(*) FROM review_tasks WHERE status<>'closed' AND stage<>'closed'", [], |r| r.get(0))
        .optional().map_err(|e| e.to_string())?
        .unwrap_or_else(|| conn.query_row("SELECT COUNT(*) FROM learning_diagnoses WHERE normalized_error_class<>'none'", [], |r| r.get(0)).unwrap_or(0));
    let closed_chains: i64 = conn.query_row("SELECT COUNT(*) FROM review_tasks WHERE status='closed' OR stage='closed'", [], |r| r.get(0)).unwrap_or(0);
    let variant_passes: i64 = conn.query_row("SELECT COUNT(*) FROM learning_evidence WHERE is_variant=1 AND lower(outcome)='correct'", [], |r| r.get(0)).unwrap_or(0);
    let delayed_passes: i64 = conn.query_row("SELECT COUNT(*) FROM learning_evidence WHERE is_delayed_review=1 AND lower(outcome)='correct'", [], |r| r.get(0)).unwrap_or(0);
    Ok(json!({
        "todayProblems": problems,
        "todayMinutes": seconds / 60,
        "weeklyProblems": weekly,
        "weeklyMinutes": weekly_seconds / 60,
        "dueReviews": due,
        "activeMistakeChains": active_chains,
        "stableClosedChains": closed_chains,
        "variantPasses": variant_passes,
        "delayedReviewPasses": delayed_passes,
        "incentiveAvailable": false,
        "xpThisWeek": Value::Null,
        "achievements": Value::Null
    }))
}

fn learning_center_competitive(conn: &Connection, supp: Option<&Connection>) -> Result<Value, String> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM elo_events WHERE reason<>'season_reset'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let last_elo: Option<(f64, f64, String)> = conn.query_row(
        "SELECT rating_after, delta, created_at FROM elo_events WHERE reason<>'season_reset' ORDER BY id DESC LIMIT 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).optional().map_err(|e| e.to_string())?;
    let genuine_recent_rating: Option<f64> = conn.query_row(
        "SELECT AVG(ai_rating) FROM (SELECT ai_rating FROM attempts WHERE ai_rating IS NOT NULL AND ai_rating > 0.0 ORDER BY id DESC LIMIT 10)",
        [],
        |r| r.get(0),
    ).optional().unwrap_or(None);
    let (valid, pending) = if let Some(s) = supp {
        (
            s.query_row("SELECT COUNT(*) FROM pressure_sessions ps WHERE status IN ('graded','graded_partial') AND (ps.task_id IS NOT NULL OR EXISTS (SELECT 1 FROM pressure_task_links l WHERE l.session_id=ps.session_id AND l.is_current=1))", [], |r| r.get(0)).map_err(|e| e.to_string())?,
            s.query_row("SELECT COUNT(*) FROM pressure_sessions ps WHERE status IN ('awaiting_codex','completed') AND (ps.task_id IS NOT NULL OR EXISTS (SELECT 1 FROM pressure_task_links l WHERE l.session_id=ps.session_id AND l.is_current=1))", [], |r| r.get(0)).map_err(|e| e.to_string())?
        )
    } else {
        (0, 0)
    };
    let elo_val = last_elo.as_ref().map(|x| x.0);
    let rating_val = genuine_recent_rating.map(|r| ((r * 100.0).round()) / 100.0);
    Ok(json!({
        "rating": rating_val,
        "elo": elo_val,
        "rank": elo_val.map(rank_letter_for_elo),
        "seasonName": Value::Null,
        "settlementCount": count,
        "lastDelta": last_elo.as_ref().map(|x| x.1),
        "lastMatchAt": last_elo.map(|x| x.2),
        "validPressureSessions": valid,
        "pendingSettlementCount": pending,
        "note": "只读历史竞技账；Rating 独立反映真实近况均值（无数据为 null），ELO 独立排位记账。"
    }))
}

fn build_learning_center_snapshot(conn: &Connection, supp: Option<&Connection>) -> LearningCenterSnapshot {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let mut errors = vec![];
    let (metrics, recent, integrity) = match learning_center_metrics_and_evidence(conn) {
        Ok(v) => v,
        Err(e) => {
            errors.push(json!({"section":"metrics","message":e}));
            (learning_center_empty_metrics(), json!([]), json!({"stableGateStatus":"blocked","stableGateReasons":LEARNING_CENTER_STABLE_GATE_REASONS,"acceptedEvidenceCount":0,"lowConfidenceEvidenceCount":0,"uncertainEvidenceCount":0,"structuredVariantEvidence":false,"structuredDelayedReviewEvidence":false}))
        }
    };
    let chains = match learning_center_mistake_chains(conn) {
        Ok(v) => v,
        Err(e) => {
            errors.push(json!({"section":"mistakeChains","message":e}));
            json!([])
        }
    };
    let (recommendations, mut objectives) = match learning_center_shadow(conn) {
        Ok(v) => v,
        Err(e) => {
            errors.push(json!({"section":"recommendations","message":e}));
            (json!({"weights":{"repair":40,"consolidate":25,"transfer":20,"challenge":15},"items":[],"emptyReason":"影子推荐查询失败，未写入任何计划。"}), vec![])
        }
    };
    let training = match learning_center_training(conn, &today) {
        Ok(v) => v,
        Err(e) => {
            errors.push(json!({"section":"training","message":e}));
            json!({"todayProblems":0,"todayMinutes":0,"weeklyProblems":0,"weeklyMinutes":0,"dueReviews":0,"activeMistakeChains":0,"stableClosedChains":0,"variantPasses":0,"delayedReviewPasses":0,"incentiveAvailable":false,"xpThisWeek":Value::Null,"achievements":Value::Null})
        }
    };
    let competitive = match learning_center_competitive(conn, supp) {
        Ok(v) => v,
        Err(e) => {
            errors.push(json!({"section":"competitive","message":e}));
            json!({"rating":Value::Null,"elo":Value::Null,"rank":Value::Null,"seasonName":Value::Null,"settlementCount":0,"lastDelta":Value::Null,"lastMatchAt":Value::Null,"validPressureSessions":0,"pendingSettlementCount":0,"note":"竞技账查询失败；未改变任何既有结算。"})
        }
    };

    let mut completed_objectives_count = 0_i64;
    let mut completed_objectives_minutes = 0_i64;
    for obj in &mut objectives {
        let mut obj_done = false;
        if let Some(qids) = obj.get("questionIds").and_then(|v| v.as_array()) {
            for q in qids {
                if let Some(qid) = q.as_i64() {
                    let has_correct_today: bool = conn.query_row(
                        "SELECT EXISTS(SELECT 1 FROM attempts WHERE question_id=?1 AND substr(attempted_at,1,10)=?2 AND lower(COALESCE(outcome,result))='correct')",
                        params![qid, today],
                        |r| r.get(0),
                    ).unwrap_or(false);
                    if has_correct_today {
                        obj_done = true;
                        break;
                    }
                }
            }
        }
        if obj_done {
            completed_objectives_count += 1;
            completed_objectives_minutes += obj.get("estimatedMinutes").and_then(|v| v.as_i64()).unwrap_or(15);
            obj["completedItemCount"] = json!(1);
            obj["status"] = json!("stable_completed");
        }
    }

    let total = objectives.len() as i64;
    let planned_minutes = (total * 15).max(30);

    LearningCenterSnapshot {
        generated_at: Local::now().to_rfc3339(),
        today: json!({
            "date": today,
            "objectives": objectives,
            "completedCount": completed_objectives_count,
            "totalCount": total,
            "completedMinutes": completed_objectives_minutes,
            "plannedMinutes": planned_minutes
        }),
        recommendations,
        metrics,
        mistake_chains: chains,
        training,
        competitive,
        incentive: json!({"available":false,"xp":Value::Null,"level":Value::Null,"streakDays":Value::Null,"weeklyGoalCompleted":Value::Null,"weeklyGoalTotal":Value::Null,"recentAchievements":[],"note":"尚无独立、可审计的激励 XP账；不可把 0 当作真实结算。"}),
        friend_events: json!([]),
        capabilities: json!({"canBatchGradeDrafts":true,"canOpenPressureReport":true,"canOpenExistingMasteryMap":true,"canOpenExistingReviewView":true,"canReadFriendEvents":false,"structuredVariantEvidence":false,"structuredDelayedReviewEvidence":false,"canReadIncentiveLedger":false,"rankedOnlyCompetitiveLedger":false}),
        recent_evidence: recent,
        integrity,
        section_errors: errors,
    }
}

#[tauri::command]
fn get_learning_center_snapshot(state:State<AppState>)->Result<LearningCenterSnapshot,String>{let conn=state.db.lock().map_err(|e|e.to_string())?;let supp=state.supplemental_db.lock().map_err(|e|e.to_string())?;Ok(build_learning_center_snapshot(&conn,Some(&supp)))}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EloStatus {
    current: f64,
    settlements: i64,
    calibrated: bool,
    last_delta: Option<f64>,
    /// 连续同向结算数：正为连胜，负为连败，0 为无
    streak: i64,
    protection_left: i64,
    history: Vec<EloHistoryPoint>,
}

#[tauri::command]
fn get_library_path(state: State<AppState>) -> Result<String, String> {
    let path = state.library_dir.lock().map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn set_library_path(path: String, state: State<AppState>) -> Result<(), String> {
    let candidate = Path::new(&path);
    if !candidate.is_dir() {
        return Err("目录不存在，请检查路径".into());
    }
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO settings(key,value) VALUES('library_path',?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [&path],
        )
        .map_err(|e| e.to_string())?;
    }
    *state.library_dir.lock().map_err(|e| e.to_string())? = candidate.to_path_buf();
    Ok(())
}

#[tauri::command]
fn get_elo_status(state: State<AppState>) -> Result<EloStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let (settlements, current) = current_elo(&conn)?;
    let last_delta: Option<f64> = conn
        .query_row(
            "SELECT delta FROM elo_events WHERE reason='match' ORDER BY id DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT substr(created_at,1,10), rating_after FROM elo_events
             WHERE reason<>'season_reset' ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);
    let mut history: Vec<EloHistoryPoint> = Vec::new();
    for (date, rating) in rows {
        match history.last_mut() {
            Some(point) if point.date == date => point.rating = rating,
            _ => history.push(EloHistoryPoint { date, rating }),
        }
    }
    // 连胜/连败计数（只看正常结算事件）
    let mut streak_stmt = conn
        .prepare("SELECT delta FROM elo_events WHERE reason='match' ORDER BY id DESC LIMIT 6")
        .map_err(|e| e.to_string())?;
    let recent: Vec<f64> = streak_stmt
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(streak_stmt);
    let mut streak = 0i64;
    if let Some(&head) = recent.first() {
        if head != 0.0 {
            for value in &recent {
                if value.signum() == head.signum() {
                    streak += i64::from(head > 0.0) - i64::from(head < 0.0);
                } else {
                    break;
                }
            }
        }
    }
    let protection_left: i64 = setting(&conn, "elo_protection_left", "0")
        .parse()
        .unwrap_or(0);
    Ok(EloStatus {
        current,
        settlements,
        calibrated: settlements >= ELO_CALIBRATION_SETTLEMENTS,
        last_delta,
        streak,
        protection_left,
        history,
    })
}

// ============ 模块 C/E 共用：按条件取作答行并按回退链算 rating ============
struct RatingRow {
    question_id: i64,
    stem: String,
    outcome: String,
    fluency: i32,
    ai_rating: Option<f64>,
    duration: i64,
    bench: i64,
    dims: services::rating::DimensionEvidence,
    dim_scores: Vec<f64>,
}

fn fetch_rating_rows(
    conn: &Connection,
    filter: &str,
    param: &str,
) -> Result<Vec<RatingRow>, String> {
    let sql = format!(
        "SELECT a.question_id, q.stem, COALESCE(a.outcome,a.result), COALESCE(a.fluency_rating,a.self_rating),
                a.ai_rating, COALESCE(a.duration_seconds,600), q.question_type,
                a.dim_rigor, a.dim_computation, a.dim_modeling, a.dim_method_use, a.dim_speed,
                a.dim_strategy_insight, a.technique_level, a.difficulty_multiplier
         FROM attempts a JOIN questions q ON q.id=a.question_id
         WHERE {filter} AND COALESCE(a.outcome,a.result)<>'uncertain'
         ORDER BY a.id"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([param], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i32>(3)?,
                r.get::<_, Option<f64>>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, Option<f64>>(7)?,
                r.get::<_, Option<f64>>(8)?,
                r.get::<_, Option<f64>>(9)?,
                r.get::<_, Option<f64>>(10)?,
                r.get::<_, Option<f64>>(11)?,
                r.get::<_, Option<f64>>(12)?,
                r.get::<_, Option<i32>>(13)?,
                r.get::<_, Option<f64>>(14)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);
    Ok(rows
        .into_iter()
        .map(
            |(
                question_id,
                stem,
                outcome,
                fluency,
                ai_rating,
                duration,
                qtype,
                rigor,
                computation,
                modeling,
                method_use,
                speed,
                strategy,
                technique,
                _dm,
            )| RatingRow {
                question_id,
                stem,
                outcome,
                fluency,
                ai_rating,
                duration,
                bench: services::rating::benchmark_seconds(&qtype),
                dims: services::rating::DimensionEvidence {
                    rigor,
                    computation,
                    modeling,
                    method_use,
                    speed,
                    strategy_insight: strategy,
                    technique_level: technique,
                },
                dim_scores: [rigor, computation, modeling, method_use, speed, strategy]
                    .into_iter()
                    .flatten()
                    .collect(),
            },
        )
        .collect())
}

fn row_rating(row: &RatingRow) -> f64 {
    if !row.dims.is_empty() {
        services::rating::hltv_rating(&row.outcome, &row.dims, row.duration, row.bench, None)
    } else if let Some(value) = row
        .ai_rating
        .filter(|v| (services::rating::RATING_MIN..=services::rating::RATING_MAX).contains(v))
    {
        value
    } else {
        services::rating::attempt_rating(&row.outcome, row.fluency, row.duration, row.bench)
    }
}

fn row_impact(row: &RatingRow) -> Option<f64> {
    let s = row.dims.strategy_insight?;
    let m = row.dims.method_use.unwrap_or(s);
    Some(
        0.6 * s
            + 0.4 * m
            + if row.dims.technique_level.unwrap_or(0) >= 4 {
                5.0
            } else {
                0.0
            },
    )
}

// ============ 模块 C：赛后战绩面板（WE 评分 + MVP） ============
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScoreboardQuestion {
    question_id: i64,
    stem: String,
    outcome: String,
    rating: f64,
    duration_seconds: i64,
    impact: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionScoreboard {
    we_score: Option<i64>,
    questions: Vec<ScoreboardQuestion>,
    mvp_question_id: Option<i64>,
    longest_streak: i64,
    fastest_kill_question_id: Option<i64>,
    elo_delta: f64,
    total_duration: i64,
    correct_count: i64,
    total_count: i64,
}

#[tauri::command]
fn get_session_scoreboard(
    session_id: Option<String>,
    state: State<AppState>,
) -> Result<SessionScoreboard, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive().to_string();
    let (attempt_filter, elo_filter, param) = match session_id.as_deref() {
        Some(id) => (
            "a.session_id=?1".to_string(),
            format!("session_id='{id}'"),
            id.to_string(),
        ),
        None => (
            "substr(a.attempted_at,1,10)=?1".to_string(),
            format!("substr(created_at,1,10)='{today}' AND reason='match'"),
            today,
        ),
    };
    let rows = fetch_rating_rows(&conn, &attempt_filter, &param)?;
    let elo_delta: f64 = conn
        .query_row(
            &format!("SELECT COALESCE(SUM(delta),0) FROM elo_events WHERE {elo_filter}"),
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let all_dim_scores: Vec<f64> = rows
        .iter()
        .flat_map(|r| r.dim_scores.iter().copied())
        .collect();
    let we_score = if !all_dim_scores.is_empty() {
        Some((all_dim_scores.iter().sum::<f64>() / all_dim_scores.len() as f64).round() as i64)
    } else if !rows.is_empty() {
        let avg = rows.iter().map(row_rating).sum::<f64>() / rows.len() as f64;
        Some((avg / services::rating::RATING_MAX * 100.0).round() as i64)
    } else {
        None
    };
    let mut longest_streak = 0i64;
    let mut current_streak = 0i64;
    let mut fastest: Option<(f64, i64)> = None;
    let mut mvp: Option<(f64, i64)> = None;
    for row in &rows {
        if row.outcome == "correct" {
            current_streak += 1;
            longest_streak = longest_streak.max(current_streak);
            let pace = row.duration as f64 / row.bench as f64;
            if pace <= 0.5 && fastest.map(|(p, _)| pace < p).unwrap_or(true) {
                fastest = Some((pace, row.question_id));
            }
            if row.outcome == "correct" {
                if let Some(impact) = row_impact(row) {
                    if mvp.map(|(i, _)| impact > i).unwrap_or(true) {
                        mvp = Some((impact, row.question_id));
                    }
                }
            }
        } else {
            current_streak = 0;
        }
    }
    let mvp_question_id = mvp.map(|(_, id)| id).or(fastest.map(|(_, id)| id));
    let questions = rows
        .iter()
        .map(|row| ScoreboardQuestion {
            question_id: row.question_id,
            stem: row.stem.clone(),
            outcome: row.outcome.clone(),
            rating: row_rating(row),
            duration_seconds: row.duration,
            impact: row_impact(row),
        })
        .collect();
    Ok(SessionScoreboard {
        we_score,
        questions,
        mvp_question_id,
        longest_streak,
        fastest_kill_question_id: fastest.filter(|(p, _)| *p <= 0.5).map(|(_, id)| id),
        elo_delta,
        total_duration: rows.iter().map(|r| r.duration).sum(),
        correct_count: rows.iter().filter(|r| r.outcome == "correct").count() as i64,
        total_count: rows.len() as i64,
    })
}

// ============ 模块 D：周赛季制（每周一 00:00 开启，周日 24:00 结算） ============
const SEASON_RESET_PULL: f64 = 0.75;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SeasonRecord {
    season_name: String,
    started_at: String,
    ended_at: String,
    peak_rating: f64,
    final_rating: f64,
    rank_index: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SeasonStatus {
    name: String,
    index: i64,
    started_at: String,
    current_elo: f64,
    history: Vec<SeasonRecord>,
}

fn season_status(conn: &Connection) -> Result<SeasonStatus, String> {
    let now = Local::now();
    let days_from_mon = now.weekday().num_days_from_monday() as i64;
    let this_monday_naive = (now.date_naive() - chrono::Duration::days(days_from_mon))
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let this_monday = match now.timezone().from_local_datetime(&this_monday_naive) {
        chrono::LocalResult::Single(dt) => dt,
        _ => now,
    };
    let this_monday_rfc = this_monday.to_rfc3339();

    // 全局周赛季确定性基准纪元：2026-08-17 (周一) 为 S1 起点，当前 2026-08-24 为 S2
    let epoch_monday = chrono::NaiveDate::from_ymd_opt(2026, 8, 17).unwrap();
    let days_from_epoch = (this_monday.date_naive() - epoch_monday).num_days();
    let global_season_index = ((days_from_epoch / 7).max(0) + 1) as i64;

    let (_, mut current) = current_elo(conn)?;

    let saved_season_index: i64 = setting(conn, "season_index", "0").parse().unwrap_or(0);
    let last_settled_season: i64 = if saved_season_index == 0 {
        // 首次初始化：标记为当前全球赛季
        let _ = conn.execute(
            "INSERT INTO settings(key, value) VALUES('season_index', ?1), ('season_start', ?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![global_season_index.to_string(), this_monday_rfc],
        );
        global_season_index
    } else {
        saved_season_index
    };

    // 自动跨周结算与段位软重置（若本地记录赛季落后于全球日历赛季）
    if last_settled_season < global_season_index {
        for s in last_settled_season..global_season_index {
            let s_start_date = epoch_monday + chrono::Duration::days((s - 1) * 7);
            let s_end_date = s_start_date + chrono::Duration::days(6);
            let s_start_rfc = s_start_date.and_hms_opt(0, 0, 0).unwrap().to_string();
            let s_end_rfc = s_end_date.and_hms_opt(23, 59, 59).unwrap().to_string();

            // elo_events.created_at 是带时区的 RFC3339（2026-08-30T20:00:00+08:00），而区间
            // 边界是不带时区的 "YYYY-MM-DD HH:MM:SS"。直接做字符串比较时 ' '(0x20) < 'T'(0x54)，
            // 区间结束日当天的记录会被全部判为超出范围，导致赛季峰值漏统计。统一提取日期比较。
            let peak: f64 = conn
                .query_row(
                    "SELECT COALESCE(MAX(rating_after), ?1) FROM elo_events WHERE date(created_at) >= date(?2) AND date(created_at) <= date(?3)",
                    params![current, s_start_rfc, s_end_rfc],
                    |r| r.get(0),
                )
                .unwrap_or(current);

            let _ = conn.execute(
                "INSERT INTO season_history(season_name, started_at, ended_at, peak_rating, final_rating, rank_index)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    format!("S{}", s),
                    s_start_rfc,
                    s_end_rfc,
                    peak,
                    current,
                    services::rating::rank_band_index(current) as i64,
                ],
            );

            // 软重置：向 1400 ELO 基准收敛 25%
            let (settlements, current_val) = current_elo(conn)?;
            if settlements > 0 {
                let new_current = ELO_START + (current_val - ELO_START) * SEASON_RESET_PULL;
                let delta = new_current - current_val;
                let _ = conn.execute(
                    "INSERT INTO elo_events(question_id, delta, rating_after, performance, expected, created_at, session_id, reason)
                     VALUES(0, ?1, ?2, 0, 0, ?3, NULL, 'season_reset')",
                    params![delta, new_current, this_monday_rfc],
                );
                current = new_current;
            }
        }

        let _ = conn.execute(
            "INSERT INTO settings(key, value) VALUES('season_index', ?1), ('season_start', ?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![global_season_index.to_string(), this_monday_rfc],
        );
    }

    let mut stmt = conn
        .prepare("SELECT season_name,started_at,ended_at,peak_rating,final_rating,rank_index FROM season_history ORDER BY id")
        .map_err(|e| e.to_string())?;
    let history = stmt
        .query_map([], |r| {
            Ok(SeasonRecord {
                season_name: r.get(0)?,
                started_at: r.get(1)?,
                ended_at: r.get(2)?,
                peak_rating: r.get(3)?,
                final_rating: r.get(4)?,
                rank_index: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(SeasonStatus {
        name: format!("S{}", global_season_index),
        index: global_season_index,
        started_at: this_monday_rfc,
        current_elo: current,
        history,
    })
}

#[tauri::command]
fn get_season_status(state: State<AppState>) -> Result<SeasonStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    season_status(&conn)
}

#[tauri::command]
fn advance_season(state: State<AppState>) -> Result<SeasonStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    season_status(&conn)
}

// ============ 错题闭环追踪：薄弱标签的近 7 天 vs 之前正确率 ============
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TagClosure {
    tag: String,
    question_count: i64,
    recent_correct: i64,
    recent_total: i64,
    before_correct: i64,
    before_total: i64,
    /// 近期正确率 - 之前正确率，任一侧无样本时为 None
    delta: Option<f64>,
}

#[tauri::command]
fn get_tag_closure(state: State<AppState>) -> Result<Vec<TagClosure>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let recent_start = (Local::now() - Duration::days(7)).to_rfc3339();
    let mut tag_questions: std::collections::HashMap<String, Vec<i64>> =
        std::collections::HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT question_id, weakness_tags_json FROM codex_analysis_signals")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        for (question_id, tags_json) in rows {
            if let Ok(tags) = serde_json::from_str::<Vec<String>>(&tags_json) {
                for tag in tags {
                    tag_questions.entry(tag).or_default().push(question_id);
                }
            }
        }
    }
    let mut result = Vec::new();
    for (tag, mut questions) in tag_questions {
        questions.sort();
        questions.dedup();
        let placeholders = questions.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT
                SUM(CASE WHEN COALESCE(outcome,result)='correct' AND attempted_at>=?1 THEN 1 ELSE 0 END),
                SUM(CASE WHEN COALESCE(outcome,result)<>'uncertain' AND attempted_at>=?1 THEN 1 ELSE 0 END),
                SUM(CASE WHEN COALESCE(outcome,result)='correct' AND attempted_at<?1 THEN 1 ELSE 0 END),
                SUM(CASE WHEN COALESCE(outcome,result)<>'uncertain' AND attempted_at<?1 THEN 1 ELSE 0 END)
             FROM attempts WHERE question_id IN ({placeholders})"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(recent_start.clone())];
        for question_id in &questions {
            params.push(Box::new(*question_id));
        }
        params.push(Box::new(recent_start.clone()));
        for question_id in &questions {
            params.push(Box::new(*question_id));
        }
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let (rc, rt, bc, bt): (i64, i64, i64, i64) = conn
            .query_row(&sql, param_refs.as_slice(), |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })
            .map_err(|e| e.to_string())?;
        let delta = if rt > 0 && bt > 0 {
            Some(((rc as f64 / rt as f64) - (bc as f64 / bt as f64)) * 100.0)
        } else {
            None
        };
        result.push(TagClosure {
            tag,
            question_count: questions.len() as i64,
            recent_correct: rc,
            recent_total: rt,
            before_correct: bc,
            before_total: bt,
            delta,
        });
    }
    result.sort_by(|a, b| b.question_count.cmp(&a.question_count));
    Ok(result)
}

// ============ 模块 E：Rating 分布审计 ============
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RatingBucket {
    floor: f64,
    count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DimensionAverages {
    rigor: Option<f64>,
    computation: Option<f64>,
    modeling: Option<f64>,
    method_use: Option<f64>,
    speed: Option<f64>,
    strategy_insight: Option<f64>,
    sample: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RatingDistribution {
    buckets: Vec<RatingBucket>,
    mean: Option<f64>,
    sd: Option<f64>,
    count: i64,
    p95: Option<f64>,
    above_130: f64,
    below_070: f64,
    drift: bool,
    dimensions: Option<DimensionAverages>,
}

#[tauri::command]
fn get_rating_distribution(state: State<AppState>) -> Result<RatingDistribution, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let cutoff = (Local::now() - Duration::days(90)).to_rfc3339();
    let rows = fetch_rating_rows(&conn, "a.attempted_at>=?1", &cutoff)?;
    let mut ratings: Vec<f64> = rows.iter().map(row_rating).collect();
    ratings.sort_by(|a, b| a.total_cmp(b));
    let count = ratings.len() as i64;
    let mut buckets = Vec::new();
    for bucket in 0..20i64 {
        let floor = bucket as f64 / 10.0;
        let upper = floor + 0.1;
        buckets.push(RatingBucket {
            floor,
            count: ratings
                .iter()
                .filter(|r| **r >= floor && (**r as f64) < upper)
                .count() as i64,
        });
    }
    if ratings.is_empty() {
        return Ok(RatingDistribution {
            buckets,
            mean: None,
            sd: None,
            count: 0,
            p95: None,
            above_130: 0.0,
            below_070: 0.0,
            drift: false,
            dimensions: None,
        });
    }
    let avg_dim = |pick: fn(&services::rating::DimensionEvidence) -> Option<f64>| -> Option<f64> {
        let values: Vec<f64> = rows.iter().filter_map(|r| pick(&r.dims)).collect();
        (!values.is_empty())
            .then(|| (values.iter().sum::<f64>() / values.len() as f64 * 10.0).round() / 10.0)
    };
    let sample = rows.iter().filter(|r| !r.dims.is_empty()).count() as i64;
    let mean = ratings.iter().sum::<f64>() / count as f64;
    let variance = ratings.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / count as f64;
    let sd = variance.sqrt();
    let p95 = ratings[((count as f64 * 0.95).ceil() as usize)
        .saturating_sub(1)
        .min(count as usize - 1)];
    let above_130 = ratings.iter().filter(|r| **r >= 1.3).count() as f64 / count as f64 * 100.0;
    let below_070 = ratings.iter().filter(|r| **r <= 0.7).count() as f64 / count as f64 * 100.0;
    let drift = count >= 50 && (mean - 1.0).abs() > 0.08;
    Ok(RatingDistribution {
        buckets,
        mean: Some((mean * 100.0).round() / 100.0),
        sd: Some((sd * 100.0).round() / 100.0),
        count,
        p95: Some(p95),
        above_130: (above_130 * 10.0).round() / 10.0,
        below_070: (below_070 * 10.0).round() / 10.0,
        drift,
        dimensions: Some(DimensionAverages {
            rigor: avg_dim(|d| d.rigor),
            computation: avg_dim(|d| d.computation),
            modeling: avg_dim(|d| d.modeling),
            method_use: avg_dim(|d| d.method_use),
            speed: avg_dim(|d| d.speed),
            strategy_insight: avg_dim(|d| d.strategy_insight),
            sample,
        }),
    })
}

fn record_attempt_row(conn: &Connection, input: &AttemptInput) -> Result<i64, String> {
    let now = Local::now();
    let duration = input.duration_seconds.clamp(1, 1800);
    let rating = input.self_rating.clamp(1, 4);
    let outcome = input.outcome.as_deref().unwrap_or(&input.result);
    let evidence_source = input.evidence_source.as_deref().unwrap_or("self_report");
    let fluency_rating = input.fluency_rating.unwrap_or(rating).clamp(1, 4);
    let session_id = input.session_id.as_deref().unwrap_or("");
    let diagnosis_id = input.diagnosis_id.as_deref();
    let dims = input.dimensions.unwrap_or_default();

    conn.execute(
        "INSERT INTO attempts(
            question_id, attempted_at, duration_seconds, result, self_rating, selected_answer, mode,
            outcome, evidence_source, fluency_rating, confidence, session_id, diagnosis_id, ai_rating,
            difficulty_multiplier, technique_level,
            dim_rigor, dim_computation, dim_modeling, dim_method_use, dim_speed, dim_strategy_insight
        ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)",
        params![
            input.question_id,
            now.to_rfc3339(),
            duration,
            input.result,
            rating,
            input.selected_answer,
            input.mode.clone().unwrap_or_else(|| "paper".into()),
            outcome,
            evidence_source,
            fluency_rating,
            input.confidence,
            session_id,
            diagnosis_id,
            input.ai_rating.map(|value| value.clamp(AI_RATING_MIN, AI_RATING_MAX)),
            input.difficulty_multiplier,
            input.technique_level,
            dims.rigor,
            dims.computation,
            dims.modeling,
            dims.method_use,
            dims.speed,
            dims.strategy_insight,
        ],
    )
    .map_err(|e| e.to_string())?;
    let attempt_id = conn.last_insert_rowid();
    // Learning evidence is an append-only sidecar. It never changes Rating/ELO,
    // and sidecar failure cannot discard the already-saved attempt.
    let category_key = conn
        .query_row(
            "SELECT category_path FROM questions WHERE id=?1",
            [input.question_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "未分类".into());
    if let Err(error) = services::learning::record_attempt_evidence(
        conn,
        services::learning::AttemptEvidenceInput {
            evidence_key: format!("attempt:{attempt_id}"),
            task_id: input
                .diagnosis_id
                .clone()
                .or_else(|| input.session_id.clone()),
            question_id: input.question_id,
            attempt_id,
            category_key,
            source: evidence_source.to_string(),
            outcome: outcome.to_string(),
            confidence: input.confidence.unwrap_or(1.0).clamp(0.0, 1.0),
            self_rating: fluency_rating,
            mode: input.mode.clone().unwrap_or_else(|| "paper".into()),
            occurred_at: now.to_rfc3339(),
            normalized_error_class: None,
            next_action: None,
        },
    ) {
        eprintln!(
            "learning evidence skipped for question {}: {error}",
            input.question_id
        );
    }
    if outcome == "uncertain" {
        complete_active_recommendation_item(conn, input.question_id, attempt_id)?;
        return Ok(attempt_id);
    }
    // ELO settlement must never block the attempt itself.
    if let Err(error) = settle_elo(conn, input, outcome, fluency_rating, duration, attempt_id) {
        eprintln!(
            "ELO settlement skipped for question {}: {error}",
            input.question_id
        );
    }
    // Correctness controls mastery direction; fluency only refines a confirmed result.
    let progress_rating = if outcome == "correct" {
        fluency_rating
    } else {
        fluency_rating.min(2)
    };
    let prev_progress: Option<(i64, Option<i64>)> = conn
        .query_row(
            "SELECT review_count, mastery FROM progress WHERE question_id=?1",
            [input.question_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let intervals = review_intervals(conn);
    let (days, next_review_count) = if progress_rating <= 2 {
        // Lapse: rating 1 or 2 resets review progression back to the start
        let d = match progress_rating {
            1 => intervals[0],
            _ => intervals[1],
        };
        (d, 1)
    } else {
        // Successful recall (rating 3 or 4): the interval doubles with each
        // consecutive success instead of jumping to a flat ×2, approximating
        // SM-2's expanding schedule (1×, 2×, 4×, 8×, capped at 180 days).
        let prev_count = prev_progress.map(|(c, _)| c).unwrap_or(0);
        let next_count = prev_count + 1;
        let base = if progress_rating == 3 {
            intervals[2]
        } else {
            intervals[3]
        };
        let growth = 2_i64.pow((next_count - 1).min(3) as u32);
        ((base * growth).min(180), next_count)
    };
    let next = (now.date_naive() + Duration::days(days)).to_string();
    conn.execute(
        "INSERT INTO progress(question_id,mastery,last_attempt_at,next_review,review_count) VALUES(?1,?2,?3,?4,?5)
         ON CONFLICT(question_id) DO UPDATE SET mastery=excluded.mastery,last_attempt_at=excluded.last_attempt_at,next_review=excluded.next_review,review_count=excluded.review_count",
        params![input.question_id, progress_rating, now.to_rfc3339(), next, next_review_count],
    )
    .map_err(|e| e.to_string())?;
    complete_active_recommendation_item(conn, input.question_id, attempt_id)?;
    Ok(attempt_id)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TacticalProfile {
    pub nickname: String,
    pub title: String,
    pub combat_power: i64,
    pub current_elo: f64,
    pub peak_elo: f64,
    pub current_rank_letter: String,
    pub peak_rank_letter: String,
    pub we_score: f64,
    pub rating_pro: f64,
    pub matches: i64,
    pub win_rate: f64,
    pub headshot_rate: f64,
    pub adr: i64,
    pub kd_ratio: f64,
    pub rws: f64,
    pub firepower: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TacticalMapSubject {
    pub id: String,
    pub name: String,
    pub map_alias: String,
    pub total_questions: i64,
    pub attempted_count: i64,
    pub correct_count: i64,
    pub win_rate: f64,
    pub rating_pro: f64,
    pub adr: i64,
    pub avg_kills: f64,
    pub firepower: i64,
    pub ct_win_rate: f64,
    pub t_win_rate: f64,
    pub mastery_grade: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TacticalAbilitySkill {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub grade: String,
    pub score: f64,
    pub desc: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TacticalDimension {
    pub key: String,
    pub label: String,
    pub value: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TacticalWeapon {
    pub id: String,
    pub name: String,
    pub alias: String,
    pub method_name: String,
    pub kill_time: i64,
    pub kill_time_grade: String,
    pub kills: i64,
    pub total_attempts: i64,
    pub spray_accuracy: f64,
    pub spray_grade: String,
    pub headshot_rate: f64,
    pub headshot_grade: String,
    pub quick_stop_rate: f64,
    pub quick_stop_grade: String,
    pub avg_kills: f64,
    pub avg_kills_grade: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TacticalDashboardData {
    pub profile: TacticalProfile,
    pub map_subjects: Vec<TacticalMapSubject>,
    pub dimensions: Vec<TacticalDimension>,
    pub specialty_skills: Vec<TacticalAbilitySkill>,
    pub weapons: Vec<TacticalWeapon>,
    pub current_season: String,
}

fn score_to_grade(score: f64) -> &'static str {
    if score >= 92.0 {
        "S"
    } else if score >= 82.0 {
        "A"
    } else if score >= 70.0 {
        "B"
    } else if score >= 55.0 {
        "C"
    } else {
        "D"
    }
}

fn time_to_grade(ms: i64) -> &'static str {
    if ms <= 280 {
        "S"
    } else if ms <= 420 {
        "A"
    } else if ms <= 600 {
        "B"
    } else if ms <= 780 {
        "C"
    } else {
        "D"
    }
}

fn rank_letter_for_elo(elo: f64) -> &'static str {
    match services::rating::rank_band_index(elo) {
        0 => "D",
        1 => "D+",
        2 => "C",
        3 => "C+",
        4 => "B",
        5 => "B+",
        6 => "A",
        7 => "A+",
        _ => "S",
    }
}

struct TacticalAttemptRow {
    category_path: String,
    question_type: String,
    difficulty: i64,
    stem: String,
    outcome: String,
    fluency: i32,
    duration: i64,
    bench: i64,
    ai_rating: Option<f64>,
    rigor: Option<f64>,
    computation: Option<f64>,
    modeling: Option<f64>,
    method_use: Option<f64>,
    speed: Option<f64>,
    strategy_insight: Option<f64>,
}

// 这是一次全库六维聚合，属于重量级查询。声明为 async 后由 Tauri 调度到异步运行时执行，
// 不再占用主线程——此前同步执行会让打开好友页、后台同步时界面出现可感知的停顿。
#[tauri::command]
async fn get_tactical_dashboard_stats(
    scope: String,
    state: State<'_, AppState>,
) -> Result<TacticalDashboardData, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mode_filter = match scope.as_str() {
        "ranked" => "a.mode IN ('paper', 'paper-codex', 'pressure')",
        "solo" => "a.mode IN ('practice', 'recommendation')",
        _ => "1=1",
    };

    let (_, current_elo) = current_elo(&conn)?;
    let peak_elo: f64 = conn
        .query_row(
            "SELECT COALESCE(MAX(rating_after), ?1) FROM elo_events",
            [current_elo],
            |r| r.get(0),
        )
        .unwrap_or(current_elo);

    let season_status_obj = season_status(&conn).unwrap_or(SeasonStatus {
        name: "2026S2·热浪争锋".into(),
        index: 0,
        started_at: Local::now().to_rfc3339(),
        current_elo,
        history: Vec::new(),
    });

    let sql = format!(
        "SELECT q.category_path, q.question_type, q.difficulty, q.stem,
                COALESCE(a.outcome, a.result) AS outcome,
                COALESCE(a.fluency_rating, a.self_rating) AS fluency,
                a.duration_seconds, a.ai_rating,
                a.dim_rigor, a.dim_computation, a.dim_modeling, a.dim_method_use, a.dim_speed,
                a.dim_strategy_insight
         FROM attempts a
         JOIN questions q ON q.id = a.question_id
         WHERE {mode_filter} AND COALESCE(a.outcome, a.result) <> 'uncertain'
         ORDER BY a.id ASC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            let qtype: String = r.get(1)?;
            let bench = services::rating::benchmark_seconds(&qtype);
            Ok(TacticalAttemptRow {
                category_path: r.get(0)?,
                question_type: qtype,
                difficulty: r.get(2)?,
                stem: r.get(3)?,
                outcome: r.get(4)?,
                fluency: r.get(5)?,
                duration: r.get(6)?,
                bench,
                ai_rating: r.get(7)?,
                rigor: r.get(8)?,
                computation: r.get(9)?,
                modeling: r.get(10)?,
                method_use: r.get(11)?,
                speed: r.get(12)?,
                strategy_insight: r.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let matches = rows.len() as i64;
    let correct_count = rows.iter().filter(|r| r.outcome == "correct").count() as i64;
    let wrong_count = rows
        .iter()
        .filter(|r| r.outcome == "incorrect" || r.outcome == "wrong")
        .count() as i64;
    let win_rate = if matches > 0 {
        ((correct_count as f64 / matches as f64) * 1000.0).round() / 10.0
    } else {
        0.0
    };
    let kd_ratio = if wrong_count > 0 {
        ((correct_count as f64 / wrong_count as f64) * 100.0).round() / 100.0
    } else {
        correct_count as f64
    };

    let headshot_count = rows
        .iter()
        .filter(|r| r.outcome == "correct" && r.duration <= (r.bench / 2).max(10))
        .count() as i64;
    let headshot_rate = if correct_count > 0 {
        ((headshot_count as f64 / correct_count as f64) * 1000.0).round() / 10.0
    } else {
        0.0
    };

    let raw_points: f64 = rows
        .iter()
        .map(|r| {
            if r.outcome == "correct" {
                if r.question_type == "solution" {
                    10.0
                } else {
                    5.0
                }
            } else {
                0.0
            }
        })
        .sum();
    let adr = if matches > 0 {
        ((raw_points / matches as f64) * 20.0).round() as i64
    } else {
        0
    };

    let rws = if matches > 0 {
        let win_ratio = correct_count as f64 / matches as f64;
        let avg_fluency: f64 = rows
            .iter()
            .filter(|r| r.outcome == "correct")
            .map(|r| r.fluency as f64)
            .sum::<f64>()
            / correct_count.max(1) as f64;
        ((win_ratio * 12.0 + avg_fluency * 2.0) * 100.0).round() / 100.0
    } else {
        0.0
    };

    let ratings: Vec<f64> = rows
        .iter()
        .map(|r| {
            if let Some(ai) = r.ai_rating {
                ai
            } else {
                services::rating::attempt_rating(&r.outcome, r.fluency, r.duration, r.bench)
            }
        })
        .collect();
    let rating_pro = if !ratings.is_empty() {
        ((ratings.iter().sum::<f64>() / ratings.len() as f64) * 100.0).round() / 100.0
    } else {
        1.0
    };

    // --- 六维能力精准聚合 ---
    let mut sum_rigor = 0.0;
    let mut sum_comp = 0.0;
    let mut sum_speed = 0.0;
    let mut sum_mod = 0.0;
    let mut sum_meth = 0.0;
    let mut sum_strat = 0.0;
    let mut sum_weights = 0.0;

    for (i, r) in rows.iter().enumerate() {
        let r_rating = ratings[i];
        let diff_weight = (r.difficulty as f64).clamp(1.0, 5.0);

        // 速度 (Speed)：基准时间完成给 62 分，半时秒杀给 86 分，极速突破(0.35x)给 94 分，超时快速衰减
        let r_speed = r.speed.unwrap_or_else(|| {
            let pace = (r.duration as f64 / r.bench.max(1) as f64).clamp(0.2, 2.0);
            if r.outcome != "correct" {
                ((1.0 - pace) * 20.0 + 40.0).clamp(20.0, 46.0)
            } else if pace <= 0.35 {
                95.0 - (pace - 0.2) * 26.6
            } else if pace <= 0.6 {
                91.0 - (pace - 0.35) * 36.0
            } else if pace <= 1.0 {
                82.0 - (pace - 0.6) * 50.0
            } else {
                (62.0 - (pace - 1.0) * 32.0).clamp(25.0, 62.0)
            }
        });

        // 枪法 / 计算力 (Computation)：基础题做对仅给及格分(68~75)，必须攻克高难题目/无笔误才能得 85+ / 90+
        let r_comp = r.computation.unwrap_or_else(|| {
            if r.outcome == "correct" {
                let base = match diff_weight as i64 {
                    1 => 68.0,
                    2 => 74.0,
                    3 => 81.0,
                    4 => 88.0,
                    _ => 93.0,
                };
                (base + (r.fluency as f64 - 2.0) * 3.2).clamp(52.0, 98.0)
            } else if r.outcome == "partial" {
                48.0 + (diff_weight * 2.0)
            } else {
                30.0 + (diff_weight * 2.0)
            }
        });

        // 严谨性 / 补枪 (Rigor)：解答证明题步骤完备性，选择填空只猜对分值保守
        let r_rig = r.rigor.unwrap_or_else(|| {
            if r.outcome == "correct" {
                if r.question_type == "solution" {
                    if r.fluency >= 4 {
                        90.0
                    } else {
                        80.0
                    }
                } else {
                    if r.fluency >= 4 {
                        82.0
                    } else {
                        74.0
                    }
                }
            } else if r.outcome == "partial" {
                52.0
            } else {
                32.0
            }
        });

        // 审题建模 (Modeling)
        let r_mod = r.modeling.unwrap_or_else(|| {
            if r.outcome == "correct" {
                (68.0 + diff_weight * 3.8 + (r.fluency as f64 * 2.0)).clamp(58.0, 96.0)
            } else {
                36.0
            }
        });

        // 方法运用 / 道具 (Method Use)
        let r_meth = r.method_use.unwrap_or_else(|| {
            if r.outcome == "correct" {
                (62.0 + (r.fluency as f64 * 6.5) + (diff_weight * 2.5)).clamp(54.0, 96.0)
            } else {
                34.0
            }
        });

        // 策略洞察力 (Strategy Insight)
        let r_strat = r
            .strategy_insight
            .unwrap_or_else(|| (r_rating * 40.0 + 24.0).clamp(28.0, 96.0));

        // 加权累加：赋予近期做题更高权重 (1.0 -> 2.2)，让最新突破与失误产生真实波动
        let weight = 1.0 + (i as f64 / rows.len().max(1) as f64) * 1.2;
        sum_weights += weight;
        sum_rigor += r_rig * weight;
        sum_comp += r_comp * weight;
        sum_speed += r_speed * weight;
        sum_mod += r_mod * weight;
        sum_meth += r_meth * weight;
        sum_strat += r_strat * weight;
    }

    let total_w = sum_weights.max(1.0);
    // 敏感度对比度扩张 (Contrast Stretch)：打破大数定律均值钝化，拉开各维度区分度与波动性
    let stretch = |raw: f64| -> f64 {
        let center = 60.0;
        let stretched = center + (raw - center) * 1.52;
        (stretched.clamp(18.0, 98.0) * 10.0).round() / 10.0
    };

    let dim_rigor = if matches > 0 {
        stretch(sum_rigor / total_w)
    } else {
        64.0
    };
    let dim_comp = if matches > 0 {
        stretch(sum_comp / total_w)
    } else {
        65.0
    };
    let dim_speed = if matches > 0 {
        stretch(sum_speed / total_w)
    } else {
        62.0
    };
    let dim_mod = if matches > 0 {
        stretch(sum_mod / total_w)
    } else {
        64.0
    };
    let dim_meth = if matches > 0 {
        stretch(sum_meth / total_w)
    } else {
        63.0
    };
    let dim_strat = if matches > 0 {
        stretch(sum_strat / total_w)
    } else {
        62.0
    };

    let dimensions = vec![
        TacticalDimension {
            key: "rigor".into(),
            label: "严谨性".into(),
            value: dim_rigor,
        },
        TacticalDimension {
            key: "computation".into(),
            label: "计算力".into(),
            value: dim_comp,
        },
        TacticalDimension {
            key: "speed".into(),
            label: "速度".into(),
            value: dim_speed,
        },
        TacticalDimension {
            key: "modeling".into(),
            label: "审题建模".into(),
            value: dim_mod,
        },
        TacticalDimension {
            key: "methodUse".into(),
            label: "方法使用".into(),
            value: dim_meth,
        },
        TacticalDimension {
            key: "strategyInsight".into(),
            label: "策略洞察力".into(),
            value: dim_strat,
        },
    ];

    let we_score =
        ((dim_rigor + dim_comp + dim_speed + dim_mod + dim_meth + dim_strat) / 6.0 * 10.0).round()
            / 10.0;
    // 火力值 (Firepower)：严苛门槛，常态 Rating 1.00 对应 60~65，只有具备高压压轴秒杀能力才可破 85+
    let firepower = if matches > 0 {
        let fp_calc =
            (rating_pro - 0.40).max(0.0) * 36.0 + win_rate * 0.32 + (matches.min(30) as f64 * 0.20);
        fp_calc.clamp(10.0, 99.0).round() as i64
    } else {
        60
    };
    let combat_power = ((current_elo * 1.2
        + matches as f64 * 8.0
        + correct_count as f64 * 10.0
        + rating_pro * 200.0)
        .clamp(100.0, 9999.0))
    .round() as i64;

    // 动态战术代号
    let max_dim = [
        (dim_rigor, "滴水不漏的逻辑防线"),
        (dim_comp, "精准制导的重炮轰炸机"),
        (dim_speed, "极速突破的先锋猎手"),
        (dim_mod, "洞若观火的战场指挥官"),
        (dim_meth, "深谙兵法的战术大师"),
        (dim_strat, "一锤定音的战场收割者"),
    ]
    .into_iter()
    .max_by(|a, b| a.0.total_cmp(&b.0))
    .map(|(_, title)| title)
    .unwrap_or("一锤定音的战场收割者");

    let user_nickname = setting(&conn, "user_nickname", "dr7fter");
    let profile = TacticalProfile {
        nickname: user_nickname,
        title: max_dim.into(),
        combat_power,
        current_elo,
        peak_elo,
        current_rank_letter: rank_letter_for_elo(current_elo).into(),
        peak_rank_letter: rank_letter_for_elo(peak_elo).into(),
        we_score,
        rating_pro,
        matches,
        win_rate,
        headshot_rate,
        adr,
        kd_ratio,
        rws,
        firepower,
    };

    // --- 5 大学科地图表现 ---
    let map_configs = [
        ("single_calculus", "一元微积分与极限", "荒漠迷城 (Mirage)", "category_path LIKE '高等数学 / 一元%'"),
        ("multi_integral", "多元函数微积分", "炼狱小镇 (Inferno)", "category_path LIKE '高等数学 / 多元%'"),
        ("diff_eq", "微分方程与无穷级数", "核子危机 (Nuke)", "category_path LIKE '高等数学 / 微分方程%' OR category_path LIKE '高等数学 / 无穷级数%'"),
        ("linear_algebra", "线性代数与二次型", "炙热沙城 (Dust II)", "category_path LIKE '线性代数%'"),
        ("probability", "概率论与数理统计", "远古遗迹 (Ancient)", "category_path LIKE '概率统计%'"),
    ];

    let mut map_subjects = Vec::new();
    for (id, name, alias, sql_cond) in map_configs {
        let total_qs: i64 = conn
            .query_row(
                &format!("SELECT COUNT(id) FROM questions WHERE {sql_cond}"),
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let subj_rows: Vec<&TacticalAttemptRow> = rows
            .iter()
            .filter(|r| {
                if id == "single_calculus" {
                    r.category_path.starts_with("高等数学 / 一元")
                } else if id == "multi_integral" {
                    r.category_path.starts_with("高等数学 / 多元")
                } else if id == "diff_eq" {
                    r.category_path.starts_with("高等数学 / 微分方程")
                        || r.category_path.starts_with("高等数学 / 无穷级数")
                } else if id == "linear_algebra" {
                    r.category_path.starts_with("线性代数")
                } else {
                    r.category_path.starts_with("概率统计")
                }
            })
            .collect();

        let s_attempted = subj_rows.len() as i64;
        let s_correct = subj_rows.iter().filter(|r| r.outcome == "correct").count() as i64;
        let s_win_rate = if s_attempted > 0 {
            ((s_correct as f64 / s_attempted as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        };

        let s_ratings: Vec<f64> = subj_rows
            .iter()
            .map(|r| {
                if let Some(ai) = r.ai_rating {
                    ai
                } else {
                    services::rating::attempt_rating(&r.outcome, r.fluency, r.duration, r.bench)
                }
            })
            .collect();
        let s_rating_pro = if !s_ratings.is_empty() {
            ((s_ratings.iter().sum::<f64>() / s_ratings.len() as f64) * 100.0).round() / 100.0
        } else {
            0.0
        };

        let ct_rows: Vec<&&TacticalAttemptRow> = subj_rows
            .iter()
            .filter(|r| r.question_type == "single_choice" || r.question_type == "multiple_choice")
            .collect();
        let ct_correct = ct_rows.iter().filter(|r| r.outcome == "correct").count() as i64;
        let ct_win_rate = if !ct_rows.is_empty() {
            ((ct_correct as f64 / ct_rows.len() as f64) * 100.0).round()
        } else {
            s_win_rate
        };

        let t_rows: Vec<&&TacticalAttemptRow> = subj_rows
            .iter()
            .filter(|r| r.question_type == "fill_blank" || r.question_type == "solution")
            .collect();
        let t_correct = t_rows.iter().filter(|r| r.outcome == "correct").count() as i64;
        let t_win_rate = if !t_rows.is_empty() {
            ((t_correct as f64 / t_rows.len() as f64) * 100.0).round()
        } else {
            s_win_rate
        };

        let s_adr = if s_attempted > 0 {
            let pts: f64 = subj_rows
                .iter()
                .map(|r| {
                    if r.outcome == "correct" {
                        if r.question_type == "solution" {
                            10.0
                        } else {
                            5.0
                        }
                    } else {
                        0.0
                    }
                })
                .sum();
            ((pts / s_attempted as f64) * 20.0).round() as i64
        } else {
            0
        };

        let s_firepower = if s_attempted > 0 {
            let fp_map = (s_rating_pro - 0.40).max(0.0) * 36.0
                + s_win_rate * 0.32
                + (s_attempted.min(30) as f64 * 0.20);
            fp_map.clamp(10.0, 99.0).round() as i64
        } else {
            0
        };

        let s_avg_kills = if s_attempted > 0 {
            ((s_correct as f64 / (s_attempted as f64 / 5.0).max(1.0)) * 10.0).round() / 10.0
        } else {
            0.0
        };

        let mastery_grade = if s_attempted >= 5 {
            score_to_grade(s_win_rate).to_string()
        } else {
            "C".into()
        };

        map_subjects.push(TacticalMapSubject {
            id: id.into(),
            name: name.into(),
            map_alias: alias.into(),
            total_questions: total_qs,
            attempted_count: s_attempted,
            correct_count: s_correct,
            win_rate: s_win_rate,
            rating_pro: s_rating_pro,
            adr: s_adr,
            avg_kills: s_avg_kills,
            firepower: s_firepower,
            ct_win_rate,
            t_win_rate,
            mastery_grade,
        });
    }

    // --- 6 项特化技能评级 ---
    let solution_rows: Vec<&TacticalAttemptRow> = rows
        .iter()
        .filter(|r| r.question_type == "solution")
        .collect();
    let solution_score = if !solution_rows.is_empty() {
        let sol_c = solution_rows
            .iter()
            .filter(|r| r.outcome == "correct")
            .count() as f64;
        let sol_diff_avg = solution_rows
            .iter()
            .map(|r| r.difficulty as f64)
            .sum::<f64>()
            / solution_rows.len() as f64;
        ((sol_c / solution_rows.len() as f64) * 75.0 + (sol_diff_avg * 4.0)).clamp(25.0, 98.0)
    } else {
        dim_comp
    };

    let hard_rows: Vec<&TacticalAttemptRow> = rows.iter().filter(|r| r.difficulty >= 3).collect();
    let hard_score = if !hard_rows.is_empty() {
        let h_c = hard_rows.iter().filter(|r| r.outcome == "correct").count() as f64;
        let h_win = (h_c / hard_rows.len() as f64) * 100.0;
        (h_win * 0.85 + 10.0).clamp(20.0, 98.0)
    } else {
        dim_strat
    };

    let specialty_skills = vec![
        TacticalAbilitySkill {
            id: "gunplay".into(),
            label: "枪法".into(),
            icon: "Crosshair".into(),
            grade: score_to_grade(dim_comp).into(),
            score: dim_comp,
            desc: "基础计算与选填定性判断".into(),
        },
        TacticalAbilitySkill {
            id: "trade".into(),
            label: "补枪".into(),
            icon: "Zap".into(),
            grade: score_to_grade((dim_rigor * 0.7 + win_rate * 0.3).clamp(30.0, 98.0)).into(),
            score: dim_rigor,
            desc: "错题订正复盘与二刷闭环率".into(),
        },
        TacticalAbilitySkill {
            id: "entry".into(),
            label: "突破".into(),
            icon: "TrendingUp".into(),
            grade: score_to_grade(dim_speed).into(),
            score: dim_speed,
            desc: "新题快速破局与首刷秒杀率".into(),
        },
        TacticalAbilitySkill {
            id: "utility".into(),
            label: "道具".into(),
            icon: "ShieldAlert".into(),
            grade: score_to_grade(dim_meth).into(),
            score: dim_meth,
            desc: "公式定理熟练度与秒杀技巧".into(),
        },
        TacticalAbilitySkill {
            id: "clutch".into(),
            label: "残局".into(),
            icon: "Target".into(),
            grade: score_to_grade(solution_score).into(),
            score: solution_score,
            desc: "高分综合解答题攻坚抗压能力".into(),
        },
        TacticalAbilitySkill {
            id: "sniper".into(),
            label: "狙击".into(),
            icon: "Crosshair".into(),
            grade: score_to_grade(hard_score).into(),
            score: hard_score,
            desc: "三星核心难点考题精准突破".into(),
        },
    ];

    fn match_ak47(r: &TacticalAttemptRow) -> bool {
        r.category_path.contains("极限")
            || r.category_path.contains("导数")
            || r.stem.contains("泰勒")
            || r.stem.contains("等价无穷小")
            || r.stem.contains("麦克劳林")
    }
    fn match_awp(r: &TacticalAttemptRow) -> bool {
        r.category_path.contains("积分")
            || r.category_path.contains("微积分")
            || r.stem.contains("对称")
            || r.stem.contains("Wallis")
            || r.stem.contains("点火")
    }
    fn match_usps(r: &TacticalAttemptRow) -> bool {
        r.category_path.contains("线性代数")
            || r.category_path.contains("矩阵")
            || r.category_path.contains("行列式")
            || r.category_path.contains("特征值")
    }
    fn match_glock(r: &TacticalAttemptRow) -> bool {
        r.category_path.contains("概率")
            || r.category_path.contains("随机变量")
            || r.category_path.contains("分布")
            || r.stem.contains("似然")
    }

    // --- 4 大核心考法武器分析 ---
    let weapon_configs: [(&str, &str, &str, &str, fn(&TacticalAttemptRow) -> bool); 4] = [
        (
            "ak47",
            "AK-47",
            "步枪之王",
            "泰勒展开与等价无穷小",
            match_ak47,
        ),
        (
            "awp",
            "AWP",
            "一枪毙命",
            "二重积分与King对称变换",
            match_awp,
        ),
        (
            "usps",
            "USP-S",
            "消音手枪",
            "分块矩阵与特征值对角化",
            match_usps,
        ),
        (
            "glock",
            "Glock-18",
            "近程爆发",
            "连续型随机变量与极大似然",
            match_glock,
        ),
    ];

    let mut weapons = Vec::new();
    for (wid, wname, walias, wmname, matcher) in weapon_configs {
        let w_rows: Vec<&TacticalAttemptRow> = rows.iter().filter(|r| matcher(r)).collect();
        let w_total = w_rows.len() as i64;
        let w_kills = w_rows.iter().filter(|r| r.outcome == "correct").count() as i64;

        let w_acc = if w_total > 0 {
            ((w_kills as f64 / w_total as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        };

        let w_durations: Vec<i64> = w_rows
            .iter()
            .filter(|r| r.outcome == "correct")
            .map(|r| r.duration)
            .collect();
        let avg_dur_sec = if !w_durations.is_empty() {
            w_durations.iter().sum::<i64>() / w_durations.len() as i64
        } else {
            45
        };
        let kill_time_ms = (avg_dur_sec * 8).clamp(240, 950);

        let w_hs_count = w_rows
            .iter()
            .filter(|r| r.outcome == "correct" && r.duration <= (r.bench / 2).max(10))
            .count() as i64;
        let w_hs_rate = if w_kills > 0 {
            ((w_hs_count as f64 / w_kills as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        };

        let w_quick_stop_count = w_rows.iter().filter(|r| r.fluency >= 3).count() as i64;
        let w_quick_stop_rate = if w_total > 0 {
            ((w_quick_stop_count as f64 / w_total as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        };

        let avg_kills = if w_total > 0 {
            ((w_kills as f64 / (w_total as f64 / 10.0).max(1.0)) * 10.0).round() / 10.0
        } else {
            0.0
        };

        weapons.push(TacticalWeapon {
            id: wid.into(),
            name: wname.into(),
            alias: walias.into(),
            method_name: wmname.into(),
            kill_time: kill_time_ms,
            kill_time_grade: time_to_grade(kill_time_ms).into(),
            kills: w_kills,
            total_attempts: w_total,
            spray_accuracy: w_acc,
            spray_grade: score_to_grade(w_acc).into(),
            headshot_rate: w_hs_rate,
            headshot_grade: score_to_grade(w_hs_rate).into(),
            quick_stop_rate: w_quick_stop_rate,
            quick_stop_grade: score_to_grade(w_quick_stop_rate).into(),
            avg_kills,
            avg_kills_grade: score_to_grade(avg_kills * 12.0).into(),
        });
    }

    Ok(TacticalDashboardData {
        profile,
        map_subjects,
        dimensions,
        specialty_skills,
        weapons,
        current_season: season_status_obj.name,
    })
}

#[tauri::command]
fn toggle_favorite(question_id: i64, state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let current: i32 = conn
        .query_row(
            "SELECT favorite FROM progress WHERE question_id=?1",
            [question_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(0);
    let next = i32::from(current == 0);
    conn.execute("INSERT INTO progress(question_id,favorite) VALUES(?1,?2) ON CONFLICT(question_id) DO UPDATE SET favorite=excluded.favorite",params![question_id,next]).map_err(|e|e.to_string())?;
    Ok(next != 0)
}

#[tauri::command]
fn save_note(question_id: i64, note: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO progress(question_id,note) VALUES(?1,?2)
         ON CONFLICT(question_id) DO UPDATE SET note=excluded.note",
        params![question_id, note],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_review_intervals(intervals: Vec<i64>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let keys = [
        "review_interval_1",
        "review_interval_2",
        "review_interval_3",
        "review_interval_4",
    ];
    for (index, key) in keys.iter().enumerate() {
        let value = intervals
            .get(index)
            .cloned()
            .unwrap_or([1, 3, 7, 15][index])
            .clamp(1, 180);
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES(?1,?2)",
            params![key, value.to_string()],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn export_db_copy(conn: &Connection, destination: &Path) -> Result<(), String> {
    // WAL mode means the main .db file may lag behind; checkpoint first so the
    // copy includes all committed data.
    conn.execute_batch("PRAGMA wal_checkpoint(FULL);")
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(destination.parent().ok_or("无效的备份路径")?).map_err(|e| e.to_string())?;
    let source = conn.path().ok_or("数据库连接没有文件路径")?;
    fs::copy(source, destination).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportResult {
    db_path: String,
    json_path: String,
}

#[tauri::command]
fn export_records(state: State<AppState>) -> Result<ExportResult, String> {
    let backup_dir = state.data_dir.join("backups");
    let stamp = Local::now().format("%Y%m%d-%H%M%S");
    let db_path = backup_dir.join(format!("shuaba-{stamp}.db"));
    let json_path = backup_dir.join(format!("records-{stamp}.json"));
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        export_db_copy(&conn, &db_path)?;
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let attempts: Vec<Value> = conn
        .prepare("SELECT id,question_id,attempted_at,duration_seconds,result,self_rating,mode,outcome,evidence_source,fluency_rating,confidence,session_id,diagnosis_id,ai_rating FROM attempts ORDER BY attempted_at")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "questionId": row.get::<_, i64>(1)?,
                "attemptedAt": row.get::<_, String>(2)?,
                "durationSeconds": row.get::<_, i64>(3)?,
                "result": row.get::<_, String>(4)?,
                "selfRating": row.get::<_, i64>(5)?,
                "mode": row.get::<_, String>(6)?,
                "outcome": row.get::<_, Option<String>>(7)?,
                "evidenceSource": row.get::<_, Option<String>>(8)?,
                "fluencyRating": row.get::<_, Option<i64>>(9)?,
                "confidence": row.get::<_, Option<f64>>(10)?,
                "sessionId": row.get::<_, Option<String>>(11)?,
                "diagnosisId": row.get::<_, Option<String>>(12)?,
                "aiRating": row.get::<_, Option<f64>>(13)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let progress: Vec<Value> = conn
        .prepare("SELECT question_id,favorite,mastery,last_attempt_at,next_review,review_count,note FROM progress")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok(json!({
                "questionId": row.get::<_, i64>(0)?,
                "favorite": row.get::<_, i64>(1)?,
                "mastery": row.get::<_, Option<i64>>(2)?,
                "lastAttemptAt": row.get::<_, Option<String>>(3)?,
                "nextReview": row.get::<_, Option<String>>(4)?,
                "reviewCount": row.get::<_, i64>(5)?,
                "note": row.get::<_, Option<String>>(6)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let settings: Vec<Value> = conn
        .prepare("SELECT key,value FROM settings")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok(json!({ "key": row.get::<_, String>(0)?, "value": row.get::<_, String>(1)? }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let reward_events: Vec<Value> = conn
        .prepare("SELECT event_id,reward_type,amount,meta_json,created_at FROM reward_events ORDER BY created_at")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok(json!({
                "eventId": row.get::<_, String>(0)?,
                "rewardType": row.get::<_, String>(1)?,
                "amount": row.get::<_, i64>(2)?,
                "metaJson": row.get::<_, Option<String>>(3)?,
                "createdAt": row.get::<_, String>(4)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let doc = json!({
        "app": "刷吧",
        "version": "0.9.0",
        "exportedAt": Local::now().to_rfc3339(),
        "attempts": attempts,
        "progress": progress,
        "settings": settings,
        "rewardEvents": reward_events,
    });
    fs::write(
        &json_path,
        serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(ExportResult {
        db_path: db_path.to_string_lossy().into_owned(),
        json_path: json_path.to_string_lossy().into_owned(),
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InboxSummary {
    pending_count: i64,
    failed_count: i64,
    last_processed_task_id: Option<String>,
}

#[tauri::command]
fn refresh_inbox(state: State<AppState>) -> Result<InboxSummary, String> {
    scan_inbox(&state)?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let pending_count = conn
        .query_row(
            "SELECT COUNT(*) FROM codex_inbox WHERE status='pending'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let last_processed_task_id: Option<String> = conn
        .query_row(
            "SELECT task_id FROM codex_inbox ORDER BY id DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(InboxSummary {
        pending_count,
        failed_count: inbox_failed_count(&state),
        last_processed_task_id,
    })
}

#[tauri::command]
fn save_goal(input: GoalInput, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    for (k, v) in [
        ("daily_mode", input.daily_mode),
        (
            "daily_problem_target",
            input.daily_problem_target.clamp(1, 200).to_string(),
        ),
        (
            "daily_minute_target",
            input.daily_minute_target.clamp(5, 600).to_string(),
        ),
    ] {
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES(?1,?2)",
            params![k, v],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn learning_category_path(conn: &Connection, category_id: Option<i64>, request_text: &str) -> Option<String> {
    if let Some(id) = category_id.filter(|&v| v > 0) {
        if let Ok(Some(path)) = conn.query_row("SELECT path FROM categories WHERE id=?1", [id], |r| r.get(0)).optional() {
            return Some(path);
        }
    }

    let req_lower = request_text.to_lowercase();
    let trimmed = req_lower.trim();

    if !trimmed.is_empty() {
        let topic_rules: &[(&[&str], &str)] = &[
            // 多元微分
            (&["多元微分", "多元函数微分", "偏导", "全微分", "切平面", "法线", "方向导数", "极值", "条件极值", "拉格朗日乘数"], "高等数学 / 多元函数微分学"),
            // 多元积分 / 重积分 / 曲线曲面积分
            (&["二重积分", "三重积分", "重积分", "曲线积分", "曲面积分", "第一类曲线", "第二类曲线", "格林公式", "高斯公式", "斯托克斯"], "高等数学 / 多元函数积分学"),
            // 微分方程
            (&["微分方程", "常微分方程", "一阶微分方程", "二阶常系数", "通解", "特解", "降阶", "伯努利"], "高等数学 / 常微分方程"),
            // 一元积分
            (&["定积分", "不定积分", "反常积分", "变限积分", "变上限积分", "积分上限", "分部积分", "换元法", "有理函数积分"], "高等数学 / 一元函数积分学"),
            // 一元微分 / 导数与中值定理
            (&["导数", "微分", "中值定理", "罗尔", "拉格朗日中值", "柯西中值", "泰勒", "洛必达", "单调性", "凹凸性", "渐近线", "曲率"], "高等数学 / 一元函数微分学"),
            // 极限与连续
            (&["极限", "连续", "间断点", "无穷小", "夹逼", "单调有界", "夹逼准则"], "高等数学 / 函数、极限与连续"),
            // 无穷级数
            (&["级数", "无穷级数", "幂级数", "收敛域", "收敛半径", "数项级数", "正项级数", "交错级数", "阿贝尔", "傅里叶"], "高等数学 / 无穷级数"),
            // 线性代数 - 特征值与二次型
            (&["特征值", "特征向量", "相似对角化", "对角化", "相似矩阵", "实对称矩阵", "jordan"], "线性代数 / 特征值与特征向量"),
            (&["二次型", "正定", "负定", "合同", "惯性指数", "标准形", "规范形"], "线性代数 / 二次型"),
            // 线性代数 - 线性方程组与向量
            (&["线性方程组", "齐次方程组", "非齐次方程组", "基础解系", "解空间"], "线性代数 / 线性方程组"),
            (&["向量组", "线性相关", "线性无关", "极大线性无关组", "向量空间", "基与维数"], "线性代数 / 向量"),
            // 线性代数 - 矩阵与行列式
            (&["伴随矩阵", "初等变换", "矩阵的秩", "逆矩阵", "矩阵分块", "初等矩阵", "方阵的幂"], "线性代数 / 矩阵"),
            (&["行列式", "克拉默法则", "代数余子式", "范德蒙"], "线性代数 / 行列式"),
            // 概率论
            (&["二维随机变量", "联合分布", "边缘分布", "条件分布", "独立性", "二维连续型"], "概率论与数理统计 / 多维随机变量及其分布"),
            (&["数字特征", "期望", "方差", "协方差", "相关系数", "矩"], "概率论与数理统计 / 随机变量的数字特征"),
            (&["大数定律", "中心极限定理", "切比雪夫"], "概率论与数理统计 / 大数定律和中心极限定理"),
            (&["参数估计", "矩估计", "最大似然估计", "无偏性", "置信区间", "假设检验"], "概率论与数理统计 / 数理统计的基本概念与参数估计"),
            (&["一维随机变量", "分布律", "概率密度", "正态分布", "泊松分布", "指数分布"], "概率论与数理统计 / 一维随机变量及其分布"),
            (&["随机事件", "古典概型", "几何概型", "条件概率", "全概率", "贝叶斯"], "概率论与数理统计 / 随机事件与概率"),
        ];

        for (keywords, target_cat) in topic_rules {
            for kw in *keywords {
                if trimmed.contains(kw) {
                    let found: Option<String> = conn.query_row(
                        "SELECT path FROM categories WHERE path=?1 OR path LIKE ?1||' / %' OR path LIKE '%'||?1||'%' ORDER BY depth ASC LIMIT 1",
                        [target_cat],
                        |r| r.get(0),
                    ).optional().ok().flatten();
                    if let Some(p) = found {
                        return Some(p);
                    }
                }
            }
        }

        if let Ok(mut stmt) = conn.prepare("SELECT path FROM categories WHERE depth >= 1 ORDER BY depth DESC, id ASC") {
            if let Ok(paths) = stmt.query_map([], |r| r.get::<_, String>(0)) {
                for p_res in paths.flatten() {
                    let leaf = p_res.split(" / ").last().unwrap_or(&p_res);
                    if trimmed.contains(leaf) || (!leaf.is_empty() && leaf.len() >= 6 && trimmed.contains(&leaf[..6])) {
                        return Some(p_res);
                    }
                }
            }
        }
    }

    let chapter_setting = setting(conn, "current_chapter_id", "");
    if let Ok(id) = chapter_setting.parse::<i64>() {
        if let Ok(Some(path)) = conn.query_row("SELECT path FROM categories WHERE id=?1", [id], |r| r.get(0)).optional() {
            return Some(path);
        }
    }

    conn.query_row(
        "SELECT category_path FROM learning_diagnoses WHERE normalized_error_class<>'none' ORDER BY updated_at DESC,id DESC LIMIT 1",
        [],
        |r| r.get(0),
    ).optional().ok().flatten()
}

#[tauri::command]
fn create_learning_task(input: LearningTaskInput, state: State<AppState>) -> Result<CodexTask, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let minutes = input.available_minutes.clamp(10, 180);
    let category_path = learning_category_path(&conn, input.category_id, &input.request);
    let path_filter = category_path.clone().unwrap_or_default();
    let mut stmt = conn.prepare(
        "SELECT q.id,q.category_path,q.stem,q.question_type,q.difficulty,
                COUNT(a.id),AVG(CASE WHEN COALESCE(a.outcome,a.result)='uncertain' THEN NULL WHEN COALESCE(a.outcome,a.result)='correct' THEN 1.0 ELSE 0.0 END),
                MAX(p.mastery),
                (SELECT COALESCE(a2.outcome,a2.result) FROM attempts a2 WHERE a2.question_id=q.id ORDER BY a2.attempted_at DESC,a2.id DESC LIMIT 1),
                q.image_paths_json
         FROM questions q
         LEFT JOIN attempts a ON a.question_id=q.id
         LEFT JOIN progress p ON p.question_id=q.id
         WHERE (?1='' OR q.category_path=?1 OR q.category_path LIKE ?1||' / %' OR q.category_path LIKE '%'||?1||'%' OR EXISTS(SELECT 1 FROM question_categories qc JOIN categories c ON c.id=qc.category_id WHERE qc.question_id=q.id AND (c.path=?1 OR c.path LIKE ?1||' / %' OR c.path LIKE '%'||?1||'%')))
           AND NOT EXISTS(SELECT 1 FROM attempts at WHERE at.question_id=q.id AND substr(at.attempted_at,1,10)=date('now','localtime'))
         GROUP BY q.id
         ORDER BY CASE WHEN COUNT(a.id)=0 THEN 0 WHEN MAX(p.mastery) IS NULL OR MAX(p.mastery)<=2 THEN 1 ELSE 2 END,
                  q.difficulty ASC,q.id ASC LIMIT 80"
    ).map_err(|e| e.to_string())?;
    let candidates = stmt.query_map([path_filter.clone()], |row| {
        let image_paths: String = row.get(9)?;
        Ok(LearningCandidateQuestion {
            question_id: row.get(0)?,
            category_path: row.get(1)?,
            stem: row.get(2)?,
            question_type: row.get(3)?,
            difficulty: row.get(4)?,
            attempts: row.get(5)?,
            accuracy: row.get(6)?,
            mastery: row.get(7)?,
            last_result: row.get(8)?,
            has_images: serde_json::from_str::<Vec<String>>(&image_paths).map(|v| !v.is_empty()).unwrap_or(false),
        })
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    if candidates.is_empty() {
        return Err("当前分支没有可供 AI 分析的候选题；请换一个分类或先导入题库".into());
    }

    let recent_attempts: Vec<Value> = {
        let mut recent = conn.prepare(
            "SELECT a.question_id,COALESCE(a.outcome,a.result),a.self_rating,a.confidence,a.duration_seconds,a.attempted_at
             FROM attempts a JOIN questions q ON q.id=a.question_id
             WHERE (?1='' OR q.category_path=?1 OR q.category_path LIKE ?1||' / %')
             ORDER BY a.attempted_at DESC,a.id DESC LIMIT 16"
        ).map_err(|e| e.to_string())?;
        let rows = recent.query_map([path_filter.clone()], |row| Ok(json!({
            "questionId": row.get::<_, i64>(0)?, "result": row.get::<_, String>(1)?, "selfConfidence": row.get::<_, i32>(2)?,
            "confidence": row.get::<_, Option<f64>>(3)?, "durationSeconds": row.get::<_, i32>(4)?, "attemptedAt": row.get::<_, String>(5)?
        }))).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    let recent_result_contexts: Vec<Value> = {
        let mut stmt = conn.prepare(
            "SELECT task_id,result_context_path,completed_at
             FROM recommendation_batches
             WHERE status='completed' AND result_context_path IS NOT NULL
             ORDER BY completed_at DESC LIMIT 3",
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| Ok(json!({
            "taskId": row.get::<_, String>(0)?,
            "contextPath": row.get::<_, Option<String>>(1)?,
            "completedAt": row.get::<_, Option<String>>(2)?,
        }))).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    let task_id = format!("SB-AI-{}-{:04}", Local::now().format("%Y%m%d%H%M"), rand::rng().random_range(0..10000));
    let output = state.data_dir.join("codex-inbox").join(format!("{task_id}.json"));
    let context_path = state.data_dir.join("codex-tasks").join(format!("{task_id}.context.json"));
    let context = json!({
        "schemaVersion": 2, "taskId": task_id, "request": input.request.trim(), "availableMinutes": minutes,
        "categoryPath": category_path, "recentAttempts": recent_attempts, "recentRecommendationResults": recent_result_contexts, "candidates": candidates,
        "rules": ["只能从 candidates 中选择 questionId", "先识别候选题的考法，再判断已适应与待覆盖", "推荐必须包含 coverage、questionRoles、noveltyPlan 和 successCriteria", "不能把一次正确判定为稳定掌握", "没有结构化证据时不能声称是迁移题"]
    });
    fs::create_dir_all(state.data_dir.join("codex-tasks")).map_err(|e| e.to_string())?;
    for candidate in &candidates {
        conn.execute("INSERT INTO learning_task_candidates(task_id,question_id,created_at) VALUES(?1,?2,?3)", params![task_id, candidate.question_id, Local::now().to_rfc3339()]).map_err(|e| e.to_string())?;
    }
    fs::write(&context_path, serde_json::to_string_pretty(&context).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let prompt = format!(r#"你正在为数学刷题 App「刷吧」设计一次 AI 自适应训练题组。
任务编号：{task_id}
上下文文件：{context_path}
回传文件：{output}
稳定行为规则：请先读取仓库根目录的 characteristic.md（学员微观战力画像）与 AI_LEARNING_POLICY.md；优先针对画像中标记为 [🔴 待验证] 的薄弱漏洞设计变式题，严禁推送 [🟢 已固化] 的同构低价值题。若无法读取，以本任务下面的强制约束为准。

请先读取上下文文件。若 recentRecommendationResults 中存在 result context 文件，请一并读取，把上一组真实作答结果作为下一轮证据。上下文中的 categoryPath 只是候选范围，不等于考法。你必须分析候选题的题干、条件、方法入口和知识点组合，判断：
1. 用户已经适应了哪些考法；
2. 当前仍未验证或高风险的考法；
3. 本次题组应该改变哪些因素（条件、表示、方法、组合或限时）；
4. 按时间预算选择有顺序的题组。

只能选择上下文 candidates 中出现的 questionId，禁止编造题号。题组默认包含诊断、方法辨析、综合或迁移中的至少两种角色；没有可靠结构证据时不要标记 transfer。完成后将 JSON 写入回传文件，格式：
{{"schemaVersion":2,"kind":"recommendation","taskId":"{task_id}","questionId":null,"summary":"题组目标","goal":"用户本次训练目标","estimatedMinutes":30,"recommendedQuestionIds":[155],"recommendationOrder":[155],"questionRoles":{{"155":"diagnosis"}},"coverage":[{{"knowledge":"考法名称","questionIds":[155],"priority":"high"}}],"noveltyPlan":["改变条件"],"successCriteria":["完成标准"],"recommendationReason":"结合历史证据说明为什么现在推荐","sourceEvidenceIds":[],"excludedQuestionIds":[],"fallbackPlan":"校验失败时的替代策略","confidence":0.9}}
不要写入任何数据库，不要修改题库源文件。"#,
        context_path = context_path.to_string_lossy(), output = output.to_string_lossy());
    let task_path = state.data_dir.join("codex-tasks").join(format!("{task_id}.txt"));
    fs::write(&task_path, &prompt).map_err(|e| e.to_string())?;
    Ok(CodexTask { task_id, question_id: None, question_count: candidates.len(), prompt, inbox_dir: state.data_dir.join("codex-inbox").to_string_lossy().into_owned(), output_file: output.to_string_lossy().into_owned() })
}

#[tauri::command]
fn get_inbox(state: State<AppState>) -> Result<Vec<InboxItem>, String> {
    scan_inbox(&state)?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt=conn.prepare("SELECT id,task_id,kind,question_id,payload_json,status,created_at FROM codex_inbox ORDER BY id DESC LIMIT 100").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            let raw: String = r.get(4)?;
            let p: CodexPayload = serde_json::from_str(&raw).unwrap_or(CodexPayload {
                schema_version: 1,
                kind: "analysis".into(),
                task_id: "invalid".into(),
                question_id: None,
                summary: "结果格式无法解析".into(),
                verdict: None,
                earliest_error: None,
                error_tags: vec![],
                weakness_tags: vec![],
                advice: None,
                better_solution: None,
                confidence: 0.0,
                recommended_question_ids: vec![],
                recommendation_reason: None,
                paper_title: None,
                paper_attempts: vec![],
                batch_attempts: vec![],
                rating: None,
                rating_tier: None,
                difficulty_multiplier: None,
                dimensions: HashMap::new(),
                ..Default::default()
            });
            Ok(InboxItem {
                id: r.get(0)?,
                task_id: r.get(1)?,
                kind: r.get(2)?,
                question_id: r.get(3)?,
                summary: p.summary,
                verdict: p.verdict,
                earliest_error: p.earliest_error,
                error_tags: p.error_tags,
                weakness_tags: p.weakness_tags,
                advice: p.advice,
                better_solution: p.better_solution,
                confidence: p.confidence,
                status: r.get(5)?,
                created_at: r.get(6)?,
                paper_title: p.paper_title,
                paper_attempts: p.paper_attempts,
                batch_attempts: p.batch_attempts,
                recommendation_question_count: if r.get::<_, String>(2)? == "recommendation" {
                    Some(p.recommended_question_ids.len() as i64)
                } else {
                    None
                },
                recommendation_batch_status: None,
                rating: p.rating,
                rating_tier: p.rating_tier,
                difficulty_multiplier: p.difficulty_multiplier,
                dimensions: p.dimensions,
                goal: p.goal,
                estimated_minutes: p.estimated_minutes,
                question_roles: p.question_roles,
                recommendation_order: p.recommendation_order,
                coverage: p.coverage,
                novelty_plan: p.novelty_plan,
                success_criteria: p.success_criteria,
                fallback_plan: p.fallback_plan,
                recommended_question_ids: p.recommended_question_ids,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut items = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);
    for item in &mut items {
        if item.kind == "recommendation" {
            if let Some(batch) = recommendation_batch_by_task(&conn, &item.task_id)? {
                item.recommendation_question_count = Some(batch.total_count);
                item.recommendation_batch_status = Some(batch.status);
            }
        }
    }
    Ok(items)
}

#[tauri::command]
fn start_recommendation_batch(
    task_id: String,
    state: State<AppState>,
) -> Result<RecommendationBatch, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    start_recommendation_batch_row(&conn, &task_id)
}

#[tauri::command]
fn dismiss_recommendation_batch(task_id: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    dismiss_recommendation_batch_row(&conn, &task_id)
}

#[tauri::command]
fn get_learning_task_candidates(
    task_id: String,
    state: State<AppState>,
) -> Result<Vec<Question>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "{QUESTION_SELECT} JOIN learning_task_candidates ltc ON ltc.question_id=q.id WHERE ltc.task_id=?1 GROUP BY q.id ORDER BY q.id"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&task_id], row_to_question)
        .map_err(|e| e.to_string())?;
    let questions = rows
        .map(|q| q.map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(questions)
}

#[tauri::command]
fn update_recommendation_batch_items(
    task_id: String,
    question_ids: Vec<i64>,
    state: State<AppState>,
) -> Result<(), String> {
    if question_ids.is_empty() {
        return Err("题组至少需要保留 1 道题目".into());
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let status: String = tx
        .query_row(
            "SELECT status FROM recommendation_batches WHERE task_id=?1",
            [&task_id],
            |r| r.get(0),
        )
        .map_err(|_| "找不到指定的推荐批次".to_string())?;

    if status != "pending" && status != "active" {
        return Err("只能编辑待采用或进行中的题组".into());
    }

    // 先把已有条目的角色标签捞出来，重建时按题号继承，避免编辑题组后标签全丢。
    let mut inherited_roles: HashMap<i64, Option<String>> = HashMap::new();
    {
        let mut role_stmt = tx
            .prepare(
                "SELECT question_id, role FROM recommendation_batch_items WHERE task_id=?1",
            )
            .map_err(|e| e.to_string())?;
        let role_rows = role_stmt
            .query_map([task_id.as_str()], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?))
            })
            .map_err(|e| e.to_string())?;
        for entry in role_rows {
            let (qid, role) = entry.map_err(|e| e.to_string())?;
            inherited_roles.insert(qid, role);
        }
    }

    tx.execute(
        "DELETE FROM recommendation_batch_items WHERE task_id=?1 AND completed_at IS NULL",
        [&task_id],
    )
    .map_err(|e| e.to_string())?;

    for (pos, qid) in question_ids.iter().enumerate() {
        let role = inherited_roles.get(qid).cloned().flatten();
        tx.execute(
            "INSERT INTO recommendation_batch_items(task_id, question_id, position, role) VALUES(?1, ?2, ?3, ?4)",
            params![task_id, qid, pos as i64, role],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn confirm_inbox(id: i64, apply_to_profile: bool, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let raw: String = conn
        .query_row(
            "SELECT payload_json FROM codex_inbox WHERE id=?1 AND status='pending'",
            [id],
            |r| r.get(0),
        )
        .map_err(|e| format!("找不到待确认的回传: {e}"))?;
    let payload: CodexPayload = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if payload.kind == "recommendation" {
        if apply_to_profile {
            start_recommendation_batch_row(&conn, &payload.task_id)?;
        } else {
            dismiss_recommendation_batch_row(&conn, &payload.task_id)?;
        }
        return Ok(());
    }
    if apply_to_profile {
        if payload.kind == "paper" {
            let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
            for attempt in payload.paper_attempts {
                let input = AttemptInput {
                    question_id: attempt.question_id,
                    duration_seconds: if attempt.duration_seconds > 0 {
                        attempt.duration_seconds
                    } else {
                        30
                    },
                    result: attempt.result.clone(),
                    self_rating: attempt.self_rating,
                    selected_answer: attempt.selected_answer,
                    mode: Some("paper-codex".into()),
                    outcome: Some(attempt.result),
                    evidence_source: Some("codex".into()),
                    fluency_rating: Some(attempt.self_rating),
                    confidence: Some(1.0),
                    session_id: Some(payload.task_id.clone()),
                    diagnosis_id: attempt.diagnosis,
                    ai_rating: None,
                    difficulty_multiplier: None,
                    technique_level: None,
                    dimensions: None,
                };
                record_attempt_row(&tx, &input)?;
            }
            tx.commit().map_err(|e| e.to_string())?;
        } else if payload.kind == "batch" {
            let supplemental_conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;
            // New v1.5 pressure tasks always have immutable main context and must
            // retain a supplemental task link.  Only context-free historical rows
            // may use the explicit legacy fallback inside pressure_task_match.
            let requires_link = task_has_kind(&conn, &payload.task_id, "pressure_batch")?;
            match pressure_task_match_with_link_requirement(&supplemental_conn, &payload.task_id, requires_link)? {
                PressureTaskMatch::Current(context) => {
                    confirm_pressure_batch_saga(&conn, &supplemental_conn, id, &context, &payload)?;
                    return Ok(());
                }
                PressureTaskMatch::Stale { session_id, current_task_id } => {
                    // Never dismiss a stale pressure inbox automatically.  In
                    // particular a `main_applied` receipt must remain recoverable;
                    // an operator can inspect the persisted task/session/hash audit.
                    return Err(retain_stale_pressure_inbox(&conn, id, &payload, &session_id, current_task_id)?);
                }
                PressureTaskMatch::LinkMissing { session_id } => {
                    let reason = "v1.5 压力任务缺少 pressure_task_links，不允许按可变会话回退确认";
                    match mark_pressure_receipt_reconciliation(&conn, id, &payload, session_id.as_deref(), reason) {
                        Ok(()) => return Err(format!("{reason}；已进入人工对账")),
                        Err(_) => return Err(format!("{reason}；未找到可验证会话绑定，已保留待确认回传")),
                    }
                }
                PressureTaskMatch::None => {
                    // A normal batch is diagnosis-only.  A task carrying v1.5
                    // pressure context never reaches this branch because it is
                    // LinkMissing above.
                    apply_batch_payload(&conn, &payload, None, BatchApplicationMode::BoundNonPressureAdjudication)?;
                }
            }
        } else if payload.kind == "analysis" {
            apply_analysis_payload_sidecar(&conn, &payload)?;
        }
    }
    let updated = conn
        .execute(
            "UPDATE codex_inbox SET status=?1 WHERE id=?2 AND status='pending'",
            params![
                if apply_to_profile {
                    "confirmed"
                } else {
                    "dismissed"
                },
                id
            ],
        )
        .map_err(|e| e.to_string())?;
    if updated != 1 {
        return Err("回传已被其他操作处理，未重复应用".into());
    }
    Ok(())
}

#[tauri::command]
fn create_codex_task(question_id: i64, state: State<AppState>) -> Result<CodexTask, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let q = question_by_id(&conn, question_id)?;
    let task_id = format!(
        "SB-{}-{}-{:04}",
        Local::now().format("%Y%m%d"),
        question_id,
        rand::rng().random_range(0..10000)
    );
    let output = state
        .data_dir
        .join("codex-inbox")
        .join(format!("{task_id}.json"));
    let requested_at = Local::now().to_rfc3339();
    // A single-question task is deliberately bound at the instant the user invokes
    // it from the current question. This is the one flow where latest-at-creation
    // has explicit user intent; later confirmation never re-runs this lookup.
    let binding = latest_attempt_binding(&conn, question_id)?;
    let (attempt_id, source_mode) = binding
        .map(|(attempt_id, mode)| (Some(attempt_id), mode))
        .unwrap_or((None, "unanswered".into()));
    insert_codex_task_context(
        &conn,
        &task_id,
        question_id,
        attempt_id,
        "analysis",
        &requested_at,
        &source_mode,
    )?;

    let type_label = match q.question_type.as_str() {
        "single_choice" => "单选题 · 基准3分",
        "multiple_choice" => "多选题 · 基准4分",
        "fill_in" => "填空题 · 基准5分",
        _ => "解答/证明题 · 基准10分",
    };
    let bench_sec = match q.question_type.as_str() {
        "single_choice" => 180,
        "multiple_choice" => 240,
        "fill_in" => 300,
        _ => 600,
    };
    let dur_sec = latest_attempt_duration(&conn, question_id)?;
    let timing_info = if let Some(sec) = dur_sec {
        let m = sec / 60;
        let s = sec % 60;
        let pace_eval = if sec <= bench_sec / 2 {
            "⚡ 极速秒杀"
        } else if sec <= bench_sec {
            "✓ 节奏标准"
        } else if sec <= bench_sec * 3 / 2 {
            "⏱ 稍有迟疑"
        } else {
            "⚠️ 耗时偏长(可能计算绕路)"
        };
        format!(" | ⏱ 作答耗时：{m}分{s:02}秒 [{pace_eval}]")
    } else {
        "".to_string()
    };

    let prompt = format!(
        r#"你正在为数学刷题 App「刷吧」担任 CS 战术主考官，深度批改考研数一草稿。
任务编号：{task_id}
题目 ID：{question_id}（{type_label}）{timing_info}
题目：{stem}
参考答案：{answer}

【战术批改指令与评分量规】：
1. 致命断点定位：逐行核对草稿推导，定位【最早错误断点】（earliestError）。精准归类为以下三类之一并在 errorTags 标注：
   - 🔴 瞄准失误 (计算笔误/符号写反) -> verdict: "partial", 保留有效步骤分 (ADR 65-80);
   - 🟡 概念盲区 (定理前提遗漏/混淆充分必要) -> verdict: "incorrect", 严查概念边界;
   - 🔵 战术绕路 (方法机械蛮干/超时严重) -> speed <= 60, 指出计算黑洞与冗余步骤.
2. HLTV Rating 3.0 定位 (0.00-2.50，拉开区分度)：
   - 0.50: 核心断裂/盲区; 0.80: 笨拙硬算且有笔误; 1.00: 常规达标; 1.15-1.25: 规范严密; 1.30-1.45: 巧解秒杀; 1.50-1.65: 压轴题突破; 2.00-2.45: Donk-tier 超神秒杀 (极罕见神级表现);
   - 【硬约束规则】：若 verdict 为 incorrect，rating 严禁超过 0.65 (有大量正确步骤的笔误最高 0.80)；若超时 1.5 倍以上且做错，触发经济拖累惩罚。
3. 六维能力打分准则 (0-100)：
   - 每维评分必须在 evidence 中引用草稿具体推导行与公式证据，严禁无证据给分；
   - 无法从草稿确认的维度，必须输出 score: null, confidence: 0, evidence: "uncertain", 严禁猜 75 分！
4. 考场极速秒杀思路 (betterSolution)：
   - 严禁搬运繁琐教材长证明！必须提供考场极速解题技巧（Taylor展开、King变换、特征多项式、待定系数、几何投影等 30 秒秒解）；若原解法已最优填 null。
5. 可执行修复动作 (advice)：给出一条明天即可落地刻意练习的专项战术动作。
6. 公式排版绝对要求：所有数学符号、变量、公式、计算式必须严格使用 $...$ 或 $$...$$ 包裹，严禁裸文本数学式。
7. 学员微观画像与报告反馈：批改完成后，请依据草稿表现同步更新根目录 characteristic.md 中的微观断点追踪状态（追加新错误或升级已固化）；并在最终回复给学员的文字报告中，专门呈现【🌟 本轮战力突破 / 成功改正】与【⚠️ 本轮新增微观断点与补丁】。

完成后请将结果写入这个绝对路径：
{output}

JSON 必须符合（UTF-8，公式用标准单个反斜杠 LaTeX）。结果必须包含 rating、ratingTier、difficultyMultiplier 和六维 dimensions；无法由草稿确认的维度使用 score:null、confidence:0，并明确写 uncertain：
{{"schemaVersion":1,"kind":"analysis","taskId":"{task_id}","questionId":{question_id},"summary":"战术诊断摘要（含 $LaTeX$ 公式）","verdict":"correct|partial|incorrect|uncertain","earliestError":"最早断点行与数学式（含 $LaTeX$）或 null","errorTags":["计算笔误" | "概念边界" | "方法绕路"],"weaknessTags":["薄弱知识点"],"advice":"下一步修复动作（含 $LaTeX$ 公式）","betterSolution":"考场极速秒杀思路（含 $LaTeX$ 公式）或 null","confidence":0.95,"rating":1.00,"ratingTier":"S|A|B|C|D","difficultyMultiplier":1.0,"dimensions":{{"rigor":{{"score":88,"confidence":0.9,"evidence":"依据草稿步骤（含 $LaTeX$）","advice":"改进动作（含 $LaTeX$）"}},"computation":{{"score":72,"confidence":0.9,"evidence":"依据草稿步骤（含 $LaTeX$）"}},"modeling":{{"score":65,"confidence":0.9,"evidence":"依据草稿步骤（含 $LaTeX$）"}},"methodUse":{{"score":80,"confidence":0.9,"evidence":"依据草稿步骤（含 $LaTeX$）"}},"speed":{{"score":90,"confidence":0.9,"evidence":"基于实际耗时"}},"strategyInsight":{{"score":58,"confidence":0.8,"evidence":"依据结构识别（含 $LaTeX$）","techniqueLevel":3,"independentDiscovery":"uncertain"}}}},"recommendedQuestionIds":[],"recommendationReason":null}}
strategyInsight 还必须包含 techniqueLevel（1–5）和 independentDiscovery（confirmed|uncertain|prompted）。不要输出 batchAttempts，单题只输出上面的 analysis 对象。
不要修改题库源文件。"#,
        stem = q.stem,
        answer = q.correct_answer,
        output = output.to_string_lossy()
    );
    let tasks_dir = state.data_dir.join("codex-tasks");
    fs::create_dir_all(&tasks_dir).map_err(|e| e.to_string())?;
    let _ = fs::write(tasks_dir.join(format!("{task_id}.txt")), &prompt);
    Ok(CodexTask {
        task_id,
        question_id: Some(question_id),
        question_count: 1,
        prompt,
        inbox_dir: state
            .data_dir
            .join("codex-inbox")
            .to_string_lossy()
            .into_owned(),
        output_file: output.to_string_lossy().into_owned(),
    })
}

fn build_codex_batch_task_prompt(
    task_id: &str,
    questions: &[Question],
    durations: Option<&HashMap<i64, i32>>,
    output_path: &str,
) -> String {
    let numbered: Vec<String> = questions
        .iter()
        .enumerate()
        .map(|(index, q)| {
            let type_label = match q.question_type.as_str() {
                "single_choice" => "单选题 · 基准3分",
                "multiple_choice" => "多选题 · 基准4分",
                "fill_in" => "填空题 · 基准5分",
                _ => "解答/证明题 · 基准10分",
            };
            let bench_sec = match q.question_type.as_str() {
                "single_choice" => 180,
                "multiple_choice" => 240,
                "fill_in" => 300,
                _ => 600,
            };
            let dur_sec = durations.and_then(|m| m.get(&q.id).copied());
            let timing_info = if let Some(sec) = dur_sec {
                let m = sec / 60;
                let s = sec % 60;
                let pace_eval = if sec <= bench_sec / 2 {
                    "⚡ 极速秒杀"
                } else if sec <= bench_sec {
                    "✓ 节奏标准"
                } else if sec <= bench_sec * 3 / 2 {
                    "⏱ 稍有迟疑"
                } else {
                    "⚠️ 耗时偏长(可能计算绕路)"
                };
                format!(" | ⏱ 作答耗时：{m}分{s:02}秒 [{pace_eval}]")
            } else {
                "".to_string()
            };

            format!(
                "{}. 题目 ID：{id}（{type_label}）{timing_info}\n题目：{stem}\n参考答案：{answer}",
                index + 1,
                id = q.id,
                stem = q.stem,
                answer = q.correct_answer
            )
        })
        .collect();

    format!(
        r#"你正在为数学刷题 App「刷吧」担任 CS 战术主考官，深度批改考研数一草稿。
任务编号：{task_id}
本任务包含 {count} 道题，按下面编号依次列出；你随后收到的每张草稿图片按发送顺序对应一道题：

{numbered}

【战术批改指令与评分量规】：
1. 逐题核对草稿：第 K 张图片对应第 K 题，少于题目数时只批改收到草稿的题，未收到草稿的题在 batchAttempts 中省略，严禁猜测。
2. 熟练度与节奏诊断及致命断点定位 (earliestError)：综合题目「实际作答耗时」与草稿步骤判断熟练度，逐行核对推导定位最早出现的错误断点行及公式。精准归类并在 errorTags 标注：
   - 🔴 瞄准失误 (计算笔误/符号写反) -> verdict: "partial", 保留有效步骤分;
   - 🟡 概念盲区 (定理前提遗漏/混淆充分必要) -> verdict: "incorrect", 严查概念边界;
   - 🔵 战术绕路 (方法机械蛮干/超时严重) -> speed <= 60, 指出计算黑洞与冗余步骤.
   无法确定时 result 设为 "uncertain"。durationSeconds 必须原样填写上方提供的实际作答耗时（秒）。
3. HLTV Rating 3.0 定位 (0.00-2.50，拉开区分度)：
   - 0.50: 核心断裂; 0.80: 笨拙硬算且有笔误; 1.00: 常规达标; 1.15-1.25: 规范严密; 1.30-1.45: 巧解秒杀; 1.50-1.65: 压轴题突破; 2.00-2.45: Donk-tier 超神秒杀 (极罕见神级表现);
   - 【整组区分度要求】：同组题目的 Rating 必须依据草稿实际优劣拉开梯度（严禁全部打在 1.10-1.20 区间）。若 verdict 为 incorrect，rating 严禁超过 0.65 (有大量正确步骤的笔误最高 0.80)。
4. 六维能力打分准则 (0-100)：
   - 每维评分必须在 evidence 中引用草稿具体推导证据，严禁无证据给分；
   - 无法从草稿确认的维度，必须输出 score: null, confidence: 0, evidence: "uncertain"，严禁猜 75 分！
   - strategyInsight 另给 techniqueLevel（1–5，表示本题技巧难度）和 independentDiscovery（confirmed|uncertain|prompted）。
5. 考场极速秒杀思路 (betterSolution)：
   - 严禁搬运繁琐教材长证明！必须提供考场极速解题技巧（Taylor展开、King变换、特征多项式、待定系数、几何投影等 30 秒秒解）；若原解法已最优填 null。
6. 可执行修复动作 (advice)：每道题给出一条可落地执行的专项修复动作。
7. 公式排版绝对要求：所有数学符号、变量、公式、计算式必须严格使用 $...$ 或 $$...$$ 包裹，严禁裸文本数学式。
8. 学员微观画像与报告反馈：批改完成后，请依据草稿表现同步更新根目录 characteristic.md 中的微观断点追踪状态（追加新错误或升级已固化）；并在最终回复给学员的文字报告中，专门呈现【🌟 本轮战力突破 / 成功改正】与【⚠️ 本轮新增微观断点与补丁】。

完成后请将结果写入这个绝对路径：
{output}

JSON 必须符合（UTF-8，公式用标准单个反斜杠 LaTeX）。每个 batchAttempt 还必须包含 rating、ratingTier、difficultyMultiplier 和六维 dimensions；无法由草稿确认的维度使用 score:null、confidence:0，并明确写 uncertain：
{{"schemaVersion":1,"kind":"batch","taskId":"{task_id}","summary":"整组批改摘要（含 $LaTeX$ 公式）","errorTags":["错误类型"],"weaknessTags":["薄弱知识"],"confidence":0.9,"recommendedQuestionIds":[],"batchAttempts":[{{"questionId":155,"result":"correct|wrong|uncertain","selfRating":2,"durationSeconds":120,"summary":"简要诊断（含 $LaTeX$ 公式）","verdict":"correct|partial|incorrect|uncertain","earliestError":"最早断点行与数学式（含 $LaTeX$）或 null","errorTags":["计算笔误" | "概念边界" | "方法绕路"],"weaknessTags":["薄弱知识"],"advice":"下一步修复动作（含 $LaTeX$ 公式）","betterSolution":"考场极速秒杀思路（含 $LaTeX$ 公式）或 null","confidence":0.95,"rating":1.00,"ratingTier":"S|A|B|C|D","difficultyMultiplier":1.0,"dimensions":{{"rigor":{{"score":88,"confidence":0.9,"evidence":"依据草稿步骤（含 $LaTeX$）","advice":"改进动作（含 $LaTeX$）"}},"computation":{{"score":72,"confidence":0.9,"evidence":"依据草稿步骤（含 $LaTeX$）"}},"modeling":{{"score":65,"confidence":0.9,"evidence":"依据草稿步骤（含 $LaTeX$）"}},"methodUse":{{"score":80,"confidence":0.9,"evidence":"依据草稿步骤（含 $LaTeX$）"}},"speed":{{"score":90,"confidence":0.9,"evidence":"基于实际耗时"}},"strategyInsight":{{"score":58,"confidence":0.8,"evidence":"依据结构识别（含 $LaTeX$）","techniqueLevel":3,"independentDiscovery":"uncertain"}}}}}}]}}
示例中的分数仅用于展示字段类型，不要照抄。不要修改题库源文件。"#,
        count = questions.len(),
        numbered = numbered.join("\n\n"),
        output = output_path
    )
}

fn latest_attempt_duration(conn: &Connection, question_id: i64) -> Result<Option<i32>, String> {
    conn.query_row(
        "SELECT duration_seconds FROM attempts WHERE question_id=?1 ORDER BY attempted_at DESC LIMIT 1",
        [question_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

/// Validate client-provided non-pressure attempt ids before any task context is
/// persisted. A question id alone is never enough evidence: the exact SQLite row
/// must exist and must belong to that question. Validation happens before the task
/// transaction so a forged or stale map leaves no partial task behind.
fn validate_nonpressure_batch_attempt_ids(
    conn: &Connection,
    questions: &[Question],
    attempt_ids: Option<&HashMap<i64, i64>>,
) -> Result<HashMap<i64, i64>, String> {
    let supplied = attempt_ids.cloned().unwrap_or_default();
    let allowed_question_ids: HashSet<i64> = questions.iter().map(|question| question.id).collect();

    for (&question_id, &attempt_id) in &supplied {
        if !allowed_question_ids.contains(&question_id) {
            return Err(format!(
                "attemptIds 包含不属于当前题组的题目 ID：{question_id}"
            ));
        }
        let actual_question_id: Option<i64> = conn
            .query_row(
                "SELECT question_id FROM attempts WHERE id=?1",
                [attempt_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        match actual_question_id {
            Some(actual_question_id) if actual_question_id == question_id => {}
            Some(actual_question_id) => {
                return Err(format!(
                    "attemptIds 绑定校验失败：attempt {attempt_id} 属于题目 {actual_question_id}，不能绑定到题目 {question_id}"
                ));
            }
            None => {
                return Err(format!(
                    "attemptIds 绑定校验失败：attempt {attempt_id} 不存在"
                ));
            }
        }
    }

    Ok(supplied)
}

#[tauri::command]
fn create_codex_batch_task(
    question_ids: Vec<i64>,
    durations: Option<HashMap<i64, i32>>,
    session_id: Option<String>,
    attempt_ids: Option<HashMap<i64, i64>>,
    state: State<AppState>,
) -> Result<CodexTask, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    if question_ids.is_empty() {
        return Err("整组批改需要至少一道题".into());
    }
    let mut questions = Vec::with_capacity(question_ids.len());
    let mut seen = HashSet::new();
    for question_id in question_ids {
        if !seen.insert(question_id) {
            continue;
        }
        questions.push(question_by_id(&conn, question_id)?);
    }

    // Pressure/blitz batches are formal post-session settlement. They must neither
    // read nor validate normal-training ids, so an accidental client map cannot
    // influence pressure context or ELO settlement.
    let immutable_attempt_ids = if session_id.is_none() {
        validate_nonpressure_batch_attempt_ids(&conn, &questions, attempt_ids.as_ref())?
    } else {
        HashMap::new()
    };

    let task_id = format!(
        "SB-BATCH-{}-{:04}",
        Local::now().format("%Y%m%d"),
        rand::rng().random_range(0..10000)
    );
    let output = state
        .data_dir
        .join("codex-inbox")
        .join(format!("{task_id}.json"));
    let requested_at = Local::now().to_rfc3339();
    let task_kind = if session_id.is_some() {
        "pressure_batch"
    } else {
        "batch"
    };
    {
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        for question in &questions {
            let attempt_id = immutable_attempt_ids.get(&question.id).copied();
            let source_mode = if session_id.is_some() {
                "pressure"
            } else if attempt_id.is_some() {
                "immutable_attempt_id"
            } else {
                "unanswered_nonpressure_batch"
            };
            insert_codex_task_context(
                &tx,
                &task_id,
                question.id,
                attempt_id,
                task_kind,
                &requested_at,
                source_mode,
            )?;
        }
        tx.commit().map_err(|e| e.to_string())?;
    }

    // Only client-captured durations describe this exact normal round. Do not fill
    // missing entries from a historical latest attempt, which could belong to an
    // earlier retry and would make the Codex prompt misleading.
    let complete_durations = durations.unwrap_or_default();

    let prompt = build_codex_batch_task_prompt(
        &task_id,
        &questions,
        Some(&complete_durations),
        &output.to_string_lossy(),
    );
    let tasks_dir = state.data_dir.join("codex-tasks");
    fs::create_dir_all(&tasks_dir).map_err(|e| e.to_string())?;
    let _ = fs::write(tasks_dir.join(format!("{task_id}.txt")), &prompt);
    let task = CodexTask {
        task_id,
        question_id: None,
        question_count: questions.len(),
        prompt,
        inbox_dir: state
            .data_dir
            .join("codex-inbox")
            .to_string_lossy()
            .into_owned(),
        output_file: output.to_string_lossy().into_owned(),
    };
    if let Some(session_id) = session_id.as_deref() {
        attach_pressure_task(&state, session_id, &task.task_id)?;
    }
    Ok(task)
}

#[tauri::command]
fn get_task_prompt(task_id: String, state: State<AppState>) -> Result<Option<String>, String> {
    let tasks_dir = state.data_dir.join("codex-tasks");
    let path = tasks_dir.join(format!("{task_id}.txt"));
    if path.exists() {
        Ok(Some(fs::read_to_string(&path).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn image_data_url(path: String, state: State<AppState>) -> Result<String, String> {
    if let Some(cached) = state
        .image_cache
        .lock()
        .ok()
        .and_then(|cache| cache.get(&path).cloned())
    {
        return Ok(cached);
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let data = format!("data:image/png;base64,{}", STANDARD.encode(bytes));
    if let Ok(mut cache) = state.image_cache.lock() {
        cache.insert(path, data.clone());
    }
    Ok(data)
}

#[tauri::command]
fn get_insights(state: State<AppState>) -> Result<Vec<InsightPoint>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt=conn.prepare("SELECT CASE WHEN instr(q.category_path,' / ')>0 THEN substr(q.category_path,1,instr(q.category_path,' / ')-1) ELSE q.category_path END subject,SUM(CASE WHEN COALESCE(a.outcome,a.result)<>'uncertain' THEN 1 ELSE 0 END),AVG(CASE WHEN COALESCE(a.outcome,a.result)='uncertain' THEN NULL WHEN COALESCE(a.outcome,a.result)='correct' THEN 1.0 ELSE 0.0 END),AVG(CASE WHEN COALESCE(a.outcome,a.result)<>'uncertain' THEN COALESCE(a.ai_rating, MAX(0.0, MIN(2.0, 1.0 + (COALESCE(a.fluency_rating,a.self_rating)-2.5) * ((2.0-0.0)/3.0)))) END) FROM attempts a JOIN questions q ON q.id=a.question_id GROUP BY subject ORDER BY COUNT(a.id) DESC").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(InsightPoint {
                name: r.get(0)?,
                attempts: r.get(1)?,
                accuracy: r.get::<_, Option<f64>>(2)?.unwrap_or(0.0),
                average_rating: r.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_weakness_radar(state: State<AppState>) -> Result<WeaknessRadar, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive();
    let trend_start = (today - Duration::days(13)).to_string();
    let recent_start = (today - Duration::days(6)).to_string();

    let mut stmt = conn
        .prepare(
            "SELECT error_tags_json, weakness_tags_json, confirmed_at
             FROM codex_analysis_signals
             WHERE confirmed_at >= ?1
             ORDER BY confirmed_at",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&trend_start], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut error_total: HashMap<String, i64> = HashMap::new();
    let mut weakness_total: HashMap<String, i64> = HashMap::new();
    let mut error_recent: HashMap<String, i64> = HashMap::new();
    let mut weakness_recent: HashMap<String, i64> = HashMap::new();
    let mut error_last: HashMap<String, String> = HashMap::new();
    let mut weakness_last: HashMap<String, String> = HashMap::new();
    let mut trend_map: HashMap<String, (HashMap<String, i64>, HashMap<String, i64>)> =
        HashMap::new();
    for offset in (0..14).rev() {
        let date = (today - Duration::days(offset)).to_string();
        trend_map.insert(date, (HashMap::new(), HashMap::new()));
    }

    for row in rows {
        let (error_json, weakness_json, confirmed_at) = row.map_err(|e| e.to_string())?;
        let date = confirmed_at.get(0..10).unwrap_or("").to_string();
        let is_recent = date >= recent_start;
        let errors: Vec<String> = serde_json::from_str(&error_json).unwrap_or_default();
        let weaknesses: Vec<String> = serde_json::from_str(&weakness_json).unwrap_or_default();

        for tag in errors {
            *error_total.entry(tag.clone()).or_insert(0) += 1;
            if is_recent {
                *error_recent.entry(tag.clone()).or_insert(0) += 1;
            }
            if error_last
                .get(&tag)
                .map(|last| last.as_str() < confirmed_at.as_str())
                .unwrap_or(true)
            {
                error_last.insert(tag.clone(), confirmed_at.clone());
            }
            if let Some((error_trend, _)) = trend_map.get_mut(&date) {
                *error_trend.entry(tag).or_insert(0) += 1;
            }
        }
        for tag in weaknesses {
            *weakness_total.entry(tag.clone()).or_insert(0) += 1;
            if is_recent {
                *weakness_recent.entry(tag.clone()).or_insert(0) += 1;
            }
            if weakness_last
                .get(&tag)
                .map(|last| last.as_str() < confirmed_at.as_str())
                .unwrap_or(true)
            {
                weakness_last.insert(tag.clone(), confirmed_at.clone());
            }
            if let Some((_, weakness_trend)) = trend_map.get_mut(&date) {
                *weakness_trend.entry(tag).or_insert(0) += 1;
            }
        }
    }

    let mut error_tags: Vec<WeaknessTagStat> = error_total
        .into_iter()
        .map(|(tag, count)| WeaknessTagStat {
            recent_count: error_recent.get(&tag).copied().unwrap_or(0),
            last_seen: error_last.get(&tag).cloned().unwrap_or_default(),
            tag,
            count,
        })
        .collect();
    error_tags.sort_by(|a, b| {
        b.count
            .cmp(&a.count)
            .then_with(|| b.recent_count.cmp(&a.recent_count))
    });
    error_tags.truncate(10);

    let mut weakness_tags: Vec<WeaknessTagStat> = weakness_total
        .into_iter()
        .map(|(tag, count)| WeaknessTagStat {
            recent_count: weakness_recent.get(&tag).copied().unwrap_or(0),
            last_seen: weakness_last.get(&tag).cloned().unwrap_or_default(),
            tag,
            count,
        })
        .collect();
    weakness_tags.sort_by(|a, b| {
        b.count
            .cmp(&a.count)
            .then_with(|| b.recent_count.cmp(&a.recent_count))
    });
    weakness_tags.truncate(10);

    let mut trend = Vec::with_capacity(14);
    for offset in (0..14).rev() {
        let date = (today - Duration::days(offset)).to_string();
        let (error_trend, weakness_trend) = trend_map.remove(&date).unwrap_or_default();
        let mut error_tags_today: Vec<WeaknessTagCount> = error_trend
            .into_iter()
            .map(|(tag, count)| WeaknessTagCount { tag, count })
            .collect();
        error_tags_today.sort_by(|a, b| b.count.cmp(&a.count));
        error_tags_today.truncate(5);
        let mut weakness_tags_today: Vec<WeaknessTagCount> = weakness_trend
            .into_iter()
            .map(|(tag, count)| WeaknessTagCount { tag, count })
            .collect();
        weakness_tags_today.sort_by(|a, b| b.count.cmp(&a.count));
        weakness_tags_today.truncate(5);
        trend.push(WeaknessTrendPoint {
            date,
            error_tags: error_tags_today,
            weakness_tags: weakness_tags_today,
        });
    }

    Ok(WeaknessRadar {
        error_tags,
        weakness_tags,
        trend,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyTrendPoint {
    date: String,
    attempts: i64,
    correct: i64,
    rating: Option<f64>,
}

#[tauri::command]
fn get_daily_trend(state: State<AppState>) -> Result<Vec<DailyTrendPoint>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive();
    let first_day = (today - Duration::days(13)).to_string();
    let mut trend = Vec::with_capacity(14);
    for offset in (0..14).rev() {
        let date = (today - Duration::days(offset)).to_string();
        let (attempts, correct, rating): (i64, i64, Option<f64>) = conn
            .query_row(
                "SELECT SUM(CASE WHEN COALESCE(outcome,result)<>'uncertain' THEN 1 ELSE 0 END), COALESCE(SUM(CASE WHEN COALESCE(outcome,result)='correct' THEN 1 ELSE 0 END),0), AVG(CASE WHEN COALESCE(outcome,result)<>'uncertain' THEN COALESCE(ai_rating, MAX(0.0, MIN(2.0, 1.0 + (COALESCE(fluency_rating,self_rating)-2.5) * ((2.0-0.0)/3.0)))) END) FROM attempts WHERE substr(attempted_at,1,10)=?1",
                [&date],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap_or((0, 0, None));
        trend.push(DailyTrendPoint {
            date,
            attempts,
            correct,
            rating,
        });
    }
    let _ = first_day;
    Ok(trend)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserStreak {
    current_streak: i64,
    best_streak: i64,
}

#[tauri::command]
fn get_streak(state: State<AppState>) -> Result<UserStreak, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive();
    let mut dates: Vec<String> = conn
        .prepare("SELECT DISTINCT substr(attempted_at,1,10) AS d FROM attempts ORDER BY d")
        .map_err(|e| e.to_string())?
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    dates.retain(|d| d <= &today.to_string());
    if dates.is_empty() {
        return Ok(UserStreak {
            current_streak: 0,
            best_streak: 0,
        });
    }
    let has = |day: chrono::NaiveDate| {
        dates
            .binary_search_by(|d| d.as_str().cmp(day.to_string().as_str()))
            .is_ok()
    };
    let mut current = 0_i64;
    let mut cursor = today;
    while has(cursor) {
        current += 1;
        cursor -= Duration::days(1);
    }
    let mut best = 0_i64;
    let mut run = 0_i64;
    let mut prev: Option<chrono::NaiveDate> = None;
    for d in &dates {
        let day = d.parse::<chrono::NaiveDate>().unwrap_or(today);
        if let Some(p) = prev {
            if (day - p).num_days() == 1 {
                run += 1;
            } else {
                best = best.max(run);
                run = 1;
            }
        } else {
            run = 1;
        }
        prev = Some(day);
    }
    best = best.max(run);
    Ok(UserStreak {
        current_streak: current,
        best_streak: best,
    })
}

// 压力模拟模式 API
#[tauri::command]
fn create_pressure_session(
    question_ids: Vec<i64>,
    state: State<AppState>,
) -> Result<Value, String> {
    if question_ids.is_empty() {
        return Err("压力模拟至少需要一道题".into());
    }
    let start_time = Local::now().timestamp_millis();
    let session_id = format!("pressure-{start_time}");
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO pressure_sessions (session_id, question_ids, start_time, status, task_id, created_at) VALUES (?1, ?2, ?3, ?4, NULL, ?5)",
        params![
            &session_id,
            serde_json::to_string(&question_ids).map_err(|e| e.to_string())?,
            start_time,
            "ongoing",
            start_time,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(json!({
        "sessionId": session_id,
        "mode": "pressure",
        "startTime": start_time,
        "endTime": null,
        "totalDuration": 0,
        "questions": [],
        "taskId": null,
        "status": "ongoing",
        "createdAt": start_time,
    }))
}

#[tauri::command]
fn submit_pressure_answer(
    session_id: String,
    question_id: i64,
    user_answer: String,
    duration: i64,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;

    if !user_answer.trim().is_empty() {
        return Err("连续纸笔模式不接收屏幕答案，请把草稿交给 Codex 批改".into());
    }
    let status: String = conn
        .query_row(
            "SELECT status FROM pressure_sessions WHERE session_id=?1",
            [&session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if status != "ongoing" {
        return Err("压力会话已结束，不能继续记录题目".into());
    }
    let question_ids: String = conn
        .query_row(
            "SELECT question_ids FROM pressure_sessions WHERE session_id=?1",
            [&session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let allowed: Vec<i64> = serde_json::from_str(&question_ids).unwrap_or_default();
    if !allowed.contains(&question_id) {
        return Err("题目不属于当前压力会话".into());
    }
    let bounded_duration = duration.clamp(1, 1800);

    conn.execute(
        "INSERT INTO pressure_answers (session_id, question_id, user_answer, duration, submit_time) SELECT ?1, ?2, '', ?3, ?4 WHERE NOT EXISTS (SELECT 1 FROM pressure_answers WHERE session_id=?1 AND question_id=?2)",
        params![
            &session_id,
            question_id,
            bounded_duration,
            Local::now().timestamp_millis(),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn complete_pressure_session(session_id: String, state: State<AppState>) -> Result<Value, String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;

    let end_time = Local::now().timestamp_millis();

    let status: String = conn
        .query_row(
            "SELECT status FROM pressure_sessions WHERE session_id=?1",
            [&session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if status != "ongoing" {
        return Err("压力会话不是进行中状态".into());
    }

    // 获取会话信息
    let mut stmt = conn
        .prepare("SELECT start_time FROM pressure_sessions WHERE session_id = ?1")
        .map_err(|e| e.to_string())?;

    let start_time: i64 = stmt
        .query_row([&session_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let question_ids: String = conn
        .query_row(
            "SELECT question_ids FROM pressure_sessions WHERE session_id=?1",
            [&session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let expected: Vec<i64> = serde_json::from_str(&question_ids).unwrap_or_default();
    let recorded: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT question_id) FROM pressure_answers WHERE session_id=?1",
            [&session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if recorded != expected.len() as i64 {
        return Err("压力会话尚未完成全部题目".into());
    }

    conn.execute(
        "UPDATE pressure_sessions SET end_time = ?1, status = ?2 WHERE session_id = ?3 AND status = 'ongoing'",
        params![end_time, "awaiting_codex", &session_id],
    )
    .map_err(|e| e.to_string())?;

    let total_duration = (end_time - start_time) / 1000;

    Ok(json!({
        "sessionId": session_id,
        "mode": "pressure",
        "startTime": start_time,
        "endTime": end_time,
        "totalDuration": total_duration,
        "questions": pressure_answers_for_session(&conn, &session_id)?,
        "taskId": conn.query_row("SELECT task_id FROM pressure_sessions WHERE session_id=?1", [&session_id], |row| row.get::<_, Option<String>>(0)).map_err(|e| e.to_string())?,
        "status": "awaiting_codex",
        "createdAt": start_time,
    }))
}

fn pressure_answers_for_session(conn: &Connection, session_id: &str) -> Result<Vec<Value>, String> {
    let mut stmt = conn
        .prepare("SELECT question_id, duration, submit_time FROM pressure_answers WHERE session_id=?1 ORDER BY id")
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_map([session_id], |row| {
            Ok(json!({
                "questionId": row.get::<_, i64>(0)?,
                "userAnswer": "",
                "duration": row.get::<_, i64>(1)?,
                "submitTime": row.get::<_, i64>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    result
}

#[tauri::command]
fn abandon_pressure_session(session_id: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE pressure_sessions SET status='abandoned', end_time=?1 WHERE session_id=?2 AND status='ongoing'",
        params![Local::now().timestamp_millis(), session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn attach_pressure_task_row(
    conn: &Connection,
    session_id: &str,
    task_id: &str,
) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let updated = tx
        .execute(
            "UPDATE pressure_sessions SET task_id=?1 WHERE session_id=?2 AND status='awaiting_codex'",
            params![task_id, session_id],
        )
        .map_err(|e| e.to_string())?;
    if updated != 1 {
        return Err("压力会话不存在或当前状态不允许绑定 Codex 任务".into());
    }
    tx.execute(
        "UPDATE pressure_task_links SET is_current=0 WHERE session_id=?1",
        [session_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO pressure_task_links(task_id,session_id,is_current,created_at)
         VALUES(?1,?2,1,?3)
         ON CONFLICT(task_id) DO UPDATE SET
           session_id=excluded.session_id,
           is_current=1,
           created_at=excluded.created_at",
        params![task_id, session_id, Local::now().timestamp_millis()],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn attach_pressure_task(
    state: &State<AppState>,
    session_id: &str,
    task_id: &str,
) -> Result<(), String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;
    attach_pressure_task_row(&conn, session_id, task_id)
}

#[tauri::command]
fn save_pressure_grading_report(
    session_id: String,
    report_json: String,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO pressure_reports (session_id, report_json, created_at) VALUES (?1, ?2, ?3)",
        params![
            &session_id,
            &report_json,
            Local::now().timestamp_millis(),
        ],
    )
    .map_err(|e| e.to_string())?;

    // 更新会话状态为已批改
    conn.execute(
        "UPDATE pressure_sessions SET status = ?1 WHERE session_id = ?2",
        params!["graded", &session_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_pressure_session(
    session_id: String,
    state: State<AppState>,
) -> Result<Option<Value>, String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;

    let mut result = conn
        .query_row(
            "SELECT session_id, question_ids, start_time, end_time, status, task_id, created_at FROM pressure_sessions WHERE session_id = ?1",
            [&session_id],
            |row| {
                Ok(json!({
                    "sessionId": row.get::<_, String>(0)?,
                    "mode": "pressure",
                    "questionIds": serde_json::from_str::<Vec<i64>>(&row.get::<_, String>(1)?).unwrap_or_default(),
                    "startTime": row.get::<_, i64>(2)?,
                    "endTime": row.get::<_, Option<i64>>(3)?,
                    "status": row.get::<_, String>(4)?,
                    "taskId": row.get::<_, Option<String>>(5)?,
                    "createdAt": row.get::<_, i64>(6)?,
                }))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(ref mut session) = result {
        let start_time = session["startTime"].as_i64().unwrap_or_default();
        let end_time = session["endTime"]
            .as_i64()
            .unwrap_or_else(|| Local::now().timestamp_millis());
        session["totalDuration"] = json!((end_time - start_time) / 1000);
        session["questions"] = json!(pressure_answers_for_session(&conn, session_id.as_str())?);
    }
    Ok(result)
}

/// 把 Codex 整组批改回传载荷（`kind = "batch"`）适配成与 pressure_reports 一致的报告结构。
///
/// 背景（v1.6.9 修复）：压力模拟之外的日常整组批改（taskId 形如 `SB-BATCH-xxx`）
/// 既不会写入 `pressure_sessions`，也不会写入 `pressure_reports`——它只落在主库的
/// `codex_inbox`。而前端原先只有 `get_pressure_grading_report` 这一条读取路径，
/// 且必须先在 pressure 会话列表里按 taskId 找到对应 session 才能取报告。
/// 结果就是：不走压力模拟生成的报告，写了却永远打不开（固定提示「没有找到这次
/// 压力模拟」）。这里直接以 `codex_inbox` 为数据源，让两种模式共用同一个报告组件。
fn build_codex_batch_report(
    conn: &Connection,
    task_id: &str,
    payload: &Value,
    status: &str,
    created_at: &str,
) -> Value {
    let attempts = payload
        .get("batchAttempts")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut grades = Vec::new();
    let mut question_ids: Vec<i64> = Vec::new();
    let mut correct_count = 0_i64;
    let mut partial_count = 0_i64;
    let mut wrong_count = 0_i64;
    let mut uncertain_count = 0_i64;
    let mut total_duration = 0_i64;

    for item in &attempts {
        let question_id = item.get("questionId").and_then(|v| v.as_i64()).unwrap_or(0);
        if question_id <= 0 {
            continue;
        }
        question_ids.push(question_id);

        let result = item
            .get("result")
            .and_then(|v| v.as_str())
            .unwrap_or("uncertain");
        let verdict = item.get("verdict").and_then(|v| v.as_str()).unwrap_or(result);
        match verdict {
            "correct" => correct_count += 1,
            "partial" => partial_count += 1,
            "uncertain" => uncertain_count += 1,
            _ => wrong_count += 1,
        }
        let duration = item
            .get("durationSeconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        total_duration += duration;

        // batch 回传载荷本身不含标准答案与用户作答，从库里补齐
        let correct_answer: String = conn
            .query_row(
                "SELECT correct_answer FROM questions WHERE id=?1",
                [question_id],
                |row| row.get(0),
            )
            .unwrap_or_default();
        let user_answer: String = conn
            .query_row(
                "SELECT COALESCE(selected_answer,'') FROM attempts WHERE question_id=?1
                 ORDER BY id DESC LIMIT 1",
                [question_id],
                |row| row.get(0),
            )
            .unwrap_or_default();

        grades.push(json!({
            "questionId": question_id,
            "correct": verdict == "correct",
            "userAnswer": user_answer,
            "correctAnswer": correct_answer,
            "feedback": item.get("summary").and_then(|v| v.as_str()).unwrap_or(""),
            "duration": duration,
            "result": result,
            "verdict": verdict,
            "selfRating": item.get("selfRating"),
            "earliestError": item.get("earliestError"),
            "errorTags": item.get("errorTags"),
            "weaknessTags": item.get("weaknessTags"),
            "advice": item.get("advice"),
            "betterSolution": item.get("betterSolution"),
            "confidence": item.get("confidence"),
            "rating": item.get("rating"),
            "ratingTier": item.get("ratingTier"),
            "difficultyMultiplier": item.get("difficultyMultiplier"),
            "dimensions": item.get("dimensions"),
        }));
    }

    let graded_count = grades.len() as i64;
    let accuracy = if graded_count > 0 {
        (correct_count as f64 / graded_count as f64 * 100.0).round() as i64
    } else {
        0
    };
    let average_duration = if graded_count > 0 {
        (total_duration as f64 / graded_count as f64).round() as i64
    } else {
        0
    };

    let weaknesses: Vec<String> = payload
        .get("weaknessTags")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    // batch 载荷的 summary 是整组文字总评（而非统计对象），放进 suggestions 供报告展示
    let mut suggestions: Vec<String> = Vec::new();
    if let Some(text) = payload.get("summary").and_then(|v| v.as_str()) {
        if !text.trim().is_empty() {
            suggestions.push(text.to_string());
        }
    }

    let created_ms = chrono::DateTime::parse_from_rfc3339(created_at)
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_else(|_| Local::now().timestamp_millis());
    // codex_inbox 的状态是 confirmed/dismissed，报告的语义状态是 graded/graded_partial
    let report_status = if status == "confirmed" {
        "graded"
    } else {
        "graded_partial"
    };

    json!({
        "sessionId": format!("codex-{task_id}"),
        "sourceTaskId": task_id,
        "status": report_status,
        "questionIds": question_ids,
        "ungradedQuestionIds": [],
        "grades": grades,
        "summary": {
            "correctCount": correct_count,
            "totalCount": graded_count,
            "accuracy": accuracy,
            "strengths": Vec::<String>::new(),
            "weaknesses": weaknesses,
            "suggestions": suggestions,
            "partialCount": partial_count,
            "wrongCount": wrong_count,
            "uncertainCount": uncertain_count,
            "gradedCount": graded_count,
            "totalDuration": total_duration,
            "averageDuration": average_duration,
        },
        "createdAt": created_ms,
        "confirmedAt": created_ms,
    })
}

/// 按 Codex 任务号读取整组批改报告，覆盖「未走压力模拟」的日常训练。
/// 返回结构与 `get_pressure_grading_report` 一致，可共用同一个报告组件。
#[tauri::command]
fn get_codex_batch_report(task_id: String, state: State<AppState>) -> Result<Option<Value>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let row: Option<(String, String, String)> = conn
        .query_row(
            "SELECT payload_json, status, created_at FROM codex_inbox WHERE task_id=?1",
            [&task_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let (payload_json, status, created_at) = match row {
        Some(value) => value,
        None => return Ok(None),
    };
    let payload: Value = serde_json::from_str(&payload_json).unwrap_or(Value::Null);
    if payload.get("kind").and_then(|v| v.as_str()) != Some("batch") {
        return Ok(None);
    }
    Ok(Some(build_codex_batch_report(
        &conn,
        &task_id,
        &payload,
        &status,
        &created_at,
    )))
}

#[tauri::command]
fn get_pressure_grading_report(
    session_id: String,
    state: State<AppState>,
) -> Result<Option<Value>, String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;

    let result = conn
        .query_row(
            "SELECT report_json FROM pressure_reports WHERE session_id = ?1",
            [&session_id],
            |row| {
                let json_str: String = row.get(0)?;
                Ok(serde_json::from_str::<Value>(&json_str).unwrap_or(json!(null)))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
fn list_pressure_sessions(state: State<AppState>) -> Result<Vec<Value>, String> {
    let conn = state.supplemental_db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT session_id, question_ids, start_time, end_time, status, task_id, created_at FROM pressure_sessions ORDER BY created_at DESC LIMIT 50")
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map([], |row| {
            let start_time = row.get::<_, i64>(2)?;
            let end_time = row.get::<_, Option<i64>>(3)?;
            Ok(json!({
                "sessionId": row.get::<_, String>(0)?,
                "mode": "pressure",
                "questionIds": serde_json::from_str::<Vec<i64>>(&row.get::<_, String>(1)?).unwrap_or_default(),
                "startTime": start_time,
                "endTime": end_time,
                "totalDuration": (end_time.unwrap_or_else(|| Local::now().timestamp_millis()) - start_time) / 1000,
                "status": row.get::<_, String>(4)?,
                "taskId": row.get::<_, Option<String>>(5)?,
                "createdAt": row.get::<_, i64>(6)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let sessions = sessions
        .into_iter()
        .map(|mut session| {
            let session_id = session
                .get("sessionId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            session["questions"] = json!(pressure_answers_for_session(&conn, session_id)?);
            Ok::<Value, String>(session)
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(sessions)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 读取 Windows 系统代理（与浏览器同源），供 updater 直连被墙环境使用。
/// 返回形如 "http://127.0.0.1:17891"；未启用系统代理时返回 null。
#[tauri::command]
fn get_system_proxy() -> Option<String> {
    let reg_query = |value: &str| -> Option<String> {
        let output = Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                "/v",
                value,
            ])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&output.stdout).into_owned();
        let line = text
            .lines()
            .find(|l| l.contains(value) && l.contains("REG_"))?;
        line.split_whitespace().last().map(str::to_string)
    };
    if reg_query("ProxyEnable")?.as_str() != "0x1" {
        return None;
    }
    let server = reg_query("ProxyServer")?;
    if server.is_empty() {
        return None;
    }
    // ProxyServer 可能是 "127.0.0.1:17891" 或按协议 "http=...;https=..." 两种格式
    let target = if server.contains('=') {
        let https = server.split(';').find(|p| p.starts_with("https="));
        let http = server.split(';').find(|p| p.starts_with("http="));
        let part = https.or(http)?;
        part.split('=').nth(1)?
    } else {
        &server
    };
    if target.is_empty() {
        return None;
    }
    if target.contains("://") {
        Some(target.to_string())
    } else {
        Some(format!("http://{target}"))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileSettings {
    pub nickname: String,
    pub friend_code: Option<String>,
    pub target_school: Option<String>,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendSyncConfig {
    pub endpoint: String,
    pub username: String,
    pub app_password: String,
    pub folder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendSyncRemoteSnapshot {
    pub file_name: String,
    pub payload: String,
    #[serde(default)]
    pub server_etag: Option<String>,
    #[serde(default)]
    pub unchanged: bool,
}

fn sanitize_friend_sync_code(value: &str) -> Result<String, String> {
    let code = value.trim().to_uppercase();
    if code.len() < 2
        || code.len() > 64
        || !code
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("好友码包含不安全字符".to_string());
    }
    Ok(code)
}

fn friend_sync_file_name(friend_code: &str) -> Result<String, String> {
    Ok(format!(
        "shuaba-friend-{}.json",
        sanitize_friend_sync_code(friend_code)?
    ))
}

fn friend_sync_base_url(config: &FriendSyncConfig) -> Result<Url, String> {
    let endpoint = config.endpoint.trim();
    if endpoint.is_empty() {
        return Err("请填写坚果云 WebDAV 地址".to_string());
    }
    if config.username.trim().is_empty() || config.app_password.trim().is_empty() {
        return Err("请填写坚果云账号和应用密码".to_string());
    }
    let mut url = Url::parse(endpoint).map_err(|_| "WebDAV 地址格式不正确".to_string())?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("WebDAV 地址必须使用 http 或 https".to_string());
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("WebDAV 地址不能包含查询参数或片段（请删除 ?... 或 #...）".to_string());
    }
    let mut path = url.path().trim_end_matches('/').to_string();
    if path.is_empty() {
        path.push('/');
    } else {
        path.push('/');
    }
    url.set_path(&path);
    Ok(url)
}

fn friend_sync_folder_url(config: &FriendSyncConfig) -> Result<Url, String> {
    let mut url = friend_sync_base_url(config)?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| "WebDAV 地址不可用于路径拼接".to_string())?;
        for segment in config
            .folder
            .trim_matches('/')
            .split('/')
            .filter(|s| !s.is_empty())
        {
            if segment == "."
                || segment == ".."
                || segment.contains('\\')
                || segment.contains(':')
                || segment.contains('?')
                || segment.contains('#')
            {
                return Err("共享文件夹路径只能填写坚果云里的文件夹名，例如 shuaba-friends；不要填写 E:\\... 这样的电脑本地路径或完整网址".to_string());
            }
            segments.push(segment);
        }
    }
    if !url.path().ends_with('/') {
        let mut path = url.path().to_string();
        path.push('/');
        url.set_path(&path);
    }
    Ok(url)
}

fn friend_sync_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(std::time::Duration::from_secs(4))
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Shuaba-Friends/1")
        .build()
        .map_err(|e| format!("创建同步连接失败：{e}"))
}

fn friend_sync_auth(
    request: reqwest::blocking::RequestBuilder,
    config: &FriendSyncConfig,
) -> reqwest::blocking::RequestBuilder {
    request.basic_auth(config.username.trim(), Some(config.app_password.trim()))
}

fn friend_sync_status_error(action: &str, status: StatusCode) -> String {
    match status {
        StatusCode::UNAUTHORIZED => format!("{action}失败：HTTP 401。请检查坚果云账号和应用密码（不是网页登录密码）"),
        StatusCode::FORBIDDEN => format!("{action}失败：HTTP 403。当前账号没有该共享文件夹的读写权限"),
        StatusCode::NOT_FOUND => format!("{action}失败：HTTP 404。请检查 WebDAV 地址和共享文件夹名称"),
        StatusCode::CONFLICT => format!(
            "{action}失败：HTTP 409。请确认目标云端文件夹已创建、名称和层级完全一致，并且当前账号有权限访问"
        ),
        StatusCode::METHOD_NOT_ALLOWED => format!("{action}失败：HTTP 405。坚果云拒绝了当前 WebDAV 操作"),
        status if status.is_server_error() => format!("{action}失败：HTTP {status}。坚果云服务或网络暂时异常，请稍后重试"),
        _ => format!("{action}失败：HTTP {status}。请检查坚果云配置和共享目录权限"),
    }
}

fn friend_sync_propfind_with_depth(
    client: &Client,
    url: Url,
    config: &FriendSyncConfig,
    depth: &str,
) -> Result<reqwest::blocking::Response, String> {
    // 显式发送标准 PROPFIND XML，兼容坚果云对空请求体的处理差异。
    const PROPFIND_BODY: &str =
        r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><allprop/></propfind>"#;
    friend_sync_auth(
        client.request(Method::from_bytes(b"PROPFIND").unwrap(), url),
        config,
    )
    .header("Depth", depth)
    .header("Content-Type", "application/xml; charset=utf-8")
    .body(PROPFIND_BODY)
    .send()
    .map_err(|e| format!("连接坚果云失败：{e}"))
}

fn friend_sync_propfind(
    client: &Client,
    url: Url,
    config: &FriendSyncConfig,
) -> Result<reqwest::blocking::Response, String> {
    friend_sync_propfind_with_depth(client, url, config, "0")
}

fn friend_sync_folder_url_without_trailing_slash(url: &Url) -> Url {
    let mut candidate = url.clone();
    let path = candidate.path().trim_end_matches('/').to_string();
    candidate.set_path(&path);
    candidate
}

fn friend_sync_href_values(xml: &str) -> Result<Vec<String>, String> {
    use quick_xml::{escape::unescape, events::Event, Reader};

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut values = Vec::new();
    let mut in_href = false;
    let mut current = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(event))
                if event.local_name().as_ref().eq_ignore_ascii_case(b"href") =>
            {
                in_href = true;
                current.clear();
            }
            Ok(Event::Text(event)) if in_href => {
                let text = event
                    .decode()
                    .map_err(|e| format!("解析 WebDAV href 失败：{e}"))?;
                current.push_str(&text);
            }
            Ok(Event::CData(event)) if in_href => {
                current.push_str(&String::from_utf8_lossy(event.as_ref()));
            }
            Ok(Event::GeneralRef(event)) if in_href => {
                let reference = event
                    .decode()
                    .map_err(|e| format!("解析 WebDAV href 失败：{e}"))?;
                let escaped = format!("&{reference};");
                let text = unescape(&escaped).map_err(|e| format!("解析 WebDAV href 失败：{e}"))?;
                current.push_str(&text);
            }
            Ok(Event::End(event))
                if in_href && event.local_name().as_ref().eq_ignore_ascii_case(b"href") =>
            {
                let value = current.trim();
                if !value.is_empty() {
                    values.push(value.to_string());
                }
                in_href = false;
                current.clear();
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(format!("解析 WebDAV XML 失败：{error}")),
        }
    }

    Ok(values)
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
struct FriendSyncPropfindEntry {
    href: String,
    etag: Option<String>,
    last_modified: Option<String>,
    content_length: Option<u64>,
}

impl FriendSyncPropfindEntry {
    fn signature(&self) -> String {
        if let Some(ref etag) = self.etag {
            let trimmed = etag.trim().trim_matches('"');
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
        format!(
            "{}:{}",
            self.last_modified.as_deref().unwrap_or(""),
            self.content_length.unwrap_or(0)
        )
    }
}

fn friend_sync_propfind_entries(xml: &str) -> Result<Vec<FriendSyncPropfindEntry>, String> {
    use quick_xml::{escape::unescape, events::Event, Reader};

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut entries = Vec::new();
    let mut current_entry = FriendSyncPropfindEntry::default();
    let mut in_response = false;
    let mut current_tag = Vec::<u8>::new();
    let mut current_text = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref event)) => {
                let name = event.local_name();
                let lower = name.as_ref();
                if lower.eq_ignore_ascii_case(b"response") {
                    in_response = true;
                    current_entry = FriendSyncPropfindEntry::default();
                } else if in_response {
                    current_tag = lower.to_vec();
                    current_text.clear();
                }
            }
            Ok(Event::Text(ref event)) if in_response && !current_tag.is_empty() => {
                let text = event
                    .decode()
                    .map_err(|e| format!("解析 WebDAV XML 文本失败：{e}"))?;
                current_text.push_str(&text);
            }
            Ok(Event::CData(ref event)) if in_response && !current_tag.is_empty() => {
                current_text.push_str(&String::from_utf8_lossy(event.as_ref()));
            }
            Ok(Event::GeneralRef(ref event)) if in_response && !current_tag.is_empty() => {
                let reference = event
                    .decode()
                    .map_err(|e| format!("解析 WebDAV XML 引用失败：{e}"))?;
                let escaped = format!("&{reference};");
                let text = unescape(&escaped).map_err(|e| format!("解析 WebDAV XML 失败：{e}"))?;
                current_text.push_str(&text);
            }
            Ok(Event::End(ref event)) => {
                let name = event.local_name();
                let lower = name.as_ref();
                if lower.eq_ignore_ascii_case(b"response") {
                    if !current_entry.href.is_empty() {
                        entries.push(std::mem::take(&mut current_entry));
                    }
                    in_response = false;
                    current_tag.clear();
                    current_text.clear();
                } else if in_response && lower.eq_ignore_ascii_case(&current_tag) {
                    let val = current_text.trim();
                    if lower.eq_ignore_ascii_case(b"href") {
                        current_entry.href = val.to_string();
                    } else if lower.eq_ignore_ascii_case(b"getetag") {
                        let etag_clean = val.trim_matches('"').to_string();
                        if !etag_clean.is_empty() {
                            current_entry.etag = Some(etag_clean);
                        }
                    } else if lower.eq_ignore_ascii_case(b"getlastmodified") {
                        if !val.is_empty() {
                            current_entry.last_modified = Some(val.to_string());
                        }
                    } else if lower.eq_ignore_ascii_case(b"getcontentlength") {
                        if let Ok(len) = val.parse::<u64>() {
                            current_entry.content_length = Some(len);
                        }
                    }
                    current_tag.clear();
                    current_text.clear();
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(format!("解析 WebDAV XML 失败：{error}")),
        }
    }

    Ok(entries)
}

fn friend_sync_decode_path_segment(value: &str) -> Option<String> {
    percent_encoding::percent_decode_str(value)
        .decode_utf8()
        .ok()
        .map(|decoded| decoded.into_owned())
}

fn friend_sync_decoded_path_segments(url: &Url) -> Option<Vec<String>> {
    let mut segments = url
        .path_segments()?
        .map(friend_sync_decode_path_segment)
        .collect::<Option<Vec<_>>>()?;
    // Url::path_segments() includes a final empty segment for a collection URL
    // ending with '/', but empty segments in the middle remain significant.
    if segments.last().is_some_and(String::is_empty) {
        segments.pop();
    }
    Some(segments)
}

fn friend_sync_same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

fn friend_sync_href_url(base: &Url, href: &str) -> Option<Url> {
    let candidate = Url::parse(href).ok().or_else(|| base.join(href).ok())?;
    if !friend_sync_same_origin(base, &candidate)
        || candidate.query().is_some()
        || candidate.fragment().is_some()
    {
        return None;
    }
    Some(candidate)
}

fn friend_sync_discover_folder_url(
    client: &Client,
    config: &FriendSyncConfig,
) -> Result<Option<Url>, String> {
    let root = friend_sync_base_url(config)?;
    let response = friend_sync_propfind_with_depth(client, root.clone(), config, "1")?;
    if !response.status().is_success() {
        return Ok(None);
    }
    let body = response
        .text()
        .map_err(|e| format!("读取坚果云目录失败：{e}"))?;
    let hrefs = friend_sync_href_values(&body)?;
    let root_segments = friend_sync_decoded_path_segments(&root).unwrap_or_default();
    let wanted_segments: Vec<String> = config
        .folder
        .trim_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .collect();
    if wanted_segments.is_empty() {
        return Ok(None);
    }

    for href in hrefs {
        let Some(candidate) = friend_sync_href_url(&root, &href) else {
            continue;
        };
        let Some(candidate_segments) = friend_sync_decoded_path_segments(&candidate) else {
            continue;
        };
        let mut expected = root_segments.clone();
        expected.extend(wanted_segments.iter().cloned());
        if candidate_segments == expected {
            let mut folder = candidate;
            let mut path = folder.path().trim_end_matches('/').to_string();
            path.push('/');
            folder.set_path(&path);
            return Ok(Some(folder));
        }
    }
    Ok(None)
}

fn friend_sync_resolve_folder_url(
    client: &Client,
    config: &FriendSyncConfig,
) -> Result<Url, String> {
    Ok(friend_sync_discover_folder_url(client, config)?.unwrap_or(friend_sync_folder_url(config)?))
}

fn friend_sync_directory_diagnostic(
    client: &Client,
    config: &FriendSyncConfig,
    folder_url: &Url,
    initial_status: StatusCode,
) -> Result<String, String> {
    if initial_status.is_success() {
        return Ok("通过".to_string());
    }

    if initial_status == StatusCode::CONFLICT {
        let without_slash = friend_sync_folder_url_without_trailing_slash(folder_url);
        let fallback = friend_sync_propfind(client, without_slash, config)?;
        if fallback.status().is_success() {
            return Ok("通过（兼容目录末尾斜杠）".to_string());
        }
        if let Some(discovered) = friend_sync_discover_folder_url(client, config)? {
            if discovered == *folder_url {
                return Ok(
                    "已识别（目录 PROPFIND 返回 409，已通过实际文件读写继续验证）".to_string(),
                );
            }
        }
        let root_response = friend_sync_propfind(client, friend_sync_base_url(config)?, config)?;
        if root_response.status().is_success() {
            return Err("坚果云账号可用，但 WebDAV 根目录中找不到目标文件夹。请确认文件夹名称、层级和共享权限".to_string());
        }
        return Ok("未能读取目录（PROPFIND 409，已通过实际文件读写继续验证）".to_string());
    }

    if initial_status == StatusCode::NOT_FOUND {
        let root_response = friend_sync_propfind(client, friend_sync_base_url(config)?, config)?;
        if root_response.status().is_success()
            && friend_sync_discover_folder_url(client, config)?.is_none()
        {
            return Err("坚果云账号可用，但 WebDAV 根目录中找不到目标文件夹。请确认文件夹名称、层级和共享权限".to_string());
        }
    }

    Err(friend_sync_status_error("访问共享文件夹", initial_status))
}

fn friend_sync_delete_probe(
    client: &Client,
    config: &FriendSyncConfig,
    probe_url: &Url,
) -> Result<(), String> {
    let response = friend_sync_auth(
        client.request(
            Method::from_bytes(b"DELETE").expect("DELETE is a valid HTTP method"),
            probe_url.clone(),
        ),
        config,
    )
    .send()
    .map_err(|e| format!("删除测试探针失败：{e}"))?;
    if response.status().is_success() || response.status() == StatusCode::NOT_FOUND {
        Ok(())
    } else {
        Err(friend_sync_status_error("删除测试探针", response.status()))
    }
}

fn friend_sync_probe_put(
    client: &Client,
    config: &FriendSyncConfig,
    folder_url: &Url,
    file_url: &Url,
    payload: &str,
) -> Result<(), String> {
    let send_put = |url: Url, body: String| {
        friend_sync_auth(client.put(url), config)
            .header("Content-Type", "application/json; charset=utf-8")
            .body(body)
            .send()
    };

    let response = match send_put(file_url.clone(), payload.to_string()) {
        Ok(response) => response,
        Err(error) => {
            // PUT 可能在服务端已经落盘后才因超时/连接中断返回错误，
            // 因此失败也必须尽量删除随机探针，避免云端残留临时文件。
            if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
                log::warn!("测试探针上传请求失败后的清理也失败：{cleanup_error}");
            }
            return Err(format!("上传测试探针失败：{error}（已尝试清理测试探针）"));
        }
    };
    if response.status().is_success() {
        return Ok(());
    }

    if response.status() != StatusCode::NOT_FOUND && response.status() != StatusCode::CONFLICT {
        if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
            log::warn!("测试探针上传失败后的清理也失败：{cleanup_error}");
        }
        return Err(format!(
            "{}（已尝试清理测试探针）",
            friend_sync_status_error("上传测试探针", response.status())
        ));
    }

    let mkcol = match friend_sync_auth(
        client.request(
            Method::from_bytes(b"MKCOL").expect("MKCOL is a valid HTTP method"),
            folder_url.clone(),
        ),
        config,
    )
    .send()
    {
        Ok(response) => response,
        Err(error) => {
            if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
                log::warn!("创建共享目录请求失败后的测试探针清理也失败：{cleanup_error}");
            }
            return Err(format!("创建共享目录失败：{error}（已尝试清理测试探针）"));
        }
    };
    if !(mkcol.status().is_success()
        || mkcol.status() == StatusCode::METHOD_NOT_ALLOWED
        || mkcol.status() == StatusCode::CONFLICT)
    {
        if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
            log::warn!("创建共享目录失败后的测试探针清理也失败：{cleanup_error}");
        }
        return Err(format!(
            "{}（已尝试清理测试探针）",
            friend_sync_status_error("创建共享目录", mkcol.status())
        ));
    }

    let retry = match send_put(file_url.clone(), payload.to_string()) {
        Ok(response) => response,
        Err(error) => {
            if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
                log::warn!("重试上传请求失败后的测试探针清理也失败：{cleanup_error}");
            }
            return Err(format!(
                "重试上传测试探针失败：{error}（已尝试清理测试探针）"
            ));
        }
    };
    if retry.status().is_success() {
        Ok(())
    } else {
        if let Err(cleanup_error) = friend_sync_delete_probe(client, config, file_url) {
            log::warn!("重试上传失败后的测试探针清理也失败：{cleanup_error}");
        }
        Err(format!(
            "{}（已尝试清理测试探针）",
            friend_sync_status_error("上传测试探针", retry.status())
        ))
    }
}

fn friend_sync_payload_from_response(
    response: reqwest::blocking::Response,
    action: &str,
) -> Result<String, String> {
    const MAX_PAYLOAD_BYTES: usize = 256 * 1024;
    if let Some(length) = response.content_length() {
        if length > MAX_PAYLOAD_BYTES as u64 {
            return Err(format!("{action}失败：好友数据超过 256 KB 大小限制"));
        }
    }
    let bytes = response
        .bytes()
        .map_err(|e| format!("{action}失败：读取响应失败：{e}"))?;
    if bytes.len() > MAX_PAYLOAD_BYTES {
        return Err(format!("{action}失败：好友数据超过 256 KB 大小限制"));
    }
    String::from_utf8(bytes.to_vec()).map_err(|_| format!("{action}失败：响应不是有效 UTF-8 JSON"))
}

fn test_friend_sync_impl(config: FriendSyncConfig) -> Result<String, String> {
    let client = friend_sync_client()?;

    let root_response = friend_sync_propfind(&client, friend_sync_base_url(&config)?, &config)?;
    let auth_status = root_response.status();
    if auth_status == StatusCode::UNAUTHORIZED || auth_status == StatusCode::FORBIDDEN {
        return Err(friend_sync_status_error("账号认证", auth_status));
    }
    if !auth_status.is_success() && auth_status != StatusCode::CONFLICT {
        return Err(friend_sync_status_error(
            "账号认证/访问 WebDAV 根目录",
            auth_status,
        ));
    }
    let auth_label = if auth_status.is_success() {
        "通过"
    } else {
        "通过（根目录 PROPFIND 返回 409，继续用实际读写验证）"
    };
    let folder_url = friend_sync_resolve_folder_url(&client, &config)?;

    let directory_response = friend_sync_propfind(&client, folder_url.clone(), &config)?;
    let directory_label = friend_sync_directory_diagnostic(
        &client,
        &config,
        &folder_url,
        directory_response.status(),
    )?;

    let probe_name = format!(
        ".shuaba-connection-test-{:016x}.tmp",
        rand::rng().random::<u64>()
    );
    let probe_url = folder_url
        .join(&probe_name)
        .map_err(|_| "无法拼接坚果云测试探针路径".to_string())?;
    let probe_payload = format!(r#"{{"probe":"shuaba","id":"{}"}}"#, probe_name);

    let write_result =
        friend_sync_probe_put(&client, &config, &folder_url, &probe_url, &probe_payload);
    if let Err(error) = write_result {
        return Err(format!(
            "账号认证：{auth_label}；目标目录：{directory_label}；写入：失败。{error}"
        ));
    }

    let read_result = match friend_sync_auth(client.get(probe_url.clone()), &config).send() {
        Ok(response) if response.status().is_success() => {
            match friend_sync_payload_from_response(response, "读取测试探针") {
                Ok(payload) if payload == probe_payload => Ok(()),
                Ok(_) => Err("读取测试探针失败：返回内容与上传内容不一致".to_string()),
                Err(error) => Err(error),
            }
        }
        Ok(response) => Err(friend_sync_status_error("读取测试探针", response.status())),
        Err(error) => Err(format!("读取测试探针失败：{error}")),
    };

    let delete_result = friend_sync_delete_probe(&client, &config, &probe_url);

    if let Err(error) = read_result {
        if let Err(delete_error) = delete_result {
            log::warn!("测试探针读取失败后的清理也失败：{delete_error}");
        }
        return Err(format!(
            "账号认证：{auth_label}；目标目录：{directory_label}；写入：通过；读取：失败。{error}（测试探针已尝试清理）"
        ));
    }

    match delete_result {
        Ok(()) => Ok(format!(
            "账号认证：{auth_label}；目标目录：{directory_label}；读取：通过；写入：通过；删除：通过。坚果云实际读写权限正常"
        )),
        Err(error) => Ok(format!(
            "账号认证：{auth_label}；目标目录：{directory_label}；读取：通过；写入：通过；删除：失败。{error}；同步仍可用，但共享目录可能无法清理临时文件"
        )),
    }
}

// 好友同步全部走阻塞式 HTTP 客户端。若直接以同步命令形式执行，会占用 Tauri 主线程并冻结
// WebView（表现为主界面周期性卡顿）。这里统一用 async 命令 + spawn_blocking 把网络 I/O
// 转移到专用阻塞线程池，主线程只负责接收结果，全程不阻塞渲染。
#[tauri::command]
async fn test_friend_sync(config: FriendSyncConfig) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || test_friend_sync_impl(config))
        .await
        .map_err(|e| format!("好友同步后台任务异常退出：{e}"))?
}

fn publish_friend_snapshot_impl(
    config: FriendSyncConfig,
    friend_code: String,
    payload: String,
) -> Result<String, String> {
    const MAX_PAYLOAD_BYTES: usize = 256 * 1024;
    if payload.len() > MAX_PAYLOAD_BYTES {
        return Err("上传好友数据失败：好友数据超过 256 KB 大小限制".to_string());
    }
    let client = friend_sync_client()?;
    let folder_url = friend_sync_resolve_folder_url(&client, &config)?;
    let file_name = friend_sync_file_name(&friend_code)?;
    let file_url = folder_url
        .join(&file_name)
        .map_err(|_| "无法拼接好友数据文件路径".to_string())?;
    let response = friend_sync_auth(client.put(file_url.clone()), &config)
        .header("Content-Type", "application/json; charset=utf-8")
        .body(payload.clone())
        .send()
        .map_err(|e| format!("上传好友数据失败：{e}"))?;
    if response.status().is_success() {
        return Ok(file_name);
    }

    if response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::CONFLICT {
        let mkcol = friend_sync_auth(
            client.request(
                Method::from_bytes(b"MKCOL").expect("MKCOL is a valid HTTP method"),
                folder_url.clone(),
            ),
            &config,
        )
        .send()
        .map_err(|e| format!("创建共享目录失败：{e}"))?;
        if !(mkcol.status().is_success()
            || mkcol.status() == StatusCode::METHOD_NOT_ALLOWED
            || mkcol.status() == StatusCode::CONFLICT)
        {
            return Err(friend_sync_status_error("创建共享目录", mkcol.status()));
        }

        let retry = friend_sync_auth(client.put(file_url), &config)
            .header("Content-Type", "application/json; charset=utf-8")
            .body(payload)
            .send()
            .map_err(|e| format!("重试上传好友数据失败：{e}"))?;
        if retry.status().is_success() {
            Ok(file_name)
        } else {
            Err(friend_sync_status_error("上传好友数据", retry.status()))
        }
    } else {
        Err(friend_sync_status_error("上传好友数据", response.status()))
    }
}

#[tauri::command]
async fn publish_friend_snapshot(
    config: FriendSyncConfig,
    friend_code: String,
    payload: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        publish_friend_snapshot_impl(config, friend_code, payload)
    })
    .await
    .map_err(|e| format!("好友数据上传后台任务异常退出：{e}"))?
}

fn friend_sync_file_from_href(folder_url: &Url, href: &str) -> Option<(String, Url)> {
    let candidate = friend_sync_href_url(folder_url, href)?;
    let folder_segments = friend_sync_decoded_path_segments(folder_url)?;
    let candidate_segments = friend_sync_decoded_path_segments(&candidate)?;
    if candidate_segments.len() != folder_segments.len() + 1
        || candidate_segments[..folder_segments.len()] != folder_segments[..]
    {
        return None;
    }

    let file_name = candidate_segments.last()?.as_str();
    let prefix = "shuaba-friend-";
    let code = file_name.strip_prefix(prefix)?.strip_suffix(".json")?;
    let normalized_code = sanitize_friend_sync_code(code).ok()?;
    let canonical_name = friend_sync_file_name(&normalized_code).ok()?;
    Some((canonical_name, candidate))
}

fn pull_friend_snapshots_impl(
    config: FriendSyncConfig,
    friend_codes: Vec<String>,
    known_hashes: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<FriendSyncRemoteSnapshot>, String> {
    let client = friend_sync_client()?;
    let folder_url = friend_sync_resolve_folder_url(&client, &config)?;
    let mut files = std::collections::BTreeMap::<String, (Url, Option<String>)>::new();
    let known = known_hashes.unwrap_or_default();

    // 自动发现只接受 XML href 指向目标共享目录的直接子文件，避免把 XML 文本中的
    // 任意片段误当成好友文件；文件名统一规范化后去重。
    match friend_sync_propfind_with_depth(&client, folder_url.clone(), &config, "1") {
        Ok(response) if response.status().is_success() => match response.text() {
            Ok(xml) => match friend_sync_propfind_entries(&xml) {
                Ok(entries) => {
                    for entry in entries {
                        if let Some((file_name, file_url)) =
                            friend_sync_file_from_href(&folder_url, &entry.href)
                        {
                            let sig = entry.signature();
                            files.entry(file_name).or_insert((file_url, Some(sig)));
                        }
                    }
                }
                Err(error) => log::warn!("好友同步自动发现失败：{error}"),
            },
            Err(error) => log::warn!("好友同步读取目录失败：{error}"),
        },
        Ok(response) => log::warn!(
            "好友同步自动发现跳过：{}",
            friend_sync_status_error("列出好友文件", response.status())
        ),
        Err(error) => log::warn!("好友同步自动发现请求失败：{error}"),
    }

    // 显式好友码是自动发现不可用时的定向兜底，也使用同一套安全规则。
    for code in friend_codes {
        match friend_sync_file_name(&code) {
            Ok(file_name) => {
                if let Ok(file_url) = folder_url.join(&file_name) {
                    files.entry(file_name).or_insert((file_url, None));
                }
            }
            Err(error) => log::warn!("跳过不安全好友码：{error}"),
        }
    }

    let mut snapshots = Vec::new();
    for (file_name, (file_url, sig)) in files {
        if let Some(ref server_sig) = sig {
            if let Some(local_sig) = known.get(&file_name) {
                if local_sig == server_sig && !server_sig.is_empty() {
                    // 远端文件签名未发生变化，命中差异缓存，跳过下载 GET 请求
                    snapshots.push(FriendSyncRemoteSnapshot {
                        file_name,
                        payload: String::new(),
                        server_etag: Some(server_sig.clone()),
                        unchanged: true,
                    });
                    continue;
                }
            }
        }

        let response = match friend_sync_auth(client.get(file_url), &config).send() {
            Ok(response) => response,
            Err(error) => {
                log::warn!("好友文件 {file_name} 下载失败：{error}");
                continue;
            }
        };
        if response.status() == StatusCode::NOT_FOUND {
            log::debug!("好友文件 {file_name} 尚未发布");
            continue;
        }
        if !response.status().is_success() {
            log::warn!(
                "好友文件 {file_name} 下载失败：{}",
                friend_sync_status_error("读取好友数据", response.status())
            );
            continue;
        }
        let etag_header = response
            .headers()
            .get("etag")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.trim_matches('"').to_string())
            .or(sig);
        match friend_sync_payload_from_response(response, "读取好友数据") {
            Ok(payload) => snapshots.push(FriendSyncRemoteSnapshot {
                file_name,
                payload,
                server_etag: etag_header,
                unchanged: false,
            }),
            Err(error) => log::warn!("好友文件 {file_name} 无法使用：{error}"),
        }
    }
    Ok(snapshots)
}

#[tauri::command]
async fn pull_friend_snapshots(
    config: FriendSyncConfig,
    friend_codes: Vec<String>,
    known_hashes: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<FriendSyncRemoteSnapshot>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pull_friend_snapshots_impl(config, friend_codes, known_hashes)
    })
    .await
    .map_err(|e| format!("好友数据拉取后台任务异常退出：{e}"))?
}

#[tauri::command]
fn get_user_profile(state: State<AppState>) -> Result<UserProfileSettings, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let nickname = setting(&conn, "user_nickname", "dr7fter");
    let friend_code = setting(&conn, "user_friend_code", "");
    let target_school = setting(&conn, "target_school", "考研数学一 · 目标985");
    let avatar = setting(&conn, "user_avatar", "🚀");
    let normalized_friend_code = if friend_code.is_empty() {
        None
    } else {
        sanitize_friend_sync_code(&friend_code).ok()
    };
    Ok(UserProfileSettings {
        nickname,
        friend_code: normalized_friend_code,
        target_school: Some(target_school),
        avatar: Some(avatar),
    })
}

#[tauri::command]
fn set_user_profile(profile: UserProfileSettings, state: State<AppState>) -> Result<(), String> {
    let normalized_friend_code = profile
        .friend_code
        .as_deref()
        .map(sanitize_friend_sync_code)
        .transpose()?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings(key,value) VALUES('user_nickname',?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [&profile.nickname],
    )
    .map_err(|e| e.to_string())?;
    if let Some(friend_code) = normalized_friend_code {
        conn.execute(
            "INSERT INTO settings(key,value) VALUES('user_friend_code',?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [&friend_code],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(target_school) = profile.target_school {
        conn.execute(
            "INSERT INTO settings(key,value) VALUES('target_school',?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [&target_school],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(avatar) = profile.avatar {
        conn.execute(
            "INSERT INTO settings(key,value) VALUES('user_avatar',?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [&avatar],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MistakeTimelineItem {
    pub attempt_id: i64,
    pub question_id: i64,
    pub stem: String,
    pub category_path: String,
    pub question_type: String,
    pub difficulty: i32,
    pub attempted_at: String,
    pub duration_seconds: i32,
    pub result: String,
    pub outcome: Option<String>,
    pub earliest_error: Option<String>,
    pub advice: Option<String>,
    pub mastery: Option<i32>,
    pub favorite: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MistakeDayGroup {
    pub date: String,
    pub display_date: String,
    pub total_count: usize,
    pub items: Vec<MistakeTimelineItem>,
}

#[tauri::command]
fn get_mistake_timeline(
    limit_days: Option<i64>,
    state: State<AppState>,
) -> Result<Vec<MistakeDayGroup>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let days_limit = limit_days.unwrap_or(90).clamp(1, 365);

    let mut stmt = conn
        .prepare(
            "WITH latest_advice AS (
                 SELECT q_id, advice, earliest_error FROM (
                     SELECT question_id as q_id,
                            json_extract(payload_json, '$.advice') as advice,
                            json_extract(payload_json, '$.earliestError') as earliest_error,
                            id,
                            ROW_NUMBER() OVER(PARTITION BY question_id ORDER BY id DESC) as rn
                     FROM codex_inbox
                     WHERE kind = 'analysis' AND (json_extract(payload_json, '$.advice') IS NOT NULL OR json_extract(payload_json, '$.earliestError') IS NOT NULL)
                     
                     UNION ALL
                     
                     SELECT CAST(json_extract(b.value, '$.questionId') AS INTEGER) as q_id,
                            json_extract(b.value, '$.advice') as advice,
                            json_extract(b.value, '$.earliestError') as earliest_error,
                            i.id,
                            ROW_NUMBER() OVER(PARTITION BY json_extract(b.value, '$.questionId') ORDER BY i.id DESC) as rn
                     FROM codex_inbox i, json_each(json_extract(i.payload_json, '$.batchAttempts')) b
                     WHERE i.kind = 'batch' AND (json_extract(b.value, '$.advice') IS NOT NULL OR json_extract(b.value, '$.earliestError') IS NOT NULL)
                 ) WHERE rn = 1
             )
             SELECT a.id, a.question_id, q.stem, q.category_path, q.question_type, q.difficulty,
                    a.attempted_at, a.duration_seconds, a.result, a.outcome,
                    COALESCE(la.earliest_error, ld.earliest_error) as earliest_error,
                    la.advice,
                    p.mastery, COALESCE(p.favorite, 0),
                    substr(a.attempted_at, 1, 10) as day
             FROM attempts a
             JOIN questions q ON q.id = a.question_id
             LEFT JOIN progress p ON p.question_id = a.question_id
             LEFT JOIN (
                 SELECT question_id, earliest_error,
                        ROW_NUMBER() OVER(PARTITION BY question_id ORDER BY id DESC) as rn
                 FROM learning_diagnoses
                 WHERE earliest_error IS NOT NULL
             ) ld ON ld.question_id = a.question_id AND ld.rn = 1
             LEFT JOIN latest_advice la ON la.q_id = a.question_id
             WHERE COALESCE(a.outcome, a.result) IN ('wrong', 'incorrect', 'uncertain')
             ORDER BY a.attempted_at DESC, a.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let today = Local::now().format("%Y-%m-%d").to_string();
    let yesterday = (Local::now() - chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();

    let mut groups_map: std::collections::BTreeMap<String, Vec<MistakeTimelineItem>> =
        std::collections::BTreeMap::new();
    let mut date_order: Vec<String> = Vec::new();

    let rows = stmt
        .query_map([], |row| {
            let item = MistakeTimelineItem {
                attempt_id: row.get(0)?,
                question_id: row.get(1)?,
                stem: row.get(2)?,
                category_path: row.get(3)?,
                question_type: row.get(4)?,
                difficulty: row.get(5)?,
                attempted_at: row.get(6)?,
                duration_seconds: row.get(7)?,
                result: row.get(8)?,
                outcome: row.get(9)?,
                earliest_error: row.get(10)?,
                advice: row.get(11)?,
                mastery: row.get(12)?,
                favorite: row.get::<_, i32>(13)? == 1,
            };
            let day: String = row.get(14)?;
            Ok((day, item))
        })
        .map_err(|e| e.to_string())?;

    for row_res in rows {
        let (day, item) = row_res.map_err(|e| e.to_string())?;
        if !groups_map.contains_key(&day) {
            date_order.push(day.clone());
        }
        groups_map.entry(day).or_default().push(item);
        if date_order.len() > days_limit as usize {
            break;
        }
    }

    let mut result = Vec::new();
    for day in date_order {
        if let Some(items) = groups_map.remove(&day) {
            let display_date = if day == today {
                format!("{day} (今天)")
            } else if day == yesterday {
                format!("{day} (昨天)")
            } else {
                day.clone()
            };
            result.push(MistakeDayGroup {
                date: day,
                display_date,
                total_count: items.len(),
                items,
            });
        }
    }

    Ok(result)
}

/// 日志插件装配：开发期 Info 级打终端，生产期 Warn 级落盘。
///
/// 历史教训：v1.6.7 及之前日志插件只在 `cfg!(debug_assertions)` 下注册，
/// 导致 release 构建中 21 处 `log::warn!` 全部空转——生产环境零可观测性，
/// 用户报障只能靠猜。这里改为两种模式都注册，只是目标与级别不同。
///
/// 生产日志落在 OS 日志目录（Windows: `%LOCALAPPDATA%\com.shuaba.math\logs`），
/// 保留最近 7 个分片、单文件上限 2 MB、使用本地时区便于对照用户描述的时间点。
fn build_log_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    if cfg!(debug_assertions) {
        tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build()
    } else {
        tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Warn)
            .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(7))
            .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
            .max_file_size(2 * 1024 * 1024)
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::LogDir {
                    file_name: Some("shuaba".into()),
                },
            ))
            .build()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(build_log_plugin())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(data_dir.join("codex-inbox").join("processed"))?;
            fs::create_dir_all(data_dir.join("backups").join("rolling"))?;

            // 1. Checkpoint the existing database and create a recoverable
            // pre-migration backup before any schema write.
            let db_path = data_dir.join("shuaba.db");
            let database_existed = db_path.exists();
            let conn = Connection::open(&db_path)?;
            if database_existed {
                conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
                create_rolling_backup(&data_dir).map_err(std::io::Error::other)?;
            }

            // 2. Apply additive migrations. Failure stops startup.
            init_schema(&conn)?;
            migrate_schema(&conn)?;
            backfill_confirmed_analysis_signals(&conn).map_err(std::io::Error::other)?;
            let supplemental_conn = Connection::open(data_dir.join("supplemental.db"))?;
            init_supplemental_schema(&supplemental_conn)?;
            let candidate_adjacent = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf()));
            let candidate_cwd = std::env::current_dir().ok();
            let detected_library = [
                candidate_adjacent.as_ref().map(|d| d.join("题库-大观园")),
                candidate_adjacent.as_ref().map(|d| d.join("library")),
                candidate_cwd.as_ref().map(|d| d.join("题库-大观园")),
                candidate_cwd.as_ref().map(|d| d.join("library")),
            ]
            .into_iter()
            .flatten()
            .find(|p| p.join("all_questions_20260813.json").exists())
            .map(|p| p.to_string_lossy().into_owned());

            let library_path = if let Some(detected) = detected_library {
                detected
            } else {
                let saved = setting(&conn, "library_path", DEFAULT_LIBRARY);
                if Path::new(&saved).exists() {
                    saved
                } else if Path::new(DEFAULT_LIBRARY).exists() {
                    DEFAULT_LIBRARY.to_string()
                } else {
                    saved
                }
            };
            let integrity: String = conn
                .query_row("PRAGMA integrity_check", [], |r| r.get(0))
                .unwrap_or_else(|_| "error".into());
            if integrity != "ok" {
                eprintln!("[shuaba] 数据库完整性检查未通过：{integrity}，可从 backups/rolling/ 最近备份恢复");
            }
            app.manage(AppState {
                db: Mutex::new(conn),
                supplemental_db: Mutex::new(supplemental_conn),
                data_dir,
                library_dir: Mutex::new(PathBuf::from(library_path)),
                image_cache: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            get_question,
            get_recommendations,
            get_categories,
            search_question_page,
            get_mastery_map,
            get_mastery_nodes,
            get_library_path,
            set_library_path,
            get_elo_status,
            get_session_scoreboard,
            get_season_status,
            advance_season,
            get_rating_distribution,
            get_tactical_dashboard_stats,
            get_learning_center_snapshot,
            get_tag_closure,
            get_chapter_queue,
            get_focus_queue,
            get_variant_queue,
            set_focus_branches,
            get_review_queue,
            get_review_history,
            get_review_plan,
            set_current_chapter,
            get_custom_queue,
            add_to_custom_queue,
            remove_from_custom_queue,
            clear_custom_queue,
            add_supplemental_question,
            record_attempt,
            undo_last_attempt,
            toggle_favorite,
            save_note,
            save_review_intervals,
            save_goal,
            create_learning_task,
            export_records,
            claim_reward_event,
            get_reward_events,
            save_practice_session,
            load_practice_session,
            clear_practice_session,
            restore_database_backup,
            list_database_backups,
            get_inbox,
            get_failed_inbox,
            refresh_inbox,
            get_daily_log,
            start_recommendation_batch,
            dismiss_recommendation_batch,
            get_learning_task_candidates,
            update_recommendation_batch_items,
            confirm_inbox,
            create_codex_task,
            create_codex_batch_task,
            get_task_prompt,
            image_data_url,
            get_insights,
            get_weakness_radar,
            get_daily_trend,
            get_streak,
            create_pressure_session,
            submit_pressure_answer,
            complete_pressure_session,
            abandon_pressure_session,
            save_pressure_grading_report,
            get_pressure_session,
            get_pressure_grading_report,
            get_codex_batch_report,
            list_pressure_sessions,
            get_today_attempted_questions,
            get_mistake_timeline,
            get_app_version,
            get_system_proxy,
            get_user_profile,
            set_user_profile,
            test_friend_sync,
            publish_friend_snapshot,
            pull_friend_snapshots
        ])
        .run(tauri::generate_context!())
        .expect("error while running 刷吧");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn friend_sync_code_is_normalized_and_rejects_path_characters() {
        assert_eq!(sanitize_friend_sync_code(" sb-ab_12 ").unwrap(), "SB-AB_12");
        assert!(sanitize_friend_sync_code("SB/AB").is_err());
        assert!(sanitize_friend_sync_code("SB AB").is_err());
        assert!(sanitize_friend_sync_code("A").is_err());
        assert!(sanitize_friend_sync_code(&"A".repeat(65)).is_err());
    }

    #[test]
    fn friend_sync_endpoint_rejects_query_fragment_and_unsafe_folder_segments() {
        let config = |endpoint: &str, folder: &str| FriendSyncConfig {
            endpoint: endpoint.to_string(),
            username: "user@example.com".to_string(),
            app_password: "app-password".to_string(),
            folder: folder.to_string(),
        };

        assert!(
            friend_sync_base_url(&config("https://dav.example/dav/?x=1", "shuaba-friends"))
                .is_err()
        );
        assert!(
            friend_sync_base_url(&config("https://dav.example/dav/#folder", "shuaba-friends"))
                .is_err()
        );
        assert!(friend_sync_folder_url(&config("https://dav.example/dav/", "E:\\刷吧")).is_err());
        assert!(friend_sync_folder_url(&config("https://dav.example/dav/", "../other")).is_err());
        assert!(
            friend_sync_folder_url(&config("https://dav.example/dav/", "folder?name")).is_err()
        );
        assert!(
            friend_sync_folder_url(&config("https://dav.example/dav/", "folder#name")).is_err()
        );
    }

    #[test]
    fn friend_sync_href_parser_handles_namespaces_entities_and_cdata() {
        let xml = r#"<?xml version="1.0"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response><D:href>/dav/shuaba-friends/</D:href></D:response>
              <d:response><d:href>/dav/shuaba-friends/shuaba-friend-SB&amp;A.json</d:href></d:response>
              <response><href><![CDATA[/dav/shuaba-friends/shuaba-friend-SB-B.json]]></href></response>
            </D:multistatus>"#;
        let hrefs = friend_sync_href_values(xml).unwrap();
        assert_eq!(hrefs.len(), 3);
        assert_eq!(hrefs[0], "/dav/shuaba-friends/");
        assert_eq!(hrefs[1], "/dav/shuaba-friends/shuaba-friend-SB&A.json");
        assert_eq!(hrefs[2], "/dav/shuaba-friends/shuaba-friend-SB-B.json");
        assert!(
            friend_sync_href_values("<multistatus><href>&bogus;</href></multistatus>").is_err()
        );
    }

    #[test]
    fn friend_sync_propfind_entries_parses_etag_and_last_modified() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response>
                <D:href>/dav/shuaba-friends/shuaba-friend-SB-AAA.json</D:href>
                <D:propstat>
                  <D:prop>
                    <D:getetag>"etag-12345"</D:getetag>
                    <D:getlastmodified>Tue, 25 Aug 2026 10:00:00 GMT</D:getlastmodified>
                    <D:getcontentlength>2048</D:getcontentlength>
                  </D:prop>
                  <D:status>HTTP/1.1 200 OK</D:status>
                </D:propstat>
              </D:response>
            </D:multistatus>"#;
        let entries = friend_sync_propfind_entries(xml).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].href, "/dav/shuaba-friends/shuaba-friend-SB-AAA.json");
        assert_eq!(entries[0].etag.as_deref(), Some("etag-12345"));
        assert_eq!(entries[0].signature(), "etag-12345");
    }

    #[test]
    fn friend_sync_href_file_requires_same_origin_and_direct_child() {
        let folder = Url::parse("https://dav.example/dav/shuaba-friends/").unwrap();
        let discovered = friend_sync_file_from_href(
            &folder,
            "https://dav.example/dav/shuaba-friends/shuaba-friend-sb%2Dabc.json",
        )
        .unwrap();
        assert_eq!(discovered.0, "shuaba-friend-SB-ABC.json");
        assert_eq!(
            discovered.1.path(),
            "/dav/shuaba-friends/shuaba-friend-sb%2Dabc.json"
        );
        assert!(friend_sync_file_from_href(
            &folder,
            "https://evil.example/dav/shuaba-friends/shuaba-friend-SB-ABC.json"
        )
        .is_none());
        assert!(friend_sync_file_from_href(
            &folder,
            "/dav/shuaba-friends/nested/shuaba-friend-SB-ABC.json"
        )
        .is_none());
        assert!(
            friend_sync_file_from_href(&folder, "/dav/other/shuaba-friend-SB-ABC.json").is_none()
        );
        assert!(friend_sync_file_from_href(
            &folder,
            "/dav/shuaba-friends/shuaba-friend-SB-ABC.json?rev=1"
        )
        .is_none());
        assert!(friend_sync_file_from_href(
            &folder,
            "/dav/shuaba-friends/shuaba-friend-SB-ABC.json#fragment"
        )
        .is_none());
    }

    fn insert_test_question(conn: &Connection, id: i64, category_path: &str) {
        conn.execute(
            "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(?1,'测试题','[]','答案','解析','测试','subjective',?2,'[]',0,2,'')",
            params![id, category_path],
        )
        .unwrap();
    }

    #[test]
    fn completed_recommendation_exports_result_context_for_next_ai_round() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 9001, "高等数学 / 极限");
        conn.execute(
            "INSERT INTO recommendation_batches(task_id,title,summary,recommendation_reason,status,created_at,started_at) VALUES('SB-RESULT-1','结果测试','覆盖考法','因为上一轮待验证','active','2026-08-26T10:00:00+08:00','2026-08-26T10:01:00+08:00')",
            [],
        ).unwrap();
        conn.execute("INSERT INTO recommendation_batch_items(task_id,question_id,position) VALUES('SB-RESULT-1',9001,0)", []).unwrap();
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode,outcome,evidence_source) VALUES(9001,'2026-08-26T10:05:00+08:00',72,'correct',3,'paper','correct','self_report')",
            [],
        ).unwrap();
        let attempt_id = conn.last_insert_rowid();
        complete_active_recommendation_item(&conn, 9001, attempt_id).unwrap();
        let dir = std::env::temp_dir().join(format!("shuaba-result-context-{}", rand::rng().random::<u64>()));
        write_completed_recommendation_contexts(&conn, &dir).unwrap();
        let path = dir.join("codex-tasks/SB-RESULT-1.result.context.json");
        let raw = fs::read_to_string(&path).unwrap();
        let value: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(value["kind"], "recommendationResult");
        assert_eq!(value["items"][0]["attemptId"], attempt_id);
        assert_eq!(value["items"][0]["durationSeconds"], 72);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn source_options_deserialize_and_frontend_uses_camel_case() {
        let options: Vec<OptionItem> =
            serde_json::from_str(r#"[{"id":"opt-a","label":"A","content_md":"$x=1$"}]"#).unwrap();
        assert_eq!(options[0].content_md, "$x=1$");
        let serialized = serde_json::to_value(&options).unwrap();
        assert_eq!(serialized[0]["contentMd"], "$x=1$");
    }

    #[test]
    fn pressure_session_keeps_durations_without_screen_answers() {
        let conn = Connection::open_in_memory().unwrap();
        init_supplemental_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO pressure_sessions(session_id,question_ids,start_time,status,task_id,created_at) VALUES('p-1','[155,160]',1,'awaiting_codex','SB-BATCH-1',1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO pressure_answers(session_id,question_id,user_answer,duration,submit_time) VALUES('p-1',155,'',42,2)",
            [],
        )
        .unwrap();

        let answers = pressure_answers_for_session(&conn, "p-1").unwrap();
        assert_eq!(answers.len(), 1);
        assert_eq!(answers[0]["questionId"], 155);
        assert_eq!(answers[0]["duration"], 42);
        assert_eq!(answers[0]["userAnswer"], "");
    }

    #[test]
    fn batch_attempt_duration_is_serialized_for_codex_round_trip() {
        let attempt = BatchAttempt {
            question_id: 155,
            result: "correct".into(),
            self_rating: 3,
            duration_seconds: 87,
            summary: "完成".into(),
            verdict: Some("correct".into()),
            earliest_error: None,
            error_tags: vec![],
            weakness_tags: vec![],
            advice: None,
            better_solution: None,
            confidence: 0.9,
            ..Default::default()
        };
        let value = serde_json::to_value(attempt).unwrap();
        assert_eq!(value["durationSeconds"], 87);
    }

    #[test]
    fn chapter_and_review_queues_skip_questions_answered_today() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO categories(id,parent_id,name,path,root_name,depth,sort_key,math1) VALUES(1,NULL,'一元微分','高等数学 / 一元微分','高等数学',1,1,1)",
            [],
        )
        .unwrap();
        insert_test_question(&conn, 1, "高等数学 / 一元微分 / 导数");
        insert_test_question(&conn, 2, "高等数学 / 一元微分 / 导数");
        for question_id in [1, 2] {
            conn.execute(
                "INSERT INTO question_categories(question_id,category_id) VALUES(?1,1)",
                [question_id],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO progress(question_id,next_review) VALUES(?1,?2)",
                params![question_id, Local::now().date_naive().to_string()],
            )
            .unwrap();
        }
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(1,?1,0,'correct',3,'paper')",
            [Local::now().to_rfc3339()],
        )
        .unwrap();

        assert_eq!(
            chapter_queue(&conn, 1, 10)
                .unwrap()
                .iter()
                .map(|item| item.question.id)
                .collect::<Vec<_>>(),
            vec![2]
        );
        assert_eq!(
            review_queue(&conn, 10)
                .unwrap()
                .iter()
                .map(|item| item.question.id)
                .collect::<Vec<_>>(),
            vec![2]
        );
    }

    #[test]
    fn review_history_only_includes_review_attempts_with_question_details() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 一元微分 / 导数");
        let now = Local::now().to_rfc3339();
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(1,?1,0,'wrong',2,'review')",
            [&now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(1,?1,0,'correct',4,'paper')",
            [&now],
        )
        .unwrap();

        let history = review_history(&conn).unwrap();
        let today = history.days.last().unwrap();
        assert_eq!(today.count, 1);
        assert_eq!(today.correct_count, 0);
        assert_eq!(history.items.len(), 1);
        assert_eq!(history.items[0].question_id, 1);
        assert_eq!(history.items[0].stem, "测试题");
    }

    #[test]
    fn review_plan_shows_the_next_seven_days_and_excludes_completed_due_items() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        for id in 1..=3 {
            insert_test_question(&conn, id, "高等数学 / 一元微分 / 导数");
        }
        let today = Local::now().date_naive();
        conn.execute(
            "INSERT INTO progress(question_id,mastery,next_review) VALUES(1,1,?1),(2,2,?2),(3,1,?3)",
            params![
                (today + Duration::days(1)).to_string(),
                (today + Duration::days(3)).to_string(),
                today.to_string(),
            ],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(3,?1,0,'correct',3,'review')",
            [Local::now().to_rfc3339()],
        )
        .unwrap();

        let plan = review_plan(&conn).unwrap();
        assert_eq!(plan.days[0].count, 0);
        assert_eq!(plan.days[1].count, 1);
        assert_eq!(plan.days[3].count, 1);
        assert_eq!(plan.items.len(), 2);
        assert_eq!(plan.items[0].scheduled_date, plan.days[1].date);
        assert_eq!(plan.items[1].scheduled_date, plan.days[3].date);
    }

    #[test]
    fn review_plan_keeps_future_questions_attempted_today() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 一元微分 / 导数");
        let today = Local::now().date_naive();
        conn.execute(
            "INSERT INTO progress(question_id,mastery,next_review) VALUES(1,2,?1)",
            [(today + Duration::days(3)).to_string()],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(1,?1,0,'wrong',2,'paper-codex')",
            [Local::now().to_rfc3339()],
        )
        .unwrap();

        let plan = review_plan(&conn).unwrap();
        assert_eq!(plan.days[3].count, 1);
        assert_eq!(plan.items.len(), 1);
        assert_eq!(plan.items[0].question_id, 1);
        assert_eq!(plan.items[0].scheduled_date, plan.days[3].date);
    }

    #[test]
    fn confirmed_diagnoses_prioritize_the_matching_math_section() {
        assert_eq!(
            diagnosis_match_score(
                "高等数学 / 一元微分 / 导数计算 / 复合函数",
                "高等数学 / 一元微分 / 导数计算 / 链式法则",
            ),
            21.0
        );
        assert_eq!(
            diagnosis_match_score("高等数学 / 一元微分", "线性代数 / 矩阵"),
            0.0
        );
    }

    #[test]
    fn imports_real_math_one_library_without_mutating_source() {
        let library = PathBuf::from(DEFAULT_LIBRARY);
        assert!(library.join("all_questions_20260813.json").exists());
        let before = fs::metadata(library.join("all_questions_20260813.json"))
            .unwrap()
            .modified()
            .unwrap();
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        let count = import_library(&mut conn, &library).unwrap();
        assert_eq!(count, 5_388);
        let image_refs: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM questions WHERE image_paths_json!='[]'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(image_refs > 0);
        let after = fs::metadata(library.join("all_questions_20260813.json"))
            .unwrap()
            .modified()
            .unwrap();
        assert_eq!(before, after);
    }

    #[test]
    fn received_recommendation_stays_pending_until_started() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();
        insert_codex_payload(
            &conn,
            &make_recommendation_payload("SB-REC-PENDING", vec![155]),
        )
        .unwrap();
        let batch = recommendation_batch_by_task(&conn, "SB-REC-PENDING")
            .unwrap()
            .unwrap();
        assert_eq!(batch.status, "pending");
        let queue = recommendations(&conn, 5).unwrap();
        assert!(queue.iter().all(|item| item.reason_code != "codex"));
    }

    fn make_recommendation_payload(task_id: &str, ids: Vec<i64>) -> CodexPayload {
        CodexPayload {
            schema_version: 1,
            kind: "recommendation".into(),
            task_id: task_id.into(),
            question_id: None,
            summary: "测试推荐".into(),
            verdict: None,
            earliest_error: None,
            error_tags: vec![],
            weakness_tags: vec![],
            advice: None,
            better_solution: None,
            confidence: 0.9,
            recommended_question_ids: ids,
            recommendation_reason: Some("测试推荐理由".into()),
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![],
            ..Default::default()
        }
    }

    #[test]
    fn recommendation_v2_rejects_metadata_outside_selected_questions() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        let mut payload = make_recommendation_payload("SB-REC-V2-INVALID", vec![1]);
        payload.schema_version = 2;
        payload.recommendation_order = vec![1];
        payload.question_roles.insert("2".into(), "transfer".into());
        assert!(insert_codex_payload(&conn, &payload).is_err());
    }

    #[test]
    fn recommendation_v2_preserves_ai_order() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        insert_test_question(&conn, 2, "高等数学 / 测试");
        let mut payload = make_recommendation_payload("SB-REC-V2-ORDER", vec![1, 2]);
        payload.schema_version = 2;
        payload.recommendation_order = vec![2, 1];
        insert_codex_payload(&conn, &payload).unwrap();
        start_recommendation_batch_row(&conn, "SB-REC-V2-ORDER").unwrap();
        let queue = recommendations(&conn, 5).unwrap();
        assert_eq!(queue.iter().map(|item| item.question.id).collect::<Vec<_>>(), vec![2, 1]);
    }

    #[test]
    fn backfill_restores_missing_item_roles_from_inbox_payload() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        insert_test_question(&conn, 2, "高等数学 / 测试");
        let mut payload = make_recommendation_payload("SB-REC-ROLE", vec![1, 2]);
        payload
            .question_roles
            .insert("1".into(), "diagnosis".into());
        insert_codex_payload(&conn, &payload).unwrap();
        // 正常路径：创建时即写入 role
        let role: Option<String> = conn
            .query_row(
                "SELECT role FROM recommendation_batch_items WHERE task_id='SB-REC-ROLE' AND question_id=1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(role.as_deref(), Some("diagnosis"));
        // 模拟旧版遗留数据：role 列为空 → 回填后恢复
        conn.execute("UPDATE recommendation_batch_items SET role=NULL", [])
            .unwrap();
        backfill_recommendation_item_roles(&conn).unwrap();
        let restored: Option<String> = conn
            .query_row(
                "SELECT role FROM recommendation_batch_items WHERE task_id='SB-REC-ROLE' AND question_id=1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(restored.as_deref(), Some("diagnosis"));
    }

    #[test]
    fn started_recommendation_preserves_order_and_leads_queue() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();
        insert_codex_payload(
            &conn,
            &make_recommendation_payload("SB-REC-START", vec![155, 160]),
        )
        .unwrap();
        start_recommendation_batch_row(&conn, "SB-REC-START").unwrap();
        let queue = recommendations(&conn, 5).unwrap();
        assert_eq!(
            queue
                .iter()
                .map(|item| item.question.id)
                .collect::<Vec<_>>(),
            vec![155, 160]
        );
        assert!(queue.iter().all(|item| item.reason_code == "codex"));
    }

    #[test]
    fn active_recommendation_returns_every_remaining_item() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();
        let ids = (129..=158).collect::<Vec<_>>();
        insert_codex_payload(
            &conn,
            &make_recommendation_payload("SB-REC-ALL-30", ids.clone()),
        )
        .unwrap();
        start_recommendation_batch_row(&conn, "SB-REC-ALL-30").unwrap();

        let queue = recommendations(&conn, 12).unwrap();
        assert_eq!(queue.len(), 30);
        assert_eq!(
            queue
                .iter()
                .map(|item| item.question.id)
                .collect::<Vec<_>>(),
            ids
        );
    }

    #[test]
    fn completed_recommendation_item_advances_and_finishes_batch() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();
        insert_codex_payload(
            &conn,
            &make_recommendation_payload("SB-REC-COMPLETE", vec![155, 160]),
        )
        .unwrap();
        start_recommendation_batch_row(&conn, "SB-REC-COMPLETE").unwrap();
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 155,
                duration_seconds: 60,
                result: "correct".into(),
                self_rating: 3,
                selected_answer: None,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let batch = recommendation_batch_by_task(&conn, "SB-REC-COMPLETE")
            .unwrap()
            .unwrap();
        assert_eq!(batch.completed_count, 1);
        assert_eq!(batch.remaining_count, 1);
        let queue = recommendations(&conn, 5).unwrap();
        assert_eq!(
            queue
                .iter()
                .map(|item| item.question.id)
                .collect::<Vec<_>>(),
            vec![160]
        );
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 160,
                duration_seconds: 60,
                result: "correct".into(),
                self_rating: 3,
                selected_answer: None,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let batch = recommendation_batch_by_task(&conn, "SB-REC-COMPLETE")
            .unwrap()
            .unwrap();
        assert_eq!(batch.status, "completed");
        assert_eq!(batch.remaining_count, 0);
    }

    #[test]
    fn nonpressure_batch_confirms_and_advances_active_recommendation_queue() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();
        insert_codex_payload(
            &conn,
            &make_recommendation_payload("SB-REC-NONPRESSURE", vec![155, 160]),
        )
        .unwrap();
        start_recommendation_batch_row(&conn, "SB-REC-NONPRESSURE").unwrap();

        let batch_payload = CodexPayload {
            schema_version: 1,
            kind: "batch".into(),
            task_id: "SB-BATCH-AUTO-QUEUE".into(),
            question_id: None,
            summary: "整组批改".into(),
            verdict: None,
            earliest_error: None,
            error_tags: vec![],
            weakness_tags: vec![],
            advice: None,
            better_solution: None,
            confidence: 0.9,
            recommended_question_ids: vec![],
            recommendation_reason: None,
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![
                BatchAttempt {
                    question_id: 155,
                    result: "correct".into(),
                    self_rating: 3,
                    duration_seconds: 120,
                    summary: "解答正确".into(),
                    verdict: Some("correct".into()),
                    earliest_error: None,
                    error_tags: vec![],
                    weakness_tags: vec![],
                    advice: None,
                    better_solution: None,
                    confidence: 0.95,
                    ..Default::default()
                },
                BatchAttempt {
                    question_id: 160,
                    result: "wrong".into(),
                    self_rating: 2,
                    duration_seconds: 180,
                    summary: "断点在第3步".into(),
                    verdict: Some("partial".into()),
                    earliest_error: Some("第3步通分错".into()),
                    error_tags: vec!["计算笔误".into()],
                    weakness_tags: vec![],
                    advice: None,
                    better_solution: None,
                    confidence: 0.9,
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        apply_batch_payload(
            &conn,
            &batch_payload,
            None,
            BatchApplicationMode::BoundNonPressureAdjudication,
        )
        .unwrap();

        // 验证两道题的作答记录均已建立
        let attempts_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM attempts WHERE session_id='SB-BATCH-AUTO-QUEUE'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(attempts_count, 2);

        // 验证推荐题组已全部完成，队列自动推进收尾
        let batch = recommendation_batch_by_task(&conn, "SB-REC-NONPRESSURE")
            .unwrap()
            .unwrap();
        assert_eq!(batch.status, "completed");
        assert_eq!(batch.remaining_count, 0);
    }

    #[test]
    fn dismissed_recommendation_never_enters_queue() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();
        insert_codex_payload(
            &conn,
            &make_recommendation_payload("SB-REC-DISMISS", vec![155, 160]),
        )
        .unwrap();
        dismiss_recommendation_batch_row(&conn, "SB-REC-DISMISS").unwrap();
        let batch = recommendation_batch_by_task(&conn, "SB-REC-DISMISS")
            .unwrap()
            .unwrap();
        assert_eq!(batch.status, "dismissed");
        let queue = recommendations(&conn, 5).unwrap();
        assert!(queue.iter().all(|item| item.reason_code != "codex"));
    }

    #[test]
    fn self_rating_maps_to_expected_review_interval() {
        let base = Local::now().date_naive();
        let intervals = [(1, 1), (2, 3), (3, 7), (4, 15)];
        for (rating, days) in intervals {
            let calculated = base
                + Duration::days(match rating {
                    1 => 1,
                    2 => 3,
                    3 => 7,
                    _ => 15,
                });
            assert_eq!(calculated, base + Duration::days(days));
        }
    }

    #[test]
    fn review_intervals_are_configurable_and_clamped() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        assert_eq!(review_intervals(&conn), [1, 3, 7, 15]);
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES('review_interval_1','2'),('review_interval_2','4'),('review_interval_3','0'),('review_interval_4','999')",
            [],
        )
        .unwrap();
        assert_eq!(review_intervals(&conn), [2, 4, 1, 180]);
        let input = AttemptInput {
            question_id: 1,
            duration_seconds: 0,
            result: "correct".into(),
            self_rating: 1,
            selected_answer: None,
            mode: None,
            ..Default::default()
        };
        let insert_result = record_attempt_row(&conn, &input);
        assert!(
            insert_result.is_err(),
            "question 1 不存在的题库外记录应报错或落到外键约束"
        );
    }

    #[test]
    fn elo_settles_per_attempt_like_a_cs_match() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(1,'题','[]','A','解析','测试','single_choice','路径','[]',0,2,'')",
            [],
        )
        .unwrap();
        let (settlements, current) = current_elo(&conn).unwrap();
        assert_eq!((settlements, current), (0, ELO_START));

        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 120,
                result: "correct".into(),
                self_rating: 4,
                mode: Some("paper".into()),
                ai_rating: Some(1.6),
                ..Default::default()
            },
        )
        .unwrap();
        // calibration K=30，掌握度 2 期望 0.50 → +30*(1.6/2 - 0.50) = +9.0
        let (settlements, current) = current_elo(&conn).unwrap();
        assert_eq!(settlements, 1);
        assert_eq!(current, ELO_START + 9.0);

        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 300,
                result: "wrong".into(),
                self_rating: 2,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let (settlements, after_wrong) = current_elo(&conn).unwrap();
        assert_eq!(settlements, 2);
        // 首次 +6 跨越 1401（C→C+）触发晋级保护，随后的失误不掉分
        assert_eq!(after_wrong, current, "晋级保护期内不掉分：{after_wrong}");

        // uncertain 作答不参与结算，正如中途退出不计成绩
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 60,
                result: "uncertain".into(),
                self_rating: 1,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let (settlements, _) = current_elo(&conn).unwrap();
        assert_eq!(settlements, 2);
    }

    #[test]
    fn elo_expectations_scale_with_difficulty_and_mastery() {
        let settle_once = |mastery: Option<i64>, dm: Option<f64>| -> f64 {
            let conn = Connection::open_in_memory().unwrap();
            init_schema(&conn).unwrap();
            conn.execute(
                "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(1,'题','[]','A','解析','测试','single_choice','路径','[]',0,2,'')",
                [],
            )
            .unwrap();
            if let Some(m) = mastery {
                conn.execute(
                    "INSERT INTO progress(question_id,mastery) VALUES(1,?1)",
                    [m],
                )
                .unwrap();
            }
            record_attempt_row(
                &conn,
                &AttemptInput {
                    question_id: 1,
                    duration_seconds: 120,
                    result: "correct".into(),
                    self_rating: 4,
                    mode: Some("paper".into()),
                    difficulty_multiplier: dm,
                    ..Default::default()
                },
            )
            .unwrap();
            current_elo(&conn).unwrap().1
        };
        // 薄弱章节(掌握度1) + 难题(难度1.10)：期望 0.21，收益最大
        let weak_hard = settle_once(Some(1), Some(1.10));
        // 已掌握章节(掌握度4) + 简单题(难度0.94)：期望 0.73，收益缩水
        let strong_easy = settle_once(Some(4), Some(0.94));
        assert!(
            weak_hard > strong_easy,
            "薄弱章节难题应比碾压简单题加分多：{weak_hard} vs {strong_easy}"
        );
    }

    #[test]
    fn elo_wrong_answer_always_costs_points() {
        // 回归测试：v1.6.7 及之前，实测 50 次做错中仍有 24 次（48%）在涨分，
        // ELO 退化为「做题就涨分」的单向棘轮。这里锁死「做错必扣分」的契约。
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(1,'题','[]','A','解析','测试','single_choice','路径','[]',0,2,'')",
            [],
        )
        .unwrap();
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 120,
                result: "wrong".into(),
                self_rating: 1,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let (_, after) = current_elo(&conn).unwrap();
        assert!(
            after < ELO_START,
            "做错必须扣分，否则 ELO 会退化成打卡计数器：{after}"
        );
        assert!(
            after <= ELO_START + ELO_WRONG_DELTA_FLOOR,
            "做错扣分不得低于闸门下限 {}：{after}",
            ELO_WRONG_DELTA_FLOOR
        );
    }

    #[test]
    fn elo_falls_under_repeated_failures() {
        // 直接针对单向棘轮的回归测试：连续做错 5 题，ELO 必须单调下跌。
        // 背景：v1.6.7 实测中，正确率从 75% 跌到 37.5% 的同一周，ELO 反而从
        // 1455 涨到 1612——分数与实际水平完全脱钩。
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(1,'题','[]','A','解析','测试','single_choice','路径','[]',0,2,'')",
            [],
        )
        .unwrap();
        let mut previous = ELO_START;
        for round in 1..=5 {
            record_attempt_row(
                &conn,
                &AttemptInput {
                    question_id: 1,
                    duration_seconds: 240,
                    result: "wrong".into(),
                    self_rating: 1,
                    mode: Some("paper".into()),
                    ..Default::default()
                },
            )
            .unwrap();
            let (_, current) = current_elo(&conn).unwrap();
            assert!(
                current < previous,
                "第 {round} 次做错后 ELO 必须继续下跌：{previous} -> {current}"
            );
            previous = current;
        }
        assert!(
            previous <= ELO_START - 5.0,
            "连续 5 次做错后累计跌幅应显著：{previous}"
        );
    }

    #[test]
    fn elo_difficulty_lever_is_material() {
        // 回归测试：原步长 0.25 在难度系数的真实区间（0.94~1.10）只产生 ±0.04 的
        // 期望变化，「攻克难题收益最大」的设计意图形同虚设。放大到 2.50 后，
        // 同样区间应产生数量级差距。
        let settle_with_difficulty = |dm: f64| -> f64 {
            let conn = Connection::open_in_memory().unwrap();
            init_schema(&conn).unwrap();
            conn.execute(
                "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(1,'题','[]','A','解析','测试','single_choice','路径','[]',0,2,'')",
                [],
            )
            .unwrap();
            record_attempt_row(
                &conn,
                &AttemptInput {
                    question_id: 1,
                    duration_seconds: 120,
                    result: "correct".into(),
                    self_rating: 4,
                    mode: Some("paper".into()),
                    difficulty_multiplier: Some(dm),
                    ..Default::default()
                },
            )
            .unwrap();
            current_elo(&conn).unwrap().1
        };
        let hard = settle_with_difficulty(1.10);
        let easy = settle_with_difficulty(0.94);
        let spread = hard - easy;
        assert!(
            spread > 3.0,
            "难度杠杆必须产生实质收益差距（原实现下仅约 0.5 分）：难题 {hard} vs 易题 {easy}，差 {spread}"
        );
    }

    #[test]
    fn adaptive_anchor_falls_back_until_enough_samples() {
        // 定级期样本不足时行为必须与固定基线完全一致，保证冷启动不变
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        assert_eq!(
            adaptive_anchor(&conn).unwrap(),
            ELO_EXPECTED_BASE,
            "无任何结算时应退回固定基线"
        );
        for _ in 0..(ELO_ANCHOR_MIN_SAMPLES - 1) {
            conn.execute(
                "INSERT INTO elo_events(question_id,delta,rating_after,performance,expected,created_at,reason) VALUES(1,1,1401,1.6,0.5,'2026-08-29T10:00:00+08:00','match')",
                [],
            )
            .unwrap();
        }
        assert_eq!(
            adaptive_anchor(&conn).unwrap(),
            ELO_EXPECTED_BASE,
            "样本不足 {} 时应退回固定基线",
            ELO_ANCHOR_MIN_SAMPLES
        );
    }

    #[test]
    fn adaptive_anchor_uses_median_blended_with_fixed_base() {
        // 锚点 = 70% 近期中位数 + 30% 固定基线。固定基线的存在是为了防止
        // 锚点自身跟着分布漂走（否则长期退步的人感觉不到退步）。
        let anchor_after = |perf: f64| -> f64 {
            let conn = Connection::open_in_memory().unwrap();
            init_schema(&conn).unwrap();
            for _ in 0..ELO_ANCHOR_MIN_SAMPLES {
                conn.execute(
                    "INSERT INTO elo_events(question_id,delta,rating_after,performance,expected,created_at,reason) VALUES(1,1,1401,?1,0.5,'2026-08-29T10:00:00+08:00','match')",
                    [perf],
                )
                .unwrap();
            }
            adaptive_anchor(&conn).unwrap()
        };
        let at_par = anchor_after(1.0);
        let strong = anchor_after(2.0);
        assert!(
            (at_par - ELO_EXPECTED_BASE).abs() < 1e-9,
            "performance 1.0 的中位数即 0.50，锚点应等于固定基线：{at_par}"
        );
        assert!(
            (strong - 0.85).abs() < 1e-9,
            "performance 2.0 → 中位数 1.0，混合后应为 0.7×1.0 + 0.3×0.5 = 0.85，实际 {strong}"
        );
    }

    #[test]
    fn adaptive_anchor_reduces_gains_when_own_level_is_high() {
        // 核心契约：同样的表现分，在自身水平已经提高之后应该涨得更少（甚至转负）。
        // 固定 0.50 基线做不到这一点，分数会随练习量无限膨胀——这正是自适应锚点
        // 要解决的问题（回放：正确率崩塌期，固定基线仍 +14 分，自适应 −10 分）。
        //
        // 用 partial 而非 correct：correct 会被结果闸门抬到至少 +0.5，会掩盖锚点本身的效果。
        let settle_after_history = |prior_perf: f64| -> f64 {
            let conn = Connection::open_in_memory().unwrap();
            init_schema(&conn).unwrap();
            conn.execute(
                "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(1,'题','[]','A','解析','测试','single_choice','高等数学 / 章节','[]',0,2,'')",
                [],
            )
            .unwrap();
            // 两组都播种同样条数的历史，使 K 值一致，唯一变量是锚点高低
            for _ in 0..ELO_ANCHOR_MIN_SAMPLES {
                conn.execute(
                    "INSERT INTO elo_events(question_id,delta,rating_after,performance,expected,created_at,reason) VALUES(1,1,1500,?1,0.5,'2026-08-29T10:00:00+08:00','match')",
                    [prior_perf],
                )
                .unwrap();
            }
            let before = current_elo(&conn).unwrap().1;
            record_attempt_row(
                &conn,
                &AttemptInput {
                    question_id: 1,
                    duration_seconds: 120,
                    result: "partial".into(),
                    self_rating: 3,
                    mode: Some("paper".into()),
                    ai_rating: Some(1.4),
                    ..Default::default()
                },
            )
            .unwrap();
            current_elo(&conn).unwrap().1 - before
        };

        let after_weak = settle_after_history(0.8);
        let after_strong = settle_after_history(1.8);
        assert!(
            after_strong < after_weak,
            "自身水平更高时，同样的表现分应涨得更少：弱历史 {after_weak:+} vs 强历史 {after_strong:+}"
        );
    }

    #[test]
    fn recommendations_prioritize_undercovered_subjects() {
        // 回归测试：概率统计在考研数一中占约 22% 分值，但实测 317 道概率题一道未练，
        // 而 v1.6.7 的打分函数完全没有科目维度，新题靠 ORDER BY RANDOM() 抽取，
        // 结构性失衡会被不断固化。这里构造「高数已练、概率空白」的场景，
        // 断言队列会主动补齐薄弱科目。
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        let mut id = 1_i64;
        for subject in ["高等数学", "概率统计"] {
            for _ in 0..20 {
                conn.execute(
                    "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(?1,'题','[]','A','解析','测试','single_choice',?2,'[]',0,2,'')",
                    params![id, format!("{subject} / 章节")],
                )
                .unwrap();
                id += 1;
            }
        }
        // 高数 20 题已做对且排到未来复习；概率 20 题零作答
        let yesterday = (Local::now() - Duration::days(1)).to_rfc3339();
        for qid in 1_i64..=20 {
            conn.execute(
                "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(?1,?2,120,'correct',4,'paper')",
                params![qid, yesterday],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO progress(question_id,mastery,next_review) VALUES(?1,4,date('now','+15 days'))",
                [qid],
            )
            .unwrap();
        }

        let queue = recommendations(&conn, 10).unwrap();
        let probability_count = queue
            .iter()
            .filter(|item| item.question.category_path.starts_with("概率统计"))
            .count();
        assert_eq!(queue.len(), 10, "队列应被填满");
        assert!(
            probability_count >= 8,
            "概率统计零覆盖时应优先补齐，实际仅 {probability_count}/10；\
             理由分布：{:?}",
            queue
                .iter()
                .map(|item| item.reason_code.as_str())
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn subject_gap_converges_as_coverage_grows() {
        // 缺口是自平衡的：随着薄弱科目被覆盖，其权重应自动回落，
        // 避免「补一科就永远只出这一科」。
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(1,'题','[]','A','解析','测试','single_choice','概率统计 / 章节','[]',0,2,'')",
            [],
        )
        .unwrap();
        let gap_before = subject_gap_scores(&conn).unwrap();
        assert!(
            gap_before.get("概率统计").copied().unwrap_or(0.0) > 0.2,
            "零覆盖时概率缺口应接近其分值占比 0.22"
        );

        // 1 号题已是概率统计，再补 2、3 号，使概率共 3 题
        for qid in 2_i64..=3 {
            conn.execute(
                "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(?1,'题','[]','A','解析','测试','single_choice','概率统计 / 章节','[]',0,2,'')",
                [qid],
            )
            .unwrap();
        }
        // 4~10 号为高等数学，共 7 题
        for qid in 4_i64..=10 {
            conn.execute(
                "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(?1,'题','[]','A','解析','测试','single_choice','高等数学 / 章节','[]',0,2,'')",
                [qid],
            )
            .unwrap();
        }
        // 合计 10 次作答：概率 3 次（30%）+ 高数 7 次（70%）
        for qid in 1_i64..=10 {
            conn.execute(
                "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(?1,'2026-01-01T10:00:00+08:00',120,'correct',4,'paper')",
                [qid],
            )
            .unwrap();
        }
        let gap_after = subject_gap_scores(&conn).unwrap();
        assert!(
            gap_after.get("概率统计").copied().unwrap_or(1.0) == 0.0,
            "概率占比 30% 已超过其 22% 的分值占比，缺口应收敛为 0（只奖励缺口、不惩罚超额）"
        );
        assert!(
            gap_after.get("高等数学").copied().unwrap_or(1.0) == 0.0,
            "高数占比 70% 已超过其 56% 的分值占比，缺口同样应为 0"
        );
    }

    #[test]
    fn codex_batch_report_is_readable_without_pressure_session() {
        // 回归测试：日常（非压力模拟）的整组批改只落在 codex_inbox，不产生
        // pressure session。v1.6.9 之前 App 只有 get_pressure_grading_report
        // 一条读取路径，这些报告生成了却永远打不开。
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        for (id, answer) in [(1_i64, "B"), (2_i64, "C")] {
            conn.execute(
                "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(?1,'题','[]',?2,'解析','测试','single_choice','高等数学 / 章节','[]',0,2,'')",
                params![id, answer],
            )
            .unwrap();
        }
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode,selected_answer) VALUES(1,'2026-08-29T10:00:00+08:00',120,'correct',4,'paper','B')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode,selected_answer) VALUES(2,'2026-08-29T10:05:00+08:00',300,'wrong',2,'paper','A')",
            [],
        )
        .unwrap();

        let payload = json!({
            "schemaVersion": 1,
            "kind": "batch",
            "taskId": "SB-BATCH-20260829-0001",
            "summary": "整组总评：第 2 题在变限积分处出错",
            "errorTags": ["瞄准失误"],
            "weaknessTags": ["变限积分求导"],
            "confidence": 0.95,
            "recommendedQuestionIds": [],
            "batchAttempts": [
                {
                    "questionId": 1, "result": "correct", "selfRating": 4,
                    "durationSeconds": 120, "summary": "思路正确",
                    "verdict": "correct", "earliestError": null,
                    "errorTags": [], "weaknessTags": [],
                    "advice": null, "betterSolution": null,
                    "confidence": 0.95, "rating": 1.3, "ratingTier": "A"
                },
                {
                    "questionId": 2, "result": "wrong", "selfRating": 2,
                    "durationSeconds": 300, "summary": "变限积分求导漏项",
                    "verdict": "partial", "earliestError": "第 3 行漏掉上限求导",
                    "errorTags": ["瞄准失误"], "weaknessTags": ["变限积分求导"],
                    "advice": "补练变限积分", "betterSolution": "莱布尼茨公式",
                    "confidence": 0.9, "rating": 0.8, "ratingTier": "C"
                }
            ]
        });
        conn.execute(
            "INSERT INTO codex_inbox(task_id,kind,payload_json,status,created_at) VALUES('SB-BATCH-20260829-0001','batch',?1,'confirmed','2026-08-29T14:00:00+08:00')",
            [payload.to_string()],
        )
        .unwrap();

        let report = build_codex_batch_report(
            &conn,
            "SB-BATCH-20260829-0001",
            &payload,
            "confirmed",
            "2026-08-29T14:00:00+08:00",
        );

        assert_eq!(report["status"], "graded");
        assert_eq!(report["sourceTaskId"], "SB-BATCH-20260829-0001");
        let grades = report["grades"].as_array().unwrap();
        assert_eq!(grades.len(), 2, "两道批改都应进入报告");
        // batch 回传载荷不含标准答案与用户作答，应从库里补齐
        assert_eq!(grades[0]["correctAnswer"], "B");
        assert_eq!(grades[1]["correctAnswer"], "C");
        assert_eq!(grades[0]["userAnswer"], "B");
        assert_eq!(grades[0]["correct"], true);
        assert_eq!(grades[1]["correct"], false);
        // 逐题诊断要落到报告能渲染的字段上
        assert_eq!(grades[1]["feedback"], "变限积分求导漏项");
        assert_eq!(grades[1]["earliestError"], "第 3 行漏掉上限求导");
        assert_eq!(grades[1]["advice"], "补练变限积分");

        let summary = &report["summary"];
        assert_eq!(summary["totalCount"], 2);
        assert_eq!(summary["correctCount"], 1);
        assert_eq!(summary["partialCount"], 1);
        assert_eq!(summary["accuracy"], 50);
        assert_eq!(summary["totalDuration"], 420);
        assert_eq!(summary["averageDuration"], 210);
        // 整组文字总评必须落到 suggestions，否则报告正文一片空白
        assert_eq!(
            summary["suggestions"][0], "整组总评：第 2 题在变限积分处出错",
            "整组 summary 必须进 suggestions，否则报告无正文可读"
        );
        assert_eq!(summary["weaknesses"][0], "变限积分求导");
        assert!(
            report["createdAt"].as_i64().unwrap() > 0,
            "createdAt 应为毫秒时间戳而非原始字符串"
        );
    }

    #[test]
    fn elo_promotion_protection_blocks_first_losses() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(1,'题','[]','A','解析','测试','single_choice','路径','[]',0,2,'')",
            [],
        )
        .unwrap();
        // 预置 11 次结算（脱离定级期，K=10），分数贴着 1601 晋级线
        for _ in 0..11 {
            conn.execute(
                "INSERT INTO elo_events(question_id,delta,rating_after,performance,expected,created_at) VALUES(1,1,1599,1.0,0.6,'2026-08-20T10:00:00+08:00')",
                [],
            )
            .unwrap();
        }
        // 做对 → 跨越 10500 晋级，保护计数置 3
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 120,
                result: "correct".into(),
                self_rating: 4,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let promoted = current_elo(&conn).unwrap().1;
        assert!(promoted >= 1601.0, "应跨越晋级线：{promoted}");
        // 随后做错 → 晋级保护生效，不掉分
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 300,
                result: "wrong".into(),
                self_rating: 2,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let after_loss = current_elo(&conn).unwrap().1;
        assert_eq!(after_loss, promoted, "晋级保护期内不应掉分");
    }

    #[test]
    fn undo_last_attempt_restores_progress() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 一元微分 / 导数");
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 30,
                result: "correct".into(),
                self_rating: 4,
                selected_answer: None,
                mode: None,
                ..Default::default()
            },
        )
        .unwrap();
        let progress: (Option<i32>, String) = conn
            .query_row(
                "SELECT mastery,next_review FROM progress WHERE question_id=1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(progress.0, Some(4));
        undo_last_attempt_row(&conn, 1).unwrap();
        let remaining: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM attempts WHERE question_id=1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 0);
        let favorite: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM progress WHERE question_id=1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(favorite, 0);
    }

    #[test]
    fn batch_payload_applies_only_uploaded_handwritten_attempts() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();
        let payload = CodexPayload {
            schema_version: 1,
            kind: "batch".into(),
            task_id: "SB-BATCH-TEST".into(),
            question_id: None,
            summary: "只回传了部分草稿".into(),
            verdict: None,
            earliest_error: None,
            error_tags: vec![],
            weakness_tags: vec![],
            advice: None,
            better_solution: None,
            confidence: 0.9,
            recommended_question_ids: vec![],
            recommendation_reason: None,
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![
                BatchAttempt {
                    question_id: 155,
                    duration_seconds: 45,
                    result: "wrong".into(),
                    self_rating: 2,
                    summary: "逆矩阵恒等式用反了".into(),
                    verdict: Some("incorrect".into()),
                    earliest_error: Some("写了 A^2A=E 的一步".into()),
                    error_tags: vec!["符号计算".into()],
                    weakness_tags: vec!["幂零矩阵".into()],
                    advice: Some("重做一遍 E-A 可逆性的证明".into()),
                    better_solution: None,
                    confidence: 0.88,
                    ..Default::default()
                },
                BatchAttempt {
                    question_id: 160,
                    duration_seconds: 30,
                    result: "uncertain".into(),
                    self_rating: 2,
                    summary: "草稿未上传，无法批改".into(),
                    verdict: Some("uncertain".into()),
                    earliest_error: None,
                    error_tags: vec![],
                    weakness_tags: vec![],
                    advice: None,
                    better_solution: None,
                    confidence: 0.0,
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        insert_codex_payload(&conn, &payload).unwrap();
        apply_batch_payload(
            &conn,
            &payload,
            None,
            BatchApplicationMode::BoundNonPressureAdjudication,
        )
        .unwrap();
        let attempts: Vec<(i64, String, String)> = conn
            .prepare("SELECT question_id,result,mode FROM attempts")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        // 明确给出作答结果的题自动沉淀为 paper-codex 作答；未上传草稿（uncertain）的题不建 attempt。
        assert_eq!(attempts, vec![(155, "wrong".into(), "paper-codex".into())]);
        let signals: Vec<(String, i64)> = conn
            .prepare("SELECT task_id,question_id FROM codex_analysis_signals")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(signals.len(), 2);
        assert!(signals.contains(&("SB-BATCH-TEST-155".into(), 155)));
        assert!(signals.contains(&("SB-BATCH-TEST-160".into(), 160)));
        let uncertain_progress: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM progress WHERE question_id=160",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(uncertain_progress, 0);
    }

    #[test]
    fn batch_payload_persists_real_durations_and_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学");
        insert_test_question(&conn, 2, "线性代数");
        let payload = CodexPayload {
            schema_version: 1,
            kind: "batch".into(),
            task_id: "SB-BATCH-DURATION".into(),
            question_id: None,
            summary: "耗时测试".into(),
            verdict: None,
            earliest_error: None,
            error_tags: vec![],
            weakness_tags: vec![],
            advice: None,
            better_solution: None,
            confidence: 0.9,
            recommended_question_ids: vec![],
            recommendation_reason: None,
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![
                BatchAttempt {
                    question_id: 1,
                    result: "correct".into(),
                    self_rating: 3,
                    duration_seconds: 87,
                    summary: "正确".into(),
                    verdict: Some("correct".into()),
                    earliest_error: None,
                    error_tags: vec![],
                    weakness_tags: vec![],
                    advice: None,
                    better_solution: Some("利用行列式展开的更简洁路线".into()),
                    confidence: 0.95,
                    ..Default::default()
                },
                BatchAttempt {
                    question_id: 2,
                    result: "wrong".into(),
                    self_rating: 2,
                    duration_seconds: 0,
                    summary: "计算错误".into(),
                    verdict: Some("incorrect".into()),
                    earliest_error: Some("第二步".into()),
                    error_tags: vec!["计算".into()],
                    weakness_tags: vec!["行列式".into()],
                    advice: Some("重算".into()),
                    better_solution: None,
                    confidence: 0.8,
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        let pressure_durations = HashMap::from([(2_i64, 54_i64)]);

        apply_batch_payload(
            &conn,
            &payload,
            Some(&pressure_durations),
            BatchApplicationMode::FormalPressureAttempt,
        )
        .unwrap();
        apply_batch_payload(
            &conn,
            &payload,
            Some(&pressure_durations),
            BatchApplicationMode::FormalPressureAttempt,
        )
        .unwrap();

        let attempts: Vec<(i64, i64)> = conn
            .prepare("SELECT question_id,duration_seconds FROM attempts ORDER BY question_id")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(attempts, vec![(1, 87), (2, 54)]);
        let markers: i64 = conn
            .query_row("SELECT COUNT(*) FROM codex_batch_applications", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(markers, 2);
        let signals: i64 = conn
            .query_row("SELECT COUNT(*) FROM codex_analysis_signals", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(signals, 2);
        let review_counts: i64 = conn
            .query_row("SELECT SUM(review_count) FROM progress", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(review_counts, 2);
    }

    #[test]
    fn pressure_batch_report_is_partial_and_keeps_uncertain_diagnosis() {
        let main = Connection::open_in_memory().unwrap();
        init_schema(&main).unwrap();
        insert_test_question(&main, 1, "高等数学");
        insert_test_question(&main, 2, "高等数学");
        insert_test_question(&main, 3, "高等数学");
        let supplemental = Connection::open_in_memory().unwrap();
        init_supplemental_schema(&supplemental).unwrap();
        supplemental
            .execute(
                "INSERT INTO pressure_sessions(session_id,question_ids,start_time,status,task_id,created_at) VALUES('p-report','[1,2,3]',1,'awaiting_codex','SB-BATCH-REPORT',1)",
                [],
            )
            .unwrap();
        for (question_id, duration) in [(1, 40), (2, 50), (3, 60)] {
            supplemental
                .execute(
                    "INSERT INTO pressure_answers(session_id,question_id,user_answer,duration,submit_time) VALUES('p-report',?1,'',?2,2)",
                    params![question_id, duration],
                )
                .unwrap();
        }
        let payload = CodexPayload {
            schema_version: 1,
            kind: "batch".into(),
            task_id: "SB-BATCH-REPORT".into(),
            question_id: None,
            summary: "部分批改".into(),
            verdict: None,
            earliest_error: None,
            error_tags: vec![],
            weakness_tags: vec![],
            advice: None,
            better_solution: None,
            confidence: 0.9,
            recommended_question_ids: vec![],
            recommendation_reason: None,
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![
                BatchAttempt {
                    question_id: 1,
                    result: "correct".into(),
                    self_rating: 4,
                    duration_seconds: 0,
                    summary: "方法正确".into(),
                    verdict: Some("correct".into()),
                    earliest_error: None,
                    error_tags: vec![],
                    weakness_tags: vec![],
                    advice: None,
                    better_solution: Some("利用行列式展开的更简洁路线".into()),
                    confidence: 0.96,
                    ..Default::default()
                },
                BatchAttempt {
                    question_id: 2,
                    result: "uncertain".into(),
                    self_rating: 2,
                    duration_seconds: 0,
                    summary: "草稿不完整".into(),
                    verdict: Some("uncertain".into()),
                    earliest_error: None,
                    error_tags: vec!["信息不足".into()],
                    weakness_tags: vec![],
                    advice: Some("补拍完整草稿".into()),
                    better_solution: None,
                    confidence: 0.2,
                    ..Default::default()
                },
            ],
            ..Default::default()
        };

        let context = match pressure_task_match(&supplemental, &payload.task_id).unwrap() {
            PressureTaskMatch::Current(context) => context,
            _ => panic!("expected current pressure task"),
        };
        apply_batch_payload(
            &main,
            &payload,
            Some(&context.durations),
            BatchApplicationMode::FormalPressureAttempt,
        )
        .unwrap();
        let status = save_pressure_batch_report(&supplemental, &context, &payload).unwrap();
        assert_eq!(status, "graded_partial");
        let report_json: String = supplemental
            .query_row(
                "SELECT report_json FROM pressure_reports WHERE session_id='p-report'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let report: serde_json::Value = serde_json::from_str(&report_json).unwrap();
        assert_eq!(
            report["grades"][0]["betterSolution"],
            "利用行列式展开的更简洁路线"
        );

        let stored_status: String = supplemental
            .query_row(
                "SELECT status FROM pressure_sessions WHERE session_id='p-report'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_status, "graded_partial");
        let report_raw: String = supplemental
            .query_row(
                "SELECT report_json FROM pressure_reports WHERE session_id='p-report'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let report: Value = serde_json::from_str(&report_raw).unwrap();
        assert_eq!(report["status"], "graded_partial");
        assert_eq!(report["ungradedQuestionIds"], json!([3]));
        assert_eq!(report["summary"]["uncertainCount"], 1);
        assert_eq!(report["summary"]["totalDuration"], 150);
        assert_eq!(report["grades"][0]["duration"], 40);
        assert_eq!(report["grades"][1]["duration"], 50);

        let attempts: i64 = main
            .query_row("SELECT COUNT(*) FROM attempts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(attempts, 1);
        let uncertain_attempts: i64 = main
            .query_row(
                "SELECT COUNT(*) FROM attempts WHERE question_id=2",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(uncertain_attempts, 0);
        let uncertain_signals: i64 = main
            .query_row(
                "SELECT COUNT(*) FROM codex_analysis_signals WHERE question_id=2",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(uncertain_signals, 1);
    }

    #[test]
    fn latest_attempt_duration_fallback_uses_attempted_at() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学");
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(1,'2026-08-20T10:00:00+08:00',73,'correct',3,'paper')",
            [],
        )
        .unwrap();
        assert_eq!(latest_attempt_duration(&conn, 1).unwrap(), Some(73));
        assert_eq!(latest_attempt_duration(&conn, 999).unwrap(), None);
    }

    #[test]
    fn pressure_task_retry_rejects_old_task_and_accepts_latest() {
        let supplemental = Connection::open_in_memory().unwrap();
        init_supplemental_schema(&supplemental).unwrap();
        supplemental
            .execute(
                "INSERT INTO pressure_sessions(session_id,question_ids,start_time,status,created_at) VALUES('p-retry','[1]',1,'awaiting_codex',1)",
                [],
            )
            .unwrap();
        attach_pressure_task_row(&supplemental, "p-retry", "SB-BATCH-OLD").unwrap();
        attach_pressure_task_row(&supplemental, "p-retry", "SB-BATCH-NEW").unwrap();

        match pressure_task_match(&supplemental, "SB-BATCH-OLD").unwrap() {
            PressureTaskMatch::Stale {
                session_id,
                current_task_id,
            } => {
                assert_eq!(session_id, "p-retry");
                assert_eq!(current_task_id.as_deref(), Some("SB-BATCH-NEW"));
            }
            _ => panic!("old task should be stale"),
        }
        assert!(matches!(
            pressure_task_match(&supplemental, "SB-BATCH-NEW").unwrap(),
            PressureTaskMatch::Current(_)
        ));
        assert!(attach_pressure_task_row(&supplemental, "missing", "SB-BATCH-X").is_err());
    }

    #[test]
    fn complete_pressure_batch_report_marks_session_graded() {
        let supplemental = Connection::open_in_memory().unwrap();
        init_supplemental_schema(&supplemental).unwrap();
        supplemental
            .execute(
                "INSERT INTO pressure_sessions(session_id,question_ids,start_time,status,task_id,created_at) VALUES('p-full','[1]',1,'awaiting_codex','SB-BATCH-FULL',1)",
                [],
            )
            .unwrap();
        supplemental
            .execute(
                "INSERT INTO pressure_answers(session_id,question_id,user_answer,duration,submit_time) VALUES('p-full',1,'',35,2)",
                [],
            )
            .unwrap();
        let payload = CodexPayload {
            schema_version: 1,
            kind: "batch".into(),
            task_id: "SB-BATCH-FULL".into(),
            question_id: None,
            summary: "完整批改".into(),
            verdict: None,
            earliest_error: None,
            error_tags: vec![],
            weakness_tags: vec![],
            advice: None,
            better_solution: None,
            confidence: 0.9,
            recommended_question_ids: vec![],
            recommendation_reason: None,
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![BatchAttempt {
                question_id: 1,
                result: "correct".into(),
                self_rating: 3,
                duration_seconds: 35,
                summary: "正确".into(),
                verdict: Some("correct".into()),
                earliest_error: None,
                error_tags: vec![],
                weakness_tags: vec![],
                advice: None,
                better_solution: None,
                confidence: 0.9,
                ..Default::default()
            }],
            ..Default::default()
        };
        let context = match pressure_task_match(&supplemental, &payload.task_id).unwrap() {
            PressureTaskMatch::Current(context) => context,
            _ => panic!("expected current pressure task"),
        };
        assert_eq!(
            save_pressure_batch_report(&supplemental, &context, &payload).unwrap(),
            "graded"
        );
        let status: String = supplemental
            .query_row(
                "SELECT status FROM pressure_sessions WHERE session_id='p-full'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "graded");
    }

    #[test]
    fn variant_queue_returns_matching_category_questions() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();
        let variants = variant_queue(&conn, 155, 3).unwrap();
        assert!(!variants.is_empty());
        for item in &variants {
            assert_ne!(item.question.id, 155);
            assert_eq!(item.reason_code, "variant_practice");
        }
    }

    #[test]
    fn undo_last_attempt_isolates_batch_rollback() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 一元微分 / 导数");

        // Create older completed batch with question 1
        conn.execute(
            "INSERT INTO recommendation_batches(task_id,title,summary,recommendation_reason,status,created_at,completed_at) VALUES('BATCH-1','旧批次','已完成摘要','测试','completed','2026-08-01T10:00:00+08:00','2026-08-01T11:00:00+08:00')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO recommendation_batch_items(task_id,question_id,position,completed_at) VALUES('BATCH-1',1,1,'2026-08-01T11:00:00+08:00')",
            [],
        ).unwrap();

        // Create current active batch with question 1
        conn.execute(
            "INSERT INTO recommendation_batches(task_id,title,summary,recommendation_reason,status,created_at,started_at) VALUES('BATCH-2','当前批次','当前摘要','测试','active','2026-08-18T10:00:00+08:00','2026-08-18T10:05:00+08:00')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO recommendation_batch_items(task_id,question_id,position) VALUES('BATCH-2',1,1)",
            [],
        ).unwrap();

        // Attempt question 1 today
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 30,
                result: "correct".into(),
                self_rating: 4,
                selected_answer: None,
                mode: None,
                ..Default::default()
            },
        )
        .unwrap();

        // BATCH-2 is now completed
        let b2_status: String = conn
            .query_row(
                "SELECT status FROM recommendation_batches WHERE task_id='BATCH-2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(b2_status, "completed");

        // Now undo today's attempt
        undo_last_attempt_row(&conn, 1).unwrap();

        // BATCH-1 should STILL be completed (not affected)
        let b1_status: String = conn
            .query_row(
                "SELECT status FROM recommendation_batches WHERE task_id='BATCH-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(b1_status, "completed");
        let b1_item_completed: Option<String> = conn.query_row("SELECT completed_at FROM recommendation_batch_items WHERE task_id='BATCH-1' AND question_id=1", [], |r| r.get(0)).unwrap();
        assert!(b1_item_completed.is_some());

        // BATCH-2 should be rolled back to active
        let b2_status_after: String = conn
            .query_row(
                "SELECT status FROM recommendation_batches WHERE task_id='BATCH-2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(b2_status_after, "active");
        let b2_item_completed: Option<String> = conn.query_row("SELECT completed_at FROM recommendation_batch_items WHERE task_id='BATCH-2' AND question_id=1", [], |r| r.get(0)).unwrap();
        assert!(b2_item_completed.is_none());
    }

    #[test]
    fn yesterday_wrong_question_variant_is_recommended() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();

        let yesterday = (Local::now().date_naive() - chrono::Duration::days(1)).to_string();
        conn.execute(
            "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,mode) VALUES(155,?1,45,'wrong',1,'paper')",
            [&yesterday],
        ).unwrap();

        let recs = recommendations(&conn, 10).unwrap();
        assert!(!recs.is_empty());
        let yesterday_wrong_item = recs.iter().find(|r| r.reason_code == "yesterday_wrong");
        assert!(
            yesterday_wrong_item.is_some(),
            "应在推荐列表中显式插入昨日错题同考点变式"
        );
    }

    #[test]
    fn srs_lapse_and_priority_sorting_work() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();

        // 1. Initial attempt with rating 4 -> review_count becomes 1
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 155,
                duration_seconds: 30,
                result: "correct".into(),
                self_rating: 4,
                selected_answer: None,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let (count1, mastery1): (i64, i64) = conn
            .query_row(
                "SELECT review_count, mastery FROM progress WHERE question_id=155",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(count1, 1);
        assert_eq!(mastery1, 4);

        // 2. Lapse: rating 1 -> review_count resets to 1, mastery becomes 1, next_review is 1 day away
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 155,
                duration_seconds: 40,
                result: "wrong".into(),
                self_rating: 1,
                selected_answer: None,
                mode: Some("review".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let (count2, mastery2, next2): (i64, i64, String) = conn
            .query_row(
                "SELECT review_count, mastery, next_review FROM progress WHERE question_id=155",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(count2, 1);
        assert_eq!(mastery2, 1);
        let expected_next = (Local::now().date_naive() + Duration::days(1)).to_string();
        assert_eq!(next2, expected_next);
    }

    #[test]
    fn reward_events_are_idempotent_and_persistent() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();

        // 1. Claim contract reward event
        let now = Local::now().to_rfc3339();
        let rows1 = conn.execute(
            "INSERT OR IGNORE INTO reward_events(event_id, reward_type, amount, meta_json, created_at) VALUES(?1, ?2, ?3, ?4, ?5)",
            params!["contract-2026-08-19", "contract", 60, "{}", now],
        ).unwrap();
        assert_eq!(rows1, 1);

        // 2. Duplicate claim with same event_id
        let rows2 = conn.execute(
            "INSERT OR IGNORE INTO reward_events(event_id, reward_type, amount, meta_json, created_at) VALUES(?1, ?2, ?3, ?4, ?5)",
            params!["contract-2026-08-19", "contract", 60, "{}", now],
        ).unwrap();
        assert_eq!(rows2, 0, "同一 event_id 重复领取不应重复插入");

        // 3. Sum of EXP
        let total: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM reward_events",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(total, 60);

        // 4. Claim chest reward
        conn.execute(
            "INSERT OR IGNORE INTO reward_events(event_id, reward_type, amount, meta_json, created_at) VALUES(?1, ?2, ?3, ?4, ?5)",
            params!["chest-2026-08-19", "chest", 150, "{}", now],
        ).unwrap();
        let total2: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM reward_events",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(total2, 210);
    }

    #[test]
    fn codex_adjudication_binds_attempt_and_preserves_attempt_and_elo_history() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 定积分");
        let attempt_id = record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 1,
                duration_seconds: 120,
                result: "correct".into(),
                self_rating: 4,
                selected_answer: None,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let elo_events_before: i64 = conn
            .query_row("SELECT COUNT(*) FROM elo_events", [], |row| row.get(0))
            .unwrap();
        let payload = CodexPayload {
            schema_version: 1,
            kind: "analysis".into(),
            task_id: "SB-ADJUDICATION-1".into(),
            question_id: Some(1),
            summary: "概念判断错误".into(),
            verdict: Some("incorrect".into()),
            earliest_error: Some("第 2 行".into()),
            error_tags: vec!["概念盲区".into()],
            weakness_tags: vec!["定积分".into()],
            confidence: 0.95,
            ..Default::default()
        };
        save_analysis_signal(&conn, &payload, Some(attempt_id)).unwrap();

        let (diagnosis_attempt_id, review_attempt_id): (Option<i64>, Option<i64>) = conn
            .query_row(
                "SELECT d.attempt_id,r.last_attempt_id
                 FROM learning_diagnoses d
                 JOIN review_tasks r ON r.task_id=d.task_id AND r.question_id=d.question_id
                 WHERE d.task_id=?1 AND d.question_id=1",
                ["SB-ADJUDICATION-1"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(diagnosis_attempt_id, Some(attempt_id));
        assert_eq!(review_attempt_id, Some(attempt_id));
        let superseded_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT supersedes_attempt_id FROM learning_evidence
                 WHERE evidence_kind='codex_adjudication' AND task_id=?1",
                ["SB-ADJUDICATION-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(superseded_attempt_id, Some(attempt_id));
        let (mastery, evidence_count): (f64, i64) = conn
            .query_row(
                "SELECT mastery,evidence_count FROM skill_states WHERE category_key='高等数学 / 定积分'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(mastery, 0.0);
        assert_eq!(evidence_count, 1);
        let outcome: String = conn
            .query_row(
                "SELECT outcome FROM attempts WHERE id=?1",
                [attempt_id],
                |row| row.get(0),
            )
            .unwrap();
        let elo_events_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM elo_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(outcome, "correct");
        assert_eq!(elo_events_after, elo_events_before);
    }

    fn test_analysis_payload(task_id: &str, question_id: i64) -> CodexPayload {
        CodexPayload {
            schema_version: 1,
            kind: "analysis".into(),
            task_id: task_id.into(),
            question_id: Some(question_id),
            summary: "测试诊断".into(),
            verdict: Some("incorrect".into()),
            earliest_error: Some("第 $2$ 行".into()),
            error_tags: vec!["概念盲区".into()],
            weakness_tags: vec!["测试知识点".into()],
            advice: Some("复核 $x$ 的定义域".into()),
            better_solution: None,
            confidence: 0.95,
            ..Default::default()
        }
    }

    fn test_batch_payload(task_id: &str, question_id: i64) -> CodexPayload {
        CodexPayload {
            schema_version: 1,
            kind: "batch".into(),
            task_id: task_id.into(),
            summary: "测试整组诊断".into(),
            confidence: 0.95,
            batch_attempts: vec![BatchAttempt {
                question_id,
                result: "wrong".into(),
                self_rating: 2,
                duration_seconds: 88,
                summary: "测试题出现概念错误".into(),
                verdict: Some("incorrect".into()),
                earliest_error: Some("第 $2$ 行".into()),
                error_tags: vec!["概念盲区".into()],
                weakness_tags: vec!["测试知识点".into()],
                advice: Some("复核 $x$ 的定义域".into()),
                better_solution: None,
                confidence: 0.95,
                ..Default::default()
            }],
            ..Default::default()
        }
    }

    fn test_attempt(conn: &Connection, question_id: i64, result: &str) -> i64 {
        record_attempt_row(
            conn,
            &AttemptInput {
                question_id,
                duration_seconds: 120,
                result: result.into(),
                self_rating: 4,
                selected_answer: None,
                mode: Some("paper".into()),
                ..Default::default()
            },
        )
        .unwrap()
    }

    fn learning_center_table_counts(conn: &Connection) -> Vec<i64> {
        ["learning_evidence", "learning_diagnoses", "review_tasks", "recommendation_batches", "custom_queue", "attempts", "elo_events", "progress"].iter().map(|table| conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0)).unwrap()).collect()
    }

    fn insert_learning_center_evidence(conn: &Connection, key: &str, outcome: &str, confidence: f64) {
        conn.execute("INSERT INTO learning_evidence(evidence_key,question_id,category_key,source,outcome,confidence,mastery_signal,fluency_signal,transfer_signal,retention_signal,occurred_at,created_at) VALUES(?1,1,'测试分类','attempt',?2,?3,1,1,1,1,'2026-08-24T10:00:00+08:00','2026-08-24T10:00:00+08:00')", params![key,outcome,confidence]).unwrap();
    }

    #[test]
    fn learning_center_empty_library_has_no_fake_score_or_question_recommendation() {
        let conn = Connection::open_in_memory().unwrap(); init_schema(&conn).unwrap();
        let before = learning_center_table_counts(&conn); let snapshot = build_learning_center_snapshot(&conn, None);
        assert!(snapshot.metrics.as_array().unwrap().iter().all(|metric| metric["value"].is_null()));
        assert!(snapshot.recommendations["items"].as_array().unwrap().is_empty());
        assert_eq!(snapshot.integrity["stableGateStatus"], "blocked");
        assert_eq!(before, learning_center_table_counts(&conn));
    }

    #[test]
    fn learning_center_excludes_low_confidence_and_uncertain_evidence() {
        let conn = Connection::open_in_memory().unwrap(); init_schema(&conn).unwrap();
        insert_learning_center_evidence(&conn, "low", "correct", 0.74); insert_learning_center_evidence(&conn, "uncertain", "uncertain", 0.99);
        let snapshot = build_learning_center_snapshot(&conn, None);
        assert_eq!(snapshot.integrity["acceptedEvidenceCount"], 0);
        assert_eq!(snapshot.integrity["lowConfidenceEvidenceCount"], 1);
        assert_eq!(snapshot.integrity["uncertainEvidenceCount"], 1);
        assert!(snapshot.metrics.as_array().unwrap().iter().all(|metric| metric["value"].is_null()));
    }

    #[test]
    fn learning_center_never_exposes_unstructured_stable_as_stable() {
        let conn = Connection::open_in_memory().unwrap(); init_schema(&conn).unwrap();
        conn.execute("INSERT INTO skill_states(category_key,state,mastery,fluency,transfer,retention,confidence,evidence_count,updated_at) VALUES('测试分类','stable',1,1,1,1,1,3,'2026-08-24T10:00:00+08:00')", []).unwrap();
        conn.execute("INSERT INTO learning_diagnoses(task_id,question_id,category_key,normalized_error_class,next_action,confidence,created_at,updated_at) VALUES('task',1,'测试分类','concept','review_concept',0.95,'2026-08-24T10:00:00+08:00','2026-08-24T10:00:00+08:00')", []).unwrap();
        conn.execute("INSERT INTO review_tasks(task_id,question_id,category_key,stage,status,next_action,created_at,updated_at) VALUES('task',1,'测试分类','closed','closed','review_concept','2026-08-24T10:00:00+08:00','2026-08-24T10:00:00+08:00')", []).unwrap();
        let snapshot = build_learning_center_snapshot(&conn, None);
        assert_eq!(snapshot.integrity["structuredVariantEvidence"], false);
        assert_eq!(snapshot.integrity["structuredDelayedReviewEvidence"], false);
        assert!(snapshot.metrics.as_array().unwrap().iter().all(|metric| metric["state"] != "stable"));
        assert_eq!(snapshot.mistake_chains[0]["stage"], "remediating");
    }

    #[test]
    fn learning_center_snapshot_is_read_only_for_all_key_tables() {
        let conn = Connection::open_in_memory().unwrap(); init_schema(&conn).unwrap();
        insert_learning_center_evidence(&conn, "accepted", "correct", 0.90);
        let before = learning_center_table_counts(&conn); let _ = build_learning_center_snapshot(&conn, None); let _ = build_learning_center_snapshot(&conn, None);
        assert_eq!(before, learning_center_table_counts(&conn));
    }

    #[test]
    fn learning_center_shadow_is_stable_and_never_writes_a_queue() {
        let conn = Connection::open_in_memory().unwrap(); init_schema(&conn).unwrap();
        conn.execute("INSERT INTO learning_diagnoses(task_id,question_id,category_key,normalized_error_class,next_action,confidence,created_at,updated_at) VALUES('shadow',7,'稳定测试','concept','review_concept',0.95,'2026-08-24T10:00:00+08:00','2026-08-24T10:00:00+08:00')", []).unwrap();
        let before = learning_center_table_counts(&conn); let first = build_learning_center_snapshot(&conn, None); let second = build_learning_center_snapshot(&conn, None);
        assert_eq!(first.recommendations, second.recommendations);
        assert!(first.recommendations["items"].as_array().unwrap().iter().all(|item| item["questionId"].is_null()));
        assert_eq!(before, learning_center_table_counts(&conn));
    }

    #[test]
    fn learning_center_transfer_is_blocked_and_completed_count_is_isolated() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 10, "测试分类 / 子分类");
        insert_test_question(&conn, 11, "测试分类 / 子分类");
        insert_test_question(&conn, 12, "测试分类 / 子分类");
        conn.execute("UPDATE questions SET difficulty=1 WHERE id=10", []).unwrap();
        conn.execute("UPDATE questions SET difficulty=3 WHERE id=11", []).unwrap();
        conn.execute("UPDATE questions SET difficulty=1 WHERE id=12", []).unwrap();
        conn.execute("INSERT INTO learning_diagnoses(task_id,question_id,category_key,normalized_error_class,next_action,confidence,created_at,updated_at) VALUES('diag1',10,'测试分类 / 子分类','concept','review_concept',0.95,'2026-08-25T10:00:00+08:00','2026-08-25T10:00:00+08:00')", []).unwrap();

        let snap1 = build_learning_center_snapshot(&conn, None);
        let items = snap1.recommendations["items"].as_array().unwrap();
        let transfer_item = items.iter().find(|it| it["track"] == "transfer").unwrap();
        assert_eq!(transfer_item["state"], "blocked");
        assert!(transfer_item["questionId"].is_null());

        let repair_item = items.iter().find(|it| it["track"] == "repair").unwrap();
        assert_eq!(repair_item["state"], "available");
        let repair_qid = repair_item["questionId"].as_i64().unwrap();

        // 插入 5 道无关题目的今日作答
        for q in 20..25 {
            insert_test_question(&conn, q, "无关分类");
            test_attempt(&conn, q, "correct");
        }
        let snap2 = build_learning_center_snapshot(&conn, None);
        assert_eq!(snap2.training["todayProblems"], 5);
        assert_eq!(snap2.today["completedCount"], 0); // 目标题未做，完成数应为 0，而非 5

        // 做对目标题
        test_attempt(&conn, repair_qid, "correct");
        let snap3 = build_learning_center_snapshot(&conn, None);
        assert_eq!(snap3.today["completedCount"], 1); // 精准完成 1 项目标
    }
    #[test]
    fn nonpressure_batch_attempt_ids_bind_exact_rows_and_allow_unanswered_questions() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        insert_test_question(&conn, 2, "线性代数 / 测试");
        let attempt_id = test_attempt(&conn, 1, "correct");
        let questions = vec![
            question_by_id(&conn, 1).unwrap(),
            question_by_id(&conn, 2).unwrap(),
        ];
        let mut supplied = HashMap::new();
        supplied.insert(1, attempt_id);

        let validated =
            validate_nonpressure_batch_attempt_ids(&conn, &questions, Some(&supplied)).unwrap();

        assert_eq!(validated.get(&1), Some(&attempt_id));
        assert!(!validated.contains_key(&2), "未作答题必须保持未绑定");
    }

    #[test]
    fn nonpressure_batch_attempt_ids_reject_unknown_and_wrong_question_rows() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        insert_test_question(&conn, 2, "线性代数 / 测试");
        let attempt_for_two = test_attempt(&conn, 2, "correct");
        let questions = vec![
            question_by_id(&conn, 1).unwrap(),
            question_by_id(&conn, 2).unwrap(),
        ];

        let mut wrong_question = HashMap::new();
        wrong_question.insert(1, attempt_for_two);
        let wrong_error =
            validate_nonpressure_batch_attempt_ids(&conn, &questions, Some(&wrong_question))
                .unwrap_err();
        assert!(wrong_error.contains("不能绑定到题目 1"));

        let mut unknown_attempt = HashMap::new();
        unknown_attempt.insert(1, 9_999_999);
        let unknown_error =
            validate_nonpressure_batch_attempt_ids(&conn, &questions, Some(&unknown_attempt))
                .unwrap_err();
        assert!(unknown_error.contains("不存在"));

        let mut out_of_round = HashMap::new();
        out_of_round.insert(999, attempt_for_two);
        let out_of_round_error =
            validate_nonpressure_batch_attempt_ids(&conn, &questions, Some(&out_of_round))
                .unwrap_err();
        assert!(out_of_round_error.contains("不属于当前题组"));
    }

    fn attempt_and_elo_counts(conn: &Connection) -> (i64, i64) {
        let attempts = conn
            .query_row("SELECT COUNT(*) FROM attempts", [], |row| row.get(0))
            .unwrap();
        let elo_events = conn
            .query_row("SELECT COUNT(*) FROM elo_events", [], |row| row.get(0))
            .unwrap();
        (attempts, elo_events)
    }

    fn progress_snapshot(
        conn: &Connection,
        question_id: i64,
    ) -> Option<(i64, Option<i64>, Option<String>, Option<String>, i64)> {
        conn.query_row(
            "SELECT favorite,mastery,last_attempt_at,next_review,review_count FROM progress WHERE question_id=?1",
            [question_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .optional()
        .unwrap()
    }

    #[test]
    fn untrusted_batch_result_verdict_rejects_before_pressure_attempt_progress_or_elo() {
        let cases = [
            ("illegal_verdict", "wrong", Some("fabricated")),
            ("conflicting_pair", "correct", Some("incorrect")),
            ("unknown_result", "maybe", Some("correct")),
            ("missing_verdict", "uncertain", None),
        ];

        for (label, result, verdict) in cases {
            let conn = Connection::open_in_memory().unwrap();
            init_schema(&conn).unwrap();
            insert_test_question(&conn, 1, "高等数学 / 测试");
            let before_history = attempt_and_elo_counts(&conn);
            let before_progress = progress_snapshot(&conn, 1);
            let mut payload = test_batch_payload(&format!("SB-BATCH-UNTRUSTED-{label}"), 1);
            let batch_attempt = &mut payload.batch_attempts[0];
            batch_attempt.result = result.into();
            batch_attempt.verdict = verdict.map(str::to_owned);

            let ingest_error = insert_codex_payload(&conn, &payload).unwrap_err();
            assert!(
                ingest_error.contains("result/verdict 不可信"),
                "{label}: {ingest_error}"
            );
            let inbox_rows: i64 = conn
                .query_row("SELECT COUNT(*) FROM codex_inbox", [], |row| row.get(0))
                .unwrap();
            assert_eq!(inbox_rows, 0, "{label} must not enter inbox");

            let apply_error = apply_batch_payload(
                &conn,
                &payload,
                None,
                BatchApplicationMode::FormalPressureAttempt,
            )
            .unwrap_err();
            assert!(
                apply_error.contains("result/verdict 不可信"),
                "{label}: {apply_error}"
            );
            assert_eq!(
                attempt_and_elo_counts(&conn),
                before_history,
                "{label} must not create pressure attempts or ELO"
            );
            assert_eq!(
                progress_snapshot(&conn, 1),
                before_progress,
                "{label} must not mutate progress"
            );
            let markers: i64 = conn
                .query_row("SELECT COUNT(*) FROM codex_batch_applications", [], |row| row.get(0))
                .unwrap();
            let signals: i64 = conn
                .query_row("SELECT COUNT(*) FROM codex_analysis_signals", [], |row| row.get(0))
                .unwrap();
            assert_eq!(markers, 0, "{label} must not write batch markers");
            assert_eq!(signals, 0, "{label} must not write diagnosis signals");
        }
    }

    #[test]
    fn untrusted_batch_result_verdict_cannot_create_nonpressure_diagnosis_or_review_evidence() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        let bound_attempt_id = test_attempt(&conn, 1, "correct");
        let before_history = attempt_and_elo_counts(&conn);
        let before_progress = progress_snapshot(&conn, 1);
        insert_codex_task_context(
            &conn,
            "SB-BATCH-UNTRUSTED-NONPRESSURE",
            1,
            Some(bound_attempt_id),
            "batch",
            "2026-08-24T10:00:00+08:00",
            "immutable_attempt_id",
        )
        .unwrap();
        let mut payload = test_batch_payload("SB-BATCH-UNTRUSTED-NONPRESSURE", 1);
        payload.batch_attempts[0].result = "wrong".into();
        payload.batch_attempts[0].verdict = Some("correct".into());

        let error = apply_batch_payload(
            &conn,
            &payload,
            None,
            BatchApplicationMode::BoundNonPressureAdjudication,
        )
        .unwrap_err();
        assert!(error.contains("result/verdict 不可信"));
        assert_eq!(attempt_and_elo_counts(&conn), before_history);
        assert_eq!(progress_snapshot(&conn, 1), before_progress);
        let diagnoses: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM learning_diagnoses WHERE task_id='SB-BATCH-UNTRUSTED-NONPRESSURE-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let evidence: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM learning_evidence WHERE task_id='SB-BATCH-UNTRUSTED-NONPRESSURE-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let markers: i64 = conn
            .query_row("SELECT COUNT(*) FROM codex_batch_applications", [], |row| row.get(0))
            .unwrap();
        assert_eq!(diagnoses, 0);
        assert_eq!(evidence, 0);
        assert_eq!(markers, 0);
    }

    #[test]
    fn bound_nonpressure_batch_is_sidecar_only_and_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        let attempt_id = test_attempt(&conn, 1, "correct");
        let before_history = attempt_and_elo_counts(&conn);
        let before_progress = progress_snapshot(&conn, 1);
        insert_codex_task_context(
            &conn,
            "SB-BATCH-BOUND",
            1,
            Some(attempt_id),
            "batch",
            "2026-08-24T10:00:00+08:00",
            "immutable_attempt_ids",
        )
        .unwrap();
        let payload = test_batch_payload("SB-BATCH-BOUND", 1);

        apply_batch_payload(
            &conn,
            &payload,
            None,
            BatchApplicationMode::BoundNonPressureAdjudication,
        )
        .unwrap();
        apply_batch_payload(
            &conn,
            &payload,
            None,
            BatchApplicationMode::BoundNonPressureAdjudication,
        )
        .unwrap();

        assert_eq!(attempt_and_elo_counts(&conn), before_history);
        assert_eq!(progress_snapshot(&conn, 1), before_progress);
        let diagnosis_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT attempt_id FROM learning_diagnoses WHERE task_id='SB-BATCH-BOUND-1' AND question_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(diagnosis_attempt_id, Some(attempt_id));
        let adjudications: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM learning_evidence WHERE source='codex_adjudication' AND task_id='SB-BATCH-BOUND-1' AND supersedes_attempt_id=?1",
                [attempt_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(adjudications, 1);
    }

    #[test]
    fn unbound_nonpressure_batch_never_guesses_a_historical_attempt() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        let historical_attempt_id = test_attempt(&conn, 1, "correct");
        let before_history = attempt_and_elo_counts(&conn);
        let before_progress = progress_snapshot(&conn, 1);
        // The current create API supplies only question ids/durations. A historical
        // attempt (even with the same question) is not proof it belongs to this round.
        insert_codex_task_context(
            &conn,
            "SB-BATCH-UNBOUND",
            1,
            None,
            "batch",
            "2026-08-24T10:00:00+08:00",
            "unbound_nonpressure_batch",
        )
        .unwrap();
        let payload = test_batch_payload("SB-BATCH-UNBOUND", 1);
        apply_batch_payload(
            &conn,
            &payload,
            None,
            BatchApplicationMode::BoundNonPressureAdjudication,
        )
        .unwrap();

        let new_attempt_id: i64 = conn
            .query_row(
                "SELECT id FROM attempts WHERE session_id='SB-BATCH-UNBOUND' AND question_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_ne!(new_attempt_id, historical_attempt_id);
        let diagnosis_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT attempt_id FROM learning_diagnoses WHERE task_id='SB-BATCH-UNBOUND-1' AND question_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(diagnosis_attempt_id, Some(new_attempt_id));
        let adjudications: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM learning_evidence WHERE source='codex_adjudication' AND supersedes_attempt_id=?1",
                [historical_attempt_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(adjudications, 0);
    }

    #[test]
    fn single_analysis_sidecar_keeps_bound_attempt_and_elo_immutable() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        let bound_attempt_id = test_attempt(&conn, 1, "correct");
        insert_codex_task_context(
            &conn,
            "SB-SINGLE-BOUND",
            1,
            Some(bound_attempt_id),
            "analysis",
            "2026-08-24T10:00:00+08:00",
            "paper",
        )
        .unwrap();
        let newer_attempt_id = test_attempt(&conn, 1, "wrong");
        let before_history = attempt_and_elo_counts(&conn);
        let before_attempts: Vec<(i64, Option<f64>, Option<f64>, Option<String>)> = conn
            .prepare("SELECT id,ai_rating,confidence,diagnosis_id FROM attempts ORDER BY id")
            .unwrap()
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        let payload = test_analysis_payload("SB-SINGLE-BOUND", 1);

        apply_analysis_payload_sidecar(&conn, &payload).unwrap();
        apply_analysis_payload_sidecar(&conn, &payload).unwrap();

        assert_eq!(attempt_and_elo_counts(&conn), before_history);
        let after_attempts: Vec<(i64, Option<f64>, Option<f64>, Option<String>)> = conn
            .prepare("SELECT id,ai_rating,confidence,diagnosis_id FROM attempts ORDER BY id")
            .unwrap()
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(after_attempts, before_attempts);
        let diagnosis_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT attempt_id FROM learning_diagnoses WHERE task_id='SB-SINGLE-BOUND' AND question_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(diagnosis_attempt_id, Some(bound_attempt_id));
        let adjudicated_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT supersedes_attempt_id FROM learning_evidence WHERE source='codex_adjudication' AND task_id='SB-SINGLE-BOUND'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(adjudicated_attempt_id, Some(bound_attempt_id));
        assert_ne!(adjudicated_attempt_id, Some(newer_attempt_id));
    }

    #[test]
    fn backfill_respects_bound_context_and_leaves_legacy_analysis_unbound() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 测试");
        insert_test_question(&conn, 2, "线性代数 / 测试");
        let bound_attempt_id = test_attempt(&conn, 1, "correct");
        let _newer_attempt_id = test_attempt(&conn, 1, "wrong");
        let historical_unbound_attempt_id = test_attempt(&conn, 2, "correct");
        insert_codex_task_context(
            &conn,
            "SB-BACKFILL-BOUND",
            1,
            Some(bound_attempt_id),
            "analysis",
            "2026-08-24T10:00:00+08:00",
            "paper",
        )
        .unwrap();
        let bound_payload = test_analysis_payload("SB-BACKFILL-BOUND", 1);
        let legacy_payload = test_analysis_payload("SB-BACKFILL-LEGACY", 2);
        insert_codex_payload(&conn, &bound_payload).unwrap();
        insert_codex_payload(&conn, &legacy_payload).unwrap();
        conn.execute(
            "UPDATE codex_inbox SET status='confirmed' WHERE task_id IN ('SB-BACKFILL-BOUND','SB-BACKFILL-LEGACY')",
            [],
        )
        .unwrap();
        let before_history = attempt_and_elo_counts(&conn);

        backfill_confirmed_analysis_signals(&conn).unwrap();
        backfill_confirmed_analysis_signals(&conn).unwrap();

        assert_eq!(attempt_and_elo_counts(&conn), before_history);
        let bound_diagnosis_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT attempt_id FROM learning_diagnoses WHERE task_id='SB-BACKFILL-BOUND' AND question_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(bound_diagnosis_attempt_id, Some(bound_attempt_id));
        let legacy_diagnosis_attempt_id: Option<i64> = conn
            .query_row(
                "SELECT attempt_id FROM learning_diagnoses WHERE task_id='SB-BACKFILL-LEGACY' AND question_id=2",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(legacy_diagnosis_attempt_id, None);
        let bound_adjudications: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM learning_evidence WHERE source='codex_adjudication' AND task_id='SB-BACKFILL-BOUND' AND supersedes_attempt_id=?1",
                [bound_attempt_id],
                |row| row.get(0),
            )
            .unwrap();
        let legacy_adjudications: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM learning_evidence WHERE source='codex_adjudication' AND supersedes_attempt_id=?1",
                [historical_unbound_attempt_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(bound_adjudications, 1);
        assert_eq!(legacy_adjudications, 0);
    }

    #[test]
    fn attempts_stores_outcome_and_fluency_separately() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        migrate_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();

        // Subjective question attempt with fluency 4 and outcome 'uncertain'
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 155,
                duration_seconds: 45,
                result: "uncertain".into(),
                self_rating: 4,
                selected_answer: None,
                mode: Some("paper".into()),
                outcome: Some("uncertain".into()),
                evidence_source: Some("manual_confirmed".into()),
                fluency_rating: Some(4),
                confidence: Some(0.95),
                session_id: Some("session-test-01".into()),
                diagnosis_id: None,
                ai_rating: None,
                difficulty_multiplier: None,
                technique_level: None,
                dimensions: None,
            },
        )
        .unwrap();

        let (outcome, evidence, fluency, confidence, session_id): (String, String, i64, Option<f64>, String) = conn.query_row(
            "SELECT outcome, evidence_source, fluency_rating, confidence, session_id FROM attempts WHERE question_id=155",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        ).unwrap();

        assert_eq!(outcome, "uncertain");
        assert_eq!(evidence, "manual_confirmed");
        assert_eq!(fluency, 4);
        assert_eq!(confidence, Some(0.95));
        assert_eq!(session_id, "session-test-01");
        let progress_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM progress WHERE question_id=155",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            progress_count, 0,
            "uncertain 作答只能保留诊断，不能由流畅度更新掌握进度"
        );
    }

    #[test]
    fn duration_anomalies_are_clamped_and_isolated() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        migrate_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();

        let today = Local::now().date_naive().to_string();

        // 1. Record attempt with 0 duration -> should clamp to minimum 1s
        record_attempt_row(
            &conn,
            &AttemptInput {
                question_id: 155,
                duration_seconds: 0,
                result: "correct".into(),
                self_rating: 3,
                selected_answer: None,
                mode: Some("paper".into()),
                outcome: Some("correct".into()),
                evidence_source: Some("self_report".into()),
                fluency_rating: Some(3),
                confidence: None,
                session_id: None,
                diagnosis_id: None,
                ai_rating: None,
                difficulty_multiplier: None,
                technique_level: None,
                dimensions: None,
            },
        )
        .unwrap();

        let dur: i64 = conn
            .query_row(
                "SELECT duration_seconds FROM attempts WHERE question_id=155",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(dur, 1, "0 秒写入应自动修正为下限 1 秒");

        // 2. Insert raw legacy anomalous duration into attempts (e.g. 34811 seconds)
        conn.execute(
            "INSERT INTO attempts(question_id, attempted_at, duration_seconds, result, self_rating, mode, outcome, evidence_source) VALUES(160, ?1, 34811, 'correct', 4, 'paper', 'correct', 'legacy')",
            [&today],
        ).unwrap();

        // Query today_seconds with anomaly filtering
        let valid_seconds: i64 = conn.query_row(
            "SELECT COALESCE(SUM(duration_seconds),0) FROM attempts WHERE substr(attempted_at,1,10)=?1 AND duration_seconds BETWEEN 1 AND 1800",
            [&today],
            |r| r.get(0),
        ).unwrap();

        assert_eq!(valid_seconds, 1, "异常时长(34811s)应被隔离在日常统计之外");

        let anomaly_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM attempts WHERE duration_seconds > 1800 OR duration_seconds < 1",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(anomaly_count, 1);
    }

    #[test]
    fn practice_session_restores_current_questions_and_index() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        migrate_schema(&conn).unwrap();
        import_library(&mut conn, Path::new(DEFAULT_LIBRARY)).unwrap();

        let input = PracticeSessionInput {
            question_ids: vec![155, 160],
            reasons: vec!["到期复习".into(), "薄弱修复".into()],
            reason_codes: vec!["due".into(), "weakness".into()],
            scores: vec![100.0, 80.0],
            current_index: 1,
            attempt_mode: "review".into(),
        };
        save_practice_session_row(&conn, &input).unwrap();
        conn.execute(
            "UPDATE questions SET stem='当前数据库题干' WHERE id=160",
            [],
        )
        .unwrap();

        let restored = load_practice_session_row(&conn).unwrap().unwrap();
        assert_eq!(restored.current_index, 1);
        assert_eq!(restored.attempt_mode, "review");
        assert_eq!(restored.queue.len(), 2);
        assert_eq!(restored.queue[1].question.stem, "当前数据库题干");
    }

    #[test]
    fn failed_migration_rolls_back_all_schema_changes() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE progress(question_id INTEGER PRIMARY KEY);
             CREATE TABLE attempts(
               id INTEGER PRIMARY KEY,
               result TEXT NOT NULL,
               self_rating INTEGER NOT NULL
             );",
        )
        .unwrap();

        assert!(migrate_schema_impl(&conn, true).is_err());
        let attempt_columns: Vec<String> = conn
            .prepare("PRAGMA table_info(attempts)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let progress_columns: Vec<String> = conn
            .prepare("PRAGMA table_info(progress)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert!(!attempt_columns.iter().any(|column| column == "outcome"));
        assert!(!progress_columns.iter().any(|column| column == "note"));
    }

    #[test]
    fn rolling_backups_keep_latest_seven_and_four_weekly_points() {
        use chrono::TimeZone;

        let dates = vec![
            Local.with_ymd_and_hms(2026, 8, 19, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 8, 19, 11, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 8, 17, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 8, 16, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 8, 15, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 8, 14, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 8, 10, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 8, 3, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 7, 27, 12, 0, 0).unwrap(),
            Local.with_ymd_and_hms(2026, 7, 20, 12, 0, 0).unwrap(),
        ];
        let keep = rolling_backup_keep_indices(&dates);
        assert!((0..7).all(|index| keep.contains(&index)));
        let kept_weeks: HashSet<_> = keep
            .iter()
            .map(|index| {
                let iso = dates[*index].iso_week();
                (iso.year(), iso.week())
            })
            .collect();
        assert!(kept_weeks.len() >= 4);
        assert!(!keep.contains(&10), "只保留最近四个周锚点");
    }

    #[test]
    fn restore_preflight_rejects_invalid_backup_before_switching() {
        let temp_dir =
            std::env::temp_dir().join(format!("shuaba-restore-test-{}", rand::random::<u64>()));
        fs::create_dir_all(&temp_dir).unwrap();
        let valid_path = temp_dir.join("valid.db");
        let invalid_path = temp_dir.join("invalid.db");

        let valid = Connection::open(&valid_path).unwrap();
        init_schema(&valid).unwrap();
        drop(valid);
        assert_eq!(inspect_database_backup(&valid_path).unwrap(), (0, 0));

        let invalid = Connection::open(&invalid_path).unwrap();
        invalid
            .execute_batch("CREATE TABLE attempts(id INTEGER); CREATE TABLE progress(id INTEGER);")
            .unwrap();
        drop(invalid);
        let error = inspect_database_backup(&invalid_path).unwrap_err();
        assert!(error.contains("settings"));

        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn batch_prompt_includes_timing_information_and_diagnosis_instructions() {
        let question = Question {
            id: 101,
            stem: "测试题干1".to_string(),
            options: vec![],
            correct_answer: "A".to_string(),
            explanation: "测试解析".to_string(),
            source: "测试源".to_string(),
            question_type: "single_choice".to_string(),
            category_path: "测试分类".to_string(),
            image_paths: vec![],
            is_core: false,
            difficulty: 1,
            favorite: false,
            attempts: 1,
            accuracy: Some(1.0),
            mastery: Some(100),
            next_review: None,
            note: None,
        };

        let mut durations = HashMap::new();
        durations.insert(101, 90); // 1分30秒

        let prompt = build_codex_batch_task_prompt(
            "SB-BATCH-20260819-0001",
            &[question],
            Some(&durations),
            "C:/dummy/output.json",
        );

        assert!(prompt.contains("1分30秒"));
        assert!(prompt.contains("极速秒杀"));
        assert!(prompt.contains("熟练度与节奏诊断"));
    }

    fn pressure_saga_fixture(task_id: &str) -> (Connection, Connection, i64, CodexPayload, PressureBatchContext) {
        let main = Connection::open_in_memory().unwrap();
        init_schema(&main).unwrap();
        insert_test_question(&main, 1, "高等数学 / 压力测试");
        let supplemental = Connection::open_in_memory().unwrap();
        init_supplemental_schema(&supplemental).unwrap();
        supplemental.execute(
            "INSERT INTO pressure_sessions(session_id,question_ids,start_time,status,task_id,created_at) VALUES('p-saga','[1]',1,'awaiting_codex',?1,1)",
            [task_id],
        ).unwrap();
        supplemental.execute(
            "INSERT INTO pressure_task_links(task_id,session_id,is_current,created_at) VALUES(?1,'p-saga',1,1)",
            [task_id],
        ).unwrap();
        supplemental.execute(
            "INSERT INTO pressure_answers(session_id,question_id,user_answer,duration,submit_time) VALUES('p-saga',1,'',45,2)", [],
        ).unwrap();
        let payload = test_batch_payload(task_id, 1);
        insert_codex_payload(&main, &payload).unwrap();
        let inbox_id: i64 = main.query_row("SELECT id FROM codex_inbox WHERE task_id=?1", [task_id], |r| r.get(0)).unwrap();
        let context = match pressure_task_match(&supplemental, task_id).unwrap() {
            PressureTaskMatch::Current(context) => context,
            _ => panic!("pressure fixture must be current"),
        };
        (main, supplemental, inbox_id, payload, context)
    }

    #[test]
    fn analysis_sidecar_raw_facts_roll_back_as_one_transaction() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 原子性");
        let attempt_id = test_attempt(&conn, 1, "wrong");
        let payload = test_analysis_payload("SB-ATOMIC-RAW", 1);
        let before: Vec<(&str, i64)> = ["codex_analysis_signals", "learning_diagnoses", "review_tasks", "learning_evidence"].into_iter().map(|table| (table, conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0)).unwrap())).collect();
        conn.execute_batch("CREATE TRIGGER fail_raw_evidence BEFORE INSERT ON learning_evidence BEGIN SELECT RAISE(ABORT,'forced raw evidence fault'); END;").unwrap();
        assert!(save_analysis_signal(&conn, &payload, Some(attempt_id)).is_err());
        for (table, expected) in before {
            let count: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0)).unwrap();
            assert_eq!(count, expected, "{table} must roll back with the failed raw sidecar");
        }
    }

    #[test]
    fn backfill_bad_json_is_audited_and_does_not_block_later_confirmed_analysis() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_test_question(&conn, 1, "高等数学 / 回填");
        conn.execute("INSERT INTO codex_inbox(task_id,kind,payload_json,status,created_at) VALUES('SB-BAD-JSON','analysis','{not-json','confirmed','2026-08-24T10:00:00+08:00')", []).unwrap();
        let valid = test_analysis_payload("SB-GOOD-AFTER-BAD", 1);
        insert_codex_payload(&conn, &valid).unwrap();
        conn.execute("UPDATE codex_inbox SET status='confirmed' WHERE task_id='SB-GOOD-AFTER-BAD'", []).unwrap();
        backfill_confirmed_analysis_signals(&conn).unwrap();
        let audit: (String, i64, i64) = conn.query_row("SELECT stage,attempts,resolved FROM codex_backfill_failures WHERE task_id='SB-BAD-JSON'", [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
        assert_eq!(audit.0, "parse_payload"); assert_eq!(audit.1, 1); assert_eq!(audit.2, 0);
        let signals: i64 = conn.query_row("SELECT COUNT(*) FROM codex_analysis_signals WHERE task_id='SB-GOOD-AFTER-BAD'", [], |r| r.get(0)).unwrap();
        assert_eq!(signals, 1);
    }

    #[test]
    fn learning_center_does_not_turn_unstructured_signals_into_transfer_or_retention_scores() {
        let conn = Connection::open_in_memory().unwrap(); init_schema(&conn).unwrap();
        insert_learning_center_evidence(&conn, "ordinary-accepted", "correct", 0.95);
        let snapshot = build_learning_center_snapshot(&conn, None);
        let metric = |key: &str| snapshot.metrics.as_array().unwrap().iter().find(|m| m["key"] == key).unwrap();
        for key in ["transfer", "retention"] {
            let item = metric(key);
            assert!(item["value"].is_null(), "{key} must remain unknown without structured proof");
            assert_eq!(item["evidenceCount"], 0);
            assert_eq!(item["state"], "blocked");
        }
        assert_eq!(snapshot.incentive["available"], false);
        assert!(snapshot.incentive["xp"].is_null());
    }

    #[test]
    fn pressure_report_failure_retries_without_duplicate_main_attempt_or_elo() {
        let (main, supplemental, inbox_id, payload, context) = pressure_saga_fixture("SB-SAGA-REPORT-RETRY");
        assert_eq!(apply_pressure_batch_main_with_receipt(&main, inbox_id, &context, &payload).unwrap(), "main_applied");
        let counts_after_main = attempt_and_elo_counts(&main);
        supplemental.execute("UPDATE pressure_sessions SET status='abandoned' WHERE session_id='p-saga'", []).unwrap();
        assert!(confirm_pressure_batch_saga(&main, &supplemental, inbox_id, &context, &payload).is_err());
        assert_eq!(attempt_and_elo_counts(&main), counts_after_main);
        assert_eq!(pressure_receipt(&main, &payload.task_id).unwrap().unwrap().state, "main_applied");
        supplemental.execute("UPDATE pressure_sessions SET status='awaiting_codex' WHERE session_id='p-saga'", []).unwrap();
        confirm_pressure_batch_saga(&main, &supplemental, inbox_id, &context, &payload).unwrap();
        assert_eq!(attempt_and_elo_counts(&main), counts_after_main);
        assert_eq!(pressure_receipt(&main, &payload.task_id).unwrap().unwrap().state, "confirmed");
        let status: String = main.query_row("SELECT status FROM codex_inbox WHERE id=?1", [inbox_id], |r| r.get(0)).unwrap();
        assert_eq!(status, "confirmed");
    }

    #[test]
    fn pressure_report_applied_recovers_confirmation_window_without_reapplying_main() {
        let (main, supplemental, inbox_id, payload, context) = pressure_saga_fixture("SB-SAGA-CONFIRM-RECOVER");
        apply_pressure_batch_main_with_receipt(&main, inbox_id, &context, &payload).unwrap();
        let counts_after_main = attempt_and_elo_counts(&main);
        save_pressure_batch_report(&supplemental, &context, &payload).unwrap();
        update_pressure_receipt_state(&main, &payload.task_id, "report_applied", None).unwrap();
        // Simulates a crash after supplemental report commit and before the final
        // main-db inbox/receipt confirmation transaction.
        confirm_pressure_batch_saga(&main, &supplemental, inbox_id, &context, &payload).unwrap();
        assert_eq!(attempt_and_elo_counts(&main), counts_after_main);
        assert_eq!(pressure_receipt(&main, &payload.task_id).unwrap().unwrap().state, "confirmed");
        let status: String = main.query_row("SELECT status FROM codex_inbox WHERE id=?1", [inbox_id], |r| r.get(0)).unwrap();
        assert_eq!(status, "confirmed");
    }

    #[test]
    fn stale_pressure_task_after_main_applied_is_retained_not_dismissed() {
        let (main, supplemental, inbox_id, payload, context) = pressure_saga_fixture("SB-SAGA-STALE");
        apply_pressure_batch_main_with_receipt(&main, inbox_id, &context, &payload).unwrap();
        let counts = attempt_and_elo_counts(&main);
        supplemental.execute("UPDATE pressure_task_links SET is_current=0 WHERE task_id=?1", [&payload.task_id]).unwrap();
        let stale = pressure_task_match(&supplemental, &payload.task_id).unwrap();
        match stale {
            PressureTaskMatch::Stale { session_id, current_task_id } => {
                let message = retain_stale_pressure_inbox(&main, inbox_id, &payload, &session_id, current_task_id).unwrap();
                assert!(message.contains("未自动 dismiss"));
            }
            _ => panic!("fixture must become stale"),
        }
        assert_eq!(attempt_and_elo_counts(&main), counts);
        let status: String = main.query_row("SELECT status FROM codex_inbox WHERE id=?1", [inbox_id], |r| r.get(0)).unwrap();
        assert_eq!(status, "pending");
        assert_eq!(pressure_receipt(&main, &payload.task_id).unwrap().unwrap().state, "reconciliation_required");
    }


    #[test]
    fn pressure_payload_hash_is_canonical_and_recovery_does_not_false_conflict() {
        let (main, supplemental, inbox_id, payload, context) = pressure_saga_fixture("SB-SAGA-CANONICAL-HASH");
        let mut first = payload.clone();
        for (key, score) in [("speed", 88.0), ("rigor", 91.0), ("strategyInsight", 84.0)] {
            first.batch_attempts[0].dimensions.insert(key.into(), RatingDimension { score: Some(score), confidence: 0.95, evidence: key.into(), advice: None, technique_level: Some(2), independent_discovery: None });
        }
        let serialized = serde_json::to_string(&first).unwrap();
        let mut replayed: CodexPayload = serde_json::from_str(&serialized).unwrap();
        let dimensions = replayed.batch_attempts[0].dimensions.clone();
        replayed.batch_attempts[0].dimensions.clear();
        for key in ["strategyInsight", "rigor", "speed"] { replayed.batch_attempts[0].dimensions.insert(key.into(), dimensions[key].clone()); }
        assert_eq!(pressure_payload_hash(&first).unwrap(), pressure_payload_hash(&replayed).unwrap());
        assert_eq!(apply_pressure_batch_main_with_receipt(&main, inbox_id, &context, &first).unwrap(), "main_applied");
        let counts_after_main = attempt_and_elo_counts(&main);
        supplemental.execute("UPDATE pressure_sessions SET status='abandoned' WHERE session_id='p-saga'", []).unwrap();
        assert!(confirm_pressure_batch_saga(&main, &supplemental, inbox_id, &context, &first).is_err());
        supplemental.execute("UPDATE pressure_sessions SET status='awaiting_codex' WHERE session_id='p-saga'", []).unwrap();
        confirm_pressure_batch_saga(&main, &supplemental, inbox_id, &context, &replayed).unwrap();
        assert_eq!(attempt_and_elo_counts(&main), counts_after_main);
        assert_eq!(pressure_receipt(&main, &replayed.task_id).unwrap().unwrap().state, "confirmed");
    }

    #[test]
    fn learning_center_uses_only_effective_projected_evidence_and_honest_incentive_nulls() {
        let conn = Connection::open_in_memory().unwrap(); init_schema(&conn).unwrap();
        conn.execute_batch("INSERT INTO learning_evidence(evidence_key,task_id,question_id,attempt_id,category_key,source,evidence_kind,outcome,confidence,adoption_weight,mastery_signal,fluency_signal,occurred_at,created_at,projection_applied) VALUES ('attempt-correct','task',1,42,'测试分类','attempt','attempt','correct',1,1,1,1,'2026-08-24T10:00:00+08:00','2026-08-24T10:00:00+08:00',1), ('ruling-wrong','task',1,NULL,'测试分类','codex_adjudication','adjudication','wrong',1,1,0,0,'2026-08-24T11:00:00+08:00','2026-08-24T11:00:00+08:00',1), ('unprojected-correct','task',2,43,'测试分类','attempt','attempt','correct',1,1,1,1,'2026-08-24T12:00:00+08:00','2026-08-24T12:00:00+08:00',0); UPDATE learning_evidence SET supersedes_attempt_id=42 WHERE evidence_key='ruling-wrong';").unwrap();
        let snapshot = build_learning_center_snapshot(&conn, None);
        let metric = |key: &str| snapshot.metrics.as_array().unwrap().iter().find(|item| item["key"] == key).unwrap();
        assert_eq!(snapshot.integrity["acceptedEvidenceCount"], 1);
        assert_eq!(metric("mastery")["value"], 0.0);
        assert_eq!(metric("mastery")["evidenceCount"], 1);
        assert_eq!(snapshot.recent_evidence.as_array().unwrap().len(), 1);
        assert_eq!(snapshot.recent_evidence[0]["id"], "evidence:2");
        assert_eq!(snapshot.training["incentiveAvailable"], false);
        assert!(snapshot.training["xpThisWeek"].is_null());
        assert!(snapshot.training["achievements"].is_null());
    }

    #[test]
    fn learning_category_path_matches_natural_language_intent() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO categories(id, name, path, root_name, depth) VALUES(1, '多元函数微分学', '高等数学 / 多元函数微分学', '高等数学', 1)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO categories(id, name, path, root_name, depth) VALUES(2, '特征值与特征向量', '线性代数 / 特征值与特征向量', '线性代数', 1)",
            [],
        ).unwrap();

        // 1. Explicit ID
        let p1 = learning_category_path(&conn, Some(1), "随意测试");
        assert_eq!(p1.as_deref(), Some("高等数学 / 多元函数微分学"));

        // 2. Natural language intent keywords
        let p2 = learning_category_path(&conn, None, "我想通过一组题有效的识别我多元微分的漏洞");
        assert_eq!(p2.as_deref(), Some("高等数学 / 多元函数微分学"));

        let p3 = learning_category_path(&conn, None, "偏导数计算与条件极值专项突破");
        assert_eq!(p3.as_deref(), Some("高等数学 / 多元函数微分学"));

        let p4 = learning_category_path(&conn, None, "特征值和相似对角化问题");
        assert_eq!(p4.as_deref(), Some("线性代数 / 特征值与特征向量"));
    }

    #[test]
    fn mistake_timeline_query_extracts_earliest_error_and_advice() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute_batch(
            "INSERT INTO questions(id, stem, options_json, correct_answer, explanation, source, category_path, question_type, difficulty) VALUES (1, '测试题目1', '[]', 'A', '解析', '真题', '高等数学', 'single_choice', 3);
             INSERT INTO attempts(id, question_id, attempted_at, duration_seconds, result, outcome, self_rating) VALUES (1, 1, '2026-08-28T10:00:00+08:00', 120, 'wrong', 'wrong', 1);
             INSERT INTO learning_diagnoses(task_id, question_id, category_key, verdict, earliest_error, confidence, created_at, updated_at) VALUES ('t1', 1, '高等数学', 'incorrect', '第1行错误', 0.95, '2026-08-28T10:00:00+08:00', '2026-08-28T10:00:00+08:00');
             INSERT INTO codex_inbox(task_id, kind, question_id, payload_json, status, created_at) VALUES ('t1', 'analysis', 1, '{\"advice\":\"专项修复建议\"}', 'confirmed', '2026-08-28T10:00:00+08:00');"
        ).unwrap();

        let mut stmt = conn.prepare(
            "WITH latest_advice AS (
                 SELECT q_id, advice, earliest_error FROM (
                     SELECT question_id as q_id,
                            json_extract(payload_json, '$.advice') as advice,
                            json_extract(payload_json, '$.earliestError') as earliest_error,
                            id,
                            ROW_NUMBER() OVER(PARTITION BY question_id ORDER BY id DESC) as rn
                     FROM codex_inbox
                     WHERE kind = 'analysis' AND (json_extract(payload_json, '$.advice') IS NOT NULL OR json_extract(payload_json, '$.earliestError') IS NOT NULL)
                     
                     UNION ALL
                     
                     SELECT CAST(json_extract(b.value, '$.questionId') AS INTEGER) as q_id,
                            json_extract(b.value, '$.advice') as advice,
                            json_extract(b.value, '$.earliestError') as earliest_error,
                            i.id,
                            ROW_NUMBER() OVER(PARTITION BY json_extract(b.value, '$.questionId') ORDER BY i.id DESC) as rn
                     FROM codex_inbox i, json_each(json_extract(i.payload_json, '$.batchAttempts')) b
                     WHERE i.kind = 'batch' AND (json_extract(b.value, '$.advice') IS NOT NULL OR json_extract(b.value, '$.earliestError') IS NOT NULL)
                 ) WHERE rn = 1
             )
             SELECT a.id, a.question_id, q.stem, q.category_path, q.question_type, q.difficulty,
                    a.attempted_at, a.duration_seconds, a.result, a.outcome,
                    COALESCE(la.earliest_error, ld.earliest_error) as earliest_error,
                    la.advice,
                    p.mastery, COALESCE(p.favorite, 0),
                    substr(a.attempted_at, 1, 10) as day
             FROM attempts a
             JOIN questions q ON q.id = a.question_id
             LEFT JOIN progress p ON p.question_id = a.question_id
             LEFT JOIN (
                 SELECT question_id, earliest_error,
                        ROW_NUMBER() OVER(PARTITION BY question_id ORDER BY id DESC) as rn
                 FROM learning_diagnoses
                 WHERE earliest_error IS NOT NULL
             ) ld ON ld.question_id = a.question_id AND ld.rn = 1
             LEFT JOIN latest_advice la ON la.q_id = a.question_id
             WHERE COALESCE(a.outcome, a.result) IN ('wrong', 'incorrect', 'uncertain')
             ORDER BY a.attempted_at DESC, a.id DESC"
        ).unwrap();

        let row = stmt.query_row([], |r| {
            let earliest_err: Option<String> = r.get(10)?;
            let adv: Option<String> = r.get(11)?;
            Ok((earliest_err, adv))
        }).unwrap();

        assert_eq!(row.0.as_deref(), Some("第1行错误"));
        assert_eq!(row.1.as_deref(), Some("专项修复建议"));
    }

}

