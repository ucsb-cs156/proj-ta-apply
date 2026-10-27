import React from "react";
import { HttpResponse, http } from "msw";
import CourseSectionsCard from "main/components/Applications/CourseSectionsCard";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";

export default {
  title: "components/Applications/CourseSectionsCard",
  component: CourseSectionsCard,
};

const Template = (args) => <CourseSectionsCard {...args} />;

export const LectureAndSections = Template.bind({});
LectureAndSections.args = { recruitmentId: 2, courseId: "CMPSC   156" };
LectureAndSections.parameters = {
  msw: {
    handlers: [
      http.get("/api/recruitments/sections", () =>
        HttpResponse.json(courseSectionsFixtures.cmpsc156),
      ),
    ],
  },
};

/** A section with no scheduled time is still listed, with the time columns blank. */
export const OnlineSection = Template.bind({});
OnlineSection.args = { recruitmentId: 2, courseId: "CMPSC     8" };
OnlineSection.parameters = {
  msw: {
    handlers: [
      http.get("/api/recruitments/sections", () =>
        HttpResponse.json(courseSectionsFixtures.online),
      ),
    ],
  },
};

export const NothingKnown = Template.bind({});
NothingKnown.args = { recruitmentId: 2, courseId: "CMPSC   130A" };
NothingKnown.parameters = {
  msw: {
    handlers: [
      http.get("/api/recruitments/sections", () =>
        HttpResponse.json(courseSectionsFixtures.none),
      ),
    ],
  },
};

export const LookupFailed = Template.bind({});
LookupFailed.args = { recruitmentId: 2, courseId: "CMPSC   156" };
LookupFailed.parameters = {
  msw: {
    handlers: [
      http.get("/api/recruitments/sections", () =>
        HttpResponse.json({ message: "upstream error" }, { status: 500 }),
      ),
    ],
  },
};
