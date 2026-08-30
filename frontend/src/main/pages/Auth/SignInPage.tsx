import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { Alert, Row } from "react-bootstrap";
import { useSearchParams } from "react-router";
import LoginScreen from "main/components/Auth/LoginScreen";

export default function SignInPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();

  return (
    <BasicLayout>
      {searchParams.has("error") && (
        <Row className="p-3">
          <Alert variant={"danger"}>Sign in failed. Please try again.</Alert>
        </Row>
      )}
      <LoginScreen />
    </BasicLayout>
  );
}
