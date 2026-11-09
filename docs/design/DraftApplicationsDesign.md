# Draft applications (issue #270)

Follow Jef Raskin's rule: never lose the user's data. An applicant who has typed for twenty minutes
and then closes the tab, loses the connection or clicks a link should find everything they wrote
when they come back. This document records how the application form does that.

## What a draft is

A **draft** is an application as it is being filled in. It is not an application: it is a separate
entity in a separate table (`draft_applications`), so everything that reviews, counts, ranks,
allocates, exports or audits applications leaves drafts out without needing to know they exist.
Nothing in the steps counts, the review pages, the rankings, the assignments, the CSV downloads or
the change history reads the table.

A person has at most one draft per recruitment (a unique constraint on `email` and
`recruitment_id`), and the draft goes with its recruitment if the recruitment is deleted (a
cascading foreign key, as for applications).

## The table

`draft_applications` has the applicant-supplied columns of `applications`, with the same names and
types, and **none of them is required**: a draft may be empty, half-finished or inconsistent. Only
the person (`email`) and the `recruitment_id` are required, because they are what identify it.

It leaves out the columns only a submitted application has, since a draft is none of those things:
review status, admin comments, origin, post-application comments, the submission time,
cancellation, and the tentative assignment. It adds `updated_at` and `version`.

The four collections (prior coursework, topic proficiencies, interest levels, course interests) are
stored as JSON text in one column each rather than in child tables. A draft is only ever read and
written whole, and is never queried by what is in them, so this keeps the table, the entity and the
save a single row. The JSON has the same shape as the application's own, so a draft can pre-fill the
form as one.

## The API

| Request | Does |
|---|---|
| `GET /api/draftApplications/mine` | The current user's drafts, newest first. |
| `POST /api/draftApplications/open?recruitmentId=` | The user's draft for the recruitment, creating an empty one if there is none. Refused (400) if the recruitment is not open or the user already has an application for it. |
| `PUT /api/draftApplications?id=&version=` | Replaces what the draft holds with the form's answers, and returns the draft with its new version. **Nothing is validated** except that a prior course's grade, term and text fields fit their columns (400 if not, issue #323). Refused (403) once applications close, (409) if the version is out of date (see Concurrent edits), and (400) once the user has an application for the recruitment that is not cancelled (issue #417). |

A draft belongs to its owner alone: reading or saving someone else's is a 403. All the rules about
a complete application apply, unchanged, at submission.

Submitting an application (`POST /api/applications/post`) deletes the draft it grew from, in the
same transaction that saves the application (issue #417). A refused submission keeps the draft.

## The form

Opening `/apply/:recruitmentId` is a sequence of checks:

1. If the user already has an application for the recruitment, they are sent to it.
2. Otherwise the page opens the draft (`POST .../open`), which creates it at once if there is none.
3. If the form has saved the draft before, its answers fill the form. If not, the answers from the
   user's most recent application do, as they always have. (The form saves everything it shows, so
   a saved draft always has a first name, even an empty one; a freshly made one has none.)

While the form is open:

* Every answer, including the ones outside the form library (major, prior coursework, topic and
  interest ratings, and the agreement to the notice), is part of the draft. The agreement is saved
  only if its box has been ticked.
* A change is saved about **three seconds later**. Typing that goes on is saved every three seconds
  and not only when it stops, so a long stretch of typing is never at risk for more than that.
* A change that is changed back before it is sent saves nothing, and nothing is saved just for
  opening the form.
* Leaving the form (the back button, a link) sends whatever has not been saved yet.
* **Save Draft**, beside the submit button, saves everything at once, says so, and returns to the
  home page. It asks for no required answer.
* The red asterisks and the "some data on the page is missing" list are unchanged: they appear when
  the applicant submits, and not when a draft is saved. This is the point where the draft goes
  around the form library's validation, which is a property of `handleSubmit`: the draft is read
  from the form's current values rather than from a submission.
* A failed save says so with a message, except when the session is gone or the server is
  unreachable, as for every other request.
* The saving, and the version and conflict handling below, live in the `useDraftSaving` hook, not
  in the form: the form only reports what has been entered (`onDraftChange`, `onSaveDraft`).

Once the application has been submitted, nothing more is saved to the draft, which the server has
removed.

## Concurrent edits

The same applicant may have the form open in two tabs or windows. Without a check, whichever saved
last would silently overwrite the other's changes, so a save is **versioned** (optimistic locking).

* `draft_applications.version` counts the saves, starting at 0. Hibernate keeps it (a JPA
  `@Version`), so the count goes up by one with every successful save, whoever makes it.
* Opening the draft returns it, version included. Every `PUT` carries the version the form last saw:
  the one it opened with, then the one each save returned.
* If the draft has been saved since, so the version is not the current one, the server changes
  nothing and answers **409 Conflict** with a body of `message`, `version` and `draft`: why, and the
  draft as it now stands. If two saves race, the database's own check catches the loser and the
  answer is the same.
* Saves from one page are sent one at a time, in order, so each carries the version the one before
  it returned; the form never conflicts with itself.
* On a 409 the page stops saving, so nothing more is sent from the out-of-date copy, and shows
  *This draft was changed in another tab or window. Reload to see the latest version.* with a
  **Reload** button. Save Draft handles it the same way and does **not** return to the home page.
  Reload fetches the draft as it now stands (and looks again for a submitted application, in case the
  other window submitted) and starts the form again from it, with the new version.
* Submitting is not versioned: it turns whatever the server holds into the application and removes
  the draft.

### Warning about a second tab, and who is in it (issue #273)

The version check refuses a stale save after the fact. A second mechanism warns before any save is
refused, as soon as the server sees that the same draft is open in more than one tab, window or
device, and says who.

* The form makes a random identifier for itself when it opens (in memory only) and sends it, as the
  `X-Client-Id` header, with every save and with a **heartbeat**:
  `POST /api/draftApplications/heartbeat?id=`, sent as soon as the draft is open and then as often as
  the server asks (every 5 seconds by default). A heartbeat changes nothing about the draft, not
  even its version. A tab that closes or leaves the page says goodbye
  (`POST /api/draftApplications/leave?id=`), so the others hear of it within a heartbeat (#284).
* The server remembers which clients it has seen for `draft:<draftId>` within the window, 15 seconds
  by default (the heartbeat interval times three missed heartbeats; both are environment variables),
  and who each is. The controller supplies the identity from the current user: the email address is the
  person, and the label is `email (Full Name)`, or just the email if there is no name.
* **Only the draft's owner may save or heartbeat.** The controller checks the owner first and
  answers `403` to anyone else before anything is recorded or any name is returned. Since a draft has
  one owner, the others a heartbeat can list are always the owner's own other tabs.
* The heartbeat is answered with a JSON body listing the other people active, one entry for each
  person, with a label and whether it is the same person, and how often to send the next heartbeat.
  Saves are answered as before. Names are in the body and not in headers because they are not always
  ASCII and can be long.
* While the list is not empty, the apply page shows a warning above the form. Since a draft has one
  owner, it reads:
  *You are also editing this application in another tab or window. Please know that this is risky; we
  recommend closing all but one of these.* It goes by itself within a few seconds of the other copy
  being closed (about 20 seconds if the copy could not say goodbye). The newer of the tabs also gets
  a modal asking whether to leave, wait or continue anyway; the older keeps the banner alone (#284).
  It is advice and nothing is disabled; the version check still protects the draft. The
  applicant Help pages end with a *Simultaneous Editing* section that shows the warning and says what
  to do.
* The detector and the client hook are in packages of their own with no knowledge of drafts, so that
  other screens can use them. How they work, the wire format, the authorization rule for every
  resource, and where else they are planned for, is in `ConcurrentEditMitigationDesign.md`.

## The home page

The card for an open recruitment shows, in the footer:

| The student has | Button |
|---|---|
| nothing | **Apply to be a TA** (or **ULA**) |
| a draft | **Continue editing draft application**, with a red warning: *Your application is not yet complete; incomplete applications are not considered.* The badge says *Draft application, not submitted*. |
| a submitted application | **View submitted application** (and Cancel my Application) |
| a cancelled application | **View my Application** and, while applications are open, **Create a new application** (issues #318 and #420, below); with a draft begun, **Continue editing draft application** instead |

A recruitment that is not open keeps its greyed-out Apply button; a draft for it offers nothing to
continue, since it can no longer be saved.

## Cancelling, and starting again (issue #318)

Cancelling (#107) is final for the application cancelled: it cannot be edited, commented on or
brought back. It no longer locks the applicant out of the recruitment. While applications are open
(the same rule as for any new application) a cancelled applicant may begin a new application "as if
from scratch", through **Start a new application** on the home page card and on the cancelled
application's page (replaced on 2026-11-08 by **Create a new application**; see issue #420 below). Once applications have closed the button is not shown, and the server refuses
as it does for anyone.

**One live application per person per recruitment, any number of cancelled ones.**

* *Server.* `POST /api/applications/post` and `POST /api/draftApplications/open` refuse only when
  the person has an application to the recruitment whose status is not CANCELLED
  (`existsByEmailAndRecruitmentIdAndStatusNot`). Someone else's applications never matter.
* *Uniqueness.* The old unique constraint on (email, recruitment) is replaced by one on (email,
  recruitment, `attempt_number`), changeset `060`. The first application is attempt 1; a new one is
  one more than the number of applications the person already has there (since 2026-11-08, one
  more than the highest attempt number they have there; see issue #420 below). The cancelled row is kept
  untouched (reason, time, answers). The database still refuses two simultaneous submissions,
  because both would compute the same attempt number. An admin's test application follows the same
  rule: cancelled test rows are set aside and the next test is a new row.
* *Drafts.* Unchanged: one draft per person per recruitment, with its own id, deleted on submit.
  After a cancellation there is no draft, so the new one is created empty and every multi-tab
  warning (#273, #284, #298) is keyed to it; the application it becomes has a new id, so a tab still
  open on the cancelled application warns no one about the new one.
* *"As if from scratch".* The form is not pre-filled from any earlier application once the person
  has one here, cancelled or not, only (as for a first-time applicant) with their Google name.

**What each audience sees.**

| Who | Sees |
|---|---|
| the applicant | the card's application is the live one, else the newest cancelled one; the cancelled application's page points to the new one once it exists |
| an admin, the Applications table and CSV | **both rows**, in id order, the same email twice; the cancelled one has status CANCELLED and its Cancelled column (reason and time) |
| counts, rankings, rankings CSV, assignments, course targets | the live application only (`ApplicationVisibility.real` already left out CANCELLED) |
| the card's count (`applicationCounts`) | applicants, not rows: a person with a cancelled and a live application counts once |
| faculty's **Cancelled applications** table | a person only while they have no live application (`ApplicationVisibility.cancelled`) |

## Creating a new application from a cancelled one (issue #420)

*Changed 2026-11-08 (issue #420).* The #318 button, **Start a new application**, which opened an
empty draft and kept the cancelled row, is replaced by **Create a new application**, in the same
two places (the home page card, test id `...-card-<id>-restart`, and the cancelled application's
page, `ApplicationPage-restart`, with its note `ApplicationPage-restart-note`). There is one button,
not two. It turns the cancelled application back into a draft holding its answers and removes the
cancelled row, so "as if from scratch" and "the cancelled row is kept" in the section above now
describe only what happened before this change; rows made that way are still on file and still
behave as that section says.

**`POST /api/draftApplications/fromCancelled?applicationId=`** (signed-in user) calls
`DraftApplicationService.resumeCancelled(email, applicationId)`, one `@Transactional` method, which:

1. refuses with 404 for an unknown application or recruitment, 403 for someone else's application,
   and 400 unless the application is CANCELLED, its recruitment is accepting applications
   (`ApplicationAccessService.acceptingApplications`), and the person has neither an application to
   that recruitment that is not cancelled ("You already have an application for this recruitment")
   nor a draft for it ("You already have a draft application for this recruitment");
2. saves a draft built by `draftFrom(application)`: every field the two entities share (the
   person, the recruitment, the notice version, every answer, the prior coursework rows copied
   without their ids, and copies of the three maps). Not copied: the cancellation reason and time,
   and what only a submitted application has (status, attempt number, origin, submission time,
   post-application comments, the tentative assignment). The first name is stored as `""` if the
   application had none, because the apply page treats a draft with a first name as one the form has
   saved and starts from it (`draftWasSaved`) rather than from the prefill. A unit test compares the
   two entities' fields reflectively, so a field added to one and not the other fails until someone
   decides whether it carries over;
3. moves the application's admin comments, if any, to a `draft_admin_comments` row for the new
   draft (#296), which `submit` copies back to the application;
4. deletes the faculty's rankings of the application (`CandidateRankingRepository
   .deleteByApplicationId`; the foreign key would cascade anyway, and cancelled applications were
   already left out of rankings and assignments);
5. deletes the application (its coursework, interests and ratings go with it by cascade);
6. returns the draft.

If any step fails, all are rolled back: the cancelled application, its comments and its rankings
stay, and there is no draft. `DraftApplicationServiceTransactionTests` forces the application
delete, and separately the rankings delete, to fail against the real schema and checks that.

**What is kept.** The audit trail of an admin's edits to the application (`audit_trail`) has no
foreign key to the application, so its rows are left as they are, naming an id that no longer
exists. That is history, and nothing else references an application.

**Several cancelled rows.** Under #318 a person could have more than one cancelled application to a
recruitment. The application page's button acts on the application shown; the card's on the newest
cancelled one (the one the card shows). Only that row is deleted. Because an older row may now
outlive a newer one, a new application's attempt number is one more than the **highest** attempt
number the person has there (`ApplicationRepository.maxAttemptNumber`), no longer one more than the
count, which could repeat a number still in use.

**Frontend.** `useCreateFromCancelled` (in `main/utils`) posts the request, then navigates to
`/apply/:recruitmentId`, where the draft opens as any draft does; a refusal is toasted in the
server's words. It refreshes `/api/applications/mine` and `/api/draftApplications/mine`. The button
is disabled while the request is under way. The application page also asks for the person's drafts
and, if one exists for the recruitment, offers **Continue editing draft application** instead of the
button, as the card already did.

## What an admin sees of drafts (issue #296)

The **Admin card for a recruitment** has a **Draft Applications** button between **Courses** and
**Applications**. It opens `/admin/recruitments/:id/draft-applications`: the count of drafts at the
top ("3 Draft Applications"), then the same table as the Applications page. Opening a draft
(`/admin/draft-applications/:id`) shows it read-only in the same summary an application has, with a
box for the admin's comments.

**Reminding draft applicants (issue #411).** When there are drafts, a **Copy emails of draft
applicants to clipboard** button sits between the explanatory paragraph and the Columns chooser. It
puts the email of everyone with a draft on the clipboard, one per line in the table's order (no
sorting or deduplication; the backend allows one draft per person per recruitment), and confirms
with a toast that says how many ("Emails of 3 draft applicants copied to clipboard."); if the
browser refuses the clipboard, the toast says so instead. Its tooltip says what the list is for: a
day or two before applications close, an admin emails those students to say they must log in and
submit before the primary consideration date (the tooltip names the recruitment's date, or "the
primary consideration date" if it has none) because drafts are not considered. The button is not
shown when there are no drafts. The text helpers (`draftEmailsCopiedText`, `draftEmailsTooltip`)
live in `main/utils/adminApplications.ts` beside `draftsText`.

**One implementation for both, so they cannot drift.** The components are parameterized by whether
the row is a draft, and nothing is copied:

| Shared piece | How a draft differs |
|---|---|
| `AdminApplicationTable` (`draft` prop) | no Edit column; links lead to the draft's page; no origin badge |
| `applicationColumns(type, draft)` (the column catalogue) | one column differs: **Submitted** is **Last saved**; the ids and order are the same, so a column added to the catalogue is in both tables |
| `ApplicationSummary` (`draft` prop) | a yes/no question not yet answered is blank, not "No" |
| `AdminApplicationPage` (`draft` prop) | reads from and saves comments to the drafts endpoints; no Edit button, no audit trail |
| `useHiddenApplicationColumns` | none: the same stored choice of hidden columns serves both tables |

Only the list page (`RecruitmentDraftApplicationsPage`) is its own, since the Applications page has
things that make no sense for drafts: the CSV download, Test Application, fake data and the
recruitment's change history.

**Admin comments.** An admin may comment on a draft but never edit it, and there is no endpoint
that edits one. The comments are kept in their own table, `draft_admin_comments`, one row per draft
(changeset `055`), not on the draft, for two reasons: the draft is returned to the applicant, who
must never see them, and the draft carries a version that every save increments, so an admin
commenting would make the applicant's next autosave fail as a conflict. When the application is
submitted, the comments are copied to `applications.admin_comments` and the row is deleted along
with the draft. The row also goes (by `ON DELETE CASCADE`) whenever its draft does for any other
reason, including the recruitment being deleted.

**API** (all admin-only; 403 for anyone else, 404 for an unknown recruitment or draft):

* `GET /api/admin/draftApplications/all?recruitmentId=` lists that recruitment's drafts, oldest
  first, each with `adminComments`.
* `GET /api/admin/draftApplications/count?recruitmentId=` returns how many, as a bare number. The
  page counts the list it already has; the endpoint is for places that want only the number (the
  steps card, issue #297).
* `GET /api/admin/draftApplications?id=` returns one draft; `PUT .../adminComments?id=&adminComments=`
  replaces its comments.

A draft appears in the list as soon as the applicant opens the form, even if empty, and leaves it
when submitted. There is no CSV of drafts: they may be empty or half finished, and the CSV writer is
built for submitted applications of one form type.

## Never a draft and an application at once (issue #417)

**The invariant.** No student has both a draft and a finalized application to the same
recruitment. "Finalized" means an `applications` row whose status is not `CANCELLED`: one who
cancelled may start again (issue #318) with a new draft, so a cancelled application beside a draft
is legitimate. Applications of every origin count (a real applicant's, an admin's test one, a
Developer Mode fake), as the admin's Applications page lists them all.

**Transaction boundaries.** The writes that could break the rule live in `DraftApplicationService`,
one `@Transactional` method each:

* `submit(application)`: finds the draft, copies its admin comments to the application, saves the
  application, deletes the comments row and deletes the draft. If any of these fails, all are
  rolled back, so there is never a new application beside a draft that should have gone (or a
  draft gone with no application to show for it). `DraftApplicationServiceTransactionTests` forces
  the draft delete, and separately the comment delete, to fail against the real schema and checks
  that the application is not in the database afterwards.
* `open(email, recruitmentId)`: refuses (400, "You already have an application for this
  recruitment") a student with a finalized application, then returns their draft or inserts an
  empty one, in the same transaction.
* `save(draft)`: the same check, then the save, in one transaction. This is new: before, only
  opening a draft was checked. In the usual case (a tab still open after submitting in another)
  submission has already deleted the draft, so that tab's save is a 404 before it gets here; the
  check is the backstop for a draft that is somehow still there.
* `resumeCancelled(email, applicationId)` (issue #420, added 2026-11-08): checks, creates the draft
  from a cancelled application, moves its admin comments, deletes its rankings and deletes it, in
  one transaction; see "Creating a new application from a cancelled one" above.

The controllers call these rather than being `@Transactional` themselves. `openDraft` has to catch
the unique constraint failure when the same person's form opens twice at once and answer with the
other request's draft; a constraint failure inside a transaction marks it rollback-only, so the
catch must be outside it. `saveDraft` likewise catches the optimistic lock failure outside the
transaction, where it surfaces. `postApplication` still checks for an existing application first,
before the form's rules, so that is the message a second submission gets.

The check and the write are atomic against failures, not against every race: at the databases'
default isolation (read committed), a submission and a draft save in two tabs at the same instant
could each miss the other's row. That window is milliseconds, and the warning below reports it if
it is ever hit.

**The warning.** `GET /api/admin/applications/draftConflicts?recruitmentId=` (admin-only; 404 for
an unknown recruitment) returns `{email, draftApplicationId, applicationId}` for each draft and
finalized application pair in the recruitment, by email then application id. It is one JPQL join of
`draft_applications` and `applications` on email and recruitment
(`DraftApplicationRepository.findConflictsWithApplications`), so only the conflicts are loaded.
`DraftConflictWarning`, used at the very top of both `/admin/recruitments/:id/applications` and
`/admin/recruitments/:id/draft-applications`, fetches it on every load and, when the list is not
empty, shows a red Bootstrap alert headed **WARNING** with a table (`email | draft application |
finalized application`) whose ids link to `/admin/draft-applications/:id` and
`/admin/applications/:id`. When the list is empty nothing is rendered. It only reports; nothing is
repaired automatically.

**No database constraint.** The rule spans two tables, and neither a `UNIQUE` constraint nor a
foreign key can say "no row in the other table with the same email and recruitment" (and the
application side would need the status condition too, since cancelled rows are allowed). A `CHECK`
constraint cannot contain a subquery in Postgres. What remains is a trigger on both tables, which
would have to be written twice, as plpgsql for Postgres in production and as a Java trigger class
for H2 in development and the tests, with the two kept in step by hand, and a Postgres-only trigger
would mean the tests no longer exercise what production does. Merging drafts into the
`applications` table (a draft as a status) would make it a single-table rule, but undoes the reason
drafts are a separate table (see What a draft is). So no migration was added; the transactions,
the draft-save check and the warning are the enforcement.

## Not done

* A draft is not deleted when a student never comes back. Drafts for a closed recruitment stay
  until the recruitment is deleted.
* The admin's **Test Application** form saves no draft: an admin previewing a form has nothing to
  lose.
* If a save fails because the network is down, the next change (or Save Draft, or leaving the form)
  sends everything again; there is no separate retry timer.
