import InterestMark from "main/components/Common/InterestMark";
import { INTEREST_LEGEND, interestDisplay } from "main/utils/interestDisplay";

type InterestLegendProps = {
  testIdPrefix?: string;
};

/**
 * What the colours and symbols of the ranking cells mean (issue #199): one swatch per level of
 * interest, with its symbol, in the order of the preferences.
 */
export default function InterestLegend({
  testIdPrefix = "InterestLegend",
}: InterestLegendProps): React.JSX.Element {
  return (
    <ul
      className="list-inline small mb-2"
      aria-label="Interest legend"
      data-testid={testIdPrefix}
    >
      <li className="list-inline-item fw-bold">Applicant&apos;s interest:</li>
      {INTEREST_LEGEND.map(({ preference, label }) => (
        <li
          key={preference}
          className="list-inline-item px-2 rounded"
          style={{ backgroundColor: interestDisplay(preference).background }}
          data-testid={`${testIdPrefix}-${preference.replace(/\W/g, "")}`}
        >
          <InterestMark preference={preference} />
          {label}
        </li>
      ))}
    </ul>
  );
}
