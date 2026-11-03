# Pacific Time (issue #293)

Every date and time the app shows, accepts or stores is in Pacific time
(`America/Los_Angeles`), whatever zone the server or the browser is in. Before this change
the deployed server ran in UTC, so every stamp it wrote (`LocalDateTime.now()`,
`@CreationTimestamp`) was UTC wall-clock time, the browser then read those zone-less strings as its
own local time, and "today" on the server rolled over at 4 or 5 p.m. in Santa Barbara.

## The rule

| Kind of value | Java | Column | Meaning |
| --- | --- | --- | --- |
| A calendar date a person enters (opening date, deadline, graduation) | `LocalDate` | `DATE` | Has no zone. Shown and compared as entered. |
| A date and time the app records (submitted, edited, created, refreshed) | `LocalDateTime` | `TIMESTAMP` | **Pacific wall-clock time.** Sent to the browser with no zone, shown as it reads. |
| An exact instant (when a user was last online) | `Instant` | `TIMESTAMP WITH TIME ZONE` | Stays an exact instant. Sent with a `Z`, converted to Pacific for display. |
| The UCSB quarter calendar | `LocalDateTime` | `TIMESTAMP` | Copied from the UCSB API, which already gives Pacific times. Not touched. |

"Now" and "today" come from one place on each side: `AppTime` (backend) and
`frontend/src/main/utils/pacificTime.ts`. A frontend test fails if any other file calls
`toLocaleString`, `new Date()` with no argument, `Date.now()`, `Intl.DateTimeFormat`,
`toISOString` or `getTimezoneOffset`.

## Why the date-time columns store Pacific wall-clock time

The issue asks for it, and these columns are already zone-less `TIMESTAMP`s written from the
server's wall clock, so changing what the wall clock is costs no schema change. The cost is that
the hour that repeats when clocks fall back each November (1:00 to 1:59 a.m. happens twice) cannot
be told apart in the column. Nothing computes with these stamps, and the lists order by `id`; the
one place they are ordered is the Audit Trail page when an admin sorts by its Edited column, where
two changes made within the repeated hour could swap. That is accepted for them. A value that is
compared or computed with, rather than displayed, would be stored as an instant instead; that is
why `users.last_online` is left a `TIMESTAMP WITH TIME ZONE`.

## Audit

Every date/time column, who writes it, and what is done to it.

| Column | Written by | Done |
| --- | --- | --- |
| `applications.submitted_at` | `@PrePersist` (was `@CreationTimestamp`) | Pacific; converted |
| `applications.cancelled_at` | `ApplicationsController.cancel` | Pacific; converted |
| `audit_trail.edited_at` | `@PrePersist` (was `@CreationTimestamp`) | Pacific; converted |
| `recruitment_audit_trail.changed_at` | `@PrePersist` (was `@CreationTimestamp`) | Pacific; converted |
| `notice_versions.created_at` | `NoticesController` | Pacific; converted |
| `recruitments.created_at` | `RecruitmentsController.create` | Pacific; converted |
| `recruitments.last_populated_at` | `PopulateRecruitmentCoursesJob`, `RecruitmentCoursesRefreshService` | Pacific; converted |
| `recruitments.allocations_released_at` | `AllocationVisibilityService` | Pacific; converted |
| `recruitments.faculty_review_closed_at` | `RecruitmentsController` | Pacific; converted |
| `recruitments.assignments_published_at` | `RecruitmentsController` | Pacific; converted |
| `draft_applications.updated_at` | `@PrePersist` / `@PreUpdate` (was `@UpdateTimestamp`) | Pacific; converted |
| `jobs.created_at`, `jobs.updated_at`, `job_logs.created_at` | lib-jobs (`ZonedDateTime` in the JVM default zone) | Pacific because the JVM default zone is now Pacific; converted |
| `users.last_online` | `Instant.now()` | Exact instant; unchanged; displayed in Pacific |
| `ucsbapiquarter.*` | UCSB API (already Pacific) | Unchanged |
| `recruitments.*_date`, `applications.graduation_date`, `language_exam_date_passed` | People, forms | Calendar dates; unchanged |
| `recruitments.actual_opening_date`, `actual_closing_date`, `faculty_review_opening_date` | `LocalDate.now()` when a status button is pressed | Taken from `AppTime.today()` from now on. Existing values written between 4 or 5 p.m. and midnight Pacific are a day late; the time of day was not kept, so they cannot be corrected and are left alone |

Where else a date or time is made, read or shown:

- **Created:** `Instant.now()` (last online, the UCSB quarter cache) and `Clock.systemUTC()` (the
  multi-tab detector) are instants used for durations and never shown; they stay. The Mongo
  auditing `OffsetDateTime.now()` has no collections behind it and is an exact instant.
- **Parsed from input:** forms and API parameters carry `LocalDate`s (ISO `YYYY-MM-DD`, no zone).
  The legacy ULA CSV keeps the form's `Timestamp` as text in the admin comments; Google Forms
  stamps it in the sheet's zone, so the comment now says "Pacific time" after it. The legacy TA CSV
  carries only a date.
- **JSON columns:** the draft application's collections hold dates only (a graduation quarter, a
  `YYYY-MM-DD`), no times. The audit trail's old and new values are text of the same kind.
- **Serialized:** `spring.jackson.time-zone` is now set for every profile (it was production only).
  `LocalDateTime` goes out as `2026-11-01T19:30:00` and `Instant` as `...Z`.
- **Displayed:** the audit trail tables, the notice versions, "last refreshed", the application
  submitted and cancelled times, the jobs and users tables all go through
  `formatPacificDateTime`. "Today" in the frontend (the phase of an application, the days until a
  recruitment opens, the default review deadline, the quarter pickers) goes through
  `pacificWallClock` / `pacificTodayIso`, so someone browsing from New York at 9 p.m. Pacific no
  longer sees tomorrow.

## Configuration

- `TaApplyApplication` makes Pacific the JVM default zone when the class loads, so anything that
  asks the JVM (Hibernate, JDBC drivers, lib-jobs, log lines) agrees with `AppTime`. The
  `Dockerfile` sets `TZ` and `startup.sh` passes `-Duser.timezone` as well, so the very first log
  lines are Pacific too.
- `spring.jackson.time-zone=America/Los_Angeles` in `application.properties` (and the test one).
- `hibernate.jdbc.time_zone` is deliberately **not** set. It has to equal the JVM default zone to
  be harmless, and when it differs it shifts every stored `TIMESTAMP`.
- The stamping annotations `@CreationTimestamp` / `@UpdateTimestamp` are replaced by `@PrePersist` /
  `@PreUpdate` calling `AppTime.now()`, so a stamp does not depend on which zone the JVM has.
- Tests: surefire runs the JVM with `TZ=UTC` (override with `-Dtest.tz=Asia/Tokyo`) and vitest sets
  `TZ=UTC`, so a test that quietly depends on the developer's own California clock fails.

## The one-time conversion (changeset 050)

`050-convert-timestamps-from-utc-to-pacific` runs `UtcToPacificTimestamps`, a Liquibase custom
change, over the zone-less `TIMESTAMP` columns above. It reads each value as UTC wall-clock time and
writes the Pacific wall-clock time of the same instant (`2026-07-01 07:00` becomes `2026-07-01
00:00`; `2027-01-01 07:59:59` becomes `2026-12-31 23:59:59`). It is done in Java rather than SQL so
that it follows the daylight saving rules exactly and works the same on H2 and PostgreSQL. Tables or
columns that do not exist yet (a fresh database; the lib-jobs tables are created by a later
changelog) are skipped, so a new database is unaffected.

**Back up the database before deploying.** Nothing about the conversion is idempotent: running it
twice would shift every value twice. Liquibase runs it once and records that it did.

**Rollback** (`liquibase rollback-count 1`, or restore the backup) converts every value from
Pacific back to UTC. The forward direction loses nothing. The backward direction cannot tell the
two passes through the repeated hour in November, so a value stamped in the second pass
(1:00 to 1:59 a.m. PST) comes back an hour early (as 08:xx rather than 09:xx UTC). A value in the
hour that spring forward skips cannot exist. Rolling back also needs the previous release of the
app, which writes UTC again.

A development H2 file (`target/db-development`) that was filled while running on a Pacific
machine already holds Pacific values, and the conversion would shift them a second time; delete it
(`mvn clean`) rather than migrating it.

Numbering: main has changesets up to 046 (`first_quarter` on applications and drafts, issue #292,
booleans only, no dates); the open pull requests #287 to #291 each add a 044. This one is 050, above
all of them, and leaves room.

## Tests

- `AppTimeTests`: `now` and `today` at midnight, both daylight saving changes and the repeated
  hour, whatever zone the clock or JVM has.
- `UtcToPacificTimestampsTests`: every listed column, nulls, missing tables and columns, values near
  midnight and at the daylight saving boundaries, forward and back, under four JVM zones.
- `PacificTimestampsChangelogTests`: the real changelog with rows in it: forward, rollback, forward
  again, and a fresh database.
- `PacificTimestampsTests`: every stamped entity under four JVM zones.
- `pacificTime.test.ts`, `pacificDefaults.test.ts`: the helpers across five browser zones, the
  daylight saving boundaries, midnight, New Year and the "today" defaults.
- `noScatteredTime.test.ts`: nothing but `pacificTime.ts` formats a time or reads the clock.
