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
          sections. Candidate ranking tools will be added to that page later.
          Contact an admin if a course or ranking page is unavailable.
        </p>
      </div>
    </BasicLayout>
  );
}
