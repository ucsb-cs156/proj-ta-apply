# Instructor feedback on TA/ULA allocations (issue #425)

Each course on the instructor home page (one drop-down per course in each quarter card, issue #364)
has a feedback area between the enrollment table and the TA/ULA cards. This note describes what it
shows, where the data lives and the decisions behind it. The admin page that lists the feedback is
issue #427, a separate change.

## What the instructor sees

Until the quarter's allocations are released, the area says what it is waiting for:

| The quarter's recruitments (that hold a course the instructor teaches) | Message until released |
| --- | --- |
| TA only | "When initial TA allocations have been released to faculty, you will be given an opportunity here to provide feedback" |
| ULA only | "When initial ULA allocations have been released to faculty, you will be given an opportunity here to provide feedback" |
| Both | "When both the initial TA and ULA allocations have been released to faculty, you will be given an opportunity here to provide feedback" |

"Released" is the recruitment's `allocationsReleased` (allocation visibility other than
`ADMINS_ONLY`). With both recruitments, the form waits until both are released.

Then the form appears:

- "Please provide feedback on your allocation of TAs/ULAs" and "Please select all that apply, but at least
  one:".
- Four checkboxes. The TA line ("I would prefer a different number of TAs") is there only if the
  quarter has a TA recruitment, the ULA line only if it has a ULA one. Each line's "Number of ...
  preferred:" box appears only while its checkbox is checked.
- A text area, always shown and editable, limited to 2048 characters (`maxLength`, and anything
  pasted beyond is cut). At the limit it says "If you need more than 2048 characters for your
  comments, it may be better to send an email."
- While no checkbox is checked, "Please select at least one of the options above." The text area
  does not count. Saving is immediate, so this is a reminder; it does not block anything.
- "Last saved: <date and time>", the server's `lastUpdated` of the last save (or of the stored row),
  formatted in Pacific time by `formatPacificDateTime`; "never" before the first save.
- Below the form, a `<details>` titled "Notes on TA/ULA tradeoffs", closed by default: the estimated
  cost of a TA, the estimated cost of a ULA, the ratio "1:X.X" (cost per TA divided by cost per ULA,
  one decimal), the hours each works per week, and the note about constraints. A cost that is
  missing or zero reads "not yet set", and so does the ratio, never NaN or Infinity. Since issue
  #429 the text is an admin's Markdown; see "Instructor Feedback Settings" below.

## Saving

Every change is saved on its own, at once: a checkbox when clicked, a count as it is typed (through
`SavedOnChangeInput`, as on the Budget page: an invalid value is flagged and not sent; an empty box
saves null), the comments 750 ms after the typing stops, or at once when the text area is left or
the page goes away. The saves of one form are sent one after another, so the last thing typed is the
last thing stored.

Unchecking a "different number" box hides its count but does not clear it: the stored number is
kept and ignored, and it comes back if the box is checked again.

There is no version check and no multi-tab warning (see `ConcurrentEditMitigationDesign.md`): the
row is one instructor's own, each save sends one field as an absolute value ("Two facts"), and the
last save of a field wins.

## Instructor Feedback Settings (issue #429, 2026-11-09)

The text of the "Notes on TA/ULA tradeoffs" is no longer hard coded. Admin → **Instructor Feedback
Settings** (`/admin/instructorFeedbackSettings`, `InstructorFeedbackSettingsPage`) edits it the way
the TA and ULA App Settings pages edit their Notices, Terms and Conditions, and the instructor's
form renders the newest version as Markdown, in the same closed `<details>` with the same title.
There is no notes section at all while there is no version.

**Table `instructor_feedback_settings` (changeset 069).** One row per saved version; rows are
inserted, never updated or deleted.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | BIGINT, auto-increment, primary key | The version number |
| `created_at` | TIMESTAMP, not null | Pacific wall-clock time, set by the server (`AppTime.now()`) |
| `editor_email` | VARCHAR(255), nullable | The admin who saved it; null only for version 1 |
| `notes_text` | VARCHAR(1000000), not null | Markdown, up to a million characters (the save refuses more with 400). Not TEXT: on H2 that is a CLOB, which Hibernate's schema validation rejects for a `String`; a wide VARCHAR is the same type on H2 and Postgres, as `notice_versions.content` is |

The changeset inserts version 1: the text the notes showed before, rewritten with the new fields, so
nothing changes for instructors on deploy. Its `created_at` is `LOCALTIMESTAMP`, which is Pacific
because the app makes Pacific the JVM's zone before Liquibase runs; its `editor_email` is null, and
the history shows "(installed with the app)". Liquibase leaves `${...}` it has no parameter for
alone, which the changelog test checks.

**One table for the whole page (for issue #430).** The page's later settings, such as #430's "Ask
faculty for feedback on TA/ULA allocations after both have been released to instructors", are more
columns of this table (a changeset adding, say, `ask_for_feedback BOOLEAN NOT NULL DEFAULT FALSE`),
so each version records the whole page as it was saved. To make that clean, a save names only the
settings it changes: a field the POST body leaves out (or sends as null) is copied from the newest
version. The entity (`InstructorFeedbackSettings`), the body (`SettingsUpdate`) and the TypeScript
type (`InstructorFeedbackSettings` in `feedbackNotesFields.ts`) each gain one field; the instructor
endpoint already returns the whole row; and the page is a column of cards, the notes being the first.

**Endpoints (`InstructorFeedbackSettingsController`).**

- `GET /api/instructor/feedback/settings` (`ROLE_INSTRUCTOR`): the newest version, as a list of zero
  or one (as `/api/notices/current` is).
- `GET /api/admin/instructorFeedbackSettings/all` (`ROLE_ADMIN`): every version, newest first.
- `POST /api/admin/instructorFeedbackSettings` (`ROLE_ADMIN`), body `{"notesText": "..."}`: a new
  version with `created_at` now and `editor_email` the caller's; the text is trimmed; 400 if it
  would be blank. Fields left out are copied from the newest version, as above.
- `GET /api/admin/instructorFeedbackSettings/costs?quarter=` (`ROLE_ADMIN`): the quarter's two
  costs, for the editor's preview. It reads the budget without creating it (the Budget page's
  `GET /api/admin/budget` creates one); a quarter without a budget is two nulls. The figures come
  from `TradeoffCosts.of`, shared with the instructors' `/api/instructor/feedback/costs`.

**Fields.** The text is filled in on the client, as the notices are (`fillFeedbackNotesFields` in
`feedbackNotesFields.ts`), for the feedback's quarter:

- `${quarter}` and the quarter calendar's fields (`${qyy}`, `${firstDayOfClasses}` and the rest),
  exactly as in the notices, from `/api/quarters/one` (through `useNoticeFillIn`). A quarter not on
  file leaves its calendar fields as written.
- `${estimatedCostPerTA}` and `${estimatedCostPerULA}`, in dollars and cents, and
  `${taToUlaCostRatio}`, "1:X.X" to one decimal place, as the notes showed before
  (`costDisplay` and `ratioDisplay`). A missing or zero cost, and then the ratio, read "not yet set".
- `${primaryConsiderationDate}` is not a field here: it belongs to a recruitment, and the notes
  belong to a quarter. The editor flags it in red as an unknown field, and the help page says so.

Anything else in `${...}` is left as written.

**The admin's page.** `FeedbackNotesEditorCard` is the Notices editor card's layout: an explanation,
the fields hint with a link to **Help → Instructor Feedback Fields** (`/help/instructor-feedback-fields`,
a sibling of Notices Fields, so the notices' page stays about recruitments), a "Preview for quarter"
box, the editor and its live preview, Save, and the version history, which here has an Editor
column. The preview's quarters are those with a recruitment (`/api/admin/budget/quarters`), the
newest first and chosen by default; with none, the fields are shown as written. The editor, the
preview, the unknown-field messages, Save and the history are `MarkdownVersionEditor`, taken out of
`NoticeEditorCard`, which now uses it too; `findUnknownFields` and `markUnknownFields` take the list
of known fields, and `describeVersion` takes any `{id, createdAt}`. The quarter-fields table of the
help pages is `QuarterFieldsTable`, shared by both.

## Table `instructor_feedback` (changeset 068)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | BIGINT, auto-increment, primary key | |
| `quarter` | VARCHAR(255), not null | YYYYQ, the budget's key; foreign key to `budgets(quarter)`, on delete cascade |
| `email` | VARCHAR(255), not null | The instructor's email |
| `recruitment_course_id` | BIGINT, not null | Foreign key to `recruitment_courses(id)`, on delete cascade |
| `alloc_reasonable` | BOOLEAN, not null, default false | |
| `different_ta_count` | BOOLEAN, not null, default false | |
| `different_ula_count` | BOOLEAN, not null, default false | |
| `other_concerns` | BOOLEAN, not null, default false | |
| `num_tas_preferred` | INT, nullable | |
| `num_ulas_preferred` | INT, nullable | |
| `comments` | VARCHAR(2048), nullable | |
| `last_updated` | TIMESTAMP | Pacific wall-clock time, set by the server (`AppTime.now()`) |

Unique on (`quarter`, `email`, `recruitment_course_id`): one row per instructor per course per
quarter; co-instructors each have their own.

- **The quarter.** The issue names the field `qxx`, "key to a budget". The budget's key is the
  quarter in YYYYQ form, so the column holds that and is called `quarter`. The budget row exists once
  any recruitment of the quarter has a course; the save calls `BudgetCreationService.findOrCreate`
  first all the same.
- **The course.** A course can have a TA row and a ULA row in `recruitment_courses`. The feedback
  names the TA row if the course has one, else the ULA row: the same id the home page names the
  course by (`QuarterCourse.id`).

## Endpoints (`InstructorFeedbackController`, `ROLE_INSTRUCTOR`)

- `GET /api/instructor/feedback`: every row of the caller's (by the signed-in email), all quarters.
- `PUT /api/instructor/feedback?recruitmentCourseId=`: a JSON body with any of `allocReasonable`,
  `differentTACount`, `differentULACount`, `otherConcerns` (true or false), `numTAsPreferred`,
  `numULAsPreferred` (a whole number, 0 or more, or null) and `comments` (at most 2048 characters, or
  null). Only the fields present change; the row is created on the first save. It sets
  `lastUpdated` and answers with the row. A bad value is 400 and changes nothing.
- `GET /api/instructor/feedback/costs?quarter=`: `estimatedCostPerTA` (the budget's
  `taCostPerQuarter`) and `estimatedCostPerULA` (`ulaRateDollarsPerHour` times
  `estimatedHoursPerULAPerQuarter`, `BudgetService.estimatedCostPerUla`), each null until entered.
  Nothing else of the budget reaches instructors.

Who may save is decided as the home page decides what to show: the caller's email maps to a catalog
name, and the course must be a non-removed recruitment course whose instructor of record is that
name (otherwise 403). Saves and the costs are refused (403) unless the release condition above
holds, counting the recruitments of the quarter that hold a course the caller teaches, as the home
page does.
