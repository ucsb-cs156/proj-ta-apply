/**
 * One sentence on each step of a recruitment, and the section of Help → For Admins that says more
 * about it, for the Recruitment Steps help page (issue #232).
 */
export const STEP_EXPLANATIONS: {
  number: number;
  text: string;
  adminHref: string;
}[] = [
  {
    number: 1,
    text: "From the Recruitments section of your home page, create a recruitment for a quarter and a type; its course list is filled in from the quarter's schedule.",
    adminHref: "/help/admins#recruitments",
  },
  {
    number: 2,
    text: "Applicants can submit applications, and edit them until the primary consideration date.",
    adminHref: "/help/admins#open-close-applications",
  },
  {
    number: 3,
    text: "Set the hiring target and give each course its share on the Courses page, checking the money on the Budget for Quarter page.",
    adminHref: "/help/admins#budget",
  },
  {
    number: 4,
    text: "Applicants can no longer submit or edit; every application is kept, and the recruitment can be opened again.",
    adminHref: "/help/admins#open-close-applications",
  },
  {
    number: 5,
    text: "Choose who sees the allocations: admins only, each faculty member for their own courses, or all faculty for all courses.",
    adminHref: "/help/admins#allocation-visibility",
  },
  {
    number: 6,
    text: "Faculty see the candidates for their courses and enter rankings, until the deadline you give.",
    adminHref: "/help/admins#faculty-reviews",
  },
  {
    number: 7,
    text: "Faculty can no longer change their rankings; what they ranked is kept.",
    adminHref: "/help/admins#faculty-reviews",
  },
  {
    number: 8,
    text: "Use the faculty rankings to tentatively assign candidates to the courses' slots.",
    adminHref: "/help/admins#assignments",
  },
  {
    number: 9,
    text: "Publish the assignments to admins and faculty, and download the CSV for the financial office.",
    adminHref: "/help/admins#publish-assignments",
  },
];
