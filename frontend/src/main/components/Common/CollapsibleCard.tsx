import { Card } from "react-bootstrap";
import { useRememberedOpen } from "main/utils/useRememberedOpen";

type CollapsibleCardProps = {
  title: string;
  /** A line in a smaller font beneath the title, on the header (issue #391). */
  subtitle?: string;
  /** Names the localStorage entry that remembers whether the card is open. */
  storageKey: string;
  children: React.ReactNode;
  testIdPrefix?: string;
};

const STORAGE_PREFIX = "collapsibleCard.";

/**
 * A card whose body is hidden until the title is clicked. It starts closed, and
 * remembers its open/closed setting in localStorage under the given key, so it
 * stays as the user left it the next time the page is shown. The body is not
 * rendered while the card is closed.
 */
export default function CollapsibleCard({
  title,
  subtitle,
  storageKey,
  children,
  testIdPrefix = "CollapsibleCard",
}: CollapsibleCardProps): React.JSX.Element {
  const [open, toggle] = useRememberedOpen(
    `${STORAGE_PREFIX}${storageKey}`,
    false,
  );

  return (
    <Card className="mt-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h4 mb-0 p-0">
        <button
          type="button"
          className="btn btn-link w-100 text-start text-decoration-none text-reset p-3"
          aria-expanded={open}
          onClick={toggle}
          data-testid={`${testIdPrefix}-toggle`}
        >
          <span aria-hidden="true">{open ? "▾" : "▸"}</span> {title}
          {subtitle && (
            <span
              className="d-block fs-6 fw-normal text-body-secondary mt-1"
              data-testid={`${testIdPrefix}-subtitle`}
            >
              {subtitle}
            </span>
          )}
        </button>
      </Card.Header>
      {open && (
        <Card.Body data-testid={`${testIdPrefix}-body`}>{children}</Card.Body>
      )}
    </Card>
  );
}
