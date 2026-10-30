import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
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
          <strong>Apply</strong> link; before one opens it shows the tentative
          opening date; and when none is open, that applications are not
          currently being accepted. Sign in with your UCSB Google account to see
          it.
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
            you are applying for.
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
            whether your I-9 verification is already on file.
          </li>
          <li>
            For new ULAs, whether you can commit to the training offered at the
            start of the quarter.
          </li>
          <li>
            A list of courses you have taken, at UCSB or elsewhere, that are
            relevant to your application. UCSB CMPSC courses can be ticked off a
            list; others are entered by hand.
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
            triangle and asks you to explain, in the Anything Else box, what
            background prepares you to be a ULA for it; listing the course in
            your coursework clears the mark.
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
