import pytest
from fastapi.testclient import TestClient
from models.user import User

def test_docs(client: TestClient):
    response = client.get("/docs")
    assert response.status_code == 200

def test_openapi(client: TestClient):
    response = client.get("/openapi.json")
    assert response.status_code == 200

def test_register_login(client: TestClient):
    # Register
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "username": "testuser",
            "email": "test@example.com",
            "password": "secure-password123",
            "role": "CLIENT",
            "college": "Example University"
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data

    # Register duplicate email
    response_dup = client.post(
        "/api/auth/register",
        json={
            "name": "Test User 2",
            "username": "testuser2",
            "email": "test@example.com",
            "password": "secure-password123",
            "role": "CLIENT"
        },
    )
    assert response_dup.status_code == 409

    # Register duplicate username
    response_dup2 = client.post(
        "/api/auth/register",
        json={
            "name": "Test User 3",
            "username": "testuser",
            "email": "test3@example.com",
            "password": "secure-password123",
            "role": "CLIENT"
        },
    )
    assert response_dup2.status_code == 409

    # Login
    login_response = client.post(
        "/api/auth/login",
        data={
            "username": "testuser",
            "password": "secure-password123"
        }
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    assert "access_token" in tokens
    
    # Get me
    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me_response.status_code == 200
    assert me_response.json()["username"] == "testuser"
    
def test_social_and_marketplace(client: TestClient, db):
    # Create user and get token
    client.post(
        "/api/auth/register",
        json={
            "name": "Social User",
            "username": "socialuser",
            "email": "social@example.com",
            "password": "secure-password123",
            "role": "CLIENT"
        },
    )
    # Verify user for posting
    user = db.query(User).filter(User.username == "socialuser").first()
    if user:
        user.is_verified = True
        db.commit()

    login_response = client.post(
        "/api/auth/login",
        data={"username": "socialuser", "password": "secure-password123"}
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create Post
    post_res = client.post("/api/posts", json={"content": "Hello World"}, headers=headers)
    assert post_res.status_code == 200
    post_id = post_res.json()["id"]
    
    # Like Post
    like_res = client.post(f"/api/posts/{post_id}/like", headers=headers)
    assert like_res.status_code == 200
    assert like_res.json()["status"] == "liked"
    
    # Comment
    comment_res = client.post(f"/api/posts/{post_id}/comments", json={"content": "Nice!"}, headers=headers)
    assert comment_res.status_code == 200
    
    # Create Task
    task_res = client.post("/api/tasks", json={
        "title": "Need help",
        "description": "Fix my computer",
        "budget": 50.0,
        "deadline": "2023-12-31T23:59:59"
    }, headers=headers)
    assert task_res.status_code == 200
    task_id = task_res.json()["id"]
    
    # Get Feed
    feed_res = client.get("/api/feed")
    assert feed_res.status_code == 200
    assert len(feed_res.json()) >= 1

def test_phase2_marketplace(client: TestClient):
    # Register Admin
    client.post(
        "/api/auth/register",
        json={
            "name": "Admin User",
            "username": "adminuser",
            "email": "admin@example.com",
            "password": "secure-password123",
            "role": "CLIENT" # Wait, I need an admin user but I can't register one. I will just create one in DB or use a provider for tests.
        },
    )
    
    # Register Provider
    client.post(
        "/api/auth/register",
        json={
            "name": "Provider User",
            "username": "provider",
            "email": "provider@example.com",
            "password": "secure-password123",
            "role": "PROVIDER"
        },
    )
    login_response = client.post(
        "/api/auth/login",
        data={"username": "provider", "password": "secure-password123"}
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Since I can't register admin via API, I will just manually insert category or test without admin. 
    # Wait, the category endpoint requires ADMIN. Let's mock a category in the DB.
    # We can skip category create test and just test if a normal user gets forbidden.
    res = client.post("/api/categories", json={"name": "Tech", "slug": "tech"}, headers=headers)
    assert res.status_code == 403

def test_phase3_orders_and_messaging(client: TestClient, db):
    # Setup Buyer and Seller
    import uuid
    uid = str(uuid.uuid4())[:8]
    res1 = client.post("/api/auth/register", json={
        "name": f"Phase 3 Seller {uid}", "username": f"p3seller_{uid}", "email": f"p3s_{uid}@example.com", 
        "password": "secure-password123", "role": "PROVIDER"
    })
    assert res1.status_code == 200, res1.text
    
    login1 = client.post("/api/auth/login", data={"username": f"p3seller_{uid}", "password": "secure-password123"})
    assert login1.status_code == 200, login1.text
    seller_token = login1.json()["access_token"]
    seller_headers = {"Authorization": f"Bearer {seller_token}"}
    
    res2 = client.post("/api/auth/register", json={
        "name": f"Phase 3 Buyer {uid}", "username": f"p3buyer_{uid}", "email": f"p3b_{uid}@example.com", 
        "password": "secure-password123", "role": "CLIENT"
    })
    assert res2.status_code == 200, res2.text
    
    login2 = client.post("/api/auth/login", data={"username": f"p3buyer_{uid}", "password": "secure-password123"})
    assert login2.status_code == 200, login2.text
    buyer_token = login2.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # Verify seller and buyer for protected operations
    s_user = db.query(User).filter(User.username == f"p3seller_{uid}").first()
    b_user = db.query(User).filter(User.username == f"p3buyer_{uid}").first()
    s_user.is_verified = True
    b_user.is_verified = True
    db.commit()
    
    # Needs a category
    from models.service import Category
    cat = Category(name=f"Cat {uid}", slug=f"cat_{uid}")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    cat_id = cat.id
    
    me_res = client.get("/api/auth/me", headers=seller_headers)
    assert me_res.status_code == 200, f"ME check failed: {me_res.text}"
    print("SELLER ROLE:", me_res.json()["role"])
    
    # Seller creates service
    res = client.post("/api/services", json={"title": f"Serv {uid}", "slug": f"serv_{uid}", "description": "desc", "category_id": cat_id}, headers=seller_headers)
    assert res.status_code == 200, res.text
    serv_id = res.json()["id"]
    
    # Seller adds package
    res = client.post(f"/api/services/{serv_id}/packages", json={"name": "Basic", "price": 100, "delivery_days": 3}, headers=seller_headers)
    assert res.status_code == 200, res.text
    pkg_id = res.json()["id"]
    
    # Publish service
    client.post(f"/api/services/{serv_id}/publish", headers=seller_headers)
    
    # Buyer orders
    res = client.post("/api/orders", json={"service_id": serv_id, "package_id": pkg_id, "requirements": "req"}, headers=buyer_headers)
    assert res.status_code == 200
    order_id = res.json()["id"]
    
    # Seller accepts
    res = client.post(f"/api/orders/{order_id}/accept", headers=seller_headers)
    assert res.status_code == 200
    
    # Seller starts
    client.post(f"/api/orders/{order_id}/start", headers=seller_headers)
    
    # Buyer messages seller
    seller_id = res.json()["seller_id"]
    res = client.post("/api/conversations", json={"participant_id": seller_id, "order_id": order_id}, headers=buyer_headers)
    conv_id = res.json()["id"]
    
    client.post(f"/api/conversations/{conv_id}/messages", json={"content": "Hi!"}, headers=buyer_headers)
    
    # Seller delivers
    client.post(f"/api/orders/{order_id}/deliver", json={"message": "Done!"}, headers=seller_headers)
    
    # Buyer completes
    client.post(f"/api/orders/{order_id}/complete", headers=buyer_headers)
    
    # Buyer reviews
    res = client.post(f"/api/orders/{order_id}/review", json={"rating": 5, "comment": "Great"}, headers=buyer_headers)
    assert res.status_code == 200
    
    # Check notifications
    notifs = client.get("/api/notifications", headers=seller_headers).json()
    assert len(notifs) > 0
    
    # Dashboard check
    dash = client.get("/api/seller/dashboard", headers=seller_headers).json()
    assert dash["completed_orders"] >= 1
    assert dash["revenue"] >= 100

def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "DUMMR API"

def test_auth_bad_password(client: TestClient):
    # Short password (<8 chars)
    res_short = client.post(
        "/api/auth/register",
        json={
            "name": "Short Pwd",
            "username": "shortpwd",
            "email": "short@example.com",
            "password": "short",
            "role": "CLIENT"
        }
    )
    assert res_short.status_code == 422

    # Wrong password on login
    res_wrong = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "wrongpassword123"}
    )
    assert res_wrong.status_code == 401

def test_auth_tokens_and_logout(client: TestClient):
    # Login as testuser
    login_res = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "secure-password123"}
    )
    assert login_res.status_code == 200
    tokens = login_res.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    # Refresh tokens
    ref_res = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == 200
    new_tokens = ref_res.json()
    assert "access_token" in new_tokens

    # Logout with old access token
    logout_res = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert logout_res.status_code == 200

    # Old access token must now be blocked
    blocked_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert blocked_res.status_code == 401

def test_auth_invalid_tokens(client: TestClient):
    # Invalid Bearer token
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-valid-token"})
    assert res.status_code == 401

    # Invalid Refresh token
    res2 = client.post("/api/auth/refresh", json={"refresh_token": "not-a-valid-refresh-token"})
    assert res2.status_code == 401

def test_role_guards(client: TestClient, db):
    import uuid
    uid = str(uuid.uuid4())[:8]

    # Create and verify Client
    client.post("/api/auth/register", json={
        "name": "Guard Client", "username": f"gclient_{uid}", "email": f"gc_{uid}@example.com",
        "password": "secure-password123", "role": "CLIENT"
    })
    c_user = db.query(User).filter(User.username == f"gclient_{uid}").first()
    c_user.is_verified = True
    db.commit()

    c_token = client.post("/api/auth/login", data={"username": f"gclient_{uid}", "password": "secure-password123"}).json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    # Client tries to create a service (requires PROVIDER) -> 403
    res_svc = client.post("/api/services", json={"title": "Unauthorized", "category_id": 1}, headers=c_headers)
    assert res_svc.status_code == 403

    # Create and verify Provider
    client.post("/api/auth/register", json={
        "name": "Guard Provider", "username": f"gprov_{uid}", "email": f"gp_{uid}@example.com",
        "password": "secure-password123", "role": "PROVIDER"
    })
    p_user = db.query(User).filter(User.username == f"gprov_{uid}").first()
    p_user.is_verified = True
    db.commit()

    p_token = client.post("/api/auth/login", data={"username": f"gprov_{uid}", "password": "secure-password123"}).json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}

    # Provider tries to place an order (requires CLIENT) -> 403
    res_ord = client.post("/api/orders", json={"service_id": 1, "package_id": 1}, headers=p_headers)
    assert res_ord.status_code == 403

def test_phase3_categories(client: TestClient, db):
    from models.service import Category
    import uuid
    uid = str(uuid.uuid4())[:8]
    cat = Category(name=f"Design {uid}", slug=f"design_{uid}", description="Graphic Design")
    db.add(cat)
    db.commit()

    res = client.get("/api/categories")
    assert res.status_code == 200
    categories = res.json()
    assert any(c["slug"] == f"design_{uid}" for c in categories)

    cat_detail = client.get(f"/api/categories/{cat.id}")
    assert cat_detail.status_code == 200
    assert cat_detail.json()["name"] == f"Design {uid}"

def test_phase3_services_search_and_pagination(client: TestClient, db):
    import uuid
    uid = str(uuid.uuid4())[:8]
    from models.service import Category

    # Setup category & provider
    cat = Category(name=f"Cat Search {uid}", slug=f"cat_search_{uid}")
    db.add(cat)
    db.commit()
    db.refresh(cat)

    client.post("/api/auth/register", json={
        "name": "Search Provider", "username": f"searchp_{uid}", "email": f"sp_{uid}@example.com",
        "password": "secure-password123", "role": "PROVIDER"
    })
    p_user = db.query(User).filter(User.username == f"searchp_{uid}").first()
    p_user.is_verified = True
    db.commit()

    p_token = client.post("/api/auth/login", data={"username": f"searchp_{uid}", "password": "secure-password123"}).json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}

    # Create published service
    res = client.post("/api/services", json={
        "title": f"Logo Design Specialist {uid}", "slug": f"logo_specialist_{uid}",
        "description": "I create minimalist logos", "category_id": cat.id
    }, headers=p_headers)
    assert res.status_code == 200
    svc_id = res.json()["id"]

    client.post(f"/api/services/{svc_id}/packages", json={"name": "Basic", "price": 45, "delivery_days": 2}, headers=p_headers)
    client.post(f"/api/services/{svc_id}/publish", headers=p_headers)

    # Search by q
    res_search = client.get(f"/api/services?q=Logo%20Design&limit=5")
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert "data" in search_data
    assert "pagination" in search_data
    assert any(s["id"] == svc_id for s in search_data["data"])

    # Search with category filter
    res_cat = client.get(f"/api/services?category={cat.slug}")
    assert res_cat.status_code == 200
    assert any(s["id"] == svc_id for s in res_cat.json()["data"])

def test_phase3_service_crud_and_ownership(client: TestClient, db):
    import uuid
    uid = str(uuid.uuid4())[:8]
    from models.service import Category

    cat = Category(name=f"CRUD Cat {uid}", slug=f"crud_cat_{uid}")
    db.add(cat)
    db.commit()
    db.refresh(cat)

    # Provider 1 (Owner)
    client.post("/api/auth/register", json={
        "name": "Owner Prov", "username": f"owner_{uid}", "email": f"owner_{uid}@example.com",
        "password": "secure-password123", "role": "PROVIDER"
    })
    u1 = db.query(User).filter(User.username == f"owner_{uid}").first()
    u1.is_verified = True
    db.commit()
    t1 = client.post("/api/auth/login", data={"username": f"owner_{uid}", "password": "secure-password123"}).json()["access_token"]
    h1 = {"Authorization": f"Bearer {t1}"}

    # Provider 2 (Attacker)
    client.post("/api/auth/register", json={
        "name": "Other Prov", "username": f"other_{uid}", "email": f"other_{uid}@example.com",
        "password": "secure-password123", "role": "PROVIDER"
    })
    u2 = db.query(User).filter(User.username == f"other_{uid}").first()
    u2.is_verified = True
    db.commit()
    t2 = client.post("/api/auth/login", data={"username": f"other_{uid}", "password": "secure-password123"}).json()["access_token"]
    h2 = {"Authorization": f"Bearer {t2}"}

    # Owner creates service
    svc_res = client.post("/api/services", json={
        "title": f"My Art Service {uid}", "slug": f"my_art_{uid}",
        "description": "Original paintings", "category_id": cat.id
    }, headers=h1)
    assert svc_res.status_code == 200
    svc_id = svc_res.json()["id"]

    # Owner adds package
    pkg_res = client.post(f"/api/services/{svc_id}/packages", json={"name": "Standard", "price": 99, "delivery_days": 5}, headers=h1)
    assert pkg_res.status_code == 200

    # Attacker tries to update owner's service -> 403
    atk_up = client.put(f"/api/services/{svc_id}", json={"title": "Hacked Title"}, headers=h2)
    assert atk_up.status_code == 403

    # Owner updates service via PUT -> 200
    ok_up = client.put(f"/api/services/{svc_id}", json={"title": f"Updated Art Service {uid}"}, headers=h1)
    assert ok_up.status_code == 200
    assert ok_up.json()["title"] == f"Updated Art Service {uid}"

    # Owner publishes and pauses service
    pub_res = client.post(f"/api/services/{svc_id}/publish", headers=h1)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"

    pause_res = client.post(f"/api/services/{svc_id}/pause", headers=h1)
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "PAUSED"

    # Attacker tries to delete -> 403
    atk_del = client.delete(f"/api/services/{svc_id}", headers=h2)
    assert atk_del.status_code == 403

def test_phase3_saved_services_toggle(client: TestClient, db):
    import uuid
    uid = str(uuid.uuid4())[:8]
    from models.service import Category, Service

    cat = Category(name=f"Save Cat {uid}", slug=f"save_cat_{uid}")
    db.add(cat)
    db.commit()

    # User
    client.post("/api/auth/register", json={
        "name": "Saver User", "username": f"saver_{uid}", "email": f"saver_{uid}@example.com",
        "password": "secure-password123", "role": "CLIENT"
    })
    u = db.query(User).filter(User.username == f"saver_{uid}").first()
    u.is_verified = True
    
    # Dummy service
    s = Service(seller_id=u.id, category_id=cat.id, title="Saveable Service", slug=f"saveable_{uid}", description="desc", status="PUBLISHED")
    db.add(s)
    db.commit()
    db.refresh(s)

    t = client.post("/api/auth/login", data={"username": f"saver_{uid}", "password": "secure-password123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {t}"}

    # Toggle Save -> True
    save1 = client.post(f"/api/services/{s.id}/save", headers=h)
    assert save1.status_code == 200
    assert save1.json()["saved"] is True

    # List saved services
    saved_list = client.get("/api/services/saved", headers=h)
    assert saved_list.status_code == 200
    assert any(x["id"] == s.id for x in saved_list.json())

    # Toggle Save again -> False
    save2 = client.post(f"/api/services/{s.id}/save", headers=h)
    assert save2.status_code == 200
    assert save2.json()["saved"] is False

def test_phase3_messaging_permissions(client: TestClient, db):
    import uuid
    uid = str(uuid.uuid4())[:8]

    # User A (Buyer)
    client.post("/api/auth/register", json={
        "name": "User A", "username": f"usera_{uid}", "email": f"ua_{uid}@example.com",
        "password": "secure-password123", "role": "CLIENT"
    })
    ua = db.query(User).filter(User.username == f"usera_{uid}").first()
    ua.is_verified = True
    db.commit()
    ta = client.post("/api/auth/login", data={"username": f"usera_{uid}", "password": "secure-password123"}).json()["access_token"]
    ha = {"Authorization": f"Bearer {ta}"}

    # User B (Seller)
    client.post("/api/auth/register", json={
        "name": "User B", "username": f"userb_{uid}", "email": f"ub_{uid}@example.com",
        "password": "secure-password123", "role": "PROVIDER"
    })
    ub = db.query(User).filter(User.username == f"userb_{uid}").first()
    ub.is_verified = True
    db.commit()
    tb = client.post("/api/auth/login", data={"username": f"userb_{uid}", "password": "secure-password123"}).json()["access_token"]
    hb = {"Authorization": f"Bearer {tb}"}

    # User C (Intruder)
    client.post("/api/auth/register", json={
        "name": "User C", "username": f"userc_{uid}", "email": f"uc_{uid}@example.com",
        "password": "secure-password123", "role": "CLIENT"
    })
    uc = db.query(User).filter(User.username == f"userc_{uid}").first()
    uc.is_verified = True
    db.commit()
    tc = client.post("/api/auth/login", data={"username": f"userc_{uid}", "password": "secure-password123"}).json()["access_token"]
    hc = {"Authorization": f"Bearer {tc}"}

    # A starts conversation with B
    conv_res = client.post("/api/conversations", json={"participant_id": ub.id}, headers=ha)
    assert conv_res.status_code == 200
    conv_id = conv_res.json()["id"]

    # A sends message
    msg_res = client.post(f"/api/conversations/{conv_id}/messages", json={"content": "Hello B!"}, headers=ha)
    assert msg_res.status_code == 200

    # B reads messages
    msgs_for_b = client.get(f"/api/conversations/{conv_id}/messages", headers=hb)
    assert msgs_for_b.status_code == 200
    assert len(msgs_for_b.json()) == 1

    # B marks as read
    read_res = client.post(f"/api/conversations/{conv_id}/read", headers=hb)
    assert read_res.status_code == 200

    # Intruder C tries to read messages -> 403
    atk_msg = client.get(f"/api/conversations/{conv_id}/messages", headers=hc)
    assert atk_msg.status_code == 403

def test_phase3_notifications_flow(client: TestClient, db):
    import uuid
    uid = str(uuid.uuid4())[:8]
    from models.notification import Notification

    client.post("/api/auth/register", json={
        "name": "Notif User", "username": f"notifu_{uid}", "email": f"nu_{uid}@example.com",
        "password": "secure-password123", "role": "CLIENT"
    })
    u = db.query(User).filter(User.username == f"notifu_{uid}").first()
    u.is_verified = True

    # Seed notification
    n = Notification(user_id=u.id, type="TEST_ALERT", title="Test Alert", message="You have an update")
    db.add(n)
    db.commit()
    db.refresh(n)

    t = client.post("/api/auth/login", data={"username": f"notifu_{uid}", "password": "secure-password123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {t}"}

    # Get notifications
    notifs = client.get("/api/notifications", headers=h)
    assert notifs.status_code == 200
    assert len(notifs.json()) >= 1

    # Mark single as read
    read_one = client.patch(f"/api/notifications/{n.id}/read", headers=h)
    assert read_one.status_code == 200
    assert read_one.json()["is_read"] is True

    # Mark all read
    read_all = client.post("/api/notifications/read-all", headers=h)
    assert read_all.status_code == 200

def test_phase5_storage_upload(client: TestClient, db):
    import io
    import uuid
    uid = str(uuid.uuid4())[:8]

    # Register user
    client.post("/api/auth/register", json={
        "name": "Upload User", "username": f"up_{uid}", "email": f"up_{uid}@example.com",
        "password": "secure-password123", "role": "PROVIDER"
    })
    u = db.query(User).filter(User.username == f"up_{uid}").first()
    u.is_verified = True
    db.commit()

    token = client.post("/api/auth/login", data={"username": f"up_{uid}", "password": "secure-password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload valid image
    fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRfakeimagecontent")
    res = client.post(
        "/api/storage/upload",
        files={"file": ("test.png", fake_png, "image/png")},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "url" in data
    assert data["content_type"] == "image/png"

    # Upload invalid file type -> 400
    fake_exe = io.BytesIO(b"MZ\x90\x00fakeexecutable")
    bad_res = client.post(
        "/api/storage/upload",
        files={"file": ("malware.exe", fake_exe, "application/x-dosexec")},
        headers=headers,
    )
    assert bad_res.status_code == 400

def test_phase5_payments_checkout_and_webhook(client: TestClient, db):
    import uuid
    import hmac
    import hashlib
    import json
    uid = str(uuid.uuid4())[:8]
    from models.service import Category, Service, ServicePackage
    from models.order import Order, OrderStatus

    cat = Category(name=f"PayCat_{uid}", slug=f"paycat_{uid}")
    db.add(cat)
    db.commit()

    # Provider
    client.post("/api/auth/register", json={
        "name": "Seller P5", "username": f"sel5_{uid}", "email": f"sel5_{uid}@example.com",
        "password": "secure-password123", "role": "PROVIDER"
    })
    seller = db.query(User).filter(User.username == f"sel5_{uid}").first()
    seller.is_verified = True

    # Client
    client.post("/api/auth/register", json={
        "name": "Buyer P5", "username": f"buy5_{uid}", "email": f"buy5_{uid}@example.com",
        "password": "secure-password123", "role": "CLIENT"
    })
    buyer = db.query(User).filter(User.username == f"buy5_{uid}").first()
    buyer.is_verified = True
    db.commit()

    buyer_token = client.post("/api/auth/login", data={"username": f"buy5_{uid}", "password": "secure-password123"}).json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # Create service, package, order
    svc = Service(title="P5 Service", slug=f"p5_{uid}", description="Pay service", seller_id=seller.id, category_id=cat.id)
    db.add(svc)
    db.commit()
    pkg = ServicePackage(service_id=svc.id, name="Std", price=100.0, delivery_days=3)
    db.add(pkg)
    db.commit()

    order = Order(buyer_id=buyer.id, seller_id=seller.id, service_id=svc.id, package_id=pkg.id, amount=100.0, status=OrderStatus.PENDING)
    db.add(order)
    db.commit()

    # Buyer initiates checkout
    chk_res = client.post("/api/payments/checkout", json={"order_id": order.id, "provider": "mock"}, headers=buyer_headers)
    assert chk_res.status_code == 200
    chk_data = chk_res.json()
    assert chk_data["amount"] == 100.0
    assert chk_data["platform_fee"] == 10.0
    assert chk_data["seller_amount"] == 90.0

    # Mock confirm payment
    conf_res = client.post("/api/payments/mock-confirm", json={"order_id": order.id}, headers=buyer_headers)
    assert conf_res.status_code == 200
    assert conf_res.json()["order_status"] == "CONFIRMED"
    assert conf_res.json()["payment_status"] == "PAID"

    # Query order payments
    payments_res = client.get(f"/api/payments/order/{order.id}", headers=buyer_headers)
    assert payments_res.status_code == 200
    assert len(payments_res.json()) >= 1
    assert payments_res.json()[0]["status"] == "PAID"



