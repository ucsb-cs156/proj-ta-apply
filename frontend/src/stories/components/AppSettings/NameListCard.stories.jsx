import React from "react";
import { HttpResponse, http } from "msw";
import NameListCard from "main/components/AppSettings/NameListCard";
import appSettingsFixtures from "fixtures/appSettingsFixtures";

const handlers = (items) => [
  http.get("/api/admin/settings/ta-majors/all", () => HttpResponse.json(items)),
  http.post("/api/admin/settings/ta-majors/post", () =>
    HttpResponse.json({ name: "Mathematics" }),
  ),
  http.put("/api/admin/settings/ta-majors", () =>
    HttpResponse.json({ name: "Renamed" }),
  ),
  http.delete("/api/admin/settings/ta-majors/delete", () =>
    HttpResponse.json({ message: "removed from ta-majors" }),
  ),
];

export default {
  title: "components/AppSettings/NameListCard",
  component: NameListCard,
  args: {
    title: "Majors List for TAs",
    itemLabel: "major",
    listKey: "ta-majors",
  },
};

const Template = (args) => <NameListCard {...args} />;

export const ThreeNames = Template.bind({});
ThreeNames.parameters = {
  msw: { handlers: handlers(appSettingsFixtures.threeMajors) },
};

export const Empty = Template.bind({});
Empty.parameters = { msw: { handlers: handlers([]) } };
