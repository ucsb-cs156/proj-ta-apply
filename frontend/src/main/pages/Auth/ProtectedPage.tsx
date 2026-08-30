import type { ReactNode } from "react";
import { hasRole, useCurrentUser } from "main/utils/currentUser";
import AccessDeniedPage from "main/pages/Auth/AccessDeniedPage";
import PromptSignInPage from "main/pages/Auth/PromptSignInPage";
import LoadingPage from "main/pages/Auth/LoadingPage";

type ProtectedPageProps = {
  component?: ReactNode;
  currentUser: ReturnType<typeof useCurrentUser> & { initialData?: boolean };
  enforceRole: string;
};

export default function ProtectedPage({
  component,
  currentUser,
  enforceRole,
}: ProtectedPageProps): React.JSX.Element {
  if (currentUser.initialData) {
    return <LoadingPage />;
  }
  if (hasRole(currentUser, enforceRole)) {
    return <>{component}</>;
  } else if (!currentUser.loggedIn) {
    return <PromptSignInPage />;
  } else {
    return <AccessDeniedPage />;
  }
}
