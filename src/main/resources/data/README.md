# src/main/resources/data/README.md

This folder contains data used by the application that doesn't change often, but may 
need to be updated from time to time.

## cmpsc_prereqs.json

This file contains pre-requisite relationships that are used to populate data
in fake applications, so that courses a student has taken are somewhat more realistic
then if they data was chosen randomly from among all courses.

It was created by prompting Claude with the following prompt:

```
Please explore the courses offered by the Computer Science department at UCSB by traversing the links at:

https://catalog.ucsb.edu/courses?page=1&sortBy=code&departments=CMPSC&cq=

From these pages, determine the pre-requisite graph of courses.

Then make a JSON representation of these prerequitite relationships using the course numbers, minus the CMPSC part, as keys.

Do not consider pre-requisites for courses other than CMPSC / Computer Science (e.g. ignore Math, PSTAT, and other prerequisites.)
```

Claude responded with the file, and this information:

> I'll pull the CMPSC course listings from the UCSB catalog, extract each course's prerequisites, and build the JSON graph.
>
> Got all 179 CMPSC courses through the catalog's data feed. Prerequisites are free text, so I'll encode the CMPSC relationships by hand into a script and generate the JSON.
> 
> I've built the prerequisite graph for all 179 CMPSC courses in the catalog, as two JSON files keyed by course number without the "CMPSC" part:
> 
> - **`cmpsc_prereqs_simple.json`** maps each course to the list of CMPSC courses its prerequisites mention, e.g. `"130A": ["24","25","40","41"]`.
> - **`cmpsc_prereqs.json`** keeps whether each requirement is "and" or "or". For example, 130A becomes `{"and":[{"or":["40","41"]},{"or":["24","25"]}]}`. 123 becomes `{"or":["32",{"and":["20","60"]}]}`. It also marks the three courses that let a prerequisite be taken at the same time (170, 174N, 177) and has a notes section.
> 
> 69 of the 179 courses have CMPSC prerequisites. The rest have none, or only non-CMPSC ones, instructor consent, or standing requirements, and they appear with empty lists.
> 
> **How I got the data:** the catalog page loads its listings with JavaScript, so a plain page fetch shows nothing. I opened it in your desktop app's browser and pulled the full CMPSC list from the data feed the page itself uses. The prerequisites there are free text, so I converted them by hand.
>
> **Things to know before you use it:**
> - **Some prerequisites look required but aren't.** When a requirement could also be met by a non-CMPSC course, I kept only the CMPSC choices, as you asked. In those cases the JSON makes the CMPSC course look required. Examples are 130A (MATH 8 also counts in place of 40/41), 160 (EE 154), 170 (ECE 154A), 254 (ECE 154) and 281/281B (ECE 181). The full file lists all ten under `nonCmpscAlternativeDropped`.
> - **Four referenced courses aren't in the catalog:** 20, 48, 56 and 60. They come from old wording in 123, 184 and 189A, and I kept them as written.
> - **220 looks like a catalog error.** It lists "Computer Science 186" as its prerequisite, but 186 is now Internet of Things Systems, so this probably means a renumbered theory course. I recorded it as printed. 266 also lists 186 (with 130A-B), so it may have the same problem.
>
> Sources: [UCSB Catalog – CMPSC courses](https://catalog.ucsb.edu/courses?page=1&sortBy=code&departments=CMPSC&cq=)

