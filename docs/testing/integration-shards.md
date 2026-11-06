# Integration test shards

The Playwright integration tests (`src/test/java/edu/ucsb/cs/taapply/web/*WebIT.java`) run in
parallel CI jobs ("shards") instead of one long job (issue #328). One job running every class took
about 10 minutes on a good day and hit its time limit when it was slow; each shard now runs the
classes assigned to it, so the check's wall-clock time is that of the slowest shard.

## Layout

- `src/test/resources/it-shards.json` assigns every `*WebIT` class to a shard (`"1"`, `"2"`, ...).
- `.github/workflows/41-integration.yml` has a matrix job `it-shard` (one run per shard). Each run
  reads its classes from that file and runs
  `mvn test-compile failsafe:integration-test failsafe:verify -Dit.test=<its classes>`, then the
  flaky-test report and the artifact upload (`integration-artifacts-shard-N`). Every shard keeps the
  one-shot retry and the flake report together (see [flaky-tests.md](flaky-tests.md)); the report
  names the shard.
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

## Adding a new web IT

1. Create `FooWebIT` in `src/test/java/edu/ucsb/cs/taapply/web/`.
2. Add `"FooWebIT"` to the shortest shard in `src/test/resources/it-shards.json` (the class times
   are in the log of a recent `41-integration` run; the failsafe summary lists them).
3. `mvn test -Dtest=ItShardAssignmentTests` fails with a message naming the class until you do.

To add a shard, add its key to `it-shards.json` **and** to `matrix.shard` in the workflow (the test
fails on an empty shard, but not on a shard missing from the matrix, so check both).

## Running one shard locally

```bash
classes=$(jq -r '.["3"] | join(",")' src/test/resources/it-shards.json)
INTEGRATION=true mvn -ntp -B test-compile failsafe:integration-test failsafe:verify -Dit.test="$classes"
```

## Possible follow-up

Each test method starts its own Spring context and embedded Mongo (`@DirtiesContext`, 28 to 52 s
per start on a runner). Sharing a context between classes with the same configuration would speed
up every shard; it is not part of the sharding change.
