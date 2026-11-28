import { useEffect, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { useMutation } from "@tanstack/react-query";
import type { Cell } from "@tanstack/react-table";
import axios from "axios";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import type { Assignments } from "main/utils/assignments";
import {
  type AutoAssignApplied,
  type AutoAssignMade,
  type AutoAssignPreview,
  type AutoAssignUndone,
  type ProposedRow,
  applicantNames,
  deadlinePending,
  lectureNames,
  madeCountText,
  needingWithoutRankings,
  notMadeSentence,
  notProposedRows,
  proposedRows,
} from "main/utils/autoAssign";
import { pacificTodayIso } from "main/utils/pacificTime";

type ProposeAssignmentsModalProps = {
  recruitmentId: number | string;
  /** The page as it stands: the names come from it, and an undo carries its version. */
  page: Assignments;
  /** The recruitment, once known: its ranking deadline and whether assignments are published. */
  recruitment?: Recruitment;
  /** The concurrency headers the page's own saves carry (the client id). */
  headers: Record<string, string>;
  /** Called with the assignments every answer carries, so the page shows them at once. */
  onUpdated: (assignments: Assignments) => void;
  /** Called with a failed request, for the page's usual handling (a 409 refreshes the page). */
  onError: (error: unknown) => void;
  onHide: () => void;
  testIdPrefix?: string;
};

/** What Proceed sends: the proposals still checked, and the version the preview was computed from. */
type Selection = { selected: AutoAssignMade[]; version: number };

/** What the Make column's boxes need, handed to them through the column's meta. */
type MakeColumnMeta = {
  checked: ReadonlySet<number>;
  onToggle: (applicationId: number, on: boolean) => void;
  testIdPrefix: string;
};

/**
 * The box of one proposed row. A component of its own, named once, so that React keeps the same
 * input across renders (a cell renderer written inline would be a new component type each time,
 * remounting the box and losing its focus on every toggle).
 */
function MakeCell({
  cell,
}: {
  cell: Cell<ProposedRow, unknown>;
}): React.JSX.Element {
  const meta = cell.column.columnDef.meta as MakeColumnMeta;
  const row = cell.row.original;
  return (
    <Form.Check
      type="checkbox"
      aria-label={`Make ${row.applicant} to ${row.lecture}`}
      checked={meta.checked.has(row.applicationId)}
      onChange={(event) =>
        meta.onToggle(row.applicationId, event.target.checked)
      }
      data-testid={`${meta.testIdPrefix}-row-${cell.row.index}-check`}
    />
  );
}

/**
 * Propose assignments (issue #515, the rule from #481). On opening it fetches the preview, which
 * changes nothing: every proposal in a table with a checked box, warnings when rankings may still
 * be arriving or assignments are published, and the lectures left unfilled with the reason.
 * Proceed makes exactly the checked proposals, with no re-planning, and ends on a small final step
 * with the count, anything the backend could not make, and Undo this run. Mounted only while open.
 */
export default function ProposeAssignmentsModal({
  recruitmentId,
  page,
  recruitment,
  headers,
  onUpdated,
  onError,
  onHide,
  // Stryker disable next-line all : only a default test id
  testIdPrefix = "ProposeAssignmentsModal",
}: ProposeAssignmentsModalProps): React.JSX.Element {
  const [preview, setPreview] = useState<AutoAssignPreview | null>(null);
  /** The applicants whose proposals are checked; a candidate is proposed at most once. */
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [applied, setApplied] = useState<AutoAssignApplied | null>(null);

  const fail = (error: unknown) => {
    onError(error);
    onHide();
  };

  const load = useMutation({
    mutationFn: () =>
      axios<AutoAssignPreview>({
        url: "/api/admin/assignments/auto/preview",
        // Stryker disable next-line all : GET is axios's default method
        method: "GET",
        params: { recruitmentId },
        headers,
      }),
    onSuccess: (response) => {
      setPreview(response.data);
      setChecked(new Set(response.data.made.map((m) => m.applicationId)));
    },
    onError: fail,
    retry: false,
  });
  // TanStack keeps `mutate` stable, so this runs once, when the modal opens.
  const { mutate: loadPreview } = load;
  // Stryker disable ArrayDeclaration : the deps only say when to run again; mutate is stable, so never
  useEffect(() => {
    loadPreview();
  }, [loadPreview]);
  // Stryker restore ArrayDeclaration

  const apply = useMutation({
    mutationFn: ({ selected, version }: Selection) =>
      axios<AutoAssignApplied>({
        url: "/api/admin/assignments/auto/apply",
        method: "POST",
        params: { recruitmentId, version },
        data: selected,
        headers,
      }),
    onSuccess: (response) => {
      onUpdated(response.data.assignments);
      toast(madeCountText(response.data.made.length));
      setApplied(response.data);
    },
    onError: fail,
    retry: false,
  });

  const undo = useMutation({
    mutationFn: (made: AutoAssignMade[]) =>
      axios<AutoAssignUndone>({
        url: "/api/admin/assignments/auto/undo",
        method: "POST",
        params: { recruitmentId, version: page.version },
        data: made,
        headers,
      }),
    onSuccess: (response) => {
      onUpdated(response.data.assignments);
      const n = response.data.cleared;
      toast(`Undid ${n} assignment${n === 1 ? "" : "s"}.`);
      onHide();
    },
    onError: fail,
    retry: false,
  });

  const lecture = lectureNames(page.courses);
  const applicant = applicantNames(page.rows);

  if (applied !== null) {
    return (
      <Modal
        show
        onHide={onHide}
        centered
        data-testid={`${testIdPrefix}-result-modal`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Assignments made</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p data-testid={`${testIdPrefix}-made-count`}>
            {madeCountText(applied.made.length)}
          </p>
          {applied.notMade.length > 0 && (
            <>
              <p data-testid={`${testIdPrefix}-not-made-intro`}>
                Not made, because the assignments changed since the preview:
              </p>
              <ul data-testid={`${testIdPrefix}-not-made`}>
                {applied.notMade.map((n, i) => (
                  <li
                    // Stryker disable next-line StringLiteral : React key property not exposed in dom
                    key={`${n.assignment.applicationId}-${n.assignment.recruitmentCourseId}`}
                    data-testid={`${testIdPrefix}-not-made-${i}`}
                  >
                    {notMadeSentence(n, lecture, applicant)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {applied.made.length > 0 && (
            <Button
              variant="outline-danger"
              onClick={() => undo.mutate(applied.made)}
              disabled={undo.isPending}
              data-testid={`${testIdPrefix}-undo`}
            >
              Undo this run
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onHide}
            data-testid={`${testIdPrefix}-close`}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  const unranked = needingWithoutRankings(page);
  const warnings: { id: string; text: string }[] = [];
  if (recruitment !== undefined) {
    if (
      deadlinePending(recruitment.facultyRankingDeadline, pacificTodayIso())
    ) {
      warnings.push({
        id: "deadline",
        text:
          recruitment.facultyRankingDeadline === null
            ? "No faculty ranking deadline is set, so rankings may still be arriving."
            : `The faculty ranking deadline (${recruitment.facultyRankingDeadline}) has not passed, so rankings may still be arriving.`,
      });
    }
    if (recruitment.assignmentsPublished === true) {
      warnings.push({
        id: "published",
        text: "Assignments are published: faculty will see these changes at once.",
      });
    }
  }
  if (unranked.length > 0) {
    warnings.push({
      id: "unranked",
      text: `${unranked.length === 1 ? "This lecture still needs assignments but has" : "These lectures still need assignments but have"} no rankings yet, so nothing can be proposed for ${unranked.length === 1 ? "it" : "them"} and a proposal now could hand ${unranked.length === 1 ? "its" : "their"} instructor's favourite to another lecture: ${unranked.map((course) => lecture(course.id)).join(", ")}.`,
    });
  }
  const warningsList = warnings.length > 0 && (
    <ul data-testid={`${testIdPrefix}-warnings`}>
      {warnings.map((warning) => (
        <li
          key={warning.id}
          className="text-danger"
          data-testid={`${testIdPrefix}-warning-${warning.id}`}
        >
          {warning.text}
        </li>
      ))}
    </ul>
  );

  if (preview === null) {
    return (
      <Modal
        show
        onHide={onHide}
        centered
        size="xl"
        data-testid={`${testIdPrefix}-modal`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Propose assignments</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {warningsList}
          <p data-testid={`${testIdPrefix}-loading`}>
            <Spinner
              animation="border"
              size="sm"
              role="status"
              className="me-2"
            />
            Working out the proposals…
          </p>
        </Modal.Body>
      </Modal>
    );
  }

  const proposed = proposedRows(preview.made, page);
  const notProposed = notProposedRows(preview.skipped, page);
  const selected = preview.made.filter((m) => checked.has(m.applicationId));

  const toggle = (applicationId: number, on: boolean) =>
    setChecked((before) => {
      const after = new Set(before);
      if (on) {
        after.add(applicationId);
      } else {
        after.delete(applicationId);
      }
      return after;
    });

  const proposedColumns: LegacyColumn[] = [
    {
      id: "check",
      header: "Make",
      // With no accessor TanStack gives the column nothing to sort by, so it does not sort.
      cell: MakeCell,
      meta: {
        checked,
        onToggle: toggle,
        testIdPrefix,
      } satisfies MakeColumnMeta,
    },
    { Header: "Applicant", accessor: "applicant" },
    { Header: "Lecture", accessor: "lecture" },
    { Header: "Rank", accessor: "rank" },
    { Header: "Preference", accessor: "preference" },
    { Header: "Pass", accessor: "pass" },
    // Issue #488: on a TA recruitment the PhD/CS rule is visible in the table.
    ...(page.type === "TA"
      ? [
          { Header: "Class Level", accessor: "classLevel" },
          { Header: "Major", accessor: "major" },
        ]
      : []),
  ];

  const notProposedColumns: LegacyColumn[] = [
    { Header: "Lecture", accessor: "lecture" },
    { Header: "Places left", accessor: "left" },
    { Header: "Reason", accessor: "reason" },
    { Header: "Candidate", accessor: "candidate" },
    { Header: "Also ranked by", accessor: "alsoRankedBy" },
  ];

  return (
    <Modal
      show
      onHide={onHide}
      centered
      size="xl"
      data-testid={`${testIdPrefix}-modal`}
    >
      <Modal.Header closeButton>
        <Modal.Title>Propose assignments</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {warningsList}
        {proposed.length === 0 ? (
          <p data-testid={`${testIdPrefix}-none`}>
            No no-conflict assignments can be proposed.
          </p>
        ) : (
          <>
            <div className="d-flex align-items-center flex-wrap gap-2">
              <span data-testid={`${testIdPrefix}-instruction`}>
                Uncheck any assignments you do not want to make in this round
              </span>
              <Button
                variant="link"
                size="sm"
                className="p-0"
                onClick={() =>
                  setChecked(new Set(proposed.map((p) => p.applicationId)))
                }
                data-testid={`${testIdPrefix}-select-all`}
              >
                Select All
              </Button>
              <Button
                variant="link"
                size="sm"
                className="p-0"
                onClick={() => setChecked(new Set())}
                data-testid={`${testIdPrefix}-select-none`}
              >
                Select None
              </Button>
            </div>
            {/* Unchecking changes the fixpoint; what is checked is made as it is, so the
                dependency is said and the Pass column shows it. */}
            <p
              className="text-muted small"
              data-testid={`${testIdPrefix}-passes-note`}
            >
              Later passes may depend on earlier ones: a proposal in pass 2 or
              later was found only after the pass-1 proposals were assumed made.
            </p>
          </>
        )}
        <div className="d-flex gap-2 mb-3">
          <Button
            variant="secondary"
            onClick={onHide}
            data-testid={`${testIdPrefix}-cancel`}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={selected.length === 0 || apply.isPending}
            onClick={() => apply.mutate({ selected, version: preview.version })}
            data-testid={`${testIdPrefix}-proceed`}
          >
            Proceed ({selected.length})
          </Button>
        </div>
        {proposed.length > 0 && (
          <>
            <h5 data-testid={`${testIdPrefix}-proposed-heading`}>
              Proposed assignments
            </h5>
            <div className="table-responsive">
              <OurTable
                data={proposed}
                columns={proposedColumns}
                testid={`${testIdPrefix}-proposed`}
                // The box in a row stays that row's box whatever the sort order.
                // Stryker disable next-line ArrowFunction : only which DOM node a box is kept in across a sort; its checked state is controlled either way
                getRowId={(row) => String(row.applicationId)}
              />
            </div>
          </>
        )}
        {notProposed.length === 0 ? (
          <p data-testid={`${testIdPrefix}-all-filled`}>
            No lecture has places left to fill.
          </p>
        ) : (
          <>
            <h5 data-testid={`${testIdPrefix}-skipped-heading`}>
              Not proposed
            </h5>
            <p data-testid={`${testIdPrefix}-skipped-intro`}>
              Lectures still to fill, and why nothing is proposed for them
              (these are the judgement calls):
            </p>
            <div className="table-responsive">
              <OurTable
                data={notProposed}
                columns={notProposedColumns}
                testid={`${testIdPrefix}-skipped`}
              />
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
