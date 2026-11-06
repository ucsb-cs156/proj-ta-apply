#!/usr/bin/env bash
# Reports the tests that failed and then passed when failsafe re-ran them (issue #340).
#
# The integration job re-runs a failing test once (-Dfailsafe.rerunFailingTestsCount=1) so one
# unlucky run does not cost a whole job, but a test that needed the retry is a FLAKE, not a pass:
# it is written to the job summary and raised as a warning annotation so it cannot go unnoticed.
# Policy: docs/testing/flaky-tests.md. Open an issue for every test listed here.
#
# Usage: scripts/report-flaky-tests.sh [reports-dir] [label]
#   reports-dir  where failsafe wrote its TEST-*.xml (default target/failsafe-reports)
#   label        names the job or shard in the report, for when the tests are split across jobs
#
# Always exits 0; it only reports. (A test that failed both times already fails the build.)
set -euo pipefail

REPORTS="${1:-target/failsafe-reports}"
LABEL="${2:-integration}"

python3 - "$REPORTS" "$LABEL" <<'PY'
import glob
import os
import sys
import xml.etree.ElementTree as ET

reports, label = sys.argv[1], sys.argv[2]
flakes = []
for path in sorted(glob.glob(os.path.join(reports, "TEST-*.xml"))):
    for case in ET.parse(path).getroot().iter("testcase"):
        failures = case.findall("flakyFailure") + case.findall("flakyError")
        if failures:
            first = failures[0]
            message = (first.get("message") or (first.text or "")).strip().splitlines()
            flakes.append(
                (
                    case.get("classname", "?"),
                    case.get("name", "?"),
                    len(failures),
                    message[0][:300] if message else "",
                )
            )

summary = os.environ.get("GITHUB_STEP_SUMMARY")
lines = []
if flakes:
    lines.append(f"### Flaky tests in {label}: passed only on retry")
    lines.append("")
    lines.append(
        "These tests failed and then passed when re-run. The job is green, but each one is a "
        "flake: open an issue now (see docs/testing/flaky-tests.md). The trace and screenshot of "
        "the failed attempt are in the uploaded artifact."
    )
    lines.append("")
    lines.append("| Test | Failed attempts | First failure |")
    lines.append("|---|---|---|")
    for cls, name, count, message in flakes:
        lines.append(f"| `{cls}.{name}` | {count} | {message.replace('|', '/')} |")
else:
    lines.append(f"### Flaky tests in {label}: none (no test needed a retry)")

text = "\n".join(lines) + "\n"
print(text)
if summary:
    with open(summary, "a", encoding="utf-8") as out:
        out.write(text)
for cls, name, count, message in flakes:
    # Annotations may not contain newlines; keep the message to one line.
    print(
        f"::warning title=Flaky test (passed on retry)::{cls}.{name} failed {count} time(s) "
        f"and then passed. First failure: {message}"
    )
PY
