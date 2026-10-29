import { useRef, useState } from "react";
import { Button, Card, Form } from "react-bootstrap";
import { Link } from "react-router";
import { toast } from "react-toastify";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { csvUploadAxiosParams } from "main/utils/csvUpload";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import {
  LEGACY_CSV_HELP_PATH,
  LEGACY_IMPORT_URL,
  importSummary,
  taQuarterOptions,
  type LegacyImportResult,
} from "main/utils/legacyImport";

type LegacyApplicationsUploadCardProps = {
  testIdPrefix?: string;
};

type Upload = { quarter: string; file: File };

/**
 * Import the legacy PHP app's CSV export into a TA recruitment, so students who applied before
 * find their answers already filled in next time. The admin picks the quarter (one of the TA
 * recruitments that exist) and the file; the backend matches the legacy columns to the new form's
 * fields as well as it can.
 */
export default function LegacyApplicationsUploadCard({
  testIdPrefix = "LegacyApplicationsUploadCard",
}: LegacyApplicationsUploadCardProps): React.JSX.Element {
  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const options = taQuarterOptions(recruitments ?? []);

  const [quarter, setQuarter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // So the file box can be emptied after an import; a file input cannot be controlled.
  const fileInput = useRef<HTMLInputElement>(null);

  const uploadMutation = useBackendMutation<Upload, LegacyImportResult>(
    (upload) => ({
      ...csvUploadAxiosParams(LEGACY_IMPORT_URL, upload.file),
      params: { quarter: upload.quarter },
    }),
    {
      onSuccess: (result) => {
        toast(importSummary(result));
        setFile(null);
        // Stryker disable next-line all : the input is always mounted when an upload succeeds
        if (fileInput.current) fileInput.current.value = "";
      },
    },
    ["/api/admin/applications/all"],
  );

  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;

  return (
    <Card className="mb-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        Import Legacy TA Applications
      </Card.Header>
      <Card.Body>
        <p className="text-muted small" data-testid={id("about")}>
          Upload the old TA application&apos;s CSV export into one
          quarter&apos;s TA recruitment. Each row becomes an application as if
          the student had entered it, so their next application starts filled in
          with those answers. Rows for students who already have an application
          in that recruitment are skipped, so re-uploading is safe.{" "}
          <Link to={LEGACY_CSV_HELP_PATH} data-testid={id("help-link")}>
            CSV format details
          </Link>
        </p>
        {options.length === 0 ? (
          <p className="text-muted" data-testid={id("none")}>
            There are no TA recruitments yet. Create one for the quarter under
            Admin &gt; Recruitments first.
          </p>
        ) : (
          <Form
            onSubmit={(e) => {
              // Stryker disable next-line all : without this jsdom has no page to navigate to,
              // so there is nothing a test could observe
              e.preventDefault();
              // The Import button is disabled until both are chosen, which also blocks Enter.
              uploadMutation.mutate({ quarter, file: file as File });
            }}
          >
            <Form.Group className="mb-2" controlId={id("quarter")}>
              <Form.Label>Quarter</Form.Label>
              <Form.Select
                size="sm"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                data-testid={id("quarter")}
              >
                <option value="">
                  Choose the TA recruitment&apos;s quarter
                </option>
                {options.map((option) => (
                  <option key={option.quarter} value={option.quarter}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2" controlId={id("file")}>
              <Form.Label>Legacy CSV export</Form.Label>
              <Form.Control
                ref={fileInput}
                size="sm"
                type="file"
                accept=".csv"
                data-testid={id("file")}
                onChange={(e) =>
                  setFile(
                    // Stryker disable next-line all : a file input's files list is never null
                    (e.target as HTMLInputElement).files?.[0] ?? null,
                  )
                }
              />
            </Form.Group>
            <Button
              type="submit"
              size="sm"
              variant="outline-primary"
              data-testid={id("button")}
              disabled={quarter === "" || file === null}
            >
              Import
            </Button>
          </Form>
        )}
      </Card.Body>
    </Card>
  );
}
