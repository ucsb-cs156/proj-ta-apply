import { Link } from "react-router";
import { Table } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { ADMIN_MENU_ENTRIES } from "main/utils/helpPages";
import useScrollToHash from "main/utils/useScrollToHash";
import MultipleTabsBanner from "main/concurrency/MultipleTabsBanner";

/** The warning as it looks when someone else is editing the same thing. */
// Stryker disable next-line StringLiteral : the example name is fixed and is checked by the tests
const EXAMPLE_OTHERS = [
  { label: "phtcon@ucsb.edu (Phill Conrad)", samePerson: false },
];

/**
 * The admin's handbook: /help/admins (issue #140). A table of every option on the Admin menu and
 * the home page, each linking to the section below that says what the page does and where it
 * fits in the flow of a recruitment. The Developer menu and Developer Mode have their own page,
 * /help/developer (issue #266).
 */
export default function HelpAdminsPage(): React.JSX.Element {
  // The table's links point at a section (#courses); scroll to it on arrival.
  useScrollToHash();

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpAdminsPage">
        <h1 className="my-4">For Admins</h1>
        <p>
          Faculty reviews are managed separately from application opening and
          closing. Choose <strong>Open Faculty Reviews</strong> to enter the
          required ranking deadline; the first review opening date is retained
          if reviews are reopened. Use <strong>Change</strong> beside the
          deadline to edit it. Closing reviews does not erase either date, and
          changes appear in the recruitment change history.
        </p>

        <h2 className="my-3 h4" id="rankings-csv">
          Download Rankings CSV
        </h2>
        <p>
          On a recruitment&apos;s Courses page,{" "}
          <strong>Download Rankings CSV</strong> saves that recruitment&apos;s
          faculty rankings as a spreadsheet-ready file. This is separate from{" "}
          <strong>Download Applications as CSV</strong> on its Applications
          page, which exports application answers. Rankings include every real
          applicant, even those with no interests or rankings; test applications
          are excluded. Unset rankings are blank, not zero, and ties are
          preserved.
        </p>
        <p>
          TA columns are first name, last name, email, major, class level, year
          in program and expected graduation. ULA columns are first name, last
          name, email, major, year in program, expected graduation, GPA in
          major, overall GPA and quarters of previous ULA service; an applicant
          who ticked the first quarter box has no GPAs, and both columns read
          &ldquo;First quarter&rdquo;. No video links or admin comments are
          exported. Course columns follow in course ID and section order, each
          headed by the bare course number (16, 5A); the section is added only
          when the recruitment has more than one section of that course (16
          (section 0100), 16 (section 0200)), so independent faculty rankings
          stay distinct. Removed, stale and cancelled sections remain in this
          historical export so saved rankings are not lost when offerings
          change.
        </p>
        <p data-testid="HelpAdminsPage-rankings-csv-planning">
          The file also carries the planning from the Assignments page: a{" "}
          <code>tentativeAssignment</code> column after the identity columns
          (the lecture each applicant is pencilled into, blank if none), and
          three rows directly under the header, labelled{" "}
          <strong>Allocation</strong>, <strong>Assigned</strong> and{" "}
          <strong>Left to assign</strong> in the first column, with the numbers
          under each lecture&apos;s column.
        </p>

        <h2 className="my-3 h4" id="assignments">
          Assignments
        </h2>
        <p data-testid="HelpAdminsPage-assignments">
          <strong>Assignments</strong> on a recruitment card opens a table with
          the same fields as the rankings CSV: who each applicant is, a{" "}
          <strong>Tentative Assignment</strong> dropdown, then one column per
          lecture holding that lecture&apos;s faculty ranking of the applicant.
          Test applications and applications the student cancelled are left out.
          Every column sorts. Sorting by a lecture uses the same order as the
          faculty ranking page: the ranked applicants first, from rank 1 down,
          then the unranked ones by the student&apos;s preference (1st choice,
          2nd choice, Enthusiastic, Would Consider, then Not Interested/Not
          Applicable); applicants who tie stay in the order they applied.
          Clicking the heading again reverses that order. Each lecture column is
          ordered by that lecture&apos;s own rank and preference, so an
          applicant ranked for one lecture but not another is placed separately
          in each. Under each lecture&apos;s name the heading shows its{" "}
          <strong>Allocation</strong>, how many applicants are{" "}
          <strong>Assigned</strong> to it so far, and how many places are{" "}
          <strong>Left</strong>, in red when more have been assigned than
          allocated; those numbers stay put when you sort.
        </p>
        <p data-testid="HelpAdminsPage-assignment-columns">
          The <strong>Columns</strong> menu above the table hides and shows
          columns while you work: any of the applicant&apos;s fields or any
          lecture (<em>Show All</em> and <em>Show None</em> do them all at once;{" "}
          <em>Show All Courses</em> shows every lecture column, and{" "}
          <em>Show Only Incomplete Courses</em> hides every lecture column
          except those with fewer TAs/ULAs assigned so far than the allocation,
          the hiring target, so a lecture exactly at its target is hidden). Each
          of those columns also has a small <strong>hide</strong> link at the
          top right of its heading, for dropping a column you do not need with
          one click while you assign; tick it in the menu to bring it back.{" "}
          <strong>Tentative Assignment</strong> is always shown, and is wide
          enough for a full lecture name. The choice is kept for that
          recruitment, the same way as on the Courses and Applications pages.
        </p>
        <p data-testid="HelpAdminsPage-interest-cells">
          Each lecture&apos;s ranking cell is right-aligned and coloured by the
          applicant&apos;s own interest in that lecture: light green for a first
          or second choice (marked ➊ or ➋) or <em>Enthusiastic</em> (✓), pale
          yellow for <em>Would Consider</em> (▬) and pale red for{" "}
          <em>Not Interested/Not Applicable</em> (✖); the legend above the table
          repeats this. Faculty see the same colours on their ranking page,
          where candidates who marked a course Not Interested are listed only if
          the instructor asks for them. Applications the student cancelled are
          not rows here and cannot be assigned; the{" "}
          <strong>Cancelled applications</strong> table at the bottom of the
          page lists them with their reason.
        </p>
        <p data-testid="HelpAdminsPage-tentative-assignment">
          Choosing a lecture in the dropdown (or the blank entry to clear it)
          saves at once and updates the counts. A tentative assignment is
          planning only: it is not shown to applicants or to faculty at this
          stage, and it is not written to the Audit Trail. A lecture removed
          from the recruitment stays in the table while it still has rankings or
          an assignee, marked as no longer offered.
        </p>
        <p
          id="publish-assignments"
          data-testid="HelpAdminsPage-publish-assignments"
        >
          When the tentative assignments are close to final, the very bottom of
          the recruitment&apos;s <strong>Courses</strong> page has{" "}
          <strong>Publish Assignments</strong>. It asks you to confirm:
          publishing creates a read-only <strong>Assignments</strong> page for
          admins and faculty, with every course and the TAs (or ULAs) assigned
          to each, and unlocks CSV downloads of the same table to hand to the
          financial office for hiring paperwork. Assignments can still be
          changed afterwards, and the page always shows the current ones, but it
          is best to wait until most are settled. Once published, the
          recruitment card shows an <strong>Assignments Published</strong> badge
          and a <strong>Published Assignments</strong> button (instructors see
          an <strong>Assignments</strong> button on their card), and publishing
          is written to the recruitment&apos;s change history. The page offers{" "}
          <em>One Row per course</em> (course number, instructor, instructor
          email, then one column per assigned TA or ULA as &ldquo;First Last
          (email)&rdquo;) or <em>One Row per TA/ULA</em> (name, email, course,
          instructor, instructor email and, for ULAs, whether this is their
          first time as a ULA), with <em>Download CSV (row per course)</em> and{" "}
          <em>Download CSV (row per student)</em>. Only real, uncancelled
          applicants with an assignment appear; an instructor whose catalog name
          is not mapped on the Instructors page shows as &ldquo;Not
          mapped&rdquo;.
        </p>
        <p
          id="release-hiring-decisions"
          data-testid="HelpAdminsPage-release-hiring-decisions"
        >
          Releasing hiring decisions has three prerequisites, checked in this
          order: <strong>faculty ranking is closed</strong>,{" "}
          <strong>applications are closed</strong>, and{" "}
          <strong>at least one candidate is assigned</strong> to a course. If
          one is not met, the Publish Assignments box names it, for example
          &ldquo;Close Faculty Ranking before releasing hiring
          decisions.&rdquo;, and nothing is published; the Yes button is greyed
          out when the card already shows that ranking or applications are open.
          Taking published assignments back is never refused. Applications and
          faculty ranking can be reopened after hiring decisions are released.
          Nothing is blocked and the published page keeps showing the current
          assignments, but while either is open again, step 9 of the card&apos;s
          diagram and the published Assignments page say{" "}
          <em>Tentative; part of the hiring process has been reopened</em>. When
          both are closed again the note goes away. Nothing is ever marked
          final, since reopening is always possible.
        </p>

        <h2 className="my-3 h4" id="flow">
          The flow of a recruitment
        </h2>
        <p data-testid="HelpAdminsPage-steps-link">
          The order the steps happen in, and which ones must come first, is
          drawn on the{" "}
          <Link to="/help/recruitment-steps">Recruitment Steps</Link> page.
        </p>
        <p>
          Everything on the Admin menu, and the Recruitments section of your
          home page, serves one cycle, repeated each quarter for TAs and again
          for ULAs:
        </p>
        <ol data-testid="HelpAdminsPage-flow">
          <li>
            <strong>Set up once:</strong> add the other admins and the
            instructors, fill the <strong>Courses</strong> table from the UCSB
            catalog and tick which courses recruit TAs and which ULAs, and fill
            the lists and notices under <strong>TA App Settings</strong> and{" "}
            <strong>ULA App Settings</strong>.
          </li>
          <li>
            <strong>Each quarter:</strong> under <strong>Recruitments</strong>{" "}
            on your home page, create a recruitment for the quarter and type.
            Its course list is filled automatically from the quarter&apos;s
            schedule; check it with <em>Courses</em>, try the form with{" "}
            <em>Test Application</em> (on the Applications page), then open
            applications from step 2 of the diagram.
          </li>
          <li>
            <strong>While open:</strong> applicants apply and edit until the
            primary consideration date. The <em>Applications</em> page and its{" "}
            <em>Download Applications as CSV</em> show what has come in; a
            student&apos;s answers can be corrected on their behalf, with every
            change recorded in the <strong>Audit Trail</strong>.
          </li>
          <li>
            <strong>Afterwards:</strong> <em>Close Applications</em>, plan the
            hiring on the <strong>Courses</strong> and{" "}
            <strong>Budget for Quarter</strong> pages, release each
            lecture&apos;s allocation to its instructor, then{" "}
            <em>Open Faculty Reviews</em>. The recruitment and its applications
            stay on file; past recruitments tell applicants when the last round
            ran.
          </li>
        </ol>

        <h2 className="my-3 h4" id="menu">
          The Admin menu and the home page
        </h2>
        <p data-testid="HelpAdminsPage-developer-help">
          The Developer menu and Developer Mode are described on their own page,{" "}
          <Link to="/help/developer">For Developers</Link>.
        </p>
        <Table striped bordered size="sm" data-testid="HelpAdminsPage-menu">
          <thead>
            <tr>
              <th>Menu</th>
              <th>Option</th>
              <th>What it is for</th>
            </tr>
          </thead>
          <tbody>
            {ADMIN_MENU_ENTRIES.map((entry) => (
              <tr
                key={entry.path}
                data-testid={`HelpAdminsPage-menu-${entry.section}`}
              >
                <td>{entry.menu}</td>
                <td>
                  <a href={`#${entry.section}`}>{entry.label}</a>
                </td>
                <td>{entry.summary}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <h2 className="my-3 h4" id="users">
          Users
        </h2>
        <p>
          <Link to="/admin/users">Users</Link> lists everyone who has ever
          signed in to the app: first and last name, email, when they were last
          online, and whether they are an admin or an instructor. It is paged,
          with the page size chosen above the table. The page is a roster, not
          where roles are granted: make someone an admin on the Admins page or
          an instructor on the Instructors page. A student needs no entry
          anywhere; any signed-in user may apply.
        </p>

        <h2 className="my-3 h4" id="admins">
          Admins
        </h2>
        <p>
          <Link to="/admin/admins">Admins</Link> lists the emails that get the
          Admin and Developer menus. <em>Add New Admin</em> takes an email; the
          first and last name fill in when that person first signs in. Each row
          has a Delete button, except that the initial admins set in the
          server&apos;s <code>ADMIN_EMAILS</code> configuration cannot be
          removed through the app, so there is always a way back in.
        </p>

        <h2 className="my-3 h4" id="instructors">
          Instructors
        </h2>
        <p>
          <Link to="/admin/instructors">Instructors</Link> lists who gets the
          Instructor section of the home page. Add one with{" "}
          <em>Add New Instructor</em>, or many at once by uploading a CSV of
          emails (the format is on the{" "}
          <Link to="/help/csv">CSV Upload/Download Formats</Link> page);{" "}
          <em>Download Instructors (CSV)</em> saves the whole list in a shape
          the upload accepts, so it can be moved from one deployment to another.
          Each row also has a <strong>Catalog Name</strong>: the spelling the
          course schedule uses for that instructor, for example &ldquo;CONRAD
          P&rdquo;, chosen from the names the course-population jobs have seen.
          Set it so the instructor&apos;s courses can be matched to them; until
          it is set, their Instructor section says no recruitment includes a
          course they teach.
        </p>

        <h2 className="my-3 h4" id="courses">
          Courses
        </h2>
        <p>
          <Link to="/admin/courses">Courses</Link> is the table of courses in
          the configured subject area (CMPSC) that have been offered in some
          range of quarters. Choose a start quarter, an end quarter and a level
          and click <em>Populate</em>; a background job asks the UCSB curriculum
          API for every course offered in that range and adds any it has not
          seen. Re-running never removes a course or clears a flag.
        </p>
        <p>
          The <strong>TA</strong> and <strong>ULA</strong> boxes on each row are
          the point of the page: a recruitment of a given type includes only the
          lectures of courses with that box ticked. The same list also feeds the
          menu applicants use to add UCSB courses they have taken, so graduate
          courses belong in it too even though they rarely get TAs or ULAs.
        </p>
        <p>
          On a recruitment&apos;s own <strong>Courses</strong> page, after
          faculty reviews have started, the leftmost <strong>Rankings</strong>{" "}
          column shows how many eligible applications have an entered ranking
          for each section. The number links to the ranking page, read-only for
          you unless you are that course&apos;s instructor of record; sections
          with no entered rankings link with a zero. The <strong>Email</strong>{" "}
          column uses the instructor&apos;s catalog-name mapping from the
          Instructors page. Use its <em>Copy</em> control for one address, or{" "}
          <em>Copy emails of faculty with zero rankings</em> to prepare a
          reminder. Bulk reminders include only mapped addresses for the courses
          currently visible, deduplicated when an instructor has multiple
          sections. Turn on <em>Show removed courses</em> to include removed
          sections in both the table and reminder list.
        </p>
        <p id="course-columns" data-testid="HelpAdminsPage-course-columns">
          The table can be trimmed to what you need: the{" "}
          <strong>Columns</strong> menu above it lists every column but the
          course number, and unticking one hides it, heading, cells and totals
          alike, until you tick it again. <em>Show All</em> and{" "}
          <em>Show None</em> at the top of the menu show or hide every column at
          once. Each of those columns also has a small <strong>hide</strong>{" "}
          link at the top right of its heading: one click hides that column
          without opening the menu, exactly as unticking it there does. A
          recruitment&apos;s table starts with only the Course Number,
          Instructor, Enrolled, Max, Enrollment Estimate, Allocation, Unrounded
          Allocation, Delta and TA:student ratio columns shown, on the view-only
          page and the edit page alike; tick the others (Section, Title, Email,
          Days, Time, Room, Status, and the Remove / Unremove button) in the
          Columns menu when you need them. Your choice is kept in this browser,
          for that recruitment and for both pages, so it is the same on your
          next visit from the same browser; it is not shared with other admins
          or other browsers. The <strong>Summer Session</strong> column appears
          only for a summer quarter. Headings are centred, numbers are
          right-aligned, and sorting by course number follows the padded course
          id exactly as it is shown, so CMPSC 5A comes before CMPSC 130A. In the{" "}
          <strong>Email</strong> column, the copy icon copies one address and{" "}
          <em>Not mapped</em> opens the Instructors page in a new tab, where the
          catalog name can be given an email.
        </p>
        <p id="hiring-target" data-testid="HelpAdminsPage-hiring-target">
          The top of that page is where the hiring is planned. Enter the{" "}
          <strong>total number of TAs (or ULAs) expected to be hired</strong>;
          it is saved as you type, must be at least 1, and an entry that is not
          a whole number is dropped when you leave the box. Then give each
          lecture its share in the <strong>Allocation</strong> column, saved the
          same way. Under the total, the page keeps a running count of how many
          positions are allocated so far and how many are left to assign, and
          warns when the allocations add up to more than the target. Removed
          lectures keep their number but do not count. These are planning
          figures: changes to them are not recorded in the change history.
        </p>
        <p
          id="enrollment-estimates"
          data-testid="HelpAdminsPage-enrollment-estimates"
        >
          Opening the page also refreshes every lecture&apos;s enrollment and
          maximum enrollment from the UCSB schedule while you wait, so the
          figures you plan from are current; if the schedule cannot be reached,
          the page says so and shows the stored figures. The{" "}
          <strong>Enrollment Estimate</strong> column is your own estimate of
          how many students each lecture will have, the basis for allocating
          positions. It is saved a second after you stop typing, or at once when
          you leave the box; an empty box means no estimate. To start from the
          schedule&apos;s figures, use{" "}
          <em>Set enrollment estimates from: max</em> or <em>actual</em>, which
          fills every lecture&apos;s estimate from its maximum or current
          enrollment in one step.
        </p>
        <p id="auto-assign" data-testid="HelpAdminsPage-auto-assign">
          The table ends with a totals row, and three columns guide the
          allocation: <strong>Unrounded Allocation</strong> is how many
          positions each lecture would get if positions could be split into
          fractions and were shared out by enrollment estimate alone;{" "}
          <strong>Delta</strong> is that share minus the allocation, green with
          a plus sign when a lecture is owed positions and red when it has more
          than its share; and the <strong>TA:student ratio</strong> is the
          estimated students per position. <em>Auto assign TA allocations</em>{" "}
          (or ULA) fills the Allocation column from those shares, after a
          warning that it overwrites every allocation. When there are at least
          as many positions as lectures, every lecture gets at least one, and
          the rest are given out one at a time to the lecture furthest under its
          share, so that the biggest gap between any lecture&apos;s allocation
          and its share is as small as it can be. When there are fewer positions
          than lectures, each lecture gets its share rounded, then positions are
          taken from the lectures furthest over their share, or given to those
          furthest under it, one at a time until the total is exactly the hiring
          target. The purpose of this feature is to give admins a way to make a
          first-cut allocation based on enrollment, as close to fair as the
          numbers allow; it should not necessarily be considered the final
          allocation. Admins have the flexibility to adjust it up or down based
          on the particular needs of specific courses and other relevant
          factors.
        </p>
        <p
          id="allocation-visibility"
          data-testid="HelpAdminsPage-allocation-visibility"
        >
          Who may see the allocations is one setting for the recruitment, shown
          under the hiring target as <em>Allocation visibility</em>; choose{" "}
          <strong>Change</strong> to pick one of three states.{" "}
          <strong>Admins only</strong> is where every recruitment starts: no
          faculty member sees any allocation.{" "}
          <strong>Faculty see their own courses</strong> is what{" "}
          <em>Release Allocations to Faculty</em> means: each faculty member
          sees the allocations for the courses they teach, as a small table on
          their home page card and at the top of each ranking page: the{" "}
          <strong>Hiring Target</strong> (the allocation), the{" "}
          <strong>Ranking Target</strong> (twice the allocation, but never more
          than the candidates who expressed interest in the course),{" "}
          <strong>Candidates Ranked</strong> so far and{" "}
          <strong>Rankings Still Needed</strong>.{" "}
          <strong>Faculty see all courses</strong> goes further, for when the
          whole plan is public: every faculty member teaching in the recruitment
          sees the enrollment estimate, allocation, unrounded allocation, delta
          and TA:student ratio columns of every course on the read-only{" "}
          <em>Courses</em> page that each of their courses offers. Under the
          other two settings that page shows faculty no such columns at all: the
          figures are not even sent to their browser. Move off Admins only once
          the numbers are mostly final; you can still change an allocation
          afterwards, and faculty see the change immediately. Every change of
          state is recorded in the recruitment&apos;s change history. Do this
          before opening faculty reviews, so faculty know how many candidates to
          rank, and ask them to raise any concerns about their targets then.
        </p>

        <h2 className="my-3 h4" id="quarters">
          Quarters
        </h2>
        <p>
          <Link to="/admin/quarters">Quarters</Link> is the UCSB quarter
          calendar as this app has it: one card per quarter with its names, its
          academic year and every date the UCSB API gives for it (first and last
          days of classes and finals, the registration passes, the fee deadline,
          the add deadlines). It is read-only. Opening the page asks UCSB for
          any quarter newer than the latest on file, through the current quarter
          plus one (plus two during Spring, so Summer and Fall are both there),
          and populating the Courses page saves the quarters of its range as
          well. The cards can be sorted newest or oldest first. These dates are
          kept so that a later feature can offer them as fields in the notices
          text, such as the first day of the recruitment&apos;s quarter.
        </p>

        <h2 className="my-3 h4" id="budget">
          Budget for Quarter
        </h2>
        <p>
          <Link to="/admin/budget/selectQuarter">Budget for Quarter</Link> lists
          every quarter that has a recruitment, newest first, with an x under{" "}
          <strong>TA</strong> and under <strong>ULA</strong> for the
          recruitments it has; the quarter links to its budget page. That page
          is where the hiring for the quarter is planned holistically, against
          the money available. Enter the estimated average cost of one TA and of
          one ULA, and the three budget lines; every box is saved as you type,
          and an entry that is not an amount in dollars and cents is dropped
          when you leave it. The hiring targets of both recruitments can be
          changed here too, beside what has been allocated to courses so far;
          when the two do not agree, the page says so and links to the
          Recruitment Courses page, where the allocations are adjusted. The
          enrollment totals and ratios are over each recruitment&apos;s own
          courses, which may differ between TAs and ULAs.
        </p>
        <p id="budget-lines" data-testid="HelpAdminsPage-budget-lines">
          The three budget lines are the <strong>unrestricted</strong> budget,
          which may be spent on either TAs or ULAs, and the additional{" "}
          <strong>TAs only</strong> and <strong>ULAs only</strong> budgets,
          which may be spent only on positions of that type. Any of the three
          may include subzero money, gift money or both, and any of them may be
          zero in a given quarter. For planning, the restricted money is spent
          first: the cost of the TAs is paid from the TAs-only line, the cost of
          the ULAs from the ULAs-only line, and whatever is left of either cost
          comes from the unrestricted pool. The <strong>Budget</strong> section
          works this out: the anticipated cost of each type is its hiring target
          times its average cost, the funds are the three lines added, and the
          bottom line is funds minus expenses, shown green with a plus sign when
          there is money to spare, red with a minus sign when the plan is over
          budget, and black when it comes out even. All of these are planning
          figures, shown in dollars and cents and not recorded in the change
          history.
        </p>

        <h2 className="my-3 h4" id="recruitments">
          Recruitments
        </h2>
        <p>
          <strong>Recruitments</strong>, on <Link to="/">your home page</Link>,
          is where each hiring round is run (issue #141 moved it there from the
          Admin menu). <em>Create New Recruitment</em> asks for a quarter, a
          type (TA or ULA), a tentative opening date and a primary consideration
          date; only one recruitment of each type may exist per quarter.
          Creating one launches the job that fills its course list, so the list
          is there without a second step. Each recruitment is a card, newest
          quarter first, showing its status, dates and how many applications it
          has. Under the dates is the live{" "}
          <Link to="/help/recruitment-steps">Recruitment Steps</Link> diagram
          (collapsed to a one-line summary on older cards, expanded on the
          latest TA and ULA recruitments). Its boxes carry the lifecycle
          actions, and the card has Courses, Draft Applications and Applications
          buttons:
        </p>
        <ul data-testid="HelpAdminsPage-recruitment-buttons">
          <li
            id="open-close-applications"
            data-testid="HelpAdminsPage-open-close-applications"
          >
            <strong>Open Applications / Close Applications.</strong>{" "}
            Recruitments do not open or close by themselves on the tentative
            dates; an admin clicks. The first open stamps the actual opening
            date and never overwrites it; each close stamps the actual closing
            date. Applicants may apply only while the status is Open, and may
            edit only until the primary consideration date. Closing keeps every
            application on file, and a closed recruitment can be opened again.
            Each button first asks <em>Are you sure?</em> with a short account
            of what will happen, so a stray click changes nothing. Opening is
            step 2 of the diagram and closing is step 4.
          </li>
          <li id="faculty-reviews" data-testid="HelpAdminsPage-faculty-reviews">
            <strong>Open Faculty Reviews / Close Faculty Reviews.</strong>{" "}
            Faculty can see and rank the candidates for their courses only while
            reviews are Open. Opening asks for the faculty ranking deadline,
            after a short account of what will happen; the box proposes five
            working days (Monday to Friday) from today, which you may change.
            The first opening stamps the review opening date, which is kept if
            reviews are reopened, and <em>Change</em> beside the deadline edits
            it later. Closing also asks first, and warns you if the stated
            deadline has not passed yet; it stops faculty from changing their
            rankings and keeps both dates. Opening and closing, and deadline
            changes, are recorded in the recruitment&apos;s change history.
            Opening is step 6 of the diagram and closing is step 7.
          </li>
          <li>
            <strong>Courses.</strong> The recruitment&apos;s course list: one
            row per lecture of each flagged course offered that quarter, with
            instructor, meeting time, room and enrollment from the schedule.{" "}
            <em>Populate</em> re-runs the job: it picks up newly flagged
            courses, refreshes the details, and marks <em>stale</em> any lecture
            it no longer finds; a stale or cancelled lecture is hidden from
            applicants and comes back by itself if a later run finds it again.{" "}
            <em>Remove</em> takes a lecture out of the recruitment for good (a
            later Populate will not put it back), and the toggle shows removed
            rows so one can be restored. Open, upcoming and recently closed
            recruitments are also refreshed automatically every night, and the
            page says when the list was last refreshed.
          </li>
          <li>
            <strong>Test Application.</strong> The form exactly as an applicant
            for this recruitment sees it, even before it opens. Submitting saves
            a test application that never counts as a real one and is marked as
            such wherever it appears. The button is at the top of the
            Applications page.
          </li>
          <li>
            <strong>Download Applications as CSV.</strong> Every application to
            the recruitment as a spreadsheet, with the columns for its type (the
            layout is on the CSV formats page). The button is at the top of the
            Applications page; the rankings download,{" "}
            <strong>Download Rankings CSV</strong>, is on the Courses page.
          </li>
          <li
            id="draft-applications"
            data-testid="HelpAdminsPage-draft-applications"
          >
            <strong>Draft Applications.</strong> The applications students have
            started but not yet submitted, which are not considered until they
            are. A student&apos;s draft appears as soon as they open the form,
            even if they have typed nothing, and is saved as they type, so the
            page always shows what they have so far; the count of drafts is at
            the top. The table has the same columns as the Applications table
            (and hiding or showing a column on one does the same on the other),
            except that there is no <em>Edit</em> column, since an admin may not
            change what a student has written, and <em>Submitted</em> is
            replaced by <em>Last saved</em>. <em>View</em> opens the draft read
            only, with a box for your own comments; the student never sees them.
            When the student submits, the draft leaves this page and your
            comments are copied to the new application&apos;s Admin Comments. A
            draft that goes any other way (for example, its recruitment is
            deleted) takes its comments with it. There is no CSV download of
            drafts, since a draft may be empty or half finished. Drafts show the
            same personal details as applications do, so the same care is asked
            of you.
          </li>
          <li>
            <strong>Applications.</strong> The list of applications, with a
            count that leaves test applications out. Each has a <em>View</em>{" "}
            page (everything the applicant wrote, read-only, plus a box for the
            admin&apos;s own comments) and an <em>Edit</em> page, the same form
            the applicant filled in, for correcting an answer on their behalf;
            every field changed that way goes into the Audit Trail.{" "}
            <span
              id="application-columns"
              data-testid="HelpAdminsPage-application-columns"
            >
              The table shows the id, View, Edit and Name first, then Submitted
              and the other answers, and takes only the width it needs. Every
              column but the first four can be hidden or shown from the{" "}
              <strong>Columns</strong> menu above it (use <em>Show All</em> or{" "}
              <em>Show None</em> at its top to show or hide them all, or click
              the small <strong>hide</strong> link at the top right of a
              column&apos;s heading), which lists every answer on the form for
              that recruitment&apos;s type (TA or ULA); the columns the table
              has always had start shown and the rest start hidden, and the
              choice is kept for that recruitment, for all admins.
            </span>
          </li>
          <li>
            <strong>Assignments.</strong> The faculty rankings of every real
            applicant side by side, one column per lecture, with a{" "}
            <em>Tentative Assignment</em> dropdown on each row for pencilling
            the applicant into a lecture; the{" "}
            <a href="#assignments">Assignments</a> section below has the
            details. The card reaches it from step 8 of the diagram.
          </li>
          <li>
            <strong>Published Assignments.</strong> Shown once{" "}
            <em>Publish Assignments</em> has been clicked at the bottom of the
            Courses page: the read-only assignments page that admins and faculty
            share, with its two CSV downloads (see{" "}
            <a href="#publish-assignments">publishing</a> above).
          </li>
          <li>
            <strong>Delete.</strong> Removes the recruitment, its course list
            and every application to it, after a warning that says how many
            applications that is.
          </li>
        </ul>

        <p
          id="cancelled-and-new"
          data-testid="HelpAdminsPage-cancelled-and-new"
        >
          <strong>An applicant who cancelled and applied again.</strong> While
          applications are open, an applicant who cancelled may start a new
          application (<em>Start a new application</em>). The cancelled
          application is kept, with its reason and time, and the new one is a
          separate row in the Applications table and CSV, so the same email
          address can appear twice: the earlier row (lower id) has the status
          CANCELLED and the later one is the live application. Only the live one
          is counted, ranked and assigned: the cancelled row is left out of the
          Assignments page, the rankings and their CSV, and the number of
          applications under the Applications step. The count on the
          recruitment&apos;s card is of applicants, so a person who cancelled
          and applied again counts once. Faculty see a person under
          &ldquo;Cancelled applications&rdquo; only while they have no live
          application.
        </p>

        <h2 className="my-3 h4" id="ta-app-settings">
          TA App Settings
        </h2>
        <p>
          <Link to="/admin/settings/ta">TA App Settings</Link> holds the lists a
          TA applicant chooses from: the <strong>Majors</strong> list and the{" "}
          <strong>Topics</strong> list (the areas each applicant rates themself
          in). Each list can be edited one entry at a time, or downloaded and
          uploaded as a CSV in the same shape. Changes take effect immediately
          for new applications and never alter ones already submitted.
        </p>
        <p>
          The <strong>Notices, Terms and Conditions</strong> card is the text
          every TA applicant must agree to before submitting. It is written in{" "}
          <a href="#markdown">Markdown</a> with a live preview, filled in for
          the quarter chosen above the editor (by default the quarter after the
          current one); each save is kept as a new version, and each application
          records which version its applicant agreed to. A field the preview
          does not recognise is shown in red, with a note under the preview.
        </p>
        <p id="notice-fields" data-testid="HelpAdminsPage-notice-fields">
          The text can carry fields that are filled in for each applicant from
          their recruitment: its quarter, its primary consideration date, and
          every date of that quarter from the Quarters calendar. They are all
          listed, with examples, on{" "}
          <Link to="/help/notice-fields">Help &rarr; Notices Fields</Link>.
        </p>
        <p>
          The <strong>Import Legacy TA Applications</strong> card loads a CSV
          exported from the old PHP application into a recruitment, for the
          history of past applicants; its format is on the CSV formats page.
        </p>

        <h2 className="my-3 h4" id="ula-app-settings">
          ULA App Settings
        </h2>
        <p>
          <Link to="/admin/settings/ula">ULA App Settings</Link> is the same for
          the ULA form: its <strong>Majors</strong>, <strong>Topics</strong> and{" "}
          <strong>Interests</strong> lists (the areas of ULA work each applicant
          rates their interest in), the ULA notices, terms and conditions (with
          the same <a href="#notice-fields">fields</a> available), and the
          import of the old ULA Google Form&apos;s response sheet.
        </p>

        <h2 className="my-3 h4" id="markdown">
          Markdown
        </h2>
        <p data-testid="HelpAdminsPage-markdown">
          The Notices, Terms and Conditions text on the TA and ULA App Settings
          pages is written in Markdown, a plain-text way of marking up
          formatting, and rendered for applicants (and in the editor&apos;s
          preview) with GitHub-flavoured Markdown. The basics: a line starting
          with <code># </code> is a heading (<code>## </code> a smaller one);{" "}
          <code>*emphasis*</code> is italic and <code>**strong**</code> is bold;
          lines starting with <code>- </code> make a bulleted list and with{" "}
          <code>1. </code> a numbered one;{" "}
          <code>[text](https://example.com)</code> makes a link; a blank line
          starts a new paragraph, and a line starting with <code>&gt; </code> is
          a quotation. Tables are written with <code>|</code> between the cells.
          The editor&apos;s toolbar inserts each of these for you; the fields
          such as <code>{"${quarter}"}</code> are described under{" "}
          <Link to="/help/notice-fields">Help &rarr; Notices Fields</Link>.
        </p>

        <h2 className="my-3 h4" id="legacy-ta-application">
          Legacy TA Application
        </h2>
        <p>
          <Link to="/admin/legacy-ta-application">Legacy TA Application</Link>{" "}
          shows the old PHP app&apos;s TA form, as it was, for comparison with
          the new one. Nothing on it is live.
        </p>

        <h2 className="my-3 h4" id="audit-trail">
          Audit Trail
        </h2>
        <p>
          <Link to="/admin/audittrail">Audit Trail</Link> is every change an
          admin has made to a field of a student&apos;s application through the
          Edit page: which application, which field, and the value before and
          after. It is paged and can be sorted by any column; a long value is
          cut short with a <em>[See value]</em> link that shows the whole thing.
          The trail for one application is also shown on that application&apos;s
          View page. Its times, like every date and time on this site, are
          Pacific Time.
        </p>

        <h2
          className="my-3 h4"
          id="simultaneous-editing"
          data-testid="HelpAdminsPage-simultaneous-editing"
        >
          Simultaneous Editing
        </h2>
        <p data-testid="HelpAdminsPage-simultaneous-editing-refresh">
          If you, or another admin, is editing the same thing at the same time,
          you may get a warning on some pages, such as the draft application
          form. For a recruitment&apos;s settings and its Recruitment Steps
          (whether applications are open or closed, the faculty review dates,
          allocation visibility, whether assignments are published, and which
          boxes have a green check) there is <strong>no warning</strong>.
          Instead the page <strong>refreshes by itself</strong>, without
          reloading, about every 5 seconds (somewhere between 2 and 8, chosen at
          random each time). When another admin opens or closes something, you
          see it on its own within a few seconds, and so do instructors and
          students, about every 15 seconds.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-admin-pages">
          The same is true of the <strong>Instructors</strong> page and the{" "}
          <strong>view-only Courses page</strong>: they refresh by themselves
          every few seconds, so an instructor added, removed or given a catalog
          name by another admin, or a course added, removed or changed on the
          edit page, appears on its own. There is no warning for these pages. A
          catalog name you are in the middle of choosing is not replaced. The
          Courses <strong>edit page</strong> does not refresh by itself; it
          warns instead (see below).
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-safe">
          <strong>What is safe.</strong> A click made in the few seconds before
          a refresh still reaches the server, which judges it: closing
          applications that are already closed changes nothing, and a step whose
          prerequisites are not met is refused. If a confirmation window is open
          for something that has just been done by someone else, it closes
          itself and tells you, and nothing is changed. A date you are typing is
          never replaced by a refresh.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-ranking">
          If you, or another admin, or an instructor, is ranking the same course
          at the same time, you may get a warning that looks like this:
        </p>
        <MultipleTabsBanner
          others={EXAMPLE_OTHERS}
          noun="ranking"
          announce={false}
          testId="HelpAdminsPage-simultaneous-editing-example"
        />
        <p data-testid="HelpAdminsPage-simultaneous-editing-meaning">
          <strong>What it means.</strong> The rankings of the same course are
          open somewhere else: in another tab or window of this browser, on
          another device, or in the browser of someone else who can rank the
          course. This applies to the Candidate Ranking page, reached from the
          course on the Instructor section of the home page. Everyone ranking
          the course shares one list, so one person&apos;s change can be missed
          by the other. If you go on, the system will refuse a ranking saved
          from a copy of the list that is out of date, and say{" "}
          <em>
            Rankings for this course changed while you were editing; your change
            has not been saved.
          </em>{" "}
          The table is then read again, what you typed stays in its box, and you
          can press <strong>Save again</strong> once you have seen the new
          rankings. Rankings of a <em>different</em> course never cause a
          warning, even if the same person ranks both, and a page that only
          shows rankings (read-only) never warns.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-modal">
          <strong>The question.</strong> The tab or window you opened{" "}
          <em>last</em> also asks what you want to do, in a box that covers the
          page until you answer. The one you opened first only shows the
          warning, so that it never interrupts you while you are typing. The box
          says who already has the ranking open, such as &ldquo;You and
          fay@ucsb.edu (Fay Faculty) already have this ranking open for editing
          in other windows or tabs.&rdquo; It offers three choices:
        </p>
        <ul data-testid="HelpAdminsPage-simultaneous-editing-choices">
          <li>
            <strong>Leave this page</strong> takes this tab or window to the
            home page. Your rankings are safe in the other one.
          </li>
          <li>
            <strong>
              Wait for the other tabs or windows to close, then resume here
            </strong>{" "}
            keeps the page covered. When the other tabs or windows are closed,
            the box closes by itself within a few seconds and you can carry on
            here.
          </li>
          <li>
            <strong>Continue anyway</strong> closes the box and keeps the
            warning on the page. Use it only if you are sure that the other copy
            will not be used to rank as well. The box does not come back.
          </li>
        </ul>
        <p data-testid="HelpAdminsPage-simultaneous-editing-ranking-todo">
          <strong>What to do.</strong> Close all the other tabs or windows that
          have this course&apos;s rankings open, and keep just one, or agree
          with the other person on who ranks this course. The warning goes away
          on its own within a few seconds after the others are closed, or in up
          to about twenty seconds if one of them could not say that it was
          leaving, such as when a computer lost its network connection.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-application">
          <strong>Editing a student&apos;s application.</strong> If you, or
          another admin, is editing a student&apos;s application on the Edit
          Application page, and the student (or another admin) has the same
          application open, you may get a warning. When the student has it open,
          it says so, such as &ldquo;chris@ucsb.edu (Chris Student) already has
          this application open for editing. We recommend that you wait a few
          minutes or ask them to close it.&rdquo; When another admin has it
          open, it says &ldquo;We recommend that only one admin edits this page
          at a time.&rdquo; The student sees your name, and is asked to close
          their window and try again in a few minutes. If you save after the
          application has been saved by someone else since you opened it, the
          system refuses your save, says so, and offers <em>Reload</em>.
          Applications of different students never cause a warning.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-assignments">
          <strong>The Assignments page.</strong> The whole Assignments page of
          one recruitment counts as one thing, because the counts under each
          lecture only mean something together. Only one tab or window, and one
          admin, should have it open at a time. If you open it in a second tab
          or window, or another admin has it open, you get a warning that looks
          like this:
        </p>
        <MultipleTabsBanner
          others={EXAMPLE_OTHERS}
          noun="assignments page"
          audience="admin"
          announce={false}
          testId="HelpAdminsPage-simultaneous-editing-assignments-example"
        />
        <p data-testid="HelpAdminsPage-simultaneous-editing-assignments-detail">
          The tab or window opened <em>last</em> also asks the same question as
          for rankings (<strong>Leave this page</strong>, wait, or continue
          anyway), and the warning only appears for the Assignments page of the{" "}
          <em>same</em> recruitment. If something changes while you are working,
          such as another admin&apos;s assignment, publishing the assignments or
          an applicant cancelling, your next change is not made and you see
          &ldquo;Assignments changed while you were working. The page has been
          refreshed; please check the placement and try again.&rdquo; The page
          already shows the up-to-date assignments, so check them and choose
          again if the move still makes sense. Your click is not repeated for
          you.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-budget">
          <strong>The Budget for Quarter page.</strong> One quarter&apos;s
          budget counts as one thing. If another admin has the same
          quarter&apos;s budget open, or you have it open in a second tab or
          window, you get a warning that looks like this:
        </p>
        <MultipleTabsBanner
          others={EXAMPLE_OTHERS}
          noun="budget page"
          audience="admin"
          announce={false}
          testId="HelpAdminsPage-simultaneous-editing-budget-example"
        />
        <p data-testid="HelpAdminsPage-simultaneous-editing-budget-names">
          It names the other people who have it open, up to three and then
          &quot;and 2 others&quot;. If the other copy is your own, in another
          tab or window, it says &quot;You are also editing this budget page in
          another tab or window.&quot;, and if both are open it says &quot;You
          and phtcon@ucsb.edu (Phill Conrad) are also editing this budget page
          in other windows or tabs.&quot; Two admins on different quarters never
          see it. Every box saves as it is typed, so without the warning the
          last save would win and the earlier one would be lost without anyone
          noticing. The tab or window opened <em>last</em> also asks the same
          question as for rankings (<strong>Leave this page</strong>, wait, or{" "}
          <strong>Continue anyway</strong>), and says &quot;already has&quot;
          instead of &quot;is also editing&quot;.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-budget-conflict">
          <strong>If a save is refused.</strong> When a figure was changed by
          someone else after your page last showed it, your save is not made.
          The page keeps what you typed and says, for example, &quot;The
          TAs-only budget was changed in another tab or window. It is now
          $45,000.00; you entered $40,000.00.&quot; The page then shows what is
          stored. Choose <strong>Use theirs</strong> to keep what is stored and
          drop what you typed, or <strong>Overwrite</strong> to save what you
          typed over it. This applies to the three budget lines, the average
          cost per TA and per ULA, and the two hiring targets.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-courses">
          <strong>The Courses pages.</strong> A recruitment&apos;s Courses page
          comes in two forms. The <strong>view-only</strong> page is the one you
          get when you open it: nothing on it can be changed, and any number of
          tabs or windows may show it, for you or for other admins, without any
          warning. Its <strong>Edit</strong> button, beside the words
          &ldquo;Click Edit to: change the number of TAs/ULAs expected to be
          hired; set the expected enrollments for each course; set the number of
          TAs/ULAs allocated to each course; adjust the visibility of these
          allocations&rdquo;, takes you to the <strong>edit page</strong>, where
          you can change the estimated enrollments and the allocations, run Auto
          Allocate, and use Populate and the other controls; it has a link back
          to the view-only page. Only <em>one</em> tab or window should have a
          given recruitment&apos;s edit page open at a time, and edit pages of
          different recruitments never warn each other. If another admin, or
          another tab of yours, has the same edit page open, you get a warning
          that looks like this:
        </p>
        <MultipleTabsBanner
          others={EXAMPLE_OTHERS}
          noun="page"
          audience="admin"
          announce={false}
          testId="HelpAdminsPage-simultaneous-editing-courses-example"
        />
        <p data-testid="HelpAdminsPage-simultaneous-editing-courses-meaning">
          The allocations only make sense together, so a copy that is out of
          date can leave a total that no longer matches the hiring target. If
          you go on, the system refuses a change made from a copy that is out of
          date, tells you, and reads the numbers again; whatever you typed there
          is lost. The tab or window opened <em>last</em> also asks the same
          question as for rankings, and says &ldquo;already has&rdquo; instead
          of &ldquo;is also editing&rdquo;; there{" "}
          <strong>Leave this page</strong> takes you to the view-only Courses
          page. To look at the numbers without risk, use the view-only page in
          as many tabs as you like.
        </p>
        <p data-testid="HelpAdminsPage-simultaneous-editing-todo">
          <strong>What to do.</strong> If a page looks out of date (for example
          the computer was asleep, or the tab was in the background, where
          nothing is refreshed), switch back to it and it updates at once, or
          reload the page.
        </p>
      </div>
    </BasicLayout>
  );
}
