#!/usr/bin/env python3
"""刷吧 v1.5.0 学习闭环只读回放/结构审计工具。

本工具只读取 SQLite，不向数据库写入任何内容。若使用 --json PATH，工具会
独占创建一个新的报告文件；它不会覆盖已有文件，也不会自动创建目录。
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

TOOL_VERSION = "1.2.0"
DEFAULT_DB = Path(os.environ.get("APPDATA", "")) / "com.shuaba.math" / "shuaba.db"
LOW_CONFIDENCE = 0.75
FULL_CONFIDENCE = 0.90
DELAYED_REVIEW_HOURS = 24
RECENT_ERROR_DAYS = 14
BENCHMARK_SECONDS = {
    "single": 180, "choice": 180, "multiple": 240, "multi": 240,
    "fill": 300, "blank": 300, "solution": 600, "answer": 600,
}
VALID_OUTCOMES = {"correct", "partial", "wrong", "incorrect", "uncertain"}
PRESSURE_MODES = {"pressure", "ranked", "pressure-ranked", "pressure_ranked", "blitz"}
VARIANT_COLUMNS = {"is_variant", "variant", "transfer", "transfer_verified", "is_transfer"}
VARIANT_ORIGIN_COLUMNS = {"origin_question_id", "source_question_id", "parent_question_id"}
REVIEW_TASK_COLUMNS = {"review_task_id", "reviewtask_id", "review_started_at", "previous_success_at", "is_delayed_review", "delayed_review", "review_due_at"}
REVIEW_TASK_REQUIRED_FIELDS = {"task_id", "question_id", "delayed_review_required"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="只读回放刷吧历史数据，生成 v1.5.0 学习影子报告与 ELO 结构审计。",
        epilog="数据库始终以 SQLite mode=ro + PRAGMA query_only=ON 打开；--json PATH 会新建一个报告文件，拒绝覆盖已有文件、目录或数据库。",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="SQLite 数据库路径（只读连接，不写入数据库）。")
    parser.add_argument("--json", nargs="?", const="-", metavar="PATH", help="输出 JSON；省略 PATH 或使用 - 时输出到标准输出；指定 PATH 时只允许独占新建文件。")
    parser.add_argument("--limit", type=int, default=20, help="文本报告和 JSON 示例列表最多展示多少条。")
    parser.add_argument("--as-of", metavar="YYYY-MM-DD", help="遗忘/时效估算参考日，默认使用本机当天。")
    return parser.parse_args()


def number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return parsed if math.isfinite(parsed) else None


def safe_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return int(value)
    try:
        parsed = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(parsed) or not parsed.is_integer():
        return None
    try:
        return int(parsed)
    except (OverflowError, ValueError):
        return None


def moment(value: Any) -> Optional[datetime]:
    if value is None or value == "":
        return None
    numeric = number(value)
    if numeric is not None and abs(numeric) >= 100000000:
        seconds = numeric / 1000.0 if abs(numeric) >= 100000000000 else numeric
        try:
            return datetime.fromtimestamp(seconds, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip().replace("Z", "+00:00")
    text = re.sub(r"\.(\d{6})\d+(?=[+-]\d\d:\d\d$)", r".\1", text)
    text = re.sub(r"\.(\d{6})\d+$", r".\1", text)
    try:
        parsed = datetime.fromisoformat(text)
    except (TypeError, ValueError):
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def day(value: Any) -> Optional[date]:
    parsed = moment(value)
    if parsed:
        return parsed.date()
    try:
        return date.fromisoformat(str(value).strip()[:10]) if value else None
    except (TypeError, ValueError):
        return None


def q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def columns(conn: sqlite3.Connection, table: str) -> List[str]:
    return [str(row[1]) for row in conn.execute(f"PRAGMA table_info({q(table)})")]


def tables(conn: sqlite3.Connection) -> List[str]:
    return [str(row[0]) for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]


def rows(conn: sqlite3.Connection, table: str, fields: Sequence[str]) -> List[Dict[str, Any]]:
    present = set(columns(conn, table))
    expressions = [f"{q(name)} AS {q(name)}" if name in present else f"NULL AS {q(name)}" for name in fields]
    cursor = conn.execute(f"SELECT {', '.join(expressions)} FROM {q(table)}")
    names = [item[0] for item in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def open_ro(path: Path) -> sqlite3.Connection:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"数据库不存在：{resolved}")
    conn = sqlite3.connect(resolved.as_uri() + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only=ON")
    if int(conn.execute("PRAGMA query_only").fetchone()[0]) != 1:
        conn.close()
        raise RuntimeError("无法确认 SQLite query_only=1，已中止。")
    return conn


def normalized_outcome(row: Dict[str, Any]) -> str:
    value = str(row.get("outcome") or row.get("result") or "uncertain").lower().strip()
    if value == "incorrect":
        return "wrong"
    return value if value in VALID_OUTCOMES else "uncertain"


def outcome_value(value: str) -> float:
    return {"correct": 1.0, "partial": 0.45, "wrong": 0.0}.get(value, 0.0)


def source(value: Any) -> str:
    normalized = str(value or "unknown").lower().strip()
    return normalized or "unknown"


def is_truthy(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "variant", "transfer", "变式", "迁移"}


def avg(pairs: Iterable[Tuple[float, float]]) -> Optional[float]:
    total = total_weight = 0.0
    for value, weight in pairs:
        if weight > 0 and math.isfinite(value) and math.isfinite(weight):
            total += value * weight
            total_weight += weight
    return total / total_weight if total_weight else None


def recency(attempt_day: Optional[date], as_of: date) -> float:
    if not attempt_day:
        return 0.65
    return max(0.45, 0.985 ** max(0, (as_of - attempt_day).days))


def quality(row: Dict[str, Any], exact_confidence: Optional[float] = None) -> Tuple[float, str, Optional[float]]:
    result = normalized_outcome(row)
    confidence = number(row.get("confidence"))
    if confidence is None:
        confidence = exact_confidence
    if result == "uncertain":
        return 0.0, "不采纳（uncertain）", confidence
    if confidence is None:
        return 0.0, "未记录（不进入核心影子画像）", None
    if confidence < 0.60:
        return 0.0, "人工复核（不进入核心影子画像）", confidence
    if confidence < LOW_CONFIDENCE:
        return 0.0, "仅任务/复核建议（不进入核心影子画像）", confidence
    if confidence < FULL_CONFIDENCE:
        return 0.5, "中质量（0.5 权重）", confidence
    return 1.0, "高质量（1.0 权重）", confidence


def exact_signal_confidences(attempts: Sequence[Dict[str, Any]], signals: Sequence[Dict[str, Any]]) -> Tuple[Dict[int, float], Dict[int, float], Dict[str, int]]:
    by_attempt: Dict[int, float] = {}
    by_diagnosis: Dict[int, float] = {}
    stats = Counter()
    attempt_ids = {safe_int(row.get("id")) for row in attempts}
    diagnosis_ids = {safe_int(row.get("diagnosis_id")) for row in attempts if safe_int(row.get("diagnosis_id")) is not None}
    for signal in signals:
        confidence = number(signal.get("confidence"))
        if confidence is None:
            stats["invalidConfidence"] += 1
            continue
        if not str(signal.get("confirmed_at") or "").strip():
            stats["unconfirmed"] += 1
            continue
        attempt_id = safe_int(signal.get("attempt_id"))
        diagnosis_id = safe_int(signal.get("diagnosis_id"))
        if attempt_id in attempt_ids:
            by_attempt[attempt_id] = max(by_attempt.get(attempt_id, 0.0), confidence)
            stats["confirmedLinkedByAttempt"] += 1
        elif diagnosis_id in diagnosis_ids:
            by_diagnosis[diagnosis_id] = max(by_diagnosis.get(diagnosis_id, 0.0), confidence)
            stats["confirmedLinkedByDiagnosis"] += 1
        else:
            stats["confirmedUnlinked"] += 1
    return by_attempt, by_diagnosis, dict(stats)


def prepare_attempts(attempts: Sequence[Dict[str, Any]], signal_by_attempt: Dict[int, float], signal_by_diagnosis: Dict[int, float]) -> List[Dict[str, Any]]:
    prepared: List[Dict[str, Any]] = []
    for raw in attempts:
        row = dict(raw)
        attempt_id = safe_int(row.get("id"))
        diagnosis_id = safe_int(row.get("diagnosis_id"))
        exact_confidence = signal_by_attempt.get(attempt_id) if attempt_id is not None else None
        if exact_confidence is None and diagnosis_id is not None:
            exact_confidence = signal_by_diagnosis.get(diagnosis_id)
        weight, tier, confidence = quality(row, exact_confidence)
        row.update({"_attempt_id": attempt_id, "_question_id": safe_int(row.get("question_id")), "_date": day(row.get("attempted_at")), "_moment": moment(row.get("attempted_at")), "_outcome": normalized_outcome(row), "_quality": weight, "_tier": tier, "_confidence": confidence, "_exactLinkedSignal": exact_confidence is not None})
        prepared.append(row)
    return prepared


def evidence_summary(attempts: Sequence[Dict[str, Any]], signals: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    tiers, sources, buckets = Counter(), Counter(), Counter()
    examples: List[Dict[str, Any]] = []
    for row in attempts:
        tier, confidence = str(row["_tier"]), row["_confidence"]
        tiers[tier] += 1
        sources[source(row.get("evidence_source"))] += 1
        if confidence is None:
            buckets["未记录（不进入核心影子画像）"] += 1
        elif confidence >= FULL_CONFIDENCE:
            buckets[">= 0.90（1.0 权重）"] += 1
        elif confidence >= LOW_CONFIDENCE:
            buckets["0.75–<0.90（0.5 权重）"] += 1
        elif confidence >= 0.60:
            buckets["0.60–<0.75（仅任务/复核）"] += 1
        else:
            buckets["< 0.60（人工复核）"] += 1
        if row["_quality"] <= 0:
            examples.append({"attemptId": row.get("id"), "questionId": row.get("question_id"), "outcome": row["_outcome"], "source": source(row.get("evidence_source")), "confidence": confidence, "qualityWeight": 0.0, "tier": tier})
    signal_confidences = [value for value in (number(row.get("confidence")) for row in signals) if value is not None]
    return {"attemptCount": len(attempts), "signalCount": len(signals), "coreEligibleAttemptCount": sum(row["_quality"] > 0 for row in attempts), "byEvidenceTier": dict(sorted(tiers.items())), "byEvidenceSource": dict(sorted(sources.items())), "attemptConfidenceBuckets": dict(sorted(buckets.items())), "signalConfidence": {"count": len(signal_confidences), "min": round(min(signal_confidences), 3) if signal_confidences else None, "average": round(sum(signal_confidences) / len(signal_confidences), 3) if signal_confidences else None, "max": round(max(signal_confidences), 3) if signal_confidences else None}, "nonCoreExamples": examples}


def explicit_variant_verified(row: Dict[str, Any]) -> bool:
    flag = any(is_truthy(row.get(name)) for name in VARIANT_COLUMNS)
    origin = next((safe_int(row.get(name)) for name in VARIANT_ORIGIN_COLUMNS if row.get(name) is not None), None)
    question_id = row.get("_question_id")
    return flag and origin is not None and question_id is not None and origin != question_id


def review_task_keys(review_tasks: Sequence[Dict[str, Any]]) -> set[Tuple[str, int]]:
    """Return only explicitly delayed review-task / question bindings.

    A mode label is presentation metadata, not proof that a delayed review happened.
    The replay therefore requires a real review_tasks row with delayed_review_required=1.
    """
    keys: set[Tuple[str, int]] = set()
    for task in review_tasks:
        task_id = str(task.get("task_id") or "").strip()
        question_id = safe_int(task.get("question_id"))
        if task_id and question_id is not None and is_truthy(task.get("delayed_review_required")):
            keys.add((task_id, question_id))
    return keys


def controlled_delayed_review(row: Dict[str, Any], delayed_review_tasks: set[Tuple[str, int]]) -> bool:
    task_id = str(row.get("review_task_id") or row.get("reviewtask_id") or "").strip()
    question_id = row.get("_question_id")
    if (
        not task_id
        or question_id is None
        or (task_id, question_id) not in delayed_review_tasks
        or not row.get("_quality")
        or row.get("_outcome") != "correct"
    ):
        return False
    if row.get("is_delayed_review") is not None and not is_truthy(row.get("is_delayed_review")):
        return False
    # Deliberately do not use mode == 'review' as evidence.  The task binding and
    # timestamps are the controlled proof; mode strings may only be descriptive.
    started = moment(row.get("review_started_at") or row.get("attempted_at"))
    previous = moment(row.get("previous_success_at"))
    return bool(started and previous and started - previous >= timedelta(hours=DELAYED_REVIEW_HOURS))


def estimate_states(attempts: Sequence[Dict[str, Any]], questions: Dict[int, Dict[str, Any]], progress: Dict[int, Dict[str, Any]], delayed_review_tasks: set[Tuple[str, int]], as_of: date) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    labels: Dict[str, str] = {}
    for row in attempts:
        question_id = row["_question_id"]
        question = questions.get(question_id or -1, {})
        category = str(question.get("category_path") or "").strip()
        if category:
            key, label = f"category:{category}", category
        elif question_id is not None:
            key, label = f"question:{question_id}", f"题目 #{question_id}（缺少分类）"
        else:
            key, label = f"attempt:{row.get('_attempt_id') or 'unknown'}", f"作答 #{row.get('_attempt_id') or 'unknown'}（缺少题目与分类）"
        labels[key] = label
        grouped[key].append(row)
    result: List[Dict[str, Any]] = []
    for key, group in grouped.items():
        group.sort(key=lambda item: (item["_moment"] or datetime.min.replace(tzinfo=timezone.utc), item["_attempt_id"] or 0))
        valid = [row for row in group if row["_outcome"] != "uncertain" and row["_quality"] > 0]
        distinct = {row["_question_id"] for row in valid if row["_question_id"] is not None}
        accuracy = avg((outcome_value(row["_outcome"]), row["_quality"] * recency(row["_date"], as_of)) for row in valid)
        volume = min(1.0, math.log1p(len(valid)) / math.log1p(6)) if valid else 0.0
        evidence_factor = 0.65 + 0.35 * volume
        mastery = None if accuracy is None else 100 * accuracy * evidence_factor
        fluency_pairs: List[Tuple[float, float]] = []
        for row in valid:
            question = questions.get(row["_question_id"] or -1, {})
            benchmark = BENCHMARK_SECONDS.get(str(question.get("question_type") or "solution").lower(), 600)
            duration = max(1.0, number(row.get("duration_seconds")) or 1.0)
            speed = max(20.0, min(120.0, 100.0 * benchmark / duration))
            self_rating = number(row.get("fluency_rating")) or number(row.get("self_rating")) or 0.0
            self_score = max(0.0, min(100.0, self_rating * 25.0))
            value = 0.75 * speed + 0.25 * self_score if row["_outcome"] == "correct" else 0.45 * speed if row["_outcome"] == "partial" else 0.0
            fluency_pairs.append((value, row["_quality"] * recency(row["_date"], as_of)))
        fluency_raw = avg(fluency_pairs)
        fluency = None if fluency_raw is None else fluency_raw * evidence_factor
        variant_successes = [row for row in valid if explicit_variant_verified(row) and row["_outcome"] == "correct"]
        variant_verified = bool(variant_successes)
        transfer_raw = avg((outcome_value(row["_outcome"]), row["_quality"] * recency(row["_date"], as_of)) for row in valid if explicit_variant_verified(row))
        transfer = None if transfer_raw is None else 100 * transfer_raw
        delayed_successes = [row for row in valid if controlled_delayed_review(row, delayed_review_tasks)]
        retention_raw = avg((outcome_value(row["_outcome"]), row["_quality"] * recency(row["_date"], as_of)) for row in delayed_successes)
        retention = None if retention_raw is None else 100 * retention_raw
        average_quality = avg((row["_quality"], 1.0) for row in valid)
        confidence = None if average_quality is None else 100 * average_quality * (0.35 + 0.65 * volume) * (0.75 + 0.25 * min(1.0, max(0, len(distinct) - 1) / 3.0))
        recent_cutoff = as_of - timedelta(days=RECENT_ERROR_DAYS)
        recent_failures = [row for row in group if row["_date"] and row["_date"] >= recent_cutoff and row["_outcome"] == "wrong"]
        stable_gate = {"validEvidenceCount": len(valid), "minValidEvidenceCount": 3, "distinctQuestionCount": len(distinct), "minDistinctQuestionCount": 2, "variantVerified": variant_verified, "delayedReviewVerified": bool(delayed_successes), "recentConceptErrorFree": not recent_failures, "confidenceAccepted": confidence is not None and confidence >= 70, "failedReasons": []}
        if len(valid) < 3: stable_gate["failedReasons"].append("valid_evidence_count_below_3")
        if len(distinct) < 2: stable_gate["failedReasons"].append("distinct_question_count_below_2")
        if not variant_verified: stable_gate["failedReasons"].append("variant_not_explicitly_verified")
        if not delayed_successes: stable_gate["failedReasons"].append("controlled_delayed_review_not_verified")
        if recent_failures: stable_gate["failedReasons"].append("recent_concept_error_exists")
        if not stable_gate["confidenceAccepted"]: stable_gate["failedReasons"].append("confidence_not_accepted")
        stable_eligible = not stable_gate["failedReasons"] and (mastery or 0) >= 75 and (transfer or 0) >= 55 and (retention or 0) >= 60
        stable_gate["stableEligible"] = stable_eligible
        if not group: state = "unseen"
        elif not valid: state = "pending_review"
        elif mastery is not None and mastery < 45: state = "remediating"
        elif retention is not None and retention < 55: state = "decaying"
        elif stable_eligible: state = "stable"
        elif mastery is not None and mastery >= 60: state = "unstable"
        else: state = "learning"
        question_ids = [qid for qid in distinct if qid is not None]
        progress_values = [number(progress[qid].get("mastery")) for qid in question_ids if qid in progress and number(progress[qid].get("mastery")) is not None]
        result.append({"category": labels[key], "state": state, "attempts": len(group), "validAttempts": len(valid), "nonCoreAttempts": len(group) - len(valid), "uncertainAttempts": sum(row["_outcome"] == "uncertain" for row in group), "distinctQuestions": len(distinct), "mastery": round(mastery, 1) if mastery is not None else None, "fluency": round(fluency, 1) if fluency is not None else None, "transfer": round(transfer, 1) if transfer is not None else None, "retention": round(retention, 1) if retention is not None else None, "confidence": round(confidence, 1) if confidence is not None else None, "stableEligible": stable_eligible, "stableGate": stable_gate, "legacyProgressMasteryAverage": round(sum(progress_values) / len(progress_values), 2) if progress_values else None, "transferEvidence": "存在明确 origin_question_id + variant 标记的成功证据。" if variant_verified else "不可用：历史没有可验证的结构化变式证据；不同题号不作为迁移代理。", "retentionEvidence": {"delayedReviewCandidates": len(delayed_successes), "attemptIds": [row["_attempt_id"] for row in delayed_successes], "rule": "必须绑定存在且 delayed_review_required=1 的 review_task，并有 >=24 小时时间证据；mode 字符串不构成证明。"}, "latestAttemptAt": max((str(row.get("attempted_at")) for row in group if row.get("attempted_at")), default=None)})
    return sorted(result, key=lambda item: (item["mastery"] is None, item["mastery"] if item["mastery"] is not None else 999, -item["validAttempts"], item["category"]))


def audit_elo(events: Sequence[Dict[str, Any]], attempts: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """只做结构审计；绝不复制或猜测 ELO expected/delta 公式。"""
    by_attempt = {safe_int(row.get("id")): row for row in attempts if safe_int(row.get("id")) is not None}
    ordering_uncertain = any(moment(row.get("created_at")) is None for row in events)
    ordered = sorted(events, key=lambda row: (0 if moment(row.get("created_at")) else 1, moment(row.get("created_at")) or datetime.max.replace(tzinfo=timezone.utc), safe_int(row.get("id")) or 0))
    metadata_present = any(str(row.get("ruleset_version") or row.get("rulesetVersion") or "").strip() or str(row.get("season_id") or row.get("seasonId") or "").strip() for row in ordered)
    replay_status = "plausible_only" if metadata_present else "unknown"
    issues: List[Dict[str, Any]] = []
    reasons, modes, settled = Counter(), Counter(), defaultdict(list)
    checks = Counter()
    previous_rating: Optional[float] = None
    for event in ordered:
        event_id = safe_int(event.get("id")) or 0
        attempt_id = safe_int(event.get("attempt_id"))
        attempt = by_attempt.get(attempt_id) if attempt_id is not None else None
        reasons[str(event.get("reason") or "<NULL>")] += 1
        if attempt_id is not None: settled[attempt_id].append(event_id)
        if attempt_id is not None and attempt is None:
            checks["missing_attempt"] += 1
            issues.append({"severity": "warning", "eventId": event_id, "check": "missing_attempt", "detail": f"attempt_id={attempt_id} 找不到关联 attempts 记录。"})
        if attempt is not None:
            mode = str(attempt.get("mode") or "<NULL>")
            modes[mode] += 1
            if mode.lower() not in PRESSURE_MODES:
                checks["non_pressure_settled"] += 1
                issues.append({"severity": "warning", "eventId": event_id, "check": "non_pressure_settled", "detail": f"关联 attempt 的 mode={mode!r} 不在压力/排位白名单；这是训练账与竞技账分离的迁移清单，不代表脚本会改写历史。"})
            event_question, attempt_question = safe_int(event.get("question_id")), safe_int(attempt.get("question_id"))
            if event_question is not None and attempt_question is not None and event_question != attempt_question:
                checks["question_link_mismatch"] += 1
                issues.append({"severity": "error", "eventId": event_id, "check": "question_link", "detail": "elo_events.question_id 与 attempts.question_id 不一致。"})
            if normalized_outcome(attempt) == "uncertain":
                checks["uncertain_settled"] += 1
                issues.append({"severity": "warning", "eventId": event_id, "check": "uncertain_settled", "detail": "uncertain 作答产生了 ELO 事件；这是新规则必须阻止的迁移项。"})
            event_at, attempt_at = moment(event.get("created_at")), moment(attempt.get("attempted_at"))
            if event_at and attempt_at and event_at < attempt_at:
                checks["timestamp_order"] += 1
                issues.append({"severity": "warning", "eventId": event_id, "check": "timestamp_order", "detail": "ELO created_at 早于关联 attempt attempted_at。"})
        performance_raw, expected_raw = event.get("performance"), event.get("expected")
        delta_raw, rating_raw = event.get("delta"), event.get("rating_after")
        performance, expected = number(performance_raw), number(expected_raw)
        delta, rating_after = number(delta_raw), number(rating_raw)
        if performance_raw not in (None, "") and (performance is None or not 0.0 <= performance <= 2.5):
            checks["invalid_performance"] += 1
            issues.append({"severity": "error", "eventId": event_id, "check": "performance_value", "detail": f"performance={performance_raw!r} 不是有限数或不在 [0.00, 2.50]。"})
        if expected_raw not in (None, "") and (expected is None or not 0.0 <= expected <= 1.0):
            checks["invalid_expected"] += 1
            issues.append({"severity": "error", "eventId": event_id, "check": "expected_value", "detail": f"expected={expected_raw!r} 不是有限数或不在 [0.00, 1.00]。"})
        if delta_raw not in (None, "") and delta is None:
            checks["invalid_delta"] += 1
            issues.append({"severity": "error", "eventId": event_id, "check": "delta_value", "detail": f"delta={delta_raw!r} 不是有限数。"})
        if rating_raw not in (None, "") and rating_after is None:
            checks["invalid_rating"] += 1
            issues.append({"severity": "error", "eventId": event_id, "check": "rating_value", "detail": f"rating_after={rating_raw!r} 不是有限数。"})
        if delta is not None and rating_after is not None and previous_rating is not None:
            if abs(previous_rating + delta - rating_after) > 0.011:
                checks["chain_discontinuity"] += 1
                issues.append({"severity": "warning", "eventId": event_id, "check": "rating_chain_discontinuity", "detail": "上一条 rating_after + 当前 delta 与 rating_after 不连续；可能是赛季重置、缺失事件或旧规则，未作公式错误判定。"})
            else:
                checks["chain_continuous"] += 1
        if rating_after is not None: previous_rating = rating_after
    for attempt_id, event_ids in {key: value for key, value in settled.items() if len(value) > 1}.items():
        checks["duplicate_settlement"] += 1
        issues.append({"severity": "error", "eventId": event_ids[0], "check": "duplicate_settlement", "detail": f"attempt_id={attempt_id} 对应多个 ELO 事件：{event_ids}。"})
    non_pressure = sum(count for mode, count in modes.items() if mode.lower() not in PRESSURE_MODES)
    if ordering_uncertain:
        issues.append({"severity": "warning", "eventId": None, "check": "ordering_uncertain", "detail": "部分 created_at 缺失或不可解析，已退回 id 作为次序；链审计仅作结构性参考。"})
    return {"eventCount": len(ordered), "initialRatingAssumed": None, "finalRatingFromEvents": round(previous_rating, 3) if previous_rating is not None else None, "byReason": dict(sorted(reasons.items())), "byLinkedAttemptMode": dict(sorted(modes.items())), "linkedNonPressureEvents": non_pressure, "formulaAudit": {"status": replay_status, "strictDeltaReplay": replay_status, "reason": "历史规则版本/赛季边界不足；本工具不复制猜测版 expected 公式。"}, "deltaChecks": {"status": replay_status, "formulaChecked": False, "structuralChecks": dict(sorted(checks.items()))}, "issues": issues, "limitations": ["只检查 attempt/question 引用、时间顺序、有限数值、分数链、非压力模式和重复结算。", "不根据 performance、expected、mastery、难度或 K 值推导 delta；绝不把旧事件套入当前公式。", "没有 rulesetVersion/seasonId 时，公式审计和严格 delta 重放为 unknown；有元数据也只标记 plausible_only，仍不宣称精确重放。", "分数链不连续只作为 warning，可能由赛季重置、历史缺口或旧规则造成，不自动认定数据损坏。", "非压力事件是训练/竞技分离的历史迁移清单，不删除、不重算、不回写。"]}


def uncertain_summary(attempts: Sequence[Dict[str, Any]], signals: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    uncertain: List[Dict[str, Any]] = []
    low: List[Dict[str, Any]] = []
    for row in attempts:
        item = {"attemptId": row.get("id"), "questionId": row.get("question_id"), "attemptedAt": row.get("attempted_at"), "mode": row.get("mode"), "outcome": row["_outcome"], "source": source(row.get("evidence_source")), "confidence": row["_confidence"], "qualityWeight": row["_quality"], "tier": row["_tier"]}
        if row["_outcome"] == "uncertain": uncertain.append(item)
        elif row["_quality"] <= 0: low.append(item)
    low_signals = [{"taskId": row.get("task_id"), "questionId": row.get("question_id"), "confidence": number(row.get("confidence")), "confirmedAt": row.get("confirmed_at"), "attemptId": safe_int(row.get("attempt_id")), "diagnosisId": safe_int(row.get("diagnosis_id"))} for row in signals if number(row.get("confidence")) is not None and number(row.get("confidence")) < LOW_CONFIDENCE]
    return {"uncertainAttempts": {"count": len(uncertain), "items": uncertain}, "lowOrNonCoreAttempts": {"count": len(low), "items": low}, "lowConfidenceSignals": {"count": len(low_signals), "items": low_signals}, "policy": "uncertain 或 confidence<0.75 不进入核心影子画像；0.60–<0.75 只能生成任务/复核建议；0.75–<0.90 使用 0.5 权重；>=0.90 使用 1.0 权重。未确认或无精确关联 signal 单独统计。"}


def build_report(conn: sqlite3.Connection, db_path: Path, as_of: date, limit: int) -> Dict[str, Any]:
    names = tables(conn)
    if "attempts" not in names: raise RuntimeError("数据库缺少 attempts 表，无法回放。")
    optional_tables = ["progress", "elo_events", "codex_analysis_signals", "questions", "review_tasks"]
    missing = [name for name in optional_tables if name not in names]
    attempt_fields = ["id", "question_id", "attempted_at", "duration_seconds", "result", "self_rating", "mode", "outcome", "evidence_source", "fluency_rating", "confidence", "session_id", "diagnosis_id", "ai_rating", "difficulty_multiplier", "is_variant", "variant", "transfer", "transfer_verified", "is_transfer", "origin_question_id", "source_question_id", "parent_question_id", "review_task_id", "review_started_at", "previous_success_at", "is_delayed_review", "delayed_review", "review_due_at"]
    attempts_raw = rows(conn, "attempts", attempt_fields)
    questions_raw = rows(conn, "questions", ["id", "category_path", "question_type", "difficulty"]) if "questions" in names else []
    progress_raw = rows(conn, "progress", ["question_id", "mastery", "last_attempt_at", "next_review", "review_count"]) if "progress" in names else []
    review_tasks = rows(conn, "review_tasks", ["id", "task_id", "question_id", "status", "stage", "delayed_review_required", "last_attempt_id", "next_review_at", "created_at", "updated_at"]) if "review_tasks" in names else []
    delayed_review_tasks = review_task_keys(review_tasks)
    signals = rows(conn, "codex_analysis_signals", ["task_id", "question_id", "confidence", "confirmed_at", "attempt_id", "diagnosis_id", "error_tags_json", "weakness_tags_json"]) if "codex_analysis_signals" in names else []
    events = rows(conn, "elo_events", ["id", "attempt_id", "question_id", "delta", "rating_after", "performance", "expected", "created_at", "session_id", "reason", "ruleset_version", "rulesetVersion", "season_id", "seasonId"]) if "elo_events" in names else []
    questions = {safe_int(row.get("id")): row for row in questions_raw if safe_int(row.get("id")) is not None}
    progress = {safe_int(row.get("question_id")): row for row in progress_raw if safe_int(row.get("question_id")) is not None}
    signal_by_attempt, signal_by_diagnosis, signal_link_stats = exact_signal_confidences(attempts_raw, signals)
    attempts = prepare_attempts(attempts_raw, signal_by_attempt, signal_by_diagnosis)
    state_items = estimate_states(attempts, questions, progress, delayed_review_tasks, as_of)
    attempt_columns = set(columns(conn, "attempts"))
    variant_columns = sorted(attempt_columns.intersection(VARIANT_COLUMNS | VARIANT_ORIGIN_COLUMNS))
    review_columns = sorted(attempt_columns.intersection(REVIEW_TASK_COLUMNS))
    signal_columns = set(columns(conn, "codex_analysis_signals")) if "codex_analysis_signals" in names else set()
    exact_signal_link_available = bool({"attempt_id", "diagnosis_id"}.intersection(signal_columns))
    warnings: List[str] = []
    if missing: warnings.append("缺少相关表：" + "、".join(missing) + "；对应报告区域已降级。")
    if not attempts: warnings.append("attempts 表存在但没有记录：这是空库/新用户状态，不应解释为全部知识点掌握度为 0。")
    if "questions" not in names: warnings.append("缺少 questions 表：无法生成知识点级画像，作答将按 question_id 降级。")
    elif any(not str(questions.get(row["_question_id"] or -1, {}).get("category_path") or "").strip() for row in attempts): warnings.append("部分题目缺少 category_path：这些作答按 question_id 单独降级，不会聚合到共同的‘未分类’技能。")
    if not exact_signal_link_available: warnings.append("codex_analysis_signals 没有 attempt_id/diagnosis_id 精确关联；不会用同题 signal 置信度回填 attempt。")
    if signal_link_stats.get("unconfirmed"): warnings.append(f"有 {signal_link_stats['unconfirmed']} 条 Codex signal 未确认；它们只单独统计，不进入作答质量或影子画像。")
    if signal_link_stats.get("confirmedUnlinked"): warnings.append(f"有 {signal_link_stats['confirmedUnlinked']} 条已确认但未精确关联的 Codex signal；它们只作为未关联诊断统计。")
    if not (VARIANT_COLUMNS & attempt_columns and VARIANT_ORIGIN_COLUMNS & attempt_columns): warnings.append("历史 attempts 没有可验证的结构化 variant/origin 字段：不同题号不作为迁移代理，stableEligible 必须为 false。")
    if not {"review_task_id", "review_started_at", "previous_success_at"}.issubset(attempt_columns): warnings.append("历史 attempts 没有完整 review_task_id + 时间证据：延迟复习影子值不可用；未来必须绑定受控 review_task。")
    if "review_tasks" not in names or not REVIEW_TASK_REQUIRED_FIELDS.issubset(set(columns(conn, "review_tasks")) if "review_tasks" in names else set()): warnings.append("缺少可验证的 review_tasks.task_id/question_id/delayed_review_required 结构：mode 字符串不能冒充受控延迟复习，stableEligible 必须为 false。")
    if "progress" in names: warnings.append("progress 只有当前投影，没有每次结算的规则/掌握度快照；脚本不据此重放 ELO。")
    elo_report = audit_elo(events, attempts)
    if not any(event.get("ruleset_version") or event.get("rulesetVersion") or event.get("season_id") or event.get("seasonId") for event in events): warnings.append("elo_events 未提供 rulesetVersion/seasonId：公式与严格 delta 重放为 unknown，只做结构审计。")
    quality_data = evidence_summary(attempts, signals)
    signal_link_stats.update({"total": len(signals), "confirmed": sum(bool(str(row.get("confirmed_at") or "").strip()) for row in signals), "exactLinkColumnsAvailable": exact_signal_link_available})
    return {"tool": {"name": "replay_v150_learning", "version": TOOL_VERSION, "readOnly": True, "writesDatabase": False, "reportPathMayWriteNewFile": True}, "database": {"path": str(db_path.expanduser().resolve()), "connection": "SQLite URI mode=ro + PRAGMA query_only=ON", "tables": names, "status": "empty" if not attempts else "ok", "schema": {name: columns(conn, name) for name in ("attempts", "progress", "elo_events", "codex_analysis_signals", "questions", "review_tasks") if name in names}}, "asOf": as_of.isoformat(), "asOfTimezone": "local date boundary; timestamp without timezone is interpreted as UTC", "ledgerScope": {"learning": "仅生成学习账影子画像；不回写 skill state、review task 或 recommendation plan。", "competitive": "仅审计既有 elo_events 结构；不重算、不改写 Rating/ELO。", "incentive": "不读取或推导 XP/成就；激励账不参与学习或竞技指标计算。"}, "warnings": warnings, "evidenceQuality": quality_data, "signalLinkage": signal_link_stats, "skillStateEstimates": {"method": {"mastery": "仅使用 outcome 非 uncertain 且 confidence>=0.75 的精确证据；0.75–<0.90 为 0.5 权重。", "fluency": "仅正确/partial 的核心证据结合题型基准时间；wrong 不因自评高而提高流畅度。", "transfer": "仅接受显式 variant + origin_question_id 且 origin 与当前题号不同；历史没有时为不可用。", "retention": "仅接受绑定存在的、delayed_review_required=1 的 review_task，且成功时间间隔 >=24 小时的证据；不使用 mode 字符串作为证明。", "confidence": "仅基于核心证据质量、样本量与题目多样性；低置信度不进入核心影子画像。"}, "totalCategories": len(state_items), "items": state_items[:limit], "allItems": state_items}, "uncertainAndLowConfidence": uncertain_summary(attempts, signals), "eloAudit": elo_report, "historicalVariantStatus": {"variantColumnsDetected": variant_columns, "variantEvidenceUsable": bool((VARIANT_COLUMNS & attempt_columns) and (VARIANT_ORIGIN_COLUMNS & attempt_columns)), "variantEvidenceReason": "只有明确变式字段、origin_question_id 且值域通过校验才可使用；不同 question_id 不构成变式证据。", "delayedReviewColumnsDetected": review_columns, "delayedReviewEvidenceUsable": bool({"review_task_id", "review_started_at", "previous_success_at"}.issubset(attempt_columns) and delayed_review_tasks), "delayedReviewEvidenceReason": "仅接受关联存在的、delayed_review_required=1 的 review_tasks 行与 >=24 小时时间证据；mode 字符串不构成证明。", "message": "历史结构化证据不足时，禁止把影子状态解释为 stable 或变式通关。"}}


def format_value(value: Any) -> str:
    if value is None: return "—"
    if isinstance(value, float): return f"{value:.1f}"
    return str(value)


def text_report(report: Dict[str, Any], limit: int) -> str:
    lines = ["刷吧 v1.5.0 学习闭环：只读回放 / 结构审计报告", "=" * 60, f"数据库：{report['database']['path']}", f"连接保护：{report['database']['connection']}", "数据库写入：否；若指定 --json PATH，只会独占新建报告文件", f"回放参考日：{report['asOf']}（{report['asOfTimezone']}）", "", "[关键限制 / 迁移警告]"]
    lines += ["- " + item for item in report["warnings"]]
    quality_data = report["evidenceQuality"]
    lines += ["", "[旧数据证据质量分层]", f"attempts：{quality_data['attemptCount']}；核心影子画像可采纳：{quality_data['coreEligibleAttemptCount']}；Codex signals：{quality_data['signalCount']}"]
    lines += [f"- {key}：{value}" for key, value in quality_data["byEvidenceTier"].items()]
    lines.append("来源：" + "；".join(f"{key} {value}" for key, value in quality_data["byEvidenceSource"].items()))
    lines.append("attempt 置信度：" + "；".join(f"{key} {value}" for key, value in quality_data["attemptConfidenceBuckets"].items()))
    uncertain = report["uncertainAndLowConfidence"]
    lines += ["", "[uncertain / 低置信度]", f"uncertain attempts：{uncertain['uncertainAttempts']['count']}；非核心 attempts：{uncertain['lowOrNonCoreAttempts']['count']}；低置信度 signals：{uncertain['lowConfidenceSignals']['count']}", "策略：" + uncertain["policy"]]
    for item in uncertain["uncertainAttempts"]["items"][:limit]: lines.append(f"- uncertain attempt #{item['attemptId']} / q{item['questionId']} / {item['attemptedAt']} / {item['source']}")
    lines += ["", "[按知识点的 v1.5.0 影子状态估算]", "注意：只有核心证据会产生五指标；迁移必须有显式关系，延迟复习必须绑定受控任务且 >=24 小时。不同题号或 mode 字符串均不能使 stable gate 通过。", "技能/降级题目 | 状态 | 核心证据 | 掌握 | 流畅 | 迁移 | 保持 | 置信 | stableEligible | 失败原因"]
    for item in report["skillStateEstimates"]["items"]:
        failed = ",".join(item["stableGate"]["failedReasons"]) or "—"
        lines.append(f"{item['category']} | {item['state']} | {item['validAttempts']}/{item['attempts']} | {format_value(item['mastery'])} | {format_value(item['fluency'])} | {format_value(item['transfer'])} | {format_value(item['retention'])} | {format_value(item['confidence'])} | {item['stableEligible']} | {failed}")
    elo = report["eloAudit"]
    lines += ["", "[ELO 结构审计（不做猜测公式重放）]", f"事件：{elo['eventCount']}；事件链末值：{format_value(elo['finalRatingFromEvents'])}；关联非压力模式事件：{elo['linkedNonPressureEvents']}", f"公式审计：{elo['formulaAudit']['status']}；严格 delta 重放：{elo['formulaAudit']['strictDeltaReplay']}", "关联模式：" + "；".join(f"{key} {value}" for key, value in elo["byLinkedAttemptMode"].items()), "结构检查：" + "；".join(f"{key} {value}" for key, value in elo["deltaChecks"]["structuralChecks"].items())]
    if elo["issues"]:
        lines.append(f"结构审计提示（仅列前 {limit} 条；不含猜测公式错误）：")
        lines += [f"- [{item['severity']}] event #{item['eventId']} / {item['check']}：{item['detail']}" for item in elo["issues"][:limit]]
    else: lines.append("未发现结构性引用、数值或重复结算异常。")
    lines += ["审计边界："] + ["- " + item for item in elo["limitations"]]
    lines += ["", "[下一步]", "本工具只做影子分析，不回写数据库、不导入画像、不改变历史 attempts/progress/elo_events。"]
    return "\n".join(lines)


def validate_output_target(output: str, db_path: Path) -> Path:
    target = Path(output).expanduser().resolve()
    resolved_db = db_path.expanduser().resolve()
    if target == resolved_db:
        raise ValueError("拒绝：--json 输出路径不能与数据库路径相同。数据库只读，但报告路径不能覆盖数据库。")
    if target.exists():
        if target.is_dir(): raise IsADirectoryError(f"拒绝：--json 输出路径是目录：{target}")
        raise FileExistsError(f"拒绝：--json 输出文件已存在，不覆盖：{target}")
    if not target.parent.is_dir(): raise FileNotFoundError(f"拒绝：--json 输出目录不存在，不自动创建：{target.parent}")
    return target


def write_json_exclusive(target: Path, payload: str) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0)
    fd = os.open(str(target), flags, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle: handle.write(payload)
    except Exception:
        try: target.unlink()
        except OSError: pass
        raise


def main() -> int:
    namespace = parse_args()
    if namespace.limit <= 0:
        print("错误：--limit 必须大于 0。", file=sys.stderr)
        return 2
    try:
        as_of = date.fromisoformat(namespace.as_of) if namespace.as_of else date.today()
    except ValueError:
        print("错误：--as-of 必须是 YYYY-MM-DD。", file=sys.stderr)
        return 2
    db_path = namespace.db.expanduser().resolve()
    output_target: Optional[Path] = None
    try:
        if namespace.json is not None and namespace.json != "-": output_target = validate_output_target(namespace.json, db_path)
        conn = open_ro(db_path)
        try: report = build_report(conn, db_path, as_of, namespace.limit)
        finally: conn.close()
        payload = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        if namespace.json is None: print(text_report(report, namespace.limit))
        elif namespace.json == "-": print(payload, end="")
        else:
            assert output_target is not None
            try: write_json_exclusive(output_target, payload)
            except FileExistsError: raise FileExistsError(f"拒绝：--json 输出文件在检查后已存在，不覆盖：{output_target}")
            print(f"已独占新建审计 JSON：{output_target}")
    except (OSError, RuntimeError, ValueError, sqlite3.Error) as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
