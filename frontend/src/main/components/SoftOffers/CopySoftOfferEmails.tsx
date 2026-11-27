import { Button } from "react-bootstrap";
import CopyIcon from "main/components/Common/CopyIcon";
import { copyToClipboard, emailsCopiedText } from "main/utils/clipboard";
import {
  COPY_EMAILS_LABEL,
  EMAIL_BUCKETS,
  softOfferEmailBuckets,
} from "main/utils/softOffers";

type Props = {
  /** The main table's rows, each a list of cells in RESULTS_COLUMN_IDS order. */
  rows: readonly (readonly string[])[];
  testIdPrefix?: string;
};

/**
 * The "Copy Soft Offer Emails:" line of the Soft Offer Results page (issue #511): four buttons that
 * copy, one email per line, the assigned ULAs, those who answered Proceed, those who answered
 * Declined, and those with no answer for the lecture they now hold. A button with nobody to copy
 * is disabled. The toast says how many were copied, or that the browser refused.
 */
export default function CopySoftOfferEmails({
  rows,
  testIdPrefix = "CopySoftOfferEmails",
}: Props): React.JSX.Element {
  const buckets = softOfferEmailBuckets(rows);
  return (
    <div
      className="d-flex flex-wrap align-items-center gap-2 mb-2"
      data-testid={testIdPrefix}
    >
      <span data-testid={`${testIdPrefix}-label`}>{COPY_EMAILS_LABEL}</span>
      {EMAIL_BUCKETS.map(({ id, label }) => {
        const emails = buckets[id];
        return (
          <Button
            key={id}
            variant="outline-primary"
            size="sm"
            disabled={emails.length === 0}
            onClick={() =>
              copyToClipboard(
                emails.join("\n"),
                emailsCopiedText(emails.length),
              )
            }
            data-testid={`${testIdPrefix}-${id}`}
          >
            <CopyIcon /> {label}
          </Button>
        );
      })}
    </div>
  );
}
