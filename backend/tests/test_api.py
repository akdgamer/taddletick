from datetime import date

from tests.conftest import TODAY


def create_project(client, **fields):
    body = {"name": "Machine A", "stage_type_ids": [1, 2, 5]} | fields
    response = client.post("/projects", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_stage_catalog_is_seeded(client):
    names = [t["name"] for t in client.get("/stage-types").json()]
    assert names[0] == "PO received"
    assert len(names) == 11


def test_add_stage_type_rejects_duplicates(client):
    assert client.post("/stage-types", json={"name": "Painting"}).status_code == 201
    assert client.post("/stage-types", json={"name": "painting"}).status_code == 409


def test_create_project_with_picked_stages(client):
    project = create_project(client, po_number="PO-123", client_name="Acme")
    assert [s["name"] for s in project["stages"]] == ["PO received", "Ordering parts", "Electrical design"]
    assert [s["position"] for s in project["stages"]] == [0, 1, 2]
    assert all(s["status"] == "not_started" for s in project["stages"])


def test_create_project_rejects_unknown_or_repeated_stages(client):
    assert client.post("/projects", json={"name": "x", "stage_type_ids": [999]}).status_code == 422
    assert client.post("/projects", json={"name": "x", "stage_type_ids": [1, 1]}).status_code == 422


def test_add_stage_to_existing_project(client):
    project = create_project(client)
    response = client.post(f"/projects/{project['id']}/stages", json={"stage_type_id": 9, "due_date": "2026-03-10"})
    assert response.status_code == 201
    assert response.json()["position"] == 3
    # Same stage twice is refused
    assert client.post(f"/projects/{project['id']}/stages", json={"stage_type_id": 9}).status_code == 409


def test_first_stage_added_to_empty_project_gets_position_zero(client):
    project = create_project(client, stage_type_ids=[])
    response = client.post(f"/projects/{project['id']}/stages", json={"stage_type_id": 1})
    assert response.json()["position"] == 0


def test_patch_only_changes_sent_fields(client):
    project = create_project(client, po_number="PO-1", dispatch_date="2026-04-01")
    updated = client.patch(f"/projects/{project['id']}", json={"is_p0": True}).json()
    assert updated["is_p0"] is True
    assert updated["po_number"] == "PO-1"
    assert updated["dispatch_date"] == "2026-04-01"


def test_update_and_delete_stage(client):
    project = create_project(client)
    stage_id = project["stages"][0]["id"]
    response = client.patch(f"/stages/{stage_id}", json={"status": "blocked", "notes": "waiting on supplier"})
    assert response.json()["status"] == "blocked"
    assert client.delete(f"/stages/{stage_id}").status_code == 204
    assert len(client.get(f"/projects/{project['id']}").json()["stages"]) == 2


def test_list_projects_filters_by_completed(client):
    active = create_project(client, name="Active")
    first = create_project(client, name="Done first")
    second = create_project(client, name="Done second")
    client.patch(f"/projects/{first['id']}", json={"is_completed": True})
    client.patch(f"/projects/{second['id']}", json={"is_completed": True})

    completed = client.get("/projects", params={"completed": True}).json()
    # Most recently changed first
    assert [p["name"] for p in completed] == ["Done second", "Done first"]
    assert len(completed[0]["stages"]) == 3

    assert [p["id"] for p in client.get("/projects").json()] == [active["id"]]


def test_restore_completed_project(client):
    project = create_project(client)
    client.patch(f"/projects/{project['id']}", json={"is_completed": True})
    assert client.get("/dashboard").json() == []

    client.patch(f"/projects/{project['id']}", json={"is_completed": False})
    assert [p["id"] for p in client.get("/dashboard").json()] == [project["id"]]


def test_patch_can_clear_optional_fields(client):
    project = create_project(client, po_number="PO-1", dispatch_date="2026-04-01")
    updated = client.patch(f"/projects/{project['id']}", json={"po_number": None, "dispatch_date": None}).json()
    assert updated["po_number"] is None
    assert updated["dispatch_date"] is None


def test_delete_project_removes_its_stages(client):
    project = create_project(client)
    assert client.delete(f"/projects/{project['id']}").status_code == 204
    assert client.get(f"/projects/{project['id']}").status_code == 404


def test_dashboard_orders_flags_and_hides_completed(client):
    calm = create_project(client, name="Calm", dispatch_date="2026-05-01")
    late = create_project(client, name="Late", dispatch_date="2026-06-01")
    done = create_project(client, name="Done", dispatch_date="2026-03-02")

    client.patch(f"/stages/{late['stages'][1]['id']}", json={"due_date": "2026-02-20"})
    client.patch(f"/stages/{late['stages'][0]['id']}", json={"status": "done"})
    client.patch(f"/projects/{done['id']}", json={"is_completed": True})

    dashboard = client.get("/dashboard").json()
    assert [p["name"] for p in dashboard] == ["Late", "Calm"]

    late_tile = dashboard[0]
    assert late_tile["flag"] == "red"
    assert late_tile["days_to_dispatch"] == (date(2026, 6, 1) - TODAY).days
    # Done stage moved to the bottom; the overdue one is flagged
    assert [s["name"] for s in late_tile["stages"]] == ["Ordering parts", "Electrical design", "PO received"]
    assert late_tile["stages"][0]["flag"] == "red"

    assert dashboard[1]["id"] == calm["id"]
    assert dashboard[1]["flag"] == "none"
