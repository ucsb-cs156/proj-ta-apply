import { useState } from "react";
import { Button, Form, Table } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fillNoticeFields } from "main/utils/noticeFields";
import { formatPacificDateTime } from "main/utils/pacificTime";
import {
  SECTIONS_NONE,
  SECTIONS_NOTE,
  SECTIONS_UNAVAILABLE,
  SOFT_OFFER_DECISIONS,
  SOFT_OFFER_INTRO,
  SUBMIT_RESPONSE_LABEL,
  deadlineSentence,
  decisionLabel,
  decisionSentence,
  type SoftOffer,
  type SoftOfferDecision,
} from "main/utils/softOffers";
import {
  useNoticeFillIn,
  type FillInRecruitment,
} from "main/utils/useNoticeFillIn";

type SoftOfferSectionProps = {
  offer: SoftOffer;
  /** The recruitment, for filling the notice's ${quarter}-style fields. */
  recruitment: FillInRecruitment;
  onRespond: (decision: SoftOfferDecision, comments: string) => void;
  /** While an answer is being sent, so it is not sent twice. */
  responding?: boolean;
  testIdPrefix?: string;
};

const blank = (text: string | null | undefined): string => text ?? "";

/**
 * The Soft Offer section of a student's recruitment card (issue #486): the lecture they have been
 * recommended for, its sections, the Soft Offer Notices text, and either the question (proceed or
 * decline, with comments and Submit My Response) or, once answered, the answer read-only with the
 * time it was given and whom to contact to change it.
 */
export default function SoftOfferSection({
  offer,
  recruitment,
  onRespond,
  responding = false,
  testIdPrefix = "SoftOfferSection",
}: SoftOfferSectionProps): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const [decision, setDecision] = useState<SoftOfferDecision | null>(null);
  // Stryker disable next-line StringLiteral : the box starts empty either way
  const [comments, setComments] = useState("");
  const fillIn = useNoticeFillIn(recruitment);
  const { course, sections, response } = offer;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    // Stryker disable next-line BlockStatement,CallExpression : the form is never really submitted in jsdom
    event.preventDefault();
    if (decision !== null) {
      onRespond(decision, comments);
    }
  };

  return (
    <section className="mt-3 pt-3 border-top" data-testid={testIdPrefix}>
      <h3 className="h6" data-testid={id("title")}>
        Soft Offer
      </h3>
      <p data-testid={id("intro")}>{SOFT_OFFER_INTRO}</p>
      <Table size="sm" bordered responsive data-testid={id("course")}>
        <thead>
          <tr>
            <th>Course Number</th>
            <th>Instructor</th>
            <th>Instructor Email</th>
            <th>Lecture Day</th>
            <th>Lecture Start Time</th>
            <th>Lecture End Time</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-testid={id("course-number")}>{course.courseNumber}</td>
            <td data-testid={id("course-instructor")}>
              {blank(course.instructor)}
            </td>
            <td data-testid={id("course-instructor-email")}>
              {blank(course.instructorEmail)}
            </td>
            <td data-testid={id("course-days")}>{blank(course.days)}</td>
            <td data-testid={id("course-begin")}>{blank(course.beginTime)}</td>
            <td data-testid={id("course-end")}>{blank(course.endTime)}</td>
          </tr>
        </tbody>
      </Table>
      {sections === null ? (
        <p className="text-muted" data-testid={id("sections-unavailable")}>
          {SECTIONS_UNAVAILABLE}
        </p>
      ) : sections.length === 0 ? (
        <p className="text-muted" data-testid={id("sections-none")}>
          {SECTIONS_NONE}
        </p>
      ) : (
        <>
          <Table size="sm" bordered responsive data-testid={id("sections")}>
            <thead>
              <tr>
                <th>Section</th>
                <th>Section Day</th>
                <th>Section Start Time</th>
                <th>Section End Time</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((meeting, i) => (
                <tr key={i} data-testid={id(`section-${i}`)}>
                  <td>{blank(meeting.section)}</td>
                  <td>{blank(meeting.days)}</td>
                  <td>{blank(meeting.beginTime)}</td>
                  <td>{blank(meeting.endTime)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-muted small" data-testid={id("sections-note")}>
            {SECTIONS_NOTE}
          </p>
        </>
      )}
      {offer.notice !== null && (
        <div data-testid={id("notice")}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fillNoticeFields(offer.notice.content, fillIn)}
          </ReactMarkdown>
        </div>
      )}
      {response === null ? (
        <Form onSubmit={submit} data-testid={id("form")}>
          <p data-testid={id("deadline")}>{deadlineSentence(offer.deadline)}</p>
          {SOFT_OFFER_DECISIONS.map((choice) => (
            <Form.Check
              key={choice.decision}
              type="radio"
              name={id("decision")}
              id={id(`choice-${choice.decision}`)}
              label={choice.label}
              checked={decision === choice.decision}
              onChange={() => setDecision(choice.decision)}
              data-testid={id(`choice-${choice.decision}`)}
            />
          ))}
          <Form.Group className="mt-2" controlId={id("comments")}>
            <Form.Label>Comments (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={4000}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              data-testid={id("comments")}
            />
          </Form.Group>
          <Button
            type="submit"
            variant="primary"
            className="mt-2"
            disabled={decision === null || responding}
            data-testid={id("submit")}
          >
            {SUBMIT_RESPONSE_LABEL}
          </Button>
        </Form>
      ) : (
        <div data-testid={id("answer")}>
          <dl className="row mb-2">
            <dt className="col-sm-3">Your choice</dt>
            <dd className="col-sm-9" data-testid={id("answer-decision")}>
              {decisionLabel(response.decision)}
            </dd>
            <dt className="col-sm-3">Submitted</dt>
            <dd className="col-sm-9" data-testid={id("answer-time")}>
              {formatPacificDateTime(response.respondedAt)}
            </dd>
            <dt className="col-sm-3">Comments</dt>
            <dd className="col-sm-9" data-testid={id("answer-comments")}>
              {response.comments ?? "(none)"}
            </dd>
          </dl>
          <p className="mb-0" data-testid={id("answer-sentence")}>
            {decisionSentence(response.decision)}
          </p>
        </div>
      )}
    </section>
  );
}
