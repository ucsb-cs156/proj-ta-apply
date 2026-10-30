import { NavDropdown } from "react-bootstrap";
import { Link } from "react-router";
import { hasRole, type CurrentUser } from "main/utils/currentUser";

type HelpMenuProps = {
  /** Who is looking, so the admin-only pages are offered only to an admin. Nobody, if omitted. */
  currentUser?: CurrentUser;
};

export default function HelpMenu({
  currentUser,
}: HelpMenuProps): React.JSX.Element {
  // The CSV formats page documents admin-only uploads and downloads (issue #99); its route is
  // admin-only too, so listing it for anyone else would only lead them to an access-denied page.
  const isAdmin = hasRole(currentUser, "ROLE_ADMIN");

  return (
    <>
      <NavDropdown
        title="Help"
        id="appnavbar-help-dropdown"
        data-testid="appnavbar-help-dropdown"
        className="narrow-dropdown" // Add the custom class
        align="end" // Align the menu to the right
      >
        <NavDropdown.Item as={Link} to="/help/about">
          About TA Apply
        </NavDropdown.Item>
        {isAdmin && (
          <NavDropdown.Item as={Link} to="/help/csv">
            CSV Upload/Download Formats
          </NavDropdown.Item>
        )}
      </NavDropdown>
    </>
  );
}
