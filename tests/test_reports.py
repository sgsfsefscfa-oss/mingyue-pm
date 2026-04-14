def _setup(client):
    client.post("/api/projects", json={"id": "p", "name": "P", "color": "#000", "icon": "", "short": "P", "desc": "", "sort_order": 0})
    client.post("/api/tasks", json={"title": "完成任务", "project": "p", "status": "completed", "due_date": "2026-04-14"})
    client.post("/api/tasks", json={"title": "进行任务", "project": "p", "status": "running",   "due_date": "2026-04-14"})
    client.post("/api/tasks", json={"title": "未来任务", "project": "p", "status": "pending",   "due_date": "2026-06-01"})


def test_daily_report_returns_html(client):
    _setup(client)
    resp = client.get("/reports/daily")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "日报" in resp.text


def test_weekly_report_returns_html(client):
    _setup(client)
    resp = client.get("/reports/weekly")
    assert resp.status_code == 200
    assert "周报" in resp.text


def test_monthly_report_returns_html(client):
    _setup(client)
    resp = client.get("/reports/monthly")
    assert resp.status_code == 200
    assert "月报" in resp.text
