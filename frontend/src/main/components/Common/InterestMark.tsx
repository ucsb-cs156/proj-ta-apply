import { interestDisplay } from "main/utils/interestDisplay";

type InterestMarkProps = {
  preference: string | null | undefined;
  testId?: string;
};

/**
 * The symbol at the left of a ranking cell that says how interested the applicant is in the course
 * (issue #199): ➊ or ➋ for their first or second choice, at 120% of the cell's size, ✓ for
 * Enthusiastic, ▬ for Would Consider and ✖ for Not Interested/Not Applicable. The meaning is in the
 * tooltip and read out by screen readers.
 */
export default function InterestMark({
  preference,
  testId,
}: InterestMarkProps): React.JSX.Element {
  const display = interestDisplay(preference);
  return (
    <span
      role="img"
      aria-label={display.description}
      title={display.description}
      className="me-1"
      style={display.large ? { fontSize: "120%" } : undefined}
      data-testid={testId}
    >
      {display.symbol}
    </span>
  );
}
