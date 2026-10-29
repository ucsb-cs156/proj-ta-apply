# Sample data from the legacy applications

Two files here are exports of the applications students made before this app existed, with every
value that could be traced to a real applicant removed or replaced. Each has its real export's
header, row count and column formats, so it can be used to design and test the import of legacy
data, and is safe to keep in the repository.

| File | What it is | Made by |
|---|---|---|
| `legacy-ta-app-csv-example.csv` | The legacy PHP **TA** application's database export | `obfuscate-legacy-ta-app-data.py` |
| `legacy-ula-csv-example.csv` | The **ULA** application Google Form's "Form Responses" sheet, downloaded as CSV | `obfuscate-legacy-ula-app-data.py` |

The real exports are FERPA-protected. Never commit them. Only the scripts' output is committed.

# The TA export: `obfuscate-legacy-ta-app-data.py`

## Usage

```
python3 docs/sample-data/obfuscate-legacy-ta-app-data.py INPUT.csv OUTPUT.csv [--seed N]
```

| Parameter | Meaning |
|---|---|
| `INPUT.csv` | The legacy app's CSV export of real applications (read only, never modified). |
| `OUTPUT.csv` | Where the obfuscated CSV is written; overwritten if it exists. |
| `--seed N` | Random seed, default `20261029`. The same input and seed always give the same output. |

The script needs Python 3.9 or later and nothing outside the standard library. It prints the
number of rows written, any notes (for example a school it had not seen before and replaced with
a spare name), and the result of its final checks. If any check fails it exits with status 1,
and the output file should not be used.

The file in this directory was made with:

```
python3 docs/sample-data/obfuscate-legacy-ta-app-data.py sample-data-original.csv docs/sample-data/legacy-ta-app-csv-example.csv
```

## What the script does

The steps run in this order.

1. **Fake identities.** Every row gets a unique fake first and last name from built-in lists,
   after dropping any list name that also occurs in the input. The middle name is `Fakedata`
   on every row, so nobody can mistake the file for real data. The email is built from the fake
   name in one of several plausible styles (`first.last`, `flast`, `first_last`, …), unique
   across rows, keeping each row's original domain (`ucsb.edu` for almost all).
2. **Permutation.** Each of these columns keeps its values, but they are shuffled onto random
   rows, independently of one another, so no row is any one applicant's combination of answers:
   `language_exam`, `language_exam_date_passed`, `major`, `gpa_major`, `gpa_overall`,
   `class_level`, `year_in_program`, `graduation_date`, `coursework_ucsb`, `coursework_other`,
   `knowledge`, `prev_experience`, `preferred_job`, `residency_status`,
   `desired_courses_upper`, `desired_courses_lower`, `preferred_hours`.
   `date_submitted` and `date_modified` are shuffled together as a pair, so a row's modified
   time never precedes its submitted time.
3. **Comments blanked.** `comments_applicant` and `comments_reviewer` are emptied.
4. **Other schools renamed.** In `coursework_other`, whose entries are
   `course title:school:equivalent UCSB course`, every school other than UCSB is replaced by a
   university that does not occur in the input, in the same style: an abbreviation stays an
   abbreviation (`CMU` → `Northwestern`, `UCI` → `UCLA`), and a city suffix, `(undergrad)` or
   `; country` is kept. Known schools have fixed stand-ins in the script; a school-looking value
   it has not seen gets one of a list of spares, the same one wherever it occurs, and is reported
   in a note. A value that is not a school at all (a course title typed into the school field) is
   left alone.
5. **Course data redrawn.** In the four columns of comma-separated, colon-separated entries,
   every field of every entry is redrawn at random from the pool of values that field holds
   across the whole column, so all vocabularies stay within the real data:
   `coursework_ucsb` (`course:grade`, no course twice in a row; course numbers are only ones
   that occur in the input), `coursework_290` (`description:instructor:grade`),
   `coursework_other` (`title:school:equivalent UCSB course`) and `prev_experience`
   (`course:role:quarter`, no course and quarter twice in a row). Each cell keeps its number of
   entries, no entry equals the one it replaces, and no cell equals any cell of the input.
6. **Instructors renamed.** The instructor field of `coursework_290` holds real faculty names.
   Each distinct spelling maps to one fake name of the same shape (`First M. Last` stays that
   shape, so two spellings of one person become two spellings of one fake), and a name typed into
   the description field (`..., YANG T`) is dropped.
7. **Text cleaned.** Encoding artifacts from the export (mojibake dashes, accented letters) are
   replaced so the file is plain ASCII, and the export's `Collage` typo is spelled `College`,
   since a distinctive typo is itself a tell.
8. **Timestamps shifted.** Each `date_submitted`/`date_modified` pair is moved by the same random
   offset of one to seventy-two hours either way, so no timestamp matches the real export and
   the order within a pair is preserved.
9. **Checks.** Before writing, the script confirms that no applicant name or email token, no
   real instructor name token and no original school name remains anywhere in the output, that
   the text is ASCII, that no course or experience cell and no whole row equals one from the
   input, that permuted columns still hold exactly the original values, and that no timestamp is
   shared with the input. It exits with status 1 if any check fails.

The last three columns of the export (`modified_by`, `application_quarter`, `must_hire`) hold a
single value each and are left as they are, as are the two empty columns
(`desired_courses_grad` and the unnamed trailing column).

# The ULA export: `obfuscate-legacy-ula-app-data.py`

## Usage

```
python3 docs/sample-data/obfuscate-legacy-ula-app-data.py INPUT.csv OUTPUT.csv [--seed N]
```

| Parameter | Meaning |
|---|---|
| `INPUT.csv` | The ULA application form's "Form Responses" sheet, downloaded from Google Sheets as CSV (read only). |
| `OUTPUT.csv` | Where the obfuscated CSV is written; overwritten if it exists. |
| `--seed N` | Random seed, default `20261030`. The same input and seed always give the same output. |

Standard library only, Python 3.9 or later. It prints the number of rows written, any notes, and
the result of its checks; it exits with status 1 if a check fails. Columns are found by the start
of their header text (the form's question), so a question's wording may grow without breaking it,
and a column that is missing is skipped with a note. The file in this directory was made with:

```
python3 docs/sample-data/obfuscate-legacy-ula-app-data.py "ULA-Application-F26 (Responses) - Form Responses 1.csv" docs/sample-data/legacy-ula-csv-example.csv
```

## What the script does

1. **Fake identities.** Every row gets a unique fake first and last name (list names that also
   occur in the input are dropped first), an email built from the fake name on the row's original
   domain, a random seven-digit perm number, and, where the row had a numeric employee ID, a random
   seven-digit one; an employee ID that was a remark rather than a number becomes `N/A`.
2. **Free text replaced.** The TA-eligibility question keeps its two canned answers; any other
   answer (free text about the applicant's own plans) becomes one neutral sentence. Each
   non-blank availability comment is replaced by one of a few generic ones, so the count of rows
   with a comment is kept.
3. **Video links replaced by viral videos.** Each link becomes a YouTube link to a well-known
   viral video (Rick Astley's *Never Gonna Give You Up*, *Trololo*, *Nyan Cat*, *Keyboard Cat*,
   *Charlie bit my finger*, *Gangnam Style*, …), in the short `youtu.be` form where the row used
   it and the long `youtube.com/watch` form otherwise (Google Drive and other hosts included), so
   nothing points at a real applicant's video and nobody mistakes a link for one.
4. **Permutation in blocks.** Answers are shuffled across rows in blocks, so answers that belong
   together stay consistent within a row while no row keeps any one applicant's set: expected
   graduation; BS/MS status with the two follow-up questions it reveals; other campus job; prior
   UCSB employment with the employee ID; previous LA service; the training commitment with its
   explanation; the whole course-preference grid with the first and second choice and the four
   availability answers and the availability comment; GPA; major with "changing major?"; all the
   familiarity ratings; all the activity interests.
5. **Timestamps shifted.** Each timestamp moves by a random one to seventy-two hours either way,
   keeping the form's `M/D/YYYY H:MM:SS` layout.
6. **Checks.** Before writing, the script confirms that no applicant name, email local part,
   perm number, employee ID or video id from the input remains anywhere, that no timestamp or
   whole row equals one from the input, that emails and perm numbers are unique, and that the
   text is ASCII.
7. **One record per line.** The form puts line breaks inside some of its question texts. In the
   output every header is one line: the training-commitment paragraph is headed
   `Agree to statement`, and the four availability questions `Lectures: first choice`,
   `Lectures: second choice`, `Sections: first choice` and `Sections: second choice`; any other
   header with a line break is collapsed to one line and reported in a note. No cell can carry a
   line break, since the only free-text answers are replaced in step 2 and every other column is
   categorical; the final checks confirm it.
