import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import StampedCheckbox from "main/components/Common/StampedCheckbox";
import { pacificNowLocalIso } from "main/utils/pacificTime";

const meta: Meta<typeof StampedCheckbox> = {
  title: "components/Common/StampedCheckbox",
  component: StampedCheckbox,
  tags: ["autodocs"],
  args: {
    id: "formal-offer-sent",
    label: "Formal Offer Sent",
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof StampedCheckbox>;

/** Checked, with when it was checked under it. */
export const Checked: Story = {
  args: { stamp: "2026-11-21T08:05:00" },
};

/** Unchecked: no stamp, nothing under the box. */
export const Unchecked: Story = {
  args: { stamp: null },
};

/** Disabled, for someone who may look but not edit. */
export const DisabledChecked: Story = {
  args: { stamp: "2026-11-21T08:05:00", disabled: true },
};

export const DisabledUnchecked: Story = {
  args: { stamp: null, disabled: true },
};

/** In a table whose column heading is the label: the label is only for screen readers. */
export const HiddenLabel: Story = {
  args: { stamp: "2026-11-21T08:05:00", hideLabel: true },
};

/**
 * Tick and untick it. In the app the backend records the time and sends the stamp back; here a
 * stateful wrapper fakes that with the Pacific clock now.
 */
export const Interactive: Story = {
  render: (args) => {
    const [stamp, setStamp] = useState<string | null>(null);
    return (
      <StampedCheckbox
        {...args}
        stamp={stamp}
        onChange={(checked) => {
          args.onChange(checked);
          setStamp(checked ? pacificNowLocalIso() : null);
        }}
      />
    );
  },
};
