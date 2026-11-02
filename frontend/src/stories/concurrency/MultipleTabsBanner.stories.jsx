import React from "react";
import MultipleTabsBanner from "main/concurrency/MultipleTabsBanner";

export default {
  title: "concurrency/MultipleTabsBanner",
  component: MultipleTabsBanner,
};

export const Application = () => <MultipleTabsBanner noun="application" />;

export const Budget = () => <MultipleTabsBanner noun="budget" />;
