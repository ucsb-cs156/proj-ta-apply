import {
  LABEL_INSIDE_FROM,
  THERMOMETER_WIDTH,
  thermometerFigures,
} from "main/components/Common/ProgressThermometerUtils";

type ProgressThermometerProps = {
  /** How many have been done (assignments made, applications reviewed, ...). */
  numerator: number;
  /** How many there are to do; 0 (or missing) means no target has been set yet. */
  denominator: number | undefined;
  /** What is being counted, shown before the numbers: "Assignments made". */
  label: string;
  /** Said instead of the numbers when there is no target yet. */
  noTargetText?: string;
  testIdPrefix?: string;
};

/**
 * A progress thermometer (issue #315): a bar filled to the share of a target that has been reached,
 * with "n of m (p%)" above it and the percentage on the bar. Reusable: the admin Assignments page
 * shows the assignments made against the hiring target; other pages will show other fractions.
 * Over the target, the bar is full and red with the real numbers; exactly at it, green; without a
 * target, empty with an explanation.
 */
export default function ProgressThermometer({
  numerator,
  denominator,
  label,
  noTargetText = "no target set yet",
  testIdPrefix = "ProgressThermometer",
}: ProgressThermometerProps): React.JSX.Element {
  const { done, target, percent, fill, hasTarget } = thermometerFigures(
    numerator,
    denominator,
  );
  const figures = hasTarget
    ? `${done} of ${target} (${percent}%)`
    : `${done} so far, ${noTargetText}`;
  const text = `${label}: ${figures}`;
  const colour =
    percent > 100 ? " bg-danger" : percent === 100 ? " bg-success" : "";
  const percentText = `${percent}%`;
  return (
    <div className="mb-3" style={THERMOMETER_WIDTH} data-testid={testIdPrefix}>
      <div className="mb-1" data-testid={`${testIdPrefix}-text`}>
        {text}
      </div>
      <div
        className="progress position-relative"
        style={{ height: "1.5rem" }}
        role="progressbar"
        aria-label={text}
        aria-valuenow={fill}
        aria-valuemin={0}
        aria-valuemax={100}
        data-testid={`${testIdPrefix}-bar`}
      >
        <div
          className={`progress-bar${colour}`}
          style={{ width: `${fill}%` }}
          data-testid={`${testIdPrefix}-fill`}
        >
          {hasTarget && fill >= LABEL_INSIDE_FROM && percentText}
        </div>
        {hasTarget && fill < LABEL_INSIDE_FROM && (
          <span
            className="position-absolute top-50 translate-middle-y text-body ps-2 small"
            style={{ left: `${fill}%` }}
            data-testid={`${testIdPrefix}-beside`}
          >
            {percentText}
          </span>
        )}
      </div>
    </div>
  );
}
