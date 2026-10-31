import BasicLayout from "main/layouts/BasicLayout/BasicLayout";

/** What an instructor can do here, so far: /help/instructors (issue #140). */
export default function HelpInstructorsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpInstructorsPage">
        <h1 className="my-4">For Instructors</h1>
        <p>
          When you are signed in, your home page has an{" "}
          <strong>Instructor</strong> section listing the recruitments that
          apply to you: each TA or ULA recruitment for a quarter in which you
          are teaching a course that is recruiting, with that course (or
          courses) under it.
        </p>
        <p>
          Courses are matched to you by the name the course schedule uses for
          you (for example &ldquo;CONRAD P&rdquo;), which an admin assigns to
          your account. If a recruitment you expect is missing, or the section
          says no recruitment includes a course you teach, ask an admin to check
          the catalog name on your account.
        </p>
        <p>
          Each recruitment card shows whether faculty reviews are NotStarted,
          Open, or Closed, the date reviews were first opened, and the faculty
          ranking deadline. These dates and status are separate from the
          application dates.
        </p>
        <p>
          When faculty reviews are open, expand one of your listed courses and
          choose <strong>Rank Candidates</strong>. After reviews close, the link
          changes to <strong>View Candidate Rankings</strong>. The course page
          shows the recruitment dates and the course section; if you teach
          multiple courses in that recruitment, it also links to your other
          sections. The table contains real applicants who chose this course or
          expressed enthusiasm or willingness to consider it. Each section has
          independent rankings. Click any column heading to sort; course
          preference sorts from first choice to second choice, enthusiastic,
          then would consider. Contact an admin if a course or ranking page is
          unavailable.
        </p>
        <p>
          Enter any integer from 1 through the number of candidates. Each valid
          edit saves immediately; clear an input to remove its rank. Watch the
          Saving, Saved, or Save failed message, and retry failed saves before
          leaving the page. Ties are allowed and save immediately, but after two
          seconds tied ranks turn bright yellow with a warning. Use ties only
          when you have absolutely no preference between those candidates.
        </p>
        <p>
          Only instructors assigned to a section may edit its rankings while
          reviews are Open; the deadline is informational until an admin closes
          reviews. Closed reviews and admin views are read-only. Click either
          name to open the full, read-only application in a new tab, without
          staff-only notes or editing controls.
        </p>
      </div>
    </BasicLayout>
  );
}
