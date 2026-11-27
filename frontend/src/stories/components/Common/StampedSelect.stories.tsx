import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import StampedSelect from "main/components/Common/StampedSelect";
import { pacificNowLocalIso } from "main/utils/pacificTime";

/** The choices of the "New Hire form done (or not needed)" column (issue #509). */
const NEW_HIRE_FORM_OPTIONS = [
  { value: "DONE", label: "Done" },
  { value: "NOT_NEEDED", label: "Not needed" },
];

const meta: Meta<typeof StampedSelect> = {
  title: "components/Common/StampedSelect",
  component: StampedSelect,
  tags: ["autodocs"],
  args: {
    id: "new-hire-form",
    label: "New Hire form done (or not needed)",
    options: NEW_HIRE_FORM_OPTIONS,
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof StampedSelect>;

/** Nothing chosen yet, so no stamp either. */
export const Blank: Story = {
  args: { value: null, stamp: null },
};

export const Done: Story = {
  args: { value: "DONE", stamp: "2026-11-21T08:05:00" },
};

export const NotNeeded: Story = {
  args: { value: "NOT_NEEDED", stamp: "2026-11-23T16:45:00" },
};

/** Disabled, for someone who may look but not edit. */
export const Disabled: Story = {
  args: { value: "DONE", stamp: "2026-11-21T08:05:00", disabled: true },
};

/** In a table whose column heading is the label: the label is only for screen readers. */
export const HiddenLabel: Story = {
  args: { value: "DONE", stamp: "2026-11-21T08:05:00", hideLabel: true },
};

/**
 * Choose and clear it. In the app the backend records the time and sends the stamp back; here a
 * stateful wrapper fakes that with the Pacific clock now.
 */
export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState<string | null>(null);
    const [stamp, setStamp] = useState<string | null>(null);
    return (
      <StampedSelect
        {...args}
        value={value}
        stamp={stamp}
        onChange={(chosen) => {
          args.onChange(chosen);
          setValue(chosen);
          setStamp(chosen === null ? null : pacificNowLocalIso());
        }}
      />
    );
  },
};
