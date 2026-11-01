import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { apiErrorMessage } from "main/utils/apiError";
import {
  nextNonSummerQuarter,
  planAutoCreate,
  selectableQuarters,
  type AutoCreatePlan,
} from "main/utils/autoCreateRecruitments";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

type AutoCreateRecruitmentsModalProps = {
  recruitments: Recruitment[];
  onHide: () => void;
  /** Injected so tests and stories can fix the date; defaults to now. */
  today?: Date;
  testIdPrefix?: string;
};

/** One line of the plan: what will, or will not, be created for a type. */
const planLine = (type: "TA" | "ULA", exists: boolean, qyy: string): string =>
  exists
    ? `A ${type} recruitment for ${qyy} already exists; it will not be created.`
    : `A ${type} recruitment for ${qyy} will be created.`;

/**
 * The plan for the developer-mode Auto Create Recruitments button (issue #218): the quarter (the
 * next one that is not Summer, unless the admin picks another), what would be created for it, and
 * the dates the new recruitments get. Creating calls the ordinary create endpoint once for each
 * recruitment that does not exist yet, exactly as creating one by hand does, so the course lists
 * fill in the usual way. Mounted only while open.
 */
export default function AutoCreateRecruitmentsModal({
  recruitments,
  onHide,
  today = new Date(),
  testIdPrefix = "AutoCreateRecruitmentsModal",
}: AutoCreateRecruitmentsModalProps): React.JSX.Element {
  const [quarter, setQuarter] = useState(() => nextNonSummerQuarter(today));
  const queryClient = useQueryClient();
  const plan: AutoCreatePlan = planAutoCreate(recruitments, quarter, today);

  const create = useMutation({
    mutationFn: async (toCreate: AutoCreatePlan) => {
      // One at a time, so a failure on the second leaves the first created and visible.
      for (const type of ["TA", "ULA"] as const) {
        if (type === "TA" ? toCreate.taExists : toCreate.ulaExists) continue;
        await axios({
          url: "/api/admin/recruitments/post",
          method: "POST",
          params: {
            quarter: toCreate.quarter,
            type,
            tentativeOpeningDate: toCreate.tentativeOpeningDate,
            primaryConsiderationDate: toCreate.primaryConsiderationDate,
          },
        });
      }
    },
    onSuccess: (_data, toCreate) => {
      toast(
        `Recruitments created for ${toCreate.qyy}. Their course lists are being filled; watch the Developer > Jobs page.`,
      );
      onHide();
    },
    onError: (error) =>
      toast(`Could not create the recruitments: ${apiErrorMessage(error)}`),
    // Whatever was created is on the list now, success or not.
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/recruitments/all"],
      }),
    retry: false,
  });

  return (
    <Modal show onHide={onHide} centered data-testid={`${testIdPrefix}-modal`}>
      <Modal.Header closeButton>
        <Modal.Title>Auto Create Recruitments</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group controlId={`${testIdPrefix}-quarter`} className="mb-3">
          <Form.Label>Quarter</Form.Label>
          <Form.Select
            value={quarter}
            onChange={(event) => setQuarter(event.target.value)}
            style={{ width: "8em" }}
            data-testid={`${testIdPrefix}-quarter`}
          >
            {selectableQuarters(today).map((q) => (
              <option key={q} value={q}>
                {yyyyqToQyy(q)}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <div data-testid={`${testIdPrefix}-plan`}>
          {plan.nothingToCreate ? (
            <p data-testid={`${testIdPrefix}-nothing`}>
              A TA and a ULA recruitment for {plan.qyy} already exist, so there
              is nothing to create.
            </p>
          ) : (
            <>
              <p data-testid={`${testIdPrefix}-ta`}>
                {planLine("TA", plan.taExists, plan.qyy)}
              </p>
              <p data-testid={`${testIdPrefix}-ula`}>
                {planLine("ULA", plan.ulaExists, plan.qyy)}
              </p>
              <p className="mb-0" data-testid={`${testIdPrefix}-dates`}>
                Tentative opening date: {plan.tentativeOpeningDate}. <br />
                Primary consideration date: {plan.primaryConsiderationDate}.
              </p>
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onHide}
          data-testid={`${testIdPrefix}-cancel`}
        >
          Cancel
        </Button>
        {!plan.nothingToCreate && (
          <Button
            variant="success"
            disabled={create.isPending}
            onClick={() => create.mutate(plan)}
            data-testid={`${testIdPrefix}-create`}
          >
            Create Recruitments
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
