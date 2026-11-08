import React from "react";
import ProgressThermometer from "main/components/Common/ProgressThermometer";

/**
 * Issue #315: the reusable progress thermometer. It is 80% of its container up to 600px wide; the
 * stories show it in a wide canvas (600px) and in a phone-width frame (375px, so the bar is 300px).
 */
export default {
  title: "components/Common/ProgressThermometer",
  component: ProgressThermometer,
};

const Template = (args) => <ProgressThermometer {...args} />;

/** A desktop canvas: the bar is 600px wide. */
export const Partial = Template.bind({});
Partial.args = {
  numerator: 7,
  denominator: 12,
  label: "Assignments made",
};

/** The same fraction at 300px wide, as on a phone (a 375px frame, 80% of which is 300px). */
export const PartialAt300px = (args) => (
  <div style={{ width: "375px", border: "1px dashed #ccc", padding: "8px" }}>
    <ProgressThermometer {...args} />
  </div>
);
PartialAt300px.args = {
  numerator: 7,
  denominator: 12,
  label: "Assignments made",
};

/** Nothing done yet: the percentage sits beside the empty fill. */
export const Zero = Template.bind({});
Zero.args = { numerator: 0, denominator: 6, label: "Assignments made" };

/** A share too small to carry the text: the percentage sits just past the fill. */
export const Small = Template.bind({});
Small.args = { numerator: 1, denominator: 12, label: "Assignments made" };

/** Exactly at the target: full and green. */
export const Complete = Template.bind({});
Complete.args = { numerator: 12, denominator: 12, label: "Assignments made" };

/** More done than the target asked for: the fill stops at full and turns red; the numbers are real. */
export const OverTarget = Template.bind({});
OverTarget.args = { numerator: 15, denominator: 12, label: "Assignments made" };

/** No target yet (a denominator of 0): an empty bar and a short explanation instead of a percentage. */
export const NoTarget = Template.bind({});
NoTarget.args = {
  numerator: 3,
  denominator: 0,
  label: "Assignments made",
  noTargetText: "no hiring target set yet",
};

/** Every state together at 300px, to check that nothing overflows or wraps badly on a phone. */
export const AllStatesAt300px = () => (
  <div style={{ width: "375px", border: "1px dashed #ccc", padding: "8px" }}>
    <ProgressThermometer
      numerator={0}
      denominator={6}
      label="Assignments made"
    />
    <ProgressThermometer
      numerator={1}
      denominator={12}
      label="Assignments made"
    />
    <ProgressThermometer
      numerator={7}
      denominator={12}
      label="Assignments made"
    />
    <ProgressThermometer
      numerator={12}
      denominator={12}
      label="Assignments made"
    />
    <ProgressThermometer
      numerator={15}
      denominator={12}
      label="Assignments made"
    />
    <ProgressThermometer
      numerator={3}
      denominator={0}
      label="Assignments made"
      noTargetText="no hiring target set yet"
    />
  </div>
);
