# Iteration 3: Recruitments and recruitment courses

## Summary

From `docs/design/InitialDesign.md`, third iteration. An admin creates a **Recruitment** for a
quarter and a type (TA or ULA). Creating it launches a job that fills a **RecruitmentCourses** table
with the courses that both recruit for that type and are actually offered that quarter, pulling the
live offering details (instructor, meeting time, room, enrollment) from the UCSB API.

Iteration 4 (the applications themselves) is **out of scope**. Nothing here accepts an application;
the point is to have a curated, per-quarter course list for applications to attach to.

Builds directly on iteration 2 (#3, merged in #4), which supplies the `courses` table with its
`needsTa` / `needsUla` flags, `UCSBCurriculumService`, `Quarter`, `UcsbQuarterService`, the
`lib-jobs` plumbing, and the padded course-id sort.

---

## Decisions already made

| Decision | Choice |
| --- | --- |
| Which courses | **Match the recruitment type.** A TA recruitment pulls courses with `needsTa`; a ULA recruitment pulls those with `needsUla`. |
| Populate trigger | **Both.** Creating a recruitment launches the job; a Populate button re-runs it later. Re-running upserts and does not resurrect manually removed rows. |
| Uniqueness | **One recruitment per (quarter, type)**, enforced by a unique constraint, with a clear error on a duplicate. |
| Granularity | **One row per primary section, not per course.** A course with two lectures gets two rows. |
| Date semantics | **First open, last close.** `actualOpeningDate` is set only the first time it opens and never overwritten; `actualClosingDate` is overwritten on each close. |

### Why "does not resurrect removed rows" matters

The admin can remove a course from a recruitment (the design's "button to remove any rows ... if TA
or ULAs should not be included"). That removal is a decision, so a later re-run of Populate must not
undo it. This is the same class of invariant as iteration 2's "never clear the TA/ULA flags", and it
needs the same care: **record that a course was removed, rather than just deleting the row.** A
`removed` boolean on the row, or a separate exclusions table, both work; a plain delete does not,
because the next Populate cannot tell a removed course from a new one.

---

## Data model

### `recruitments`

| Field | Notes |
| --- | --- |
| `id` | generated |
| `quarter` | YYYYQ, e.g. `20261`. Displayed as QYY (`W26`) |
| `type` | `TA` or `ULA` — an enum, not a free string |
| `applicationStatus` | `OPEN` or `CLOSED`; starts `CLOSED` |
| `tentativeOpeningDate` | required; shown to users |
| `actualOpeningDate` | set on the first open; nullable until then |
| `primaryConsiderationDate` | required; shown to users |
| `actualClosingDate` | set on each close; nullable until then |

Unique constraint on (`quarter`, `type`). Liquibase changeset `006-create-recruitments-table.json`,
following the `preConditions` + `MARK_RAN` pattern of `003`–`005`.

Opening and closing are **manual**, per the design doc: automating them while still allowing manual
override is a protocol worth designing separately, and the MVP does not need it.

### `recruitment_courses`

| Field | Notes |
| --- | --- |
| `id` | generated |
| `recruitmentId` | FK to `recruitments` |
| `courseId` | the padded form, e.g. `CMPSC     1A` — same value as `courses.course_id` |
| `enrollCode` | the primary section's enrollment code; unique within a quarter, and what makes two lectures distinct rows |
| `section` | the primary section number, e.g. `0100` / `0200`, so lectures can be told apart |
| `instructor` | primary section's first instructor |
| `days` | primary section's first time-location |
| `time` | primary section's first time-location, begin–end |
| `room` | primary section's first time-location (building + room) |
| `enrollment` | `enrolledTotal` |
| `maxEnroll` | |
| `status` | open / closed / cancelled |
| `summerSession` | only meaningful for summer quarters, but the column is always present |
| `removed` | see above; excluded from Populate on re-runs |

Liquibase changeset `007-create-recruitment-courses-table.json`.

**A course with several primary sections gets one row per primary.** Two lectures of the same course
are planned separately: their enrollments drive how many positions each gets, and they often have
different instructors who rank candidates independently. Secondary sections (discussions, labs) are
never included. The unique constraint is therefore on (`recruitmentId`, `enrollCode`), not
(`recruitmentId`, `courseId`), and the table sorts by course id then section so a course's lectures
sit together.

Within a primary section, days/times are "first one, for primary only" — take the **first**
`timeLocation` and ignore the rest, rather than trying to render a full schedule.

---

## Getting the offering data

Iteration 2's `UCSBCurriculumService` deliberately requests `includeClassSections=false`, since it
only wanted course numbers and titles. **Iteration 3 needs the sections**, so it needs a second call
shape with `includeClassSections=true`. Extend the service with a method that returns sections;
do not change the existing catalog method, which iteration 2's Populate depends on.

Model the response on `proj-courses` (commit `152cdb5`), which already parses exactly this:

| From proj-courses | What it gives us |
| --- | --- |
| `documents/Section.java` | `enrolledTotal`, `maxEnroll`, `classClosed`, `courseCancelled`, `session`, `section`, and **`isPrimary()`** — the primary is the section whose number ends in `00` |
| `documents/TimeLocation.java` | `days`, `beginTime`, `endTime`, `room`, `building` |
| `documents/Instructor.java` | `instructor` (name), `functionCode` |
| `documents/CoursePage.java` | how sections are grouped under a course |

Only a small subset of those fields is needed; port narrowly, as we did for `UcsbCourse`, rather
than copying the whole document tree.

Fetch with level `A` (all levels) and filter against the `courses` table, rather than trying to
guess a level from the recruitment type — a graduate course can want a ULA and vice versa.

---

## Backend work

### Repositories and entities

`Recruitment`, `RecruitmentCourse`, plus repositories. `RecruitmentRepository` needs
`findByQuarterAndType` for the uniqueness check and `findAllByOrderByQuarterDesc` for the listing.

### `PopulateRecruitmentCoursesJob`

Modeled on iteration 2's `PopulateCoursesJob` and its factory:

```
for each course in courses where (type == TA ? needsTa : needsUla):
    look up its sections for recruitment.quarter
    if not offered that quarter: skip
    if already present and removed: skip          // an admin decision, do not undo
    upsert the row with the primary section's details
```

- `ctx.log(...)` per course so the Jobs page shows progress; `ctx.checkCancellation()` in the loop;
  `jobRateLimit.sleep()` between API calls.
- One course failing must not abort the run, the same way one quarter failing does not in
  `PopulateCoursesJob`.
- Launched automatically when a recruitment is created **and** by the Populate button.

### Controllers

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/admin/recruitments/post` | admin; 400 on a duplicate (quarter, type) |
| GET | `/api/admin/recruitments/all` | admin; most recent quarter first |
| PUT | `/api/admin/recruitments/status` | admin; OPEN/CLOSED, applying the date rules |
| DELETE | `/api/admin/recruitments/delete` | admin; with a confirmation modal, like course delete |
| GET | `/api/recruitmentcourses/all?recruitmentId=&includeRemoved=` | admin; sorted by `courseId` then section. Removed rows hidden unless `includeRemoved=true` |
| PUT | `/api/recruitmentcourses/removed` | admin; sets or clears `removed`. A toggle rather than a delete, so a removal made by mistake is reversible |
| POST | `/api/jobs/launch/populateRecruitmentCourses?recruitmentId=` | admin; returns the `Job` |

**Sort `recruitment_courses` in Java, not with an `ORDER BY`** — for the same reason iteration 2
does. The padded course id sorts correctly only under code-unit ordering, and Postgres' default
collation can treat spaces as negligible, which would pass on H2 and reorder wrongly on Dokku.

---

## Frontend work

- **Admin → Recruitments** in the navbar dropdown, and `/admin/recruitments`:
  a table of recruitments, **most recent quarter first**, showing quarter as QYY, type, status, the
  two required dates and the two actual dates. Per row: an Open/Close control, a **Courses** button
  linking to the page below, and Delete behind a confirmation modal.
- **Create form** for a recruitment: quarter dropdown (reuse `SingleQuarterDropdown` and
  `quarterRange`), a type selector, and the two required dates.
- **`/admin/recruitments/:recruitmentId/courses`**: the recruitment courses table, sorted by course
  id, with the course number rendered padded and monospaced exactly as `CourseTable` does, so the
  sort order is legible. Columns per the design doc, plus a Remove button per row behind a
  confirmation modal. A Populate button re-runs the job.
- Reuse what iteration 2 built rather than reimplementing: `CourseDeleteModal` is a good model for
  the two new modals, `OurTable`'s per-column `meta.style` hook handles the widths, and
  `RoleEmailCsvUploadForm` shows the shape for a small reusable form component.

---

## Testing

The bar from iterations 1 and 2 holds, and two of these gates are easy to forget:

- **Pitest enforces a 100% mutation score** and is **not** run by `mvn verify`. Check it before
  pushing: `mvn test-compile org.pitest:pitest-maven:mutationCoverage -Plocalhost -DmutationThreshold=100`.
  Assertions on formatted strings are the usual trap — `contains("1 added")` still matches
  `"-1 added"`, so anchor them.
- **Jacoco enforces 100%** instruction/branch/line on non-excluded classes.
- Do not call the real API: use `MockRestServiceServer` for the service, mocks for the job.
- Test explicitly that **a removed course stays removed** across a re-run of Populate, and that
  **`actualOpeningDate` survives** a close/re-open cycle. These are the two invariants most likely to
  regress.
- Test that a duplicate (quarter, type) is rejected.
- Add a `RecruitmentsWebIT` alongside `CoursesWebIT`, stubbing the UCSB API on the existing WireMock
  server so workflow 41 still needs no API key.
- Frontend: tests for the new tables, modals and the create form; stories for both new admin pages,
  matching the set added in iteration 2.

## Acceptance criteria

- [ ] An admin can create a TA or ULA recruitment for a quarter, with the two required dates, and a
      second one for the same quarter and type is rejected.
- [ ] Creating it launches a job whose log shows progress on the Jobs page.
- [ ] `/admin/recruitments/:id/courses` lists only courses that recruit for that type **and** are
      offered that quarter, with instructor, days, time, room, enrollment, max enrollment and status
      from the live API.
- [ ] Course numbers render padded and monospaced, sorted the same way as Admin/Courses.
- [ ] Removing a course from a recruitment sticks: re-running Populate does not bring it back.
- [ ] Opening a recruitment records `actualOpeningDate`; closing records `actualClosingDate`;
      re-opening leaves the original `actualOpeningDate` untouched.
- [ ] Recruitments list is sorted most recent first.
- [ ] A non-admin gets Access Denied on every new page, and the APIs return 403.
- [ ] Jacoco 100%, pitest 100%, frontend coverage and Stryker pass, format/lint clean, workflow 41
      green.

## Test plan (manual)

1. Sign in as an admin, Admin → Recruitments, create a **TA** recruitment for an upcoming quarter
   with both dates. Confirm it appears with status **Closed** and no actual dates.
2. Try to create a second TA recruitment for the same quarter. Expect a clear rejection.
3. Admin → Jobs. Confirm the populate job ran and named courses in its log.
4. Click **Courses** on the recruitment. Confirm only `needsTa` courses offered that quarter appear,
   with live instructor/day/time/room/enrollment, numbers padded and in sorted order.
5. Remove a course; confirm the modal, and that it disappears.
6. Click **Populate** again. Confirm the removed course does **not** come back, and that any course
   newly ticked in Admin/Courses does appear.
7. Open the recruitment. Confirm status flips and `actualOpeningDate` is set.
8. Close it, then re-open. Confirm `actualClosingDate` was recorded and `actualOpeningDate` still
   shows the **original** opening.
9. Create a **ULA** recruitment for the same quarter. Confirm it is allowed and lists the `needsUla`
   courses.
10. Visit both new pages as a non-admin. Expect Access Denied.

## Open questions

1. **Should the type be shown to applicants later, or is it purely internal?** Affects nothing here,
   but iteration 4 will care.
2. **Date fields**: dates only, or date-times? Dates are simpler and probably right for a deadline,
   but "actual opening" is really a timestamp.



