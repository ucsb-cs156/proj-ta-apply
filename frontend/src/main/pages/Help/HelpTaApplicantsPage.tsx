import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import MultipleTabsBanner from "main/concurrency/MultipleTabsBanner";

/** The warning as it looks when your own other tab has the application open. */
// Stryker disable next-line StringLiteral : the label of the user's own tab is never shown
const EXAMPLE_OTHERS = [{ label: "you", samePerson: true }];

/** What a TA applicant should know before starting the form: /help/ta-applicants (issue #140). */
export default function HelpTaApplicantsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpTaApplicantsPage">
        <h1 className="my-4">For TA Applicants</h1>

        <h2 className="my-3 h4">When you can apply</h2>
        <p>
          The department opens a <strong>recruitment</strong> for TA positions
          once a quarter, and your home page says where things stand. While a
          recruitment is open it shows an <strong>Apply to be a TA</strong>{" "}
          link; before one opens it shows the tentative opening date; and when
          none is open, that applications are not currently being accepted. Sign
          in with your UCSB Google account to see it.
        </p>
        <p>
          You can edit your application as often as you like until the
          recruitment&apos;s <strong>primary consideration date</strong>. After
          that, only a &ldquo;post-application comments&rdquo; box stays open,
          for anything you need to tell the department later. Your home page
          lists every application you have made and its status.
        </p>
        <p>
          If you have applied before, your most recent answers are copied into
          the new form, so you only need to update what has changed.
        </p>

        <h2 className="my-3 h4">What you will be asked for</h2>
        <p>You will be asked to provide the following information:</p>
        <ul data-testid="HelpTaApplicantsPage-asked-for">
          <li>Your name.</li>
          <li>
            Your major, whether you are a PhD or MS student, your year in the
            program, your GPA (in your major and overall), and your expected
            graduation date. All of these are required, except that if you are a
            first quarter grad student and do not yet have a grad GPA, you can
            check the box under the two GPA fields instead of entering them.
          </li>
          <li>
            Your residency status and your TA language exam status, both
            required; if you have passed the exam, the quarter and year you
            passed it is required too.
          </li>
          <li>
            A list of courses you have taken, at UCSB or elsewhere, that are
            relevant to your application to be a TA. UCSB CMPSC courses can be
            ticked off a list; others are entered by hand.
          </li>
          <li>
            A self-assessment of your level of proficiency, from 5 (highest) to
            1 (lowest), in a set of topic areas the department lists.
          </li>
          <li>
            Your previous teaching experience: as a TA (at UCSB or elsewhere),
            as an Undergraduate Learning Assistant (ULA), or anything else
            relevant.
          </li>
          <li>
            Your first and second choice courses (what you most want to TA for),
            chosen from the courses being recruited for that quarter.
          </li>
          <li>
            For every other course offered in the quarter you are applying for,
            your level of interest in that course: enthusiastic, would consider,
            or not applicable / not interested.
          </li>
          <li>
            Anything else you would like the department to know, such as a
            particular reason you want a certain course or professor.
          </li>
        </ul>
        <p>
          Before you submit, you will be shown the department&apos;s notices,
          terms and conditions for TA applications and asked to agree to them.
        </p>

        <p data-testid="HelpTaApplicantsPage-time-zone">
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

        <h2
          className="my-3 h4"
          data-testid="HelpTaApplicantsPage-simultaneous-editing"
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
          testId="HelpTaApplicantsPage-simultaneous-editing-example"
        />
        <p data-testid="HelpTaApplicantsPage-simultaneous-editing-meaning">
          <strong>What it means.</strong> The same draft is open somewhere else,
          in another tab or window of this browser or on another device. Both
          copies save to the same draft, so one copy can overwrite the
          other&apos;s changes. If you go on, the system will refuse a save from
          a copy that is out of date and ask you to reload, and what you typed
          in the old copy since then is lost.
        </p>
        <p data-testid="HelpTaApplicantsPage-simultaneous-editing-modal">
          <strong>The question.</strong> The tab or window you opened{" "}
          <em>last</em> also asks what you want to do, in a box that covers the
          form until you answer. The one you opened first only shows the
          warning, so that it never interrupts you while you are typing. The box
          says who already has the application open, such as &ldquo;You already
          have this application open for editing in another tab or
          window.&rdquo; It offers three choices:
        </p>
        <ul data-testid="HelpTaApplicantsPage-simultaneous-editing-choices">
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
        <p data-testid="HelpTaApplicantsPage-simultaneous-editing-todo">
          <strong>What to do.</strong> Close all the other tabs or windows, and
          keep just one. If the form asks you to reload, reload it to see the
          latest version of your draft. The warning goes away on its own within
          a few seconds after the other copies are closed, or in up to about
          twenty seconds if the other copy could not say that it was leaving,
          such as when a computer lost its network connection.
        </p>
        <p data-testid="HelpTaApplicantsPage-simultaneous-editing-refresh">
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
