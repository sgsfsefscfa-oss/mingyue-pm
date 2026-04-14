from datetime import datetime, timezone
from . import models


PROJECTS = [
    {"id": "agent",    "name": "AI Agent 打造",   "color": "#C2410C", "icon": "caomeixiong", "short": "Agent", "desc": "场景调研→方案设计→数据协调→开发对接→交付", "sort_order": 0},
    {"id": "hangqing", "name": "行情高手",         "color": "#2563EB", "icon": "niuyouguo",   "short": "行情", "desc": "B端产品全权负责，看板+分析框架",           "sort_order": 1},
    {"id": "tmall",    "name": "天猫合作 Agent",   "color": "#D97706", "icon": "nangua",      "short": "天猫", "desc": "MCP授权对接，维护合作关系",                 "sort_order": 2},
    {"id": "other",    "name": "其他事务",          "color": "#6B7280", "icon": "huacai",      "short": "其他", "desc": "零散任务与临时事项",                       "sort_order": 3},
]

TASKS = [
    {"title": "竞品店铺分析 Skill — L1查询粒度确认",  "project": "agent",    "status": "pending",   "priority": 1, "due_date": "2026-04-11", "notes": "需确认L1级别的查询粒度方案"},
    {"title": "万相台 Agent 投放策略文档迭代",        "project": "agent",    "status": "running",   "priority": 1, "due_date": "2026-04-11", "notes": "V3决策树已完成，待补充新场景"},
    {"title": "天猫 MCP 授权对接跟进",               "project": "tmall",    "status": "blocked",   "priority": 1, "due_date": "2026-04-11", "notes": "平台侧授权接口未开放"},
    {"title": "MCP 需求清单整理发邮件",               "project": "tmall",    "status": "pending",   "priority": 1, "due_date": "2026-04-11", "notes": "先理出完整需求清单，推动跨部门协作"},
    {"title": "抖音短视频模块场景设计",               "project": "hangqing", "status": "pending",   "priority": 2, "due_date": "2026-04-30", "notes": "CEO期望大力扩展，场景设计未启动"},
    {"title": "大有泰评价&商详",                     "project": "agent",    "status": "completed", "priority": 2, "start_date": "2026-04-14", "due_date": "2026-04-14", "notes": "📅 会议 10:00–12:00"},
    {"title": "插件评审",                            "project": "agent",    "status": "completed", "priority": 1, "start_date": "2026-04-15", "due_date": "2026-04-15", "notes": "📅 会议 14:00–16:00"},
]


def seed_db(db) -> None:
    """幂等：仅在 projects 表为空时执行。"""
    if db.query(models.Project).count() > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    for p in PROJECTS:
        db.add(models.Project(**p, created_at=now))
    db.flush()
    for t in TASKS:
        db.add(models.Task(**t, created_at=now, updated_at=now))
    db.commit()
