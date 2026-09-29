import pytest
from fastapi.testclient import TestClient
from main import app
from database import Base, engine, get_db

@pytest.fixture
def auth_headers(client):
    # Register & login user 1
    user_payload = {"name": "Feature Test User", "email": "feature_user@example.com", "password": "password123"}
    client.post("/register", json=user_payload)
    login_res = client.post("/login", json={"email": "feature_user@example.com", "password": "password123"})
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def project_and_task(client, auth_headers):
    # Create project
    proj_res = client.post("/projects/", json={"title": "Feature Project", "description": "Testing new features"}, headers=auth_headers)
    project_id = proj_res.json()["id"]

    # Create task
    task_res = client.post("/tasks/", json={"title": "Master Task", "project_id": project_id, "priority": "High"}, headers=auth_headers)
    task_id = task_res.json()["id"]

    return project_id, task_id

def test_subtask_lifecycle(client, auth_headers, project_and_task):
    _, task_id = project_and_task

    # 1. Create subtask
    sub_res = client.post(f"/tasks/{task_id}/subtasks", json={"title": "Subtask 1"}, headers=auth_headers)
    assert sub_res.status_code == 200
    subtask = sub_res.json()
    assert subtask["title"] == "Subtask 1"
    assert subtask["completed"] is False
    subtask_id = subtask["id"]

    # 2. List subtasks
    list_res = client.get(f"/tasks/{task_id}/subtasks", headers=auth_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 3. Toggle completed
    patch_res = client.patch(f"/subtasks/{subtask_id}", json={"completed": True}, headers=auth_headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["completed"] is True

    # 4. Delete subtask
    del_res = client.delete(f"/subtasks/{subtask_id}", headers=auth_headers)
    assert del_res.status_code == 200

    # 5. Verify deleted
    list_after = client.get(f"/tasks/{task_id}/subtasks", headers=auth_headers)
    assert len(list_after.json()) == 0

def test_notifications_flow(client, auth_headers):
    # 1. Fetch notifications
    notifs_res = client.get("/notifications/", headers=auth_headers)
    assert notifs_res.status_code == 200
    assert isinstance(notifs_res.json(), list)

    # 2. Mark all as read
    read_all_res = client.post("/notifications/read-all", headers=auth_headers)
    assert read_all_res.status_code == 200

def test_project_csv_export(client, auth_headers, project_and_task):
    project_id, _ = project_and_task

    res = client.get(f"/projects/{project_id}/export/csv", headers=auth_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Task Title" in res.text
    assert "Master Task" in res.text

def test_websocket_ping_pong(client):
    with client.websocket_connect("/ws") as websocket:
        websocket.send_text("ping")
        data = websocket.receive_text()
        assert data == "pong"

