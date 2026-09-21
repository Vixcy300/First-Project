from fastapi.testclient import TestClient
from main import app

def test_register_and_login_success(client):
    register_payload = {
        "name": "Alice",
        "email": "alice@example.com",
        "password": "secret123",
    }

    register_response = client.post("/register", json=register_payload)
    assert register_response.status_code == 200, register_response.text
    created_user = register_response.json()
    assert created_user["email"] == "alice@example.com"
    assert "password" not in created_user

    login_response = client.post(
        "/login",
        json={"email": "alice@example.com", "password": "secret123"},
    )
    assert login_response.status_code == 200, login_response.text
    body = login_response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_duplicate_registration_fails(client):
    register_payload = {
        "name": "Bob",
        "email": "bob@example.com",
        "password": "secret123",
    }
    res1 = client.post("/register", json=register_payload)
    assert res1.status_code == 200

    # Second attempt with same email
    res2 = client.post("/register", json=register_payload)
    assert res2.status_code == 400
    assert "already registered" in res2.json()["detail"].lower()


def test_login_incorrect_password(client):
    client.post(
        "/register",
        json={"name": "Charlie", "email": "charlie@example.com", "password": "password123"},
    )
    login_response = client.post(
        "/login",
        json={"email": "charlie@example.com", "password": "wrongpassword"},
    )
    assert login_response.status_code == 401


def test_get_current_user_requires_token(client):
    response = client.get("/users/me")
    assert response.status_code == 401


def test_get_current_user_with_token(client):
    client.post(
        "/register",
        json={"name": "Alice", "email": "alice@example.com", "password": "secret123"},
    )
    login_response = client.post(
        "/login",
        json={"email": "alice@example.com", "password": "secret123"},
    )
    token = login_response.json()["access_token"]

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["email"] == "alice@example.com"


def test_get_current_user_with_invalid_token(client):
    response = client.get(
        "/users/me",
        headers={"Authorization": "Bearer totally-invalid-token"},
    )
    assert response.status_code == 401
