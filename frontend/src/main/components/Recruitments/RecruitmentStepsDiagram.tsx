import { useId, type KeyboardEvent, type MouseEvent } from "react";
import {
  FONT_FAMILY,
  FONT_SIZE,
  FOOTNOTE_LINE_1,
  FOOTNOTE_LINE_2,
  LEGEND_HARD,
  LEGEND_SOFT,
  LINE_HEIGHT,
  layoutRecruitmentSteps,
  type BoxGeometry,
  type RecruitmentStepAction,
  type RecruitmentStepStatus,
  type RecruitmentStepsData,
  type RecruitmentType,
} from "main/utils/recruitmentSteps";

const INK = "#334155";
const BOX_FILL = "#f8fafc";
const NUMBER_INK = "#0f172a";
const LABEL_INK = "#1e293b";
const LEGEND_INK = "#475569";
const LINK_INK = "#0d6efd";
const DONE_GREEN = "#198754";

type RecruitmentStepsDiagramProps = {
  type: RecruitmentType;
  /** The recruitment's live status; absent for the static diagram on the help page. */
  steps?: RecruitmentStepsData;
  /** Called when a title that opens a card modal is activated. */
  onAction?: (action: RecruitmentStepAction) => void;
  /**
   * Called instead of following a link, so the card can route without a page reload; when absent
   * the browser follows the href.
   */
  onNavigate?: (href: string) => void;
  testIdPrefix?: string;
};

/**
 * The Recruitment Steps diagram (docs/design/AdminUserInterfaceDesign.md). Static mode draws the
 * agreed nine-step diagram for a TA or ULA recruitment: two rows of rounded boxes, solid arrows for
 * hard prerequisites and dashed ones for soft, a legend and the footnote on step 5. Live mode, given
 * a recruitment's steps, adds a green check to each step that is done, a status line along the
 * bottom of each box, and makes the titles links to the page or card modal that performs the step.
 */
export default function RecruitmentStepsDiagram({
  type,
  steps,
  onAction = () => {},
  onNavigate,
  testIdPrefix = "RecruitmentStepsDiagram",
}: RecruitmentStepsDiagramProps): React.JSX.Element {
  const live = steps !== undefined;
  const layout = layoutRecruitmentSteps(type, live);
  // One marker per diagram, so two diagrams on a page do not share an id.
  const markerId = `${useId()}-arrow`;
  const statusOf = (n: number): RecruitmentStepStatus | undefined =>
    steps?.steps.find((s) => s.number === n);

  // With no onNavigate the browser follows the link itself, so there is no handler at all.
  const follow = (href: string) =>
    onNavigate === undefined
      ? undefined
      : (event: MouseEvent<Element>) => {
          event.preventDefault();
          onNavigate(href);
        };
  const activate =
    (action: RecruitmentStepAction) =>
    (event: MouseEvent<SVGElement> | KeyboardEvent<SVGElement>) => {
      if ("key" in event && event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onAction(action);
    };

  /** The title lines, as plain text or as links, depending on the step's status. */
  const title = (
    box: BoxGeometry,
    status: RecruitmentStepStatus | undefined,
  ) => {
    const id = (suffix: string) =>
      `${testIdPrefix}-step-${box.number}-${suffix}`;
    const titleLinks = status?.titleLinks;
    const spans = box.lines.map((line, i) => (
      <tspan key={i} x={box.labelX} dy={i === 0 ? undefined : LINE_HEIGHT}>
        {titleLinks === undefined
          ? line
          : // Step 3: each linked word becomes its own link, the rest stays plain text.
            line.split(/(\b\w+\b)/).map((part, j) => {
              const link = titleLinks.find((l) => l.text === part);
              return link === undefined ? (
                <tspan key={j}>{part}</tspan>
              ) : (
                <a
                  key={j}
                  href={link.href}
                  onClick={follow(link.href)}
                  style={{ fill: LINK_INK, textDecoration: "underline" }}
                  data-testid={id(`link-${link.text}`)}
                >
                  <tspan>{part}</tspan>
                </a>
              );
            })}
        {i < box.lines.length - 1 ? " " : ""}
      </tspan>
    ));
    const text = (
      <text
        x={box.numberX}
        y={box.firstBaseline}
        fontSize={FONT_SIZE}
        data-testid={id("title")}
      >
        <tspan fontWeight={700} fill={NUMBER_INK}>
          {`${box.number}. `}
        </tspan>
        <tspan fill={LABEL_INK}>{spans}</tspan>
      </text>
    );
    if (status?.href !== undefined) {
      return (
        <a
          href={status.href}
          onClick={follow(status.href)}
          style={{ textDecoration: "underline" }}
          data-testid={id("link")}
        >
          {text}
        </a>
      );
    }
    if (status?.action !== undefined) {
      return (
        <g
          role="button"
          tabIndex={0}
          aria-label={`${box.lines.join(" ").replace(" *", "")}: open the ${status.action} dialog`}
          onClick={activate(status.action)}
          onKeyDown={activate(status.action)}
          style={{ cursor: "pointer", textDecoration: "underline" }}
          data-testid={id("action")}
        >
          {text}
        </g>
      );
    }
    return text;
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width="100%"
      style={{ maxWidth: `${layout.width}px`, fontFamily: FONT_FAMILY }}
      role="img"
      aria-label={`Steps in a ${type} recruitment and their prerequisites`}
      data-testid={testIdPrefix}
      data-mode={live ? "live" : "static"}
    >
      <title>Steps in a {type} recruitment and their prerequisites</title>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={INK} />
        </marker>
      </defs>
      {layout.boxes.map((box) => {
        const status = statusOf(box.number);
        return (
          <g
            key={box.number}
            data-testid={`${testIdPrefix}-step-${box.number}`}
          >
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx={9}
              fill={BOX_FILL}
              stroke={INK}
              strokeWidth={1.5}
              data-testid={`${testIdPrefix}-step-${box.number}-box`}
            />
            {title(box, status)}
            {status?.done && (
              <g
                transform={`translate(${box.x + box.width - 10} ${box.y + 10})`}
                aria-label="done"
                data-testid={`${testIdPrefix}-step-${box.number}-done`}
              >
                <circle r={7} fill={DONE_GREEN} />
                <path
                  d="M -3.2 0.2 L -1 2.6 L 3.4 -2.6"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}
            {status !== undefined && (
              <text
                x={box.numberX}
                y={box.y + box.height - 6}
                fontSize={11}
                fill={LEGEND_INK}
                data-testid={`${testIdPrefix}-step-${box.number}-label`}
              >
                {status.label}
              </text>
            )}
            {status?.secondaryLink !== undefined && (
              <a
                href={status.secondaryLink.href}
                onClick={follow(status.secondaryLink.href)}
                data-testid={`${testIdPrefix}-step-${box.number}-secondary-link`}
              >
                <text
                  x={box.x + 4}
                  y={box.y + box.height + 13}
                  fontSize={11}
                  fill={LINK_INK}
                  textAnchor="start"
                  style={{ textDecoration: "underline" }}
                >
                  {status.secondaryLink.text}
                </text>
              </a>
            )}
          </g>
        );
      })}
      {layout.edges.map((edge) => (
        <path
          // Stryker disable next-line StringLiteral : React key property not exposed in dom
          key={`${edge.from}-${edge.to}`}
          d={edge.d}
          fill="none"
          stroke={INK}
          strokeWidth={1.6}
          strokeDasharray={edge.kind === "soft" ? "5 4" : undefined}
          markerEnd={`url(#${markerId})`}
          data-testid={`${testIdPrefix}-edge-${edge.from}-${edge.to}`}
          data-kind={edge.kind}
        />
      ))}
      <line
        x1={30}
        y1={layout.legend.hardY}
        x2={75}
        y2={layout.legend.hardY}
        stroke={INK}
        strokeWidth={1.6}
        markerEnd={`url(#${markerId})`}
      />
      <text
        x={85}
        y={layout.legend.hardY + 4}
        fontSize={12}
        fill={LEGEND_INK}
        data-testid={`${testIdPrefix}-legend-hard`}
      >
        {LEGEND_HARD}
      </text>
      <line
        x1={30}
        y1={layout.legend.softY}
        x2={75}
        y2={layout.legend.softY}
        stroke={INK}
        strokeWidth={1.6}
        strokeDasharray="5 4"
        markerEnd={`url(#${markerId})`}
      />
      <text
        x={85}
        y={layout.legend.softY + 4}
        fontSize={12}
        fill={LEGEND_INK}
        data-testid={`${testIdPrefix}-legend-soft`}
      >
        {LEGEND_SOFT}
      </text>
      <text
        x={30}
        y={layout.footnote.y1}
        fontSize={12}
        fill={LEGEND_INK}
        data-testid={`${testIdPrefix}-footnote`}
      >
        <tspan fontWeight={700}>*</tspan> {FOOTNOTE_LINE_1}{" "}
        <tspan x={30} dy={18}>
          {FOOTNOTE_LINE_2}
        </tspan>
      </text>
    </svg>
  );
}
