#!/usr/bin/env python3
"""Turn the ULA application Google Form's response export into a file safe to keep in the repo.

    python3 obfuscate-legacy-ula-app-data.py INPUT.csv OUTPUT.csv [--seed N]

The input is the "Form Responses" sheet of the ULA application form, downloaded as CSV
(FERPA-protected; never commit it). The output has the same header, row count and column formats,
but no value that can be traced to an applicant. The steps, in order, are described in README.md
next to this script. Everything is drawn from a seeded random generator, so the same input and
seed give the same output.

Standard library only; Python 3.9 or later.
"""
import argparse
import csv
import random
import re
import sys
from datetime import datetime, timedelta

# --------------------------------------------------------------------------------------------
# Column roles, by header text (the form's questions). A header is matched by its start, so the
# long question texts need not be repeated here in full.
# --------------------------------------------------------------------------------------------

TIMESTAMP = "Timestamp"
TIMESTAMP_FORMAT = "%m/%d/%Y %H:%M:%S"
EMAIL = "Email Address"
FIRST_NAME = "First name"
LAST_NAME = "Last name"
PERM = "Perm number"
EMPLOYEE_ID = "Employee ID number"
AVAILABILITY_COMMENTS = "Availability Comments"
VIDEO_LINK = "Video Link"
TA_ELIGIBILITY = "Do you want to be eligible for TA positions"

# Blocks of columns that are shuffled across rows together, so answers that belong together (a
# course preference grid with the first and second choice drawn from it, a yes with the detail
# question it reveals) stay consistent within a row while no row keeps any one applicant's set.
BLOCKS = [
    ["Expected graduation date"],
    ["BS/MS student?", "Will you be in undergrad or graduate student status", TA_ELIGIBILITY],
    ["Other Campus Job?"],
    ["Prior UCSB employment?", EMPLOYEE_ID],
    ["Previous LA Service for CS"],
    ["IMPORTANT: Please READ THE FOLLOWING STATEMENT", "If you indicated that you are UNSURE"],
    ["Course Preferences [", "First Choice", "Second Choice", "Are you available to attend",
     AVAILABILITY_COMMENTS],
    ["GPA"],
    ["Major", "Changing major?"],
    ["Rate your familiarity with"],
    ["Activity Interests ["],
]

# The form's training-commitment question is a whole paragraph with line breaks inside it, which
# makes a poor column name; the output renames it. Keys are the start of the header to rename.
HEADER_RENAMES = {
    "IMPORTANT: Please READ THE FOLLOWING STATEMENT": "Agree to statement",
    "Are you available to attend the lectures for your first and second choice courses?"
    "\n(Note that it is up to the instructor to decide if you need to attend these)"
    " [First choice course]": "Lectures: first choice",
    "Are you available to attend the lectures for your first and second choice courses?"
    "\n(Note that it is up to the instructor to decide if you need to attend these)"
    " [Second choice course]": "Lectures: second choice",
    "Are you available to attend at least one of the lab/discussion sections for your first and"
    " second choice courses?\n(Note that it is up to the instructor to decide if you need to attend"
    " these) [First choice course]": "Sections: first choice",
    "Are you available to attend at least one of the lab/discussion sections for your first and"
    " second choice courses?\n(Note that it is up to the instructor to decide if you need to attend"
    " these) [Second choice course]": "Sections: second choice",
}


# The TA-eligibility question has two canned answers; anything else is free text about the
# applicant's own plans and is replaced by this.
TA_ELIGIBILITY_CANNED = ("Yes: so I will DEFINITELY", "No")
TA_ELIGIBILITY_REPLACEMENT = "Not sure yet; it depends on whether I am admitted to the BS/MS program."

# Free-text availability comments are replaced, one of these per non-blank cell.
AVAILABILITY_REPLACEMENTS = [
    "I have a conflict with the Tuesday 2pm section but any other section works.",
    "Available for all lectures and sections except Friday mornings.",
    "I can attend one lecture a week; the other overlaps with a required course.",
    "No conflicts that I know of yet; my schedule may change after pass 2.",
    "I am available for every section of my first choice but only the morning sections of my second.",
    "I work Monday and Wednesday afternoons, otherwise fully available.",
]

# Name pools. Any name that also occurs in the input is dropped before use.
FIRST = """Aarav Adaeze Aiko Alejandro Amara Anika Arjun Beatriz Caleb Camila Chidi Daniela Dmitri
Elena Emeka Esperanza Farah Fatima Felix Gabriela Hana Hiroshi Ibrahim Ines Isabela Jamal Javier
Jonas Kai Kavya Keanu Kenji Kwame Leila Liam Lucia Malik Marisol Mateo Maya Mei Mikhail Nadia Naomi
Nikolai Noor Olamide Omar Paulo Priya Rafael Rania Ravi Rosa Sade Sakura Samir Santiago Sofia Soren
Tariq Tomas Valentina Wei Ximena Yara Yusuf Zainab Zoe Ahmed Bianca Dario Eitan Freya Gustavo Imani
Jun Lior Mirela Nico Oluwaseun Pilar Quinn Ren Suki Thandiwe Uma Vikram Wren Yosef Adaora Bram
Cecilia Desmond Elif Fergus Greta Hamid Ilse Joaquin Katya Lorcan Nils Odalys Piotr Ragnar""".split()
LAST = """Abara Achterberg Adeyemi Alvarez Andersson Baptiste Bergstrom Castellanos Chaudhary Chen
Dlamini Duarte Eriksen Espinoza Ferreira Fitzgerald Gallagher Gonzalez Haddad Hamasaki Iyer Jansen
Kapoor Kimura Kowalski Lindqvist Lopez Mahmoud Mendes Mwangi Nakamura Novak Obi Okafor Okonkwo
Ortega Patel Petrov Quintero Ramirez Rossi Saito Salazar Schneider Sharma Silva Soriano Takahashi
Tanaka Varga Vasquez Villanueva Watanabe Yilmaz Zhang Zhou Abegunde Bakshi Carvalho Delacroix
Ekwueme Farouk Guerrero Halvorsen Ivanova Jimenez Kaur Larsson Moreau Nwosu Oyelaran Pereira Rahman
Santos Tremblay Uchida Vargas Weiss Yamamoto Zielinski Aalbers Bjornstad Dragomir Eskildsen Fontaine
Grimaldi Hallstrom Ignatova Jorgensen Kaminski Lindgren Marchetti Nystrom Olofsson Paquette""".split()

# Every video link becomes a link to a well-known viral video, so nothing points at a real
# applicant's video and nobody mistakes a link for one. A row that used the short youtu.be form
# keeps that form; everything else (youtube.com, Google Drive, Dropbox, ...) gets the long form.
VIRAL_VIDEOS = [
    ("dQw4w9WgXcQ", "Rick Astley, Never Gonna Give You Up"),
    ("oavMtUWDBTM", "Eduard Khil, Trololo"),
    ("QH2-TGUlwu4", "Nyan Cat"),
    ("J---aiyznGQ", "Keyboard Cat"),
    ("_OBlgSz8sSM", "Charlie bit my finger"),
    ("a1Y73sPHKxw", "Dramatic Chipmunk"),
    ("EwTZ2xpQwpA", "Tay Zonday, Chocolate Rain"),
    ("KmtzQCSh6xk", "Numa Numa"),
    ("9bZkp7q19f0", "PSY, Gangnam Style"),
    ("OQSNhk5ICTI", "Double Rainbow"),
    ("8vJiSSAMNWw", "Harlem Shake"),
    ("dMH0bHeiRNg", "Evolution of Dance"),
    ("HPPj6viIBmU", "Star Wars Kid"),
    ("kHmvkRoEowc", "Leave Britney Alone"),
    ("FzRH3iTQPrk", "Sneezing Baby Panda"),
    ("EIyixC9NsLI", "Badger Badger Badger"),
]
SHORT_LINK = "https://youtu.be/{id}"
LONG_LINK = "https://www.youtube.com/watch?v={id}"


def token_in(token, text):
    return re.search(r"(?<![A-Za-z0-9])" + re.escape(token) + r"(?![A-Za-z0-9])", text, re.I) is not None


class Obfuscator:
    def __init__(self, header, rows, seed):
        self.hdr = header
        self.rows = [list(r) for r in rows]
        self.orig = [list(r) for r in rows]
        self.rng = random.Random(seed)
        self.notes = []
        for name in (TIMESTAMP, EMAIL, FIRST_NAME, LAST_NAME, PERM, VIDEO_LINK):
            if self.find(name) is None:
                sys.exit(f"input has no column {name!r}")
        text = "\n".join(",".join(r) for r in rows).lower()
        # the tokens that must never appear in the output
        self.real_tokens = set()
        for r in self.orig:
            for col in (FIRST_NAME, LAST_NAME):
                v = self.get(r, col).strip().lower()
                if len(v) >= 3:
                    self.real_tokens.add(v)
            self.real_tokens.add(self.get(r, EMAIL).split("@")[0].strip().lower())
            self.real_tokens.add(self.get(r, PERM).strip().lower())
            for col in (EMPLOYEE_ID, VIDEO_LINK):
                v = self.get(r, col).strip()
                if re.fullmatch(r"\d{4,}", v):
                    self.real_tokens.add(v)
                for m in re.findall(r"[A-Za-z0-9_-]{8,}", v) if col == VIDEO_LINK else []:
                    self.real_tokens.add(m.lower())
        self.real_tokens.discard("")
        # a name that is also an ordinary word elsewhere in the input (an instructor named in a
        # column header, say) is not a tell when it shows up in the output; the check ignores it
        identity = {self.find(c) for c in (EMAIL, FIRST_NAME, LAST_NAME, PERM, EMPLOYEE_ID, VIDEO_LINK)}
        other_text = "\n".join(header) + "\n" + "\n".join(
            r[i] for r in self.orig for i in range(len(header)) if i not in identity)
        self.word_like = {t for t in self.real_tokens if token_in(t, other_text)}
        self.first = [n for n in FIRST if n.lower() not in text]
        self.last = [n for n in LAST if n.lower() not in text]

    # ---- columns by header ----------------------------------------------------------------------
    def find(self, start):
        for i, h in enumerate(self.hdr):
            if h.startswith(start):
                return i
        return None

    def columns(self, start):
        return [i for i, h in enumerate(self.hdr) if h.startswith(start)]

    def get(self, row, start):
        i = self.find(start)
        return row[i] if i is not None else ""

    def set(self, row, start, value):
        row[self.find(start)] = value

    # ---- 1. identities ---------------------------------------------------------------------------
    def fake_identities(self):
        names, locals_, perms, ids = set(), set(), set(), set()
        for r in self.rows:
            while True:
                first, last = self.rng.choice(self.first), self.rng.choice(self.last)
                if (first, last) not in names:
                    names.add((first, last))
                    break
            domain = self.get(r, EMAIL).split("@")[-1].strip().lower() or "example.com"
            styles = [
                lambda: f"{first}{last}", lambda: f"{first.lower()}_{last.lower()}",
                lambda: f"{first[0]}{last}", lambda: f"{first}{last[0]}",
                lambda: f"{first}{last}{self.rng.randint(1, 99)}",
            ]
            while True:
                local = self.rng.choice(styles)().lower()
                if local not in locals_:
                    locals_.add(local)
                    break
            while True:
                perm = str(self.rng.randint(1000000, 9999999))
                if perm not in perms:
                    perms.add(perm)
                    break
            self.set(r, FIRST_NAME, first)
            self.set(r, LAST_NAME, last)
            self.set(r, EMAIL, f"{local}@{domain}")
            self.set(r, PERM, perm)
            # an employee id is digits for anyone who has one; anything else was a remark
            if self.find(EMPLOYEE_ID) is not None:
                v = self.get(r, EMPLOYEE_ID).strip()
                if re.fullmatch(r"\d+", v):
                    while True:
                        fake = str(self.rng.randint(1000000, 9999999))
                        if fake not in ids:
                            ids.add(fake)
                            break
                    self.set(r, EMPLOYEE_ID, fake)
                elif v:
                    self.set(r, EMPLOYEE_ID, "N/A")

    # ---- 2. free text ----------------------------------------------------------------------------
    def replace_free_text(self):
        if self.find(TA_ELIGIBILITY) is not None:
            for r in self.rows:
                v = self.get(r, TA_ELIGIBILITY).strip()
                canned = v == "No" or v.startswith(TA_ELIGIBILITY_CANNED[0])
                if v and not canned:
                    self.set(r, TA_ELIGIBILITY, TA_ELIGIBILITY_REPLACEMENT)
        if self.find(AVAILABILITY_COMMENTS) is not None:
            for r in self.rows:
                if self.get(r, AVAILABILITY_COMMENTS).strip():
                    self.set(r, AVAILABILITY_COMMENTS, self.rng.choice(AVAILABILITY_REPLACEMENTS))

    # ---- 3. video links --------------------------------------------------------------------------
    def fake_video_links(self):
        for r in self.rows:
            link = self.get(r, VIDEO_LINK).strip()
            if not link:
                continue
            video_id = self.rng.choice(VIRAL_VIDEOS)[0]
            template = SHORT_LINK if "youtu.be/" in link else LONG_LINK
            self.set(r, VIDEO_LINK, template.format(id=video_id))

    # ---- 4. permutations -------------------------------------------------------------------------
    def permute_blocks(self):
        for block in BLOCKS:
            indexes = []
            for start in block:
                indexes += self.columns(start)
            indexes = sorted(set(indexes))
            if not indexes:
                self.notes.append(f"no column starts with {block[0]!r}; block skipped")
                continue
            values = [[r[i] for i in indexes] for r in self.rows]
            self.rng.shuffle(values)
            for r, v in zip(self.rows, values):
                for i, x in zip(indexes, v):
                    r[i] = x

    # ---- 5. timestamps ---------------------------------------------------------------------------
    def shift_timestamps(self):
        for r in self.rows:
            v = self.get(r, TIMESTAMP).strip()
            if not v:
                continue
            delta = timedelta(seconds=self.rng.choice([-1, 1]) * self.rng.randint(3600, 72 * 3600))
            stamp = datetime.strptime(v, TIMESTAMP_FORMAT) + delta
            # the form writes the month, day and hour without a leading zero
            self.set(r, TIMESTAMP, f"{stamp.month}/{stamp.day}/{stamp.year} {stamp.hour}:{stamp:%M:%S}")

    # ---- checks ----------------------------------------------------------------------------------
    def check(self):
        problems = []
        text = "\n".join(",".join(r) for r in self.rows)
        leaks = sorted(t for t in self.real_tokens - self.word_like if token_in(t, text))
        for t in sorted(self.word_like):
            if token_in(t, text):
                self.notes.append(f"{t!r} is a name in the input but also an ordinary word there; left in")
        if leaks:
            problems.append(f"identifying tokens from the input present: {leaks}")
        orig_ts = {self.get(r, TIMESTAMP) for r in self.orig}
        if any(self.get(r, TIMESTAMP) in orig_ts for r in self.rows):
            problems.append("a timestamp is identical to an original one")
        if any(a == b for a in self.rows for b in self.orig):
            problems.append("a row is identical to an original row")
        for col in (EMAIL, PERM):
            values = [self.get(r, col) for r in self.rows]
            if len(set(values)) != len(values):
                problems.append(f"{col} values are not unique")
        if re.search(r"[^\x00-\x7f]", text):
            problems.append("non-ASCII characters present")
        return problems

    # ---- 6. header -------------------------------------------------------------------------------
    def rename_headers(self):
        for start, name in HEADER_RENAMES.items():
            i = self.find(start)
            if i is None:
                self.notes.append(f"no column starts with {start[:50]!r}; nothing renamed")
            else:
                self.hdr[i] = name
        # whatever else the form puts a line break into becomes one line
        for i, h in enumerate(self.hdr):
            if "\r" in h or "\n" in h:
                self.hdr[i] = " ".join(h.split())
                self.notes.append(f"header {i} had a line break; collapsed to one line")

    def run(self):
        self.fake_identities()
        self.replace_free_text()
        self.fake_video_links()
        self.permute_blocks()
        self.shift_timestamps()
        problems = self.check()
        self.rename_headers()  # last, since the steps above find columns by their original names
        # The free-text answers were replaced above and every other column is categorical, so no
        # cell can carry a line break; with the headers renamed, each record is one line.
        if any("\r" in c or "\n" in c for r in [self.hdr] + self.rows for c in r):
            problems.append("a header or cell still contains a line break")
        return problems


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("input", help="the ULA application form's response export")
    parser.add_argument("output", help="where to write the obfuscated CSV")
    parser.add_argument("--seed", type=int, default=20261030, help="random seed (default 20261030)")
    args = parser.parse_args()

    with open(args.input, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    header, data = rows[0], rows[1:]
    ob = Obfuscator(list(header), data, args.seed)
    problems = ob.run()

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(ob.hdr)
        writer.writerows(ob.rows)

    print(f"wrote {len(ob.rows)} rows to {args.output}")
    for note in ob.notes:
        print("note:", note)
    if problems:
        print("CHECKS FAILED:", file=sys.stderr)
        for p in problems:
            print("  -", p, file=sys.stderr)
        sys.exit(1)
    print("all checks passed: no applicant identifiers from the input remain")


if __name__ == "__main__":
    main()
