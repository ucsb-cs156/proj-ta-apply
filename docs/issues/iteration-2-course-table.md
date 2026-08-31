# Iteration 2: Populate a course table from the UCSB API with TA/ULA checkboxes

## Summary

From `docs/design/InitialDesign.md`:

> As an admin I can specify a range of quarters, and a level, and the system will populate a table
> with all of the courses numbers from "CMPSC" (a subject area configured via
> application.properties) that have been offered over that range of quarters. These will be obtained
> from api.ucsb.edu in the same way as proj-courses. We are only looking for the course numbers and
> names here, not the particular of the offerings. Those will be presented to me in a table. There
> will be a way for the admin to click a checkbox (or unclick it) to indicate which courses should
> get TAs assigned, and a separate checkbox to indicate which courses should get ULAs assigned.

Iteration 1 (#1, merged in #2) is the starting point. Iterations 3–4 are **out of scope**: no live
offering data, no caching layer, no applications.

This iteration is mostly *assembly* — `proj-courses` already has every hard piece (the API wrapper,
quarter arithmetic, the dropdowns), so most of the work is porting and narrowing rather than
inventing.

---

## Decisions already made

| Decision | Choice |
| --- | --- |
| Populate mechanism | **Async job via `lib-jobs`.** A multi-year range is a dozen-plus sequential API calls; a synchronous request risks timing out and gives no progress feedback. |
| Re-run semantics | **Upsert, and leave courses outside the new range alone.** New courses are added, existing rows keep their TA/ULA flags, nothing is deleted. The flags are hand-curated and must never be silently discarded. |
| Storage | **Postgres via JPA**, with a Liquibase migration, like `instructors` / `grad_students`. Mongo stays free for iteration 3's cached offering documents. |
| Checkbox saving | **Save immediately on click**, like the delete buttons in `RoleEmailTable`. No unsaved state. |

---

## Prerequisite: a UCSB API key (needs a human)

Nothing in this iteration works without one. `proj-courses` reads it as:

```properties
app.ucsb.api.consumer_key=${UCSB_API_KEY:${env.UCSB_API_KEY:see-instructions-in-readme}}
app.ucsb.api.host=${UCSB_COURSES_API_HOST:${env.UCSB_COURSES_API_HOST:https://api.ucsb.edu}}
```

A key is obtained from the UCSB developer portal (see `proj-courses`' README). Add `UCSB_API_KEY` to
`.env` for localhost and as a repository secret / Dokku config var for deployment. Unit tests must
**not** need a real key — mock the HTTP layer (see Testing below).

---

## Reference material

Read at `ucsb-cs156/proj-courses` commit `152cdb5`. Port from these, narrowing to what we need:

| File | What to take |
| --- | --- |
| `services/UCSBCurriculumService.java` | The API wrapper: endpoint constant, `ucsb-api-version` / `ucsb-api-key` headers, query-param construction, the `"A"`-level special case |
| `models/Quarter.java` | Backend YYYYQ arithmetic — `Quarter(String)`, `getYYYYQ()`, `increment()`, `quarterList(start, end)` |
| `frontend/src/main/utils/quarterUtilities.jsx` | `quarterRange(begin, end)`, `nextQuarter`, `yyyyqToQyy` — already exactly what the form needs |
| `frontend/src/main/components/Quarters/SingleQuarterDropdown.jsx` | Quarter picker |
| `frontend/src/main/components/Levels/SingleLevelDropdown.jsx` | Level picker |
| `frontend/src/main/pages/CSV/CSVDownloadsPage.jsx` | **The closest analogue to our new page** — combines the two quarter dropdowns, the level dropdown, and `quarterRange` in one admin form |
| `jobs/UpdateCourseDataJob.java` + `UpdateCourseDataJobFactory.java` | The `JobContextConsumer` + `@Service` factory pattern, `ctx.log(...)`, `ctx.checkCancellation()`, `JobRateLimit` |

`lib-jobs` v0.3.3 (already a dependency) supplies `JobContext`, `JobContextConsumer`, and
`JobRateLimit` — confirmed present in the jar.

### The UCSB API call

```
GET {apiHost}/academics/curriculums/v1/classes/search
      ?quarter=20241&subjectCode=CMPSC&objLevelCode=U
      &pageNumber=1&pageSize=100&includeClassSections=false
Headers: ucsb-api-version: 1.0
         ucsb-api-key: <key>
```

Notes:
- When level is `A` (All), **omit `objLevelCode` entirely** rather than passing `A` — that is what
  `proj-courses` does, and passing `A` is not a valid code.
- `proj-courses` passes `includeClassSections=true` because it needs sections. **We do not** — we
  want only course numbers and titles, so pass `false` and keep the payload small.
- Response classes carry `courseId` and `title` (see `documents/Course.java`); everything else can be
  ignored with `@JsonIgnoreProperties(ignoreUnknown = true)`.
- **Pagination:** `proj-courses` requests `pageNumber=1&pageSize=100` and never loops. One subject in
  one quarter is normally well under 100, but that is an assumption, not a guarantee. Loop pages
  until a page returns fewer than `pageSize` results, so a large quarter cannot silently truncate.

### `courseId` normalization

The API returns space-padded ids like `"CMPSC   156"`. Normalize on the way in — collapse internal
whitespace to a single space, then trim, giving `"CMPSC 156"` — so the primary key is stable and the
table reads cleanly. Do this in one place and test it directly.

---

## Part A — Configuration

Add to `application.properties`:

```properties
# UCSB Academic Curriculum API
app.ucsb.api.consumer_key=${UCSB_API_KEY:${env.UCSB_API_KEY:see-instructions-in-readme}}
app.ucsb.api.host=${UCSB_COURSES_API_HOST:${env.UCSB_COURSES_API_HOST:https://api.ucsb.edu}}

# Subject area whose courses this app manages
app.subjectArea=${SUBJECT_AREA:${env.SUBJECT_AREA:CMPSC}}

# Bounds for the quarter dropdowns
app.startQtrYYYYQ=${START_QTR:${env.START_QTR:20211}}
app.endQtrYYYYQ=${END_QTR:${env.END_QTR:20254}}
```

The subject area is a **single configured value, not a user-facing dropdown** — the design doc is
explicit that it is configured via `application.properties`.

Expose `startQtrYYYYQ`, `endQtrYYYYQ` and `subjectArea` from `SystemInfo` / `SystemInfoServiceImpl`
so the frontend can build its dropdowns and label the page, mirroring how `proj-courses` exposes the
quarter bounds. (`proj-courses` derives `endQtrYYYYQ` from a live API call via
`UCSBAPIQuarterService`; a configured property is simpler and enough for us — don't port that
service.) Remember to extend `systemInfoFixtures` and the SystemInfo tests.

Also add `UCSB_API_KEY` to `.env.SAMPLE`.

## Part B — Quarter utilities

**Backend:** port `models/Quarter.java` from `proj-courses`, or write a smaller equivalent. The
minimum needed is: parse/validate a `YYYYQ` string, `increment()` that rolls `20244 → 20251`, and a
`quarterList(start, end)` returning every quarter in an inclusive range. Q values are `1`=Winter,
`2`=Spring, `3`=Summer, `4`=Fall.

**Frontend:** port `quarterUtilities.jsx` (`quarterRange`, `nextQuarter`, `toNumericYYYYQ`,
`fromNumericYYYYQ`, `yyyyqToQyy`) and its tests, plus `SingleQuarterDropdown` and
`SingleLevelDropdown` with their tests and stories.

Level options, from `CSVDownloadsPage`:

```js
const levels = [
  ["U", "Undergraduate"],
  ["G", "Graduate"],
  ["A", "All"],
];
```

## Part C — Entity, repository, migration

```java
@Entity(name = "courses")
public class Course {
  @Id private String courseId;   // normalized, e.g. "CMPSC 156"
  private String title;
  private boolean needsTa;       // default false
  private boolean needsUla;      // default false
}
```

`CourseRepository extends CrudRepository<Course, String>` with `findByCourseId` and
`existsByCourseId`, matching the shape of the existing role repositories.

Liquibase changeset `005-create-courses-table.json`, following the `preConditions` + `MARK_RAN`
pattern of `003`/`004`. Booleans should be `NOT NULL DEFAULT FALSE` so existing rows are never null.

Only course number and title are stored — deliberately no per-offering data, per the design doc. The
API's `objLevelCode` is used to *filter* the query but is not persisted; add it later if a real need
appears.

## Part D — The populate job

`PopulateCoursesJob implements JobContextConsumer` plus a `@Service PopulateCoursesJobFactory`,
following `UpdateCourseDataJob` / `UpdateCourseDataJobFactory`:

```java
for (Quarter q : Quarter.quarterList(startQuarter, endQuarter)) {
  ctx.checkCancellation();
  jobRateLimit.sleep();                       // be polite to api.ucsb.edu
  ctx.log("Fetching " + subjectArea + " " + q.getYYYYQ() + " level " + level);
  // fetch, then for each course:
  //   - if courseId exists: update title only, PRESERVE needsTa / needsUla
  //   - else: insert with both flags false
}
ctx.log(String.format("Finished: %d added, %d updated", added, updated));
```

Requirements:
- **Never touch `needsTa` / `needsUla` on an existing row.** This is the single most important
  behavior in the iteration and deserves its own test.
- Never delete rows, including courses outside the requested range.
- `ctx.checkCancellation()` inside the loop so a long run is cancellable.
- `jobRateLimit.sleep()` between calls.
- Log per quarter so the admin Jobs page shows real progress.
- One quarter failing (API error) should log the failure and continue to the next rather than
  aborting the whole job — a transient 500 on one quarter shouldn't discard a dozen good ones.

## Part E — Controllers

Extend the existing `JobsController` (`/api/jobs`, currently just the test-job launcher):

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/jobs/launch/populateCourses?startQuarter=&endQuarter=&level=` | `hasRole('ROLE_ADMIN')`; returns the `Job` |

New `CoursesController`:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/courses/all` | `hasRole('ROLE_ADMIN')`; all courses, ordered by `courseId` |
| PUT | `/api/admin/courses?courseId=&needsTa=&needsUla=` | `hasRole('ROLE_ADMIN')`; sets both flags; 404 if unknown `courseId` |

A single idempotent PUT carrying both flags is simplest for save-on-click — the frontend always has
both values to hand, and it avoids a second endpoint. Every endpoint needs `@Operation(summary=...)`
and a class-level `@Tag`.

## Part F — Frontend

New `pages/Admin/CoursesIndexPage.tsx` at `/admin/courses`, wrapped in
`<ProtectedPage enforceRole="ROLE_ADMIN">`, with a **Courses** item in the Admin navbar dropdown.

The page has two parts:

1. **Populate form** — modeled on `CSVDownloadsPage`: a start `SingleQuarterDropdown`, an end
   `SingleQuarterDropdown` (both fed by `quarterRange(systemInfo.startQtrYYYYQ,
   systemInfo.endQtrYYYYQ)`), a `SingleLevelDropdown`, and a Populate button that POSTs to the
   launch endpoint and toasts a link to the Jobs page. Validate that start ≤ end before submitting.
2. **`CourseTable`** — columns: Course Number, Title, TA (checkbox), ULA (checkbox). Each checkbox
   PUTs immediately via `useBackendMutation`, invalidating `["/api/courses/all"]`. Use `OurTable`,
   with `data-testid` conventions matching the existing tables.

---

## Testing

The bar set in iteration 1 has to hold:

- **Jacoco enforces 100%** instruction/branch/line coverage on all non-excluded classes. New service,
  job, controller and entity code all count. Budget for this; it is the most likely source of CI
  failures.
- **Do not call the real API in tests.** Test `UCSBCurriculumService` with Spring's
  `MockRestServiceServer` (as `proj-courses` does), asserting the URL, the `ucsb-api-key` /
  `ucsb-api-version` headers, and the `A`-level branch that omits `objLevelCode`. Test the job with a
  mocked service.
- Test explicitly that **re-running populate preserves `needsTa` / `needsUla`** on an existing row
  and that a course outside the new range survives.
- Test `courseId` normalization (`"CMPSC   156"` → `"CMPSC 156"`) directly.
- Test pagination: a first page of exactly `pageSize` results must trigger a second request.
- Frontend: tests for `CourseTable` (both checkboxes, both directions), the populate form's
  validation, and the two ported dropdowns. Stryker thresholds apply.
- Add a `CoursesWebIT` Playwright IT alongside `GradStudentsWebIT`. The UCSB API must be stubbed —
  the existing WireMock harness (`WiremockServiceImpl`, used today for OAuth) is the natural place,
  or seed the `courses` table directly and exercise only the table and checkboxes.

## Acceptance criteria

- [ ] With a valid `UCSB_API_KEY`, an admin can pick a start quarter, end quarter and level, click
      Populate, and watch the job progress on the Jobs page.
- [ ] When it finishes, `/admin/courses` lists the distinct CMPSC courses offered in that range, with
      normalized course numbers and titles.
- [ ] Ticking the TA or ULA checkbox persists immediately and survives a page reload.
- [ ] Re-running Populate over a different range adds new courses, leaves existing checkbox values
      untouched, and deletes nothing.
- [ ] A non-admin gets Access Denied at `/admin/courses`, and the API endpoints return 403.
- [ ] The subject area comes from `application.properties`, not a hardcoded literal or a dropdown.
- [ ] `mvn verify` passes including the Jacoco 100% gate; frontend coverage and Stryker pass;
      format/lint clean; workflow 41 integration tests pass.
- [ ] Swagger documents the new endpoints and they are runnable via "Try it out".

## Test plan (manual)

1. Put a valid `UCSB_API_KEY` in `.env`; run `mvn spring-boot:run -Plocalhost`; sign in as an admin.
2. Admin → Courses. Confirm the two quarter dropdowns and the level dropdown render, bounded by the
   configured start/end quarters.
3. Pick a range of about four quarters, level **U**, and click **Populate**.
4. Go to Admin → Jobs. Confirm a running/completed job whose log names each quarter in turn.
5. Return to Admin → Courses. Confirm the table lists CMPSC courses with numbers like `CMPSC 156`
   (single space, no padding) and their titles.
6. Tick **TA** on one course and **ULA** on another. Reload. Confirm both stuck.
7. Re-run Populate over a *different, narrower* range. Confirm the two courses you ticked still exist
   **and still have their checkboxes set**, and that nothing was deleted.
8. Try a range where start > end. Confirm it is rejected rather than launching a job.
9. Sign in as a non-admin and visit `/admin/courses` directly. Expect Access Denied.

## Open questions / things needing a human

1. **UCSB API key** — see Prerequisite above. Blocks everything.
2. **Confirm the level applies as expected.** CMPSC graduate courses are 200-level; `objLevelCode=G`
   should return those and `U` the 1–199 range. Worth eyeballing the first real run to confirm the
   filter behaves as assumed before building the iteration-3 work on top of it.
3. **Default quarter range bounds** — `app.startQtrYYYYQ` / `app.endQtrYYYYQ` above are placeholders
   (`20211`–`20254`). Say what range the dropdowns should actually offer.
