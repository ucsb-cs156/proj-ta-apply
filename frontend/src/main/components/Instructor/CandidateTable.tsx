import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { apiErrorMessage } from "main/utils/apiError";
import InterestMark from "main/components/Common/InterestMark";
import {
  ENTHUSIASTIC,
  FIRST_CHOICE,
  interestDisplay,
  NOT_INTERESTED,
  SECOND_CHOICE,
  WOULD_CONSIDER,
} from "main/utils/interestDisplay";

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
  previousServiceAsUla: number | null;
  videoLink: string | null;
};

type Props = {
  candidates: Candidate[];
  type: "TA" | "ULA";
  editable: boolean;
  apiUrl: string;
  applicationUrl: string;
  /** Called after each ranking is saved, so the page can re-read what depends on the rankings. */
  onSaved?: () => void;
};

// Strongest interest first; "Not Interested" candidates appear only when the instructor asks.
const preferences = [
  FIRST_CHOICE,
  SECOND_CHOICE,
  ENTHUSIASTIC,
  WOULD_CONSIDER,
  NOT_INTERESTED,
];
type Column = { key: keyof Candidate; label: string; numeric?: boolean };
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
}: Props): React.JSX.Element {
  const [ranks, setRanks] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      candidates.map((c) => [c.applicationId, c.rank?.toString() ?? ""]),
    ),
  );
  const [states, setStates] = useState<Record<number, string>>({});
  const [tied, setTied] = useState<number[]>([]);
  const [sort, setSort] = useState<{
    key: keyof Candidate;
    descending: boolean;
  }>({
    key: "preference",
    descending: false,
  });
  const queues = useRef<Record<number, Promise<void>>>({});
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
    // Serialize writes for each candidate. Other candidates can save independently.
    const write = async () => {
      try {
        await axios.put(`${apiUrl}/${id}/rank`, {
          rank: value === "" ? null : Number(value),
        });
        onSaved?.();
        if (active.current && revisions.current[id] === revision) {
          setStates((previous) => ({ ...previous, [id]: "Saved" }));
        }
      } catch (error) {
        if (active.current && revisions.current[id] === revision) {
          setStates((previous) => ({
            ...previous,
            [id]: `Save failed: ${apiErrorMessage(error)}`,
          }));
        }
      }
    };
    const pending = queues.current[id];
    const request = pending ? pending.then(write) : write();
    queues.current[id] = request;
    void request.then(() => {
      if (queues.current[id] === request) delete queues.current[id];
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
        ]),
  ];
  const valueOf = (candidate: Candidate, key: keyof Candidate) =>
    key === "rank" ? ranks[candidate.applicationId] : candidate[key];
  const sorted = [...candidates].sort((a, b) => {
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

  return (
    <section aria-label="Eligible candidates">
      <h2>Candidates</h2>
      {!editable && <p>Rankings are read-only.</p>}
      {candidates.length === 0 ? (
        <p>No eligible candidates for this course.</p>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    aria-sort={
                      sort.key === column.key
                        ? sort.descending
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                  >
                    <button
                      className="btn btn-link"
                      onClick={() =>
                        setSort({
                          key: column.key,
                          descending:
                            sort.key === column.key && !sort.descending,
                        })
                      }
                    >
                      {column.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((candidate) => (
                <tr key={candidate.applicationId}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.key === "rank" ? "text-end" : undefined}
                      style={
                        column.key === "rank" &&
                        tied.includes(Number(ranks[candidate.applicationId]))
                          ? { backgroundColor: "#ffff00" }
                          : column.key === "preference"
                            ? {
                                backgroundColor: interestDisplay(
                                  candidate.preference,
                                ).background,
                              }
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
                                states[candidate.applicationId] === "Saving..."
                                  ? "status"
                                  : "alert"
                              }
                            >
                              {states[candidate.applicationId]}
                            </span>
                          )}
                          {states[candidate.applicationId]?.startsWith(
                            "Save failed:",
                          ) && (
                            <button
                              onClick={() =>
                                save(
                                  candidate.applicationId,
                                  ranks[candidate.applicationId],
                                )
                              }
                            >
                              Retry
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
                      ) : column.key === "videoLink" && candidate.videoLink ? (
                        <a
                          href={candidate.videoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`CandidateTable-video-${candidate.applicationId}`}
                        >
                          {candidate.videoLink}
                        </a>
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
                      ) : (
                        candidate[column.key]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tied.length > 0 && (
        <p role="alert">
          You have tied rankings. This is permitted, but please be{" "}
          <em>absolutely</em> sure that you really do have zero preference
          between the candidates you have given the same ranking. Rankings
          without ties make it easier to finalize assignments.
        </p>
      )}
    </section>
  );
}
