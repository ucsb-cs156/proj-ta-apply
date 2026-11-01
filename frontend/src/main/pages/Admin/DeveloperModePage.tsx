import { Alert, Badge, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useSystemInfo } from "main/utils/systemInfo";
import { useBackendMutation } from "main/utils/useBackend";
import {
  DEVELOPER_MODE_KEY,
  useDeveloperMode,
  type DeveloperModeStatus,
} from "main/utils/developerMode";

/**
 * Developer → Developer Mode: /admin/developer-mode (issue #217). Says whether the switch exists
 * on this instance (the ENABLE_DEVELOPER_MODE environment flag), whether it is on, and lets an
 * admin flip it. Test instances only: later iterations use the switch to create fake data.
 */
export default function DeveloperModePage(): React.JSX.Element {
  const { data: systemInfo } = useSystemInfo();
  const { data: status } = useDeveloperMode();
  // useSystemInfo always has data (it starts from initial data), so no optional chain is needed.
  const available = systemInfo.enableDeveloperMode === true;
  // Stryker disable next-line OptionalChaining : the query's initial data is never undefined
  const on = status?.on === true;

  const mutation = useBackendMutation<boolean, DeveloperModeStatus>(
    (turnOn) => ({
      url: "/api/admin/developerMode",
      method: "PUT",
      params: { on: turnOn },
    }),
    {
      onSuccess: (result) =>
        toast(
          result.on
            ? "Developer mode is now on."
            : "Developer mode is now off.",
        ),
    },
    [DEVELOPER_MODE_KEY],
  );

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="DeveloperModePage">
        <h1>Developer Mode</h1>
        <p>
          Developer mode is for <strong>test instances only</strong>. While it
          is on, a red <Badge bg="danger">Developer Mode</Badge> badge appears
          in the footer of every page, and later features let admins fill the
          app with fake data (recruitments, applications and rankings) to try
          out every part of it without a real hiring cycle. It must never be
          turned on in production.
        </p>
        <p className="text-muted small">
          Two things have to be true for it to be on: the instance must be
          started with <code>ENABLE_DEVELOPER_MODE=true</code>, which makes this
          switch available, and the switch itself must be on. Flipping the
          switch is not recorded in any change history.
        </p>
        {available ? (
          <>
            <p data-testid="DeveloperModePage-available">
              The Developer Mode switch is available on this instance.
            </p>
            <Form.Check
              type="switch"
              id="DeveloperModePage-switch"
              label={on ? "Developer mode is on" : "Developer mode is off"}
              checked={on}
              disabled={mutation.isPending}
              onChange={(event) => mutation.mutate(event.target.checked)}
              data-testid="DeveloperModePage-switch"
            />
          </>
        ) : (
          <Alert
            variant="secondary"
            data-testid="DeveloperModePage-unavailable"
          >
            The Developer Mode switch is not available on this instance: it was
            started without <code>ENABLE_DEVELOPER_MODE=true</code>. That is the
            right setting for production.
          </Alert>
        )}
      </div>
    </BasicLayout>
  );
}
