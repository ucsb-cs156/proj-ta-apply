import type { ReactNode } from "react";
import { hasRole, useCurrentUser } from "main/utils/currentUser";
import AccessDeniedPage from "main/pages/Auth/AccessDeniedPage";
import PromptSignInPage from "main/pages/Auth/PromptSignInPage";
import LoadingPage from "main/pages/Auth/LoadingPage";

type ProtectedPageProps = {
  component?: ReactNode;
  currentUser: ReturnType<typeof useCurrentUser> & { initialData?: boolean };
  /** One role, or several any of which is enough. */
  enforceRole: string | string[];
};

export default function ProtectedPage({
  component,
  currentUser,
  enforceRole,
}: ProtectedPageProps): React.JSX.Element {
  if (currentUser.initialData) {
    return <LoadingPage />;
  }
  const acceptedRoles = Array.isArray(enforceRole)
    ? enforceRole
    : [enforceRole];
  if (acceptedRoles.some((role) => hasRole(currentUser, role))) {
    return <>{component}</>;
  } else if (!currentUser.loggedIn) {
    return <PromptSignInPage />;
  } else {
    return <AccessDeniedPage />;
  }
}
