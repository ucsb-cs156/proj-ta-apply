import { useRef, useState } from "react";
import { Button, Card, Form, InputGroup, Table } from "react-bootstrap";
import { Link } from "react-router";
import { toast } from "react-toastify";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { csvUploadAxiosParams } from "main/utils/csvUpload";
import {
  CSV_HELP_PATH,
  csvDownloadUrl,
  csvUploadUrl,
  uploadSummary,
  type NameListUploadResult,
} from "main/utils/appSettingsCsv";

/** One row of any of the admin-maintained name lists. */
export type NameItem = { name: string };

/** The five lists the backend serves under /api/admin/settings/{list}. */
export type NameListKey =
  "ta-majors" | "ta-topics" | "ula-majors" | "ula-topics" | "ula-interests";

type NameListCardProps = {
  /** Card heading, e.g. "Majors List for TAs". */
  title: string;
  /** What one entry is called, e.g. "major"; used in labels and placeholders. */
  itemLabel: string;
  listKey: NameListKey;
  testIdPrefix?: string;
};

type Edit = { name: string; newName: string };

/**
 * A card holding one name list with full CRUD: the names in a table, an add form at the bottom,
 * and inline rename / delete on each row. Each list is a single-column table whose column is the
 * key, so a rename is a PUT with the old and new names rather than an id.
 *
 * <p>Below that, CSV download and upload in one shared shape, so an admin can set a list up on a
 * QA site and move it whole to production.
 */
export default function NameListCard({
  title,
  itemLabel,
  listKey,
  testIdPrefix = "NameListCard",
}: NameListCardProps): React.JSX.Element {
  const getEndpoint = `/api/admin/settings/${listKey}/all`;

  const { data: items } = useBackend<NameItem[]>(
    [getEndpoint],
    { method: "GET", url: getEndpoint },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const [newName, setNewName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  // So the file box can be emptied after an upload; a file input cannot be controlled.
  const fileInput = useRef<HTMLInputElement>(null);
  // The one row being renamed, if any; its current text lives here until Save.
  const [editing, setEditing] = useState<Edit | null>(null);

  const addMutation = useBackendMutation<string, NameItem>(
    (name) => ({
      url: `/api/admin/settings/${listKey}/post`,
      method: "POST",
      params: { name },
    }),
    {
      onSuccess: (saved) => {
        toast(`${saved.name} added`);
        setNewName("");
      },
    },
    [getEndpoint],
  );

  const renameMutation = useBackendMutation<Edit, NameItem>(
    (edit) => ({
      url: `/api/admin/settings/${listKey}`,
      method: "PUT",
      params: { name: edit.name, newName: edit.newName },
    }),
    {
      onSuccess: (saved) => {
        toast(`Renamed to ${saved.name}`);
        setEditing(null);
      },
    },
    [getEndpoint],
  );

  const uploadMutation = useBackendMutation<File, NameListUploadResult>(
    (file) => csvUploadAxiosParams(csvUploadUrl(listKey), file),
    {
      onSuccess: (result) => {
        toast(uploadSummary(result));
        setCsvFile(null);
        // Stryker disable next-line all : the input is always mounted when an upload succeeds
        if (fileInput.current) fileInput.current.value = "";
      },
    },
    [getEndpoint],
  );

  const deleteMutation = useBackendMutation<string, { message: string }>(
    (name) => ({
      url: `/api/admin/settings/${listKey}/delete`,
      method: "DELETE",
      params: { name },
    }),
    { onSuccess: (result) => toast(result.message) },
    [getEndpoint],
  );

  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;

  // Stryker disable next-line all : don't test default value of empty list
  const list = Array.isArray(items) ? items : [];

  // A plain table rather than OurTable: OurTable rebuilds its cell components on every render,
  // which would remount the rename input (and drop focus) on each keystroke. The lists are short
  // and arrive sorted, so nothing is lost.
  const row = (item: NameItem, index: number) => {
    const { name } = item;
    const rowId = `row-${index}`;
    const isEditing = editing?.name === name;
    return (
      <tr key={name} data-testid={id(`table-row-${index}`)}>
        <td
          style={{ width: "100%" }}
          data-testid={id(`table-cell-${rowId}-col-name`)}
        >
          {isEditing ? (
            <Form.Control
              size="sm"
              aria-label={`New name for ${name}`}
              data-testid={id(`${rowId}-edit-input`)}
              value={editing.newName}
              onChange={(e) => setEditing({ name, newName: e.target.value })}
            />
          ) : (
            name
          )}
        </td>
        <td style={{ width: "1%", whiteSpace: "nowrap" }}>
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="primary"
                className="me-1"
                data-testid={id(`${rowId}-save-button`)}
                disabled={editing.newName.trim() === ""}
                onClick={() =>
                  renameMutation.mutate({
                    name,
                    newName: editing.newName.trim(),
                  })
                }
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                data-testid={id(`${rowId}-cancel-button`)}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline-primary"
                className="me-1"
                data-testid={id(`${rowId}-edit-button`)}
                onClick={() => setEditing({ name, newName: name })}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="danger"
                data-testid={id(`${rowId}-delete-button`)}
                onClick={() => deleteMutation.mutate(name)}
              >
                Delete
              </Button>
            </>
          )}
        </td>
      </tr>
    );
  };

  return (
    <Card className="mb-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        {title}
      </Card.Header>
      <Card.Body>
        {list.length === 0 ? (
          <p className="text-muted" data-testid={id("empty")}>
            No {itemLabel}s yet. Add the first one below.
          </p>
        ) : (
          <Table striped bordered size="sm" data-testid={id("table")}>
            <thead>
              <tr>
                <th>Name</th>
                <th></th>
              </tr>
            </thead>
            <tbody>{list.map(row)}</tbody>
          </Table>
        )}
        <Form
          onSubmit={(e) => {
            // Stryker disable next-line all : without this jsdom has no page to navigate to, so
            // there is nothing a test could observe
            e.preventDefault();
            // No blank check here: the Add button is the form's only submit button and is
            // disabled while the box is blank, which also blocks Enter from submitting.
            addMutation.mutate(newName.trim());
          }}
        >
          <InputGroup>
            <Form.Control
              aria-label={`New ${itemLabel}`}
              placeholder={`New ${itemLabel}`}
              data-testid={id("add-input")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button
              type="submit"
              variant="success"
              data-testid={id("add-button")}
              disabled={newName.trim() === ""}
            >
              Add
            </Button>
          </InputGroup>
        </Form>

        <hr />
        <h3 className="h6">CSV download / upload</h3>
        <p className="text-muted small mb-2">
          One column, <code>name</code>, with a header row; the download and the
          upload use the same shape.{" "}
          <Link to={CSV_HELP_PATH} data-testid={id("csv-help-link")}>
            CSV format details
          </Link>
        </p>
        <a
          className="btn btn-outline-secondary btn-sm mb-3"
          href={csvDownloadUrl(listKey)}
          download={`${listKey}.csv`}
          data-testid={id("csv-download-link")}
        >
          Download CSV
        </a>
        <Form
          onSubmit={(e) => {
            // Stryker disable next-line all : without this jsdom has no page to navigate to, so
            // there is nothing a test could observe
            e.preventDefault();
            // The Upload button is disabled until a file is chosen, which also blocks Enter.
            uploadMutation.mutate(csvFile as File);
          }}
        >
          <InputGroup size="sm">
            <Form.Control
              ref={fileInput}
              type="file"
              accept=".csv"
              aria-label={`Upload ${itemLabel}s from a CSV file`}
              data-testid={id("csv-upload-input")}
              onChange={(e) =>
                setCsvFile(
                  // Stryker disable next-line all : a file input's files list is never null
                  (e.target as HTMLInputElement).files?.[0] ?? null,
                )
              }
            />
            <Button
              type="submit"
              variant="outline-primary"
              data-testid={id("csv-upload-button")}
              disabled={csvFile === null}
            >
              Upload CSV
            </Button>
          </InputGroup>
        </Form>
      </Card.Body>
    </Card>
  );
}
