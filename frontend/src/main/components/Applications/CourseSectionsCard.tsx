import { useState } from "react";
import { Button, Card, Table } from "react-bootstrap";
import { useBackend } from "main/utils/useBackend";

export type CourseSectionMeeting = {
  section: string;
  lecture: boolean;
  enrollCode: string | null;
  days: string | null;
  beginTime: string | null;
  endTime: string | null;
  location: string | null;
  instructors: string;
};

export type CourseSections = {
  courseId: string;
  quarter: string;
  title: string | null;
  meetings: CourseSectionMeeting[];
};

type CourseSectionsCardProps = {
  recruitmentId: number | string;
  /** The padded course id, as chosen in the dropdown. */
  courseId: string;
  testIdPrefix?: string;
};

const mono = { fontFamily: "monospace", whiteSpace: "pre" as const };

/** "14:00 - 15:15", or nothing for a section with no scheduled time. */
const timeOf = (meeting: CourseSectionMeeting): string =>
  meeting.beginTime ? `${meeting.beginTime} - ${meeting.endTime}` : "";

/**
 * When a course's lectures and sections meet, looked up as soon as the applicant chooses it, so
 * they can answer the availability questions below it with the times in front of them. Can be
 * folded away once read.
 */
export default function CourseSectionsCard({
  recruitmentId,
  courseId,
  testIdPrefix = "CourseSectionsCard",
}: CourseSectionsCardProps): React.JSX.Element {
  const [shown, setShown] = useState(true);

  const { data, isError } = useBackend<CourseSections | null>(
    ["/api/recruitments/sections", recruitmentId, courseId],
    {
      method: "GET",
      url: "/api/recruitments/sections",
      params: { recruitmentId, courseId },
    },
    // Stryker disable next-line all : don't test default value of null
    null,
  );

  const meetings = data?.meetings ?? [];

  let body: React.JSX.Element;
  if (data === null) {
    body = isError ? (
      <p className="mb-0 text-muted" data-testid={`${testIdPrefix}-error`}>
        The lecture and section times could not be looked up right now.
      </p>
    ) : (
      <p className="mb-0 text-muted" data-testid={`${testIdPrefix}-loading`}>
        Looking up lecture and section times…
      </p>
    );
  } else if (meetings.length === 0) {
    body = (
      <p className="mb-0 text-muted" data-testid={`${testIdPrefix}-none`}>
        No lecture or section times are available for this course.
      </p>
    );
  } else {
    body = (
      <Table size="sm" responsive className="mb-0">
        <thead>
          <tr>
            <th>Section</th>
            <th>Type</th>
            <th>Days</th>
            <th>Time</th>
            <th>Location</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          {meetings.map((meeting, index) => {
            const rowId = `${testIdPrefix}-row-${index}`;
            return (
              <tr key={rowId} data-testid={rowId}>
                <td data-testid={`${rowId}-section`}>{meeting.section}</td>
                <td data-testid={`${rowId}-type`}>
                  {meeting.lecture ? "Lecture" : "Section"}
                </td>
                <td data-testid={`${rowId}-days`}>{meeting.days ?? ""}</td>
                <td data-testid={`${rowId}-time`}>{timeOf(meeting)}</td>
                <td data-testid={`${rowId}-location`}>
                  {meeting.location ?? ""}
                </td>
                <td data-testid={`${rowId}-instructors`}>
                  {meeting.instructors}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  }

  return (
    <Card className="my-2" data-testid={testIdPrefix}>
      <Card.Header className="d-flex justify-content-between align-items-center py-1">
        <span data-testid={`${testIdPrefix}-title`}>
          Lecture and section times for <span style={mono}>{courseId}</span>
          {data?.title ? `: ${data.title}` : ""}
        </span>
        <Button
          variant="link"
          size="sm"
          className="p-0"
          aria-expanded={shown}
          data-testid={`${testIdPrefix}-toggle`}
          onClick={() => setShown((previous) => !previous)}
        >
          {shown ? "Hide" : "Show"}
        </Button>
      </Card.Header>
      {shown && (
        <Card.Body className="p-2" data-testid={`${testIdPrefix}-body`}>
          {body}
        </Card.Body>
      )}
    </Card>
  );
}
