import React from "react";
import { HttpResponse, http } from "msw";
import { expect, within } from "storybook/test";
import AboutTaApply from "main/pages/Help/AboutTaApply";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Help/AboutTaApply",
  component: AboutTaApply,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () => {
          return HttpResponse.json(apiCurrentUserFixtures.userOnly);
        }),
        http.get("/api/systemInfo", () => {
          return HttpResponse.json(systemInfoFixtures.showingNeither);
        }),
      ],
    },
  },
};

const Template = () => <AboutTaApply />;

export const Default = Template.bind({});

Default.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(
    await canvas.findByRole("heading", { level: 1, name: "About TA Apply" }),
  ).toBeInTheDocument();
};
