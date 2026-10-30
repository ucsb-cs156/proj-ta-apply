import { BrowserRouter, Route, Routes } from "react-router";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminsIndexPage from "main/pages/Admin/AdminsIndexPage";
import AdminsCreatePage from "main/pages/Admin/AdminsCreatePage";
import InstructorsIndexPage from "main/pages/Admin/InstructorsIndexPage";
import InstructorsCreatePage from "main/pages/Admin/InstructorsCreatePage";
import CoursesIndexPage from "main/pages/Admin/CoursesIndexPage";
import RecruitmentsIndexPage from "main/pages/Admin/RecruitmentsIndexPage";
import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import ProtectedPage from "main/pages/Auth/ProtectedPage";
import NotFoundPage from "main/pages/Auth/NotFoundPage";
import AboutTaApply from "main/pages/Help/AboutTaApply";
import HelpTaApplicantsPage from "main/pages/Help/HelpTaApplicantsPage";
import HelpUlaApplicantsPage from "main/pages/Help/HelpUlaApplicantsPage";
import HelpInstructorsPage from "main/pages/Help/HelpInstructorsPage";
import HelpAdminsPage from "main/pages/Help/HelpAdminsPage";
import HelpCsvPage from "main/pages/Help/HelpCsvPage";
import SignInPage from "main/pages/Auth/SignInPage";
import SignInSuccessPage from "main/pages/Auth/SignInSuccessPage";
import UnauthorizedPage from "main/pages/Auth/UnauthorizedPage";

import { useCurrentUser } from "main/utils/currentUser";
import AdminDeveloperPage from "main/pages/Admin/AdminDeveloperPage";
import AdminUsersPage from "main/pages/Admin/AdminUsersPage";

import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import HomePageLoggedOut from "main/pages/Home/HomePageLoggedOut";
import AdminJobsPage from "main/pages/Admin/AdminJobsPage";
import ApplyPage from "main/pages/Applications/ApplyPage";
import ApplicationPage from "main/pages/Applications/ApplicationPage";
import TestApplicationPage from "main/pages/Admin/TestApplicationPage";
import RecruitmentApplicationsPage from "main/pages/Admin/RecruitmentApplicationsPage";
import AdminApplicationPage from "main/pages/Admin/AdminApplicationPage";
import AdminApplicationEditPage from "main/pages/Admin/AdminApplicationEditPage";
import TaAppSettingsPage from "main/pages/Admin/TaAppSettingsPage";
import UlaAppSettingsPage from "main/pages/Admin/UlaAppSettingsPage";
import LegacyTaApplicationPage from "main/pages/Admin/LegacyTaApplicationPage";
import AuditTrailPage from "main/pages/Admin/AuditTrailPage";

/** Any signed-in user may apply; there is no separate applicant role. */
const APPLICANT_ROLES = ["ROLE_USER"];

export default function App() {
  const currentUser = useCurrentUser();

  const homePage = currentUser.loggedIn ? (
    <HomePageLoggedIn />
  ) : (
    <HomePageLoggedOut />
  );

  return (
    <BrowserRouter>
      {/* Renders every react-toastify toast() call; without it they are silent no-ops. */}
      <ToastContainer />
      <Routes>
        <Route path="/" element={homePage} />
        <Route path="/help/about" element={<AboutTaApply />} />
        <Route path="/help/ta-applicants" element={<HelpTaApplicantsPage />} />
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
          path="/help/csv"
          element={
            <ProtectedPage
              component={<HelpCsvPage />}
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
          path="/admin/recruitments"
          element={
            <ProtectedPage
              component={<RecruitmentsIndexPage />}
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
  );
}
