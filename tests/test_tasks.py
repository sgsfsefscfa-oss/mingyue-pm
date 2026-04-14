def _create_project(client, pid="proj"):
    client.post("/api/projects", json={"id": pid, "name": "测试项目", "color": "#000", "icon": "", "short": "T", "desc": "", "sort_order": 0})


def test_list_tasks_empty(client):
    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_task(client):
    _create_project(client)
    resp = client.post("/api/tasks", json={"title": "新任务", "project": "proj", "priority": 1})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "新任务"
    assert data["status"] == "pending"
    assert data["priority"] == 1
    assert "created_at" in data
    assert "updated_at" in data


def test_update_task_status(client):
    _create_project(client)
    r = client.post("/api/tasks", json={"title": "任务A", "project": "proj"})
    tid = r.json()["id"]
    resp = client.put(f"/api/tasks/{tid}", json={"status": "running"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "running"


def test_update_task_updates_updated_at(client):
    _create_project(client)
    r = client.post("/api/tasks", json={"title": "任务B", "project": "proj"})
    data = r.json()
    tid = data["id"]
    old_ts = data["updated_at"]
    import time; time.sleep(0.01)
    client.put(f"/api/tasks/{tid}", json={"status": "completed"})
    resp = client.get("/api/tasks")
    new_ts = next(t["updated_at"] for t in resp.json() if t["id"] == tid)
    assert new_ts >= old_ts


def test_delete_task(client):
    _create_project(client)
    r = client.post("/api/tasks", json={"title": "删除任务", "project": "proj"})
    tid = r.json()["id"]
    resp = client.delete(f"/api/tasks/{tid}")
    assert resp.status_code == 204
    assert all(t["id"] != tid for t in client.get("/api/tasks").json())


def test_filter_by_project(client):
    _create_project(client, "p1")
    _create_project(client, "p2")
    client.post("/api/tasks", json={"title": "P1任务", "project": "p1"})
    client.post("/api/tasks", json={"title": "P2任务", "project": "p2"})
    resp = client.get("/api/tasks?project=p1")
    assert len(resp.json()) == 1
    assert resp.json()[0]["project"] == "p1"


def test_filter_by_status(client):
    _create_project(client)
    client.post("/api/tasks", json={"title": "待办", "project": "proj", "status": "pending"})
    client.post("/api/tasks", json={"title": "进行中", "project": "proj", "status": "running"})
    resp = client.get("/api/tasks?status=pending")
    assert len(resp.json()) == 1
    assert resp.json()[0]["status"] == "pending"


def test_filter_by_priority(client):
    _create_project(client)
    client.post("/api/tasks", json={"title": "P0任务", "project": "proj", "priority": 0})
    client.post("/api/tasks", json={"title": "P2任务", "project": "proj", "priority": 2})
    resp = client.get("/api/tasks?priority=0")
    assert len(resp.json()) == 1
    assert resp.json()[0]["priority"] == 0


def test_filter_by_due_date(client):
    _create_project(client)
    client.post("/api/tasks", json={"title": "早期任务", "project": "proj", "due_date": "2026-03-01"})
    client.post("/api/tasks", json={"title": "近期任务", "project": "proj", "due_date": "2026-05-01"})
    resp = client.get("/api/tasks?due_date_to=2026-04-01")
    assert len(resp.json()) == 1
    assert "早期" in resp.json()[0]["title"]


def test_update_nonexistent_task(client):
    resp = client.put("/api/tasks/9999", json={"status": "running"})
    assert resp.status_code == 404
