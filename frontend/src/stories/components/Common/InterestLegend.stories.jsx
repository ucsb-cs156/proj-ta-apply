import React from "react";
import InterestLegend from "main/components/Common/InterestLegend";
import InterestMark from "main/components/Common/InterestMark";
import { INTEREST_LEGEND } from "main/utils/interestDisplay";

export default {
  title: "components/Common/InterestLegend",
  component: InterestLegend,
};

export const Legend = () => <InterestLegend />;

export const MarksAlone = () => (
  <p style={{ fontSize: "1.25rem" }}>
    {INTEREST_LEGEND.map(({ preference }) => (
      <InterestMark key={preference} preference={preference} />
    ))}
  </p>
);
