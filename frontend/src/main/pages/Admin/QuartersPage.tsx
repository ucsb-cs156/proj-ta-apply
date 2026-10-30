import { useEffect, useRef, useState } from "react";
import { Form } from "react-bootstrap";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import QuarterCards from "main/components/Quarters/QuarterCards";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import {
  refreshSummary,
  type QuarterRefresh,
  type UcsbApiQuarter,
} from "main/utils/quarterCalendar";

/**
 * The UCSB quarter calendar on file: /admin/quarters (issue #151). Opening the page asks the
 * backend to bring the table up to date from the UCSB API first (from the latest quarter on file
 * through the current quarter plus one, or plus two in Spring), then lists every quarter as a
 * card, newest first unless the admin asks for oldest first.
 */
export default function QuartersPage(): React.JSX.Element {
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const [summary, setSummary] = useState<string | null>(null);

  const { data: quarters } = useBackend<UcsbApiQuarter[]>(
    ["/api/admin/quarters/all", direction],
    {
      method: "GET",
      url: "/api/admin/quarters/all",
      params: { direction },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const refreshMutation = useBackendMutation<void, QuarterRefresh>(
    () => ({ url: "/api/admin/quarters/refresh", method: "POST" }),
    {
      onSuccess: (refresh) => setSummary(refreshSummary(refresh, yyyyqToQyy)),
      onError: () =>
        toast(
          "Could not check UCSB for new quarters; showing what is on file.",
        ),
    },
    ["/api/admin/quarters/all"],
  );

  // Once, when the page opens; a ref rather than an empty dependency list, so React's strict-mode
  // double mount in development does not refresh twice.
  const refreshed = useRef(false);
  const refresh = refreshMutation.mutate;
  // Stryker disable all : the guard only matters under strict mode's double mount, which the
  // tests do not simulate; the dependency list cannot be told apart from an empty one either.
  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    refresh();
  }, [refresh]);
  // Stryker restore all

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Quarters</h1>
        <p>
          The UCSB quarter calendar as this app has it: one card per quarter,
          with the dates of its classes, finals, registration passes and
          deadlines, exactly as the UCSB API gives them. Opening this page
          checks UCSB for quarters newer than the latest on file, through the
          current quarter plus one (plus two during Spring); populating the
          Courses page saves the quarters of that range too.
        </p>
        <p className="text-muted small" data-testid="QuartersPage-summary">
          {summary ?? "Checking UCSB for new quarters…"}
        </p>
        <Form.Group controlId="quarters-direction" className="mb-3">
          <Form.Label>Sort</Form.Label>
          <Form.Select
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "desc" | "asc")
            }
            data-testid="QuartersPage-direction"
            style={{ width: "14em" }}
          >
            <option value="desc">Newest quarter first</option>
            <option value="asc">Oldest quarter first</option>
          </Form.Select>
        </Form.Group>
        <QuarterCards quarters={quarters ?? []} testIdPrefix="QuartersPage" />
      </div>
    </BasicLayout>
  );
}
