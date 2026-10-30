import { NavDropdown } from "react-bootstrap";
import { Link } from "react-router";
import { hasRole, type CurrentUser } from "main/utils/currentUser";
import { HELP_PAGES } from "main/utils/helpPages";

type HelpMenuProps = {
  /** Who is looking, so the admin-only pages are offered only to an admin. Nobody, if omitted. */
  currentUser?: CurrentUser;
};

export default function HelpMenu({
  currentUser,
}: HelpMenuProps): React.JSX.Element {
  // The admin pages' routes are admin-only, and the instructors' page instructor-only, so listing
  // one for anyone else would only lead them to an access-denied page (issues #99, #140).
  const isAdmin = hasRole(currentUser, "ROLE_ADMIN");
  const isInstructor = hasRole(currentUser, "ROLE_INSTRUCTOR");
  const pages = HELP_PAGES.filter(
    (page) =>
      page.audience === "everyone" ||
      (page.audience === "admin" && isAdmin) ||
      (page.audience === "instructor" && isInstructor),
  );

  return (
    <>
      <NavDropdown
        title="Help"
        id="appnavbar-help-dropdown"
        data-testid="appnavbar-help-dropdown"
        className="narrow-dropdown" // Add the custom class
        align="end" // Align the menu to the right
      >
        {pages.map((page) => (
          <NavDropdown.Item key={page.path} as={Link} to={page.path}>
            {page.label}
          </NavDropdown.Item>
        ))}
      </NavDropdown>
    </>
  );
}
