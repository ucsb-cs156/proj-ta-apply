import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import { apiErrorMessage } from "main/utils/apiError";
import {
  FAKE_ESTIMATE_CHOICES,
  fakeAllocationsMessage,
  fakeTargetLabel,
  isValidFakeTarget,
  maxFakeTarget,
  type FakeAllocationsRecruitment,
  type FakeEstimates,
} from "main/utils/fakeAllocations";

type FakeAllocationsModalProps = {
  /**
   * The recruitments to fake, each with a box for its hiring target: one on a recruitment's own
   * Courses page, the quarter's TA and ULA recruitments on the Combined Allocation page (issue
   * #358). The estimate source and the visibility box apply to all of them.
   */
  recruitments: FakeAllocationsRecruitment[];
  onHide: () => void;
  testIdPrefix?: string;
};

const keyOf = (recruitmentId: number | string) => String(recruitmentId);

/**
 * Developer Mode's Fake Hiring Targets and Allocations (issue #225): picks a hiring target and
 * where the enrollment estimates come from, then asks the backend to set the target, fill the
 * estimates, auto-allocate across the courses, and, if ticked, let each faculty member see the
 * allocations of their own courses. With several recruitments, one request each, in one click.
 * Mounted only while open.
 */
export default function FakeAllocationsModal({
  recruitments,
  onHide,
  testIdPrefix = "FakeAllocationsModal",
}: FakeAllocationsModalProps): React.JSX.Element {
  const [targets, setTargets] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      recruitments.map((r) => [
        keyOf(r.recruitmentId),
        String(Math.max(r.courseCount, 1)),
      ]),
    ),
  );
  const [estimates, setEstimates] = useState<FakeEstimates>("MAX");
  const [setVisibility, setSetVisibility] = useState(true);
  const queryClient = useQueryClient();
  const targetOf = (r: FakeAllocationsRecruitment) =>
    targets[keyOf(r.recruitmentId)];
  const valid = recruitments.every((r) =>
    isValidFakeTarget(targetOf(r), r.courseCount),
  );

  const fake = useMutation({
    mutationFn: () =>
      Promise.all(
        recruitments.map((r) =>
          axios({
            url: "/api/admin/developer/fakeAllocations",
            method: "POST",
            params: {
              recruitmentId: r.recruitmentId,
              hiringTarget: Number(targetOf(r)),
              estimates,
              setVisibility,
            },
          }),
        ),
      ),
    onSuccess: () => {
      toast(
        fakeAllocationsMessage(
          recruitments.map((r) => ({ type: r.type, target: targetOf(r) })),
        ),
      );
      onHide();
    },
    onError: (error) =>
      toast(`Could not fake the allocations: ${apiErrorMessage(error)}`),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/recruitmentcourses/all"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/recruitments/all"],
      });
      // The budget summary carries each recruitment's hiring target (issue #358).
      queryClient.invalidateQueries({ queryKey: ["/api/admin/budget"] });
    },
    retry: false,
  });

  return (
    <Modal show onHide={onHide} centered data-testid={`${testIdPrefix}-modal`}>
      <Modal.Header closeButton>
        <Modal.Title>Fake Hiring Targets and Allocations</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Sets the hiring target, fills in the enrollment estimates, and
          auto-allocates the target across the courses, as you would by hand.
        </p>
        {recruitments.map((r) => {
          const id = `${testIdPrefix}-target-${keyOf(r.recruitmentId)}`;
          return (
            <Form.Group controlId={id} className="mb-3" key={id}>
              <Form.Label>{fakeTargetLabel(r.type)}</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={maxFakeTarget(r.courseCount)}
                step={1}
                size="sm"
                style={{ width: "7em" }}
                value={targetOf(r)}
                isInvalid={!isValidFakeTarget(targetOf(r), r.courseCount)}
                onChange={(event) =>
                  setTargets((previous) => ({
                    ...previous,
                    [keyOf(r.recruitmentId)]: event.target.value,
                  }))
                }
                data-testid={id}
              />
              <Form.Control.Feedback type="invalid">
                Enter a whole number from 1 to {maxFakeTarget(r.courseCount)}{" "}
                (three per course).
              </Form.Control.Feedback>
            </Form.Group>
          );
        })}
        <Form.Group className="mb-3" data-testid={`${testIdPrefix}-estimates`}>
          <Form.Label>Enrollment estimates</Form.Label>
          {FAKE_ESTIMATE_CHOICES.map((choice) => (
            <Form.Check
              key={choice.value}
              type="radio"
              name={`${testIdPrefix}-estimates`}
              id={`${testIdPrefix}-estimates-${choice.value}`}
              label={choice.label}
              checked={estimates === choice.value}
              onChange={() => setEstimates(choice.value)}
              data-testid={`${testIdPrefix}-estimates-${choice.value}`}
            />
          ))}
        </Form.Group>
        <Form.Check
          type="checkbox"
          id={`${testIdPrefix}-visibility`}
          label="Let each faculty member see the allocations for their own courses"
          checked={setVisibility}
          onChange={(event) => setSetVisibility(event.target.checked)}
          data-testid={`${testIdPrefix}-visibility`}
        />
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
          variant="success"
          disabled={!valid || fake.isPending}
          onClick={() => fake.mutate()}
          data-testid={`${testIdPrefix}-fake`}
        >
          Fake Targets and Allocations
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
