import BasicLayout from "main/layouts/BasicLayout/BasicLayout";

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
          recruitment is open it shows an <strong>Apply</strong> link; before
          one opens it shows the tentative opening date; and when none is open,
          that applications are not currently being accepted. Sign in with your
          UCSB Google account to see it.
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
            graduation date. All of these are required.
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

        <h2 className="my-3 h4">Tips</h2>
        <ul>
          <li>
            Fields marked with a red asterisk are required. If anything is
            missing when you submit, the form lists what is missing and each
            entry jumps to the field.
          </li>
          <li>
            Your answers are saved only when you submit; you can come back and
            submit again at any time before the primary consideration date.
          </li>
        </ul>
      </div>
    </BasicLayout>
  );
}
