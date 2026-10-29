#!/usr/bin/env python3
"""Turn an export of the legacy TA application database into a file safe to keep in the repo.

    python3 obfuscate-legacy-ta-app-data.py INPUT.csv OUTPUT.csv [--seed N]

The input is the legacy app's CSV export (FERPA-protected; never commit it). The output has the
same header, row count and column formats, but no value that can be traced to an applicant. The
steps, in order, are described in README.md next to this script. Everything is drawn from a seeded
random generator, so the same input and seed give the same output.

Standard library only; Python 3.9 or later.
"""
import argparse
import csv
import html
import random
import re
import sys
from datetime import datetime, timedelta

# --------------------------------------------------------------------------------------------
# Column roles
# --------------------------------------------------------------------------------------------

# Permuted independently: each column keeps its values but they land on random rows.
PERMUTED = [
    "language_exam", "language_exam_date_passed", "major", "gpa_major", "gpa_overall",
    "class_level", "year_in_program", "graduation_date", "coursework_ucsb", "coursework_other",
    "knowledge", "prev_experience", "preferred_job",
    "residency_status", "desired_courses_upper", "desired_courses_lower", "preferred_hours",
]
# Permuted together, so a row's modified time never precedes its submitted time.
DATE_PAIR = ["date_submitted", "date_modified"]
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
BLANKED = ["comments_applicant", "comments_reviewer"]
MIDDLE_NAME = "Fakedata"

# Course data: comma-separated entries of colon-separated fields. Each field is redrawn from the
# pool of values that field holds across the whole column, so vocabularies (UCSB course numbers,
# grades, quarters, roles) stay within the real data.
COURSE_COLUMNS = {
    # column: (number of fields, index of the field that must not repeat within a row, or None)
    "coursework_ucsb": (2, 0),      # course:grade
    "coursework_290": (3, None),    # 290-course description:instructor:grade
    "coursework_other": (3, None),  # course title:school:equivalent UCSB course
    "prev_experience": (3, 0),      # course:role:quarter
}
SCHOOL_COLUMN, SCHOOL_FIELD = "coursework_other", 1
INSTRUCTOR_COLUMN, INSTRUCTOR_FIELD = "coursework_290", 1
OUR_SCHOOLS = {"", "UCSB", "UCSB visiting"}

# --------------------------------------------------------------------------------------------
# Name pools. Any name that also occurs in the input is dropped before use.
# --------------------------------------------------------------------------------------------

APPLICANT_FIRST = """Aarav Adaeze Aiko Alejandro Amara Anika Arjun Beatriz Caleb Camila Chidi Daniela
Dmitri Elena Emeka Esperanza Farah Fatima Felix Gabriela Hana Hiroshi Ibrahim Ines Isabela Jamal
Javier Jonas Kai Kavya Keanu Kenji Kwame Leila Liam Lucia Malik Marisol Mateo Maya Mei Mikhail Nadia
Naomi Nikolai Noor Olamide Omar Paulo Priya Rafael Rania Ravi Rosa Sade Sakura Samir Santiago Sofia
Soren Tariq Tomas Valentina Wei Ximena Yara Yusuf Zainab Zoe Ahmed Bianca Dario Eitan Freya Gustavo
Imani Jun Lior Mirela Nico Oluwaseun Pilar Quinn Ren Suki Thandiwe Uma Vikram Wren Yosef""".split()
APPLICANT_LAST = """Abara Achterberg Adeyemi Alvarez Andersson Baptiste Bergstrom Castellanos
Chaudhary Chen Dlamini Duarte Eriksen Espinoza Ferreira Fitzgerald Gallagher Gonzalez Haddad
Hamasaki Iyer Jansen Kapoor Kimura Kowalski Lindqvist Lopez Mahmoud Mendes Mwangi Nakamura Novak Obi
Okafor Okonkwo Ortega Patel Petrov Quintero Ramirez Rossi Saito Salazar Schneider Sharma Silva
Soriano Takahashi Tanaka Varga Vasquez Villanueva Watanabe Yilmaz Zhang Zhou Abegunde Bakshi
Carvalho Delacroix Ekwueme Farouk Guerrero Halvorsen Ivanova Jimenez Kaur Larsson Moreau Nwosu
Oyelaran Pereira Rahman Santos Tremblay Uchida Vargas Weiss Yamamoto Zielinski""".split()
INSTRUCTOR_FIRST = """Adaora Bram Cecilia Desmond Elif Fergus Greta Hamid Ilse Joaquin Katya Lorcan
Marguerite Nils Odalys Piotr Quique Ragnar Saoirse Tadeo Ulla Viggo Wilhelmina Xiomara Yevgeni
Zbigniew Annika Baruch Clotilde Dagny Eamon Fenna Gustaf Henrike Ivo Jolanda Kasimir Liesl Matthias
Noemi Oskar Perpetua Rasmus Sigrid Teodor Ursula Valdis Wiebke Yoram Zelda Agnieszka Benedikt
Corvina Dimitra Emmerich Fiorella Gerrit Halldora Ignatius Jorunn""".split()
INSTRUCTOR_LAST = """Aalbers Bjornstad Castellucci Dragomir Eskildsen Fontaine Grimaldi Hallstrom
Ignatova Jorgensen Kaminski Lindgren Marchetti Nystrom Olofsson Paquette Quiroga Rautio Sorensen
Thorvaldsen Ulriksen Vanterpool Wessels Xenakis Ylitalo Zwolinski Ahlgren Brandvold Czajka Dahlberg
Engelbrecht Fjeldstad Gundersen Haugland Isaksen Jelinek Kjellberg Lundqvist Moesgaard Nordahl
Ostergaard Pietilainen Ravndal Sandoval-Rey Tvedt Uusitalo Vestergaard Wahlberg Yrjola Zeitler
Antonsen Berglund Carstens Dreyer Eliassen Falkenberg Gronvold Hovland Iversen Juhl""".split()

# --------------------------------------------------------------------------------------------
# Schools. A known school maps to a fixed stand-in in the same style (abbreviation, city suffix,
# "(undergrad)", "; country" kept). A school-looking value not listed here gets a stand-in from
# SPARE_SCHOOLS instead, the same one every time it occurs. Values that are not schools at all
# (a course title typed into the school field) are left alone.
# --------------------------------------------------------------------------------------------

KNOWN_SCHOOLS = {
    "Bangladesh University of Engineering and Technology": "Khulna University of Engineering and Technology",
    "Bilkent University": "Koc University",
    "California Lutheran University": "Chapman University",
    "Carnegie Mellon University": "Northwestern University", "CMU": "Northwestern",
    "College of the Canyons": "Moorpark College",
    "Cornell University": "Brown University",
    "CSULB": "CSUF", "CSUN": "CSULA",
    "De Anza College": "Mission College",
    "ESI; Algeria": "ENSIAS; Morocco",
    "Foothill College": "West Valley College",
    "FUDAN UNIVERSITY": "TONGJI UNIVERSITY",
    "Grand Canyon University": "Northern Arizona University",
    "Hongik University": "Hanyang University",
    "Huazhong Tech University": "Harbin Tech University",
    "Huazhong University of Science and Technology": "Harbin University of Science and Technology",
    "IIITH; Telangana; India": "IIITB; Karnataka; India",
    "Johns Hopkins University": "Duke University",
    "Miami University": "Ohio University",
    "Nanjing University": "Nankai University", "Nanjing University&#44; China": "Nankai University&#44; China",
    "PES University India(undergrad)": "Amrita University India(undergrad)",
    "Rice University": "Vanderbilt University",
    "Saddleback Collage": "Cypress College",
    "Saint-Petersburg Polytechnic University": "Tomsk Polytechnic University",
    "Shanghai Jiao Tong University": "Sun Yat-sen University",
    "Sharif University of Technology": "Amirkabir University of Technology",
    "Sungkyunkwan University": "Yonsei University",
    "Tsinghua University": "Peking University",
    "Tsinghua University&#44; University of Southern California": "Peking University&#44; Santa Clara University",
    "University of Southern California": "Santa Clara University", "USC": "SCU",
    "UC Berkeley": "UC Davis",
    "UCI": "UCLA", "University of California&#44; Irvine": "University of California&#44; Los Angeles",
    "UCR": "UCM", "UC Riverside": "UC Merced",
    "UCSD": "SDSU",
    "University of California&#44; Santa Cruz": "California State University&#44; Monterey Bay",
    "University of Science and Technology of China": "Southern University of Science and Technology",
    "Univ. of Sci. and Tech. of China": "Southern Univ. of Sci. and Tech.",
    "Univ. of Sci. and Tech. of C": "Southern Univ. of Sci. and Tec",
    "University of Electronic Science and Technology of China": "Beijing University of Posts and Telecommunications",
    "University of Arkansas&#44; Fayetteville": "University of Oklahoma&#44; Norman",
    "University of Central Arkansas": "University of Central Oklahoma",
    "University of Florida": "University of Georgia",
    "University of Michigan": "University of Wisconsin",
    "University of Michigan&#44; Ann Arbor": "University of Wisconsin&#44; Madison",
    "University of Tehran": "University of Isfahan",
    "University of Virginia": "University of Maryland",
    "University of Washington": "University of Oregon",
    "UT Austin": "Texas A&M",
    "Wuhan University": "Sichuan University",
    "Xi'an Jiaotong University": "Beihang University",
    "Xidian University": "Jilin University",
    "Zhejiang University": "Shandong University",
}
SPARE_SCHOOLS = [
    "University of Vermont", "Boise State University", "University of Maine", "Montana State University",
    "University of Rhode Island", "Kansas State University", "University of New Hampshire",
    "Idaho State University", "West Virginia University", "University of Oslo", "University of Auckland",
    "Aalto University", "Ghent University", "University of Tartu", "Chulalongkorn University",
    "University of Cape Town", "Universidad de Salamanca", "Lund University", "University of Waikato",
    "Dalhousie University", "University of Manitoba", "Universidad de los Andes", "Ateneo de Manila University",
]
SCHOOL_WORDS = re.compile(
    r"\b(University|Universit[aà]t|Universidad|Universit[eé]|Institute|College|Collage|Polytechnic|"
    r"Politecnico|School|Academy|UC [A-Z]\w+|UC[A-Z]{1,3}|CSU[A-Z]*|IIT\w*|IIIT\w*|NIT\w*)\b")

# --------------------------------------------------------------------------------------------


def entries(cell):
    return [e for e in cell.split(",")] if cell.strip() else []


def is_ascii_token_in(token, text):
    return re.search(r"(?<![A-Za-z])" + re.escape(token) + r"(?![A-Za-z])", text, re.I) is not None


class Obfuscator:
    def __init__(self, header, rows, seed):
        self.hdr = header
        self.col = {h: i for i, h in enumerate(header)}
        self.rows = [list(r) for r in rows]
        self.orig = [list(r) for r in rows]
        self.rng = random.Random(seed)
        self.notes = []
        text = "\n".join(",".join(r) for r in rows).lower()
        # the tokens that must never appear in the output
        self.real_tokens = set()
        for r in self.orig:
            for h in ("first_name", "last_name", "middle_name"):
                v = r[self.col[h]].strip().lower()
                if len(v) >= 3:
                    self.real_tokens.add(v)
            self.real_tokens.add(r[self.col["email"]].split("@")[0].strip().lower())
        # a name that is also an ordinary word elsewhere in the input (a course called "GEN", say)
        # is not a tell when it shows up in the output, so the final check ignores those
        identity = {"first_name", "last_name", "middle_name", "email"}
        other_text = "\n".join(r[i] for r in self.orig for h, i in self.col.items() if h not in identity)
        self.word_like = {t for t in self.real_tokens if is_ascii_token_in(t, other_text)}
        self.applicant_first = [n for n in APPLICANT_FIRST if n.lower() not in self.real_tokens]
        self.applicant_last = [n for n in APPLICANT_LAST if n.lower() not in self.real_tokens]
        self.instructor_first = [n for n in INSTRUCTOR_FIRST if n.lower() not in text]
        self.instructor_last = [n for n in INSTRUCTOR_LAST if n.lower() not in text]
        self.input_text = text

    def c(self, row, name):
        return row[self.col[name]]

    def set(self, row, name, value):
        row[self.col[name]] = value

    # ---- 1. identities --------------------------------------------------------------------
    def fake_identities(self):
        used_names, used_locals = set(), set()
        for r in self.rows:
            while True:
                first, last = self.rng.choice(self.applicant_first), self.rng.choice(self.applicant_last)
                if (first, last) not in used_names:
                    used_names.add((first, last))
                    break
            domain = self.c(r, "email").split("@")[-1].strip().lower() or "example.com"
            styles = [
                lambda: f"{first}{last}", lambda: f"{first}.{last}", lambda: f"{first[0]}{last}",
                lambda: f"{first}_{last}", lambda: f"{first}{last[0]}",
                lambda: f"{first}{last}{self.rng.randint(1, 99)}",
            ]
            while True:
                local = self.rng.choice(styles)().lower()
                if local not in used_locals:
                    used_locals.add(local)
                    break
            self.set(r, "first_name", first)
            self.set(r, "last_name", last)
            self.set(r, "middle_name", MIDDLE_NAME)
            self.set(r, "email", f"{local}@{domain}")

    # ---- 2. permutations and blanking ---------------------------------------------------------
    def permute(self, columns):
        values = [[self.c(r, c) for c in columns] for r in self.rows]
        self.rng.shuffle(values)
        for r, v in zip(self.rows, values):
            for c, x in zip(columns, v):
                self.set(r, c, x)

    def permute_columns(self):
        for c in PERMUTED:
            self.permute([c])
        self.permute(DATE_PAIR)

    def blank_comments(self):
        for r in self.rows:
            for c in BLANKED:
                self.set(r, c, "")

    # ---- 3. schools -----------------------------------------------------------------------
    def replace_schools(self):
        spare = [s for s in SPARE_SCHOOLS if s.lower() not in self.input_text]
        self.rng.shuffle(spare)
        assigned = {}
        for r in self.rows:
            new = []
            for e in entries(self.c(r, SCHOOL_COLUMN)):
                parts = e.split(":")
                if len(parts) == 3:
                    school = parts[SCHOOL_FIELD].strip()
                    if school in KNOWN_SCHOOLS:
                        parts[SCHOOL_FIELD] = KNOWN_SCHOOLS[school]
                    elif school not in OUR_SCHOOLS and SCHOOL_WORDS.search(html.unescape(school)):
                        if school not in assigned:
                            assigned[school] = spare.pop() if spare else "State University"
                            self.notes.append(f"school not in the known list, replaced by a spare: {school!r}")
                        parts[SCHOOL_FIELD] = assigned[school]
                new.append(":".join(parts))
            self.set(r, SCHOOL_COLUMN, ",".join(new))

    # ---- 4. course data -------------------------------------------------------------------
    def redraw_course_columns(self):
        for column, (nparts, distinct) in COURSE_COLUMNS.items():
            all_entries = [e for r in self.rows for e in entries(self.c(r, column))]
            bad = [e for e in all_entries if len(e.split(":")) != nparts]
            if bad:
                self.notes.append(f"{column}: {len(bad)} entries do not have {nparts} fields and are left as they are")
            pools = [[e.split(":")[k].strip() for e in all_entries if len(e.split(":")) == nparts]
                     for k in range(nparts)]
            orig_cells = {self.c(r, column).strip() for r in self.orig if self.c(r, column).strip()}
            for r in self.rows:
                old = entries(self.c(r, column))
                if not old:
                    continue
                for _ in range(1000):  # until the whole cell differs from every original cell
                    new, used = [], set()
                    for e in old:
                        if len(e.split(":")) != nparts:
                            new.append(e)
                            continue
                        for _ in range(1000):
                            fields = [self.rng.choice(p) for p in pools]
                            if distinct is not None and fields[distinct] in used:
                                continue
                            cand = ":".join(fields)
                            if cand != e.strip():
                                break
                        else:
                            raise SystemExit(f"could not redraw an entry in {column}")
                        if distinct is not None:
                            used.add(fields[distinct])
                        new.append(cand)
                    cell = ",".join(new)
                    if cell not in orig_cells:
                        break
                else:
                    raise SystemExit(f"could not make a {column} cell that differs from the original")
                self.set(r, column, cell)

    # ---- 5. instructors -------------------------------------------------------------------
    def fake_instructors(self):
        reals = sorted({e.split(":")[INSTRUCTOR_FIELD].strip() for r in self.rows
                        for e in entries(self.c(r, INSTRUCTOR_COLUMN)) if len(e.split(":")) == 3})
        fake_for, combos = {"": ""}, set()
        for real in reals:
            if not real:
                continue
            while True:
                first, last = self.rng.choice(self.instructor_first), self.rng.choice(self.instructor_last)
                if (first, last) not in combos:
                    combos.add((first, last))
                    break
            tokens = real.split()
            if len(tokens) >= 3 and re.fullmatch(r"[A-Za-z]\.?", tokens[1]):
                initial = self.rng.choice("ABCDEFGHJKLMNPRSTV") + ("." if tokens[1].endswith(".") else "")
                fake_for[real] = f"{first} {initial} {last}"
            elif len(tokens) >= 3:
                fake_for[real] = f"{first} {self.rng.choice(self.instructor_first)} {last}"
            elif len(tokens) == 1:
                fake_for[real] = last
            else:
                fake_for[real] = f"{first} {last}"
        for r in self.rows:
            new = []
            for e in entries(self.c(r, INSTRUCTOR_COLUMN)):
                parts = e.split(":")
                if len(parts) == 3:
                    parts[INSTRUCTOR_FIELD] = fake_for[parts[INSTRUCTOR_FIELD].strip()]
                    # a name typed into the description ("..., YANG T") goes too
                    parts[0] = re.sub(r"(&#44;|,)\s*[A-Z]{2,}\s[A-Z]\b\.?$", "", parts[0]).strip()
                new.append(":".join(parts))
            self.set(r, INSTRUCTOR_COLUMN, ",".join(new))
        self.real_instructor_tokens = {t for n in reals for t in n.split() if len(t) > 3}

    # ---- 6. text clean-up -------------------------------------------------------------------
    @staticmethod
    def clean(text):
        text = re.sub(r"\s*[^\x00-\x7f]+\s*", lambda m: " - " if m.group(0).strip() else m.group(0), text)
        return re.sub(r"\s{2,}", " ", text).strip()

    def clean_text(self):
        for r in self.rows:
            for h in self.hdr:
                if not h:
                    continue
                v = self.c(r, h)
                if re.search(r"[^\x00-\x7f]", v):
                    self.set(r, h, self.clean(v))
                if "Collage" in v:
                    self.set(r, h, self.c(r, h).replace("Collage", "College"))

    # ---- 7. timestamps --------------------------------------------------------------------
    def shift_timestamps(self):
        for r in self.rows:
            delta = timedelta(seconds=self.rng.choice([-1, 1]) * self.rng.randint(3600, 72 * 3600))
            for h in DATE_PAIR:
                v = self.c(r, h).strip()
                if v:
                    self.set(r, h, (datetime.strptime(v, DATE_FORMAT) + delta).strftime(DATE_FORMAT))

    # ---- checks -----------------------------------------------------------------------------
    def check(self):
        problems = []
        text = "\n".join(",".join(r) for r in self.rows)
        leaks = sorted(t for t in self.real_tokens - self.word_like if is_ascii_token_in(t, text))
        for t in sorted(self.word_like):
            if is_ascii_token_in(t, text):
                self.notes.append(f"{t!r} is a name in the input but also an ordinary word there; left in")
        if leaks:
            problems.append(f"applicant name or email tokens present: {leaks}")
        instr = sorted(t for t in self.real_instructor_tokens if is_ascii_token_in(t, text))
        if instr:
            problems.append(f"real instructor name tokens present: {instr}")
        for school in KNOWN_SCHOOLS:
            if html.unescape(school) in html.unescape(text):
                problems.append(f"original school present: {school}")
        if re.search(r"[^\x00-\x7f]", text):
            problems.append("non-ASCII characters present")
        for column in COURSE_COLUMNS:
            oc = {self.c(r, column).strip() for r in self.orig if self.c(r, column).strip()}
            same = sum(1 for r in self.rows if self.c(r, column).strip() in oc)
            if same:
                problems.append(f"{column}: {same} cells identical to an original cell")
        for c in PERMUTED:
            if sorted(self.c(r, c) for r in self.rows if c not in COURSE_COLUMNS) != \
               sorted(self.c(r, c) for r in self.orig if c not in COURSE_COLUMNS):
                problems.append(f"{c}: values are not the original multiset")
        orig_ts = {self.c(r, h) for r in self.orig for h in DATE_PAIR}
        if any(self.c(r, h) in orig_ts for r in self.rows for h in DATE_PAIR):
            problems.append("a timestamp is identical to an original one")
        if any(self.c(r, "date_modified") < self.c(r, "date_submitted") for r in self.rows):
            problems.append("a modified time precedes its submitted time")
        if any(a == b for a in self.rows for b in self.orig):
            problems.append("a row is identical to an original row")
        return problems

    def run(self):
        self.fake_identities()
        self.permute_columns()
        self.blank_comments()
        self.replace_schools()
        self.redraw_course_columns()
        self.fake_instructors()
        self.clean_text()
        self.shift_timestamps()
        return self.check()


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("input", help="the legacy app's CSV export of real applications")
    parser.add_argument("output", help="where to write the obfuscated CSV")
    parser.add_argument("--seed", type=int, default=20261029, help="random seed (default 20261029)")
    args = parser.parse_args()

    with open(args.input, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    header, data = rows[0], rows[1:]
    missing = [c for c in PERMUTED + DATE_PAIR + BLANKED + ["first_name", "last_name", "middle_name", "email"]
               if c not in header]
    if missing:
        sys.exit(f"input is missing columns: {missing}")

    ob = Obfuscator(header, data, args.seed)
    problems = ob.run()

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(ob.rows)

    print(f"wrote {len(ob.rows)} rows to {args.output}")
    for note in ob.notes:
        print("note:", note)
    if problems:
        print("CHECKS FAILED:", file=sys.stderr)
        for p in problems:
            print("  -", p, file=sys.stderr)
        sys.exit(1)
    print("all checks passed: no applicant, instructor or school identifiers from the input remain")


if __name__ == "__main__":
    main()
