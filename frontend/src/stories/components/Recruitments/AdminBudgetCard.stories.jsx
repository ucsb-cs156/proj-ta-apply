import React from "react";
import AdminBudgetCard from "main/components/Recruitments/AdminBudgetCard";

export default {
  title: "components/Recruitments/AdminBudgetCard",
  component: AdminBudgetCard,
};

const Template = (args) => <AdminBudgetCard {...args} />;

/**
 * Both a TA and a ULA recruitment: all three buttons are live. Since issue #358 TA allocations and
 * ULA allocations both open the quarter's Combined Allocation page, /admin/allocations/QXX.
 */
export const Both = Template.bind({});
Both.args = { quarter: "20261", ta: { id: 1 }, ula: { id: 2 } };

/** No ULA recruitment: ULA allocations is greyed out. */
export const TaOnly = Template.bind({});
TaOnly.args = { quarter: "20262", ta: { id: 3 } };

/** No TA recruitment: TA allocations is greyed out. */
export const UlaOnly = Template.bind({});
UlaOnly.args = { quarter: "20261", ula: { id: 2 } };
