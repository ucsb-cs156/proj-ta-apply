import { useState } from "react";
import { Form } from "react-bootstrap";
import { Link } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RecruitmentStepsDiagram from "main/components/Recruitments/RecruitmentStepsDiagram";
import { hasRole, useCurrentUser } from "main/utils/currentUser";
import { stepTitle, type RecruitmentType } from "main/utils/recruitmentSteps";
import { STEP_EXPLANATIONS } from "main/utils/recruitmentStepsHelp";

/**
 * Help → Recruitment Steps: /help/recruitment-steps (issue #232). The nine steps of a recruitment
 * drawn as a diagram of what must happen before what, with a sentence on each, for admins and
 * instructors. The diagram is the same component the recruitment cards show live.
 */
export default function HelpRecruitmentStepsPage(): React.JSX.Element {
  const [type, setType] = useState<RecruitmentType>("TA");
  const currentUser = useCurrentUser();
  // Help → For Admins is admin-only and For Instructors instructor-only, so each link is offered
  // only to someone who can open it.
  const isAdmin = hasRole(currentUser, "ROLE_ADMIN");
  const isInstructor = hasRole(currentUser, "ROLE_INSTRUCTOR");

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpRecruitmentStepsPage">
        <h1 className="my-4">Recruitment Steps</h1>
        <p>
          A recruitment is run in nine steps, once for TAs and once for ULAs
          each quarter. Some steps must happen before others; the diagram shows
          which.
        </p>
        <Form.Group
          className="mb-3"
          data-testid="HelpRecruitmentStepsPage-type"
        >
          <Form.Check
            inline
            type="radio"
            id="HelpRecruitmentStepsPage-type-TA"
            name="recruitment-type"
            label="TA recruitment"
            checked={type === "TA"}
            onChange={() => setType("TA")}
            data-testid="HelpRecruitmentStepsPage-type-TA"
          />
          <Form.Check
            inline
            type="radio"
            id="HelpRecruitmentStepsPage-type-ULA"
            name="recruitment-type"
            label="ULA recruitment"
            checked={type === "ULA"}
            onChange={() => setType("ULA")}
            data-testid="HelpRecruitmentStepsPage-type-ULA"
          />
        </Form.Group>
        <RecruitmentStepsDiagram
          type={type}
          testIdPrefix="HelpRecruitmentStepsPage-diagram"
        />
        <p className="mt-3" data-testid="HelpRecruitmentStepsPage-hard-soft">
          A <strong>solid</strong> arrow is a <em>hard</em> prerequisite: the
          step it points to cannot sensibly happen until the step it leaves has.
          A <strong>dashed</strong> arrow is a <em>soft</em> prerequisite: the
          preferred order, which is not enforced. Closing applications and
          closing faculty ranking, for example, are both hard prerequisites of
          releasing the hiring decisions.
        </p>
        <p data-testid="HelpRecruitmentStepsPage-footnote">
          <strong>*</strong> Allocation visibility has three settings: admins
          only (the default), each faculty member sees the allocations for the
          courses they teach, or all faculty see all allocations. Step 5 means
          moving off &ldquo;admins only&rdquo;; which of the other two to choose
          is up to the admin.
        </p>
        <h2 className="my-3 h4">The steps</h2>
        <ol data-testid="HelpRecruitmentStepsPage-steps">
          {STEP_EXPLANATIONS.map((step) => (
            <li
              key={step.number}
              data-testid={`HelpRecruitmentStepsPage-step-${step.number}`}
            >
              <strong>{stepTitle(type, step.number)}.</strong> {step.text}
              {isAdmin && (
                <>
                  {" "}
                  <Link
                    to={step.adminHref}
                    data-testid={`HelpRecruitmentStepsPage-step-${step.number}-link`}
                  >
                    More
                  </Link>
                </>
              )}
            </li>
          ))}
        </ol>
        <p data-testid="HelpRecruitmentStepsPage-feedback">
          <strong>Faculty feedback on targets.</strong> If a faculty member
          wants to ask for more TAs, fewer ULAs, or fewer TAs and more ULAs for
          their course, the time to say so is after step 5, once they can see
          the target, and before or during step 6, while the admin can still
          change the allocations.
        </p>
        <p data-testid="HelpRecruitmentStepsPage-live">
          Each recruitment card on an admin&apos;s home page shows this same
          diagram for that recruitment, with a check on each step that is done.
          More about the whole cycle is in{" "}
          {isAdmin ? (
            <Link to="/help/admins#flow">For Admins</Link>
          ) : (
            "For Admins"
          )}{" "}
          and{" "}
          {isInstructor ? (
            <Link to="/help/instructors">For Instructors</Link>
          ) : (
            "For Instructors"
          )}
          .
        </p>
      </div>
    </BasicLayout>
  );
}
