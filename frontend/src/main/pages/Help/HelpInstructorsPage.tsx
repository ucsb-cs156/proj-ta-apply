import { Link } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import MultipleTabsBanner from "main/concurrency/MultipleTabsBanner";

/** The warning as it looks when someone else is ranking the same course. */
// Stryker disable next-line StringLiteral : the example name is fixed and is checked by the tests
const EXAMPLE_OTHERS = [
  { label: "phtcon@ucsb.edu (Phill Conrad)", samePerson: false },
];

/** What an instructor can do here, so far: /help/instructors (issue #140). */
export default function HelpInstructorsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpInstructorsPage">
        <h1 className="my-4">For Instructors</h1>
        <p data-testid="HelpInstructorsPage-home-cards">
          When you are signed in, your home page has an{" "}
          <strong>Instructor</strong> section with one card per quarter, newest
          first, for each quarter in which you teach a course that is in a TA or
          ULA recruitment. The card&apos;s header is the quarter; under it is a
          drop-down for each of your courses in that quarter&apos;s recruitments
          (a course in both the TA and the ULA recruitment appears once). Open a
          course to see its enrollment table (Section, Enrolled, Max, Enrollment
          Estimate, TA Allocation and ULA Allocation, always all six; the
          Enrollment Estimate reads <strong>TBD</strong> until an admin releases
          the allocations of either recruitment, an Allocation cell reads{" "}
          <strong>TBD</strong> until that recruitment&apos;s allocations are
          released, and <strong>N/A</strong> when the course is not in a
          recruitment of that type), a place to give feedback on your
          allocations (see below), and then a <strong>TA</strong> card and/or a{" "}
          <strong>ULA</strong> card: one for each recruitment the course is in,
          with that recruitment&apos;s status and dates.
        </p>
        <p data-testid="HelpInstructorsPage-steps-link">
          Where your part fits in a recruitment, and what the admin does before
          and after it, is drawn on the{" "}
          <Link to="/help/recruitment-steps">Recruitment Steps</Link> page.
        </p>
        <p>
          Courses are matched to you by the name the course schedule uses for
          you (for example &ldquo;CONRAD P&rdquo;), which an admin assigns to
          your account. If a recruitment you expect is missing, or the section
          says no recruitment includes a course you teach, ask an admin to check
          the catalog name on your account.
        </p>
        <p data-testid="HelpInstructorsPage-card-dates">
          Each TA or ULA card shows whether applications are open, whether
          faculty reviews are NotStarted, Open, or Closed, the date reviews were
          first opened, and the faculty ranking deadline. The application dates
          themselves (tentative opening, primary consideration, actual opening
          and closing) are not shown on the card; they are separate from the
          review dates and status.
        </p>
        <p data-testid="HelpInstructorsPage-allocations">
          Once an admin lets faculty see a recruitment&apos;s allocations, the
          quarter&apos;s <strong>Enrollment Estimate</strong> and that
          recruitment&apos;s <strong>TA Allocation</strong> or{" "}
          <strong>ULA Allocation</strong> in the course&apos;s enrollment table
          change from TBD to the number, and the TA or ULA card gains a small
          table, also shown at the top of the ranking page: the{" "}
          <strong>Hiring Target</strong> (how many TAs or ULAs were allocated to
          the course; the same number as the allocation), the{" "}
          <strong>Ranking Target</strong> (how many candidates you are asked to
          rank: twice the hiring target, or every interested candidate if there
          are fewer), <strong>Candidates Ranked</strong> so far and{" "}
          <strong>Rankings Still Needed</strong>. The ranking button sits in the
          first column of that table. Please rank at least as many as the hiring
          target, and preferably the whole ranking target. If you have concerns
          about your course&apos;s target, raise them with the admin once you
          see it. Until the admin does, nothing about it is shown. The read-only
          Courses page, listing every course of a recruitment with its
          instructor, enrollment and meeting times, is being phased out and is
          no longer linked from the home page.
        </p>
        <p data-testid="HelpInstructorsPage-feedback">
          Each course also has a <strong>feedback form</strong> on your
          allocation. Until the admin releases the quarter&apos;s allocations
          (the TA allocations in a quarter with only a TA recruitment, the ULA
          ones in a quarter with only a ULA recruitment, and both in a quarter
          with both), the course says what it is waiting for. Then the form
          appears: tick at least one of the boxes (the allocation seems
          reasonable; you would prefer a different number of TAs or of ULAs,
          which then asks how many; you have other concerns) and, if you like,
          write comments of up to 2048 characters. Everything is saved as you
          go, and <strong>Last saved</strong> shows when. Under the form,{" "}
          <strong>Notes on TA/ULA tradeoffs</strong> opens to show the
          quarter&apos;s estimated cost of a TA and of a ULA, and so how many
          ULAs cost the same as one TA.
        </p>
        <p>
          When faculty reviews are open, expand one of your listed courses and
          choose <strong>Rank Candidates</strong> in its TA or ULA card. After
          reviews close, the link changes to{" "}
          <strong>View Candidate Rankings</strong>. The course page shows the
          recruitment dates and the course section; if you teach multiple
          courses in that recruitment, it also links to your other sections. The
          table contains real applicants who chose this course or expressed
          enthusiasm or willingness to consider it. Each section has independent
          rankings. The table always opens in the default sort: by your ranking
          (1 first, unranked last), then by course preference (first choice,
          second choice, enthusiastic, then would consider), then in the order
          the applications were submitted. The <strong>Default Sort</strong>{" "}
          button returns to it after you sort by another column, and also
          re-reads any rankings you have just typed. Click any column heading to
          sort by that column; course preference sorts from first choice to
          second choice, enthusiastic, then would consider. Contact an admin if
          a course or ranking page is unavailable.
        </p>
        <p data-testid="HelpInstructorsPage-ranking-columns">
          The ranking table has a <strong>Columns</strong> menu, like the other
          tables, to hide the columns you do not need: untick a column to hide
          it and tick it again to bring it back, or use{" "}
          <strong>Show All</strong> and <strong>Show None</strong>. Each column
          heading also has a small <strong>hide</strong> link above it that
          hides that column. The Ranking, First Name and Last Name columns
          cannot be hidden, so you can always rank and see whom you are ranking.
          Your choice is remembered in this browser for all the courses of the
          recruitment (separately for TA and ULA recruitments). The warning
          under tied rankings always spans whichever columns are showing.
        </p>
        <p>
          Enter any integer from 1 through the number of candidates. Each valid
          edit saves immediately; clear an input to remove its rank. Watch the
          Saving, Saved, or Save failed message, and retry failed saves before
          leaving the page. Ties are allowed and save immediately, but after two
          seconds tied ranks turn bright yellow and a red warning appears
          directly under the last row of each group of tied candidates, asking
          whether you are sure you have no preference among them. If you sort by
          another column, the rows of a group may be apart; the warning still
          appears once per group, under its last row. Use ties only when you
          have absolutely no preference between those candidates.
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
          When the admins have settled who is hired, the recruitment&apos;s TA
          or ULA card, in each of your courses, gains an{" "}
          <strong>Assignments Published</strong> badge and an{" "}
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

        <h2
          className="my-3 h4"
          id="simultaneous-editing"
          data-testid="HelpInstructorsPage-simultaneous-editing"
        >
          Simultaneous Editing
        </h2>
        <p data-testid="HelpInstructorsPage-simultaneous-editing-refresh">
          Where a recruitment is in the process (whether applications are open
          or closed, whether faculty ranking is open and its deadline, whether
          the allocations are visible to you, and whether assignments are
          published) is shown on the home page and on the ranking page. These
          pages <strong>refresh by themselves</strong>, without reloading, about
          every 15 seconds (somewhere between 10 and 20, chosen at random each
          time), so when an admin opens or closes something you see it on its
          own. There is <strong>no warning</strong> for this.
        </p>
        <p data-testid="HelpInstructorsPage-simultaneous-editing-ranking">
          If you, or another instructor of the same course, or an admin who
          teaches it, is ranking the same course at the same time, you may get a
          warning that looks like this:
        </p>
        <MultipleTabsBanner
          others={EXAMPLE_OTHERS}
          noun="ranking"
          announce={false}
          testId="HelpInstructorsPage-simultaneous-editing-example"
        />
        <p data-testid="HelpInstructorsPage-simultaneous-editing-meaning">
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
        <p data-testid="HelpInstructorsPage-simultaneous-editing-modal">
          <strong>The question.</strong> The tab or window you opened{" "}
          <em>last</em> also asks what you want to do, in a box that covers the
          page until you answer. The one you opened first only shows the
          warning, so that it never interrupts you while you are typing. The box
          says who already has the ranking open, such as &ldquo;You and
          fay@ucsb.edu (Fay Faculty) already have this ranking open for editing
          in other windows or tabs.&rdquo; It offers three choices:
        </p>
        <ul data-testid="HelpInstructorsPage-simultaneous-editing-choices">
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
        <p data-testid="HelpInstructorsPage-simultaneous-editing-ranking-todo">
          <strong>What to do.</strong> Close all the other tabs or windows that
          have this course&apos;s rankings open, and keep just one, or agree
          with the other person on who ranks this course. The warning goes away
          on its own within a few seconds after the others are closed, or in up
          to about twenty seconds if one of them could not say that it was
          leaving, such as when a computer lost its network connection.
        </p>
        <p data-testid="HelpInstructorsPage-simultaneous-editing-todo">
          <strong>What to do.</strong> If a page looks out of date (for example
          the computer was asleep, or the tab was in the background, where
          nothing is refreshed), switch back to it and it updates at once, or
          reload the page. A ranking you are entering is never replaced by a
          refresh.
        </p>
      </div>
    </BasicLayout>
  );
}
