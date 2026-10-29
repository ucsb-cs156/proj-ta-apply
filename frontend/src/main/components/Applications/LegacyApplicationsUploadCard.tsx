import { useRef, useState } from "react";
import { Button, Card, Form, Modal } from "react-bootstrap";
import { Link } from "react-router";
import { toast } from "react-toastify";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { csvUploadAxiosParams } from "main/utils/csvUpload";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import {
  helpPath,
  importSummary,
  importUrl,
  listsToRefresh,
  quarterOptions,
  type ImportType,
  type LegacyImportResult,
} from "main/utils/legacyImport";

type LegacyApplicationsUploadCardProps = {
  /** TA: the legacy PHP app's export. ULA: the ULA Google Form's response sheet. */
  type?: ImportType;
  testIdPrefix?: string;
};

type Upload = { quarter: string; file: File };

/** What the card says, per form type. */
const WORDING = {
  TA: {
    title: "Import Legacy TA Applications",
    about:
      "Upload the old TA application's CSV export into one quarter's TA recruitment. Each row becomes an application as if the student had entered it, so their next application starts filled in with those answers. Rows for students who already have an application in that recruitment are skipped, so re-uploading is safe. Knowledge topics not yet on the TA topics list are added to it.",
    file: "Legacy CSV export",
    none: "There are no TA recruitments yet. Create one for the quarter under Admin > Recruitments first.",
    choose: "Choose the TA recruitment's quarter",
    modalTitle: "Topics added to the TA topics list",
    modalAbout:
      "The imported applications rated these topics, which were not on the TA topics list, so the import added them. The Topics List for TAs card above shows them now; rename or remove any you do not want.",
  },
  ULA: {
    title: "Import ULA Form Responses",
    about:
      "Upload the ULA application Google Form's response sheet, downloaded as CSV, into one quarter's ULA recruitment. Each row becomes an application as if the student had entered it, so their next application starts filled in with those answers. Rows for students who already have an application in that recruitment are skipped, so re-uploading is safe. Familiarity topics and activities not yet on the ULA lists are added to them.",
    file: "Form responses CSV",
    none: "There are no ULA recruitments yet. Create one for the quarter under Admin > Recruitments first.",
    choose: "Choose the ULA recruitment's quarter",
    modalTitle: "Added to the ULA lists",
    modalAbout:
      "The imported applications rated these, which were not on the ULA topics or interests lists, so the import added them. The cards above show them now; rename or remove any you do not want.",
  },
};

/**
 * Import a past recruitment's applications from a file, so students who applied before find their
 * answers already filled in next time. The admin picks the quarter (one of the recruitments of
 * the form's type that exist) and the file; the backend matches the file's columns to the new
 * form's fields as well as it can.
 */
export default function LegacyApplicationsUploadCard({
  type = "TA",
  testIdPrefix = "LegacyApplicationsUploadCard",
}: LegacyApplicationsUploadCardProps): React.JSX.Element {
  const words = WORDING[type];
  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const options = quarterOptions(recruitments ?? [], type);

  const [quarter, setQuarter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // What the last import added to the admin lists, shown in a modal until dismissed.
  const [added, setAdded] = useState<{ topics: string[]; interests: string[] }>(
    { topics: [], interests: [] },
  );
  // So the file box can be emptied after an import; a file input cannot be controlled.
  const fileInput = useRef<HTMLInputElement>(null);

  const uploadMutation = useBackendMutation<Upload, LegacyImportResult>(
    (upload) => ({
      ...csvUploadAxiosParams(importUrl(type), upload.file),
      params: { quarter: upload.quarter },
    }),
    {
      onSuccess: (result) => {
        toast(importSummary(result));
        setAdded({
          topics: result.addedTopics,
          interests: result.addedInterests ?? [],
        });
        setFile(null);
        // Stryker disable next-line all : the input is always mounted when an upload succeeds
        if (fileInput.current) fileInput.current.value = "";
      },
    },
    ["/api/admin/applications/all", ...listsToRefresh(type)],
  );

  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const dismiss = () => setAdded({ topics: [], interests: [] });
  const showModal = added.topics.length > 0 || added.interests.length > 0;

  return (
    <Card className="mb-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        {words.title}
      </Card.Header>
      <Card.Body>
        <p className="text-muted small" data-testid={id("about")}>
          {words.about}{" "}
          <Link to={helpPath(type)} data-testid={id("help-link")}>
            CSV format details
          </Link>
        </p>
        {options.length === 0 ? (
          <p className="text-muted" data-testid={id("none")}>
            {words.none}
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
                <option value="">{words.choose}</option>
                {options.map((option) => (
                  <option key={option.quarter} value={option.quarter}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2" controlId={id("file")}>
              <Form.Label>{words.file}</Form.Label>
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
      <Modal
        show={showModal}
        onHide={dismiss}
        centered={true}
        data-testid={id("added-topics-modal")}
      >
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">
            {words.modalTitle}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{words.modalAbout}</p>
          {added.topics.length > 0 && (
            <>
              {type === "ULA" && <h3 className="h6">Topics</h3>}
              <ul data-testid={id("added-topics")}>
                {added.topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </>
          )}
          {added.interests.length > 0 && (
            <>
              <h3 className="h6">Interests</h3>
              <ul data-testid={id("added-interests")}>
                {added.interests.map((interest) => (
                  <li key={interest}>{interest}</li>
                ))}
              </ul>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={dismiss}
            data-testid={id("added-topics-dismiss")}
          >
            Dismiss
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
