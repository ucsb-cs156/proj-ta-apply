import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useNavigate } from "react-router";
import { Button } from "react-bootstrap";

export default function AccessDeniedPage(): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <BasicLayout>
      <h2>You do not have access to this page.</h2>
      <Button onClick={() => navigate("/")}>Return</Button>
    </BasicLayout>
  );
}
