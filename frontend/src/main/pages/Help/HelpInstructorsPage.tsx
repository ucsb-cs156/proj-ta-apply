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
        <p data-testid="HelpInstructorsPage-allocations">
          Once an admin lets faculty see the allocations, each of your courses
          shows a small table, both on the card and at the top of its ranking
          page: the <strong>Hiring Target</strong> (how many TAs or ULAs were
          allocated to the course), the <strong>Ranking Target</strong> (how
          many candidates you are asked to rank: twice the hiring target, or
          every interested candidate if there are fewer),{" "}
          <strong>Candidates Ranked</strong> so far and{" "}
          <strong>Rankings Still Needed</strong>. Please rank at least as many
          as the hiring target, and preferably the whole ranking target. If you
          have concerns about your course&apos;s target, raise them with the
          admin once you see it. Until the admin does, nothing about it is
          shown. If the admin chooses to show all courses to all faculty, your
          cards also offer <strong>All allocations</strong>, a read-only list of
          every course&apos;s number; otherwise that page does not exist.
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
          reviews. Rankings can be entered only by the course&apos;s instructor
          of record while reviews are open, admin or not; closed reviews, and
          the view of an admin who does not teach the course, are read-only.
          Click either name to open the full, read-only application in a new
          tab, without staff-only notes or editing controls.
        </p>
        <p data-testid="HelpInstructorsPage-interest">
          The <strong>Course Preference</strong> cell of each candidate is
          coloured by their own interest in your course: light green for a first
          or second choice (marked ➊ or ➋) or <em>Enthusiastic</em> (✓), pale
          yellow for <em>Would Consider</em> (▬) and pale red for{" "}
          <em>Not Interested/Not Applicable</em> (✖); the legend above the table
          repeats this. Candidates who marked your course Not Interested/Not
          Applicable are left out until you tick{" "}
          <strong>
            Include candidates that marked my course with &quot;Not
            Interested/Not Applicable&quot;
          </strong>{" "}
          under the table; a red warning then asks you to consider whether you
          should rank them at all. Once you have ranked one of them, the box
          stays ticked and cannot be cleared, so a ranked candidate is never
          hidden; clear that ranking and you can untick it again. Applicants who
          cancelled their application are never candidates; the{" "}
          <strong>Cancelled applications</strong> table at the bottom of the
          page lists them with their reason, so you can tell what became of
          someone you expected to see.
        </p>
        <p data-testid="HelpInstructorsPage-assignments">
          When the admins have settled who is hired, the recruitment card gains
          an <strong>Assignments Published</strong> badge and an{" "}
          <strong>Assignments</strong> button. The page it opens is read-only
          and covers every course in the recruitment, not just yours: choose{" "}
          <strong>One Row per course</strong> to see each course with its
          instructor and the TAs (or ULAs) assigned to it, or{" "}
          <strong>One Row per TA/ULA</strong> to see each person with their
          course. Either view can be saved as a CSV file with the{" "}
          <strong>Download CSV</strong> buttons. Admins may still adjust
          assignments after publishing, so check back if something looks wrong,
          or contact an admin.
        </p>
      </div>
    </BasicLayout>
  );
}
