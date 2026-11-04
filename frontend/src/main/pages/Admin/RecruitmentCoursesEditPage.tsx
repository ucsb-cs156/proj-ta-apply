import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";

/**
 * The edit page for one recruitment's courses (issue #278):
 * /admin/recruitments/:recruitmentId/courses/edit. Only one tab or window should have it open at a
 * time; see {@link RecruitmentCoursesPage}.
 */
export default function RecruitmentCoursesEditPage(): React.JSX.Element {
  return <RecruitmentCoursesPage edit />;
}
