# Iteration 4: Applications

## Summary

From `docs/design/InitialDesign.md`, fourth iteration. Grad students apply for TA positions and
undergrads for ULA positions, but only while a recruitment of the matching type is open. The home
page tells an applicant where things stand, and lists every application they have ever made.

Builds on iterations 1–3: `ROLE_GRAD_STUDENT` / `ROLE_UNDERGRAD` already decide who may apply for
what, `Recruitment` already carries the open/closed state and the dates, and `RecruitmentCourse`
already holds the exact list of courses being recruited for.

**Out of scope:** reviewing applications, and setting `hired` / `not-hired`. Applications are
created `PENDING` and nothing changes that yet. That is its own increment.

---

## Decisions already made

| Decision | Choice |
| --- | --- |
| Identity | **Generated id, unique on (email, recruitment).** One application per person per recruitment. |
| Editing deadline | **`primaryConsiderationDate`.** Past it, only post-application comments can change. |
| Course choices | **Chosen from that recruitment's `RecruitmentCourse` list**, not free text. |
| Status | **Field only.** Created `PENDING`; nothing can change it in this iteration. |

### On identity

The design doc's field table says `email (primary key)`, but it also asks for "a table of all
applications that the student has ever created". Those contradict: one row per email cannot hold a
history. A generated id with a unique constraint on (email, recruitmentId) keeps the history and
gives the reviewing increment a stable id to attach decisions to.

### On the deadline

`Recruitment` already has four dates. "The recruitment is open **and** the deadline has not passed"
states two conditions, so the deadline cannot simply be the closing. `primaryConsiderationDate` is
the one existing date already described as "used to inform users", so it is the deadline. This gives
an application three phases:

| Recruitment state | What the applicant can do |
| --- | --- |
| Open, before `primaryConsiderationDate` | Create and fully edit |
| Open, on or after `primaryConsiderationDate` | Edit **only** post-application comments |
| Closed | Nothing; view only |

Two of these are easy to get wrong and deserve their own tests.

---

## Data model

### `applications`

A generated `id`, plus:

| Field | Notes |
| --- | --- |
| `recruitmentId` | FK to `recruitments`; with `email`, unique |
| `email` | the applicant, from the current user |
| `status` | `PENDING` / `HIRED` / `NOT_HIRED`, an enum; always `PENDING` for now |
| `postApplicationComments` | the only field editable after the deadline |

Applicant fields, per the design doc's table. TA-only fields are marked; everything else is common:

`firstName`, `middleName`, `lastName`, `major`, `gpaMajor`, `gpaOverall`, `yearInProgram`,
`graduationDate`, `courseworkUcsb`, `knowledge`, `prevExperience`, `desiredCourses`, `comments`,
`firstChoiceCourse`, `secondChoiceCourse`, `availableForLecturesFirstChoice`,
`availableForLecturesSecondChoice`, `availableForDiscussionFirstChoice`,
`availableForDiscussionSecondChoice`.

TA only: `residencyStatus` (US Citizen / US Resident / F1 / J1 / other), `languageExam` (passed /
failed / exempt), `languageExamDatePassed`, `classLevel` (PhD / MS), `courseworkOther`,
`coursework290`.

ULA only: `videoLink`, `previousServiceAsUla` (a count).

Liquibase changeset `008-create-applications-table.json`, following the `preConditions` +
`MARK_RAN` pattern of `003`–`007`.

**Note on the field table:** `available_for_at_least_one_discussion_first_choice_course` appears
twice in the design doc. The second is taken to mean **second** choice, matching the lecture pair
above it. Worth confirming, but the reading is unambiguous enough to build on.

### Conditional fields

`languageExam` is only meaningful for an F1 or J1 visa holder; otherwise it is "exempt". The form
should reflect that rather than asking everyone. Residency and language questions do not appear at
all on a ULA application, and `videoLink` / `previousServiceAsUla` do not appear on a TA one.

---

## Backend work

### Who may apply, and to what

The type follows the role, and both are already in place:

- `ROLE_GRAD_STUDENT` → may apply to a **TA** recruitment
- `ROLE_UNDERGRAD` → may apply to a **ULA** recruitment

A grad student must not be able to apply to a ULA recruitment or vice versa, and this must be
enforced **server side**, not merely by hiding a link. `RoleAssignmentService` already exposes the
roles; add a small service that decides the applicable `RecruitmentType` for the current user.

### Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/recruitments/open` | grad student or undergrad; the open recruitments of *their* type |
| GET | `/api/recruitments/upcoming` | created but not yet open, for the tentative dates |
| GET | `/api/recruitments/recentlyClosed` | the most recent closed one, for its opened/closed dates |
| GET | `/api/applications/mine` | the current user's own applications, newest first |
| GET | `/api/applications?id=` | one of their own; **403 for anyone else's** |
| POST | `/api/applications/post?recruitmentId=` | creates for the current user; 400 if the recruitment is not open, is the wrong type, or they already have one |
| PUT | `/api/applications?id=` | full edit; 403 once `primaryConsiderationDate` has passed |
| PUT | `/api/applications/comments?id=` | post-application comments only; allowed after the deadline, refused once the recruitment is closed |
| GET | `/api/applications/prefill` | the applicant's most recent application, for pre-filling a new one |

**Authorization is the risk here.** Every one of these must confirm the row belongs to the current
user. An applicant reading or editing someone else's application would be the worst bug this
iteration could ship, so give it explicit tests rather than assuming the query filters correctly.

### Pre-filling

"All relevant fields from the most recent application should be copied over." Copy the applicant
fields; never copy `id`, `recruitmentId`, `status`, or `postApplicationComments`. If a TA applicant
somehow has a prior ULA application, copy only the fields the two share.

---

## Frontend work

### The applicant home page

`HomePageLoggedIn` currently shows a role message. It grows into a dashboard that says, for the
applicant's own type:

- No open recruitment → "Applications for TA positions are not currently being accepted" (or ULA).
- An open one → a link to create an application.
- Any that have closed → when the most recent one opened and closed.
- Any created but not yet open → its tentative opening date.

All four states need tests; the empty ones are as important as the populated one.

### The application form

One form, driven by the recruitment's type, at `/apply/:recruitmentId`, with `/applications/:id` for
viewing and editing. Roughly 25 fields, so group them (identity, academics, coursework, courses and
availability, extras) rather than rendering one long column. Course choices are dropdowns fed by
`/api/recruitmentcourses/all?recruitmentId=`, rendered with the same padded monospace treatment used
elsewhere so the numbers line up.

Post-application comments are edited **separately** from the rest, per the design doc — a distinct
form or a distinct page, so it is obvious that is the only thing still open after the deadline.

### The applications table

The applicant's own applications, newest first, showing quarter, type, status and what they may
currently do (edit, comment only, or view).

---

## Testing

The bar from iterations 1–3 holds. Two gates are easy to forget:

- **Pitest enforces 100%** and is **not** run by `mvn verify`:
  `mvn test-compile org.pitest:pitest-maven:mutationCoverage -Plocalhost -DmutationThreshold=100`.
  Assertions on formatted strings are the usual trap — anchor them, since `contains("1 added")` also
  matches `"-1 added"`.
- **Jacoco enforces 100%** instruction/branch/line on non-excluded classes.

Beyond the usual, test explicitly:

- A grad student cannot apply to a ULA recruitment, and an undergrad cannot apply to a TA one.
- One applicant cannot read or edit another's application.
- Editing is refused once `primaryConsiderationDate` has passed, while comments still succeed.
- Comments are refused once the recruitment is closed.
- A second application to the same recruitment is rejected.
- Pre-fill copies applicant fields and never carries over status or recruitment.
- The home page in all four states.
- A `ApplicationsWebIT` alongside the existing ITs, stubbing nothing new — recruitments can be seeded
  directly.

## Acceptance criteria

- [ ] A grad student sees a link to apply only when a TA recruitment is open, and an undergrad only
      when a ULA one is.
- [ ] The home page reports the not-accepting state, the most recent closed recruitment's dates, and
      any upcoming tentative opening date.
- [ ] An application can be created against an open recruitment of the matching type, and a second
      one for the same recruitment is rejected.
- [ ] Creating one pre-fills from the applicant's most recent application.
- [ ] TA-only and ULA-only fields appear only on the matching form.
- [ ] Course choices come from that recruitment's course list.
- [ ] Before the primary consideration date the whole application is editable; after it, only
      post-application comments.
- [ ] An applicant cannot read or edit anyone else's application, by API or by URL.
- [ ] The applicant's own applications are listed with their status.
- [ ] Jacoco 100%, pitest 100%, frontend coverage and Stryker pass, format/lint clean, workflow 41
      green.

## Test plan (manual)

1. As an admin, create and **open** a TA recruitment for an upcoming quarter with a primary
   consideration date in the future.
2. Sign in as a grad student. Confirm the home page offers a link to apply.
3. Apply. Confirm TA-only fields appear (residency, language exam, class level, 290 coursework) and
   ULA-only ones do not, and that course choices list the recruitment's courses.
4. Submit, then confirm the application appears in your table as **pending**.
5. Edit it. Confirm the changes stick, and that trying to apply to the same recruitment again is
   refused.
6. As an admin, move the primary consideration date into the past.
7. As the grad student, confirm the application is no longer fully editable but post-application
   comments still are.
8. As an admin, close the recruitment. Confirm the applicant can no longer change anything, and the
   home page reports when it opened and closed.
9. Sign in as an undergrad. Confirm "Applications for ULA positions are not currently being
   accepted", since only a TA recruitment exists.
10. Open a ULA recruitment and confirm the undergrad can now apply, and that a grad student still
    cannot apply to it.
11. Copy another applicant's application URL and open it as a different user. Expect a refusal.

## Open questions

1. **Is `graduationDate` a date or a quarter?** Applicants think in quarters ("S27"), and the app
   already has quarter handling. A free date picker may produce answers that are awkward to compare.
2. **Should an applicant be able to withdraw an application?** Nothing in the design says so, and
   nothing here implements it.
3. **The duplicated availability row** noted above is read as first/second choice; confirm.
