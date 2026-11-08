# Flaky integration tests

A flaky test is one that fails on some runs and passes on others with no code change. The
Playwright integration tests (`src/test/java/edu/ucsb/cs/taapply/web/*WebIT.java`, run by the
`41-integration` workflow) are the usual suspects, because they race a real browser against a real
server. A flake makes the check untrustworthy and hides real failures behind "just rerun it".

## Policy

1. **A flaky test gets an issue immediately.** The first time a test fails and then passes when the
   job is re-run with no code change, open an issue titled with the test name. Put the failing
   run's link and the message in it. Do not wait to see whether it happens again.
2. **It is then fixed or quarantined, never silently rerun.** Fix the cause (below). If the fix is
   not quick, quarantine the test (`@Disabled("flaky: #<issue>")`) in the same PR that links the
   issue, so the check stays trustworthy and the gap is visible. A quarantine without an issue
   number is not allowed.
3. **Do not hide a flake with a sleep or a blind retry.** `Thread.sleep`, a longer timeout and
   "click twice" make the test slower and the next flake harder to see. Find what the test was
   racing and wait for that.
4. **A flake can be a product bug.** A form that opens in the wrong mode, or loses what was typed
   when a late response arrives, is not a test problem. Treat "the page did something odd" as a bug
   until shown otherwise; issue #340 found one that way (a catalog response resetting an open
   dialog).

## How a flake shows up in the job

The integration job does **not** re-run a failing test: a test that fails, fails its shard the first
time, so a new flake is seen at once instead of being hidden behind a pass-on-retry. (PR #359 had
added a one-shot retry, `-Dfailsafe.rerunFailingTestsCount=1`, with a report of the tests that
needed it, as a safety net while the flakes found in #340 were being fixed; issue #376 removed it
once the shards had stayed green.) If a failed shard passes when the run is re-run with no code
change, the test that failed is a flake: open an issue for it.

The `integration-artifacts-shard-N` artifact of the run's shard (kept 14 days, uploaded whether the
job passed or failed) holds, for every failed test, a Playwright trace (`*.trace.zip`), a full-page
screenshot (`*.png`), the page text and HTML, and the browser console and failed requests
(`*.browser-log.txt`), plus the failsafe reports.

Look at a trace with `npx playwright show-trace <file>.trace.zip` (or upload it to
<https://trace.playwright.dev>). The same files are written to `target/playwright-artifacts/` when
a test fails locally.

The integration tests run in parallel shards ([integration-shards.md](integration-shards.md)), which must not make
a flake harder to find: each shard uploads its own artifact (`integration-artifacts-shard-N`), and
a failure in one shard fails that shard and the aggregate check, not merged into a single green
check.

## Finding the cause: reproduce, do not just rerun

Most flakes are a race that only shows on a slower machine than yours. Slow the browser down, and
the race shows up on your own:

```bash
# Busy loops on every core, and a browser that is 4 times slower with 50 ms of network latency.
for i in $(seq 8); do yes > /dev/null & done
INTEGRATION=true mvn -ntp -B test-compile failsafe:integration-test failsafe:verify \
  -Dit.test='PriorCourseworkMatrixWebIT' \
  -Dapp.playwright.cpuThrottle=4 -Dapp.playwright.networkLatencyMs=50
pkill yes   # do not leave the load running
```

| Property | Effect |
|---|---|
| `app.playwright.cpuThrottle` | Chrome's CPU throttling rate; `4` is four times slower (default `1`, off) |
| `app.playwright.networkLatencyMs` | Adds this much latency to every request (default `0`, off) |
| `app.playwright.slowMoMs` | Pauses Playwright this long between its actions (default `0`, off) |

Run the test many times (a loop of 10 or 20 under load is a fair test of a fix) and record how many
passed before and after the change.

## Writing tests that do not flake

The usual causes, and the fix for each:

- **Clicking before the page has loaded its data.** After navigating, use `openPage(page, path)`
  from `WebTestCase`, not a bare `navigate`. It waits for the page to load, for every request the
  page sends (and the ones that follow the answers) to finish, and for the answers to be drawn. If
  the test needs one particular thing (a table row, the saved draft), also assert it is visible
  before interacting.
- **Reading the database right after the UI acted.** The click returns before the server has
  committed. Poll until the value you expect is there (`eventually(...)`) instead of asserting once,
  and make the message say what was stored.
- **Asserting on a dialog that is fading.** React-Bootstrap modals fade; a test can see the old
  dialog in a half-closed state. The dialogs the tests drive have `animation={false}`.
- **Order-dependent data.** Each test method gets a fresh application context
  (`@DirtiesContext`); keep it that way, and do not rely on rows another test created.
- **Failures with no message.** Wrap an assertion on a dialog so a failure says what the dialog
  shows (its title, the checked boxes, the validation errors), as `changeTerm` in
  `PriorCourseworkMatrixWebIT` does. "Expected not visible" alone is not diagnosable.
