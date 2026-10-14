"""Urgency rules with plain in-memory objects; no database needed."""

from datetime import date, timedelta

from app.models import Project, ProjectLabel, ProjectStage, StageStatus
from app.urgency import Flag, dispatch_flag, order_stages, project_flag, sort_key, stage_flag

TODAY = date(2026, 3, 1)


def days(n: int) -> date:
    return TODAY + timedelta(days=n)


def stage(status=StageStatus.in_progress, due=None, position=0) -> ProjectStage:
    return ProjectStage(status=status, due_date=due, position=position)


def project(name="p", stages=(), dispatch=None, p0=False, label=ProjectLabel.company) -> Project:
    return Project(name=name, stages=list(stages), dispatch_date=dispatch, is_p0=p0, label=label)


class TestStageFlag:
    def test_overdue_unfinished_stage_is_red(self):
        assert stage_flag(stage(due=days(-1)), TODAY) == Flag.red

    def test_overdue_but_done_is_not_flagged(self):
        assert stage_flag(stage(StageStatus.done, due=days(-5)), TODAY) == Flag.none

    def test_blocked_is_amber(self):
        assert stage_flag(stage(StageStatus.blocked), TODAY) == Flag.amber

    def test_due_within_three_days_is_amber(self):
        assert stage_flag(stage(due=days(3)), TODAY) == Flag.amber
        assert stage_flag(stage(due=days(4)), TODAY) == Flag.none

    def test_blocked_and_overdue_is_red(self):
        assert stage_flag(stage(StageStatus.blocked, due=days(-1)), TODAY) == Flag.red


class TestDispatchFlag:
    def test_passed_dispatch_is_red(self):
        assert dispatch_flag(project(dispatch=days(-1)), TODAY) == Flag.red

    def test_dispatch_within_seven_days_is_amber(self):
        assert dispatch_flag(project(dispatch=days(7)), TODAY) == Flag.amber
        assert dispatch_flag(project(dispatch=days(8)), TODAY) == Flag.none

    def test_no_dispatch_date(self):
        assert dispatch_flag(project(), TODAY) == Flag.none


def test_project_flag_takes_worst_of_stages_and_dispatch():
    p = project(stages=[stage(StageStatus.blocked), stage(due=days(-2))], dispatch=days(30))
    assert project_flag(p, TODAY) == Flag.red


def ordered(projects):
    return [p.name for p in sorted(projects, key=lambda p: sort_key(p, TODAY))]


class TestOrdering:
    def test_red_beats_p0_beats_nearest_date(self):
        projects = [
            project("near", dispatch=days(10)),
            project("p0", dispatch=days(60), p0=True),
            project("late", dispatch=days(90), stages=[stage(due=days(-1))]),
        ]
        assert ordered(projects) == ["late", "p0", "near"]

    def test_nearest_open_date_includes_unfinished_stage_dates(self):
        projects = [
            project("dispatch-soon", dispatch=days(20)),
            project("stage-soon", dispatch=days(60), stages=[stage(due=days(10))]),
        ]
        assert ordered(projects) == ["stage-soon", "dispatch-soon"]

    def test_done_stage_dates_are_ignored(self):
        projects = [
            project("a", dispatch=days(20)),
            project("b", dispatch=days(60), stages=[stage(StageStatus.done, due=days(5))]),
        ]
        assert ordered(projects) == ["a", "b"]

    def test_personal_after_company_even_if_urgent(self):
        projects = [
            project("personal", label=ProjectLabel.personal, p0=True, dispatch=days(-1)),
            project("company", dispatch=days(100)),
        ]
        assert ordered(projects) == ["company", "personal"]

    def test_projects_without_dates_go_last(self):
        projects = [project("undated"), project("dated", dispatch=days(200))]
        assert ordered(projects) == ["dated", "undated"]


def test_done_stages_move_to_bottom():
    stages = [
        stage(StageStatus.done, position=0),
        stage(StageStatus.in_progress, position=1),
        stage(StageStatus.not_started, position=2),
    ]
    assert [s.position for s in order_stages(stages)] == [1, 2, 0]
