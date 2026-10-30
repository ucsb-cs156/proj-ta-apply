import { useState } from "react";
import { Button } from "react-bootstrap";
import BulkUcsbCoursesModal from "main/components/PriorCoursework/BulkUcsbCoursesModal";
import PriorCourseworkModal from "main/components/PriorCoursework/PriorCourseworkModal";
import PriorCourseworkTable from "main/components/PriorCoursework/PriorCourseworkTable";
import RequiredField from "main/components/Common/RequiredField";
import {
  COURSEWORK_INSTRUCTIONS,
  MIN_COURSES,
  tooFewCoursesMessage,
  type PriorCourse,
} from "main/utils/priorCoursework";

type PriorCourseworkSectionProps = {
  type: "TA" | "ULA";
  courses: PriorCourse[];
  onChange: (courses: PriorCourse[]) => void;
  /** Set by the form after a submit attempt with too few courses. */
  invalid?: boolean;
  /** The subject area the course table holds, named on the bulk-add button. */
  subjectArea?: string;
  testIdPrefix?: string;
};

/**
 * The prior coursework part of an application form: the instruction for this form type, the table
 * of courses entered so far, an Add Course button, and the modal that adds or edits one; beside it,
 * a button for adding several UCSB courses at once from the course table (issue #100). The rows
 * live in the parent form's state and go to the backend with the rest of the application.
 */
export default function PriorCourseworkSection({
  type,
  courses,
  onChange,
  invalid = false,
  subjectArea = "CMPSC",
  testIdPrefix = "PriorCoursework",
}: PriorCourseworkSectionProps): React.JSX.Element {
  // null: modal closed; -1: adding; otherwise the index of the row being edited.
  const [editing, setEditing] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const list = Array.isArray(courses) ? courses : [];
  const minimum = MIN_COURSES[type];

  const save = (course: PriorCourse) => {
    if (editing === -1) {
      onChange([...list, course]);
    } else {
      onChange(list.map((row, index) => (index === editing ? course : row)));
    }
    setEditing(null);
  };

  return (
    <div data-testid={testIdPrefix}>
      <h2 className="h5 mt-3">
        Prior Coursework <RequiredField />
      </h2>
      <p className="text-muted small mb-2" data-testid={id("instructions")}>
        {COURSEWORK_INSTRUCTIONS[type]}
      </p>
      {list.length === 0 ? (
        <p className="text-muted small" data-testid={id("empty")}>
          No courses listed yet.
        </p>
      ) : (
        <PriorCourseworkTable
          courses={list}
          onEdit={(index) => setEditing(index)}
          onDelete={(index) =>
            onChange(list.filter((_, position) => position !== index))
          }
          testIdPrefix={id("table")}
        />
      )}
      <div className="d-flex align-items-center gap-3 mb-3">
        <Button
          variant="success"
          size="sm"
          // The id lets the application form's missing-data list scroll here (issue #97).
          id={id("add-button")}
          data-testid={id("add-button")}
          onClick={() => setEditing(-1)}
        >
          Add Course
        </Button>
        <Button
          variant="outline-success"
          size="sm"
          data-testid={id("bulk-button")}
          onClick={() => setBulkOpen(true)}
        >
          Add Multiple UCSB {subjectArea} Courses
        </Button>
        <span className="small" data-testid={id("count")}>
          {list.length} of at least {minimum} listed
        </span>
        {invalid && list.length < minimum && (
          <span className="text-danger small" data-testid={id("too-few")}>
            {tooFewCoursesMessage(type)}
          </span>
        )}
      </div>
      <PriorCourseworkModal
        show={editing !== null}
        // Stryker disable next-line all : closed (null) and adding (-1) both have no course
        course={list[editing ?? -1] ?? null}
        onSave={save}
        onCancel={() => setEditing(null)}
        testIdPrefix={id("modal")}
      />
      {/* Mounted only while open, so the course list is fetched only when it is wanted. */}
      {bulkOpen && (
        <BulkUcsbCoursesModal
          show
          subjectArea={subjectArea}
          onAdd={(added) => {
            onChange([...list, ...added]);
            setBulkOpen(false);
          }}
          onCancel={() => setBulkOpen(false)}
          testIdPrefix={id("bulk")}
        />
      )}
    </div>
  );
}
