import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import { apiErrorMessage } from "main/utils/apiError";
import {
  FAKE_ESTIMATE_CHOICES,
  isValidFakeTarget,
  maxFakeTarget,
  type FakeEstimates,
} from "main/utils/fakeAllocations";

type FakeAllocationsModalProps = {
  recruitmentId: number | string;
  /** The recruitment's non-removed courses: the default target, and a third of the largest. */
  courseCount: number;
  onHide: () => void;
  testIdPrefix?: string;
};

/**
 * Developer Mode's Fake Hiring Targets and Allocations (issue #225): picks a hiring target and
 * where the enrollment estimates come from, then asks the backend to set the target, fill the
 * estimates, auto-allocate across the courses, and, if ticked, let each faculty member see the
 * allocations of their own courses. Mounted only while open.
 */
export default function FakeAllocationsModal({
  recruitmentId,
  courseCount,
  onHide,
  testIdPrefix = "FakeAllocationsModal",
}: FakeAllocationsModalProps): React.JSX.Element {
  const [target, setTarget] = useState(String(Math.max(courseCount, 1)));
  const [estimates, setEstimates] = useState<FakeEstimates>("MAX");
  const [setVisibility, setSetVisibility] = useState(true);
  const queryClient = useQueryClient();
  const valid = isValidFakeTarget(target, courseCount);

  const fake = useMutation({
    mutationFn: () =>
      axios({
        url: "/api/admin/developer/fakeAllocations",
        method: "POST",
        params: {
          recruitmentId,
          hiringTarget: Number(target),
          estimates,
          setVisibility,
        },
      }),
    onSuccess: () => {
      toast(
        `Faked a hiring target of ${target} and allocated it across the courses.`,
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
        <Form.Group controlId={`${testIdPrefix}-target`} className="mb-3">
          <Form.Label>Hiring target</Form.Label>
          <Form.Control
            type="number"
            min={1}
            max={maxFakeTarget(courseCount)}
            step={1}
            size="sm"
            style={{ width: "7em" }}
            value={target}
            isInvalid={!valid}
            onChange={(event) => setTarget(event.target.value)}
            data-testid={`${testIdPrefix}-target`}
          />
          <Form.Control.Feedback type="invalid">
            Enter a whole number from 1 to {maxFakeTarget(courseCount)} (three
            per course).
          </Form.Control.Feedback>
        </Form.Group>
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
