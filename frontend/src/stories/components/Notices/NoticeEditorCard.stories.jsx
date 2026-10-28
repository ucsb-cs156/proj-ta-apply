import React from "react";
import { HttpResponse, http } from "msw";
import NoticeEditorCard from "main/components/Notices/NoticeEditorCard";
import noticesFixtures from "fixtures/noticesFixtures";

const save = http.post("/api/admin/notices", async ({ request }) => {
  const body = await request.json();
  return HttpResponse.json({
    id: 3,
    type: "TA",
    content: body.content,
    createdAt: new Date().toISOString().slice(0, 19),
  });
});

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
    ],
  },
};
