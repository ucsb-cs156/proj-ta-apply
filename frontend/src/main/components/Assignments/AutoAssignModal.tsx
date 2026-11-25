import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import type { Assignments } from "main/utils/assignments";
import {
  AUTO_ASSIGN_LABEL,
  type AutoAssignMade,
  type AutoAssignOutcome,
  type AutoAssignUndone,
  applicantNames,
  deadlinePending,
  lectureNames,
  madeSentence,
  needingWithoutRankings,
  skippedSentence,
} from "main/utils/autoAssign";
import { pacificTodayIso } from "main/utils/pacificTime";

type AutoAssignModalProps = {
  recruitmentId: number | string;
  /** The page as it stands; the run carries its version, and the names come from it. */
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

/**
 * Automatically Assign No-Conflict Slots (issue #481). First a confirmation that says what the run
 * does and warns when rankings may still be arriving or assignments are already published; then,
 * once run, what it did (each assignment made, by pass) and why each lecture still to fill got
 * nothing, with Undo this run to clear exactly those assignments. Mounted only while open.
 */
export default function AutoAssignModal({
  recruitmentId,
  page,
  recruitment,
  headers,
  onUpdated,
  onError,
  onHide,
  // Stryker disable next-line all : only a default test id
  testIdPrefix = "AutoAssignModal",
}: AutoAssignModalProps): React.JSX.Element {
  const [outcome, setOutcome] = useState<AutoAssignOutcome | null>(null);

  const fail = (error: unknown) => {
    onError(error);
    onHide();
  };

  const run = useMutation({
    mutationFn: () =>
      axios<AutoAssignOutcome>({
        url: "/api/admin/assignments/auto",
        method: "POST",
        params: { recruitmentId, version: page.version },
        headers,
      }),
    onSuccess: (response) => {
      onUpdated(response.data.assignments);
      setOutcome(response.data);
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
      toast(`Undid ${n} automatic assignment${n === 1 ? "" : "s"}.`);
      onHide();
    },
    onError: fail,
    retry: false,
  });

  const lecture = lectureNames(page.courses);
  const applicant = applicantNames(page.rows);

  if (outcome !== null) {
    const { made, skipped } = outcome;
    return (
      <Modal
        show
        onHide={onHide}
        centered
        size="lg"
        data-testid={`${testIdPrefix}-result-modal`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Automatic assignment finished</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {made.length === 0 ? (
            <p data-testid={`${testIdPrefix}-none`}>
              No no-conflict slots found: nothing was assigned.
            </p>
          ) : (
            <>
              <p data-testid={`${testIdPrefix}-made-count`}>
                {made.length} assignment{made.length === 1 ? "" : "s"} made:
              </p>
              <ul data-testid={`${testIdPrefix}-made`}>
                {made.map((m, i) => (
                  <li
                    key={m.applicationId}
                    data-testid={`${testIdPrefix}-made-${i}`}
                  >
                    {madeSentence(m, lecture, applicant)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {skipped.length === 0 ? (
            <p data-testid={`${testIdPrefix}-all-filled`}>
              No lecture has places left to fill.
            </p>
          ) : (
            <>
              <p data-testid={`${testIdPrefix}-skipped-intro`}>
                Lectures still to fill, and why nothing was assigned to them
                (these are the judgement calls):
              </p>
              <ul data-testid={`${testIdPrefix}-skipped`}>
                {skipped.map((s, i) => (
                  <li
                    key={s.recruitmentCourseId}
                    data-testid={`${testIdPrefix}-skipped-${i}`}
                  >
                    {skippedSentence(s, lecture, applicant)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {made.length > 0 && (
            <Button
              variant="outline-danger"
              onClick={() => undo.mutate(made)}
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
      text: `${unranked.length === 1 ? "This lecture still needs assignments but has" : "These lectures still need assignments but have"} no rankings yet, so a run cannot fill ${unranked.length === 1 ? "it" : "them"} and could hand ${unranked.length === 1 ? "its" : "their"} instructor's favourite to another lecture: ${unranked.map((course) => lecture(course.id)).join(", ")}.`,
    });
  }

  return (
    <Modal show onHide={onHide} centered data-testid={`${testIdPrefix}-modal`}>
      <Modal.Header closeButton>
        <Modal.Title>{AUTO_ASSIGN_LABEL}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p data-testid={`${testIdPrefix}-explanation`}>
          Fills every place where there is one clear choice. A lecture that
          still has places to fill gets its highest-ranked unassigned candidate
          when that candidate is enthusiastic about the course (1st Choice, 2nd
          Choice or Enthusiastic) and no other lecture that still has places to
          fill has ranked them at all. This repeats until no more such
          assignments can be made. Applicants marked Not Hired take no part.
          Nothing already assigned is changed, and the run can be undone
          afterwards.
        </p>
        {warnings.length > 0 && (
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
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onHide}
          data-testid={`${testIdPrefix}-cancel`}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => run.mutate()}
          disabled={run.isPending}
          data-testid={`${testIdPrefix}-run`}
        >
          Assign
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
