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
| `PUT /api/draftApplications?id=&version=` | Replaces what the draft holds with the form's answers, and returns the draft with its new version. **Nothing is validated.** Refused (403) once applications close, and (409) if the version is out of date; see Concurrent edits. |

A draft belongs to its owner alone: reading or saving someone else's is a 403. All the rules about
a complete application apply, unchanged, at submission.

Submitting an application (`POST /api/applications/post`) deletes the draft it grew from, after the
application has been saved. A refused submission keeps the draft.

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

A later change will warn when the same application is open in a second tab at all, before anything
is saved; that is a separate piece of work.

## The home page

The card for an open recruitment shows, in the footer:

| The student has | Button |
|---|---|
| nothing | **Apply to be a TA** (or **ULA**) |
| a draft | **Continue editing draft application**, with a red warning: *Your application is not yet complete; incomplete applications are not considered.* The badge says *Draft application, not submitted*. |
| a submitted application | **View submitted application** (and Cancel my Application) |

A recruitment that is not open keeps its greyed-out Apply button; a draft for it offers nothing to
continue, since it can no longer be saved.

## Not done

* A draft is not deleted when a student never comes back. Drafts for a closed recruitment stay
  until the recruitment is deleted.
* The admin's **Test Application** form saves no draft: an admin previewing a form has nothing to
  lose.
* If a save fails because the network is down, the next change (or Save Draft, or leaving the form)
  sends everything again; there is no separate retry timer.
