import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import MultipleTabsBanner from "main/concurrency/MultipleTabsBanner";

/** The warning as it looks when your own other tab has the application open. */
// Stryker disable next-line StringLiteral : the label of the user's own tab is never shown
const EXAMPLE_OTHERS = [{ label: "you", samePerson: true }];
import {
  VIDEO_INSTRUCTIONS_TEXT,
  VIDEO_INSTRUCTIONS_URL,
} from "main/utils/helpPages";

/** What a ULA applicant should know before starting the form: /help/ula-applicants (issue #140). */
export default function HelpUlaApplicantsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpUlaApplicantsPage">
        <h1 className="my-4">For ULA Applicants</h1>

        <h2 className="my-3 h4">When you can apply</h2>
        <p>
          The department opens a <strong>recruitment</strong> for Undergraduate
          Learning Assistant (ULA) positions once a quarter, and your home page
          says where things stand. While a recruitment is open it shows an{" "}
          <strong>Apply to be a ULA</strong> link; before one opens it shows the
          tentative opening date; and when none is open, that applications are
          not currently being accepted. Sign in with your UCSB Google account to
          see it.
        </p>
        <p>
          You can edit your application as often as you like until the
          recruitment&apos;s <strong>primary consideration date</strong>. After
          that, only a &ldquo;post-application comments&rdquo; box stays open.
          Your home page lists every application you have made and its status.
        </p>
        <p>
          If you have applied before, your most recent answers are copied into
          the new form, so you only need to update what has changed.
        </p>

        <h2 className="my-3 h4">What you will be asked for</h2>
        <p>You will be asked to provide the following information:</p>
        <ul data-testid="HelpUlaApplicantsPage-asked-for">
          <li>Your name and your UCSB perm number.</li>
          <li>
            Your major (and whether you are changing it), your GPA (in your
            major and overall), your year in the program, and your expected
            graduation date. You must still be an undergraduate in the quarter
            you are applying for. If you are applying during your first quarter
            at UCSB and do not yet have a GPA, you can check the box under the
            two GPA fields instead of entering them.{" "}
            <span data-testid="HelpUlaApplicantsPage-double-major">
              If you are a double major, select "Other" under Major and enter
              both majors in the field that appears.
            </span>
          </li>
          <li>Whether you have served as a ULA before, and how many times.</li>
          <li>
            A link to a short video with a teaching demonstration. It is
            required for first-time applicants and optional, but strongly
            encouraged, for returning ULAs; instructors use it when choosing
            among candidates they do not know. See the{" "}
            <a
              href={VIDEO_INSTRUCTIONS_URL}
              target="_blank"
              rel="noreferrer"
              data-testid="HelpUlaApplicantsPage-video-instructions"
            >
              {VIDEO_INSTRUCTIONS_TEXT}
            </a>
            .
          </li>
          <li>
            If you are in the BS/MS program, your student status next quarter
            and whether you want to be considered for a TA position instead.
          </li>
          <li>
            Employment questions that let the department start the hiring
            paperwork sooner if you are offered a position: whether you will
            have another UC job that quarter, whether you have been paid by the
            University of California before (and your employee ID if so), and
            whether your I-9 verification is already on file. Every applicant
            must tick the box confirming that they will make an I-9 verification
            appointment if hired.
          </li>
          <li>
            For new ULAs, whether you can commit to the training offered at the
            start of the quarter.
          </li>
          <li>
            A list of courses you have taken, at UCSB or elsewhere, that are
            relevant to your application. UCSB CMPSC courses can be ticked off a
            list; others are entered by hand. Choose the term from the dropdown
            (F: Fall, W: Winter, S: Spring, M: Summer, then the year, as in
            F25); tick the box under it only for a term the list cannot express,
            such as a semester. For a UCSB course whose number is in the
            department's course list but whose title you left blank, the title
            is filled in for you when the application is opened, and saved with
            it.
          </li>
          <li>
            A self-assessment of how comfortable you are with each of a set of
            topic areas, and how interested you are, from 5 (very) to 1 (not),
            in each of a set of areas of ULA work the department lists.
          </li>
          <li>Your previous teaching or tutoring experience.</li>
          <li>
            Your first and second choice courses (what you most want to be a ULA
            for), chosen from the courses being recruited for that quarter, and
            for each whether you are free for its lectures and discussion
            sections.
          </li>
          <li>
            For every other course offered that quarter, your level of interest:
            enthusiastic, would consider, or not applicable / not interested.
            The department prefers that you have taken a course you apply for,
            with a B or better. If you ask for a course you have not listed
            among the courses you have taken, whether as a choice or as
            Enthusiastic or Would Consider, the form marks it with a red warning
            triangle and asks whether you have taken it. If you have, add it to
            your coursework; if not, explain in the Anything Else box what
            background prepares you to be a ULA for it. A red reminder naming
            those courses also appears next to the Anything Else box. Listing
            the course in your coursework clears the mark and the reminder.
          </li>
          <li>
            Anything else you would like the department to know, such as
            experience that prepares you for a course you have not taken.
          </li>
        </ul>
        <p>
          Before you submit, you will be shown the department&apos;s notices,
          terms and conditions for ULA applications and asked to agree to them.
        </p>

        <p data-testid="HelpUlaApplicantsPage-time-zone">
          Every date and time on this site is in Pacific Time (Santa Barbara
          time), wherever you are.
        </p>

        <h2 className="my-3 h4">Tips</h2>
        <ul>
          <li>
            Fields marked with a red asterisk are required. If anything is
            missing when you submit, the form lists what is missing and each
            entry jumps to the field.
          </li>
          <li>
            Nothing you type is lost: the form saves a <strong>draft</strong>{" "}
            every few seconds as you go. <strong>Save Draft</strong>, beside the
            submit button, saves it at once and takes you back to your home
            page, where the recruitment&apos;s card offers{" "}
            <strong>Continue editing draft application</strong>. A draft is not
            an application, and incomplete applications are not considered, so
            submit it before the recruitment closes.
          </li>
          <li>
            Once you have submitted, the card shows{" "}
            <strong>View submitted application</strong>. You can still edit it
            there until the primary consideration date.
          </li>
        </ul>

        <h2 className="my-3 h4" data-testid="HelpUlaApplicantsPage-cancelling">
          Cancelling, and applying again
        </h2>
        <p>
          Until the recruitment closes you can withdraw a submitted application
          with <strong>Cancel my Application</strong> on its card on your home
          page. You are asked for a brief reason and to confirm. A cancelled
          application is not considered, can no longer be edited, and cannot be
          brought back; the system keeps it, with your reason and the time you
          cancelled, so the admins can still see it.
        </p>
        <p data-testid="HelpUlaApplicantsPage-start-again">
          <strong>Changed your mind, or cancelled by mistake?</strong> While
          applications are still open for that recruitment, the card and the
          cancelled application&apos;s page show
          <strong>Start a new application</strong>. It gives you an empty form,
          as if you had never applied, with the usual saved draft and the usual
          <strong>Submit Application</strong>. Once you submit it, the new
          application is the one that counts, and the cancelled one stays on
          file, marked as cancelled. Once applications have closed the button is
          gone and a new application can no longer be started.
        </p>

        <h2
          className="my-3 h4"
          data-testid="HelpUlaApplicantsPage-simultaneous-editing"
        >
          Simultaneous Editing
        </h2>
        <p>
          If you try to edit the same application in more than one tab or
          window, you may get a warning that looks like this:
        </p>
        <MultipleTabsBanner
          others={EXAMPLE_OTHERS}
          noun="application"
          announce={false}
          testId="HelpUlaApplicantsPage-simultaneous-editing-example"
        />
        <p data-testid="HelpUlaApplicantsPage-simultaneous-editing-meaning">
          <strong>What it means.</strong> The same draft is open somewhere else,
          in another tab or window of this browser or on another device. Both
          copies save to the same draft, so one copy can overwrite the
          other&apos;s changes. If you go on, the system will refuse a save from
          a copy that is out of date and ask you to reload, and what you typed
          in the old copy since then is lost.
        </p>
        <p data-testid="HelpUlaApplicantsPage-simultaneous-editing-modal">
          <strong>The question.</strong> The tab or window you opened{" "}
          <em>last</em> also asks what you want to do, in a box that covers the
          form until you answer. The one you opened first only shows the
          warning, so that it never interrupts you while you are typing. The box
          says who already has the application open, such as &ldquo;You already
          have this application open for editing in another tab or
          window.&rdquo; It offers three choices:
        </p>
        <ul data-testid="HelpUlaApplicantsPage-simultaneous-editing-choices">
          <li>
            <strong>Leave this page</strong> takes this tab or window to the
            home page. Your draft is safe in the other one.
          </li>
          <li>
            <strong>
              Wait for the other tabs or windows to close, then resume here
            </strong>{" "}
            keeps the form covered. When you close the other tabs or windows,
            the box closes by itself within a few seconds and you can carry on
            here.
          </li>
          <li>
            <strong>Continue anyway</strong> closes the box and keeps the
            warning on the page. Use it only if you are sure you will not type
            in the other copy as well. The box does not come back.
          </li>
        </ul>
        <p data-testid="HelpUlaApplicantsPage-simultaneous-editing-todo">
          <strong>What to do.</strong> Close all the other tabs or windows, and
          keep just one. If the form asks you to reload, reload it to see the
          latest version of your draft. The warning goes away on its own within
          a few seconds after the other copies are closed, or in up to about
          twenty seconds if the other copy could not say that it was leaving,
          such as when a computer lost its network connection.
        </p>
        <p data-testid="HelpUlaApplicantsPage-simultaneous-editing-admin">
          <strong>An admin has your application open.</strong> After you have
          submitted, an admin may correct your application. If you open it for
          editing while an admin has it open, the warning names the admin, such
          as &ldquo;Admin jane@ucsb.edu (Jane Doe) has this application open for
          editing. We recommend that you close this window and try again in a
          few minutes. If this message persists, please reach out to
          jane@ucsb.edu&rdquo; The admin&apos;s email address at the end is
          where to write if the message does not go away. If you save while the
          admin has saved since you opened the application, the system refuses
          your save, says so, and offers <em>Reload</em>; what you typed in the
          old copy is lost.
        </p>
        <p data-testid="HelpUlaApplicantsPage-simultaneous-editing-refresh">
          <strong>Applications opening and closing.</strong> The home page and
          the application form <strong>refresh by themselves</strong>, without
          reloading, about every 15 seconds (somewhere between 10 and 20), so
          when an admin opens or closes applications you see it on its own.
          There is no warning for that. If applications close while you are
          filling in the form, the form stays as you left it and says so: your
          draft is kept, as of its last automatic save, but it can no longer be
          submitted. If a page looks out of date, switch back to it, or reload
          it.
        </p>
      </div>
    </BasicLayout>
  );
}
