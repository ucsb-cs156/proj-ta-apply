import React from "react";
import { HttpResponse, http } from "msw";
import StudentDashboard from "main/components/Student/StudentDashboard";
import CancelApplicationModals from "main/components/Student/CancelApplicationModals";
import StudentRecruitmentCards from "main/components/Student/StudentRecruitmentCards";
import applicationsFixtures from "fixtures/applicationsFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import softOfferFixtures from "fixtures/softOfferFixtures";

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
        // Create a new application (issue #420): the cancelled one comes back as a draft.
        http.post("/api/draftApplications/fromCancelled", () =>
          HttpResponse.json(draftApplicationsFixtures.savedUlaDraft),
        ),
        // Issue #486: answering a soft offer.
        http.post("/api/softOffers/respond", () =>
          HttpResponse.json({ id: 1, decision: "PROCEED" }),
        ),
        http.get("/api/quarters/one", () =>
          HttpResponse.json({ message: "not on file" }, { status: 404 }),
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

/** Begun and not submitted: Continue editing draft application, with the red warning. */
export const WithADraft = Template.bind({});
WithADraft.args = {
  recruitments: three,
  applications: [],
  drafts: [draftApplicationsFixtures.savedUlaDraft],
};

/** Try Cancel my Application: the two-step confirmation. */
export const WithApplications = Template.bind({});
WithApplications.args = {
  recruitments: three,
  applications: applicationsFixtures.twoApplications,
};

/** Issue #486: soft offers released and this applicant assigned: the Soft Offer section asks. */
export const WithASoftOffer = Template.bind({});
WithASoftOffer.args = {
  recruitments: [openUla],
  applications: [applicationsFixtures.oneUlaApplication],
  softOffers: [softOfferFixtures.pending],
};

/** The same offer once answered: read-only, with the time and whom to contact. */
export const SoftOfferAnswered = Template.bind({});
SoftOfferAnswered.args = {
  recruitments: [openUla],
  applications: [applicationsFixtures.oneUlaApplication],
  softOffers: [softOfferFixtures.proceeded],
};

/** The UCSB API down and no notice text saved: the lecture alone, and the question. */
export const SoftOfferWithoutSectionsOrNotice = Template.bind({});
SoftOfferWithoutSectionsOrNotice.args = {
  recruitments: [openUla],
  applications: [applicationsFixtures.oneUlaApplication],
  softOffers: [softOfferFixtures.bare],
};

export const OneCancelled = Template.bind({});
OneCancelled.args = {
  recruitments: [openUla, closedTa],
  applications: [
    applicationsFixtures.oneCancelledApplication,
    applicationsFixtures.oneTaApplication,
  ],
};

/**
 * Issues #318, #420: cancelled while applications are open, so Create a new application is
 * offered; it turns the cancelled application back into a draft and opens it.
 */
export const CancelledCanStartAgain = Template.bind({});
CancelledCanStartAgain.args = {
  recruitments: [openUla],
  applications: [applicationsFixtures.oneCancelledApplication],
};

/** Issue #318: the applicant started again; the new application is the one on file. */
export const CancelledAndStartedAgain = Template.bind({});
CancelledAndStartedAgain.args = {
  recruitments: [openUla],
  applications: [
    applicationsFixtures.oneUlaApplication,
    applicationsFixtures.oneCancelledApplication,
  ],
};

/** Issue #318: cancelled, then applications closed: no button. */
export const CancelledAfterClosing = Template.bind({});
CancelledAfterClosing.args = {
  recruitments: [{ ...openUla, applicationStatus: "CLOSED" }],
  applications: [applicationsFixtures.oneCancelledApplication],
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
