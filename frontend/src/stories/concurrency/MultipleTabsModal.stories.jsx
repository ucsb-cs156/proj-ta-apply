import React from "react";
import MultipleTabsModal from "main/concurrency/MultipleTabsModal";

export default {
  title: "concurrency/MultipleTabsModal",
  component: MultipleTabsModal,
};

const you = { label: "me@example.org (Me)", samePerson: true };
const person = (label) => ({ label, samePerson: false });

// The modal asks only the newest tab; the choices are real, so try them (Leave does nothing here).
const modal = (others, noun = "application") => (
  <MultipleTabsModal
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
