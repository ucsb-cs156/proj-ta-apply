import React, { useState } from "react";
import NoticeAgreement from "main/components/Notices/NoticeAgreement";
import noticesFixtures from "fixtures/noticesFixtures";

export default {
  title: "components/Notices/NoticeAgreement",
  component: NoticeAgreement,
};

const Interactive = (args) => {
  const [agreed, setAgreed] = useState(args.agreed ?? false);
  return <NoticeAgreement {...args} agreed={agreed} onChange={setAgreed} />;
};

export const Unticked = Interactive.bind({});
Unticked.args = { notice: noticesFixtures.taV2, type: "TA" };

/** What an applicant sees after clicking Submit without ticking the box. */
export const Invalid = Interactive.bind({});
Invalid.args = { notice: noticesFixtures.taV2, type: "TA", invalid: true };

/** On a summary: the version agreed to, ticked, and not changeable. */
export const ReadOnly = Interactive.bind({});
ReadOnly.args = {
  notice: noticesFixtures.ulaV1,
  type: "ULA",
  agreed: true,
  readOnly: true,
};
