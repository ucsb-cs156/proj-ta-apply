# Concurrent edit mitigation

This document describes how the app protects people from losing work when the same thing is open in
more than one browser tab, window or device, and how that protection could be extended from draft
applications (issues #270 and #273) to the budget, the allocations, the faculty rankings and the
assignments.

It has two parts. Part 1 is the mechanism, on the server and on the client. Part 2 looks at four
other places in the app where the same problem exists and proposes iterations, easiest first.

## Part 1. The mechanism

### The problem

Several screens save as the user works, with no Save button to press at the end. A draft
application autosaves every few seconds (#270). The budget, an allocation, a ranking and a tentative
assignment each save the moment a field is edited.

The user can have the same screen open twice without noticing: a second tab, a second window, a
phone as well as a laptop. Each copy shows what was true when it loaded. Each save then writes that
copy's view to the server, and the server, as it stands, accepts it. The last save wins, and the
person who saved first loses their work with no error and no sign that anything happened. This is
the failure the mechanism exists to prevent. It breaks the rule the draft work is built on: never
lose the user's data.

There are two separate things to do about it, and they work at different times:

| | When it acts | What it does |
|---|---|---|
| **Version check** | At the moment of a conflicting save | Refuses the stale save so nothing is overwritten |
| **Multi-tab warning** | Before any conflict | Tells the user that more than one copy is open, so they can close the extras |

The version check is the safeguard. The warning is the courtesy: without it the first the user
hears of the problem is a refused save.

### Mitigation 1. The version check (added in #270)

**Server.** The saved thing carries an integer `version` that starts at 1.

* Reading it returns the version.
* A save sends back the version the client last saw.
* If that equals the stored version, the server applies the save, increments the version and returns
  the new one.
* If it does not, the save is stale. The server changes nothing and answers `409 Conflict`, with the
  current stored value and version in the body so the client can recover.

The comparison and the increment must be one atomic step, not a read followed by a write, or two
saves can both pass the check. The way to get that is JPA's optimistic locking (`@Version` on the
column), or an update that carries `WHERE version = ?` and checks the number of rows changed.

**Client.** The client holds the latest version it has seen and sends it with every save, replacing
it with the version in each successful response. On a `409` it:

1. stops autosaving, so that it cannot keep failing or race the other copy;
2. shows a plain message: "This was changed in another tab or window. Reload to see the latest
   version.";
3. offers a **Reload** button that re-reads the current value and version and refills the screen;
4. does not leave the screen. In particular a **Save Draft** that conflicts does not return the
   user to the home page.

The user's unsaved typing in the stale copy is lost when they reload. That is the price of choosing
one version, and it is why the warning below matters: it makes the conflict rarer.

### Mitigation 2. The multi-tab warning (#273)

The version check says "no" after the fact. The warning says "careful" before it.

**Client.** When a screen that autosaves opens, it makes a random identifier for this copy,
`crypto.randomUUID()`, and keeps it in memory only, never in `localStorage` or `sessionStorage`. A
copy that is duplicated or restored must not inherit another copy's identifier. The client sends the
identifier with:

* every save, as a request header (`X-Client-Id`), and
* a lightweight **heartbeat** every 20 seconds while the screen is open, which exists only to let
  the server see copies that are open but idle.

If a response says that other copies are active, the screen shows a banner:

> The server has detected multiple tabs or windows open on the same application. Please know that
> this is risky; we recommend closing all but one of these.

The banner goes when a later response says the other copies are gone. The wording says "application"
for draft applications. The banner component takes its noun as a parameter, so that other screens
say "budget", "ranking" and so on.

**Server.** A small detector class answers one question: how many distinct clients have touched this
resource recently?

* It is a map from a **resource key** (a string such as `draft:42`) to a map from client id to the
  time that client was last seen.
* `record(resourceKey, clientId)` stores "now" for that client. It also drops entries older than the
  window while it is there, so the map does not grow without bound.
* `othersActive(resourceKey, clientId)` is true if any client other than this one was seen within
  the **window**. The default is 60 seconds, three times the heartbeat, so one lost heartbeat does
  not make a copy disappear.
* The clock and the window length are constructor arguments, so tests run in zero time with a fake
  clock.
* The save and heartbeat endpoints call `record`, then put `othersActive` in the response as a
  boolean (`otherClientsActive`) alongside the saved value.

The warning clears by itself. Once the extra copies are closed, they stop heartbeating, they age out
of the window, and the next response to the remaining copy says `false`.

**What the warning is not.** It is advice, not a lock. A user who ignores it is still protected by
the version check.

### Limits

* **One server.** The detector's state is in memory. With two server processes behind a load
  balancer, each sees only the requests it handled, so two copies talking to different processes
  would not see each other. The app runs as a single instance today. If that changes, the state
  moves to the database: a table of `(resource_key, client_id, last_seen)` rows, written on each
  save or heartbeat and read with a time cutoff, with old rows deleted by the same query. The
  interface stays the same and only the store changes, which is the reason for putting it behind an
  interface.
* **A server restart** forgets who was open. The warning is absent for up to one window. The version
  check, which lives in the database, is unaffected.
* **Idle copies without a heartbeat** are invisible, which is why the heartbeat exists. A copy in a
  background tab may have its timers throttled by the browser. The 60-second window is chosen to
  ride that out in most browsers.
* **One copy only** never sees either mechanism. This is as intended.
* **Different people editing the same thing** are not distinguished from one person with two copies.
  Both are conflicts and both are handled the same way. The warning text, which talks of "tabs or
  windows", is slightly off in that case. The version check is right either way.
* **No merging.** The mechanism detects and refuses. It does not combine two sets of edits. Where
  the edits are to different fields of one record this is a real cost, which Part 2 returns to.

### Keeping it self-contained

The pieces are written so that they could later be lifted out as libraries without edits.

| | Where | Depends on |
|---|---|---|
| Server | A package of its own, `edu.ucsb.cs.taapply.concurrency` | The JDK, and `jakarta.servlet` for the header read. No entity, repository or service from the app |
| Client | A folder of its own, `frontend/src/main/concurrency/` | React, and `axios` for the header. No import from `main/components`, `main/pages` or `main/utils` |
| Tests | `src/test/.../concurrency/` and `frontend/src/tests/concurrency/` | The same, plus a fake clock |

The server package holds the detector, the interface it implements, the in-memory implementation
and the small exception that becomes a `409`. The client folder holds the hook that makes and sends
the identifier and heartbeat, the banner, and the conflict message with its Reload button. Each
piece takes what it needs by parameter, such as the resource key, the noun in the banner, or the
function that reloads, and never reaches into the app. An import of `main/...` from the client
folder, or of `edu.ucsb.cs.taapply.entity` from the server package, is a bug in this design. A lint
rule or an architecture test can enforce it.

How each application screen uses them (what its resource key is, what its `409` body contains, what
Reload does) stays in the application, outside these folders.

The draft applications design, in `DraftApplicationsDesign.md`, describes the first use of the
version check. This document is where the mechanism is described in general.

## Part 2. Extending it to the rest of the app

The notes below come from reading the code that saves each of the four things. Two facts hold for
all of them.

**Saves are single-field and absolute.** Each save sends one new value for one field or one row, not
a whole document. For example, `PUT /api/admin/budget` receives only the line that was edited, and
the controller changes only the lines that are present. Two copies editing different fields of the
same record therefore do not overwrite each other. The lost update this design is about happens when
two copies edit the same field, or when a copy acts on a view that has gone stale.

**The harm is as much a stale picture as a lost value.** A stale copy shows totals, counts and ranks
that no longer add up, and the user decides on that basis. Detecting a second copy helps here even
when no save is refused.

That suggests a lighter form of the version check than a version column, useful when adding a column
is more work than the risk justifies:

> **Compare-and-set.** The save carries the value the user saw (`expected`) as well as the new
> value. The server applies the save only if the stored value still equals `expected`; otherwise it
> answers `409` with the current value.

It catches the same-field conflict, needs no migration, and can be added one field at a time. It
does not notice that a different field changed, which, given the first fact above, is usually fine.
A version column is the better choice when a save depends on several fields, or on other rows, being
as the user saw them.

### (a) The budget for a quarter

**What saves.** `BudgetController`, `PUT /api/admin/budget?quarter=`, sets any of the three lines
(`unrestrictedBudget`, `tasOnlyBudget`, `ulasOnlyBudget`) on the single `budgets` row for the
quarter. The Budget page (`BudgetPage.tsx`) also edits two values on each recruitment's own row: the
average cost per position and the total hiring target. Each is a separate request with one value.

**What goes wrong today.** An admin who sets the TAs-only line to 40,000 in one tab and 45,000 in
another leaves whichever saved last. The summary on screen, computed on the server and returned
after each save, is right for the saver and stale in the other tab, so two admins can disagree about
how much money there is. Admins are few, so this is rare, but the number matters.

**Fit.** Resource key `budget:<quarter>`. A version column on `budgets` covers all three lines. It is
one row per resource, the simplest case there is. For the two recruitment fields, a version on
`Recruitment` would be heavier, since that row is edited from many pages, so compare-and-set on those
two fields is the lighter choice.

**On conflict.** The page keeps what the user typed, shows the current value beside it ("The TAs-only
budget is now 45,000.00; you entered 40,000.00") and offers **Use theirs** and **Overwrite**.
Overwrite re-sends with the current version. Letting the user force the issue is reasonable here:
one field, one number, and the user can see both.

**Risks.** Low. The budget is a planning figure and "changes are not audited" (see the `Budget`
class comment), so there is no history to reconcile. The hiring target is shared with the
allocations (see (b)), so a conflict on it should refresh the allocation summary too.

### (b) The allocations to courses

**What saves.** `RecruitmentCoursesController`,
`PUT /api/recruitmentcourses/allocation?id=&allocation=`, sets the allocation on one
`RecruitmentCourse` row, from the cell the admin edits in `RecruitmentCourseTable.tsx`. Separately,
`POST /api/recruitmentcourses/autoAllocate` overwrites the allocation of every non-removed course in
the recruitment in one request (#176, with the minimum-of-one rule from #257).

**What goes wrong today.** Two cases.

1. *Cell against cell.* As with the budget: the same course's allocation set to two values.
2. *Cell against Auto Allocate.* An admin runs Auto Allocate in one tab while another tab has the
   table open. The second tab still shows the old numbers, including a total that matched the hiring
   target. A single cell edit from there writes one number into a table whose other rows have all
   changed, and the total no longer equals the target. No error occurs.

**Fit.** Row-level for the cell edit: resource key `course:<id>`, with a version on
`recruitment_courses`. The bulk operation needs a recruitment-level guard, because it changes every
row at once: a counter on `Recruitment`, bumped by Auto Allocate and sent with every cell edit. A
cell edit then fails if either the row's version or the recruitment's counter has moved. A counter
on `Recruitment` spares the cell edit from needing every row's new version after a bulk change.

**On conflict.** For a cell edit, as in (a), show the current value and let the admin choose. After a
conflict caused by the recruitment counter, reload the whole table, since all the old numbers are
suspect.

**Risks.** Medium. `RecruitmentCourse` rows are also written by the course refresh and by the
enrollment estimates, which are not allocation edits. If the row's version moved for those reasons, a
cell edit would be refused for a change the user did not care about. Keep a separate
`allocationVersion` column for this purpose. That is cleaner than accepting spurious conflicts and is
recommended.

### (c) The faculty rankings for a recruitment course

**What saves.** `InstructorRecruitmentsController`,
`PUT /api/instructor/recruitments/{recruitmentId}/courses/{recruitmentCourseId}/candidates/{applicationId}/rank`,
creates or updates one `candidate_ranking` row, with `(recruitment_course_id, application_id)` unique
and the rank an integer or null. Ties are allowed. `CandidateTable.tsx` keeps every rank in local
state and sends one request per edit, then asks the page to re-read what depends on the rankings. The
endpoint is open to instructors and to admins.

**What goes wrong today.**

* The same instructor with two tabs sees ranks as they were when each loaded. A rank of 3 entered in
  one tab can sit beside a 3 entered for a different candidate in the other: a tie the instructor did
  not mean. The table warns about ties only for the copy that holds both values.
* If more than one person can rank for the same course (an instructor and an admin, or two
  instructors on a co-taught course), they can undo each other's work without either learning of it.
* The rankings feed the Candidates Ranked and Rankings Still Needed counts, so the admin's picture is
  wrong until the next re-read.

**Fit.** Resource key `ranking:<recruitmentCourseId>`: the whole list for the course, even though
each save is one row, because a rank only means something relative to the others. The multi-tab
warning is the most valuable half here, since the stale picture is the real hazard. A version on the
course's ranking as a whole, bumped by any rank edit on that course, gives a sound check: an edit is
refused if the list changed since the copy last read it. That is stricter than compare-and-set on
one row and refuses edits that would have been fine, such as two instructors ranking different
candidates. It is acceptable only together with the conflict handling below, which makes a refusal
cheap.

**On conflict.** Do not discard the instructor's rank. Re-read the list, keep the pending edit in
the box, show "Rankings for this course changed while you were editing; your change has not been
saved", and let the instructor press **Save** again after seeing the new list. Ranking is deliberate
work and the table can hold many edits, so a full reload that loses an edit would be unkind.

**Risks.** Medium to high. The version has to live somewhere that does not exist today (a column on
`recruitment_courses`, or a table of its own), and it is touched on a hot path. Rank edits are
frequent, so conflict handling that irritates will be noticed. Rankings are only editable while the
faculty review is Open, which limits the exposure. The Developer Mode job that creates fake rankings
(#220) writes these rows too and must bump the same version.

### (d) The assignments

**What saves.** `AdminAssignmentsController`, `PUT /api/admin/assignments/tentative`, sets or clears
`tentativeAssignmentId` on one application. The page (`AdminAssignmentsPage.tsx`) sends one request
per assignment, and the response is the recruitment's whole assignments view with the new counts.
Assignments are admin-only. Publishing them is a separate step (#243).

**What goes wrong today.**

* Two admins assign different applicants to the same course, each sure a place is left. The counts
  that are right for the saver are stale for the other.
* The same applicant is assigned to one course by one admin and to another by a second. The second
  save replaces the first, and the first admin's page still shows the applicant where they put them.
* An admin working from a stale page after the other has published, or after an applicant has
  cancelled, acts on a state that no longer exists.

**Fit.** Resource key `assignments:<recruitmentId>`. What matters (how many are assigned to each
course, who is unassigned) are properties of the set of assignments, not of any one row, so a
per-row version would catch only the case where the same applicant is assigned twice. A
recruitment-level version, bumped by every tentative assignment and by publish, catches both, and the
multi-tab warning, keyed the same way, says that someone else is working on the same recruitment.
The response to a save already carries the whole view, so on success the client can take the new
version from it without an extra read.

**On conflict.** Refuse the stale assignment, reload the view (one request, and fast) and say what
changed: "Assignments changed while you were working. The page has been refreshed; please check the
placement and try again." The admin's click is not replayed, because after a refresh it may no
longer be the right move.

**Risks.** Highest. A recruitment-level version means any admin edit refuses every other admin's
pending edit, so two admins assigning in parallel would collide constantly unless the check is
narrowed: refuse only if the target course's count or the applicant's current assignment has changed
since the client read them. That is a compare-and-set over several fields and is the most intricate
part of this whole design. It touches the publish path and the counts that feed the Recruitment Steps
panel. It should come last.

## Iterations

In order, easiest first. Each is written to become an issue. Sizes are rough: S is a day or less, M a
few days, L about a week.

1. **Extract the mechanism and cover draft applications. (M, issues #270 and #273.)** The version
   check on drafts, the detector, the client hook and banner, in their own package and folder with
   their own tests, plus this document's Part 1. This is the base that everything below uses, and it
   is already planned.

2. **Budget: version the quarter's budget row and warn about multiple copies. (S.)** One row per
   quarter, one admin at a time in practice, the smallest possible user of the mechanism. Add a
   `version` to `budgets`, a `409` on a stale `PUT /api/admin/budget`, the **Use theirs** and
   **Overwrite** choice, and the banner on the Budget page. Use compare-and-set for the recruitment's
   average cost and hiring target. It proves the mechanism on a second, unrelated screen and shows
   whether the package really is free of application knowledge.

3. **Allocations: guard the cell edit and the bulk Auto Allocate. (M.)** Add `allocationVersion` to
   `recruitment_courses` and a bulk-change counter to `Recruitment`. Cell edits send both and get a
   `409` when either has moved. Auto Allocate bumps the counter and returns the new table, and the
   table reloads after a counter conflict. This adds the one idea the budget lacks, a
   recruitment-level change that invalidates every row, but still has only admin users and
   single-field saves.

4. **Rankings: version a course's ranking list and keep the user's pending edit on conflict. (L.)** A
   version on the course's rankings, bumped by every rank edit (including the Developer Mode fake
   rankings job), a `409` on a stale edit, the warning keyed on the course, and the "your change has
   not been saved" handling that keeps the edit in the box. More users, a hot path and a state
   machine in the client make it bigger than the first three, but each save is still one row.

5. **Assignments: narrow the check to the affected course and applicant. (L.)** A recruitment-level
   version first, then narrowed so that parallel admins do not collide: refuse a tentative assignment
   only if the target course's count or the applicant's assignment changed since the client read
   them. Refresh the view on conflict. Cover publish and applicant cancellation. This is last
   because the check spans rows, the counts are shared with the steps panel, and it is the one place
   where a too-strict check makes the screen unusable and a too-loose one allows an over-assigned
   course.

After iteration 2 it is worth stopping to look at what the second user of the package needed that the
first did not, and to fix the package before three more screens depend on it. That is also the moment
to decide whether extracting it into a library of its own is worth doing.
