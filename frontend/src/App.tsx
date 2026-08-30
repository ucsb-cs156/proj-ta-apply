import { BrowserRouter, Route, Routes } from "react-router";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminsIndexPage from "main/pages/Admin/AdminsIndexPage";
import AdminsCreatePage from "main/pages/Admin/AdminsCreatePage";
import InstructorsIndexPage from "main/pages/Admin/InstructorsIndexPage";
import InstructorsCreatePage from "main/pages/Admin/InstructorsCreatePage";
import GradStudentsIndexPage from "main/pages/Admin/GradStudentsIndexPage";
import GradStudentsCreatePage from "main/pages/Admin/GradStudentsCreatePage";
import CoursesIndexPage from "main/pages/Admin/CoursesIndexPage";
import ProtectedPage from "main/pages/Auth/ProtectedPage";
import NotFoundPage from "main/pages/Auth/NotFoundPage";
import AboutTaApply from "main/pages/Help/AboutTaApply";
import SignInPage from "main/pages/Auth/SignInPage";
import SignInSuccessPage from "main/pages/Auth/SignInSuccessPage";

import { useCurrentUser } from "main/utils/currentUser";
import AdminDeveloperPage from "main/pages/Admin/AdminDeveloperPage";
import AdminUsersPage from "main/pages/Admin/AdminUsersPage";

import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import HomePageLoggedOut from "main/pages/Home/HomePageLoggedOut";
import AdminJobsPage from "main/pages/Admin/AdminJobsPage";

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
        <Route path="/about" element={<AboutTaApply />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/login/success" element={<SignInSuccessPage />} />
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
          path="/admin/gradstudents"
          element={
            <ProtectedPage
              component={<GradStudentsIndexPage />}
              enforceRole={"ROLE_ADMIN"}
              currentUser={currentUser}
            />
          }
        />
        <Route
          path="/admin/gradstudents/create"
          element={
            <ProtectedPage
              component={<GradStudentsCreatePage />}
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
