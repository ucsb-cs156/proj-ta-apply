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

## `other_undergraduate_courses.json`

This file contains

It was created with this prompt to Claude:

```
Now please make a json file that contains 5 randomly chosen
domestic schools that have undergraduate computer science
programs, and 5 schools that international students from
China, India, and Europe may have studied at, that have
undergraduate computer science programs.  Locate programs
where you can find a list of courses and course titles for
undergraduate coursework.

Make a json file that is organized by school name, then,
course.  For each course, we want a course number, and course
title.

Group the schools into two arrays at the top level,with keys
domestic and international.
```

Here is a portion of Claude's comments on this file:


> `cs_undergrad_courses.json` has `domestic` and `international` arrays at the top level. Each entry has the school name, country, department, source links, a notes line, and a `courses` list where every course has a number and title. Chinese and German courses also have an English title.
> 
> | Domestic | Courses | International | Courses |
> |---|---|---|---|
> | Stony Brook | 75 | Shanghai Jiao Tong (China) | 38 |
> | Purdue | 77 | IIT Madras (India) | 39 |
> | Carnegie Mellon | 80 | EPFL (Switzerland) | 59 |
> | CU Boulder | 83 | TU Munich (Germany) | 56 |
> | UIUC | 103 | Zhejiang University (China) | 72 |

> **How the schools were picked:** I drew them with a seeded random draw from candidate lists. The domestic list had about 50 US universities. The international list had Chinese, Indian and European schools, with at least one from each region. Two international picks were swapped for the next school in the backup order:
> - **USTC was replaced by Zhejiang.** USTC's curriculum pages show the course list only as an image, and its course catalog is a page whose contents never came through.
> - **RWTH Aachen was replaced by TU Munich.** RWTH's official pages give no course numbers for about half its required courses, and you asked for a number on every course.
> 
> **How reliable the lists are:**
> - **Checked:** Purdue, UIUC and CU Boulder were read directly from the live catalog pages in the browser and match exactly.
> - **Not checked:** the other seven came through a fetch tool that summarizes long pages, and I couldn't load those pages in the browser to compare. A wording slip in a title is possible there.
> - **Other differences between schools:**
> - The US schools and IIT Madras list every undergraduate course in the department. The European and Chinese schools list the program curriculum, so EPFL also includes its required math and physics courses.
> - **SJTU's curriculum is old.** The only official list I could reach without a login is for students who started in 2013, and SJTU has renumbered its courses since.
> - **Some lists aren't current.** Zhejiang's is the plan for students who started in 2020. TUM's electives come from 2019 rules, because the current list sits on a site that blocks automated access.
> - **Some English titles are my translations.** The Zhejiang and TUM English titles, and one EPFL title, are mine, not official. SJTU's English titles are the university's own.
> 
> The per-school notes in the file record the catalog year and these limits.
> 
> Sources:
> - [Stony Brook CSE courses](https://www.stonybrook.edu/sb/bulletin/current-fall24/courses/cse/)
> - [Purdue catalog](https://catalog.purdue.edu/content.php?catoid=19&navoid=25468)
> - [CMU SCS courses](http://coursecatalog.web.cmu.edu/schools-colleges/schoolofcomputerscience/courses/)
> - [CU Boulder CSCI](https://catalog.colorado.edu/courses-a-z/csci/)
> - [UIUC CS](https://catalog.illinois.edu/courses-of-instruction/cs/)
> - [SJTU curriculum](https://bjwb.seiee.sjtu.edu.cn/english/info/8269.htm)
> - [IIT Madras CSE courses](https://www.cse.iitm.ac.in/courses.php?full=1)
> - [EPFL propedeutics](https://edu.epfl.ch/studyplan/en/propedeutics/computer-science/) and [EPFL bachelor](https://edu.epfl.ch/studyplan/en/bachelor/computer-science/)
> - [TUM study plan](https://www.cit.tum.de/en/cit/studium/studiengaenge/bachelor-informatik/studienplan/) and [TUM 2019 regulations](https://portal.mytum.de/archiv/kompendium_rechtsangelegenheiten/fachpruefungsordnungen/2019-88-2-AeS-BA-Informatik-FINAL-11-10-2019.pdf)
> - [ZJU 2020 training plan](https://bksy.zju.edu.cn/_upload/article/files/b0/49/cf400d1142e9bb65b751c8d2cfa0/d50867e2-e35b-43fa-b4d7-28a2ebd5931f.pdf)