import React from "react";
import { HttpResponse, http } from "msw";
import AutoCreateRecruitmentsModal from "main/components/Recruitments/AutoCreateRecruitmentsModal";

export default {
  title: "components/Recruitments/AutoCreateRecruitmentsModal",
  component: AutoCreateRecruitmentsModal,
  parameters: {
    msw: {
      handlers: [
        http.post("/api/admin/recruitments/post", () =>
          HttpResponse.json({ id: 9 }),
        ),
      ],
    },
  },
};

// A fixed date, so the proposed quarter and the dates do not change from day to day: Saturday
// 2026-10-31, in Fall quarter, so the proposed quarter is W27.
const today = new Date(2026, 9, 31);

const recruitment = (quarter, type) => ({ id: 1, quarter, type });

const Template = (args) => (
  <AutoCreateRecruitmentsModal
    onHide={() => {}}
    today={today}
    testIdPrefix="Story"
    {...args}
  />
);

/** Neither a TA nor a ULA recruitment exists for the proposed quarter: both will be created. */
export const NeitherExists = Template.bind({});
NeitherExists.args = { recruitments: [] };

/** Only the TA recruitment exists: just the ULA one will be created. */
export const OnlyTaExists = Template.bind({});
OnlyTaExists.args = { recruitments: [recruitment("20271", "TA")] };

/** Only the ULA recruitment exists: just the TA one will be created. */
export const OnlyUlaExists = Template.bind({});
OnlyUlaExists.args = { recruitments: [recruitment("20271", "ULA")] };

/** Both exist: there is nothing to create, and only Cancel is offered. */
export const BothExist = Template.bind({});
BothExist.args = {
  recruitments: [recruitment("20271", "TA"), recruitment("20271", "ULA")],
};
