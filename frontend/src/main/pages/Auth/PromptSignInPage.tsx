import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { Alert, Row } from "react-bootstrap";
import { useLocation } from "react-router";
import LoginScreen from "main/components/Auth/LoginScreen";

export default function PromptSignInPage(): React.JSX.Element {
  const location = useLocation();

  const setRedirect = () => {
    sessionStorage.setItem("redirect", location.pathname);
  };

  return (
    <BasicLayout>
      <Row className="p-3">
        <Alert variant={"danger"}>
          Please sign in before accessing this page.
        </Alert>
      </Row>
      <LoginScreen onLogin={setRedirect} />
    </BasicLayout>
  );
}
