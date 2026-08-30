import React from "react";

import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import LoginScreen from "main/components/Auth/LoginScreen";
export default function HomePageLoggedOut() {
  return (
    <BasicLayout>
      <LoginScreen />
    </BasicLayout>
  );
}
