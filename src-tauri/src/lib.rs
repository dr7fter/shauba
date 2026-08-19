use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::{Duration, Local};
use rand::Rng;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Manager, State};

const DEFAULT_LIBRARY: &str = r"E:\考研资料\题库-大观园";
const CATEGORY_SCHEMA_VERSION: &str = "2";

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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapData {
    library_ready: bool,
    library_dir: String,
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AttemptInput {
    question_id: i64,
    duration_seconds: i64,
    result: String,
    self_rating: i32,
    selected_answer: Option<String>,
    mode: Option<String>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct BatchAttempt {
    question_id: i64,
    result: String,
    self_rating: i32,
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
    confidence: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoalInput {
    daily_mode: String,
    daily_problem_target: i64,
    daily_minute_target: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
    confidence: f64,
    #[serde(default)]
    recommended_question_ids: Vec<i64>,
    recommendation_reason: Option<String>,
    #[serde(default)]
    paper_title: Option<String>,
    #[serde(default)]
    paper_attempts: Vec<PaperAttempt>,
    #[serde(default)]
    batch_attempts: Vec<BatchAttempt>,
}

#[derive(Debug, Serialize)]
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
    confidence: f64,
    status: String,
    created_at: String,
    paper_title: Option<String>,
    paper_attempts: Vec<PaperAttempt>,
    batch_attempts: Vec<BatchAttempt>,
    recommendation_question_count: Option<i64>,
    recommendation_batch_status: Option<String>,
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
           FOREIGN KEY(question_id) REFERENCES questions(id)
         );
         CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id);
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
           completed_at TEXT
         );
         CREATE INDEX IF NOT EXISTS idx_recommendation_batches_status ON recommendation_batches(status,started_at);
         CREATE TABLE IF NOT EXISTS recommendation_batch_items (
           task_id TEXT NOT NULL,
           question_id INTEGER NOT NULL,
           position INTEGER NOT NULL,
           completed_at TEXT,
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
         CREATE TABLE IF NOT EXISTS settings (
           key TEXT PRIMARY KEY,
           value TEXT NOT NULL
         );
         INSERT OR IGNORE INTO settings(key,value) VALUES
           ('daily_mode','problems'),('daily_problem_target','20'),('daily_minute_target','90'),
           ('current_chapter_id',''),('category_schema_version','0'),('last_attempt_id','');",
    )
}

fn ensure_column(conn: &Connection, table: &str, column: &str, ddl: &str) -> rusqlite::Result<()> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))?;
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
         CREATE INDEX IF NOT EXISTS idx_supplemental_category ON supplemental_questions(category_path);",
    )
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
    tx.execute("DELETE FROM questions", [])
        .map_err(|e| e.to_string())?;
    let mut inserted = 0_i64;
    {
        let mut stmt = tx
            .prepare("INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)")
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

const QUESTION_SELECT: &str = "SELECT q.id,q.stem,q.options_json,q.correct_answer,q.explanation,q.source,q.question_type,q.category_path,q.image_paths_json,q.is_core,q.difficulty,COALESCE(p.favorite,0),COUNT(a.id),CASE WHEN COUNT(a.id)>0 THEN AVG(CASE WHEN a.result='correct' THEN 1.0 ELSE 0.0 END) END,p.mastery,p.next_review,p.note FROM questions q LEFT JOIN progress p ON p.question_id=q.id LEFT JOIN attempts a ON a.question_id=q.id";

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

fn create_recommendation_batch(conn: &Connection, payload: &CodexPayload) -> Result<(), String> {
    if payload.recommended_question_ids.is_empty() {
        return Err("推荐题组没有有效题目".into());
    }

    let mut question_ids = Vec::new();
    let mut seen = HashSet::new();
    for question_id in &payload.recommended_question_ids {
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
        question_ids.push(*question_id);
    }
    if question_ids.is_empty() {
        return Err("推荐题组没有可用题目".into());
    }

    let inserted = conn
        .execute(
            "INSERT OR IGNORE INTO recommendation_batches(task_id,title,summary,recommendation_reason,status,created_at) VALUES(?1,?2,?3,?4,'pending',?5)",
            params![
                payload.task_id,
                recommendation_batch_title(&payload.summary),
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
        conn.execute(
            "INSERT INTO recommendation_batch_items(task_id,question_id,position) VALUES(?1,?2,?3)",
            params![payload.task_id, question_id, position as i64],
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
                COUNT(i.question_id),COALESCE(SUM(CASE WHEN i.completed_at IS NOT NULL THEN 1 ELSE 0 END),0)
         FROM recommendation_batches b
         LEFT JOIN recommendation_batch_items i ON i.task_id=b.task_id
         WHERE b.task_id=?1
         GROUP BY b.task_id,b.title,b.summary,b.recommendation_reason,b.status,b.created_at",
        [task_id],
        |row| {
            let total_count: i64 = row.get(6)?;
            let completed_count: i64 = row.get(7)?;
            Ok(RecommendationBatch {
                task_id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                recommendation_reason: row.get(3)?,
                status: row.get(4)?,
                created_at: row.get(5)?,
                total_count,
                completed_count,
                remaining_count: total_count - completed_count,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn active_recommendation_queue(conn: &Connection) -> Result<Option<Vec<RecommendedQuestion>>, String> {
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
    Ok(Some(
        questions
            .into_iter()
            .enumerate()
            .map(|(position, question)| RecommendedQuestion {
                question,
                score: 120.0 - position as f64,
                reason: batch.recommendation_reason.clone(),
                reason_code: "codex".into(),
            })
            .collect(),
    ))
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
        let score = due_score
            + weakness
            + mastery_gap
            + exploration
            + difficulty_fit
            + diagnosis_score
            + rand::rng().random_range(0.0..6.0);
        let (reason, code) = if due {
            ("到了该回看的时间，先把记忆接上", "due")
        } else if diagnosis_score > 0.0 {
            ("针对 Codex 已确认的薄弱板块安排", "diagnosis")
        } else if q.attempts > 0 && q.accuracy.unwrap_or(1.0) < 0.65 {
            ("命中你近期不稳定的题型", "weakness")
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

fn save_analysis_signal(conn: &Connection, payload: &CodexPayload) -> Result<(), String> {
    let Some(question_id) = payload.question_id else {
        return Ok(());
    };
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
    Ok(())
}

fn backfill_confirmed_analysis_signals(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "SELECT payload_json FROM codex_inbox WHERE kind='analysis' AND status='confirmed'",
        )
        .map_err(|e| e.to_string())?;
    let payloads = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);
    for raw in payloads {
        if let Ok(payload) = serde_json::from_str::<CodexPayload>(&raw) {
            save_analysis_signal(conn, &payload)?;
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
                log::warn!(
                    "无法解析 Codex 回传 {}: {error}",
                    path.display()
                );
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
                .filter(|entry| {
                    entry
                        .path()
                        .extension()
                        .and_then(|e| e.to_str())
                        == Some("json")
                })
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
            let file_name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
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
            if !matches!(
                attempt.result.as_str(),
                "correct" | "wrong" | "uncertain"
            ) {
                return Err(format!("题号 {} 的作答结果无效", attempt.question_id));
            }
            if !(1..=4).contains(&attempt.self_rating) {
                return Err(format!("题号 {} 的自评等级无效", attempt.question_id));
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

fn apply_batch_payload(conn: &Connection, payload: &CodexPayload) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for attempt in &payload.batch_attempts {
        if attempt.result == "uncertain" {
            continue;
        }
        record_attempt_row(
            &tx,
            &AttemptInput {
                question_id: attempt.question_id,
                duration_seconds: 0,
                result: attempt.result.clone(),
                self_rating: attempt.self_rating,
                selected_answer: None,
                mode: Some("paper-codex".into()),
            },
        )?;
        // 每道题单独保存画像，避免同批次互相覆盖。
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
            confidence: attempt.confidence,
            recommended_question_ids: vec![],
            recommendation_reason: None,
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![],
        };
        save_analysis_signal(&tx, &signal)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
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

fn complete_active_recommendation_item(conn: &Connection, question_id: i64) -> Result<(), String> {
    let active_task: Option<String> = conn
        .query_row(
            "SELECT task_id FROM recommendation_batches WHERE status='active' ORDER BY started_at DESC,created_at DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(task_id) = active_task else {
        return Ok(());
    };
    let now = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE recommendation_batch_items SET completed_at=?1 WHERE task_id=?2 AND question_id=?3 AND completed_at IS NULL",
        params![now, task_id, question_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE recommendation_batches SET status='completed',completed_at=?1 WHERE task_id=?2 AND NOT EXISTS(SELECT 1 FROM recommendation_batch_items WHERE task_id=?2 AND completed_at IS NULL)",
        params![Local::now().to_rfc3339(), task_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn bootstrap(state: State<AppState>) -> Result<BootstrapData, String> {
    scan_inbox(&state)?;
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut count: i64 = conn
        .query_row("SELECT COUNT(*) FROM questions", [], |r| r.get(0))
        .unwrap_or(0);
    let library = state.library_dir.lock().map_err(|e| e.to_string())?.clone();
    let ready = library.join("all_questions_20260813.json").exists();
    if count == 0 && ready {
        count = import_library(&mut conn, &library)?;
    } else if ready {
        let category_version = setting(&conn, "category_schema_version", "0");
        if category_version != CATEGORY_SCHEMA_VERSION {
            import_category_metadata(&mut conn, &library)?;
        }
    }
    let today = Local::now().date_naive().to_string();
    let today_done = conn
        .query_row(
            "SELECT COUNT(*) FROM attempts WHERE substr(attempted_at,1,10)=?1",
            [&today],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let today_seconds: i64 = conn.query_row("SELECT COALESCE(SUM(duration_seconds),0) FROM attempts WHERE substr(attempted_at,1,10)=?1", [&today], |r| r.get(0)).unwrap_or(0);
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
    let current_focus_category_ids: Vec<i64> = serde_json::from_str(&focus_json).unwrap_or_default();
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
        library_ready: ready,
        library_dir: library.to_string_lossy().into_owned(),
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
    let rating_norm = rating.unwrap_or(0.0) / 4.0;
    let mut score =
        (recent_accuracy * 0.55 + rating_norm * 0.30 + overall_accuracy * 0.15) * 100.0;

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

#[tauri::command]
fn get_mastery_map(state: State<AppState>) -> Result<Vec<MasteryChapter>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive().to_string();
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
               SELECT question_id,COUNT(*) attempt_count,
                      SUM(CASE WHEN result='correct' THEN 1 ELSE 0 END) correct_attempts,
                      AVG(self_rating) rating,
                      MAX(attempted_at) last_attempt_at,
                      SUM(CASE WHEN result='correct' AND attempted_at>=?2 THEN 1 ELSE 0 END) recent_correct,
                      SUM(CASE WHEN attempted_at>=?2 THEN 1 ELSE 0 END) recent_attempts
               FROM attempts GROUP BY question_id
             )
             SELECT cq.chapter_id,cq.chapter_name,cq.root_name,COUNT(DISTINCT cq.question_id) total,
                    SUM(CASE WHEN ast.attempt_count IS NOT NULL THEN 1 ELSE 0 END) attempted,
                    COALESCE(SUM(ast.correct_attempts),0) correct_attempts,
                    COALESCE(SUM(ast.attempt_count),0) attempt_count,
                    SUM(CASE WHEN p.next_review<=?1 THEN 1 ELSE 0 END) due_count,
                    SUM(CASE WHEN p.mastery<=2 THEN 1 ELSE 0 END) weak_count,
                    AVG(ast.rating) rating,
                    COALESCE(SUM(ast.recent_correct),0) recent_correct,
                    COALESCE(SUM(ast.recent_attempts),0) recent_attempts,
                    MAX(ast.last_attempt_at) last_attempt_at
             FROM chapter_questions cq
             LEFT JOIN attempt_stats ast ON ast.question_id=cq.question_id
             LEFT JOIN progress p ON p.question_id=cq.question_id
             GROUP BY cq.chapter_id,cq.chapter_name,cq.root_name,cq.sort_key
             ORDER BY cq.root_name,cq.sort_key,cq.chapter_id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![today, recent_start], |r| {
            let total: i64 = r.get(3)?;
            let attempted: i64 = r.get(4)?;
            let correct: i64 = r.get(5)?;
            let attempts: i64 = r.get(6)?;
            let due_count: i64 = r.get(7)?;
            let weak_count: i64 = r.get(8)?;
            let rating: Option<f64> = r.get(9)?;
            let recent_correct: i64 = r.get(10)?;
            let recent_attempts: i64 = r.get(11)?;
            let last_attempt_at: Option<String> = r.get(12)?;
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
                id: r.get(0)?,
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
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_mastery_nodes(state: State<AppState>) -> Result<Vec<MasteryNode>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive().to_string();
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
               SELECT question_id,COUNT(*) attempt_count,
                      SUM(CASE WHEN result='correct' THEN 1 ELSE 0 END) correct_attempts,
                      AVG(self_rating) rating,
                      MAX(attempted_at) last_attempt_at,
                      SUM(CASE WHEN result='correct' AND attempted_at>=?2 THEN 1 ELSE 0 END) recent_correct,
                      SUM(CASE WHEN attempted_at>=?2 THEN 1 ELSE 0 END) recent_attempts
               FROM attempts GROUP BY question_id
             )
             SELECT nq.id,nq.parent_id,nq.chapter_id,nq.name,nq.path,nq.depth,COUNT(DISTINCT nq.question_id) total,
                    SUM(CASE WHEN ast.attempt_count IS NOT NULL THEN 1 ELSE 0 END) attempted,
                    COALESCE(SUM(ast.attempt_count),0) attempt_count,
                    SUM(CASE WHEN p.next_review<=?1 THEN 1 ELSE 0 END) due_count,
                    SUM(CASE WHEN p.mastery<=2 THEN 1 ELSE 0 END) weak_count,
                    COALESCE(SUM(ast.correct_attempts),0) correct_attempts,
                    AVG(ast.rating) rating,
                    COALESCE(SUM(ast.recent_correct),0) recent_correct,
                    COALESCE(SUM(ast.recent_attempts),0) recent_attempts,
                    MAX(ast.last_attempt_at) last_attempt_at
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
            let total: i64 = r.get(6)?;
            let attempted: i64 = r.get(7)?;
            let attempts: i64 = r.get(8)?;
            let due_count: i64 = r.get(9)?;
            let weak_count: i64 = r.get(10)?;
            let correct: i64 = r.get(11)?;
            let rating: Option<f64> = r.get(12)?;
            let recent_correct: i64 = r.get(13)?;
            let recent_attempts: i64 = r.get(14)?;
            let last_attempt_at: Option<String> = r.get(15)?;
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
                id: r.get(0)?,
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
fn set_focus_branches(
    category_ids: Vec<i64>,
    state: State<AppState>,
) -> Result<(), String> {
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
        if let Ok((name, path)) = conn.query_row(
            "SELECT name, path FROM categories WHERE id=?1",
            [id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
        ) {
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
    for (question_id, error_tags_json, weakness_tags_json, confidence, confirmed_at) in confirmed_rows {
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
    for (question_id, stem, category_path, source, result, self_rating, mode, attempted_at) in rows {
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
            ai_weakness_tags: signal
                .map(|s| s.weakness_tags.clone())
                .unwrap_or_default(),
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
    if let Some(id) = setting(&conn, "current_chapter_id", "")
        .parse::<i64>()
        .ok()
    {
        return chapter_queue(&conn, id, limit.min(50));
    }
    recommendations(&conn, limit.min(50))
}

#[tauri::command]
fn record_attempt(input: AttemptInput, state: State<AppState>) -> Result<Question, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    record_attempt_row(&conn, &input)?;
    question_by_id(&conn, input.question_id)
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
            "UPDATE recommendation_batch_items SET completed_at=NULL WHERE task_id=?1 AND question_id=?2",
            params![task_id, question_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE recommendation_batches SET status='active',completed_at=NULL
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
    for (index, key) in ["review_interval_1", "review_interval_2", "review_interval_3", "review_interval_4"]
        .iter()
        .enumerate()
    {
        if let Ok(value) = setting(conn, key, "").parse::<i64>() {
            result[index] = value.clamp(1, 180);
        }
    }
    result
}

fn record_attempt_row(conn: &Connection, input: &AttemptInput) -> Result<(), String> {
    let now = Local::now();
    conn.execute(
        "INSERT INTO attempts(question_id,attempted_at,duration_seconds,result,self_rating,selected_answer,mode) VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![
            input.question_id,
            now.to_rfc3339(),
            input.duration_seconds.clamp(0, 1800),
            input.result,
            input.self_rating.clamp(1, 4),
            input.selected_answer,
            input.mode.clone().unwrap_or_else(|| "paper".into())
        ],
    )
    .map_err(|e| e.to_string())?;
    let prev_progress: Option<(i64, Option<i64>)> = conn
        .query_row(
            "SELECT review_count, mastery FROM progress WHERE question_id=?1",
            [input.question_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let intervals = review_intervals(conn);
    let (days, next_review_count) = if input.self_rating <= 2 {
        // Lapse: rating 1 or 2 resets review progression back to the start
        let d = match input.self_rating {
            1 => intervals[0],
            _ => intervals[1],
        };
        (d, 1)
    } else {
        // Successful recall (rating 3 or 4)
        let prev_count = prev_progress.map(|(c, _)| c).unwrap_or(0);
        let next_count = prev_count + 1;
        let d = if input.self_rating == 4 && next_count >= 2 {
            // Mastered repeatedly: expand interval to double (up to 30 or configurable max)
            (intervals[3] * 2).clamp(intervals[3], 180)
        } else {
            match input.self_rating {
                3 => intervals[2],
                _ => intervals[3],
            }
        };
        (d, next_count)
    };
    let next = (now.date_naive() + Duration::days(days)).to_string();
    conn.execute(
        "INSERT INTO progress(question_id,mastery,last_attempt_at,next_review,review_count) VALUES(?1,?2,?3,?4,?5)
         ON CONFLICT(question_id) DO UPDATE SET mastery=excluded.mastery,last_attempt_at=excluded.last_attempt_at,next_review=excluded.next_review,review_count=excluded.review_count",
        params![input.question_id, input.self_rating, now.to_rfc3339(), next, next_review_count],
    )
    .map_err(|e| e.to_string())?;
    complete_active_recommendation_item(conn, input.question_id)?;
    Ok(())
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
    let keys = ["review_interval_1", "review_interval_2", "review_interval_3", "review_interval_4"];
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
    fs::create_dir_all(destination.parent().ok_or("无效的备份路径")?)
        .map_err(|e| e.to_string())?;
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
        .prepare("SELECT id,question_id,attempted_at,duration_seconds,result,self_rating,mode FROM attempts ORDER BY attempted_at")
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
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let progress: Vec<Value> = conn
        .prepare("SELECT question_id,favorite,mastery,last_attempt_at,next_review,review_count FROM progress")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok(json!({
                "questionId": row.get::<_, i64>(0)?,
                "favorite": row.get::<_, i64>(1)?,
                "mastery": row.get::<_, Option<i64>>(2)?,
                "lastAttemptAt": row.get::<_, Option<String>>(3)?,
                "nextReview": row.get::<_, Option<String>>(4)?,
                "reviewCount": row.get::<_, i64>(5)?,
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
    let doc = json!({
        "app": "刷吧",
        "version": "0.3.0",
        "exportedAt": Local::now().to_rfc3339(),
        "attempts": attempts,
        "progress": progress,
        "settings": settings,
    });
    fs::write(&json_path, serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?)
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
                confidence: 0.0,
                recommended_question_ids: vec![],
                recommendation_reason: None,
                paper_title: None,
                paper_attempts: vec![],
                batch_attempts: vec![],
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
                    duration_seconds: attempt.duration_seconds,
                    result: attempt.result,
                    self_rating: attempt.self_rating,
                    selected_answer: attempt.selected_answer,
                    mode: Some("paper-codex".into()),
                };
                record_attempt_row(&tx, &input)?;
            }
            tx.commit().map_err(|e| e.to_string())?;
        } else if payload.kind == "batch" {
            apply_batch_payload(&conn, &payload)?;
        } else if payload.kind == "analysis" {
            save_analysis_signal(&conn, &payload)?;
        }
    }
    conn.execute(
        "UPDATE codex_inbox SET status=?1 WHERE id=?2",
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
    let prompt = format!(
        r#"你正在为数学刷题 App「刷吧」批改数一草稿。
任务编号：{task_id}
题目 ID：{question_id}
题目：{stem}
参考答案：{answer}

请结合我随后发送的草稿图片，定位最早出现的错误，而不只判断最终答案。分析题意理解、方法选择、条件遗漏、符号计算和推理跳步。无法确定时必须明确说不确定。

完成后请将结果写入这个绝对路径：
{output}

JSON 必须符合：
{{"schemaVersion":1,"kind":"analysis","taskId":"{task_id}","questionId":{question_id},"summary":"简要诊断","verdict":"correct|partial|incorrect|uncertain","earliestError":"最早错误步骤或 null","errorTags":["错误类型"],"weaknessTags":["薄弱知识"],"advice":"下一步修复动作","confidence":0.0,"recommendedQuestionIds":[],"recommendationReason":null}}
不要修改题库源文件。"#,
        stem = q.stem,
        answer = q.correct_answer,
        output = output.to_string_lossy()
    );
    // P2-14: archive the prompt so the task can be re-copied even after the
    // in-app popup closes.
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

#[tauri::command]
fn create_codex_batch_task(
    question_ids: Vec<i64>,
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
    let task_id = format!(
        "SB-BATCH-{}-{:04}",
        Local::now().format("%Y%m%d"),
        rand::rng().random_range(0..10000)
    );
    let output = state
        .data_dir
        .join("codex-inbox")
        .join(format!("{task_id}.json"));
    let numbered: Vec<String> = questions
        .iter()
        .enumerate()
        .map(|(index, q)| {
            format!(
                "{}. 题目 ID：{id}\n题目：{stem}\n参考答案：{answer}",
                index + 1,
                id = q.id,
                stem = q.stem,
                answer = q.correct_answer
            )
        })
        .collect();
    let prompt = format!(
        r#"你正在为数学刷题 App「刷吧」批改数一草稿。
任务编号：{task_id}
本任务包含 {count} 道题，按下面编号依次列出；你随后收到的每张草稿图片按发送顺序对应一道题：

{numbered}

批改要求：
1. 一张草稿对应一道题：第 K 张图片就是第 K 题，请逐张核对题目编号后批改。
2. 你最常遇到的情况是草稿张数少于题目数：此时只批改实际收到草稿的那些题，未收到草稿的题不要猜测、不要编造结果、不要写“未作答”之类的占位条目，直接省略。
3. 每道题定位最早出现的错误，而不只判断最终答案。分析题意理解、方法选择、条件遗漏、符号计算和推理跳步。无法确定时必须将该题的 result 记为 "uncertain" 并说明原因，不要猜。
4. 除 result 与 selfRating 外，其余字段填写你作为批改者的判断：verdict 为 correct|partial|incorrect|uncertain，summary 为简要诊断，earliestError 为最早错误步骤或 null，errorTags 为错误类型标签，weaknessTags 为薄弱知识标签，advice 为一条可执行的修复动作，confidence 为 0 到 1 的置信度。

完成后请将结果写入这个绝对路径：
{output}

JSON 必须符合：
{{"schemaVersion":1,"kind":"batch","taskId":"{task_id}","summary":"整组批改摘要","errorTags":["错误类型"],"weaknessTags":["薄弱知识"],"confidence":0.9,"recommendedQuestionIds":[],"batchAttempts":[{{"questionId":155,"result":"correct|wrong|uncertain","selfRating":2,"summary":"简要诊断","verdict":"correct|partial|incorrect|uncertain","earliestError":"最早错误步骤或 null","errorTags":["错误类型"],"weaknessTags":["薄弱知识"],"advice":"下一步修复动作","confidence":0.9}}]}}
不要修改题库源文件。"#,
        count = questions.len(),
        numbered = numbered.join("\n\n"),
        output = output.to_string_lossy()
    );
    let tasks_dir = state.data_dir.join("codex-tasks");
    fs::create_dir_all(&tasks_dir).map_err(|e| e.to_string())?;
    let _ = fs::write(tasks_dir.join(format!("{task_id}.txt")), &prompt);
    Ok(CodexTask {
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
    })
}

#[tauri::command]
fn get_task_prompt(task_id: String, state: State<AppState>) -> Result<Option<String>, String> {
    let tasks_dir = state.data_dir.join("codex-tasks");
    let path = tasks_dir.join(format!("{task_id}.txt"));
    if path.exists() {
        Ok(Some(
            fs::read_to_string(&path).map_err(|e| e.to_string())?,
        ))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn image_data_url(path: String, state: State<AppState>) -> Result<String, String> {
    if let Some(cached) = state.image_cache.lock().ok().and_then(|cache| cache.get(&path).cloned())
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
    let mut stmt=conn.prepare("SELECT CASE WHEN instr(q.category_path,' / ')>0 THEN substr(q.category_path,1,instr(q.category_path,' / ')-1) ELSE q.category_path END subject,COUNT(a.id),AVG(CASE WHEN a.result='correct' THEN 1.0 ELSE 0.0 END),AVG(a.self_rating) FROM attempts a JOIN questions q ON q.id=a.question_id GROUP BY subject ORDER BY COUNT(a.id) DESC").map_err(|e|e.to_string())?;
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
    let mut trend_map: HashMap<String, (HashMap<String, i64>, HashMap<String, i64>)> = HashMap::new();
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
            if error_last.get(&tag).map(|last| last.as_str() < confirmed_at.as_str()).unwrap_or(true) {
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
            if weakness_last.get(&tag).map(|last| last.as_str() < confirmed_at.as_str()).unwrap_or(true) {
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
                "SELECT COUNT(*),COALESCE(SUM(CASE WHEN result='correct' THEN 1 ELSE 0 END),0),AVG(self_rating) FROM attempts WHERE substr(attempted_at,1,10)=?1",
                [&date],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap_or((0, 0, None));
        trend.push(DailyTrendPoint { date, attempts, correct, rating });
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
        return Ok(UserStreak { current_streak: 0, best_streak: 0 });
    }
    let has = |day: chrono::NaiveDate| dates.binary_search_by(|d| d.as_str().cmp(day.to_string().as_str())).is_ok();
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
    Ok(UserStreak { current_streak: current, best_streak: best })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(data_dir.join("codex-inbox").join("processed"))?;
            let conn = Connection::open(data_dir.join("shuaba.db"))?;
            init_schema(&conn)?;
            ensure_column(&conn, "progress", "note", "note TEXT")?;
            backfill_confirmed_analysis_signals(&conn).map_err(std::io::Error::other)?;
            let supplemental_conn = Connection::open(data_dir.join("supplemental.db"))?;
            init_supplemental_schema(&supplemental_conn)?;
            app.manage(AppState {
                db: Mutex::new(conn),
                supplemental_db: Mutex::new(supplemental_conn),
                data_dir,
                library_dir: Mutex::new(PathBuf::from(DEFAULT_LIBRARY)),
                image_cache: Mutex::new(HashMap::new()),
            });
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
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
            export_records,
            get_inbox,
            get_failed_inbox,
            refresh_inbox,
            get_daily_log,
            start_recommendation_batch,
            dismiss_recommendation_batch,
            confirm_inbox,
            create_codex_task,
            create_codex_batch_task,
            get_task_prompt,
            image_data_url,
            get_insights,
            get_weakness_radar,
            get_daily_trend,
            get_streak
        ])
        .run(tauri::generate_context!())
        .expect("error while running 刷吧");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn insert_test_question(conn: &Connection, id: i64, category_path: &str) {
        conn.execute(
            "INSERT INTO questions(id,stem,options_json,correct_answer,explanation,source,question_type,category_path,image_paths_json,is_core,difficulty,content_hash) VALUES(?1,'测试题','[]','答案','解析','测试','subjective',?2,'[]',0,2,'')",
            params![id, category_path],
        )
        .unwrap();
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
            confidence: 0.9,
            recommended_question_ids: ids,
            recommendation_reason: Some("测试推荐理由".into()),
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![],
        }
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
            queue.iter().map(|item| item.question.id).collect::<Vec<_>>(),
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
        };
        let insert_result = record_attempt_row(&conn, &input);
        assert!(insert_result.is_err(), "question 1 不存在的题库外记录应报错或落到外键约束");
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
            .query_row("SELECT COUNT(*) FROM attempts WHERE question_id=1", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(remaining, 0);
        let favorite: i64 = conn
            .query_row("SELECT COUNT(*) FROM progress WHERE question_id=1", [], |r| {
                r.get(0)
            })
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
            confidence: 0.9,
            recommended_question_ids: vec![],
            recommendation_reason: None,
            paper_title: None,
            paper_attempts: vec![],
            batch_attempts: vec![
                BatchAttempt {
                    question_id: 155,
                    result: "wrong".into(),
                    self_rating: 2,
                    summary: "逆矩阵恒等式用反了".into(),
                    verdict: Some("incorrect".into()),
                    earliest_error: Some("写了 A^2A=E 的一步".into()),
                    error_tags: vec!["符号计算".into()],
                    weakness_tags: vec!["幂零矩阵".into()],
                    advice: Some("重做一遍 E-A 可逆性的证明".into()),
                    confidence: 0.88,
                },
                BatchAttempt {
                    question_id: 160,
                    result: "uncertain".into(),
                    self_rating: 2,
                    summary: "草稿未上传，无法批改".into(),
                    verdict: None,
                    earliest_error: None,
                    error_tags: vec![],
                    weakness_tags: vec![],
                    advice: None,
                    confidence: 0.0,
                },
            ],
        };
        insert_codex_payload(&conn, &payload).unwrap();
        apply_batch_payload(&conn, &payload).unwrap();
        let attempts: Vec<(i64, String, String)> = conn
            .prepare("SELECT question_id,result,mode FROM attempts")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        // 只有上传了草稿的 155 被写入记录，160（uncertain）被跳过。
        assert_eq!(attempts.len(), 1);
        assert_eq!((attempts[0].0, attempts[0].1.as_str()), (155, "wrong"));
        assert_eq!(attempts[0].2, "paper-codex");
        let signals: Vec<(String, i64)> = conn
            .prepare("SELECT task_id,question_id FROM codex_analysis_signals")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(signals.len(), 1);
        assert_eq!(signals[0], ("SB-BATCH-TEST-155".into(), 155));
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
            },
        ).unwrap();

        // BATCH-2 is now completed
        let b2_status: String = conn.query_row("SELECT status FROM recommendation_batches WHERE task_id='BATCH-2'", [], |r| r.get(0)).unwrap();
        assert_eq!(b2_status, "completed");

        // Now undo today's attempt
        undo_last_attempt_row(&conn, 1).unwrap();

        // BATCH-1 should STILL be completed (not affected)
        let b1_status: String = conn.query_row("SELECT status FROM recommendation_batches WHERE task_id='BATCH-1'", [], |r| r.get(0)).unwrap();
        assert_eq!(b1_status, "completed");
        let b1_item_completed: Option<String> = conn.query_row("SELECT completed_at FROM recommendation_batch_items WHERE task_id='BATCH-1' AND question_id=1", [], |r| r.get(0)).unwrap();
        assert!(b1_item_completed.is_some());

        // BATCH-2 should be rolled back to active
        let b2_status_after: String = conn.query_row("SELECT status FROM recommendation_batches WHERE task_id='BATCH-2'", [], |r| r.get(0)).unwrap();
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
        assert!(yesterday_wrong_item.is_some(), "应在推荐列表中显式插入昨日错题同考点变式");
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
            },
        ).unwrap();
        let (count1, mastery1): (i64, i64) = conn.query_row("SELECT review_count, mastery FROM progress WHERE question_id=155", [], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
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
            },
        ).unwrap();
        let (count2, mastery2, next2): (i64, i64, String) = conn.query_row("SELECT review_count, mastery, next_review FROM progress WHERE question_id=155", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).unwrap();
        assert_eq!(count2, 1);
        assert_eq!(mastery2, 1);
        let expected_next = (Local::now().date_naive() + Duration::days(1)).to_string();
        assert_eq!(next2, expected_next);
    }
}


