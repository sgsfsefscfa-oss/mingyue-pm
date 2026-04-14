def test_list_projects_empty(client):
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_project(client):
    payload = {"id": "test", "name": "测试项目", "color": "#FF0000", "icon": "", "short": "测", "desc": "", "sort_order": 0}
    resp = client.post("/api/projects", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "test"
    assert data["name"] == "测试项目"
    assert "created_at" in data


def test_create_duplicate_project(client):
    payload = {"id": "dup", "name": "A", "color": "#000", "icon": "", "short": "A", "desc": "", "sort_order": 0}
    client.post("/api/projects", json=payload)
    resp = client.post("/api/projects", json=payload)
    assert resp.status_code == 400


def test_update_project(client):
    client.post("/api/projects", json={"id": "p1", "name": "原名", "color": "#000", "icon": "", "short": "P", "desc": "", "sort_order": 0})
    resp = client.put("/api/projects/p1", json={"name": "新名"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "新名"


def test_delete_project_no_tasks(client):
    client.post("/api/projects", json={"id": "del", "name": "删除", "color": "#000", "icon": "", "short": "D", "desc": "", "sort_order": 0})
    resp = client.delete("/api/projects/del")
    assert resp.status_code == 204


def test_delete_project_with_tasks_returns_400(client):
    client.post("/api/projects", json={"id": "busy", "name": "有任务", "color": "#000", "icon": "", "short": "B", "desc": "", "sort_order": 0})
    client.post("/api/tasks", json={"title": "关联任务", "project": "busy"})
    resp = client.delete("/api/projects/busy")
    assert resp.status_code == 400
