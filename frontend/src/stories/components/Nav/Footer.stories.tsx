import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { Button } from "react-bootstrap";
import Footer from "main/components/Nav/Footer";
import { DeveloperModeFooterControlsContext } from "main/utils/developerModeFooter";

const meta: Meta<typeof Footer> = {
  title: "components/Nav/Footer",
  component: Footer,
  parameters: {
    layout: "fullscreen",
    msw: {
      handlers: [
        http.get("/api/developerMode", () =>
          HttpResponse.json({ available: false, on: false }),
        ),
      ],
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {};

/** Developer mode is on (issue #217): the red badge sits flush right. */
export const DeveloperModeOn: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/developerMode", () =>
          HttpResponse.json({ available: true, on: true }),
        ),
      ],
    },
  },
};

/** A page has registered controls for the slot to the right of the badge. */
export const DeveloperModeOnWithControls: Story = {
  parameters: DeveloperModeOn.parameters,
  render: () => (
    <DeveloperModeFooterControlsContext.Provider
      value={
        <Button size="sm" variant="outline-danger">
          Create Fake Things
        </Button>
      }
    >
      <Footer />
    </DeveloperModeFooterControlsContext.Provider>
  ),
};
