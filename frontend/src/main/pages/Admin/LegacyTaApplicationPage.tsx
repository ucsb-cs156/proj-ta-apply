import { Alert } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";

import {
  LEGACY_BANNER_TEXT,
  LEGACY_FORM_URL,
  fitFrameToContent,
} from "main/utils/legacyForm";

/**
 * The old PHP app's TA application form, shown for comparison: /admin/legacy-ta-application
 *
 * <p>The HTML is a complete document with its own styles, so it is shown in an iframe rather than
 * injected into this page, where its body and :root rules would fight with Bootstrap. The frame is
 * same-origin, so it can be sized to its content once loaded.
 */
export default function LegacyTaApplicationPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2">
        <Alert
          variant="warning"
          className="fw-bold"
          data-testid="LegacyTaApplicationPage-banner"
        >
          {LEGACY_BANNER_TEXT}
        </Alert>
        <h1>Legacy TA Application</h1>
        <iframe
          title="Legacy TA application form"
          data-testid="LegacyTaApplicationPage-frame"
          src={LEGACY_FORM_URL}
          sandbox="allow-same-origin allow-scripts"
          style={{ width: "100%", minHeight: "80vh", border: "none" }}
          onLoad={(e) => fitFrameToContent(e.currentTarget)}
        />
      </div>
    </BasicLayout>
  );
}
