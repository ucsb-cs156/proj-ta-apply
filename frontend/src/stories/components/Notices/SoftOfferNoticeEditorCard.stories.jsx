import React from "react";
import { HttpResponse, http } from "msw";
import SoftOfferNoticeEditorCard from "main/components/Notices/SoftOfferNoticeEditorCard";
import softOfferNoticeFixtures from "fixtures/softOfferNoticeFixtures";
import quartersFixtures from "fixtures/quartersFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const save = http.post("/api/admin/softOfferNotices", async ({ request }) => {
  const body = await request.json();
  return HttpResponse.json({
    id: 3,
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
  title: "components/Notices/SoftOfferNoticeEditorCard",
  component: SoftOfferNoticeEditorCard,
};

const Template = (args) => <SoftOfferNoticeEditorCard {...args} />;

export const WithHistory = Template.bind({});
WithHistory.parameters = {
  msw: {
    handlers: [
      http.get("/api/admin/softOfferNotices/all", () =>
        HttpResponse.json(softOfferNoticeFixtures.history),
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
      http.get("/api/admin/softOfferNotices/all", () => HttpResponse.json([])),
      save,
      ...previewData,
    ],
  },
};
