import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useCurrentUser, hasRole } from "main/utils/currentUser";
import type { Application } from "main/components/Applications/ApplicationTable";
import RecruitmentsDashboard from "main/components/Recruitments/RecruitmentsDashboard";
import type { StudentRecruitment } from "main/components/Recruitments/RecruitmentTable";
import StudentDashboard from "main/components/Student/StudentDashboard";
import InstructorRecruitmentCards, {
  type InstructorRecruitment,
} from "main/components/Instructor/InstructorRecruitmentCards";
import { useBackend } from "main/utils/useBackend";

/**
 * The home page, in a section per role (issue #107): Admin (the recruitments, whole, as issue #141
 * asks: the former Admin > Recruitments page, with its create button and cards) for an admin,
 * Instructor for an instructor, and Student for everyone, since any signed-in user may apply. No
 * page title or greeting (issue #118): the navbar already says where you are and who you are.
 */
export default function HomePageLoggedIn(): React.JSX.Element {
  const currentUser = useCurrentUser();

  const isAdmin = hasRole(currentUser, "ROLE_ADMIN");
  const isInstructor = hasRole(currentUser, "ROLE_INSTRUCTOR");

  // The instructor's recruitments are looked up by email (issue #127); only an instructor asks.
  // Stryker disable next-line all : a logged-out user is never an instructor, so the fallback is dead
  const email = currentUser.loggedIn ? currentUser.root.user.email : "";
  const { data: instructorRecruitments } = useBackend<InstructorRecruitment[]>(
    ["/api/instructor/recruitments", email],
    {
      method: "GET",
      url: "/api/instructor/recruitments",
      params: { email },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    // Stryker disable next-line all : the guard only avoids a request the backend would refuse
    { enabled: isInstructor },
  );

  // Everyone signed in is a student as far as applying goes; nothing is asked until the user has
  // loaded, so that a page shown to nobody asks the backend for nothing.
  // Stryker disable next-line all : the guard only avoids pointless requests
  const options = { enabled: currentUser.loggedIn };
  const { data: recruitments } = useBackend<StudentRecruitment[]>(
    ["/api/recruitments/applicable"],
    { method: "GET", url: "/api/recruitments/applicable" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    options,
  );
  const { data: applications } = useBackend<Application[]>(
    ["/api/applications/mine"],
    { method: "GET", url: "/api/applications/mine" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    options,
  );

  // The Student heading only earns its place when there is another section to tell it from
  // (issue #118); a plain student's page is the student section and nothing else.
  const otherSections = isAdmin || isInstructor;

  return (
    <BasicLayout>
      <div className="pt-2">
        {isAdmin && (
          <section className="mb-4" data-testid="HomePageLoggedIn-admin">
            <h2>Admin</h2>
            <RecruitmentsDashboard testIdPrefix="HomePageLoggedIn-admin" />
          </section>
        )}

        {isInstructor && (
          <section className="mb-4" data-testid="HomePageLoggedIn-instructor">
            <h2>Instructor</h2>
            <h3 className="h5 mt-3">Recruitments for Courses You Teach</h3>
            {(instructorRecruitments ?? []).length === 0 ? (
              <p data-testid="HomePageLoggedIn-instructor-none">
                No recruitment includes a course you are listed as teaching.
                Courses are matched by the catalog name an admin has assigned to
                you.
              </p>
            ) : (
              <InstructorRecruitmentCards
                recruitments={instructorRecruitments ?? []}
                testIdPrefix="HomePageLoggedIn-instructor-recruitments"
              />
            )}
          </section>
        )}

        <section data-testid="HomePageLoggedIn-student">
          {otherSections && <h2>Student</h2>}
          <StudentDashboard
            recruitments={recruitments ?? []}
            applications={applications ?? []}
            testIdPrefix="HomePageLoggedIn-dashboard"
          />
        </section>
      </div>
    </BasicLayout>
  );
}
