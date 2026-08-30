import { useEffect } from "react";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useNavigate } from "react-router";

export default function SignInSuccessPage(): React.JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    const storedReturn = sessionStorage.getItem("redirect");
    sessionStorage.removeItem("redirect");
    navigate(storedReturn ?? "/");
  }, [navigate]);

  return (
    <BasicLayout>
      <h1>Redirecting...</h1>
    </BasicLayout>
  );
}
