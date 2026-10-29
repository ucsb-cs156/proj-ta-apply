# proj-ta-apply: Initial Design

Please examine the source code of:

* https://github.com/ucsb-cs156/proj-frontiers
* https://github.com/ucsb-cs156/proj-scaffold
* https://github.com/ucsb-cs156/proj-citelines
* https://github.com/ucsb-cs156/proj-dining
* https://github.com/ucsb-cs156/proj-courses

for various conventions including:

* Spring Boot Backend
* React Frontend
* Use of Swagger for backend API documentation and testing
* Use of github actions workflows for a CI/CD pipeline
* Dockerfile for configuring app for Dokku
* settings in pom.xml and application.properties for multiple profiles for localhost, end to end integration testing, and production on dokku.
* settings in pom.xml and application.properties for connecting with Postgres and MongoDB, with integrated H2 and Mongo DBs for local development, and real dbs for production
* settings in pom.xml and package.json for using Jacoco and Pitest for backend testing coverage/mutation testing, and Stryker-js for frontend mutation testing.

Then, please set up an app with the following features, most of which are present in at least one of the apps already mentioned above, or are very small variations on those.

* Login with Google OAuth

* Roles: Admin, Instructor, Grad Student (note that this is the first app with two roles that are "more than user, but less than admin", but the pattern generalizes).
Admins should be able to set up users as Instructors or Grad Students by entering their emails.

* One extra feature not in any of the current apps: the ability to upload a list of emails from a file and have each of those emails be entered into the table of grad student users.

There will be many more features added in future iterations, but for the first iteration, let's just keep it to this.

# Second Iteration

As an admin I can specify a range of quarters, and a level, and the system will populate a table with all of the courses numbers from "CMPSC" (a subject area configured via application.properties) that have been offered over that range of quarters.

These will be obtained from api.ucsb.edu in the same way as proj-courses.

We are only looking for the course numbers and names here, not the particular of the offerings.

Those will be presented to me in a table.

There will be a way for the admin to click a checkbox (or unclick it) to indicate which courses should get TAs assigned, and a separate checkbox to indicate which courses should get ULAs assigned.

# Third Iteration

For the third iteration, we want to add the idea of a Recruitment.

Admins will have the ability to create a recruitment.

There will be a database table for recruitments, which will store the following fields:

* Quarter (in YYYYQ format, but displayed in QYY format)
* Type (either TA or ULA)
* Application Status: Open or Closed (starts closed, and set manually)
* Tentative Opening Date (required; used to inform users)
* Actual Opening Date (recorded automatically when applications are first opened)
* Primary Consideration Date (required; used to inform users)
* Actual Closing Date (recorded automatically when applications are closed)

Note that we may build features for automatically opening and closing recruitments in the future, but for the mininmum viable product, we are keeping it simple, and making opening and closing the applications manual.

Designing a protocol for opening and closing automatically that also allows manual override is complicated.

Once a recruitment is created, a job will be launched that fills a table of "RecruitmentCourses" with only the courses that are (a) in the Courses table and that recruit for TA or ULAs and (b) are offered during the upcoming quarter.

There should be a button the Admin can click to populate this table, as well as a button to remove any rows from the table if TA or ULAs should not be included in the recruitment for that quarter.  

Each field in the RecruitmentCourses table will have:

* id
* recruitmentId
* courseId (e.g. `CMPSC     1A`, `CMPSC   130A`)
* instructor
* day(s) (first one, for primary only)
* time(s) (first one, for primary only)
* room
* enrollment
* max enroll
* status (i.e. open, closed, cancelled, etc.)
* summer session (only shown for summer session courses, but column is always present)


The Admin should have an Admin/Recruitment menu, and the recruitments should then appear in a table with the default sort order being most recent first, and least recent last.  There should be a button in each row of that table called "Courses" that takes the Admin to a page:

`/admin/recruitments/:recruitmentId/courses`

that shows a table of the Recruitment Courses.  

This table should be sorted by course id in the same way as Admin/Courses is sorted.

# Fourth iteration

There will be a way for TAs and/or ULAs to enter an application when applications are open.

Users that are Grad Students will be able to apply for TA positions when there is an open recruitment. Users that are undergrads will be able to apply for ULA positions when there is an open recruitment.

The home page for should indicate all of the following:
* If there are no currently open recruitments (of the appropriate type), it should indicate "Applications for TA (or ULA) positions are not currently being accepted".
* If there are any open recruitments of the appropriate type, there should be a link to create an application.
* If there are any past recruitments of the appropriate type that have closed, when the most recent recruitment opened and closed.
* For each recruitments that has been created but hasn't opened yet, when the tentative opening date is.

There should also be a table of all applications that the student has ever created, along with the status: e.g. pending, hired, not-hired.

If the application is for an open recruitment, and the deadline has not yet passed, grad students and undergrads should be allowed to edit their application.

Once the deadline has passed, they shoudl be able to update only a "post application comments" field that is
edited separately from the rest of the application.

When creating an application, by default, all relevant fields from the most recent application should be copied over.

The information that the app should gather about each applicant includes the following.

Some fields are common to both TA and ULA applications, others are specific, as noted below.

| Field | TA only | ULA only |
| email (primary key) | |
| first_name | | 	
| last_name	| | 
| middle_name	| | 
| residency_status	(US Citizen, US Resident, F1 Student Visa, J1 Student Visa, other) | * | |
| language_exam	(passed or failed, but only if F1 or J1 Student Visa, otherwise "exempt" | * | | 
| language_exam_date_passed	| * | | 
| major	| | | 
| gpa_major	| | | 
| gpa_overall | | | 
| class_level (Phd or MS) | * | | 
| year_in_program	| | | 
| graduation_date | | | 
| coursework_ucsb | | |  
| coursework_other | * | | 
| coursework_290 | * | | 	
| knowledge	| | | 
| prev_experience | | | 	 
| desired_courses | | | 
| comments | | | 
| video_link | | * |
| previous_service_as_ula (number of times) | | * |
| perm_number (7 letters or digits, stored upper case; required) | | * |
| bs_ms_student (yes/no), and if yes: student_status_next_quarter (undergraduate/graduate) and wants_ta_eligibility (yes/no) | | * |
| other_campus_job (yes/no/not sure), prior_ucsb_employment (yes/no) with employee_id, i9_appointment (yes/no) | | * |
| training_commitment (agree/unsure/cannot) with explanation, for first-time applicants | | * |
| changing_major (yes/no) | | * |
| first_choice_course | | |
| second_choice_course | | |
| available_for_lectures_first_choice_course | | |
| available_for_lectures_second_choice_course | | |
| available_for_at_least_one_discussion_first_choice_course | | |
| available_for_at_least_one_discussion_first_choice_course | | |

# Fifth Iteration

Some of the questions on the application form should offer the applicant a list to choose from
rather than a free-text box, and those lists will change from year to year, so admins need to be
able to maintain them without a code change. This iteration adds the lists and the admin pages for
them; wiring them into the application form is left for a later increment.

On the Admin menu, add two menu items: **TA App Settings** and **ULA App Settings**.

## TA App Settings

`/admin/settings/ta` is a page headed "TA App Settings". It holds one React Bootstrap Card per
list:

1. **Majors List for TAs**, backed by a `ta_majors` table.
2. **Topics List for TAs**, backed by a `ta_topics` table.

## ULA App Settings

`/admin/settings/ula` is a page headed "ULA App Settings", laid out the same way:

1. **Majors List for ULAs**, backed by a `ula_majors` table.
2. **Topics List for ULAs**, backed by a `ula_topics` table.

## The tables

Each of the four tables has exactly one column, `name`, a string that is also the primary key. The
TA and ULA lists are separate tables rather than one table with a type column, so that the two
forms can diverge freely.

Admins can do all CRUD operations on each list from its card: see the names (sorted, case
insensitive), add one, rename one in place, and remove one. Because the name is the key, a rename
is a delete followed by an insert; the API hides that behind a single `PUT`. Names are trimmed
before they are stored, blank names are refused, and so is adding or renaming onto a name that is
already in the list.

The four lists share one backend controller, `/api/admin/settings/{list}`, where `list` is one of
`ta-majors`, `ta-topics`, `ula-majors` or `ula-topics`, and one frontend card component. Adding a
fifth list later means one more table, entity and repository, one more entry in the controller's
map, and one more card.

# Sixth Iteration

The lists from the fifth iteration are wired into the application form, for TAs and ULAs alike:

* **Major** becomes a dropdown populated from the TA Majors list (or the ULA Majors list for a ULA
  application), plus an **Other** option. Choosing Other prompts for the major as free text. The
  database stores whatever the applicant ends up with as a plain string, never the word "Other", so
  an application whose major is later removed from the list still reads correctly.
* **"Languages, Tools and Technologies You Know"** is removed, from the form and from the
  `applications` table. In its place the form lists every topic currently on the TA (or ULA) Topics
  list with radio buttons 1 through 5 beside each, under the instruction "Choose a level of
  proficiency, with 1 being the lowest, and 5 being the highest." The answers go into a new
  one-to-many table, `application_topic_proficiencies` (application id, topic name, integer), one
  row per topic the applicant rated. An unrated topic has no row.

The form reads both lists from one endpoint keyed by recruitment, so a TA recruitment always shows
the TA lists and a ULA recruitment the ULA lists.

# Seventh Iteration

Each application form carries a block of "Notices, Terms and Conditions" that applicants must
agree to.

* **TA App Settings** and **ULA App Settings** each gain a **Notices, Terms and Conditions** card
  with a Markdown editor (the same EasyMDE editor proj-citelines uses). Every save by an admin
  stores the entire text as a **new version** in a `notice_versions` table, with its own id and a
  date/time stamp; nothing is ever edited in place or deleted. The card shows the version history.
* Each time a TA or ULA application is filled out, the form shows the **most recent version** of
  that type's text, followed by a required checkbox: *"I have read and understood the text above,
  and I agree to the terms and conditions it specifies."* The application stores the id of the
  version that was shown (`applications.notice_version_id`), and when the application is shown
  later, that version is displayed, not whatever is current by then.
* Until an admin has written a first version for a form type, the form shows no notice and asks for
  no agreement; the backend enforces the same rule, so a submission cannot skip the box once a
  notice exists.

# Eighth Iteration

The three free-text coursework questions on the TA form (relevant coursework at UCSB, coursework
taken elsewhere, 290-level coursework) are removed, from the form and from the `applications`
table, and replaced by a structured **prior coursework** table on both the TA and the ULA
application.

* A new `prior_coursework` table holds one row per course: an id, the owning application, whether
  it was a **UCSB course** (boolean), the **other school** (required when it was not), the **course
  number** (required), the **course title**, the **term** (quarter or semester) and an optional
  **grade**. This app keeps TA and ULA applications in one `applications` table, so one
  `application_id` foreign key stands in for the design's separate TA/ULA keys; the "exactly one
  parent" rule is therefore satisfied by construction.
* On the form, the applicant sees a table of the courses entered so far, sortable by every column,
  with Add, Edit and Delete. Adding and editing happen in a modal, following the proj-frontiers
  pattern: a **UCSB course** checkbox (ticked by default) and an **Other School** field that is
  always visible but disabled and blank while the box is ticked.
* A TA applicant must list at least **three** courses; a ULA applicant is told to list every course
  that is relevant background for the courses they are applying to assist, which means at least
  **one**. Both minimums are enforced in the browser and by the backend.

# Ninth Iteration

The separate **Grad Student** role is removed. The roles are now only **Admin**, **Instructor**
and **User**; a signed-in user holding neither of the first two is a student who may apply.

* The `grad_students` table, its admin page (Admin > Grad Students), its CSV upload and the
  `ROLE_GRAD_STUDENT` authority are all gone. The `ROLE_UNDERGRAD` authority that stood in for
  "a UCSB address with no other role" goes with it: there is no longer anything to tell apart.
  Who may sign in at all is unchanged: any UCSB address, plus any outside address that is in the
  admins or instructors table.
* The TA/ULA eligibility rule is gone with the role. Any signed-in user may apply to any open
  recruitment, TA or ULA, and the endpoints that list recruitments, course choices, section times,
  options and notices are open to every signed-in user rather than filtered by an applicant type.
* On the home page, a user who is just `ROLE_USER` sees the applicant dashboard listing **every**
  open recruitment, each line naming its type ("Applications for TA positions in F26 are open",
  "Applications for ULA positions in F26 are open"), the upcoming ones likewise, and the most
  recently closed round of each type. Admins and instructors see their own messages and no
  dashboard, as before. The Users table no longer has a Grad Student column.

# Tenth Iteration

The ULA application's topic scale changes, and the ULA form gains an **Interests** section backed
by a new admin-maintained list.

* On the ULA form, each topic is rated on three levels instead of five: **1-Very comfortable**,
  **2-Somewhat comfortable**, **3-Not familiar**. The TA form keeps its 1 (lowest) to 5 (highest)
  scale. The backend refuses a level off the scale for the form's type, as before.
* **ULA App Settings** gains a third list, **Interests List for ULAs**, after the ULA topics. It
  works exactly like the majors and topics lists: add, rename and delete, plus CSV download and
  upload in the shared one-column shape, served at `/api/admin/settings/ula-interests`. A new
  `ula_interests` table holds it (changeset 015).
* The ULA form gains an **Interests** section after the topic table, listing the admin's interest
  areas, each rated **1-Not interested** to **5-Very interested**. The answers live in a new
  `application_interests` table (changeset 015), sparse like the topic ratings, and come back on the
  summary and when an application is reopened for editing. A TA application has no interests;
  anything sent for one is dropped.

# Eleventh Iteration

Admins can look over the applications to a recruitment, as a whole and one at a time.

* **Admin > Recruitments** gains an **Applications** button per row (column "Review"), leading to
  `/admin/recruitments/:id/applications`. At the top of that page the recruitment's own row is
  repeated, fields only, with no buttons; then a count ("20 Applications Received", with any test
  applications an admin entered counted apart); then a table of the applications with just a few
  columns: **id** (a link), **Submitted** (date and time), **Name**, **Major**, then **Level**
  (MS or PhD) for a TA recruitment or **Expected Graduation** for a ULA one, **First Choice** and
  **Second Choice**. Test applications are marked beside their id.
* The id links to `/admin/applications/:id`, the application in read-only form (the same summary
  the applicant sees once a recruitment closes, with the notice version they agreed to), plus an
  **Admin Comments** box at the bottom with **Save** and **Cancel**. Both lead back to the list;
  only Save writes the comments.
* Two columns are added to `applications` (changeset 016): `submitted_at`, stamped when the row is
  first saved and never changed by an edit, and `admin_comments` (free text, up to 4000 characters).
* A new admin-only controller, `/api/admin/applications`, serves the list for a recruitment
  (`/all?recruitmentId=`), one application by id, and the comments update (`PUT /adminComments`).
  Nothing in it changes what the applicant wrote.


# Twelfth Iteration

The recruitments table gains a **CSV** button per recruitment (column "Download") that downloads
every application to that recruitment as a CSV file, `applications-<id>.csv`, served by
`GET /api/admin/applications/csv?recruitmentId=` (admins only).

* One row per application, a header row, every cell quoted. Test applications are included and
  flagged in the `testApplication` column.
* The columns follow the recruitment's type: a TA file carries `classLevel`, `residencyStatus`,
  `languageExam` and `languageExamDatePassed`; a ULA file carries `previousServiceAsUla`,
  `videoLink` and, last, `interests`.
* The one-to-many answers are folded into one column each. `priorCoursework` lists each course's
  fields (school, number, title, term, grade) separated by commas, with the courses separated by
  semicolons. `topicProficiencies`, `interests` and `courseInterests` hold `name:value` pairs
  separated by commas, in name order (e.g. `C++:5,Java:4`).
* The Help > CSV page documents the shape.

# Thirteenth Iteration

A new **Audit Trail** table records every change an admin makes to a field of a student's
application. Nothing writes to it yet: the admin edit that will is the next iteration, and the
table and its page come first so that feature has somewhere to record what it does.

* Table `audit_trail` (changeset 017): `id`, `edited_at` (stamped on insert), `ula_application_id`,
  `ta_application_id`, `field_name` (required), `old_value`, `new_value`. A check constraint
  requires exactly one of the two application ids. Values are strings whatever the field's type;
  a row of a join table (a prior course, a topic rating, an interest) is stored as the JSON of the
  whole row. The old value is null when the field was blank or a row was added; the new value is
  null when the admin blanked an optional field or deleted a row.
* **Admin > Audit Trail** shows the whole table, paged on the server, sorted by any column in
  either direction (newest first by default), via `GET /api/admin/audittrail/all`. An old or new
  value longer than 30 characters is shown as its first 15 characters, an ellipsis and a
  **[See value]** link that opens the whole value in a modal.
* `GET /api/admin/audittrail/application?type=TA|ULA&id=` returns one application's rows,
  oldest first, for the next iteration's per-application view.

# Fourteenth Iteration

Admins can edit a student's application, and every change is recorded in the audit trail.

* The applications overview page gains an **Edit** button per row, and the read-only view of an
  application gains an **Edit** button at the top. Both lead to `/admin/applications/:id/edit`:
  the same form the applicant filled in, with their answers in it, saved through
  `PUT /api/admin/applications?id=` (admins only). An admin may correct an application at any time:
  no deadline or open/closed rule applies, and the notice agreement rule does not either (the
  applicant agreed, not the admin). The coursework minimum still holds.
* Before applying the edit the backend snapshots the application's answers as strings; afterwards
  it compares, and writes one `audit_trail` row per field whose value changed, against the TA or
  ULA application id by the recruitment's type. A join-table row (a prior course, a topic rating,
  an interest level, a course interest) is recorded as the JSON of the whole row: a row that
  disappeared with a null new value, a row that appeared with a null old value. The form rebuilds
  the prior course rows on every save, so an edited course shows as one row removed and one added.
* The read-only view of an application ends with an **Audit Trail** section listing that
  application's rows, oldest first, from `GET /api/admin/audittrail/application?type=&id=`.

# Fifteenth Iteration

The TA form's language exam questions follow the legacy form.

* **TA Language Exam** is asked of every TA applicant, right after Residency Status, with the
  legacy form's four answers in its order: *exempt (U.S. Citizen)*, *passed (U.S. Perm. Resident)*,
  *passed (F1 or J1 visa)*, *not passed*. It was previously shown only to F1 and J1 visa holders,
  with the answers Passed, Failed and Exempt.
* **Quarter and Year Language Exam Passed** is free text, as on the legacy form (e.g. F25), in
  place of the date picker. The ULA form asks neither question.
* Changeset 018 widens `language_exam`, maps the old answers onto the new ones (PASSED to
  *passed (F1 or J1 visa)*, FAILED to *not passed*, EXEMPT to *exempt (U.S. Citizen)*) and
  changes `language_exam_date_passed` from a date to text.


# Sixteenth Iteration

The recruitments page is easier to work with on a wide screen (issue #60).

* On **Admin > Recruitments**, the headings **Tentative Opening**, **Primary Consideration**,
  **Actually Opened** and **Actually Closed** are each on two lines, so a date column is no wider
  than its dates. The **Test** column is headed **Test Application** on two lines, its button
  reads just **Test**, and both carry the tooltip "Submit a test application to see what the form
  looks like to applicants".
* On every page, the content column (and the footer under it) is wider: each side gutter is half
  what the old fixed 1126px column left on that screen, so the column is `50% + 563px` of the
  viewport, and still the full width on screens narrower than 1126px.

# Seventeenth Iteration

Admins can see who has been using the app, and who their admins and instructors are (issue #61).

* `users` gains `last_online` (changeset 019). It is stamped at sign-in, and `LastOnlineInterceptor`
  refreshes it on any `/api/**` request from a signed-in user whose stamp is more than a minute
  old, so a page load's burst of requests writes the row once. **Admin > Users** shows it as
  **Last Online**, in the admin's own time zone, blank for a row from before the column existed;
  the column sorts by the instant, not the text.
* **Admin > Admins** and **Admin > Instructors** gain **First Name** and **Last Name**, looked up by
  email in the users table (`AdminDTO` and the new `InstructorDTO`). Someone who has never logged
  in has no users row, so their names are blank; a note at the top of each page says so.


# Eighteenth Iteration

The audit trail table's two id columns are one (issue #63).

* **ULA Application** and **TA Application** are replaced by **App**, reading "TA 7" or "ULA 9",
  which links to that application's admin page (`/admin/applications/:id`). The two ids stay
  separate in the database and the API; only the table joins them. The page's **Sort by** list
  keeps both, as *App (TA id)* and *App (ULA id)*, since the server sorts by one column.

# Nineteenth Iteration

Applications from the legacy PHP app can be brought in, so returning TAs do not start from a blank
form (issue #65).

* **Admin > TA App Settings** gains an **Import Legacy TA Applications** card: the admin picks the
  quarter (one of the TA recruitments that exist, as W26) and the legacy export file, and
  `POST /api/admin/applications/legacy/upload?quarter=` creates one pending application per row in
  that recruitment, as if the student had entered it. The recruitment must exist first. A row whose
  email already has an application there is left alone, so re-uploading is safe; a row with no
  usable email is skipped and reported. The format is the one in
  `docs/sample-data/legacy-ta-app-csv-example.csv`, documented on **Help > CSV formats**.
* `LegacyApplicationCsvService` matches the legacy columns to the new fields as well as it can:
  names, GPAs, year, graduation date, residency, language exam and class level directly; "CS" as
  Computer Science, matched to the TA majors list; the three coursework cells as prior coursework
  rows (a UCSB course number gets its `CMPSC` prefix, a course taken elsewhere keeps its school and
  the UCSB course it was equivalent to, a 290 seminar keeps its description and instructor);
  `knowledge` as topic proficiencies, named as the TA topics list spells them when they match (a
  topic the list lacks is added to it, and the card lists what was added in a modal);
  `prev_experience` as one line per course; desired courses as ENTHUSIASTIC interest in each course
  the recruitment lists. Preferred job and hours, and desired courses the recruitment does not
  list, go into the applicant's comments so nothing is lost and they can edit it; the export's
  dates, must_hire and reviewer comments go into the admin comments.
* The pre-fill of a new application (`GET /api/applications/prefill`) now picks the applicant's
  application for the most recent recruitment quarter rather than the most recently inserted row,
  since an imported application is newer as a row but older as an application.

# Twentieth Iteration

The ULA application asks everything the ULA Google Form asked (issue #72).

* **Perm number**, required of a ULA applicant: exactly 7 characters, letters and digits only,
  stored upper case whatever case was typed. An admin editing an application is held only to the
  format.
* **BS/MS student?**, required. When yes, two more questions appear: the applicant's **student
  status in the quarter applied for** (undergraduate or graduate; choosing graduate shows a warning
  that ULA positions are funded for undergraduates only and that they are strongly encouraged to
  apply to be a TA instead) and whether they **want TA eligibility and will take the Fall TA
  training**, with the note that they are not eligible for TA positions until they do.
* **Prior employment**: **another campus job this quarter** (yes, no, not sure yet; required),
  **prior UCSB employment** (required) with the **employee ID** when yes, and whether they have
  made or will make an **I-9 appointment**. None of these affects the decision; they speed up the
  paperwork.
* For a first-time applicant (previous service 0), the **training commitment** statement with
  I AGREE / I am UNSURE / I CANNOT, required, and an explanation box for the latter two.
* **Changing major?** under the major, and the Google Form's guidance texts: the video
  instructions and the returning-LA exception, the training requirement, the course-preference
  tiers and the B-or-better rule, the "3-Not Applicable" meaning, the employee-ID caution and the
  graduation-date eligibility note.
* The new answers are fields of the application (null on a TA application), appear in the audit
  trail, on the admin's view, in the CSV download and in the pre-fill of the next application.
* **Importing prior ULA data** (issue #70): the Google Form's single `GPA` maps to **Overall GPA**
  (`gpaOverall`), not GPA in Major.

# Twenty-first Iteration

Applications from the ULA Google Form can be brought in, as the legacy TA ones can (issue #70).

* **Admin > ULA App Settings** gains an **Import ULA Form Responses** card, the ULA counterpart of
  the TA page's import: the admin picks the quarter (one of the ULA recruitments that exist) and the
  form's response sheet downloaded as CSV, and `POST /api/admin/applications/legacy-ula/upload?quarter=`
  creates one pending application per row in that recruitment. Re-uploading is safe; rows without a
  usable email are reported.
* `LegacyUlaApplicationCsvService` finds columns by the start of their question text, so the form's
  original headers and the condensed ones in `docs/sample-data/legacy-ula-csv-example.csv` both
  work, and the grids by their bracketed labels. The perm number, graduation, BS/MS, employment,
  previous-service, training, GPA (as Overall GPA), major, changing-major and video answers map to
  their fields; the course-preference grid, first and second choice and the availability answers map
  to the course interests, choices and availability fields; the familiarity grids become topic
  proficiencies and the activity grid interests, named as the ULA lists spell them when a name
  matches ("CSIL computing environment" matches "CSIL"). A topic or activity the lists lack is added
  to them, and the card lists what was added in a modal. What has no field (a free-text TA-eligibility
  answer, a choice the recruitment does not list, "only one lecture a week") goes into the comments;
  the timestamp goes into the admin comments.
