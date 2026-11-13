import { Fragment, useEffect, useRef, useState } from "react";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import axios from "axios";
import { apiErrorMessage } from "main/utils/apiError";
import InterestMark from "main/components/Common/InterestMark";
import { WarningIcon } from "main/components/Common/Icons";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import { useStoredHiddenColumns } from "main/utils/useStoredHiddenColumns";
import { candidateColumnChoices } from "main/utils/candidateColumns";
import { gpaText } from "main/utils/applicationFields";
import { interestDisplay } from "main/utils/interestDisplay";
import { stackedWords } from "main/components/Common/columnStyles";
import {
  compareByRankThenPreference,
  PREFERENCE_ORDER,
} from "main/utils/candidateOrder";

export type Candidate = {
  applicationId: number;
  rank: number | null;
  preference: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  major: string | null;
  classLevel: string | null;
  yearInProgram: string | null;
  graduationDate: string | null;
  gpaMajor: number | null;
  gpaOverall: number | null;
  /** Issue #292: no GPAs yet; the table says "First quarter" in their place. */
  firstQuarter: boolean;
  previousServiceAsUla: number | null;
  videoLink: string | null;
  /**
   * The version of the course's whole ranking list that this row was read at (issue #279): the
   * same on every row of one reading. A save names it, and is refused if the list has changed.
   */
  rankingVersion: number;
  /** Issue #442: whether the applicant lists this course among their UCSB prior coursework. */
  tookCourse: boolean;
  /** Issue #442: the term they took it, as they wrote it; null if they did not take it. */
  courseTerm: string | null;
  /** Issue #442: the grade they earned in it; null if they did not take it, or gave none. */
  courseGrade: string | null;
};

type Props = {
  candidates: Candidate[];
  type: "TA" | "ULA";
  editable: boolean;
  apiUrl: string;
  applicationUrl: string;
  /** Called after each ranking is saved, so the page can re-read what depends on the rankings. */
  onSaved?: () => void;
  /** Sent with every save, so that the server knows which tab is ranking (issue #279). */
  headers?: Record<string, string>;
  /**
   * Called when a save is refused because the course's rankings changed (issue #279): reads the
   * candidates again and resolves to them, or to null if they could not be read.
   */
  onConflict?: () => Promise<Candidate[] | null>;
  /**
   * Where this browser remembers which columns the instructor has hidden (issue #312); see
   * candidateColumnsStorageKey.
   */
  columnsStorageKey: string;
};

/** Whether a failed request was the server refusing a stale save (409 Conflict). */
const isConflict = (error: unknown): boolean =>
  (error as { response?: { status?: number } } | null)?.response?.status ===
  409;

/** What a row says when its save was refused because the list changed under it (issue #279). */
export const CONFLICT_MESSAGE =
  "Rankings for this course changed while you were editing; your change has not been saved.";

/**
 * Issue #442: the tooltip on the warning in the When Course Taken cell of a ULA candidate who does
 * not list the course among their UCSB prior coursework.
 */
export const NOT_TAKEN_TOOLTIP =
  "Student did not take course; see comments for their explanation of their qualifications to ULA for this course.";

/** Issue #442: what the When Course Taken cell shows for a candidate who did not take the course. */
export const NOT_TAKEN_MARK = "\u26A0\uFE0F";

/** Issue #311: the warning under the last row of each group of tied rankings. */
export const TIED_WARNING =
  "You have ranked multiple candidates with the same rank.  Are you sure you have no preference among these candidates?";

// Strongest interest first; "Not Interested" candidates appear only when the instructor asks.
const preferences = PREFERENCE_ORDER;

/** The tooltip on the Default Sort button (issue #265). */
export const DEFAULT_SORT_TOOLTIP =
  "Sorts by faculty ranking (1 first, unranked last); within a ranking, by course preference (first choice, second choice, Enthusiastic, Would Consider, Not Interested); then in the order the applications were submitted. Rankings are read as of now, so a row does not jump while you type.";

type Column = {
  key: keyof Candidate;
  /** The heading, and the column's name in the Columns menu. */
  label: string;
  /** Shown in the heading in place of the label, e.g. stacked on several lines. */
  heading?: React.ReactNode;
  numeric?: boolean;
};
const common: Column[] = [
  { key: "rank", label: "Ranking", numeric: true },
  { key: "preference", label: "Course Preference" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "major", label: "Major" },
];
const year: Column = {
  key: "yearInProgram",
  label: "Year in Program",
  numeric: true,
};
const graduation: Column = {
  key: "graduationDate",
  label: "Expected Graduation",
};

export default function CandidateTable({
  candidates,
  type,
  editable,
  apiUrl,
  onSaved,
  applicationUrl,
  headers,
  onConflict,
  columnsStorageKey,
}: Props): React.JSX.Element {
  const [ranks, setRanks] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      candidates.map((c) => [c.applicationId, c.rank?.toString() ?? ""]),
    ),
  );
  const [states, setStates] = useState<Record<number, string>>({});
  const [tied, setTied] = useState<number[]>([]);
  // null is the default sort (issue #265): ranking, then course preference, then submission order.
  const [sort, setSort] = useState<{
    key: keyof Candidate;
    descending: boolean;
  } | null>(null);
  // The default sort reads the rankings as they were when it was applied, so that typing a
  // ranking does not move the row out from under the cursor. Default Sort applies it again.
  const [defaultRanks, setDefaultRanks] = useState(ranks);
  // Every save carries the version of the whole list and moves it on, so the saves go one at a
  // time, in the order they were made; a refused one makes the ones queued behind it stale too.
  const queue = useRef<Promise<void> | null>(null);
  const version = useRef(candidates[0]?.rankingVersion ?? 0);
  const generation = useRef(0);
  // The rows whose typed ranking the server has not accepted: they keep what was typed when the
  // list is read again.
  const unsaved = useRef<Set<number>>(new Set());
  const revisions = useRef<Record<number, number>>({});
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const validRank = (value: string): boolean =>
    value === "" ||
    (/^\d+$/.test(value) &&
      Number(value) >= 1 &&
      Number(value) <= candidates.length);
  const tieKey = JSON.stringify(
    Object.values(ranks)
      .filter((value) => value !== "" && validRank(value))
      .map(Number)
      .filter((rank, i, values) => values.indexOf(rank) !== i)
      .sort((a, b) => a - b),
  );
  useEffect(() => {
    setTied([]);
    const timer = setTimeout(() => setTied(JSON.parse(tieKey)), 2000);
    return () => clearTimeout(timer);
  }, [tieKey, ranks]);

  function save(id: number, value: string) {
    const revision = (revisions.current[id] ?? 0) + 1;
    revisions.current[id] = revision;
    setRanks((previous) => ({ ...previous, [id]: value }));
    if (!validRank(value)) {
      setStates((previous) => ({
        ...previous,
        [id]: `Enter an integer from 1 through ${candidates.length}, or clear the rank.`,
      }));
      return;
    }
    setStates((previous) => ({ ...previous, [id]: "Saving..." }));
    unsaved.current.add(id);
    const attempt = generation.current;
    const current = () => active.current && revisions.current[id] === revision;
    const refuse = () => {
      if (current()) {
        setStates((previous) => ({ ...previous, [id]: CONFLICT_MESSAGE }));
      }
    };
    const write = async () => {
      if (attempt !== generation.current) {
        // Made against a list that has since been found out of date, so not sent.
        refuse();
        return;
      }
      try {
        const response = await axios.put(
          `${apiUrl}/${id}/rank`,
          { rank: value === "" ? null : Number(value) },
          { params: { version: version.current }, headers },
        );
        version.current = response.data.version;
        onSaved?.();
        if (current()) {
          unsaved.current.delete(id);
          setStates((previous) => ({ ...previous, [id]: "Saved" }));
        }
      } catch (error) {
        if (isConflict(error)) {
          // Stryker disable next-line AssignmentOperator : any change makes the queued attempts stale
          generation.current += 1;
          refuse();
          const fresh = (await onConflict?.()) ?? null;
          if (fresh !== null) {
            version.current = fresh[0]?.rankingVersion ?? version.current;
            const read = Object.fromEntries(
              fresh.map((c) => [c.applicationId, c.rank?.toString() ?? ""]),
            );
            // What the server now has, except in the boxes that hold an edit it has not accepted.
            setRanks((previous) => ({
              ...read,
              ...Object.fromEntries(
                [...unsaved.current].map((id) => [id, previous[id]]),
              ),
            }));
            setDefaultRanks(read);
          }
        } else if (current()) {
          setStates((previous) => ({
            ...previous,
            [id]: `Save failed: ${apiErrorMessage(error)}`,
          }));
        }
      }
    };
    const pending = queue.current;
    const request = pending ? pending.then(write) : write();
    queue.current = request;
    void request.then(() => {
      if (queue.current === request) queue.current = null;
    });
  }

  const columns: Column[] = [
    ...common,
    ...(type === "TA"
      ? [
          { key: "classLevel" as const, label: "Level (PhD/MS)" },
          year,
          graduation,
        ]
      : [
          year,
          graduation,
          { key: "gpaMajor" as const, label: "GPA in Major", numeric: true },
          { key: "gpaOverall" as const, label: "Overall GPA", numeric: true },
          {
            key: "previousServiceAsUla" as const,
            label: "Quarters of Previous ULA Service",
            numeric: true,
          },
          { key: "videoLink" as const, label: "Video Link" },
          // Issue #442: whether the applicant took this course at UCSB, and how they did.
          {
            key: "courseTerm" as const,
            label: "When Course Taken",
            heading: stackedWords(
              "When Course Taken",
              "candidate-table-stacked-heading",
            ),
          },
          { key: "courseGrade" as const, label: "Course Grade" },
        ]),
  ];
  // Issue #312: the columns the instructor has hidden, remembered in this browser.
  const { hiddenColumns, toggleColumn } = useStoredHiddenColumns(
    columnsStorageKey,
    [],
  );
  const choices = candidateColumnChoices(columns);
  const shownColumns = columns.filter(
    (column) => !hiddenColumns.includes(column.key),
  );
  const valueOf = (candidate: Candidate, key: keyof Candidate) =>
    key === "rank" ? ranks[candidate.applicationId] : candidate[key];
  const defaultRank = (candidate: Candidate): number =>
    defaultRanks[candidate.applicationId] === ""
      ? Infinity
      : Number(defaultRanks[candidate.applicationId]);
  // The candidates arrive in the order the applications were submitted, and sorting is stable,
  // so equal candidates stay in that order.
  const sorted = [...candidates].sort((a, b) => {
    if (sort === null) {
      // Shared with the admin Assignments page (issue #345).
      return compareByRankThenPreference(
        { rank: defaultRank(a), preference: a.preference },
        { rank: defaultRank(b), preference: b.preference },
      );
    }
    const left = valueOf(a, sort.key) ?? "";
    const right = valueOf(b, sort.key) ?? "";
    let comparison: number;
    if (sort.key === "preference") {
      comparison =
        preferences.indexOf(String(left)) - preferences.indexOf(String(right));
    } else if (left === "" || right === "") {
      comparison = left === right ? 0 : left === "" ? 1 : -1;
    } else if (sort.key === "yearInProgram") {
      comparison = String(left).localeCompare(String(right), undefined, {
        numeric: true,
      });
    } else if (columns.find((column) => column.key === sort.key)?.numeric) {
      comparison = Number(left) - Number(right);
    } else {
      comparison = String(left).localeCompare(String(right));
    }
    return sort.descending ? -comparison : comparison;
  });

  // The warning for a group of tied rankings sits under the group's last row as the table is
  // currently ordered. Under the default sort a group is contiguous, so that is directly under
  // it; when the table is sorted by another column the rows of a group may be apart, and the
  // warning still appears once per group, under the last of its rows.
  const lastOfTie = new Map<number, number>();
  sorted.forEach((candidate) => {
    const rank = Number(ranks[candidate.applicationId]);
    if (tied.includes(rank)) lastOfTie.set(rank, candidate.applicationId);
  });

  return (
    <section aria-label="Eligible candidates">
      <h2>Candidates</h2>
      <OverlayTrigger
        placement="top"
        overlay={
          <Tooltip id="CandidateTable-default-sort-tooltip">
            {DEFAULT_SORT_TOOLTIP}
          </Tooltip>
        }
      >
        <Button
          variant="outline-secondary"
          size="sm"
          className="mb-2"
          onClick={() => {
            setSort(null);
            setDefaultRanks(ranks);
          }}
          data-testid="CandidateTable-default-sort"
        >
          Default Sort
        </Button>
      </OverlayTrigger>
      <div className="mb-2 d-inline-block ms-2 align-top">
        <ColumnVisibilityControl
          choices={choices}
          hidden={hiddenColumns}
          onToggle={toggleColumn}
          testIdPrefix="CandidateTable-columns"
        />
      </div>
      {!editable && <p>Rankings are read-only.</p>}
      {candidates.length === 0 ? (
        <p>No eligible candidates for this course.</p>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                {shownColumns.map((column) => (
                  <th
                    key={column.key}
                    className="position-relative"
                    aria-sort={
                      sort?.key === column.key
                        ? sort.descending
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                  >
                    {choices.some((choice) => choice.id === column.key) && (
                      <button
                        type="button"
                        className="btn btn-link p-0 border-0 text-secondary column-hide-link"
                        aria-label={`Hide ${column.label} column`}
                        onClick={() => toggleColumn(column.key, true)}
                        data-testid={`CandidateTable-hide-${column.key}`}
                      >
                        hide
                      </button>
                    )}
                    <button
                      className="btn btn-link"
                      onClick={() =>
                        setSort({
                          key: column.key,
                          descending:
                            sort?.key === column.key && !sort.descending,
                        })
                      }
                    >
                      {column.heading ?? column.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((candidate) => (
                <Fragment key={candidate.applicationId}>
                  <tr>
                    {shownColumns.map((column) => (
                      <td
                        key={column.key}
                        // The classes are in index.css (issue #415): a tied ranking is yellow,
                        // and the preference cell is coloured by the applicant's interest.
                        className={
                          column.key === "rank"
                            ? `text-end${
                                tied.includes(
                                  Number(ranks[candidate.applicationId]),
                                )
                                  ? " candidate-rank-tied"
                                  : ""
                              }`
                            : column.key === "preference"
                              ? interestDisplay(candidate.preference).className
                              : undefined
                        }
                        data-testid={
                          column.key === "preference"
                            ? `CandidateTable-preference-${candidate.applicationId}`
                            : undefined
                        }
                      >
                        {column.key === "rank" ? (
                          <>
                            {editable ? (
                              <input
                                aria-label={`Ranking for ${candidate.firstName} ${candidate.lastName}`}
                                type="number"
                                min={1}
                                max={candidates.length}
                                step={1}
                                value={ranks[candidate.applicationId]}
                                onChange={(event) => {
                                  if (event.target.validity.badInput) {
                                    revisions.current[candidate.applicationId] =
                                      (revisions.current[
                                        candidate.applicationId
                                      ] ?? 0) + 1;
                                    setStates((previous) => ({
                                      ...previous,
                                      [candidate.applicationId]: `Enter an integer from 1 through ${candidates.length}, or clear the rank.`,
                                    }));
                                  } else {
                                    save(
                                      candidate.applicationId,
                                      event.target.value,
                                    );
                                  }
                                }}
                              />
                            ) : (
                              ranks[candidate.applicationId]
                            )}
                            {states[candidate.applicationId] && (
                              <span
                                role={
                                  states[candidate.applicationId] === "Saved" ||
                                  states[candidate.applicationId] ===
                                    "Saving..."
                                    ? "status"
                                    : "alert"
                                }
                              >
                                {states[candidate.applicationId]}
                              </span>
                            )}
                            {(states[candidate.applicationId]?.startsWith(
                              "Save failed:",
                            ) ||
                              states[candidate.applicationId] ===
                                CONFLICT_MESSAGE) && (
                              <button
                                onClick={() =>
                                  save(
                                    candidate.applicationId,
                                    ranks[candidate.applicationId],
                                  )
                                }
                              >
                                {states[candidate.applicationId] ===
                                CONFLICT_MESSAGE
                                  ? "Save again"
                                  : "Retry"}
                              </button>
                            )}
                          </>
                        ) : column.key === "firstName" ||
                          column.key === "lastName" ? (
                          <a
                            href={`${applicationUrl}/${candidate.applicationId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {candidate[column.key]}
                          </a>
                        ) : column.key === "videoLink" &&
                          candidate.videoLink ? (
                          <a
                            href={candidate.videoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`CandidateTable-video-${candidate.applicationId}`}
                          >
                            {candidate.videoLink}
                          </a>
                        ) : column.key === "courseTerm" &&
                          !candidate.tookCourse ? (
                          <OverlayTrigger
                            placement="top"
                            overlay={
                              <Tooltip
                                id={`CandidateTable-not-taken-tooltip-${candidate.applicationId}`}
                              >
                                {NOT_TAKEN_TOOLTIP}
                              </Tooltip>
                            }
                          >
                            <span
                              tabIndex={0}
                              aria-label={NOT_TAKEN_TOOLTIP}
                              data-testid={`CandidateTable-not-taken-${candidate.applicationId}`}
                            >
                              {NOT_TAKEN_MARK}
                            </span>
                          </OverlayTrigger>
                        ) : column.key === "preference" ? (
                          <>
                            <InterestMark
                              preference={candidate.preference}
                              testId={`CandidateTable-preference-${candidate.applicationId}-mark`}
                            />
                            {candidate.preference}
                          </>
                        ) : column.key === "classLevel" ? (
                          candidate.classLevel === "PHD" ? (
                            "PhD"
                          ) : (
                            candidate.classLevel
                          )
                        ) : column.key === "gpaMajor" ||
                          column.key === "gpaOverall" ? (
                          gpaText(candidate, candidate[column.key])
                        ) : (
                          candidate[column.key]
                        )}
                      </td>
                    ))}
                  </tr>
                  {lastOfTie.get(Number(ranks[candidate.applicationId])) ===
                    candidate.applicationId && (
                    <tr
                      className="text-danger"
                      data-testid={`CandidateTable-tied-warning-${candidate.applicationId}`}
                    >
                      <td
                        colSpan={shownColumns.length}
                        className="candidate-table-tied-warning"
                      >
                        <p className="mb-0" role="alert">
                          <WarningIcon className="me-1 align-text-bottom" />
                          {TIED_WARNING}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
