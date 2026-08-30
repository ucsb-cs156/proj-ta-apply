import { Button, Navbar } from "react-bootstrap";
import { Link } from "react-router";
import HelpMenu from "main/components/Nav/HelpMenu";
import { useCurrentUser } from "main/utils/currentUser";

type GoogleLoginProps = {
  currentUser: ReturnType<typeof useCurrentUser>;
  handleLogin: () => void;
  doLogout: () => void;
};

export default function GoogleLogin({
  currentUser,
  handleLogin,
  doLogout,
}: GoogleLoginProps): React.JSX.Element {
  return (
    <>
      {currentUser && currentUser.loggedIn ? (
        <>
          <Navbar.Text className="me-3" as={Link} to="/profile">
            Welcome, {currentUser.root.user.email}
          </Navbar.Text>
          <HelpMenu />
          <Button onClick={doLogout}>Log Out</Button>
        </>
      ) : (
        <>
          <HelpMenu />
          <Button onClick={handleLogin}>Log In</Button>
        </>
      )}
    </>
  );
}
