import React from "react";
import { HttpResponse, http } from "msw";
import LegacyApplicationsUploadCard from "main/components/Applications/LegacyApplicationsUploadCard";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

export default {
  title: "components/Applications/LegacyApplicationsUploadCard",
  component: LegacyApplicationsUploadCard,
};

const Template = (args) => <LegacyApplicationsUploadCard {...args} />;

/** Two TA recruitments to choose from; an upload reports two added and one skipped. */
export const WithTaRecruitments = Template.bind({});
WithTaRecruitments.parameters = {
  msw: {
    handlers: [
      http.get("/api/admin/recruitments/all", () =>
        HttpResponse.json(recruitmentsFixtures.threeRecruitments),
      ),
      http.post("/api/admin/applications/legacy/upload", () =>
        HttpResponse.json({
          inserted: 2,
          alreadyPresent: 0,
          skipped: 1,
          problems: ["row 4: no usable email address"],
          addedTopics: ["Python", "Unix/Linux"],
        }),
      ),
    ],
  },
};

/** Nothing to import into until a TA recruitment exists. */
export const NoTaRecruitments = Template.bind({});
NoTaRecruitments.parameters = {
  msw: {
    handlers: [
      http.get("/api/admin/recruitments/all", () =>
        HttpResponse.json([recruitmentsFixtures.threeRecruitments[1]]),
      ),
    ],
  },
};

/** The same card for the ULA form's responses; its import adds to two lists. */
export const UlaFormResponses = Template.bind({});
UlaFormResponses.args = { type: "ULA" };
UlaFormResponses.parameters = {
  msw: {
    handlers: [
      http.get("/api/admin/recruitments/all", () =>
        HttpResponse.json(recruitmentsFixtures.threeRecruitments),
      ),
      http.post("/api/admin/applications/legacy-ula/upload", () =>
        HttpResponse.json({
          inserted: 82,
          alreadyPresent: 0,
          skipped: 0,
          problems: [],
          addedTopics: ["Jupyter Notebooks", "React"],
          addedInterests: ["Exploring teaching as a career option"],
        }),
      ),
    ],
  },
};
