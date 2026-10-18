"""Offline checks for project automation; no network or credentials required."""
import copy
import io
import json
import unittest
from unittest.mock import patch
from datetime import datetime, timezone

import project


def issue(number=1, state="OPEN", prs=(), **extra):
    return dict(id=f"I{number}", number=number, title=f"Issue {number}",
                url=f"https://github.com/TommiContursi/Polku/issues/{number}",
                state=state, stateReason=None, createdAt="2026-10-17T10:00:00Z",
                updatedAt="2026-10-17T10:00:00Z", milestone=None, parent=None,
                closedByPullRequestsReferences={"nodes": list(prs),
                    "pageInfo": {"hasNextPage": False}}, **extra)


def pr(number=10, state="OPEN", draft=False, decision=None):
    return dict(number=number, state=state, isDraft=draft,
                reviewDecision=decision, url=f"https://github.com/x/y/pull/{number}")


class StatusTests(unittest.TestCase):
    def test_new_findings_start_in_triage(self):
        self.assertEqual(project.desired_status(issue(), None), "Triage")

    def test_draft_and_changes_requested_remain_in_progress(self):
        for p in [pr(draft=True), pr(decision="CHANGES_REQUESTED")]:
            self.assertEqual(project.desired_status(issue(prs=[p]), "Ready"), "In progress")

    def test_ready_pr_moves_issue_to_review(self):
        self.assertEqual(project.desired_status(issue(prs=[pr()]), "In progress"), "In review")

    def test_one_unfinished_pr_keeps_multi_pr_delivery_in_progress(self):
        for p in [pr(draft=True), pr(decision="CHANGES_REQUESTED")]:
            self.assertEqual(project.desired_status(issue(prs=[pr(), p]), "In review"), "In progress")

    def test_closed_issue_is_done_even_if_it_was_blocked(self):
        self.assertEqual(project.desired_status(issue(state="CLOSED"), "Blocked"), "Done")

    def test_reopened_issue_is_ready_not_done(self):
        self.assertEqual(project.desired_status(issue(), "Done"), "Ready")

    def test_merged_partial_pr_does_not_complete_open_issue(self):
        self.assertEqual(project.desired_status(issue(prs=[pr(state="MERGED")]), "In review"), "Ready")

    def test_closed_unmerged_pr_does_not_complete_issue(self):
        self.assertEqual(project.desired_status(issue(prs=[pr(state="CLOSED")]), "In review"), "Ready")

    def test_blocked_is_preserved_despite_ready_pr(self):
        self.assertEqual(project.desired_status(issue(prs=[pr()]), "Blocked"), "Blocked")

    def test_claim_before_pr_is_preserved(self):
        self.assertEqual(project.desired_status(issue(), "In progress"), "In progress")

    def test_unexpected_legacy_status_fails_instead_of_erasing_priority(self):
        with self.assertRaisesRegex(project.ProjectError, "migrat"):
            project.desired_status(issue(), "Now")


class FakeAPI:
    def __init__(self, issues, items):
        self.issue_data = issues
        self.items = copy.deepcopy(items)
        self.writes = []

    def add_item(self, project_id, content_id):
        item_id = f"new-{content_id}"
        self.items[content_id] = dict(id=item_id, status=None, priority=None)
        self.writes.append(("add", content_id))
        return item_id

    def set_field(self, project_id, item_id, field_id, option_id):
        self.writes.append(("status", item_id, option_id))
        for item in self.items.values():
            if item["id"] == item_id:
                item["status"] = option_id


def snapshot(issues, items):
    return dict(project_id="P", status_field="S",
                options={s: s for s in project.STATUSES}, issues=issues,
                items=items, merged=[], priorities={}, repository="TommiContursi/Polku")


class SyncTests(unittest.TestCase):
    def test_archived_issue_is_reported_but_not_restored(self):
        items = {"I1": dict(id="P1", status="Ready", priority="Later", archived=True)}
        api = FakeAPI([issue(prs=[pr()])], items)
        self.assertEqual(project.reconcile(api, snapshot(api.issue_data, api.items), apply=True), [])
        self.assertEqual(api.writes, [])

    def test_progress_change_preserves_priority(self):
        items = {"I1": dict(id="P1", status="Ready", priority="Later")}
        api = FakeAPI([issue(prs=[pr()])], items)
        project.reconcile(api, snapshot(api.issue_data, api.items), apply=True)
        self.assertEqual(api.items["I1"]["priority"], "Later")

    def test_dry_run_never_writes_even_for_missing_items(self):
        api = FakeAPI([issue()], {})
        changes = project.reconcile(api, snapshot(api.issue_data, api.items), apply=False)
        self.assertEqual(api.writes, [])
        self.assertEqual(changes[0]["to"], "Triage")

    def test_apply_adds_open_issue_and_repeat_is_noop(self):
        api = FakeAPI([issue()], {})
        project.reconcile(api, snapshot(api.issue_data, api.items), apply=True)
        self.assertEqual(api.items["I1"]["status"], "Triage")
        api.writes.clear()
        self.assertEqual(project.reconcile(api, snapshot(api.issue_data, api.items), apply=True), [])
        self.assertEqual(api.writes, [])

    def test_missing_closed_issues_are_not_imported(self):
        api = FakeAPI([issue(state="CLOSED")], {})
        self.assertEqual(project.reconcile(api, snapshot(api.issue_data, api.items), apply=True), [])
        self.assertEqual(api.writes, [])

    def test_validate_entire_plan_before_any_mutation(self):
        items = {"I2": dict(id="P2", status="Now", priority=None)}
        api = FakeAPI([issue(), issue(2)], items)
        with self.assertRaises(project.ProjectError):
            project.reconcile(api, snapshot(api.issue_data, api.items), apply=True)
        self.assertEqual(api.writes, [])


class PaginationTests(unittest.TestCase):
    def test_reads_all_pages(self):
        calls = []
        def fetch(cursor):
            calls.append(cursor)
            return {"nodes": [cursor or "first"], "pageInfo": {
                "hasNextPage": cursor is None, "endCursor": "next"}}
        self.assertEqual(project.pages(fetch), ["first", "next"])
        self.assertEqual(calls, [None, "next"])

    def test_bad_cursor_cannot_loop_or_silently_truncate(self):
        with self.assertRaises(project.ProjectError):
            project.pages(lambda _: {"nodes": [], "pageInfo": {
                "hasNextPage": True, "endCursor": None}})

    def test_nested_pr_overflow_is_reported(self):
        item = issue()
        item["closedByPullRequestsReferences"]["pageInfo"]["hasNextPage"] = True
        with self.assertRaises(project.ProjectError):
            project.desired_status(item, None)


class ReportTests(unittest.TestCase):
    def test_no_recorded_review_is_due_instead_of_inventing_one(self):
        report = project.focus_report(snapshot([], {}), "", {"focus_reviewed_at": None},
            now=datetime(2026, 10, 18, tzinfo=timezone.utc))
        self.assertIn("**Review due.**", report)

    def test_review_is_due_after_three_merges(self):
        data = snapshot([issue(233)], {})
        data["merged"] = [dict(mergedAt="2026-10-18T10:00:00Z") for _ in range(3)]
        report = project.focus_report(data, "", {"focus_reviewed_at": "2026-10-17T00:00:00Z"},
            now=datetime(2026, 10, 18, 12, tzinfo=timezone.utc))
        self.assertIn("**Review due.**", report)

    def test_issue_count_does_not_promote_findings_to_now(self):
        data = snapshot([issue(n) for n in range(50)], {})
        before = copy.deepcopy(data)
        report = project.focus_report(data, "", {}, now=datetime(2026, 10, 18, tzinfo=timezone.utc))
        self.assertEqual(before, data)
        self.assertIn("more; inspect the project", report)

    def test_report_names_current_phase_without_completing_partial_delivery(self):
        data = snapshot([issue(233), issue(286), issue(295)], {
            "I233": dict(id="P1", status="In progress", priority="Now")})
        report = project.focus_report(data,
            "| 1 | **25, calmer planner** | big | Next | #233 | plan |\n",
            {"stale_days": 7, "max_now": 3, "review_after_merges": 3},
            now=datetime(2026, 10, 18, tzinfo=timezone.utc))
        self.assertIn("#233", report)
        self.assertIn("In progress", report)
        self.assertIn("missing", report.lower())
        self.assertNotIn("#233: Done", report)

    def test_closed_roadmap_phase_is_flagged(self):
        data = snapshot([issue(233, state="CLOSED")], {})
        report = project.focus_report(data,
            "| 1 | Phase 25 | big | Next | #233 | plan |\n", {},
            now=datetime(2026, 10, 18, tzinfo=timezone.utc))
        self.assertIn("closed", report.lower())


class APIBoundaryTests(unittest.TestCase):
    def test_snapshot_rejects_missing_priority_before_loading_or_writing_issues(self):
        class MissingPriority(project.GitHub):
            def __init__(self):
                self.config = dict(status_field="Status", priority_field="Priority")
            def project(self):
                return "P"
            def fields(self, _):
                return [dict(id="S", name="Status", options=[dict(name=s, id=s) for s in project.STATUSES])]
        with self.assertRaisesRegex(project.ProjectError, "Priority"):
            MissingPriority().snapshot()

    def test_item_reader_paginates_and_excludes_other_repositories_and_pr_cards(self):
        class ItemReader(project.GitHub):
            def __init__(self):
                self.config = dict(owner="TommiContursi", repository="Polku",
                                   status_field="Status", priority_field="Priority")
                self.calls = []
            def query(self, query, **variables):
                self.calls.append(variables)
                content = dict(id="I1", repository={"nameWithOwner": "TommiContursi/Polku"})
                node = dict(id="P1", isArchived=False, status={"name": "Ready"},
                            priority={"name": "Later"}, content=content)
                if variables["cursor"] is None:
                    nodes = [dict(node, content={}), dict(node, content=dict(id="X", repository={"nameWithOwner": "other/repo"}))]
                else:
                    nodes = [node]
                return {"node": {"items": {"nodes": nodes, "pageInfo": {
                    "hasNextPage": variables["cursor"] is None, "endCursor": "next"}}}}
        api = ItemReader()
        items = api.items("P")
        self.assertEqual(list(items), ["I1"])
        self.assertEqual(items["I1"]["priority"], "Later")
        self.assertEqual(len(api.calls), 2)

    def test_issue_selection_has_no_invalid_graphql_punctuation(self):
        # A literal '+' before the first selected field breaks every live snapshot.
        self.assertTrue(project.ISSUE_FIELDS.lstrip().startswith("id number"))

    def test_graphql_error_rejects_partial_data(self):
        with patch.dict(project.os.environ, {"GH_TOKEN": "test-only"}):
            api = project.GitHub({})
        response = io.BytesIO(json.dumps({"data": {"node": None},
            "errors": [{"message": "Permission denied"}]}).encode())
        with patch.object(project, "urlopen", return_value=response):
            with self.assertRaisesRegex(project.ProjectError, "Permission denied"):
                api.query("query { viewer { login } }")

    def test_verification_rejects_silently_failed_status_write(self):
        class BadAPI:
            def items(self, _):
                return {"I1": dict(id="P1", status="Ready")}
        with self.assertRaisesRegex(project.ProjectError, "could not be verified"):
            project.verify_changes(BadAPI(), {"project_id": "P"},
                [dict(number=1, content_id="I1", to="In review")])


if __name__ == "__main__":
    unittest.main()
