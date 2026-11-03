import { describe, expect, test } from "vitest";
import {
  ADMIN_SENTENCE,
  MAX_NAMED,
  RISK_SENTENCE,
  closingSentence,
  describeOthers,
  warningMessage,
  readPresence,
  type OtherClient,
} from "main/concurrency/others";

const person = (label: string): OtherClient => ({ label, samePerson: false });
const you: OtherClient = { label: "me@example.org (Me)", samePerson: true };
const PHILL = "phtcon@ucsb.edu (Phill Conrad)";

describe("describeOthers", () => {
  test("says nothing when no one else is editing", () => {
    expect(describeOthers([], "page")).toBe("");
  });

  test("only the user's own other tabs", () => {
    expect(describeOthers([you], "page")).toBe(
      "You are also editing this page in another tab or window.",
    );
  });

  test("one other person", () => {
    expect(describeOthers([person(PHILL)], "page")).toBe(
      "phtcon@ucsb.edu (Phill Conrad) is also editing this page.",
    );
  });

  test("the user and one other person", () => {
    expect(describeOthers([you, person(PHILL)], "page")).toBe(
      "You and phtcon@ucsb.edu (Phill Conrad) are also editing this page in other windows or tabs.",
    );
  });

  test("the order of the list does not matter to the sentence", () => {
    expect(describeOthers([person(PHILL), you], "page")).toBe(
      describeOthers([you, person(PHILL)], "page"),
    );
  });

  test("two other people are joined with 'and'", () => {
    expect(describeOthers([person("A"), person("B")], "page")).toBe(
      "A and B are also editing this page.",
    );
  });

  test("three other people are joined with commas and 'and'", () => {
    expect(
      describeOthers([person("A"), person("B"), person("C")], "page"),
    ).toBe("A, B and C are also editing this page.");
  });

  test("four other people: three are named and one is counted", () => {
    expect(
      describeOthers(
        [person("A"), person("B"), person("C"), person("D")],
        "page",
      ),
    ).toBe("A, B, C and 1 other are also editing this page.");
  });

  test("five other people: three are named and two are counted", () => {
    expect(
      describeOthers(
        ["A", "B", "C", "D", "E"].map((name) => person(name)),
        "page",
      ),
    ).toBe("A, B, C and 2 others are also editing this page.");
  });

  test("a great many other people", () => {
    const crowd = Array.from({ length: 12 }, (_, i) => person(`P${i}`));
    expect(describeOthers(crowd, "page")).toBe(
      "P0, P1, P2 and 9 others are also editing this page.",
    );
  });

  test("the user and two other people", () => {
    expect(describeOthers([you, person("A"), person("B")], "page")).toBe(
      "You, A and B are also editing this page in other windows or tabs.",
    );
  });

  test("the user and three other people", () => {
    expect(
      describeOthers([you, person("A"), person("B"), person("C")], "page"),
    ).toBe(
      "You, A, B and C are also editing this page in other windows or tabs.",
    );
  });

  test("the user and four other people", () => {
    expect(
      describeOthers(
        [you, person("A"), person("B"), person("C"), person("D")],
        "page",
      ),
    ).toBe(
      "You, A, B, C and 1 other are also editing this page in other windows or tabs.",
    );
  });

  test("the user and five other people", () => {
    expect(
      describeOthers(
        [you, ...["A", "B", "C", "D", "E"].map((name) => person(name))],
        "page",
      ),
    ).toBe(
      "You, A, B, C and 2 others are also editing this page in other windows or tabs.",
    );
  });

  test("the user listed twice is still one 'You'", () => {
    expect(describeOthers([you, { ...you }, person("A")], "page")).toBe(
      "You and A are also editing this page in other windows or tabs.",
    );
  });

  test("at most three other people are named", () => {
    expect(MAX_NAMED).toBe(3);
  });

  test("the noun is whatever it is told", () => {
    expect(describeOthers([you], "application")).toBe(
      "You are also editing this application in another tab or window.",
    );
    expect(describeOthers([person("A")], "budget")).toBe(
      "A is also editing this budget.",
    );
    expect(describeOthers([you, person("A")], "ranking")).toBe(
      "You and A are also editing this ranking in other windows or tabs.",
    );
  });

  test("a long name is kept whole", () => {
    const long = `${"Averyveryverylongname".repeat(15)}@example.org (${"Long ".repeat(40)}Name)`;
    expect(describeOthers([person(long)], "page")).toBe(
      `${long} is also editing this page.`,
    );
  });

  test("a name is text: markup in it is left exactly as it is", () => {
    const sneaky = '<img src=x onerror="alert(1)"> & <b>bold</b>';
    expect(describeOthers([person(sneaky)], "page")).toBe(
      `${sneaky} is also editing this page.`,
    );
  });

  test("names that are not plain ASCII are kept", () => {
    expect(
      describeOthers([person("josé@example.org (José Álvarez 李)")], "page"),
    ).toBe("josé@example.org (José Álvarez 李) is also editing this page.");
  });
});

describe("describeOthers, for the tab that arrived later ('already')", () => {
  const later = (others: OtherClient[], noun = "page") =>
    describeOthers(others, noun, true);

  test("says nothing when no one else is editing", () => {
    expect(later([])).toBe("");
  });

  test("only the user's own other tabs", () => {
    expect(later([you], "application")).toBe(
      "You already have this application open for editing in another tab or window.",
    );
  });

  test("one other person takes the singular verb", () => {
    expect(later([person(PHILL)], "ranking")).toBe(
      `${PHILL} already has this ranking open for editing.`,
    );
  });

  test("the user and one other person take the plural verb", () => {
    expect(later([you, person("A")])).toBe(
      "You and A already have this page open for editing in other windows or tabs.",
    );
  });

  test("two or three people take the plural verb", () => {
    expect(later([person("A"), person("B")])).toBe(
      "A and B already have this page open for editing.",
    );
    expect(later([person("A"), person("B"), person("C")])).toBe(
      "A, B and C already have this page open for editing.",
    );
  });

  test("more than three are counted", () => {
    const four = ["A", "B", "C", "D"].map(person);
    expect(later(four)).toBe(
      "A, B, C and 1 other already have this page open for editing.",
    );
    expect(later([...four, person("E")])).toBe(
      "A, B, C and 2 others already have this page open for editing.",
    );
    expect(later([you, ...four, person("E")])).toBe(
      "You, A, B, C and 2 others already have this page open for editing in other windows or tabs.",
    );
  });

  test("a name is text, kept exactly, whatever its characters", () => {
    const sneaky = "<b>bold</b> & josé 李";
    expect(later([person(sneaky)])).toBe(
      `${sneaky} already has this page open for editing.`,
    );
  });
});

describe("closingSentence and warningMessage", () => {
  test("the admin sentence is the agreed one", () => {
    expect(ADMIN_SENTENCE).toBe(
      "We recommend that only one Admin have this page open for edits at a time.",
    );
  });

  test("the default audience, and no audience, use the risk sentence", () => {
    expect(closingSentence()).toBe(RISK_SENTENCE);
    expect(closingSentence("default")).toBe(RISK_SENTENCE);
    expect(closingSentence("admin")).toBe(ADMIN_SENTENCE);
  });

  test("is empty when no one else is there, whatever the audience", () => {
    expect(warningMessage([], "page")).toBe("");
    expect(warningMessage([], "page", "admin", true)).toBe("");
    expect(warningMessage([you], "page")).toBe(
      `You are also editing this page in another tab or window. ${RISK_SENTENCE}`,
    );
    expect(warningMessage([you], "page", "admin", true)).toBe(
      `You already have this page open for editing in another tab or window. ${ADMIN_SENTENCE}`,
    );
  });

  test("joins who and the closing sentence", () => {
    const alice = person("a@example.com (Alice)");
    expect(warningMessage([alice], "page")).toBe(
      `a@example.com (Alice) is also editing this page. ${RISK_SENTENCE}`,
    );
    expect(warningMessage([alice], "page", "admin")).toBe(
      `a@example.com (Alice) is also editing this page. ${ADMIN_SENTENCE}`,
    );
    expect(warningMessage([alice], "page", "default", true)).toBe(
      `a@example.com (Alice) already has this page open for editing. ${RISK_SENTENCE}`,
    );
    expect(
      warningMessage(
        [alice, person("b@example.com (Bob)")],
        "page",
        "admin",
        true,
      ),
    ).toBe(
      `a@example.com (Alice) and b@example.com (Bob) already have this page open for editing. ${ADMIN_SENTENCE}`,
    );
  });
});

describe("RISK_SENTENCE", () => {
  test("is the agreed sentence", () => {
    expect(RISK_SENTENCE).toBe(
      "Please know that this is risky; we recommend closing all but one of these.",
    );
  });
});

describe("readPresence", () => {
  test("reads the others and the interval", () => {
    expect(
      readPresence({
        others: [{ label: PHILL, samePerson: false }],
        heartbeatSeconds: 20,
      }),
    ).toEqual({
      others: [{ label: PHILL, samePerson: false }],
      intervalMs: 20000,
      newest: false,
      arrivedAt: 0,
    });
  });

  test("reads whether this tab arrived last, and when", () => {
    expect(
      readPresence({
        others: [],
        newest: true,
        arrivedAtMillis: 1793620800000,
      }),
    ).toEqual({
      others: [],
      intervalMs: undefined,
      newest: true,
      arrivedAt: 1793620800000,
    });
  });

  test("only a true newest counts, and only a number is a time of arrival", () => {
    for (const newest of ["true", 1, null, "yes", {}]) {
      expect(readPresence({ newest }).newest).toBe(false);
    }
    for (const arrivedAtMillis of ["1000", null, "soon", {}, NaN]) {
      expect(readPresence({ arrivedAtMillis }).arrivedAt).toBe(0);
    }
    expect(readPresence({ newest: false }).newest).toBe(false);
  });

  test("an answer with no one else and no interval", () => {
    expect(readPresence({ others: [] })).toEqual({
      others: [],
      intervalMs: undefined,
      newest: false,
      arrivedAt: 0,
    });
  });

  test("nothing at all is no one", () => {
    const nobody = {
      others: [],
      intervalMs: undefined,
      newest: false,
      arrivedAt: 0,
    };
    expect(readPresence(undefined)).toEqual(nobody);
    expect(readPresence(null)).toEqual(nobody);
    expect(readPresence("")).toEqual(nobody);
    expect(readPresence({})).toEqual(nobody);
  });

  test("others that is not a list is no one", () => {
    expect(readPresence({ others: "Phill" }).others).toEqual([]);
    expect(
      readPresence({ others: { label: "x", samePerson: true } }).others,
    ).toEqual([]);
  });

  test("entries that are not well formed are left out, the good ones kept", () => {
    const good = { label: "A", samePerson: true };
    expect(
      readPresence({
        others: [
          good,
          null,
          undefined,
          "A",
          7,
          {},
          { label: "B" },
          { samePerson: true },
          { label: 5, samePerson: true },
          { label: "", samePerson: false },
          { label: "C", samePerson: "yes" },
        ],
      }).others,
    ).toEqual([good]);
  });

  test("an interval must be a positive finite number", () => {
    expect(readPresence({ heartbeatSeconds: 2 }).intervalMs).toBe(2000);
    expect(readPresence({ heartbeatSeconds: 0.5 }).intervalMs).toBe(500);
    expect(readPresence({ heartbeatSeconds: 0 }).intervalMs).toBeUndefined();
    expect(readPresence({ heartbeatSeconds: -3 }).intervalMs).toBeUndefined();
    expect(readPresence({ heartbeatSeconds: "20" }).intervalMs).toBeUndefined();
    expect(readPresence({ heartbeatSeconds: NaN }).intervalMs).toBeUndefined();
    expect(
      readPresence({ heartbeatSeconds: Infinity }).intervalMs,
    ).toBeUndefined();
  });
});
