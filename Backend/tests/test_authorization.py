import pytest

def get_auth_token(client, name, email, password="password123"):
    """Helper to register and login a user, returning the JWT token and user dict."""
    reg = client.post("/register", json={"name": name, "email": email, "password": password})
    assert reg.status_code == 200, reg.text
    user_data = reg.json()

    login = client.post("/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return token, user_data


def test_routes_require_authentication(client):
    """Ensure project and task endpoints cannot be accessed without a token."""
    assert client.get("/projects/").status_code == 401
    assert client.post("/projects/", json={"title": "Test"}).status_code == 401
    assert client.get("/tasks/").status_code == 401
    assert client.post("/tasks/", json={"title": "Test", "project_id": 1}).status_code == 401


def test_project_ownership_and_visibility_isolation(client):
    """
    Week 3 Rules:
    - User A creates a project; User A is the owner.
    - User B cannot see or access User A's project.
    """
    token_a, user_a = get_auth_token(client, "Alice", "alice@example.com")
    token_b, user_b = get_auth_token(client, "Bob", "bob@example.com")

    # Alice creates Project Alpha
    res = client.post(
        "/projects/",
        json={"title": "Project Alpha", "description": "Alice's Project"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res.status_code == 200
    project_a = res.json()
    assert project_a["owner_id"] == user_a["id"]

    # Bob lists projects -> should NOT see Project Alpha
    bob_projects_res = client.get("/projects/", headers={"Authorization": f"Bearer {token_b}"})
    assert bob_projects_res.status_code == 200
    bob_project_ids = [p["id"] for p in bob_projects_res.json()]
    assert project_a["id"] not in bob_project_ids

    # Bob tries to view Project Alpha directly -> 403 Forbidden
    bob_view = client.get(f"/projects/{project_a['id']}", headers={"Authorization": f"Bearer {token_b}"})
    assert bob_view.status_code == 403

    # Bob tries to delete Project Alpha -> 403 Forbidden
    bob_del = client.delete(f"/projects/{project_a['id']}", headers={"Authorization": f"Bearer {token_b}"})
    assert bob_del.status_code == 403


def test_project_membership_and_owner_only_delete(client):
    """
    Week 3 Rules:
    - Adding a user to project members allows them to view the project.
    - Non-owners cannot delete the project even if they are members.
    - Only the project owner can delete the project.
    """
    token_a, user_a = get_auth_token(client, "Alice", "alice2@example.com")
    token_b, user_b = get_auth_token(client, "Bob", "bob2@example.com")

    # Alice creates Project Beta
    res = client.post(
        "/projects/",
        json={"title": "Project Beta", "description": "Shared project"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    project_beta = res.json()
    proj_id = project_beta["id"]

    # Alice adds Bob as a member
    add_member_res = client.post(
        f"/projects/{proj_id}/members",
        json={"user_id": user_b["id"]},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert add_member_res.status_code == 200
    member_data = add_member_res.json()
    assert member_data["user_id"] == user_b["id"]

    # Now Bob can view Project Beta
    bob_view = client.get(f"/projects/{proj_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert bob_view.status_code == 200
    assert bob_view.json()["title"] == "Project Beta"

    # Bob is a member, but NOT the owner -> trying to delete must fail with 403
    bob_del = client.delete(f"/projects/{proj_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert bob_del.status_code == 403
    assert "owner" in bob_del.json()["detail"].lower()

    # Alice is the owner -> deleting succeeds with 200
    alice_del = client.delete(f"/projects/{proj_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert alice_del.status_code == 200


def test_task_assignment_validation(client):
    """
    Week 3 Rules:
    - Only project members can create tasks.
    - Task assignment rule: A task can only be assigned to someone who is a member of that project.
    """
    token_a, user_a = get_auth_token(client, "Alice", "alice3@example.com")
    token_b, user_b = get_auth_token(client, "Bob", "bob3@example.com")
    token_c, user_c = get_auth_token(client, "Charlie", "charlie3@example.com")

    # Alice creates Project Gamma
    proj_res = client.post(
        "/projects/",
        json={"title": "Project Gamma"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    proj_id = proj_res.json()["id"]

    # Alice adds Bob as a member (Charlie is NOT a member)
    client.post(
        f"/projects/{proj_id}/members",
        json={"user_id": user_b["id"]},
        headers={"Authorization": f"Bearer {token_a}"}
    )

    # 1. Charlie (non-member) tries to create a task in Project Gamma -> 403
    charlie_task = client.post(
        "/tasks/",
        json={"title": "Charlie's Task", "project_id": proj_id},
        headers={"Authorization": f"Bearer {token_c}"}
    )
    assert charlie_task.status_code == 403

    # 2. Alice tries to assign task to Charlie (non-member) -> 400 Bad Request
    invalid_assign = client.post(
        "/tasks/",
        json={
            "title": "Invalid Assignment",
            "project_id": proj_id,
            "assigned_user_id": user_c["id"]
        },
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert invalid_assign.status_code == 400
    assert "member" in invalid_assign.json()["detail"].lower()

    # 3. Alice assigns task to Bob (who IS a member) -> 200 OK
    valid_task = client.post(
        "/tasks/",
        json={
            "title": "Valid Task for Bob",
            "project_id": proj_id,
            "assigned_user_id": user_b["id"]
        },
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert valid_task.status_code == 200
    created_task = valid_task.json()
    assert created_task["assigned_user_id"] == user_b["id"]

    # 4. Updating a task to assign to a non-member is also rejected with 400
    update_res = client.patch(
        f"/tasks/{created_task['id']}",
        json={"assigned_user_id": user_c["id"]},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert update_res.status_code == 400
    assert "member" in update_res.json()["detail"].lower()

