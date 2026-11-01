import React from "react";
import { HttpResponse, http } from "msw";
import NoticeEditorCard from "main/components/Notices/NoticeEditorCard";
import noticesFixtures from "fixtures/noticesFixtures";
import quartersFixtures from "fixtures/quartersFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const save = http.post("/api/admin/notices", async ({ request }) => {
  const body = await request.json();
  return HttpResponse.json({
    id: 3,
    type: "TA",
    content: body.content,
    createdAt: new Date().toISOString().slice(0, 19),
  });
});

// The preview is filled in for a chosen quarter (issue #192), from the calendar and recruitments.
const previewData = [
  http.get("/api/admin/quarters/all", () =>
    HttpResponse.json(quartersFixtures.threeNewestFirst),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json(recruitmentsFixtures.threeRecruitments),
  ),
];

export default {
  title: "components/Notices/NoticeEditorCard",
  component: NoticeEditorCard,
  args: { type: "TA" },
};

const Template = (args) => <NoticeEditorCard {...args} />;

export const WithHistory = Template.bind({});
WithHistory.parameters = {
  msw: {
    handlers: [
      http.get("/api/admin/notices/all", () =>
        HttpResponse.json(noticesFixtures.taHistory),
      ),
      save,
      ...previewData,
    ],
  },
};

/** Fields filled in for the chosen quarter, and an unknown one shown in red (issue #192). */
export const WithFieldsAndAnUnknownOne = Template.bind({});
WithFieldsAndAnUnknownOne.parameters = {
  msw: {
    handlers: [
      http.get("/api/admin/notices/all", () =>
        HttpResponse.json([
          {
            ...noticesFixtures.taV1,
            content:
              "# Notices for ${quarter}\n\nApplications received by ${primaryConsiderationDate} get full consideration. Classes begin ${firstDayOfClasses}. The deadline is ${deadline}.",
          },
        ]),
      ),
      save,
      ...previewData,
    ],
  },
};

/** Before an admin has written anything. */
export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      http.get("/api/admin/notices/all", () => HttpResponse.json([])),
      save,
      ...previewData,
    ],
  },
};
