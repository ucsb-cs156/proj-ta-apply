import React from "react";
import { HttpResponse, http } from "msw";
import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

// S26 TA not yet opened; W26 ULA open; W26 TA closed on 2026-02-01.
const three = recruitmentsFixtures.threeRecruitments;

const handlers = (user, backend = {}) => [
  http.get("/api/currentUser", () => HttpResponse.json(user)),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/recruitments/all", () => HttpResponse.json(three)),
  http.get("/api/admin/recruitments/applicationCounts", () =>
    HttpResponse.json({ 1: 15, 2: 1, 3: 0 }),
  ),
  http.post("/api/admin/recruitments/post", () => HttpResponse.json({ id: 4 })),
  http.put("/api/admin/recruitments/status", () => HttpResponse.json({})),
  http.delete("/api/admin/recruitments/delete", () =>
    HttpResponse.json({ message: "deleted" }),
  ),
  http.get("/api/recruitments/applicable", () =>
    HttpResponse.json(backend.recruitments ?? []),
  ),
  http.get("/api/applications/mine", () =>
    HttpResponse.json(backend.applications ?? []),
  ),
  http.get("/api/instructor/recruitments", () =>
    HttpResponse.json(backend.instructorRecruitments ?? []),
  ),
  http.put("/api/applications/cancel", () =>
    HttpResponse.json(applicationsFixtures.oneCancelledApplication),
  ),
];

export default {
  title: "pages/Home/HomePageLoggedIn",
  component: HomePageLoggedIn,
};

const Template = () => <HomePageLoggedIn />;

/** Nothing upcoming, open or recently closed. */
export const NothingOpen = Template.bind({});
NothingOpen.parameters = {
  msw: { handlers: handlers(apiCurrentUserFixtures.userOnly) },
};

/** All three parts: an upcoming recruitment, cards to apply to, and (if old enough) past ones. */
export const Student = Template.bind({});
Student.parameters = {
  msw: {
    handlers: handlers(apiCurrentUserFixtures.userOnly, {
      recruitments: three,
    }),
  },
};

/** Applied to both current recruitments: View/Edit, View/Comment and Cancel buttons. */
export const StudentWithApplications = Template.bind({});
StudentWithApplications.parameters = {
  msw: {
    handlers: handlers(apiCurrentUserFixtures.userOnly, {
      recruitments: three,
      applications: applicationsFixtures.twoApplications,
    }),
  },
};

/** An admin gets the Admin section with the whole recruitments dashboard, and is a student too. */
export const Admin = Template.bind({});
Admin.parameters = {
  msw: {
    handlers: handlers(apiCurrentUserFixtures.adminUser, {
      recruitments: three,
    }),
  },
};

/** An instructor with no catalog name yet, or no courses in any recruitment. */
export const Instructor = Template.bind({});
Instructor.parameters = {
  msw: { handlers: handlers(apiCurrentUserFixtures.instructorUser) },
};

/** An instructor whose courses are in two recruitments: a card each, with nested accordions. */
export const InstructorWithCourses = Template.bind({});
InstructorWithCourses.parameters = {
  msw: {
    handlers: handlers(apiCurrentUserFixtures.instructorUser, {
      recruitments: three,
      instructorRecruitments: instructorRecruitmentsFixtures.twoRecruitments,
    }),
  },
};
