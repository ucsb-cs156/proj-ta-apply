# Integration test shards

The Playwright integration tests (`src/test/java/edu/ucsb/cs/taapply/web/*WebIT.java`) run in
parallel CI jobs ("shards") instead of one long job (issue #328). One job running every class took
about 10 minutes on a good day and hit its time limit when it was slow; each shard now runs the
classes assigned to it, so the check's wall-clock time is that of the slowest shard. There are
four shards (issue #361; three before it).

## Layout

- `src/test/resources/it-shards.json` assigns every `*WebIT` class to a shard (`"1"`, `"2"`, ...).
- `.github/workflows/41-integration.yml` has a matrix job `it-shard` (one run per shard). Each run
  reads its classes from that file and runs
  `mvn test-compile failsafe:integration-test failsafe:verify -Dit.test=<its classes>`, then the
  artifact upload (`integration-artifacts-shard-N`). A failing test is not retried (see
  [flaky-tests.md](flaky-tests.md)); it fails its shard on the first try.
- A final job `build` (needs: all shards, `if: always()`) fails unless every shard succeeded. It
  has the job id `build`, the name the workflow's single job had before the split, so the check
  name `build` that other workflows or branch protection may require is unchanged. The shard jobs
  appear as `Integration tests (shard N)`.
- `ItShardAssignmentTests` (a plain unit test, run by `mvn test`) fails when a `*WebIT` class is in
  no shard, is in two shards, or is listed but does not exist, so a new IT cannot be silently
  skipped.

Shards run on separate runners, so nothing is shared between them: each has its own embedded Mongo
(random port per Spring context), its own WireMock mock OAuth server on port 8090
(`WebTestCase`) and its own browser. Port 8090 is fixed, so two shards must never run on the same
machine; if you run several shards on one computer, run them one after another.

Each shard builds the frontend (through Maven) and Playwright downloads Chromium on first use
(about 20 seconds); caching the browser was not worth the extra cache step.

## How the classes are assigned (issue #361)

The assignment balances the classes' test time, measured from the failsafe reports
(`TEST-*.xml`, in the `integration-artifacts-shard-N` artifact of a run) of the three successful
`main` runs before #361, and it has two fixed costs in mind:

- Every shard pays about **2 minutes** before and around its tests: checkout, Java and the Maven
  cache, compiling, the frontend build, the Chromium download (job wall-clock minus failsafe suite
  time was 74 to 139 s over nine shard jobs), plus 12 to 21 s of JVM and first-Spring-context
  warm-up that the failsafe report books against whichever class runs first in the shard.
- Each test method starts its own Spring context (`@DirtiesContext`), so a class's time is roughly
  its number of tests times 5 to 10 s plus whatever the tests wait for (the two-window tests wait
  for heartbeats).

Mean test time per class (seconds, sum of the class's test cases, without the warm-up):

| Class | Tests | s | Class | Tests | s |
|---|---|---|---|---|---|
| `ApplicationsDraftsWebIT` | 11 | 102 | `AdminAssignmentsWebIT` | 5 | 40 |
| `RecruitmentsWebIT` | 9 | 78 | `CoursesWebIT` | 7 | 38 |
| `ApplicationsSubmittedWebIT` | 5 | 74 | `HomePageWebIT` | 4 | 34 |
| `PriorCourseworkMatrixWebIT` | 2 | 68 | `AppSettingsWebIT` | 5 | 25 |
| `ApplicationsApplyWebIT` | 7 | 44 | `QuartersWebIT` | 2 | 24 |
| `BudgetWebIT` | 5 | 43 | `AuditTrailWebIT` | 3 | 17 |
| `OauthWebIT` | 4 | 15 | `LegacyImportWebIT` | 2 | 14 |
| `HomePageRefreshWebIT` | 1 | 7 | `SwaggerWebIT` | 1 | 7 |

Total about 630 s of tests; with four shards each holds 156 to 159 s, so every shard should finish
in about 4.7 minutes, against 4.6 to 6.6 minutes (mean of the slowest shard 6.1) with three. A
fifth shard would cut the test time per shard by about 30 s for another 2 minutes of runner time,
so it was not added; a shard is only worth adding when it saves at least about a minute of
wall-clock time.

`ApplicationsWebIT` (23 tests, about 220 s, the whole of the old shard 1) was split for this into
`ApplicationsApplyWebIT` (filling in and submitting the form), `ApplicationsDraftsWebIT` (drafts
and two-window editing) and `ApplicationsSubmittedWebIT` (deadline, cancelling, admin review and
admin-student concurrent editing), sharing their setup through the abstract
`ApplicationsWebTestCase`, which does not end in `WebIT` so neither failsafe nor the shard check
sees it.

## Adding a new web IT

1. Create `FooWebIT` in `src/test/java/edu/ucsb/cs/taapply/web/`.
2. Add `"FooWebIT"` to the shortest shard in `src/test/resources/it-shards.json` (the class times
   are in the log of a recent `41-integration` run; the failsafe summary lists them, and the
   `TEST-*.xml` files in the shard's artifact have the time per test).
3. `mvn test -Dtest=ItShardAssignmentTests` fails with a message naming the class until you do.

To add a shard, add its key to `it-shards.json` **and** to `matrix.shard` in the workflow (the test
fails on an empty shard, but not on a shard missing from the matrix, so check both). Re-balance
rather than add when the slowest shard would gain less than about a minute: every shard repeats the
2 minutes of setup above.

## Running one shard locally

```bash
classes=$(jq -r '.["3"] | join(",")' src/test/resources/it-shards.json)
INTEGRATION=true mvn -ntp -B test-compile failsafe:integration-test failsafe:verify -Dit.test="$classes"
```

## Possible follow-up

Each test method starts its own Spring context and embedded Mongo (`@DirtiesContext`, 28 to 52 s
per start on a runner). Sharing a context between classes with the same configuration would speed
up every shard; it is not part of the sharding change.
