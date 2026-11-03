import React from "react";
import MultipleTabsBanner from "main/concurrency/MultipleTabsBanner";

export default {
  title: "concurrency/MultipleTabsBanner",
  component: MultipleTabsBanner,
};

const you = { label: "me@example.org (Me)", samePerson: true };
const person = (label) => ({ label, samePerson: false });

export const OnlyYourOwnOtherTab = () => (
  <MultipleTabsBanner others={[you]} noun="application" />
);

export const OneOtherPerson = () => (
  <MultipleTabsBanner
    others={[person("phtcon@ucsb.edu (Phill Conrad)")]}
    noun="page"
  />
);

export const YouAndAnotherPerson = () => (
  <MultipleTabsBanner
    others={[you, person("phtcon@ucsb.edu (Phill Conrad)")]}
    noun="page"
  />
);

export const ThreeOtherPeople = () => (
  <MultipleTabsBanner
    others={[
      person("ada@ucsb.edu (Ada Lovelace)"),
      person("ben@ucsb.edu (Ben Bitdiddle)"),
      person("cal@ucsb.edu"),
    ]}
    noun="budget"
  />
);

export const MoreThanThreeOtherPeople = () => (
  <MultipleTabsBanner
    others={[you, "A", "B", "C", "D", "E"].map((who) =>
      typeof who === "string" ? person(`${who.toLowerCase()}@ucsb.edu`) : who,
    )}
    noun="page"
  />
);

export const ALongName = () => (
  <MultipleTabsBanner
    others={[
      person(
        `${"averyverylongaddress".repeat(8)}@example.org (${"A Very Long Name ".repeat(8)})`,
      ),
    ]}
    noun="page"
  />
);

// The tab that arrived later says who is "already" there (issue #298).
export const ArrivedLaterOneOtherPerson = () => (
  <MultipleTabsBanner
    others={[person("phtcon@ucsb.edu (Phill Conrad)")]}
    noun="ranking"
    newest
  />
);

export const ArrivedLaterOnlyYourOwnOtherTab = () => (
  <MultipleTabsBanner others={[you]} noun="application" newest />
);

export const ArrivedLaterYouAndAnotherPerson = () => (
  <MultipleTabsBanner
    others={[you, person("phtcon@ucsb.edu (Phill Conrad)")]}
    noun="ranking"
    newest
  />
);

// The admin audience closes with its own sentence.
export const AdminOneOtherPersonAlreadyOpen = () => (
  <MultipleTabsBanner
    others={[person("a@example.com (Alice)")]}
    noun="page"
    audience="admin"
  />
);

export const AdminArrivedLaterOneOtherPerson = () => (
  <MultipleTabsBanner
    others={[person("a@example.com (Alice)")]}
    noun="page"
    audience="admin"
    newest
  />
);

export const AdminArrivedLaterTwoOtherPeople = () => (
  <MultipleTabsBanner
    others={[person("a@example.com (Alice)"), person("b@example.com (Bob)")]}
    noun="page"
    audience="admin"
    newest
  />
);

export const AdminArrivedLaterOnlyYourOwnOtherTab = () => (
  <MultipleTabsBanner others={[you]} noun="page" audience="admin" newest />
);

export const AdminArrivedLaterYouAndAnotherPerson = () => (
  <MultipleTabsBanner
    others={[you, person("a@example.com (Alice)")]}
    noun="page"
    audience="admin"
    newest
  />
);

export const AdminArrivedLaterMoreThanThreeOtherPeople = () => (
  <MultipleTabsBanner
    others={["A", "B", "C", "D", "E"].map((who) =>
      person(`${who.toLowerCase()}@ucsb.edu`),
    )}
    noun="page"
    audience="admin"
    newest
  />
);
