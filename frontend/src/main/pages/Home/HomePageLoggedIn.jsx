import React from "react";

import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useCurrentUser, hasRole } from "main/utils/currentUser";
import ApplicantDashboard from "main/components/Applications/ApplicantDashboard";
import { useBackend } from "main/utils/useBackend";

export default function HomePageLoggedIn() {
  const currentUser = useCurrentUser();

  const isAdmin = hasRole(currentUser, "ROLE_ADMIN");
  const isInstructor = hasRole(currentUser, "ROLE_INSTRUCTOR");
  const isGradStudent = hasRole(currentUser, "ROLE_GRAD_STUDENT");
  // Granted by the backend to a UCSB address holding none of the other roles.
  const isUndergrad = hasRole(currentUser, "ROLE_UNDERGRAD");

  // Grad students apply for TA positions, undergrads for ULA ones. The backend filters every
  // one of these responses to that same type, so nothing here can widen it.
  const isApplicant = isGradStudent || isUndergrad;
  const applicantType = isGradStudent ? "TA" : "ULA";

  // Every one of these is filtered server side to the type this user may apply to, and skipped
  // entirely for anyone who is not an applicant.
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
            You are an admin. Use the Admin menu to manage instructors and grad
            students.
          </p>
        )}
        {isInstructor && (
          <p data-testid="HomePageLoggedIn-instructor">
            You are an instructor.
          </p>
        )}
        {isUndergrad && (
          <div data-testid="HomePageLoggedIn-undergrad">
            <p>If you:</p>
            <ul>
              <li>
                are an instructor that needs to review TA/ULA applications
              </li>
              <li>are a grad student that wants to apply for TA positions</li>
            </ul>
            <p>
              Please request instructor or grad student access. (TODO: Insert
              instructions here.)
            </p>
          </div>
        )}

        {isApplicant && (
          <ApplicantDashboard
            type={applicantType}
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
