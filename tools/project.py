#!/usr/bin/env python3
"""Project progress and focus checks. Standard library only; no AI calls."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STATUSES = ("Triage", "Ready", "In progress", "In review", "Blocked", "Done")
PRIORITIES = ("Now", "Next", "Later", "Someday")
ISSUE_FIELDS = """
  id number title url state stateReason createdAt updatedAt
  milestone { title } parent { number title }
  closedByPullRequestsReferences(first:100, includeClosedPrs:true) {
    nodes { number url state isDraft reviewDecision }
    pageInfo { hasNextPage endCursor }
  }
"""


class ProjectError(RuntimeError):
    pass


def pages(fetch):
    """Read a complete connection, or fail rather than use a partial snapshot."""
    result, cursor, seen = [], None, set()
    while True:
        connection = fetch(cursor)
        result.extend(n for n in connection["nodes"] if n is not None)
        page = connection["pageInfo"]
        if not page["hasNextPage"]:
            return result
        cursor = page.get("endCursor")
        if not cursor or cursor in seen:
            raise ProjectError("Pagination returned no new cursor; snapshot is incomplete")
        seen.add(cursor)


def desired_status(issue, current):
    if current is not None and current not in STATUSES:
        raise ProjectError(f"#{issue['number']}: migrate legacy Status '{current}' to Priority first")
    linked = issue["closedByPullRequestsReferences"]
    if linked["pageInfo"]["hasNextPage"]:
        raise ProjectError(f"#{issue['number']}: more than 100 linked PRs; cannot infer progress safely")
    if issue["state"] == "CLOSED":
        return "Done"
    if current == "Blocked":
        return current
    active = [p for p in linked["nodes"] if p["state"] == "OPEN"]
    if active:
        unfinished = any(p["isDraft"] or p["reviewDecision"] == "CHANGES_REQUESTED" for p in active)
        return "In progress" if unfinished else "In review"
    if current in ("Done", "In review"):
        return "Ready"
    return current or "Triage"


def reconcile(api, data, apply=False):
    """Validate all changes first. Default mode performs no mutations."""
    changes = []
    for issue in data["issues"]:
        item = data["items"].get(issue["id"])
        if not item and issue["state"] != "OPEN":
            continue
        if item and item.get("archived"):
            continue
        current = item["status"] if item else None
        target = desired_status(issue, current)
        if not item or current != target:
            changes.append(dict(number=issue["number"], content_id=issue["id"],
                                item_id=item["id"] if item else None,
                                before=current, to=target))
    for change in changes if apply else []:
        item_id = change["item_id"] or api.add_item(data["project_id"], change["content_id"])
        api.set_field(data["project_id"], item_id, data["status_field"], data["options"][change["to"]])
    return changes


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def focus_report(data, roadmap, config, now=None):
    now = now or datetime.now(timezone.utc)
    issues = {i["number"]: i for i in data["issues"]}
    opened = [i for i in issues.values() if i["state"] == "OPEN"]
    rows = []
    for line in roadmap.splitlines():
        if re.match(r"^\|\s*\d+\s*\|", line):
            cells = line.split("|")
            number = re.search(r"#(\d+)", cells[5])
            if number:
                rows.append((int(number[1]), cells[2].strip()))
    live_phases = [(n, title) for n, title in rows if n in issues and issues[n]["state"] == "OPEN"]
    lines = ["# Polku focus check", "", f"Checked at {now.isoformat(timespec='minutes')}.", ""]
    if live_phases:
        n, title = live_phases[0]
        lines += [f"First open phase in the approved roadmap: **{title}**, #{n}."]
    else:
        lines += ["No open phase could be matched to the roadmap. Review the phase order before selecting work."]
    lines += ["This report checks evidence; it does not change priority or approve a new delivery.", ""]

    def item_for(i):
        return data["items"].get(i["id"], {})

    def section(title, entries):
        lines.extend([f"## {title} ({len(entries)})", ""])
        lines.extend(entries[:15] or ["None."])
        if len(entries) > 15:
            lines.append(f"{len(entries) - 15} more; inspect the project for the full list.")
        lines.append("")

    def link(i):
        title = re.sub(r"[\r\n\[\]<>]", " ", i["title"])
        return f"[#{i['number']}]({i['url']}): {title}"

    active = [i for i in opened if item_for(i).get("status") in ("In progress", "In review", "Blocked")]
    section("Active delivery", [f"- {link(i)} ({item_for(i)['status']})" for i in active])
    now_items = [i for i in opened if item_for(i).get("priority") == "Now"]
    section("Now", [f"- {link(i)} ({item_for(i).get('status', 'missing')})" for i in now_items])
    warnings = []
    if len(now_items) > config.get("max_now", 3):
        warnings.append("- Now exceeds its limit. Keep one delivery and its necessary blockers; review the rest.")
    cutoff = now - timedelta(days=config.get("stale_days", 7))
    for i in active:
        if timestamp(i["updatedAt"]) < cutoff:
            warnings.append(f"- {link(i)} has no issue activity for {config.get('stale_days', 7)} days. Check its handover; age alone does not prove abandonment.")
    for n, _ in rows:
        if n not in issues:
            warnings.append(f"- Roadmap issue #{n} is missing from the repository snapshot.")
        elif issues[n]["state"] == "CLOSED":
            warnings.append(f"- Roadmap phase #{n} is closed but still listed in the order.")
    for i in opened:
        item = item_for(i)
        if not item:
            warnings.append(f"- {link(i)} is missing from the project.")
        elif item.get("archived"):
            warnings.append(f"- {link(i)} is open but archived in the project; review before restoring it.")
        elif item.get("status") == "Done":
            warnings.append(f"- {link(i)} is open but marked Done.")
    section("Needs attention", warnings)
    recent = sorted([i for i in opened if timestamp(i["createdAt"]) >= now - timedelta(days=7)],
                    key=lambda i: i["number"], reverse=True)
    section("New findings and ideas in seven days", [f"- {link(i)}" for i in recent])
    groups = {}
    for i in recent:
        parent = i.get("parent")
        group = f"parent #{parent['number']}" if parent else (i.get("milestone") or {}).get("title")
        if group:
            groups.setdefault(group, []).append(i["number"])
    section("Related work to triage together", [f"- {name}: " + ", ".join(f"#{n}" for n in numbers)
            for name, numbers in groups.items() if len(numbers) > 1])
    reviewed = timestamp(config.get("focus_reviewed_at") or (now - timedelta(days=7)).isoformat())
    merged = [p for p in data["merged"] if timestamp(p["mergedAt"]) > reviewed]
    due = len(merged) >= config.get("review_after_merges", 3) or now - reviewed >= timedelta(days=7)
    lines += ["## Direction checkpoint", "", f"{len(merged)} PRs merged since the last recorded focus review.",
              "**Review due.**" if due else "Review at the next delivery checkpoint, or sooner if a blocker grows.",
              "Recommend one next delivery: what users gain, what still blocks it, and which new findings can wait.",
              "Review related findings for shared causes; do not merge or close them from title similarity alone.", ""]
    return "\n".join(lines)


class GitHub:
    def __init__(self, config):
        self.config = config
        self.token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
        if not self.token:
            try:
                result = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, check=True)
                self.token = result.stdout.strip()
            except (OSError, subprocess.CalledProcessError) as exc:
                raise ProjectError("Set GH_TOKEN or sign in with gh; project read/write access is required") from exc
        if not self.token:
            raise ProjectError("GitHub credential is empty")

    def query(self, query, **variables):
        payload = json.dumps(dict(query=query, variables=variables)).encode()
        request = Request("https://api.github.com/graphql", data=payload,
                          headers={"Authorization": f"Bearer {self.token}",
                                   "Content-Type": "application/json", "User-Agent": "Polku-project"})
        try:
            with urlopen(request, timeout=30) as response:
                body = json.load(response)
        except (HTTPError, URLError, TimeoutError) as exc:
            raise ProjectError(f"GitHub request failed ({type(exc).__name__}); no automatic retry of mutations") from exc
        if body.get("errors"):
            raise ProjectError("GitHub GraphQL: " + "; ".join(e["message"] for e in body["errors"]))
        if not body.get("data"):
            raise ProjectError("GitHub returned no data")
        return body["data"]

    def project(self):
        result = self.query("""query($owner:String!, $number:Int!) {
          user(login:$owner) { projectV2(number:$number) { id } }
        }""", owner=self.config["owner"], number=self.config["project_number"])
        project = (result.get("user") or {}).get("projectV2")
        if not project:
            raise ProjectError("Personal project is unavailable; check owner, number and project credential scopes")
        return project["id"]

    def fields(self, project_id):
        return pages(lambda cursor: self.query("""query($id:ID!, $cursor:String) {
          node(id:$id) { ... on ProjectV2 { fields(first:100, after:$cursor) {
            nodes { ... on ProjectV2SingleSelectField { id name options { id name } } }
            pageInfo { hasNextPage endCursor }
          } } }
        }""", id=project_id, cursor=cursor)["node"]["fields"])

    def items(self, project_id):
        raw = pages(lambda cursor: self.query("""query($id:ID!, $cursor:String, $status:String!, $priority:String!) {
          node(id:$id) { ... on ProjectV2 { items(first:100, after:$cursor) {
            nodes { id isArchived
              status:fieldValueByName(name:$status) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              priority:fieldValueByName(name:$priority) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              content { ... on Issue { id repository { nameWithOwner } } }
            } pageInfo { hasNextPage endCursor }
          } } }
        }""", id=project_id, cursor=cursor, status=self.config["status_field"],
            priority=self.config["priority_field"])["node"]["items"])
        repository = f"{self.config['owner']}/{self.config['repository']}"
        return {i["content"]["id"]: dict(id=i["id"], archived=i["isArchived"],
                    status=(i["status"] or {}).get("name"), priority=(i["priority"] or {}).get("name"))
                for i in raw if i.get("content") and i["content"].get("repository", {}).get("nameWithOwner") == repository}

    def snapshot(self):
        project_id = self.project()
        fields = self.fields(project_id)
        selected = {f.get("name"): f for f in fields}
        for name, values in ((self.config["status_field"], STATUSES), (self.config["priority_field"], PRIORITIES)):
            field = selected.get(name, {})
            options = {o["name"]: o["id"] for o in field.get("options", [])}
            missing = set(values) - options.keys()
            if missing:
                raise ProjectError(f"Configure single-select '{name}' with {', '.join(sorted(missing))}; see docs/PROJECT_WORKFLOW.md")
        issue_query = """query($owner:String!, $repo:String!, $cursor:String) {
          repository(owner:$owner, name:$repo) { issues(first:50, after:$cursor) {
            nodes { """ + ISSUE_FIELDS + """ } pageInfo { hasNextPage endCursor }
          } }
        }"""
        issues = pages(lambda cursor: self.query(issue_query, owner=self.config["owner"],
                       repo=self.config["repository"], cursor=cursor)["repository"]["issues"])
        merged = pages(lambda cursor: self.query("""query($owner:String!, $repo:String!, $cursor:String) {
          repository(owner:$owner, name:$repo) { pullRequests(first:100, after:$cursor, states:MERGED) {
            nodes { number mergedAt } pageInfo { hasNextPage endCursor }
          } }
        }""", owner=self.config["owner"], repo=self.config["repository"], cursor=cursor)["repository"]["pullRequests"])
        status = selected[self.config["status_field"]]
        return dict(project_id=project_id, status_field=status["id"],
                    options={o["name"]: o["id"] for o in status["options"]},
                    issues=issues, items=self.items(project_id), merged=merged)

    def add_item(self, project_id, content_id):
        return self.query("""mutation($input:AddProjectV2ItemByIdInput!) {
          addProjectV2ItemById(input:$input) { item { id } }
        }""", input=dict(projectId=project_id, contentId=content_id))["addProjectV2ItemById"]["item"]["id"]

    def set_field(self, project_id, item_id, field_id, option_id):
        self.query("""mutation($input:UpdateProjectV2ItemFieldValueInput!) {
          updateProjectV2ItemFieldValue(input:$input) { projectV2Item { id } }
        }""", input=dict(projectId=project_id, itemId=item_id, fieldId=field_id,
                         value=dict(singleSelectOptionId=option_id)))

    def comment(self, issue_id, body):
        self.query("""mutation($input:AddCommentInput!) {
          addComment(input:$input) { commentEdge { node { id } } }
        }""", input=dict(subjectId=issue_id, body=body))


def verify_changes(api, data, changes):
    fresh = api.items(data["project_id"])
    for c in changes:
        if fresh.get(c["content_id"], {}).get("status") != c["to"]:
            raise ProjectError(f"#{c['number']}: status write could not be verified; rerun sync to reconcile")
    data["items"] = fresh


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=ROOT / ".github/project.json")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("sync", "focus"):
        command = sub.add_parser(name)
        command.add_argument("--output", type=Path)
        if name == "sync":
            command.add_argument("--apply", action="store_true", help="Apply and verify status changes")
    claim = sub.add_parser("claim", help="Post a claim and set In progress")
    claim.add_argument("number", type=int)
    claim.add_argument("--agent", required=True, choices=("Codex", "Claude Code"))
    claim.add_argument("--branch", required=True)
    state = sub.add_parser("status", help="Record an explicit workflow decision")
    state.add_argument("number", type=int)
    state.add_argument("status", choices=STATUSES[:-1])
    state.add_argument("--reason", required=True)
    args = parser.parse_args(argv)
    config = json.loads(args.config.read_text())
    api = GitHub(config)
    data = api.snapshot()
    if args.command in ("claim", "status"):
        issue = next((i for i in data["issues"] if i["number"] == args.number), None)
        if not issue or issue["state"] != "OPEN":
            raise ProjectError("Only an open issue can be claimed or moved explicitly")
        item = data["items"].get(issue["id"])
        if item and item.get("archived"):
            raise ProjectError("Restore the archived issue in the project before claiming it")
        if item and item["status"] not in (*STATUSES, None):
            raise ProjectError("Migrate legacy Status values to Priority first")
        target = "In progress" if args.command == "claim" else args.status
        if args.command == "claim":
            body = f"Claimed by {args.agent}. Branch: `{args.branch}`. Status: In progress."
        else:
            body = f"Status: {target}. {args.reason}"
        item_id = item["id"] if item else api.add_item(data["project_id"], issue["id"])
        api.comment(issue["id"], body)
        api.set_field(data["project_id"], item_id, data["status_field"], data["options"][target])
        changes = [dict(number=issue["number"], content_id=issue["id"], to=target)]
        verify_changes(api, data, changes)
        print(f"#{args.number}: {target} (verified)")
        return
    changes = reconcile(api, data, apply=args.command == "sync" and args.apply)
    if args.command == "sync" and args.apply:
        verify_changes(api, data, changes)
    report = focus_report(data, (ROOT / "docs/ROADMAP.md").read_text(), config)
    heading = "Applied and verified" if args.command == "sync" and args.apply else "Suggested (read only)"
    report += f"\n## {heading} status changes ({len(changes)})\n\n"
    report += "\n".join(f"- #{c['number']}: {c['before'] or 'missing'} → {c['to']}" for c in changes) or "None."
    report += "\n"
    if args.output:
        args.output.write_text(report)
    print(report)


if __name__ == "__main__":
    try:
        main()
    except (ProjectError, KeyError, ValueError, OSError) as exc:
        print(f"Project check failed: {exc}", file=sys.stderr)
        sys.exit(1)
