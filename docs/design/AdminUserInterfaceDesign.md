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
| 8 | `Still to assign: n` while tentative assignments < target; `Assignment complete` otherwise | assignments ≥ target | the Assignments page; and a separate link **(see assignments)** → the recruitment's assignments page, `/recruitments/:id/assignments` (issue #358; it was the Courses page), the same as under step 9 |
| 9 | `Released: {date hiring decisions released}` or `Not released yet`, followed by the reopening note below when it applies | assignments published | before publishing, the Release Assignments (publish) modal; after publishing, the published Assignments page; and a separate link **(see assignments)** → the recruitment's assignments page (issue #358) |

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

The hiring target keeps its default of 1 (it is a divisor in the budget and ratio figures, so it is
never null); the diagram therefore always shows `Hiring Target: n`.

The dates for steps 1, 5, 7 and 9 are not stored today; the backend will store them (created
at, allocations released at = the first time visibility left "admins only", faculty review
closed at, assignments published at) and stamp them
from the existing endpoints. The backend computes the labels, done flags and link targets in one
endpoint so the frontend only draws.

## The QXX Budget card (issue #357)

Above each quarter's recruitment card, or pair of cards when the quarter has both a TA and a ULA
recruitment, the admin home page shows a lighter **QXX Budget** card (QXX from `yyyyqToQyy`, such
as "W26 Budget") with two buttons since issue #358 (part 3): **Budget Planning**
(`/admin/budget/QXX`; it was labelled **Budget**) and one allocation button to the quarter's
Combined Allocation page, `/admin/allocations/QXX`, labelled by the recruitments the quarter has:
**Allocate TA slots to Courses**, **Allocate ULA slots to Courses** or **Allocate TA and ULA slots
to Courses** (before part 3 there were two buttons, **TA allocations** and **ULA allocations**, to
`/admin/recruitments/:id/courses/edit` of that quarter's TA or ULA recruitment, each greyed out
when the quarter had no recruitment of that type; the single button is greyed out only when the
quarter has neither, which the home page never shows). The cards are grouped by
quarter, in the order each quarter first appears in the sorted list, so the budget card moves with
its quarter; sorting by anything other than Quarter therefore keeps a quarter's cards together
instead of interleaving them.

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
  they agreed. The frontend still does both, harmlessly, until a follow-up removes it.) All the
  ratios on the page use this one value.
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
  stacked heading ("Course" over "Number") and a cell 13 characters wide (`13ch`, monospaced), the
  width of the widest UCSB course number, `XXXXXXX 999XX`.
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
  and Allocations* and *Create Fake Rankings* buttons for the whole quarter. The first opens one
  modal with a hiring target box per recruitment that has a course (*TA hiring target*, *ULA hiring
  target*; one estimate source and one visibility choice for both) and sends one
  `POST /api/admin/developer/fakeAllocations` per recruitment in one click; it is disabled when no
  recruitment has a course. The second launches one `POST /api/admin/developer/fakeRankings` job
  per recruitment whose faculty review is Open and which has a course; when only one of the two
  qualifies the modal says which one and that the other is left alone, and the button is disabled
  while neither qualifies. The modals (`FakeAllocationsModal`, `FakeRankingsModal`) take a list of
  recruitments; the Edit Courses page passes its one.
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
  *Cost per ULA* (each recruitment's average cost per position, entered on the Budget page) and
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
allocations)" link go to `/admin/allocations/QXX`, and steps 8 and 9's "(see assignments)" links go
to `/recruitments/:id/assignments` (they went to the Courses edit page and the view-only Courses
page before).

## The new recruitment card layout

The card becomes much wider to hold the diagram. From top to bottom:

1. **Header**: quarter, type and the status badges, as today.
2. **Dates panel**: as today, including the **Change** button beside the Faculty Ranking
   Deadline.
3. **The live Recruitment Steps diagram** for this recruitment, in a collapsible panel whose
   collapsed form is a one-line summary such as "Step 6 of 9: Open Faculty Ranking". The most
   recent TA recruitment and the most recent ULA recruitment are expanded by default; every
   other recruitment's panel starts collapsed.
4. **A compressed set of buttons**: **Courses**, **Draft Applications** (added by issue #296; see
   `DraftApplicationsDesign.md`) and **Applications** (renamed from "Review
   Applications"). Everything else the card offered moves:
   - **Test Application** moves to the Applications page.
   - **Download CSV** moves to near the top of the Applications page and is renamed
     **Download Applications as CSV**.
   - **Download Rankings CSV** moves to the Courses page (issue #234); since issue #358 it is back on
     the card, as the last button of the footer, shown only once faculty reviews have been opened
     (and no longer on the Courses page, which stays but without the budget columns; see above).
   - The lifecycle buttons (Open/Close Applications, Open/Close Faculty Reviews, Publish
     Assignments) are reached through the diagram's links; their confirmation modals are
     unchanged.
   - **Assignments** and **Published Assignments** are reached through steps 8 and 9.

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
