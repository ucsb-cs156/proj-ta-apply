import React from "react";

import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useCurrentUser, hasRole } from "main/utils/currentUser";

export default function HomePageLoggedIn() {
  const currentUser = useCurrentUser();

  const isAdmin = hasRole(currentUser, "ROLE_ADMIN");
  const isInstructor = hasRole(currentUser, "ROLE_INSTRUCTOR");
  const isGradStudent = hasRole(currentUser, "ROLE_GRAD_STUDENT");

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>TA Apply</h1>
        <p data-testid="HomePageLoggedIn-greeting">
          Welcome, {currentUser.root?.user?.givenName ?? "Gaucho"}.
        </p>

        {isAdmin && (
          <p data-testid="HomePageLoggedIn-admin">
            You are an admin. Use the Admin menu to manage instructors and grad
            students.
          </p>
        )}
        {isInstructor && (
          <p data-testid="HomePageLoggedIn-instructor">
            You are an instructor.
          </p>
        )}
        {isGradStudent && (
          <p data-testid="HomePageLoggedIn-gradstudent">
            You are a grad student, so you will be able to apply for TA
            positions once applications open.
          </p>
        )}
        {!isGradStudent && (
          <p data-testid="HomePageLoggedIn-undergrad">
            You will be able to apply for ULA positions once applications open.
          </p>
        )}
      </div>
    </BasicLayout>
  );
}
