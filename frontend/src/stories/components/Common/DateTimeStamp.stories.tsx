import type { Meta, StoryObj } from "@storybook/react-vite";
import DateTimeStamp from "main/components/Common/DateTimeStamp";

const meta: Meta<typeof DateTimeStamp> = {
  title: "components/Common/DateTimeStamp",
  component: DateTimeStamp,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DateTimeStamp>;

/** A Pacific wall-clock stamp as the API sends it: shown as it reads, mm/dd/yy over h:mm AM/PM. */
export const Morning: Story = {
  args: { stamp: "2026-11-21T08:05:00" },
};

export const Afternoon: Story = {
  args: { stamp: "2026-07-04T15:30:00" },
};

export const Midnight: Story = {
  args: { stamp: "2026-01-01T00:00:00" },
};

/** An instant with a zone is converted to Pacific: 03:30 UTC is 7:30 PM the evening before. */
export const ZonedInstant: Story = {
  args: { stamp: "2026-11-02T03:30:00Z" },
};

/** No stamp: nothing is rendered at all. */
export const NoStamp: Story = {
  args: { stamp: null },
};
