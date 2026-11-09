import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminsIndexPage from "main/pages/Admin/AdminsIndexPage";
import AdminsCreatePage from "main/pages/Admin/AdminsCreatePage";
import InstructorsIndexPage from "main/pages/Admin/InstructorsIndexPage";
import InstructorsCreatePage from "main/pages/Admin/InstructorsCreatePage";
import CoursesIndexPage from "main/pages/Admin/CoursesIndexPage";
import QuartersPage from "main/pages/Admin/QuartersPage";
import BudgetSelectQuarterPage from "main/pages/Admin/BudgetSelectQuarterPage";
import BudgetPage from "main/pages/Admin/BudgetPage";
import CombinedAllocationsPage from "main/pages/Admin/CombinedAllocationsPage";
import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import RecruitmentCoursesEditPage from "main/pages/Admin/RecruitmentCoursesEditPage";
import ProtectedPage from "main/pages/Auth/ProtectedPage";
import NotFoundPage from "main/pages/Auth/NotFoundPage";
import AboutTaApply from "main/pages/Help/AboutTaApply";
import HelpTaApplicantsPage from "main/pages/Help/HelpTaApplicantsPage";
import HelpUlaApplicantsPage from "main/pages/Help/HelpUlaApplicantsPage";
import HelpInstructorsPage from "main/pages/Help/HelpInstructorsPage";
import HelpAdminsPage from "main/pages/Help/HelpAdminsPage";
import HelpDeveloperPage from "main/pages/Help/HelpDeveloperPage";
import HelpNoticeFieldsPage from "main/pages/Help/HelpNoticeFieldsPage";
import HelpCsvPage from "main/pages/Help/HelpCsvPage";
import HelpInstructorFeedbackFieldsPage from "main/pages/Help/HelpInstructorFeedbackFieldsPage";
import HelpRecruitmentStepsPage from "main/pages/Help/HelpRecruitmentStepsPage";
import SignInPage from "main/pages/Auth/SignInPage";
import SignInSuccessPage from "main/pages/Auth/SignInSuccessPage";
import UnauthorizedPage from "main/pages/Auth/UnauthorizedPage";

import { useCurrentUser } from "main/utils/currentUser";
import DeveloperModeFooterProvider from "main/components/Nav/DeveloperModeFooterProvider";
import AdminDeveloperPage from "main/pages/Admin/AdminDeveloperPage";
import DeveloperModePage from "main/pages/Admin/DeveloperModePage";
import AdminUsersPage from "main/pages/Admin/AdminUsersPage";

import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import HomePageLoggedOut from "main/pages/Home/HomePageLoggedOut";
import AdminJobsPage from "main/pages/Admin/AdminJobsPage";
import ApplyPage from "main/pages/Applications/ApplyPage";
import ApplicationPage from "main/pages/Applications/ApplicationPage";
import TestApplicationPage from "main/pages/Admin/TestApplicationPage";
import RecruitmentApplicationsPage from "main/pages/Admin/RecruitmentApplicationsPage";
import AdminAssignmentsPage from "main/pages/Admin/AdminAssignmentsPage";
import AdminApplicationPage from "main/pages/Admin/AdminApplicationPage";
import RecruitmentDraftApplicationsPage from "main/pages/Admin/RecruitmentDraftApplicationsPage";
import RecruitmentHistoryPage from "main/pages/Admin/RecruitmentHistoryPage";
import AdminApplicationEditPage from "main/pages/Admin/AdminApplicationEditPage";
import TaAppSettingsPage from "main/pages/Admin/TaAppSettingsPage";
import UlaAppSettingsPage from "main/pages/Admin/UlaAppSettingsPage";
import InstructorFeedbackSettingsPage from "main/pages/Admin/InstructorFeedbackSettingsPage";
import LegacyTaApplicationPage from "main/pages/Admin/LegacyTaApplicationPage";
import AuditTrailPage from "main/pages/Admin/AuditTrailPage";
import CandidateRankingPage from "main/pages/Instructor/CandidateRankingPage";
import CandidateApplicationPage from "main/pages/Instructor/CandidateApplicationPage";
import CoursesPage from "main/pages/Instructor/CoursesPage";
import PublishedAssignmentsPage from "main/pages/Assignments/PublishedAssignmentsPage";

/** Any signed-in user may apply; there is no separate applicant role. */
const APPLICANT_ROLES = ["ROLE_USER"];

/** Old links to /recruitments/:id/allocations keep working: they land on the Courses page. */
function AllocationsToCoursesRedirect(): React.JSX.Element {
  const { recruitmentId } = useParams();
  return <Navigate to={`/recruitments/${recruitmentId}/courses`} replace />;
}

export default function App() {
  const currentUser = useCurrentUser();

  const homePage = currentUser.loggedIn ? (
    <HomePageLoggedIn />
  ) : (
    <HomePageLoggedOut />
  );

  return (
    // The provider wraps every page, so any page may register controls for the footer's
    // developer-mode slot (issue #219); the footer BasicLayout renders reads the same slot.
    <DeveloperModeFooterProvider>
      <BrowserRouter>
        {/* Renders every react-toastify toast() call; without it they are silent no-ops. */}
        <ToastContainer />
        <Routes>
          <Route path="/" element={homePage} />
          <Route path="/help/about" element={<AboutTaApply />} />
          <Route
            path="/help/ta-applicants"
            element={<HelpTaApplicantsPage />}
          />
          <Route
            path="/help/ula-applicants"
            element={<HelpUlaApplicantsPage />}
          />
          <Route
            path="/help/instructors"
            element={
              <ProtectedPage
                component={<HelpInstructorsPage />}
                enforceRole={"ROLE_INSTRUCTOR"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/help/admins"
            element={
              <ProtectedPage
                component={<HelpAdminsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/help/developer"
            element={
              <ProtectedPage
                component={<HelpDeveloperPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/help/recruitment-steps"
            element={
              <ProtectedPage
                component={<HelpRecruitmentStepsPage />}
                enforceRole={["ROLE_ADMIN", "ROLE_INSTRUCTOR"]}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/help/notice-fields"
            element={
              <ProtectedPage
                component={<HelpNoticeFieldsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/help/csv"
            element={
              <ProtectedPage
                component={<HelpCsvPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/help/instructor-feedback-fields"
            element={
              <ProtectedPage
                component={<HelpInstructorFeedbackFieldsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route path="/login" element={<SignInPage />} />
          <Route path="/login/success" element={<SignInSuccessPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route
            path="/apply/:recruitmentId"
            element={
              <ProtectedPage
                component={<ApplyPage />}
                enforceRole={APPLICANT_ROLES}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/applications/:id"
            element={
              <ProtectedPage
                component={<ApplicationPage />}
                enforceRole={APPLICANT_ROLES}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/admins"
            element={
              <ProtectedPage
                component={<AdminsIndexPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/instructors"
            element={
              <ProtectedPage
                component={<InstructorsIndexPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/admins/create"
            element={
              <ProtectedPage
                component={<AdminsCreatePage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/instructors/create"
            element={
              <ProtectedPage
                component={<InstructorsCreatePage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/courses"
            element={
              <ProtectedPage
                component={<CoursesIndexPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/quarters"
            element={
              <ProtectedPage
                component={<QuartersPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/budget/selectQuarter"
            element={
              <ProtectedPage
                component={<BudgetSelectQuarterPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/allocations/:qyy"
            element={
              <ProtectedPage
                component={<CombinedAllocationsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/budget/:qyy"
            element={
              <ProtectedPage
                component={<BudgetPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/recruitments/:recruitmentId/courses"
            element={
              <ProtectedPage
                component={<RecruitmentCoursesPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/recruitments/:recruitmentId/courses/edit"
            element={
              <ProtectedPage
                component={<RecruitmentCoursesEditPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/recruitments/:recruitmentId/courses/:recruitmentCourseId/applications/:applicationId"
            element={
              <ProtectedPage
                component={<CandidateApplicationPage />}
                enforceRole={["ROLE_INSTRUCTOR", "ROLE_ADMIN"]}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/recruitments/:recruitmentId/courses"
            element={
              <ProtectedPage
                component={<CoursesPage />}
                enforceRole={["ROLE_INSTRUCTOR", "ROLE_ADMIN"]}
                currentUser={currentUser}
              />
            }
          />
          {/* The All Allocations page (issue #224) became the Courses page (issue #300). */}
          <Route
            path="/recruitments/:recruitmentId/allocations"
            element={<AllocationsToCoursesRedirect />}
          />
          <Route
            path="/recruitments/:recruitmentId/assignments"
            element={
              <ProtectedPage
                component={<PublishedAssignmentsPage />}
                enforceRole={["ROLE_INSTRUCTOR", "ROLE_ADMIN"]}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/recruitments/:recruitmentId/courses/:recruitmentCourseId/ranking"
            element={
              <ProtectedPage
                component={<CandidateRankingPage />}
                enforceRole={["ROLE_INSTRUCTOR", "ROLE_ADMIN"]}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/recruitments/:recruitmentId/applications"
            element={
              <ProtectedPage
                component={<RecruitmentApplicationsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/recruitments/:recruitmentId/draft-applications"
            element={
              <ProtectedPage
                component={<RecruitmentDraftApplicationsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/recruitments/:recruitmentId/history"
            element={
              <ProtectedPage
                component={<RecruitmentHistoryPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/draft-applications/:id"
            element={
              <ProtectedPage
                component={<AdminApplicationPage draft />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/recruitments/:recruitmentId/assignments"
            element={
              <ProtectedPage
                component={<AdminAssignmentsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/applications/:id"
            element={
              <ProtectedPage
                component={<AdminApplicationPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/applications/:id/edit"
            element={
              <ProtectedPage
                component={<AdminApplicationEditPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/recruitments/:recruitmentId/test-application"
            element={
              <ProtectedPage
                component={<TestApplicationPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/settings/ta"
            element={
              <ProtectedPage
                component={<TaAppSettingsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/settings/ula"
            element={
              <ProtectedPage
                component={<UlaAppSettingsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/instructorFeedbackSettings"
            element={
              <ProtectedPage
                component={<InstructorFeedbackSettingsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/legacy-ta-application"
            element={
              <ProtectedPage
                component={<LegacyTaApplicationPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/audittrail"
            element={
              <ProtectedPage
                component={<AuditTrailPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedPage
                component={<AdminUsersPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/developer"
            element={
              <ProtectedPage
                component={<AdminDeveloperPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/developer-mode"
            element={
              <ProtectedPage
                component={<DeveloperModePage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/admin/jobs"
            element={
              <ProtectedPage
                component={<AdminJobsPage />}
                enforceRole={"ROLE_ADMIN"}
                currentUser={currentUser}
              />
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </DeveloperModeFooterProvider>
  );
}
