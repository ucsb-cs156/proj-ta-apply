import { Badge } from "react-bootstrap";
import { Link } from "react-router";
import { useDeveloperMode } from "main/utils/developerMode";
import { useDeveloperModeFooterControlsValue } from "main/utils/developerModeFooter";

/**
 * The page footer. While developer mode is on (issue #217), a red Developer Mode badge sits flush
 * right, and any controls the current page registered through useDeveloperModeFooterControls
 * appear to its right. The badge is for everyone, signed in or not: it marks an instance that
 * holds fake data.
 */
export default function Footer() {
  const { data: developerMode } = useDeveloperMode();
  const controls = useDeveloperModeFooterControlsValue();
  const on = developerMode?.on === true;

  return (
    <footer
      style={{
        background: "#ffffff",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        className="content-column"
        style={{
          padding: "16px 20px",
          color: "#475569",
          fontSize: "0.95rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <span>
          <Link to="/help/about">About TA Apply</Link>
        </span>
        {on && (
          <span
            className="d-flex align-items-center gap-2 ms-auto"
            data-testid="Footer-developer-mode"
          >
            <Badge bg="danger" data-testid="Footer-developer-mode-badge">
              Developer Mode
            </Badge>
            {controls !== null && (
              <span data-testid="Footer-developer-mode-controls">
                {controls}
              </span>
            )}
          </span>
        )}
      </div>
    </footer>
  );
}
