import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useNavigate } from "react-router";
import { Button } from "react-bootstrap";

export default function NotFoundPage(): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <BasicLayout>
      <h1>Page Not Found</h1>
      <p>Let&apos;s get you back on track.</p>
      <Button onClick={() => navigate("/")}>Click to Return Home</Button>
    </BasicLayout>
  );
}
