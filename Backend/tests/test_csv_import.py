import io
import pytest
from test_authorization import get_auth_token

def test_csv_upload_requires_auth(client):
    csv_data = "project_title,task_title,task_description,status,priority,due_date,assignee_email\n"
    res = client.post("/csv/upload", files={"file": ("tasks.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")})
    assert res.status_code == 401


def test_csv_upload_invalid_extension(client):
    token, _ = get_auth_token(client, "CSV User 1", "csvuser1@example.com")
    res = client.post(
        "/csv/upload",
        files={"file": ("tasks.txt", io.BytesIO(b"hello"), "text/plain")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 400
    assert "Only CSV files" in res.json()["detail"]


def test_csv_upload_create_and_update(client):
    token, user = get_auth_token(client, "CSV User 2", "csvuser2@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. First upload: Creates a new project and 2 tasks
    csv_v1 = (
        "project_title,task_title,task_description,status,priority,due_date,assignee_email\n"
        "AI Workflow,Build Pipeline,Initial setup of data pipeline,To Do,High,2026-10-15,\n"
        "AI Workflow,Model Training,Train on baseline dataset,To Do,Medium,2026-10-25,\n"
    )

    res1 = client.post(
        "/csv/upload",
        files={"file": ("tasks.csv", io.BytesIO(csv_v1.encode("utf-8")), "text/csv")},
        headers=headers
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["projects_created"] == 1
    assert data1["tasks_created"] == 2
    assert data1["tasks_updated"] == 0
    assert len(data1["errors"]) == 0

    # Verify project exists
    proj_res = client.get("/projects/", headers=headers)
    assert proj_res.status_code == 200
    projects = proj_res.json()
    ai_proj = next((p for p in projects if p["title"] == "AI Workflow"), None)
    assert ai_proj is not None

    # Verify tasks exist in that project
    tasks_res = client.get(f"/tasks/?project_id={ai_proj['id']}", headers=headers)
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert len(tasks) == 2
    pipeline_task = next(t for t in tasks if t["title"] == "Build Pipeline")
    assert pipeline_task["status"] == "To Do"
    assert pipeline_task["priority"] == "High"

    # 2. Second upload: Updates "Build Pipeline" to Done + Urgent, adds a new 3rd task
    csv_v2 = (
        "project_title,task_title,task_description,status,priority,due_date,assignee_email\n"
        "AI Workflow,Build Pipeline,Pipeline completed and validated,Done,Urgent,2026-10-15,\n"
        "AI Workflow,Evaluation,Run benchmark evals,To Do,Medium,2026-10-30,\n"
    )

    res2 = client.post(
        "/csv/upload",
        files={"file": ("tasks_v2.csv", io.BytesIO(csv_v2.encode("utf-8")), "text/csv")},
        headers=headers
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["projects_created"] == 0  # Reused existing project
    assert data2["tasks_created"] == 1    # "Evaluation" created
    assert data2["tasks_updated"] == 1    # "Build Pipeline" updated

    # Verify updated task
    tasks_res2 = client.get(f"/tasks/?project_id={ai_proj['id']}", headers=headers)
    updated_tasks = tasks_res2.json()
    assert len(updated_tasks) == 3
    updated_pipeline = next(t for t in updated_tasks if t["title"] == "Build Pipeline")
    assert updated_pipeline["status"] == "Done"
    assert updated_pipeline["priority"] == "Urgent"
    assert updated_pipeline["description"] == "Pipeline completed and validated"

