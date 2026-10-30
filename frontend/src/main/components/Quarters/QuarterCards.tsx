import { Card, Col, Row } from "react-bootstrap";
import {
  QUARTER_DATE_FIELDS,
  showQuarterDate,
  type UcsbApiQuarter,
} from "main/utils/quarterCalendar";

type QuarterCardsProps = {
  quarters: UcsbApiQuarter[];
  testIdPrefix?: string;
};

/**
 * One card per quarter of the UCSB quarter calendar (issue #151): the quarter's names on the
 * header, every date in the body. Cards rather than a table, since there are a dozen dates.
 */
export default function QuarterCards({
  quarters,
  testIdPrefix = "QuarterCards",
}: QuarterCardsProps): React.JSX.Element {
  const list = Array.isArray(quarters) ? quarters : [];
  if (list.length === 0) {
    return (
      <p className="text-muted" data-testid={`${testIdPrefix}-none`}>
        No quarters on file yet.
      </p>
    );
  }
  return (
    <Row xs={1} md={2} xl={3} className="g-3" data-testid={testIdPrefix}>
      {list.map((quarter) => {
        const id = (suffix: string) =>
          `${testIdPrefix}-card-${quarter.quarter}-${suffix}`;
        return (
          <Col key={quarter.quarter}>
            <Card className="h-100" data-testid={id("card")}>
              <Card.Header>
                <strong className="fs-5" data-testid={id("qyy")}>
                  {quarter.qyy}
                </strong>{" "}
                <span data-testid={id("name")}>{quarter.name}</span>
                <span
                  className="text-muted small ms-2"
                  data-testid={id("quarter")}
                >
                  {quarter.quarter}
                </span>
              </Card.Header>
              <Card.Body className="py-2">
                <dl className="row mb-0 small">
                  <dt className="col-7">Category</dt>
                  <dd className="col-5 mb-1" data-testid={id("category")}>
                    {quarter.category}
                  </dd>
                  <dt className="col-7">Academic year</dt>
                  <dd className="col-5 mb-1" data-testid={id("academicYear")}>
                    {quarter.academicYear}
                  </dd>
                  {QUARTER_DATE_FIELDS.map((field) => (
                    <div className="row g-0 mx-0" key={field.key}>
                      <dt className="col-7">{field.label}</dt>
                      <dd className="col-5 mb-1" data-testid={id(field.key)}>
                        {showQuarterDate(quarter[field.key], field.withTime)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card.Body>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
