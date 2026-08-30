import BasicLayout from "main/layouts/BasicLayout/BasicLayout";

/**
 * Where the OAuth flow lands someone who signed in with Google but holds none of the app's access
 * roles (see SecurityConfig's failureUrl and RoleAssignmentService.grantsAccess). No session was
 * ever established for them, so there is nothing to log out of.
 */
export default function UnauthorizedPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2">
        <h1 data-testid="UnauthorizedPage-message">
          You are not authorized to access this application
        </h1>
      </div>
    </BasicLayout>
  );
}
