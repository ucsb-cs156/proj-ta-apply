import { useState } from "react";
import { Alert } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend } from "main/utils/useBackend";

import {
  LEGACY_BANNER_TEXT,
  LEGACY_FORM_URL,
  LEGACY_HIDE_NOTES_CLASS,
  LEGACY_NOTES_TOGGLE_ID,
  LEGACY_SCOPE_CLASS,
  extractLegacyForm,
} from "main/utils/legacyForm";

/**
 * The old PHP app's TA application form, shown for comparison: /admin/legacy-ta-application
 *
 * <p>The form is a complete HTML document served at /legacy. It cannot be shown in an iframe,
 * because Spring Security answers every request with X-Frame-Options: DENY, which forbids framing
 * even from the same origin (#44). So the page fetches the document and renders its body and its
 * stylesheet directly, with the stylesheet scoped to the form's container so the legacy body and
 * :root rules leave the rest of the app alone. The document's one script, which toggles the
 * reconstruction notes, is replaced by the click handler below.
 */
export default function LegacyTaApplicationPage(): React.JSX.Element {
  const { data: html } = useBackend<string>(
    // Stryker disable next-line all : the key only names the cache entry
    [LEGACY_FORM_URL],
    // Stryker disable next-line all : axios treats a blank method as GET
    { method: "GET", url: LEGACY_FORM_URL },
    "",
  );
  const [hideNotes, setHideNotes] = useState(false);
  const { css, body } = extractLegacyForm(html);

  // The markup is not React's, so React's onChange (which it synthesizes per input) never fires
  // for it; a click reaches the container, and a checkbox is already toggled by the time it does.
  const onFormClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLInputElement;
    if (target.id === LEGACY_NOTES_TOGGLE_ID) {
      setHideNotes(!target.checked);
    }
  };

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
        {body === "" ? (
          <p data-testid="LegacyTaApplicationPage-loading">
            Loading the legacy form…
          </p>
        ) : (
          <>
            <style data-testid="LegacyTaApplicationPage-style">{css}</style>
            <div
              className={
                hideNotes
                  ? `${LEGACY_SCOPE_CLASS} ${LEGACY_HIDE_NOTES_CLASS}`
                  : LEGACY_SCOPE_CLASS
              }
              data-testid="LegacyTaApplicationPage-form"
              onClick={onFormClick}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </>
        )}
      </div>
    </BasicLayout>
  );
}
