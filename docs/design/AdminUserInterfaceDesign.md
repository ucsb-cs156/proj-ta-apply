# ta-apply: Admin User Interface Design

This document records the decisions (made 2026-11-01) for reorganising the admin's view of a
recruitment around the **Recruitment Steps** flow, so that the controls an admin uses are laid
out in the order the steps happen and show, at a glance, which steps are done.

It builds on the earlier design documents: InitialDesign.md (applications), ReviewDesign.md
(faculty rankings), AssignmentDesign.md (budget, allocations, assignments) and
DeveloperModeDesign.md (fake data for test instances).

## The Recruitment Steps

A recruitment is run in nine steps. Steps have *hard* prerequisites (must happen first) and
*soft* prerequisites (the preferred order, not enforced).

| # | Step | Hard prerequisites | Soft prerequisites |
|---|---|---|---|
| 1 | Create TA (or ULA) Recruitment | | |
| 2 | Open TA (or ULA) Applications | 1 | |
| 3 | Budget / Allocations | 1 | |
| 4 | Close TA (or ULA) Applications | 2 | |
| 5 | Release Allocations to Faculty * | 3 | |
| 6 | Open Faculty Ranking | | 4, 5 |
| 7 | Close Faculty Ranking | 6 | |
| 8 | Assign Candidates to Slots | 6 | 7 |
| 9 | Release Hiring Decisions | 4, 7, 8 | |

\* Allocation visibility has three settings, chosen in one place: **admins only** (the
default), **each faculty member sees the allocations for the courses they teach**, or **all
faculty see all allocations**. Step 5 means moving off "admins only"; which of the other two to
choose is up to the admin.

### The diagram

The steps are drawn left to right in two rows: steps 2, 4 and 7 on the top row, steps 3, 5,
6, 8 and 9 on the bottom row, and step 1 at the left between the rows. Boxes are rectangles
with rounded corners sized to their text, labels broken over up to three lines with a hanging
indent so the step numbers stick out, in Arial Narrow (Liberation Sans Narrow and Arial as
fallbacks) at 13px. Hard prerequisites are solid arrows, soft ones dashed; a legend explains
both, and the footnote for step 5 sits under the legend. Step 7 is centred above the gap between
6 and 8. The diagram is 835 × 392 units and scales to its container.

There are two versions, TA and ULA, differing only in the words TA/ULA in steps 1, 2 and 4.

The diagram is generated from a table of steps and edges, not drawn by hand, so the help page
and the live admin card share one source. The agreed layout, produced during design, is kept as
the specification the component's tests check against.

### The help page

**Help → Recruitment Steps** (for signed-in admins and instructors) shows the diagram in its
static form (no recruitment data) with a numbered list explaining each step, and a paragraph
saying that faculty who want to ask for more or fewer TAs or ULAs for a course should do so
after step 5 and before or during step 6.

## The live diagram on the admin recruitment card

On the admin's home page, each recruitment card shows the diagram **for that recruitment**,
with three additions:

1. **A green check** in the upper-right corner of each box whose step is done.
2. **A label and date** (or value) along the bottom of each box.
3. **Links** from the box text to the control that performs the step: a modal opened from the
   card, or a page.

| # | Bottom label | Done when | Link(s) |
|---|---|---|---|
| 1 | `Created: {date the recruitment was created}`; just `Created` for an old recruitment whose date was never recorded | always | under the box, a line **n courses** and a link **(see courses)** → the Courses page |
| 2 | `Opened: {actualOpeningDate}` once opened; before that `Tentative: {tentativeOpeningDate}` | actualOpeningDate is set | the Open Applications modal; under the box, a line **n draft applications** and a link **(see draft applications)** → the Draft Applications page |
| 3 | `Hiring Target: {n}` (the target is never unset: it defaults to 1, which is obviously wrong in practice and signals that action is needed) | the allocations add up to the target | the word **Budget** → the Budget for Quarter page for the recruitment's quarter; the word **Allocations** → the quarter's Combined Allocation page, `/admin/allocations/QXX` (issue #358; it was the Recruitment Courses edit page); the two words are set well apart (two ordinary lines of text apart, not one), so it is plain that they are two separate links |
| 4 | `Closed: {actualClosingDate}` once closed; before that `Prim. Consid: {primaryConsiderationDate}` | actualClosingDate is set and applications are closed | the Close Applications modal; under the box, a line **n applications** and a link **(see applications)** → the Applications page |
| 5 | `Released: {date}` or `Not released yet` | visibility is not "admins only" | the Allocation Visibility modal (three radio options); and a separate link **(see allocations)** → the quarter's Combined Allocation page (issue #358; it was the Courses page) |
| 6 | `Opened: {date faculty rankings opened}` or `Not opened yet` | faculty review opening date set | the Open Faculty Rankings modal; and a separate link **(see rankings)** → the Courses page, the same as under step 7 |
| 7 | `Closed: {date faculty rankings closed}`; before that `Deadline: {facultyRankingDeadline}` if a deadline is set, else `Not closed yet` | reviews closed after having been open | the Close Faculty Rankings modal; and a separate link **(see rankings)** → the Courses page |
| 8 | `Still to assign: n` while tentative assignments < target; `Assignment complete` otherwise | assignments ≥ target | the admin Assignments page, `/admin/recruitments/:id/assignments`, where the assignments are made; and a separate link **Make Assignments** → the same page (issue #317; until then the link read **(see assignments)** and went to the read-only page, the same as under step 9) |
| 9 | `Released: {date hiring decisions released}` or `Not released yet`, followed by the reopening note below when it applies | assignments published | before publishing, the Release Assignments (publish) modal; after publishing, the read-only assignments page, `/recruitments/:id/assignments`; and, published or not, a separate link **View Assignments** → that read-only page (issue #358 sent it there; issue #317 named it; before publishing the page says the assignments are not published yet) |

Steps 8 and 9 both concern assignments, so their links are worded to tell the two pages apart
(issue #317): **Make Assignments** is the admin page where candidates are assigned to slots, **View
Assignments** the read-only page with the two layouts that admins and faculty share. The same two
words label the card's two assignment buttons, so the diagram and the button row agree.

The counts and links under the boxes come from the same steps endpoint as the labels. **n courses**
counts the recruitment's courses that have not been removed. **n draft applications** (step 2) counts the recruitment's draft applications, the same number as the card's draft button. **n applications** (step 4) counts the real,
non-cancelled applications: applications made by applicants, plus test and fake ones only in
developer mode. It is therefore the same number the Assignments page works from, and it can be
smaller than the count on the card's own application button, which also includes cancelled
applications (counted per applicant: a person who cancelled and then applied again, issue #318,
counts once there). The created date in step 1 is stamped when the recruitment is created; recruitments
that predate the field were filled in from their audit trail.

### Hiring decisions and reopening

Releasing hiring decisions (step 9) has three hard prerequisites: applications are closed (step 4),
faculty ranking is closed (step 7), and candidates have been assigned (step 8). The application
enforces them: an admin who tries to release hiring decisions with applications or faculty ranking
still open is told which step has to be done first and nothing is released.

Applications and faculty ranking can be **reopened retroactively**. When hiring decisions have
been released and either applications or faculty ranking is open again, the step 9 box shows the
note **"Tentative; part of the hiring process has been reopened"** under its date. When both are
closed there is no note; the box also never says "Final", because a later reopening is always
possible.

The hiring target is never null (it is a divisor in the budget and ratio figures), so the diagram
always shows `Hiring Target: n`. It starts at 1, or, since issue #384, at the target of the same
type's recruitment in the most recent earlier quarter when there is one (see "The budget of a new
quarter" below).

The dates for steps 1, 5, 7 and 9 are not stored today; the backend will store them (created
at, allocations released at = the first time visibility left "admins only", faculty review
closed at, assignments published at) and stamp them
from the existing endpoints. The backend computes the labels, done flags and link targets in one
endpoint so the frontend only draws.

## The quarter card (issues #357, #379)

The admin home page shows **one card per quarter** (`AdminQuarterCard`; until issue #379 a flat,
lighter **QXX Budget** card above the quarter's recruitment cards, issue #357). Its header row,
on a light background, is headed by the quarter alone (QXX from `yyyyqToQyy`, such as "W26", in
the large font) and carries the quarter's two buttons, since issue #358 (part 3): **Budget
Planning** (`/admin/budget/QXX`; it was labelled **Budget**) and one allocation button to the
quarter's Combined Allocation page, `/admin/allocations/QXX`, labelled by the recruitments the
quarter has: **Allocate TA slots to Courses**, **Allocate ULA slots to Courses** or **Allocate TA
and ULA slots to Courses** (before part 3 there were two buttons, **TA allocations** and **ULA
allocations**, to `/admin/recruitments/:id/courses/edit` of that quarter's TA or ULA recruitment,
each greyed out when the quarter had no recruitment of that type; the single button is greyed out
only when the quarter has neither, which the home page never shows).

**Opening and closing (issue #379).** Everything on the header row except the two buttons is one
`<button aria-expanded>`: a caret (▾ open, ▸ closed) and the quarter. It grows to fill the row, so
clicking anywhere on the row other than a button toggles the card, a button click only navigates,
and the keyboard (Tab to the row, Enter or Space) toggles it too. The two buttons sit together at
the right end of the row, after the toggle. The quarter's recruitment cards are nested inside the
quarter card's body, which is not rendered while the card is closed (so a closed quarter's steps
are not fetched). The **nested recruitment card** (`RecruitmentCardLayout`) has the same kind of
row: one toggle button holding the caret, the type (**TA** or **ULA**, in the large font the
quarter used to have; the quarter itself is dropped from the heading, since the card sits inside
the quarter's), the status badges and the application count, with the trash icon beside the toggle
at the right edge; its dates, steps panel and button row are rendered only while it is open, and
each nested card opens and closes independently of the other and of the quarter.

*Default state:* the newest quarter (the largest `yyyyq` among the recruitments, whichever order
the cards are shown in) starts open with both of its nested cards open; every older quarter starts
closed, and its nested cards start open when it is opened (one click shows the quarter's two cards,
each with its dates and the steps diagram's one-line summary). The diagram inside keeps its own
rule: expanded on the most recent TA and the most recent ULA recruitment, collapsed elsewhere.
*Remembered:* each card's state is kept in this browser's localStorage (`useRememberedOpen`, the
hook `CollapsibleCard` also uses) under `adminQuarterCard.QXX` for a quarter and
`adminRecruitmentCard.yyyyq.TYPE` for a nested card, so it stays as the admin left it, as the hidden
columns of the tables do; the default applies only until the card has been toggled once. When a new
quarter is created it has nothing remembered, so it opens as the newest; the quarter it displaces
falls back to closed unless the admin had toggled it.

*The Sort by bar is gone.* With the cards nested by quarter, sorting across quarters by type,
status or a date no longer meant anything, so the seven-button bar of issue #86 is replaced by a
**Quarters** control with two buttons, **Newest first** (the default) and **Oldest first**, which
only order the quarter cards; within a quarter the TA card always comes before the ULA card. The
quarter card and the nested cards move with the order and keep their open or closed state.

## The budget of a new quarter (issue #384)

A quarter's `budgets` row is created the first time anything needs it, which since issue #363 is
usually when a recruitment of the quarter first gets a course (Populate, Add by enroll code, or a
removed course coming back), and otherwise when an admin first opens `/admin/budget/QXX`. Both
paths go through one method, `BudgetCreationService.findOrCreate(quarter)`, so the row is built
the same way whichever comes first: as a copy of the most recent earlier quarter's budget, the one
with the largest `YYYYQ` smaller than the new quarter's (a summer with no budget is skipped). Copied
are the three fund lines, the four cost and fund figures of #388 (`taCostPerQuarter`,
`ulaRateDollarsPerHour`, `estimatedHoursPerULAPerQuarter`, `giftFundsForASEs`) and the conversion
factor `conversionTAtoULA`; the two version counters are not, so the new row starts at 0 like any
other. With no earlier budget on file the row has the defaults (zero lines, empty costs, factor 3).

The hiring targets stay on the recruitments, so they are copied when a recruitment is created
(`RecruitmentsController.postRecruitment`, which both the Create Recruitment form and Developer
Mode's auto-create post to): the new TA recruitment's target is the TA recruitment's in the most
recent earlier quarter that has one, the ULA's the ULA's, and 1 when there is none. Changing a
later quarter's figures never touches the earlier quarter's.

## The Audit Trail card of the Budget page (issue #391)

At the bottom of `/admin/budget/QXX`, after the bottom line, is a `CollapsibleCard` headed **Audit
Trail** with "Track changes to hiring targets" in a smaller font beneath the title on the header
(the card's new `subtitle` prop). It is closed by default and remembers its setting under
`collapsibleCard.BudgetPage-auditTrail`, like the other admin cards. Its body is only rendered, so
only fetched, while it is open: `GET /api/admin/recruitmentaudittrail/hiringTargets?quarter=YYYYQ`
(admin only; `page`, `size`, `sort`, `direction` as on `/all`), which returns the
`totalHiringTarget` rows of the quarter's TA and ULA recruitments, newest first by default, each
row augmented with the recruitment's `type`. Open, the card shows the page-size control, Previous
and Next, "n changes recorded." and the `RecruitmentAuditTrailTable` with its `showType` column
(id, Changed, Changed By, **Type**, What Changed, Old Value, New Value); a quarter with no
recruitment or no change yet gets one sentence, "No hiring target has been changed yet for this
quarter." While the next page is fetched the previous one stays up (`keepPreviousData`), so turning
a page never shows that sentence in between.

The rows exist because #391 made `totalHiringTarget` an audited field: it is the last entry of
`RecruitmentAuditService.FIELDS`, and `RecruitmentsController.updateTotalHiringTarget` takes its
snapshot inside the compare-and-set block (once the stored value is known to be the one the page
saw) and saves through `saveAndRecordChanges`, so the target and its row are one transaction (#377)
and a refused save (409) writes nothing. The same rows therefore also appear in the recruitment's
own change history. A hiring target saved on the Budget page invalidates the card's query
(`HIRING_TARGET_AUDIT_KEY` in `useBudgetSaves`), so an open card shows the new row at once; a
budget-line save does not, since nothing on the `budgets` row is audited (fund lines, costs and the
conversion factor remain planning figures).

## The Combined Allocation page (issue #358)

`/admin/allocations/QXX` (for example `/admin/allocations/W26`; admins only) shows one quarter's TA
and ULA allocations side by side, and since part 3 of the issue it is the only place an admin edits
enrollment estimates and allocations. It was modelled on `/admin/recruitments/:id/courses/edit`,
which keeps everything but the budget columns and their controls (see "What left the Recruitment
Courses pages" below).

- **Rows**: the union of the courses of the quarter's TA and ULA recruitments, one row per enroll
  code (a course's two lectures are two rows; a section in both recruitments is one row). A
  section in only one recruitment has blank cells for the other type.
- **Enrollment Estimate**: one column, editable as the Courses page's box was (saved a second after
  the last keystroke, an empty box clears it). Since issue #363 a section has one estimate per
  quarter, a `budget_courses` row shared by the TA and ULA recruitments, so the two recruitments'
  course rows always report the same value. (Before that each recruitment's course row had its own
  estimate; the page showed the higher of the two and saved an edit to every recruitment's row so
  they agreed.) An edit is saved to one of the section's rows, and the other recruitment's row takes
  the value from the quarter's estimate (issue #381). All the ratios on the page use this one value.
- **Columns per type**, only for a type that has a recruitment: Allocation (editable, through the
  same endpoint and version checks as the Recruitment Courses page, against that type's
  recruitment), Unrounded Allocation, Delta and TA:student (or ULA:student) ratio.
- **The other columns of the Courses page** (follow-up to the first PR): TA Rankings and ULA
  Rankings (a type's only once its faculty reviews are not `NotStarted`, linking to the course's
  ranking page), Section, Title, Instructor, Email (with the copy widget), Days, Time, Room,
  Enrolled, Max, Status and, for a summer quarter, Summer Session. A totals row under the table
  has Total Course Count and the sums of Enrolled, Max, Enrollment Estimate and each type's
  Allocation. A column starting with TA exists only when the quarter has a TA
  recruitment, and likewise ULA. The descriptive columns are the same course for a section in both
  recruitments: the TA row is used, the ULA row when there is no TA row. **Course Number** has a
  stacked heading ("Course" over "Number") and a cell 11 characters wide (`11ch`, monospaced), the
  width of the widest CMPSC course number, `CMPSC 190DD` (issue #383; it was `13ch` for the API's
  padded `XXXXXXX 999XX`). The cell shows the number without the API's eight-column subject area
  padding but with its digits still right-justified in three columns (`compactCourseNumber`), so
  `CMPSC   8` and `CMPSC 190DD` line up.
- **Stacked type headings** (issue #383): each type's Allocation, Unrounded Allocation and Delta
  headings put the type (TA or ULA) at the headings' full size over the other words, each on its
  own line at 70% (`stackedLead` in `columnStyles.tsx`: TA / Allocation; TA / Unrounded /
  Allocation; TA / Delta), so each column is no wider than its one widest word. The whole phrase
  stays the heading's text and its `title`, so sorting, hiding, screen readers and tests see
  "TA Unrounded Allocation" as before.
- **Showing and hiding columns**: every heading except Course Number has the small "hide" link, and
  a **Columns** menu has Show All, Show None and a box per column except Course Number, which is
  always shown. The choice is kept per quarter in local storage (key
  `combinedAllocations.hiddenColumns.QXX`). The default-visible columns are those of the Courses
  page (Instructor, Enrolled, Max, Enrollment Estimate, and each type's Allocation, Unrounded
  Allocation, Delta and ratio) plus the ASE:Student Ratio; the rankings, Section, Title, Email,
  Days, Time, Room and Status start hidden.
- **Controls** (as the Edit Courses page had them until part 3): *Set enrollment estimates from: max, actual* (the
  endpoint takes one recruitment, so it is called for each recruitment of the quarter), and
  *Auto assign TA allocations* / *Auto assign ULA allocations* (each only when that recruitment
  exists, with the same tooltip and confirmation modal). *Download Rankings CSV* is not on this
  page: it is on each recruitment's card (below).
- **Developer mode** (part 2, PR #373): the footer has the Edit Courses page's *Fake Hiring Targets
  and Allocations* button for the whole quarter. It opens one modal with a hiring target box per
  recruitment that has a course (*TA hiring target*, *ULA hiring target*; one estimate source and
  one visibility choice for both) and sends one `POST /api/admin/developer/fakeAllocations` per
  recruitment in one click; it is disabled when no recruitment has a course. `FakeAllocationsModal`
  takes a list of recruitments; the Edit Courses page passes its one. Until issue #385 the footer
  also had a *Create Fake Rankings* button that launched one `POST /api/admin/developer/fakeRankings`
  job per recruitment whose faculty review was Open; the maintainer did not want rankings faked for
  the TA and ULA recruitments at once, so it was removed, and the admin Assignments page
  (`/admin/recruitments/:id/assignments`) is the only page in the app with *Create Fake Rankings*.
  Issue #385 moved the single-recruitment button there from the Edit Courses page, red like the
  other developer-mode buttons while it can be used. When it cannot (faculty ranking not Open, or
  no course on offer) it is the neutral outline it always was, disabled, and a tooltip on it says
  what must happen first (`fakeRankingsBlockers`); with no applicants the modal notes that the job
  would rank nobody. `FakeRankingsModal` takes one `recruitmentId`.
- **Multi-tab edit warning** (part 2, PR #373): the page is one tab on every recruitment of the
  quarter, so it heartbeats under each recruitment's Edit Courses page key,
  `courses-edit:<recruitmentId>`, with one client id (two heartbeats when the quarter has both),
  and the combined page and the edit pages warn each other about the same allocations. The banner
  and modal use the noun "quarter's allocations"; *Leave this page* goes to `/admin/budget/QXX`.
  The allocation, estimate, fill-estimates and Auto assign saves name the tab; the conversion
  factor save does not, since the page does not heartbeat `budget:<quarter>` (the factor is guarded
  by a version check of its own, the budget row's `conversionVersion`, #375, counted apart from the
  `version` of the three budget lines). Details in `ConcurrentEditMitigationDesign.md`, section (b).
- **Only when the quarter has both recruitments**: a table with no header row, *Cost per TA* and
  *Cost per ULA* (the estimated cost per TA entered on the Budget page, and the estimated cost per
  ULA the Budget page computes from the budget's ULA hourly rate and hours per quarter, #388) and
  *TA Cost/ULA Cost* (empty when the cost per ULA is zero or either is unknown); the editable
  **Nominal TA to ULA conversion factor** (the budget row's `conversionTAtoULA`, greater than
  zero, 3 until set, saved on change with its own version check, `conversionVersion`, #375); and an
  **ASE:Student Ratio**
  column, `1 : ( enrollmentEstimate / ( TA allocation + ULA allocation / conversionTAtoULA ) )`,
  the students per TA-equivalent, shown as "1:N" with a dash when the denominator is zero or there
  is no estimate.

### What left the Recruitment Courses pages (issue #358, part 3)

The TA/ULA Recruitment Courses pages (`/admin/recruitments/:id/courses` and its `/edit` form) are
not being phased out; they keep Populate, Add by enroll code, Remove / Unremove, Show removed
courses, the UCSB refresh and the last-refreshed line, the allocation visibility panel, Copy emails
of faculty with zero rankings, the Summer Session column, the multi-tab edit warning, the developer
buttons, and the totals footer for what remains (Total Course Count, Enrolled, Max); the view-only
page also keeps the read-only hiring target block and the pointer to the combined page. What left
them, because they are budget features that need to be seen for TAs and ULAs together:

- the columns **Enrollment Estimate, Allocation, Unrounded Allocation, Delta** and the
  **TA:student / ULA:student ratio** (`AllocationsRelatedColumns`), which both pages now pass to
  the table's `omitColumns` and which `adminColumnChoices` leaves out of the Columns menu;
- the controls **Set enrollment estimates from: max, actual** and **Auto assign allocations** (with
  its tooltip and confirmation modal), which only acted on those columns.

After the maintainer's review of part 3 (issue #358, items 19-28): the view-only page's Edit text
reads "Click Edit to: populate the course list, add a lecture by enroll code, remove a course, or
release allocations to faculty."; the edit page lost its explanatory paragraph about Populate, the
pointer sentence, the hiring-target block ("Total number of TAs expected to be hired", "Allocated so
far", "left to assign"; the target is entered on the Budget page) and the whole Publish Assignments
panel, which is now at the top of `/admin/recruitments/:id/assignments`, where the assignments are
made (the button until published, then "Assignments are published. Open the assignments page."; the
recruitment card's step 9 still opens the same modal); the zero-rankings message reads "None of the
rows with zero rankings have an email address available". The view-only page keeps its pointer
sentence linking to `/admin/allocations/QXX` for the recruitment's quarter and its read-only hiring
target. `RecruitmentCourseTable` kept the five
columns as read-only text for the faculty Courses page (issue #300: instructors see them while the
admin shows all courses' allocations to all faculty), and lost its own editing code for them (the
estimate and allocation boxes and the `requestHeaders` / `allocationBulkVersion` props); the shared
`useAllocationSaves` and `useEstimateSaves` hooks are used by the combined table only. The edit
page still heartbeats under `courses-edit:<recruitmentId>`, because the combined page heartbeats
under the same key and the two warn each other. The Budget page keeps its "TA/ULA Recruitment
Courses page" links (shown when the allocations do not add up to the target) and its "Combined
allocations" header link; the recruitment cards' "Courses" button is unchanged. In the Recruitment
Steps diagram (`RecruitmentStepsService`), step 3's "Allocations" title link and step 5's "(see
allocations)" link go to `/admin/allocations/QXX`, and steps 8 and 9's "(see assignments)" links went
to `/recruitments/:id/assignments` (they went to the Courses edit page and the view-only Courses
page before); issue #317 then replaced them with "Make Assignments" under step 8 (to
`/admin/recruitments/:id/assignments`) and "View Assignments" under step 9 (to
`/recruitments/:id/assignments`).

### The leftmost headings of the Recruitment Courses table (issue #386)

On both Recruitment Courses pages (and on the faculty Courses page, which uses the same
`RecruitmentCourseTable`), the ranking-count column's heading is **Faculty Rankings**, on two lines
("Faculty" over "Rankings") in the smaller heading font that the other stacked headings use (80%,
`stacked()` in `columnStyles.tsx`); the Columns menu and its "hide" link still call the column
"Rankings". The **Course Number** heading is stacked the same way ("Course" over "Number"), as on
the Combined Allocation page, and the column is about a fifth narrower than it was. Its width is set
by the widest thing in it, which was its one-line totals footer, "Total Course Count: n", not the
heading or any course number; so that footer is now stacked too ("Total Course Count:" over the
number, in the same 80% font), and the cell holds the course number in an inline block exactly
`COURSE_NUMBER_WIDTH` (`13ch`, monospaced) wide, the width of the widest UCSB course number, the same
cell as the Combined Allocation table's. The course numbers themselves keep their full size.

### The title and the text of the Recruitment Courses pages (issue #320)

Both pages' title is `{QXX} {TA|ULA} Courses` for the recruitment's quarter and type ("W26 TA
Courses"); it is the generic "Recruitment Courses" only while the recruitment list is loading or
for an id no recruitment has. The view-only page's description is exactly "These are the courses
for which the department plans to hire TAs." (ULAs for a ULA recruitment; "TAs/ULAs" while the
recruitment is unknown), followed by "If courses do not appear, please go to the Courses page and
click *Populate*.", in which **Courses** links to the admin Courses page, `/admin/courses`, whose
Populate button fills the course table that a recruitment's lectures are drawn from (the paragraph
the issue quotes, "The courses in this recruitment: every lecture of a course flagged for its type
…", had already been removed by issue #358). The pointer to the Combined Allocation page follows,
then the read-only hiring target: `HiringTargetPanel` renders its three figures as a small
two-column table (`table-sm`, borderless, `w-auto`, no header row, nothing sortable), the labels
"Total number of TAs expected to be hired:", "Allocated so far:" and "TA allocations left to
assign:" in the left column and the numbers right-aligned in the right one; the over-allocation
warning stays under the table. The panel's editable form, which no page has used since #358, lays
out the same way with the box in the right column. The edit page still has no description, hint,
pointer or hiring target.

## The new recruitment card layout

The card becomes much wider to hold the diagram. From top to bottom:

1. **Header**: quarter, type and the status badges, as today. Since issue #379 the card is nested
   inside its quarter's card and the header is the card's toggle row: the caret, the type (TA or
   ULA) in the large font, the status badges and the application count in one `aria-expanded`
   button, the trash icon beside it; the quarter is dropped (see "The quarter card" above).
2. **Dates panel**: as today, including the **Change** button beside the Faculty Ranking
   Deadline.
3. **The live Recruitment Steps diagram** for this recruitment, in a collapsible panel whose
   collapsed form is a one-line summary such as "Step 6 of 9: Open Faculty Ranking". The most
   recent TA recruitment and the most recent ULA recruitment are expanded by default; every
   other recruitment's panel starts collapsed.
4. **A compressed set of buttons**: **Courses**, **Draft Applications** (added by issue #296; see
   `DraftApplicationsDesign.md`), **Applications** (renamed from "Review
   Applications"), and since issue #317 **Make Assignments** (→ `/admin/recruitments/:id/assignments`,
   the page where candidates are assigned to slots) and **View Assignments** (→
   `/recruitments/:id/assignments`, the read-only page; shown whether or not the assignments are
   published, and the page says so until they are). Issue #390 adds a right-aligned **Change
   History** button after them (`ms-auto`, so it sits at the right edge of the row, apart from the
   workflow buttons, and after Download Rankings CSV when that is shown); it opens the
   recruitment's own Change History page, `/admin/recruitments/:id/history` (admin only): the
   recruitment's row, the intro sentence (with "Audit Trail page" linking to `/admin/audittrail`),
   the page-size control, Previous and Next, "n changes recorded." and the
   `RecruitmentAuditTrailTable`, newest first, paged on the server by
   `GET /api/admin/recruitmentaudittrail/all`. Until #390 the same content was a collapsible
   **Change History** card at the bottom of the Applications page (issues #139, #255, #337), which
   nothing pointed to; that card is gone and the Applications page is otherwise unchanged. Everything
   else the card offered moves:
   - **Test Application** moves to the Applications page.
   - **Download CSV** moves to near the top of the Applications page and is renamed
     **Download Applications as CSV**.
   - **Download Rankings CSV** moves to the Courses page (issue #234); since issue #358 it is back on
     the card, as the last button of the footer, shown only once faculty reviews have been opened
     (and no longer on the Courses page, which stays but without the budget columns; see above).
   - The lifecycle buttons (Open/Close Applications, Open/Close Faculty Reviews, Publish
     Assignments) are reached through the diagram's links; their confirmation modals are
     unchanged.
   - **Assignments** and **Published Assignments** are reached through steps 8 and 9 (and, since
     issue #317, through the **Make Assignments** and **View Assignments** buttons as well).

## Increments

1. **Design the components in Storybook only**: the diagram component (static and live modes),
   the new card layout, the compressed button set, the Applications page header with the moved
   buttons; fixtures for every state. Nothing in the running app changes.
2. **Backend**: the four stored dates and the steps endpoint.
3. **The help page** (Recruitment Steps) using the static diagram.
4. **Wire the live diagram into the admin card**, with the modals reachable from it, the card
   widened, dates panel kept.
5. **Move the buttons**: Applications page gets Test Application and Download Applications as
   CSV; Courses page gets Download Rankings CSV; the card keeps Courses and Applications.
