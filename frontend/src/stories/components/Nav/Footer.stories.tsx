import type { Meta, StoryObj } from "@storybook/react";
import Footer from "main/components/Nav/Footer";

const meta: Meta<typeof Footer> = {
  title: "components/Nav/Footer",
  component: Footer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {};
