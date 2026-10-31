import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Table } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { ADMIN_MENU_ENTRIES } from "main/utils/helpPages";

/**
 * The admin's handbook: /help/admins (issue #140). A table of every option on the Admin and
 * Developer menus, each linking to the section below that says what the page does and where it
 * fits in the flow of a recruitment.
 */
export default function HelpAdminsPage(): React.JSX.Element {
  const location = useLocation();

  // The table's links point at a section (#courses); scroll to it on arrival.
  // Stryker disable all : the hash never changes while the page is mounted in a test, so the
  // dependency list cannot be told apart from an empty one; the behaviour itself is tested.
  useEffect(() => {
    if (!location.hash) return;
    const element = document.getElementById(location.hash.slice(1));
    if (element) {
      element.scrollIntoView();
    }
  }, [location.hash]);
  // Stryker restore all

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
          On a recruitment card, <strong>Download Rankings CSV</strong> saves
          that recruitment&apos;s faculty rankings as a spreadsheet-ready file.
          This is separate from <strong>Download CSV</strong>, which exports
          application answers. Rankings include every real applicant, even those
          with no interests or rankings; test applications are excluded. Unset
          rankings are blank, not zero, and ties are preserved.
        </p>
        <p>
          TA columns are first name, last name, email, major, class level, year
          in program and expected graduation. ULA columns are first name, last
          name, email, major, year in program, expected graduation, GPA in
          major, overall GPA and quarters of previous ULA service. No video
          links or admin comments are exported. Course columns follow in course
          ID and section order, each headed by the bare course number (16, 5A);
          the section is added only when the recruitment has more than one
          section of that course (16 (section 0100), 16 (section 0200)), so
          independent faculty rankings stay distinct. Removed, stale and
          cancelled sections remain in this historical export so saved rankings
          are not lost when offerings change.
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
          Every column sorts; sorting by a lecture puts the ranked applicants
          first (in either direction) and the unranked ones after them. Under
          each lecture&apos;s name the heading shows its{" "}
          <strong>Allocation</strong>, how many applicants are{" "}
          <strong>Assigned</strong> to it so far, and how many places are{" "}
          <strong>Left</strong>, in red when more have been assigned than
          allocated; those numbers stay put when you sort.
        </p>
        <p data-testid="HelpAdminsPage-tentative-assignment">
          Choosing a lecture in the dropdown (or the blank entry to clear it)
          saves at once and updates the counts. A tentative assignment is
          planning only: it is not shown to applicants or to faculty at this
          stage, and it is not written to the Audit Trail. A lecture removed
          from the recruitment stays in the table while it still has rankings or
          an assignee, marked as no longer offered.
        </p>

        <h2 className="my-3 h4" id="flow">
          The flow of a recruitment
        </h2>
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
            <em>Test Application</em>, then <em>Open Applications</em>.
          </li>
          <li>
            <strong>While open:</strong> applicants apply and edit until the
            primary consideration date. <em>Review Applications</em> and{" "}
            <em>Download CSV</em> show what has come in; a student&apos;s
            answers can be corrected on their behalf, with every change recorded
            in the <strong>Audit Trail</strong>.
          </li>
          <li>
            <strong>Afterwards:</strong> <em>Close Applications</em>. The
            recruitment and its applications stay on file; past recruitments
            tell applicants when the last round ran.
          </li>
        </ol>

        <h2 className="my-3 h4" id="menu">
          The Admin and Developer menus, and the home page
        </h2>
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
          for each section. The number links to the read-only ranking page;
          sections with no entered rankings link with a zero. The{" "}
          <strong>Email</strong> column uses the instructor&apos;s catalog-name
          mapping from the Instructors page. Use its <em>Copy</em> control for
          one address, or <em>Copy emails of faculty with zero rankings</em> to
          prepare a reminder. Bulk reminders include only mapped addresses for
          the courses currently visible, deduplicated when an instructor has
          multiple sections. Turn on <em>Show removed courses</em> to include
          removed sections in both the table and reminder list.
        </p>
        <p id="course-columns" data-testid="HelpAdminsPage-course-columns">
          The table can be trimmed to what you need: the{" "}
          <strong>Columns</strong> menu above it lists every column but the
          course number, and unticking one hides it, heading, cells and totals
          alike, until you tick it again or choose <em>Show all columns</em>.
          The choice is kept for that recruitment, so it is the same on your
          next visit and for the other admins. The{" "}
          <strong>Summer Session</strong> column appears only for a summer
          quarter. Headings are centred, numbers are right-aligned, and sorting
          by course number follows the padded course id exactly as it is shown,
          so CMPSC 5A comes before CMPSC 130A. In the <strong>Email</strong>{" "}
          column, the copy icon copies one address and <em>Not mapped</em> opens
          the Instructors page in a new tab, where the catalog name can be given
          an email.
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
          warning that it overwrites every allocation: each lecture gets its
          share rounded, then positions are taken from the lectures furthest
          over their share, or given to those furthest under it, one at a time
          until the total is exactly the hiring target. The purpose of this
          feature is to give admins a way to make a first-cut allocation based
          on enrollment, as close to fair as the numbers allow; it should not
          necessarily be considered the final allocation. Admins have the
          flexibility to adjust it up or down based on the particular needs of
          specific courses and other relevant factors.
        </p>
        <p
          id="allocation-visibility"
          data-testid="HelpAdminsPage-allocation-visibility"
        >
          Allocations are hidden from faculty until you choose otherwise. Under
          the hiring target, the page says whether they are currently hidden or
          shown. <strong>Show Allocations to Faculty</strong> puts each
          lecture&apos;s allocation on the instructor&apos;s home page card and
          at the top of its ranking page, where it asks them to rank at least
          that many candidates and preferably twice as many; instructors see
          only their own courses. <strong>Hide Allocations from Faculty</strong>{" "}
          takes it away again. Showing or hiding is recorded in the
          recruitment&apos;s change history.
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
          has, with these buttons:
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
            of what will happen, so a stray click changes nothing.
          </li>
          <li id="faculty-reviews" data-testid="HelpAdminsPage-faculty-reviews">
            <strong>Open Faculty Reviews / Close Faculty Reviews.</strong>{" "}
            Faculty can see and rank the candidates for their courses only while
            reviews are Open. Opening asks for the faculty ranking deadline,
            after a short account of what will happen; the first opening stamps
            the review opening date, which is kept if reviews are reopened, and{" "}
            <em>Change</em> beside the deadline edits it later. Closing stops
            faculty from changing their rankings and keeps both dates. Opening
            and closing, and deadline changes, are recorded in the
            recruitment&apos;s change history.
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
            such wherever it appears.
          </li>
          <li>
            <strong>Download CSV.</strong> Every application to the recruitment
            as a spreadsheet, with the columns for its type (the layout is on
            the CSV formats page).
          </li>
          <li>
            <strong>Review Applications.</strong> The list of applications, with
            a count that leaves test applications out. Each has a <em>View</em>{" "}
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
              <strong>Columns</strong> menu above it, which lists every answer
              on the form for that recruitment&apos;s type (TA or ULA); the
              columns the table has always had start shown and the rest start
              hidden, and the choice is kept for that recruitment, for all
              admins.
            </span>
          </li>
          <li>
            <strong>Assignments.</strong> The faculty rankings of every real
            applicant side by side, one column per lecture, with a{" "}
            <em>Tentative Assignment</em> dropdown on each row for pencilling
            the applicant into a lecture; the{" "}
            <a href="#assignments">Assignments</a> section below has the
            details.
          </li>
          <li>
            <strong>Delete.</strong> Removes the recruitment, its course list
            and every application to it, after a warning that says how many
            applications that is.
          </li>
        </ul>

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
          every TA applicant must agree to before submitting. It is written in
          Markdown with a live preview; each save is kept as a new version, and
          each application records which version its applicant agreed to.
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
          View page.
        </p>

        <h2 className="my-3 h4" id="jobs">
          Jobs (Developer menu)
        </h2>
        <p>
          <Link to="/admin/jobs">Jobs</Link> lists every background job that has
          run, with its status and log: the job that fills the Courses table,
          the job that fills a recruitment&apos;s course list (launched on
          creation, by Populate, and by the nightly refresh), and a test job
          that can be launched here to check the job system itself. When a
          course list looks wrong, its job&apos;s log says what the UCSB API
          returned.
        </p>

        <h2 className="my-3 h4" id="developer-info">
          Developer Info (Developer menu)
        </h2>
        <p>
          <Link to="/admin/developer">Developer Info</Link> shows which branch
          and commit are deployed, links to the backend&apos;s API
          documentation, and the system settings the app was started with. It is
          for checking what is running, not for changing anything.
        </p>
      </div>
    </BasicLayout>
  );
}
