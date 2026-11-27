import {
  formatPacificDateTime,
  formatPacificShortDate,
  formatPacificShortTime,
} from "main/utils/pacificTime";

export type DateTimeStampProps = {
  /** A date-time from the API, Pacific, or nothing; nothing renders nothing. */
  stamp: string | null | undefined;
  /** Prefix of the test ids: `${testIdPrefix}`, `${testIdPrefix}-date`, `${testIdPrefix}-time`. */
  testIdPrefix?: string;
};

/**
 * When something was done, in two short lines of small muted text: the Pacific date as `mm/dd/yy`,
 * and under it the time as `h:mm AM/PM` (issue #509). The full date and time is the tooltip. Renders
 * nothing when there is no stamp, so it can always sit under a control that may be unstamped.
 */
export default function DateTimeStamp({
  stamp,
  testIdPrefix = "DateTimeStamp",
}: DateTimeStampProps): React.JSX.Element | null {
  if (!stamp) {
    return null;
  }
  return (
    <small
      className="text-muted d-block"
      title={formatPacificDateTime(stamp)}
      data-testid={testIdPrefix}
    >
      <span className="d-block" data-testid={`${testIdPrefix}-date`}>
        {formatPacificShortDate(stamp)}
      </span>
      <span className="d-block" data-testid={`${testIdPrefix}-time`}>
        {formatPacificShortTime(stamp)}
      </span>
    </small>
  );
}
