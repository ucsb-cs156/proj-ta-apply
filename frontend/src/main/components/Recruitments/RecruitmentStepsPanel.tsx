import { useState } from "react";
import { Button } from "react-bootstrap";
import RecruitmentStepsDiagram from "main/components/Recruitments/RecruitmentStepsDiagram";
import {
  stepsSummary,
  type RecruitmentStepAction,
  type RecruitmentStepsData,
} from "main/utils/recruitmentSteps";

type RecruitmentStepsPanelProps = {
  steps: RecruitmentStepsData;
  /** Open on first render; the design expands the most recent TA and ULA recruitments. */
  defaultExpanded?: boolean;
  onAction?: (action: RecruitmentStepAction) => void;
  onNavigate?: (href: string) => void;
  testIdPrefix?: string;
};

/**
 * The live Recruitment Steps diagram in a collapsible panel for the admin recruitment card
 * (docs/design/AdminUserInterfaceDesign.md). Collapsed, it is one line saying where the
 * recruitment is ("Step 6 of 9: Open Faculty Ranking", or "All 9 steps done") with a button to
 * show the diagram; expanded, the diagram with a button to hide it again.
 */
export default function RecruitmentStepsPanel({
  steps,
  defaultExpanded = false,
  onAction,
  onNavigate,
  testIdPrefix = "RecruitmentStepsPanel",
}: RecruitmentStepsPanelProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const summary = stepsSummary(steps);
  return (
    <div className="mb-2" data-testid={testIdPrefix}>
      <div className="d-flex align-items-center gap-2">
        <strong data-testid={`${testIdPrefix}-summary`}>{summary}</strong>
        <Button
          variant="link"
          size="sm"
          className="p-0"
          aria-expanded={expanded}
          onClick={() => setExpanded((previous) => !previous)}
          data-testid={`${testIdPrefix}-toggle`}
        >
          {expanded ? "Hide steps" : "Show steps"}
        </Button>
      </div>
      {expanded && (
        <div className="mt-2" data-testid={`${testIdPrefix}-diagram`}>
          <RecruitmentStepsDiagram
            type={steps.type}
            steps={steps}
            onAction={onAction}
            onNavigate={onNavigate}
            testIdPrefix={`${testIdPrefix}-steps`}
          />
        </div>
      )}
    </div>
  );
}
