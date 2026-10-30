import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Table } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { ADMIN_MENU_ENTRIES } from "main/utils/helpPages";
import { NOTICE_FIELD_EXAMPLES } from "main/utils/noticeFields";

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
          <Link to="/help/csv">CSV Upload/Download Formats</Link> page). Each
          row also has a <strong>Catalog Name</strong>: the spelling the course
          schedule uses for that instructor, for example &ldquo;CONRAD P&rdquo;,
          chosen from the names the course-population jobs have seen. Set it so
          the instructor&apos;s courses can be matched to them; until it is set,
          their Instructor section says no recruitment includes a course they
          teach.
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
          <li>
            <strong>Open Applications / Close Applications.</strong>{" "}
            Recruitments do not open or close by themselves on the tentative
            dates; an admin clicks. The first open stamps the actual opening
            date and never overwrites it; each close stamps the actual closing
            date. Applicants may apply only while the status is Open, and may
            edit only until the primary consideration date.
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
            every field changed that way goes into the Audit Trail.
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
        <h3 className="h6 mt-3" id="notice-fields">
          Fields in the notices text
        </h3>
        <p data-testid="HelpAdminsPage-notice-fields">
          The text can carry two fields that are filled in for each applicant
          from their recruitment: <code>{"${quarter}"}</code> becomes the
          quarter, written out (for example <em>Winter 2026</em>), and{" "}
          <code>{"${primaryConsiderationDate}"}</code> becomes the primary
          consideration date (for example <em>January 20, 2026</em>). The
          editor&apos;s preview shows the fields as written, since it belongs to
          no recruitment; the applicant&apos;s form, the view of a submitted
          application, and the admin&apos;s Test Application all show them
          filled in. Anything else between <code>{"${"}</code> and{" "}
          <code>{"}"}</code> is left exactly as typed. Two examples:
        </p>
        <ul data-testid="HelpAdminsPage-notice-field-examples">
          {NOTICE_FIELD_EXAMPLES.map((example) => (
            <li key={example}>
              <code>{example}</code>
            </li>
          ))}
        </ul>
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
