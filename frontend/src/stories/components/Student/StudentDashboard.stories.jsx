import React from "react";
import { HttpResponse, http } from "msw";
import StudentDashboard from "main/components/Student/StudentDashboard";
import CancelApplicationModals from "main/components/Student/CancelApplicationModals";
import StudentRecruitmentCards from "main/components/Student/StudentRecruitmentCards";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

// S26 TA not yet opened; W26 ULA open; W26 TA closed on 2026-02-01.
const three = recruitmentsFixtures.threeRecruitments;
const [, openUla, closedTa] = three;

export default {
  title: "components/Student/StudentDashboard",
  component: StudentDashboard,
  parameters: {
    msw: {
      handlers: [
        http.put("/api/applications/cancel", () =>
          HttpResponse.json(applicationsFixtures.oneCancelledApplication),
        ),
      ],
    },
  },
};

const Template = (args) => <StudentDashboard {...args} />;

export const NothingOpen = Template.bind({});
NothingOpen.args = { recruitments: [], applications: [] };

export const NotYetApplied = Template.bind({});
NotYetApplied.args = { recruitments: three, applications: [] };

/** Try Cancel my Application: the two-step confirmation. */
export const WithApplications = Template.bind({});
WithApplications.args = {
  recruitments: three,
  applications: applicationsFixtures.twoApplications,
};

export const OneCancelled = Template.bind({});
OneCancelled.args = {
  recruitments: [openUla, closedTa],
  applications: [
    applicationsFixtures.oneCancelledApplication,
    applicationsFixtures.oneTaApplication,
  ],
};

export const CardsOnly = () => (
  <StudentRecruitmentCards
    recruitments={[openUla, closedTa]}
    applications={[applicationsFixtures.oneTaApplication]}
    onCancelRequested={(application) =>
      window.alert(`Cancel requested for application ${application.id}`)
    }
  />
);

export const CancelStepOne = () => (
  <CancelApplicationModals
    show
    recruitmentName="TA positions, W26"
    onConfirm={(reason) => console.log("cancel", reason)}
    onClose={() => console.log("close")}
  />
);
