import React from "react";
import AdminBudgetCard from "main/components/Recruitments/AdminBudgetCard";

export default {
  title: "components/Recruitments/AdminBudgetCard",
  component: AdminBudgetCard,
};

const Template = (args) => <AdminBudgetCard {...args} />;

/**
 * Both a TA and a ULA recruitment: Budget Planning and "Allocate TA and ULA slots to Courses",
 * which opens the quarter's Combined Allocation page, /admin/allocations/QXX (issue #358).
 */
export const Both = Template.bind({});
Both.args = { quarter: "20261", ta: { id: 1 }, ula: { id: 2 } };

/** Only a TA recruitment: the button says "Allocate TA slots to Courses". */
export const TaOnly = Template.bind({});
TaOnly.args = { quarter: "20262", ta: { id: 3 } };

/** Only a ULA recruitment: the button says "Allocate ULA slots to Courses". */
export const UlaOnly = Template.bind({});
UlaOnly.args = { quarter: "20261", ula: { id: 2 } };

/** Neither (the home page never shows this): the button is greyed out. */
export const Neither = Template.bind({});
Neither.args = { quarter: "20264" };
