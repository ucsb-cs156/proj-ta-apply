import React from "react";
import MultipleTabsModal from "main/concurrency/MultipleTabsModal";

export default {
  title: "concurrency/MultipleTabsModal",
  component: MultipleTabsModal,
};

const you = { label: "me@example.org (Me)", samePerson: true };
const person = (label) => ({ label, samePerson: false });

// The modal asks only the newest tab; the choices are real, so try them (Leave does nothing here).
const modal = (others, noun = "application", audience = "default") => (
  <MultipleTabsModal
    audience={audience}
    others={others}
    newest={true}
    arrivedAt={1}
    noun={noun}
    onLeave={() => {}}
  />
);

export const YourOwnOtherTab = () => modal([you]);

export const AnotherPerson = () =>
  modal([person("phtcon@ucsb.edu (Phill Conrad)")]);

export const YouAndAnotherPerson = () =>
  modal([you, person("phtcon@ucsb.edu (Phill Conrad)")], "budget");

export const MoreThanThreeOtherPeople = () =>
  modal(
    [you, "a", "b", "c", "d"].map((who) =>
      typeof who === "string" ? person(`${who}@ucsb.edu`) : who,
    ),
  );

export const ALongName = () =>
  modal([
    person(
      `${"averyverylongaddress".repeat(8)}@example.org (${"A Very Long Name ".repeat(8)})`,
    ),
  ]);

// The admin audience (issue #298): "already", then its own closing sentence.
export const AdminOnePerson = () =>
  modal([person("a@example.com (Alice)")], "page", "admin");

export const AdminTwoPeople = () =>
  modal(
    [person("a@example.com (Alice)"), person("b@example.com (Bob)")],
    "page",
    "admin",
  );

export const AdminYourOwnOtherTab = () => modal([you], "page", "admin");

export const AdminYouAndAnotherPerson = () =>
  modal([you, person("a@example.com (Alice)")], "page", "admin");

export const AdminMoreThanThreeOtherPeople = () =>
  modal(
    [you, "a", "b", "c", "d"].map((who) =>
      typeof who === "string" ? person(`${who}@ucsb.edu`) : who,
    ),
    "page",
    "admin",
  );

// Not the newest tab: nothing is shown, because the older tab keeps the banner alone.
export const NotTheNewestTabShowsNothing = () => (
  <MultipleTabsModal
    others={[you]}
    newest={false}
    arrivedAt={1}
    noun="application"
    onLeave={() => {}}
  />
);

// An applicant is told that an admin has the application open (issue #302).
const admin = (label) => ({ label, samePerson: false, admin: true });

export const ApplicantOneAdminHasItOpen = () =>
  modal([admin("jane@ucsb.edu (Jane Doe)")], "application", "applicant");

export const ApplicantSeveralAdminsHaveItOpen = () =>
  modal(
    [admin("jane@ucsb.edu (Jane Doe)"), admin("bob@ucsb.edu (Bob Roe)")],
    "application",
    "applicant",
  );

// An admin is told that the applicant has the application open (issue #302).
export const AdminSeesTheApplicantAlreadyThere = () =>
  modal(
    [person("chris@ucsb.edu (Chris Student)")],
    "application",
    "applicationAdmin",
  );
