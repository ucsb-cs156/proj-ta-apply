import { Fragment } from "react";
import { Form, Table } from "react-bootstrap";
import { WarningIcon } from "main/components/Common/Icons";
import {
  COURSE_INTEREST_OPTIONS,
  scaleHeadingWords,
  type CourseInterestValue,
  type ScaleLevel,
} from "main/utils/applicationFields";
import {
  CHOICE_CELL_CLASS,
  COURSE_LABEL_CELL_CLASS,
  LABEL_CELL_CLASS,
  READ_ONLY_SELECTION_TABLE_CLASS,
  SELECTION_TABLE_CLASS,
} from "main/utils/formTableLayout";
import { UNTAKEN_EXPLANATION, UNTAKEN_TITLE } from "main/utils/untakenCourses";

/*
 * The application's selection tables (issue #443): one row per topic, interest or course and one
 * column of radio buttons per answer. The form passes onChange and the applicant picks answers;
 * the application summary leaves it out, and the same table shows the answers with the radio
 * buttons disabled, so faculty read an application laid out as the applicant filled it in.
 */

const tableClass = (readOnly: boolean): string =>
  readOnly
    ? `${SELECTION_TABLE_CLASS} ${READ_ONLY_SELECTION_TABLE_CLASS}`
    : SELECTION_TABLE_CLASS;

/**
 * A scale level's column heading: the number, then each word of its wording on a line of its own
 * ("1" over "Very" over "comfortable"). The space before each break keeps the heading's text whole
 * for screen readers and tests.
 */
function ScaleHeading({ level }: { level: ScaleLevel }): React.JSX.Element {
  return (
    <>
      {level.value}
      {scaleHeadingWords(level).map((word, i) => (
        <Fragment key={i}>
          {" "}
          <br />
          {word}
        </Fragment>
      ))}
    </>
  );
}

/**
 * A course answer's column heading, with a line break after each " / " so that "Not Applicable /
 * Not Interested" sits on two lines, the slash ending the first. The space before each break keeps
 * the heading's text whole for screen readers and tests.
 */
function OptionHeading({ label }: { label: string }): React.JSX.Element {
  return (
    <>
      {label.split(" / ").map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              {" /"} <br />
            </>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}

type LevelTableProps = {
  /** The label column's heading: "Topic" or "Interest". */
  heading: string;
  /** One row each, in this order. */
  names: string[];
  /** One column each, in this order. */
  levels: ScaleLevel[];
  /** The level chosen for each name; a name with none has no button checked. */
  values: Record<string, number>;
  /** Called with the name and level of a button the applicant picks; absent, the table is read-only. */
  onChange?: (name: string, level: number) => void;
  /** The test id of a name's row; each button's is that plus "-" and its level. */
  rowTestId: (name: string) => string;
};

/** Topic proficiencies (TA and ULA) and interests (ULA): a rating per row on a numbered scale. */
export function LevelTable({
  heading,
  names,
  levels,
  values,
  onChange,
  rowTestId,
}: LevelTableProps): React.JSX.Element {
  const readOnly = onChange === undefined;
  return (
    <Table size="sm" responsive className={tableClass(readOnly)}>
      <thead>
        <tr>
          <th className={LABEL_CELL_CLASS}>{heading}</th>
          {levels.map((level) => (
            <th
              key={level.value}
              className={`text-center fw-normal ${CHOICE_CELL_CLASS}`}
            >
              <ScaleHeading level={level} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {names.map((name) => {
          const rowId = rowTestId(name);
          return (
            <tr key={name} data-testid={rowId}>
              <td className={LABEL_CELL_CLASS}>{name}</td>
              {levels.map(({ value: level }) => (
                <td key={level} className="text-center">
                  <Form.Check
                    type="radio"
                    name={rowId}
                    id={`${rowId}-${level}`}
                    data-testid={`${rowId}-${level}`}
                    aria-label={`${name}: ${level}`}
                    value={level}
                    checked={values[name] === level}
                    disabled={readOnly}
                    readOnly={readOnly}
                    onChange={onChange && (() => onChange(name, level))}
                  />
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

type CourseInterestTableProps = {
  /** One row each, in this order. */
  courses: string[];
  /** "1st choice" or "2nd choice" for one of the two choices, which spans the row; else null. */
  rankOf: (courseId: string) => string | null;
  /** The answer for a course that is not a choice. */
  interestIn: (courseId: string) => string;
  /** Called with a course and the answer the applicant picks; absent, the table is read-only. */
  onChange?: (courseId: string, value: CourseInterestValue) => void;
  /** What the course column shows for a course; by default its id. */
  courseLabel?: (courseId: string) => React.ReactNode;
  /**
   * The ULA form's warnings (issue #148): with this, a first column marks each course asked for
   * but not listed as taken, and a line under its row says what to do about it.
   */
  untaken?: Set<string>;
  /** The test id of a course's row; its buttons, warning and choice cell add suffixes to it. */
  rowTestId: (courseId: string) => string;
  /** The test id of the warnings column's heading. */
  warningHeaderTestId?: string;
};

/** The other courses of interest: a choice spans its row; each other course takes one answer. */
export function CourseInterestTable({
  courses,
  rankOf,
  interestIn,
  onChange,
  courseLabel = (courseId) => courseId,
  untaken,
  rowTestId,
  warningHeaderTestId,
}: CourseInterestTableProps): React.JSX.Element {
  const readOnly = onChange === undefined;
  const warnings = untaken !== undefined;
  return (
    <Table size="sm" responsive className={tableClass(readOnly)}>
      <thead>
        <tr>
          {warnings && (
            <th
              aria-label="Warnings"
              className={LABEL_CELL_CLASS}
              data-testid={warningHeaderTestId}
            />
          )}
          <th className={LABEL_CELL_CLASS}>Course</th>
          {COURSE_INTEREST_OPTIONS.map((option) => (
            <th
              key={option.value}
              className={`text-center fw-normal ${CHOICE_CELL_CLASS}`}
            >
              <OptionHeading label={option.label} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {courses.map((courseId) => {
          const rank = rankOf(courseId);
          const rowId = rowTestId(courseId);
          const legendId = `${rowId}-untaken-warning`;
          const flagged = untaken?.has(courseId) ?? false;
          return (
            <Fragment key={courseId}>
              <tr
                data-testid={rowId}
                aria-describedby={flagged ? legendId : undefined}
              >
                {warnings && (
                  <td className="text-center text-danger">
                    {flagged && (
                      <span
                        title={UNTAKEN_TITLE}
                        data-testid={`${rowId}-untaken`}
                      >
                        <WarningIcon
                          role="img"
                          aria-hidden={undefined}
                          aria-label={UNTAKEN_TITLE}
                        />
                      </span>
                    )}
                  </td>
                )}
                <td
                  className={`${LABEL_CELL_CLASS} ${COURSE_LABEL_CELL_CLASS}`}
                >
                  {courseLabel(courseId)}
                </td>
                {rank ? (
                  <td
                    colSpan={COURSE_INTEREST_OPTIONS.length}
                    className="text-center"
                    data-testid={`${rowId}-choice`}
                  >
                    <strong>{rank}</strong>
                  </td>
                ) : (
                  COURSE_INTEREST_OPTIONS.map((option) => (
                    <td key={option.value} className="text-center">
                      <Form.Check
                        type="radio"
                        name={rowId}
                        id={`${rowId}-${option.value}`}
                        data-testid={`${rowId}-${option.value}`}
                        aria-label={`${courseId}: ${option.label}`}
                        value={option.value}
                        checked={interestIn(courseId) === option.value}
                        disabled={readOnly}
                        readOnly={readOnly}
                        onChange={
                          onChange && (() => onChange(courseId, option.value))
                        }
                      />
                    </td>
                  ))
                )}
              </tr>
              {flagged && (
                <tr
                  id={legendId}
                  className="small text-danger"
                  data-testid={legendId}
                >
                  <td colSpan={2 + COURSE_INTEREST_OPTIONS.length}>
                    <p className="mb-0">
                      <WarningIcon className="me-1 align-text-bottom" />
                      {UNTAKEN_EXPLANATION}
                    </p>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}
