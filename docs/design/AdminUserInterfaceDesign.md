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
| 3 | Close TA (or ULA) Applications | 2 | |
| 4 | Budget / Allocations | 1 | |
| 5 | Release Allocations to Faculty * | 4 | |
| 6 | Open Faculty Ranking | | 3, 5 |
| 7 | Close Faculty Ranking | 6 | |
| 8 | Assign Candidates to Slots | 6 | 7 |
| 9 | Release Hiring Decisions | 3, 8 | |

\* By default, step 5 releases only the allocations for the courses each faculty member
teaches. It is also possible to release all allocations for all courses; that is a separate
option on the Courses page.

### The diagram

The steps are drawn left to right in two rows: steps 2, 3 and 7 on the top row, steps 4, 5,
6, 8 and 9 on the bottom row, and step 1 at the left between the rows. Boxes are rectangles
with rounded corners sized to their text, labels broken over up to three lines with a hanging
indent so the step numbers stick out, in Arial Narrow (Liberation Sans Narrow and Arial as
fallbacks) at 13px. Hard prerequisites are solid arrows, soft ones dashed; a legend explains
both, and the footnote for step 5 sits under the legend. Step 7 is centred above the gap between
6 and 8. The diagram is 835 × 392 units and scales to its container.

There are two versions, TA and ULA, differing only in the words TA/ULA in steps 1, 2 and 3.

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
| 1 | `Created: {date the recruitment was created}` | always | none |
| 2 | `Opened: {actualOpeningDate}` once opened; before that `Tentative: {tentativeOpeningDate}` | actualOpeningDate is set | the Open Applications modal |
| 3 | `Closed: {actualClosingDate}` once closed; before that `Prim. Consid: {primaryConsiderationDate}` | actualClosingDate is set and applications are closed | the Close Applications modal |
| 4 | `Hiring Target: {n}`, or `Not Set Yet` when no target has been set | target set and allocations add up to it | the word **Budget** → the Budget for Quarter page for the recruitment's quarter; the word **Allocations** → the Recruitment Courses page |
| 5 | `Released: {date}` or `Not released yet` | released (all courses, or the all-courses switch) | the Release Allocations modal |
| 6 | `Opened: {date faculty rankings opened}` or `Not opened yet` | faculty review opening date set | the Open Faculty Rankings modal |
| 7 | `Closed: {date faculty rankings closed}`; before that `Deadline: {facultyRankingDeadline}` if a deadline is set, else `Not closed yet` | reviews closed after having been open | the Close Faculty Rankings modal; and a separate link **(see rankings)** → the Courses page |
| 8 | `No hiring target` if unset; `Still to assign: n` while assignments < target; `Assignment complete` otherwise | assignments ≥ target | the Assignments page |
| 9 | `Released: {date hiring decisions released}` or `Not released yet` | assignments published | the Release Assignments (publish) modal; and a separate link **(see assignments)** → the Courses page |

The dates for steps 1, 5, 7 and 9 are not stored today; the backend will store them (created
at, allocations released at, faculty review closed at, assignments published at) and stamp them
from the existing endpoints. The backend computes the labels, done flags and link targets in one
endpoint so the frontend only draws.

## The new recruitment card layout

The card becomes much wider to hold the diagram. From top to bottom:

1. **Header**: quarter, type and the status badges, as today.
2. **Dates panel**: as today, including the **Change** button beside the Faculty Ranking
   Deadline.
3. **The live Recruitment Steps diagram** for this recruitment.
4. **A compressed set of buttons**: **Courses** and **Applications** (renamed from "Review
   Applications"). Everything else the card offered moves:
   - **Test Application** moves to the Applications page.
   - **Download CSV** moves to near the top of the Applications page and is renamed
     **Download Applications as CSV**.
   - **Download Rankings CSV** moves to the Courses page.
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
