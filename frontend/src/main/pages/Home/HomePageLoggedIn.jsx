import React from "react";

import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useCurrentUser, hasRole } from "main/utils/currentUser";
import ApplicantDashboard from "main/components/Applications/ApplicantDashboard";
import { useBackend } from "main/utils/useBackend";

export default function HomePageLoggedIn() {
  const currentUser = useCurrentUser();

  const isAdmin = hasRole(currentUser, "ROLE_ADMIN");
  const isInstructor = hasRole(currentUser, "ROLE_INSTRUCTOR");

  // There is no applicant role: a signed-in user with neither of the other two roles is a
  // student, who may apply to any open recruitment, TA or ULA. Admins and instructors have
  // their own pages and are not shown the dashboard. Until the user has loaded, nobody is.
  const isApplicant = currentUser.loggedIn && !isAdmin && !isInstructor;

  // Skipped entirely for anyone who is not shown the dashboard.
  // Stryker disable next-line all : the guard only avoids pointless requests
  const options = { enabled: isApplicant };

  const { data: open } = useBackend(
    ["/api/recruitments/open"],
    { method: "GET", url: "/api/recruitments/open" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    options,
  );
  const { data: upcoming } = useBackend(
    ["/api/recruitments/upcoming"],
    { method: "GET", url: "/api/recruitments/upcoming" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    options,
  );
  const { data: recentlyClosed } = useBackend(
    ["/api/recruitments/recentlyClosed"],
    { method: "GET", url: "/api/recruitments/recentlyClosed" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    options,
  );
  const { data: applicable } = useBackend(
    ["/api/recruitments/applicable"],
    { method: "GET", url: "/api/recruitments/applicable" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    options,
  );
  const { data: applications } = useBackend(
    ["/api/applications/mine"],
    { method: "GET", url: "/api/applications/mine" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    options,
  );

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>TA Apply</h1>
        <p data-testid="HomePageLoggedIn-greeting">
          Welcome, {currentUser.root?.user?.givenName ?? "Gaucho"}.
        </p>

        {isAdmin && (
          <p data-testid="HomePageLoggedIn-admin">
            You are an admin. Use the Admin menu to manage instructors, courses
            and recruitments.
          </p>
        )}
        {isInstructor && (
          <p data-testid="HomePageLoggedIn-instructor">
            You are an instructor.
          </p>
        )}

        {isApplicant && (
          <ApplicantDashboard
            open={open}
            upcoming={upcoming}
            recentlyClosed={recentlyClosed}
            applications={applications}
            applicable={applicable}
            testIdPrefix="HomePageLoggedIn-dashboard"
          />
        )}
      </div>
    </BasicLayout>
  );
}
