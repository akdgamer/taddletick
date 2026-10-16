"""Activity history: what gets written, and who may read it."""


def summaries(c, **params):
    return [(a["user"]["display_name"] if a["user"] else None, a["summary"])
            for a in c.get("/activity", params=params).json()["items"]]


def test_project_changes_read_as_sentences(client):
    p = client.post("/projects", json={"name": "Press", "stage_type_ids": [1, 2], "dispatch_date": "2026-03-10"}).json()
    client.patch(f"/projects/{p['id']}", json={"dispatch_date": "2026-03-24", "po_number": "77", "is_p0": True})
    client.patch(f"/projects/{p['id']}", json={"dispatch_date": "2026-03-24"})  # no real change: no line
    stage = p["stages"][1]
    client.patch(f"/stages/{stage['id']}", json={"status": "in_progress", "due_date": "2026-03-05"})
    client.post(f"/projects/{p['id']}/notes", json={"body": "Client wants it 50mm higher\nand blue"})

    assert summaries(client, project_id=p["id"]) == [
        ("Boss", "added a note: Client wants it 50mm higher"),
        ("Boss", "updated Ordering parts: Not started → In progress; due date none → 5 Mar 2026"),
        ("Boss", "changed PO none → 77, dispatch date 10 Mar 2026 → 24 Mar 2026; marked it P0"),
        ("Boss", "created the project with 2 stages"),
    ]


def test_payment_lines_only_for_roles_that_see_payments(client, login_as):
    p = client.post("/projects", json={"name": "Press"}).json()
    pay = client.post(f"/projects/{p['id']}/payments",
                      json={"label": "Advance", "expected_amount": 45000, "due_date": "2026-03-10"}).json()
    client.patch(f"/payments/{pay['id']}", json={"received_amount": 45000, "received_date": "2026-03-01"})

    assert [s for _, s in summaries(client)][:2] == ["marked payment Advance received (45,000)",
                                                     "added payment Advance (45,000 due 10 Mar 2026)"]
    member = login_as("Member")
    assert summaries(member) == [("Boss", "created the project")]


def test_personal_projects_and_deletions_stay_private(client, login_as):
    member = login_as("Member")
    mine = member.post("/projects", json={"name": "Garage shelves", "label": "personal"}).json()
    shared = client.post("/projects", json={"name": "Press"}).json()
    assert [s for _, s in summaries(client)] == ["created the project"]  # not the member's personal one
    assert len(summaries(member)) == 2

    client.delete(f"/projects/{shared['id']}")
    assert summaries(client) == [("Boss", "deleted the project")]  # its history went with it
    assert summaries(member) == [("Member", "created the project")]  # only their own personal project
    assert mine


def test_filter_by_person_and_paging(client, login_as):
    member = login_as("Member")
    p = client.post("/projects", json={"name": "Press"}).json()
    for i in range(5):
        member.post(f"/projects/{p['id']}/notes", json={"body": f"note {i}"})
    page = client.get("/activity", params={"user_id": 2, "limit": 3}).json()
    assert [a["summary"] for a in page["items"]] == ["added a note: note 4", "added a note: note 3", "added a note: note 2"]
    rest = client.get("/activity", params={"user_id": 2, "limit": 3, "before": page["next_before"]}).json()
    assert [a["summary"] for a in rest["items"]] == ["added a note: note 1", "added a note: note 0"]
    assert rest["next_before"] is None
