import React from "react";
import QuarterCards from "main/components/Quarters/QuarterCards";
import quartersFixtures from "fixtures/quartersFixtures";

export default {
  title: "components/Quarters/QuarterCards",
  component: QuarterCards,
};

const Template = (args) => <QuarterCards {...args} />;

export const Empty = Template.bind({});
Empty.args = { quarters: [] };

export const ThreeQuarters = Template.bind({});
ThreeQuarters.args = { quarters: quartersFixtures.threeNewestFirst };
