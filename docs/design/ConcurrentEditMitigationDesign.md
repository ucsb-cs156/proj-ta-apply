# Concurrent edit mitigation

This document describes how the app protects people from losing work when the same thing is open in
more than one browser tab, window or device, and how that protection could be extended from draft
applications (issues #270 and #273) to the budget, the allocations, the faculty rankings and the
assignments.

It has two parts. Part 1 is the mechanism, on the server and on the client, as built for draft
applications. Part 2 looks at four other places in the app where the same problem exists, then at
recruitment state and the other course page saves, which are better kept fresh by refreshing than
by warning, and proposes iterations, easiest first.

## Part 1. The mechanism

### The problem

Several screens save as the user works, with no Save button to press at the end. A draft
application autosaves every few seconds (#270). The budget, an allocation, a ranking and a tentative
assignment each save the moment a field is edited.

The user can have the same screen open twice without noticing: a second tab, a second window, a
phone as well as a laptop. Each copy shows what was true when it loaded. Each save then writes that
copy's view to the server, and the server, as it stands, accepts it. The last save wins, and the
person who saved first loses their work with no error and no sign that anything happened. This is
the failure the mechanism exists to prevent. It breaks the rule the draft work is built on: never
lose the user's data.

There are two separate things to do about it, and they work at different times:

| | When it acts | What it does |
|---|---|---|
| **Version check** | At the moment of a conflicting save | Refuses the stale save so nothing is overwritten |
| **Multi-tab warning** | Before any conflict | Tells the user that more than one copy is open, so they can close the extras |

The version check is the safeguard. The warning is the courtesy: without it the first the user
hears of the problem is a refused save.

### Mitigation 1. The version check (added in #270)

**Server.** The saved thing carries an integer `version` that starts at 1.

* Reading it returns the version.
* A save sends back the version the client last saw.
* If that equals the stored version, the server applies the save, increments the version and returns
  the new one.
* If it does not, the save is stale. The server changes nothing and answers `409 Conflict`, with the
  current stored value and version in the body so the client can recover.

The comparison and the increment must be one atomic step, not a read followed by a write, or two
saves can both pass the check. The way to get that is JPA's optimistic locking (`@Version` on the
column), or an update that carries `WHERE version = ?` and checks the number of rows changed.

**Client.** The client holds the latest version it has seen and sends it with every save, replacing
it with the version in each successful response. On a `409` it:

1. stops autosaving, so that it cannot keep failing or race the other copy;
2. shows a plain message: "This was changed in another tab or window. Reload to see the latest
   version.";
3. offers a **Reload** button that re-reads the current value and version and refills the screen;
4. does not leave the screen. In particular a **Save Draft** that conflicts does not return the
   user to the home page.

The user's unsaved typing in the stale copy is lost when they reload. That is the price of choosing
one version, and it is why the warning below matters: it makes the conflict rarer.

### Mitigation 2. The multi-tab warning (#273, #284)

The version check says "no" after the fact. The warning says "careful" before it, and says who. Issue
#284 made it faster (a tab that leaves says goodbye, and the timing is configurable) and gave the
newer of several tabs a modal with choices, so that the subtle banner is not the only signal.

**Client.** When a screen that autosaves opens, it makes a random identifier for this copy,
`crypto.randomUUID()`, and keeps it in memory only, never in `localStorage` or `sessionStorage`. A
copy that is duplicated or restored must not inherit another copy's identifier. The client sends the
identifier, as the request header `X-Client-Id`, with:

* every save, and
* a lightweight **heartbeat** while the screen is open, one as soon as it opens and then as often
  as the server asks (every 5 seconds by default). The heartbeat exists to let the server see
  copies that are open but idle, and to bring back who else is there. It changes nothing: not the
  saved thing, and not its version, and
* a **goodbye** when the copy leaves (see "Goodbye" below).

**Identity.** The detector must be able to name people, but it must not know what a person is. So
the application hands it an opaque **identity** with every client it records:

* a stable **person key**, which says whether two clients are the same person. For this app it is
  the user's email address;
* a **label**, which is what other people are shown. For this app it is `email (Full Name)`, or
  just the email if the user has no name. A label longer than 200 characters is cut short with an
  ellipsis (never in the middle of a character), so no one's name can swell an answer.

The detector treats both as opaque text. The application builds the identity from the current user
(`User.email` and `User.fullName`) in its controller and passes it in.

**Server.** A small detector answers one question: who, other than the caller, is working on this
resource now?

* It is a map from a **resource key** (a string such as `draft:42`) to a map from client id to the
  time that client arrived, the time it was last seen, and the identity it gave.
* `record(resourceKey, clientId, identity)` stores "now" as the time last seen, and the identity for
  that client. If the client was already here (seen within the window) its time of arrival is kept;
  otherwise it arrives now. It also drops entries older than the window, for every resource and not
  only this one, so the map does not grow without bound.
* `leave(resourceKey, clientId)` forgets that client at once (see "Goodbye").
* `arrival(resourceKey, clientId)` says whether the client is the **newest** and when it arrived (see
  "Arrival order").
* `othersActive(resourceKey, clientId)` returns the other people active within the **window**, as a
  list of `{label, samePerson}`, **one entry for each person** however many tabs they have open,
  sorted by label. An entry has `samePerson` true if it is the same person as the caller (the
  caller's own other tab or window); the caller's own client is never in the list. The caller is
  compared by the identity recorded for its client id; a caller that was not recorded is nobody's
  same person.
* The timing is two settings, read by the server from environment variables (see "Timing"). The
  window is the heartbeat interval times the number of heartbeats that may be missed. The server
  tells the client how often to beat in each heartbeat answer, so the two are always in step.
* The clock, the heartbeat interval and the number of missed heartbeats are constructor arguments,
  so tests run in zero time with a fake clock.
* Two helpers keep the controllers short. `note(resourceKey, clientId, identity)` records the client
  if it named itself usably (present, not blank, at most 100 characters) and otherwise does
  nothing; saves call it. `heartbeat(resourceKey, clientId, identity)` records the client and
  returns the answer; a client that did not name itself usably is not recorded and is told of no
  one.

**Wire format.** Names do not belong in headers: they are not always ASCII and they can be long. So
the only header is the request's `X-Client-Id`, and everything the server has to say is the JSON
body of the **heartbeat's** answer:

```json
{
  "others": [
    { "label": "phtcon@ucsb.edu (Phill Conrad)", "samePerson": false },
    { "label": "me@example.org (Me)", "samePerson": true }
  ],
  "heartbeatSeconds": 5,
  "newest": true,
  "arrivedAtMillis": 1793620800000
}
```

`newest` and `arrivedAtMillis` are explained under "Arrival order". The goodbye is a `POST` with no
body, answered `204`.

A save is answered exactly as it was before the warning existed; it only counts the client as
present. The banner therefore learns of the others, and their names, at the next heartbeat: within
one heartbeat of someone arriving; within one heartbeat of them saying goodbye; and, if the goodbye
never arrives, within one window plus one heartbeat of them leaving (15 s plus 5 s, about 20 s with
the defaults). This was chosen as the simplest correct design: one source of names, one body to parse, no header
encoding, and nothing to keep in step between a header cue on saves and the list from the
heartbeat.

The client reads the body defensively. Anything unexpected (a list that is not a list, an entry
without a label, an interval that is not a positive number) is left out, and a heartbeat that fails
is ignored and tried again at the next time, so the banner shows what the server last said.

**Authorization.** The detector tells names to whoever asks. Therefore the application must check
that the caller **may use the resource before** it records the caller or asks who else is there.
Otherwise anyone could try resource keys and learn who is working where. For a draft application
only its owner may use it, so the controller loads the draft and answers `403` for anyone else
(`404` if there is none) before the detector is touched, for a heartbeat, a goodbye and a save alike.
The refused caller is not recorded, is told no names, and the response does not contain any.

> **The rule for every future resource.** A heartbeat endpoint, and the goodbye endpoint beside it,
> checks, with the same check the
> resource's own edits use, that the caller may access the resource; only then does it record the
> caller and answer with the others. A resource that several people may use (the budget, the
> assignments) will show the names of the other people allowed to use it, and a person who may not
> use it learns nothing, and cannot remove anyone from the list by saying goodbye in their name. A new
> resource's tests must include the refusal and that nothing was recorded or removed by it.

**The banner.** The client turns the list into a sentence with a pure function (`describeOthers`)
and shows it, then a closing sentence that depends on the audience (issue #298). The default
audience, the application form and the faculty ranking page, closes with *Please know that this is
risky; we recommend closing all but one of these.* The admin audience, for the admin pages that
several admins may edit, closes with *We recommend that only one Admin have this page open for edits
at a time.* The noun is a parameter: "application" for a draft application, and "page", "budget",
"ranking" and so on for other screens. The names are rendered as text, which React escapes, never as
markup. A long name wraps instead of widening the page.

Which sentence names the people depends on which tab is reading. The tab that was open first says
who is "also editing"; the tab that arrived later (the modal, and the banner of the newest tab,
including after "Continue anyway") says who "already" has the thing open. This applies to every
audience. With one person the verb is singular ("has"), with the user and anyone else it is plural
("have").

| Who else is active | Tab already open (noun "page") | Tab that arrived later |
|---|---|---|
| no one | nothing is shown | nothing is shown |
| only the user's own other tabs | You are also editing this page in another tab or window. | You already have this page open for editing in another tab or window. |
| one other person | phtcon@ucsb.edu (Phill Conrad) is also editing this page. | phtcon@ucsb.edu (Phill Conrad) already has this page open for editing. |
| the user and one other person | You and phtcon@ucsb.edu (Phill Conrad) are also editing this page in other windows or tabs. | You and phtcon@ucsb.edu (Phill Conrad) already have this page open for editing in other windows or tabs. |
| two or three other people | A and B are also editing this page. / A, B and C are also editing this page. | A and B already have this page open for editing. / A, B and C already have this page open for editing. |
| the user and two or three | You, A and B are also editing this page in other windows or tabs. | You, A and B already have this page open for editing in other windows or tabs. |
| more than three other people | A, B, C and 2 others are also editing this page. (three named, the rest counted; "1 other" for one) | A, B, C and 2 others already have this page open for editing. |

Each sentence is followed by the closing sentence of the audience. For example, for the admin
audience: *a@example.com (Alice) is also editing this page. We recommend that only one Admin have
this page open for edits at a time.* in the tab already open, and *a@example.com (Alice) and
b@example.com (Bob) already have this page open for editing. We recommend that only one Admin have
this page open for edits at a time.* in the tab that arrived later. The banner takes `audience`
(default `"default"`, or `"admin"`) and `newest`; the modal takes `audience` and is always the later
tab. No page uses the admin audience yet; the admin warnings (the budget, course editing and
assignments) will.

The warning clears by itself. When an extra copy is closed it says goodbye, and the next heartbeat
of the remaining copy lists no one, so the banner goes within a heartbeat. If the goodbye is lost,
the extra copy stops heartbeating, ages out of the window, and the banner goes then.

**Goodbye.** The banner used to clear only when a closed copy had been silent for a whole window,
which felt slow. A copy that leaves now says so, and the server forgets it at once.

* The client sends `POST .../leave?id=` with `X-Client-Id`, on the `pagehide` event and when the hook
  goes away. Not `beforeunload` or `unload`: `pagehide` is the event that is reliably delivered when a
  page is closed, navigated away from or put into the back/forward cache, and the other two are
  unreliable on mobile and break that cache. Moving between pages inside the app fires no `pagehide`,
  because the browser page stays; the component using the hook unmounts instead, so unmounting says
  goodbye too.
* It is sent with `fetch(..., { keepalive: true })`, which lets the request outlive the page. It is
  not `navigator.sendBeacon`, which cannot set the `X-Client-Id` header or send the CSRF token
  as a header.
* On `pagehide` the tab also stops its heartbeats, so a heartbeat still on its way cannot put it
  back on the list. If the browser restores the page from the cache (`pageshow` with
  `persisted`), the tab announces itself again at once and resumes.
* The goodbye is authorized exactly like the heartbeat (see below): a caller who may not use the
  resource gets `403` and nothing is removed. It always answers `204` otherwise, whether or not
  the client was known.
* **Delivery is not guaranteed.** A crash, a killed mobile tab or a lost network sends no goodbye.
  The heartbeat window stays as the fallback, so a lost goodbye costs only the old delay.

**Timing.** Two environment variables, read by the server, with safe fallbacks (a value that is
missing, blank, not a whole number or less than 1 is replaced by the default, so a typo cannot stop
the app starting):

| Variable | Default | Meaning |
|---|---|---|
| `CLIENT_HEARTBEAT_INTERVAL_SEC` | `5` | How often an open tab sends a heartbeat |
| `CLIENT_TIMEOUT_MISSED_HEARTBEATS` | `3` | A tab is considered gone after this many intervals with no word from it |

The window is the interval times the missed heartbeats: 15 seconds by default. A closed tab with no
goodbye is forgotten after 15 seconds, and the other tab learns at its next heartbeat, within 5
seconds more: about 15 to 20 seconds. With the goodbye it is about one heartbeat, 5 seconds. They
replace the old `app.concurrency.window-seconds` (a 60 second window and a 20 second heartbeat). The
properties are `app.concurrency.heartbeat-interval-sec` and `app.concurrency.timeout-missed-heartbeats`;
the integration tests use 2 and 3 (a 6 second window) so that a warning can be seen to clear.

*Hidden tabs.* Browsers slow the timers of tabs in the background, sometimes to one a minute. A
background tab's heartbeat can then come later than the window, so the server forgets it and the
warning in the visible tab goes for a while. When the background tab does beat it arrives afresh, as
the newest, and the warning returns (and the modal, if it has become the newest tab). This was
judged acceptable: the warning is advice, the version check still guards every save, and a tab
nobody is looking at is one nobody is typing in. Shortening the heartbeat does not help a throttled
timer, and asking the tab to beat when it becomes visible again was left out as more machinery than
the benefit justifies.

**Arrival order.** Each heartbeat answer says whether the tab is the **newest** and when it
arrived (`arrivedAtMillis`). A client's arrival is the time it was first seen in its present stay: it
is kept while the client keeps being seen within the window, and renewed if the client said goodbye or
went quiet for a window and came back. The newest client is the one that arrived after every other
active client (the user's own tabs and other people alike). Clients that arrive at the same instant
are put in order by their identifiers, so there is always exactly one newest client and never a tie.

**The modal for the newer tab.** Only the newest tab is asked what to do, with a modal that must be
answered. The older tabs keep only the non-blocking banner, so the first editor is never interrupted
in the middle of typing.

| Choice | What it does |
|---|---|
| **Leave this page** | Sends the goodbye, then navigates to the home page. It does not rely on `window.close()`, which browsers ignore for a tab the script did not open |
| **Wait for the other tabs or windows to close, then resume here** | The page stays covered, with a note that it is waiting. The modal closes by itself when a heartbeat shows no one else |
| **Continue anyway** | Closes the modal. The banner stays, and the version check still guards saves |

Why the older tab is never asked: if both tabs were asked, both could choose to wait for the other and
neither would ever resume. Asking only the newest means the oldest tab is never waiting for anyone,
so a waiting tab always waits for something that will not itself be blocked. The same reasoning
covers a third tab arriving: a tab that was waiting but is no longer the newest is released at once
(its modal closes, the banner remains), and it is asked again only if it becomes the newest again.

Other behavior:

* *Typing safety.* No button takes the focus when the modal opens, so a key meant for the form cannot
  press one. Enter is ignored for the first second after the modal appears (and again each time it
  reappears). Escape does nothing, and so does a click outside it: the question must be answered,
  and Escape is too easily pressed in passing. Focus stays inside it, it is labelled by its title,
  and it is announced as a dialog.
* *It does not nag.* After **Continue anyway** the modal does not come back at each heartbeat. The
  choice is remembered for as long as the tab's `arrivedAtMillis` stays the same. A person or tab that
  joins afterwards arrives after this one, so this tab is no longer the newest and has no modal to
  show; if that other tab leaves, this one is the newest again but its choice stands. The modal
  returns only if this tab itself arrives afresh, for example after being forgotten while in the
  background.
* The modal reuses the sentence the banner composes (names, wording rules and the banner text are
  unchanged by #284).

**What the warning is not.** It is advice, not a lock. A user who ignores it is still protected by
the version check.

### Limits

* **One server.** The detector's state is in memory. With two server processes behind a load
  balancer, each sees only the requests it handled, so two copies talking to different processes
  would not see each other. The app runs as a single instance today. If that changes, the state
  moves to the database: a table of `(resource_key, client_id, last_seen)` rows, written on each
  save or heartbeat and read with a time cutoff, with old rows deleted by the same query. The
  interface stays the same and only the store changes, which is the reason for putting it behind an
  interface.
* **A server restart** forgets who was open. The warning is absent for up to one window. The version
  check, which lives in the database, is unaffected.
* **Idle copies without a heartbeat** are invisible, which is why the heartbeat exists. A copy in a
  background tab may have its timers throttled by the browser, and then be forgotten for a while: see
  "Hidden tabs" above. The short window (15 seconds by default) makes this more likely than the old
  60 seconds did; both numbers can be raised with the environment variables.
* **A goodbye that does not arrive** (a crash, a killed mobile tab, a lost network) is covered by the
  window.
* **One copy only** never sees either mechanism. This is as intended.
* **Different people editing the same thing** are named in the warning, and told apart from the
  user's own other tabs (*You*). Both are conflicts and both are handled the same way by the
  version check. A draft application has one owner, so its warning is only ever about the owner's
  own tabs; the names matter for resources that several people may use (Part 2).
* **Names are shown to people who may use the resource, and to no one else.** That is the
  authorization rule above, and it is the application's job, not the detector's.
* **No merging.** The mechanism detects and refuses. It does not combine two sets of edits. Where
  the edits are to different fields of one record this is a real cost, which Part 2 returns to.

### Keeping it self-contained

The pieces are written so that they could later be lifted out as libraries without edits.

| | Where | Depends on |
|---|---|---|
| Server | A package of its own, `edu.ucsb.cs.taapply.concurrency` | The JDK only. No entity, repository or service from the app, and not even Spring |
| Client | A folder of its own, `frontend/src/main/concurrency/` | React, `axios` and `react-bootstrap` (for the modal's focus trap and dialog markup). No import from `main/components`, `main/pages` or `main/utils`, and the banner uses plain Bootstrap class names |
| Tests | `src/test/.../concurrency/` and `frontend/src/tests/concurrency/` | The same, plus a fake clock |

The server package holds the detector interface (`ClientActivityDetector`, with the `note` and
`heartbeat` helpers, and `leave` and `arrival`), its in-memory implementation
(`InMemoryClientActivityDetector`), the identity the app supplies (`ClientIdentity`), the entries it
answers with (`OtherClient`), the arrival order (`Arrival`), the heartbeat's answer (`Presence`), and
the name of the header and the one rule about what a client id may be
(`ConcurrencyHeaders`). The one place that knows about Spring is outside the package:
`config/ConcurrencyConfig` makes the detector bean with the real clock and the two timing settings. The
`409` is built by the application's own controller, since what a refused save says is the
application's business. So is who the user is: the controller builds the identity from the current
user.

The client folder holds the hook that makes the identifier, sends the heartbeat and the goodbye and
reads the answers (`useClientActivity`), the goodbye request (`goodbye`), the header name
(`headers`), the pure functions that read the answer and compose the sentence (`others`), the banner
(`MultipleTabsBanner`) and the modal (`MultipleTabsModal`). The conflict message
with its Reload button is not in it: what Reload does depends on the screen, so it stays in the
application. Each piece takes what it needs by parameter, such as the heartbeat URL, the noun in the
banner, or the function that reloads, and never reaches into the app. An import of `main/...` from
the client folder, or of `edu.ucsb.cs.taapply.entity` from the server package, is a bug in this
design. A lint rule or an architecture test can enforce it.

How each application screen uses them (what its resource key is, who may use the resource, what its
`409` body contains, what Reload does) stays in the application, outside these folders. For draft
applications the wiring is in `DraftApplicationsController` on the server, and in `useDraftSaving`
and `ApplyPage` on the client.

The draft applications design, in `DraftApplicationsDesign.md`, describes the first use of the
version check. This document is where the mechanism is described in general.

## Part 2. Extending it to the rest of the app

The notes below come from reading the code that saves each of the four things surveyed so far. Two
more follow, recruitment state and the other course page saves, where the answer is to refresh and
not to warn. Each one is tracked by an issue.

### The scope principle

The warning fires only when **the exact same thing** is being edited in more than one tab, window or
device. Different things never warn each other. Two tabs on two different recruitments, or one tab
on the Budget and one on the Courses page, say nothing. Several tabs open on a **view-only** page
are always fine: a page that cannot change anything does not heartbeat and cannot show the banner.

This is what decides the resource key of each use. The key names the thing whose copies must not
disagree, and no more. A draft application is one applicant's draft for one recruitment. A ranking
list is one course's list. Some screens are best treated as one thing as a whole, such as the
allocations edit page and the assignments page for one recruitment, because the numbers on them only
mean something together.

### Scope of each issue

| Issue | Page | Scope | Resource key | Order |
|---|---|---|---|---|
| #273 | Application form draft | One applicant's draft for one recruitment | `draft:<draftId>` | first |
| #277 | Budget | One quarter's budget (compare-and-set for a recruitment's average cost and hiring target) | `budget:<quarter>` | 2 |
| #278 | Courses allocations and estimated enrollments | The whole edit page for one recruitment | `courses-edit:<recruitmentId>` | 3 |
| #279 | Faculty rankings | One recruitment course's ranking list | `ranking:<recruitmentCourseId>` | 4 |
| #280 | Assignments | The whole assignments page for one recruitment | `assignments:<recruitmentId>` | 5 |
| #281 | Recruitment settings and workflow steps, for admins, instructors and students | No warning; background refresh plus refetch after each save | None (refresh, not a key) | extension |
| #282 | Instructors page and non-allocation Courses page saves | No warning; same background refresh as #281 plus a refetch after each save | None (refresh, not a key) | extension |

### Two facts that hold for the surveyed screens

**Saves are single-field and absolute.** Each save sends one new value for one field or one row, not
a whole document. For example, `PUT /api/admin/budget` receives only the line that was edited, and
the controller changes only the lines that are present. Two copies editing different fields of the
same record therefore do not overwrite each other. The lost update this design is about happens when
two copies edit the same field, or when a copy acts on a view that has gone stale.

**The harm is as much a stale picture as a lost value.** A stale copy shows totals, counts and ranks
that no longer add up, and the user decides on that basis. Detecting a second copy helps here even
when no save is refused.

That suggests a lighter form of the version check than a version column, useful when adding a column
is more work than the risk justifies:

> **Compare-and-set.** The save carries the value the user saw (`expected`) as well as the new
> value. The server applies the save only if the stored value still equals `expected`; otherwise it
> answers `409` with the current value.

It catches the same-field conflict, needs no migration, and can be added one field at a time. It
does not notice that a different field changed, which, given the first fact above, is usually fine.
A version column is the better choice when a save depends on several fields, or on other rows, being
as the user saw them.

### (a) The budget for a quarter (#277)

Resource key `budget:<quarter>`, as in the table above.

**What saves.** `BudgetController`, `PUT /api/admin/budget?quarter=`, sets any of the three lines
(`unrestrictedBudget`, `tasOnlyBudget`, `ulasOnlyBudget`) on the single `budgets` row for the
quarter. The Budget page (`BudgetPage.tsx`) also edits two values on each recruitment's own row: the
average cost per position and the total hiring target. Each is a separate request with one value.

**What goes wrong today.** An admin who sets the TAs-only line to 40,000 in one tab and 45,000 in
another leaves whichever saved last. The summary on screen, computed on the server and returned
after each save, is right for the saver and stale in the other tab, so two admins can disagree about
how much money there is. Admins are few, so this is rare, but the number matters.

**Fit.** A version column on `budgets` covers all three lines. It is one row per resource, the
simplest case there is. For the two recruitment fields, a version on `Recruitment` would be heavier,
since that row is edited from many pages, so compare-and-set on those two fields is the lighter
choice.

**On conflict.** The page keeps what the user typed, shows the current value beside it ("The TAs-only
budget is now 45,000.00; you entered 40,000.00") and offers **Use theirs** and **Overwrite**.
Overwrite re-sends with the current version. Letting the user force the issue is reasonable here:
one field, one number, and the user can see both.

**Risks.** Low. The budget is a planning figure and "changes are not audited" (see the `Budget`
class comment), so there is no history to reconcile. The hiring target is shared with the
allocations (see (b)), so a conflict on it should refresh the allocation summary too.

### (b) The allocations and estimated enrollments (#278)

Resource key `courses-edit:<recruitmentId>`. The unit is **the whole edit page for a recruitment**:
only one tab or window should have it open at a time.

**What saves.** `RecruitmentCoursesController`,
`PUT /api/recruitmentcourses/allocation?id=&allocation=`, sets the allocation on one
`RecruitmentCourse` row, from the cell the admin edits in `RecruitmentCourseTable.tsx`. The same
page edits the estimated enrollments. Separately, `POST /api/recruitmentcourses/autoAllocate`
overwrites the allocation of every non-removed course in the recruitment in one request (#176, with
the minimum-of-one rule from #257).

**What goes wrong today.** Two cases.

1. *Cell against cell.* As with the budget: the same course's allocation set to two values.
2. *Cell against Auto Allocate.* An admin runs Auto Allocate in one tab while another tab has the
   table open. The second tab still shows the old numbers, including a total that matched the hiring
   target. A single cell edit from there writes one number into a table whose other rows have all
   changed, and the total no longer equals the target. No error occurs.

Both come from the same cause: the numbers on the page only mean something together, and a second
copy that can edit them is a second copy that can break them.

**Fit: split the page in two.** The Courses page for a recruitment becomes a **view-only page** and
an **edit page**.

* The **view-only page** is the default. Nothing on it is editable. It never heartbeats, never
  warns, and any number of tabs can have it open.
* The **edit page** is essentially today's page, with the cells editable. It sends the heartbeat and
  shows the banner, keyed `courses-edit:<recruitmentId>`.
* The view-only page has an **Edit** button, with the text beside it "Edit estimated enrollments,
  and TA/ULA allocations", so that an admin knows why they would press it. The button leads to the
  edit page.
* Where a link from elsewhere in the app should land, on the view or the edit page, is left to
  #278 to decide, one link at a time.

This puts the scope principle to work: the warning is only ever about the screens that can change
something, so someone who is only reading, a common case, never sees it.

**The version check stays as the safety net.** The warning is advice, and an admin can ignore it.
Row-level for the cell edit: an `allocationVersion` column on `recruitment_courses`, a separate
column so that the course refresh and the enrollment estimates, which also write the row, do not
cause spurious conflicts. For the bulk operation, which changes every row at once, a counter on
`Recruitment` bumped by Auto Allocate and sent with every cell edit. A cell edit then fails if
either the row's version or the recruitment's counter has moved.

**On conflict.** For a cell edit, as in (a), show the current value and let the admin choose. After a
conflict caused by the recruitment counter, reload the whole table, since all the old numbers are
suspect.

**Risks.** Medium, and larger than it was before the split, because the split changes a page that
other pages link to. `RecruitmentCourse` rows are also written by the course refresh and by the
enrollment estimates, which is why the version column is its own.

### (c) The faculty rankings for a recruitment course (#279)

Resource key `ranking:<recruitmentCourseId>`, as in the table above.

**What saves.** `InstructorRecruitmentsController`,
`PUT /api/instructor/recruitments/{recruitmentId}/courses/{recruitmentCourseId}/candidates/{applicationId}/rank`,
creates or updates one `candidate_ranking` row, with `(recruitment_course_id, application_id)` unique
and the rank an integer or null. Ties are allowed. `CandidateTable.tsx` keeps every rank in local
state and sends one request per edit, then asks the page to re-read what depends on the rankings. The
endpoint is open to instructors and to admins.

**What goes wrong today.**

* The same instructor with two tabs sees ranks as they were when each loaded. A rank of 3 entered in
  one tab can sit beside a 3 entered for a different candidate in the other: a tie the instructor did
  not mean. The table warns about ties only for the copy that holds both values.
* If more than one person can rank for the same course (an instructor and an admin, or two
  instructors on a co-taught course), they can undo each other's work without either learning of it.
* The rankings feed the Candidates Ranked and Rankings Still Needed counts, so the admin's picture is
  wrong until the next re-read.

**Fit.** The whole list for the course is the thing, even though each save is one row, because a rank
only means something relative to the others. The multi-tab warning is the most valuable half here,
since the stale picture is the real hazard. A version on the course's ranking as a whole, bumped by
any rank edit on that course, gives a sound check: an edit is refused if the list changed since the
copy last read it. That is stricter than compare-and-set on one row and refuses edits that would have
been fine, such as two instructors ranking different candidates. It is acceptable only together with
the conflict handling below, which makes a refusal cheap.

**On conflict.** Do not discard the instructor's rank. Re-read the list, keep the pending edit in
the box, show "Rankings for this course changed while you were editing; your change has not been
saved", and let the instructor press **Save** again after seeing the new list. Ranking is deliberate
work and the table can hold many edits, so a full reload that loses an edit would be unkind.

**Risks.** Medium to high. The version has to live somewhere that does not exist today (a column on
`recruitment_courses`, or a table of its own), and it is touched on a hot path. Rank edits are
frequent, so conflict handling that irritates will be noticed. Rankings are only editable while the
faculty review is Open, which limits the exposure. The Developer Mode job that creates fake rankings
(#220) writes these rows too and must bump the same version.

**As built (#279).** The version is in a table of its own, `ranking_list_versions`
(`recruitment_course_id`, `version`), not a column of `recruitment_courses`, for the reason given for
the allocations: that row is rewritten whole by other saves, and a stale copy of it would put an old
version back. No row means version 0. `RankingVersionService` moves it only with compare-and-set
statements (`advance(courseId, expected)` for a rank edit; `bump(courseId)` for the Developer Mode
fake rankings job, once for each course it ranks), so of several edits made from one version exactly
one is accepted. The candidates list carries the version it was read at in every row
(`rankingVersion`), read before the ranks so that a change in between can only make a save refused,
never wrongly accepted. A rank save names it (`?version=`) and is answered with the rank and the new
version; a stale one is answered `409` with the message above and the current version, and nothing is
changed.

Because the version belongs to the whole list, `CandidateTable` sends its saves one at a time, in the
order they were made, each with the version the last one produced. On a `409` it stops sending the
saves queued behind (they were made against the old list), has the page read the candidates again,
adopts that list's version, shows the new ranks in every box that holds no unsaved edit, keeps the
instructor's typed values in the rest, and puts the message on each of those rows with a **Save
again** button. A candidate list that cannot be read again keeps the table on screen, so nothing typed
is lost.

The warning uses the shared hook, banner and modal with the noun `ranking` and the key
`ranking:<recruitmentCourseId>`: `POST .../courses/{id}/ranking/heartbeat` and `.../ranking/leave`,
and the `X-Client-Id` on every rank save. The newest tab is asked (Leave this page, Wait, Continue
anyway) and older tabs get the banner alone, as for drafts (#285). Authorization comes first: the
heartbeat, the goodbye and the save are allowed only to someone who may rank the course, the
instructor of record while reviews are Open (an admin who also teaches it included). An instructor
of another course, and an admin who does not teach the course, get `403` and are neither recorded nor
told who is there. A page that is read-only sends no heartbeat, so it never warns and is never named.
Two instructors of a co-taught course (two emails with the same catalog name) and an admin who
teaches the course see each other by name; a different course never warns, and neither does the same
person on two courses.

### (d) The assignments (#280)

Resource key `assignments:<recruitmentId>`. The unit is **the whole assignments page for a
recruitment**.

**What saves.** `AdminAssignmentsController`, `PUT /api/admin/assignments/tentative`, sets or clears
`tentativeAssignmentId` on one application. The page (`AdminAssignmentsPage.tsx`) sends one request
per assignment, and the response is the recruitment's whole assignments view with the new counts.
Assignments are admin-only. Publishing them is a separate step (#243).

**What goes wrong today.**

* Two admins assign different applicants to the same course, each sure a place is left. The counts
  that are right for the saver are stale for the other.
* The same applicant is assigned to one course by one admin and to another by a second. The second
  save replaces the first, and the first admin's page still shows the applicant where they put them.
* An admin working from a stale page after the other has published, or after an applicant has
  cancelled, acts on a state that no longer exists.

**Fit.** What matters (how many are assigned to each course, who is unassigned) are properties of the
set of assignments, not of any one row. The expectation is that **only one admin edits the
assignments for a recruitment at a time**, which is what the multi-tab warning, keyed the same way,
tells them. So the check can be simple: a **recruitment-level version**, bumped by every tentative
assignment and by publish. A save carries the version it last saw and is refused if it has moved.
The response to a save already carries the whole view, so on success the client can take the new
version from it without an extra read.

**On conflict.** Refuse the stale assignment, reload the view (one request, and fast) and say what
changed: "Assignments changed while you were working. The page has been refreshed; please check the
placement and try again." The admin's click is not replayed, because after a refresh it may no
longer be the right move.

**Risks.** Medium. The version has to be bumped everywhere the assignments change: a tentative
assignment, publish, and an applicant cancelling. It touches the publish path and the counts that
feed the Recruitment Steps panel. A check this strict would be tiresome if parallel admins were
expected, but one editor is expected, and the warning exists to keep it that way.

### (e) Keeping recruitment state fresh (#281)

**Refresh instead of a warning.** For the recruitment's settings and workflow steps (dates, status,
the per-step actions on the Recruitment Steps panel) there is **no version check, no detector and no
banner**. These pages are read by admins, instructors and students, and edited by admins one click
at a time. The danger is not two people overwriting a field. It is a copy that has gone stale and
shows a step as open that was closed a minute ago, so someone acts on a state that no longer exists.
The remedy is to keep every copy fresh, which is cheaper than warning about it and helps the people
who are only reading.

**What it looks like.**

* **Refetch after each save.** Whatever a page changes, it re-reads the state that depends on it, as
  the cards already do for their own saves.
* **A background refresh every few seconds, without a full page reload.** The data is re-read in the
  background and the page updates in place. See **Refresh timing** below.
* **Paused in hidden tabs.** A tab that cannot be seen does not poll. When it is shown again, or the
  window gets focus, it refetches at once, so that coming back to a tab never shows the old state for
  longer than one request.
* **Cheap queries only.** Only the light reads that feed the state are refreshed, such as the
  recruitment steps and the recruitment list. The heavy tables (applications, rankings, assignments)
  are not polled by this mechanism.
* **Never overwrite input in progress.** A refresh updates what is displayed. It does not replace a
  field the user is typing in, or an edit they have not saved.
* **A repeated Close is a no-op on the server.** Closing a step that is already closed (or opening
  one that is already open) succeeds and changes nothing, so a click from a copy that is a few
  seconds stale is harmless instead of an error or a second state change.

**Refresh timing.** After each refresh, a client waits a **freshly drawn random time**, uniform
between *base - jitter* and *base + jitter* seconds, before the next one. The randomness is the
point: clients that all started together, such as a classroom of students opening the home page at
the same moment, drift apart instead of asking the server at the same instant every time. Admins are
few and need the freshest picture. Instructors and students are many, so they wait longer.

| Who | Base | Jitter | Waits between | Environment variables |
|---|---|---|---|---|
| Admins | 5 s | 3 s | 2 to 8 s | `ADMIN_REFRESH_SEC=5`, `ADMIN_REFRESH_JITTER=3` |
| Instructors and students | 15 s | 5 s | 10 to 20 s | `NON_ADMIN_REFRESH=15`, `NON_ADMIN_JITTER=5` |

All four are environment variables, with the values above as the defaults, so the load can be tuned
without a release. A value that is missing, not a number, zero or negative (for a base), or a jitter
that is negative or larger than its base is replaced by the safe default, so a typing mistake in the
settings can never make a client refresh in a tight loop or never.

**Means.** The app reads this state through react-query, which supports all of the above: a refetch
interval, no refetching while the tab is hidden, and refetching on focus. Built in #281 as one shared
mechanism, not intervals scattered through the pages:

* `useRefreshingBackend` (`frontend/src/main/utils/useRefreshingBackend.ts`) is `useBackend` plus
  a `refetchInterval` **function**. react-query asks the function again after every fetch, so each
  wait is a new draw. `refetchIntervalInBackground` is false and `refetchOnWindowFocus` is true.
  Options passed by the caller win. #282 uses the same hook.
* `nextRefreshMs(timing, random)` (`main/utils/refreshInterval.ts`) makes the draw. The random source
  is an argument so tests are deterministic. A wait is never under 1 second.
* The four settings are read by the server (`application.properties`, `RefreshSetting`) and sent to
  every page in the public `/api/systemInfo` answer, like `ENABLE_DEVELOPER_MODE`, so they change on
  a deployed instance with a restart and no rebuild. The browser checks them again.
* The role is the admin role: anyone with `ROLE_ADMIN` uses the admin pair even if also an
  instructor.

**Bad values.** A base that is missing, not a number or below 1 second is the default. A jitter that
is missing, not a number, negative or larger than its base is the default jitter, and a jitter is
never larger than its base. No wait is ever shorter than 1 second.

**Survey (done for #281).** What feeds the recruitment state, how expensive it is, and what is
refreshed:

| Query | Who | Cost | Refreshed |
|---|---|---|---|
| `GET /api/admin/recruitments/all` | Admin cards | One table read | Yes |
| `GET /api/admin/recruitments/{id}/steps` | Admin cards (Recruitment Steps panel) | Computes the step counts, per recruitment | Yes, for admins only (never students) |
| `GET /api/admin/recruitments/applicationCounts` | Admin cards | Loads every application of every recruitment | **No**, refetched after saves only |
| `GET /api/instructor/recruitments` | Instructor home section | Small | Yes |
| `GET /api/recruitments/applicable` | Student home section, application form | Small | Yes |
| `GET /api/applications/mine`, `GET /api/draftApplications/mine` | Student home section | Small | Yes |
| `GET /api/instructor/recruitments/{id}/courses/{cid}/ranking` | Faculty ranking page header | Small | Yes |
| Application page (`/applications/{id}`) list of recruitments | Student editing a submitted application | Small | **No**: a closed recruitment would swap the form for a read-only view and lose unsaved edits |

Step actions on the server: `PUT /api/admin/recruitments/status` re-stamped `actualClosingDate` on
every Close; it now returns the recruitment untouched, with nothing saved or recorded, if the status
already is the one asked for. `PUT reviewStatus`, `facultyRankingDeadline`, `allocationVisibility`
and `assignmentsPublished` already did nothing when the value was unchanged.

**Input in progress.** A refresh changes what is displayed, not what is being typed. A deadline typed
into the faculty review window lives in the page's own state, so a refresh leaves it alone. A
confirmation whose action no longer applies (Close Applications after another admin closed them,
Close Faculty Reviews when they are already closed, Open Faculty Reviews when they are already open,
or a window for a recruitment that was deleted) closes itself and a toast says nothing was changed.
A student whose recruitment closes while the application form is open keeps the form and everything
typed, is told that the draft is kept as of its last automatic save but can no longer be submitted
(draft saves are refused once applications close, #276), the Submit and Save Draft buttons are turned
off and autosave stops.

**Key.** None. This is a refresh, not a key, so it does not use the detector or the banner.

### (f) The Instructors page and the other Courses page saves (#282)

**Refresh instead of a warning.** The same approach as (e), with the same background refresh, the
same timing and the same rules (paused in hidden tabs, refetch on focus, cheap queries only, never
overwrite input in progress), plus a refetch after each save. There is no version check, detector
or banner, and no resource key.

**What saves there.** The Instructors page: adding an instructor, uploading a list of instructors,
and deleting an instructor, and setting a catalog name. The Courses page, apart from the
allocations: removing a course, setting its flags, and the enrollment estimates where they are saved
from there. These are one-click or one-field saves, each of which a stale copy can repeat or
contradict (deleting an instructor who is already gone, removing a course twice), so the remedy is a
fresh picture and, on the server, saves that are safe to repeat.

**What stays with #278.** The allocations and the estimated enrollments edited on the edit page are
part of the Courses page split in (b), where the whole edit page is guarded with a heartbeat and a
banner. #282 covers the saves that are left.

**First step of the issue.** A survey, written into this section, before any code: each save on the
two pages, which are already safe to repeat, and which queries a page needs refreshed. The survey
updates this document.

## Iterations

In order, easiest first. Each is written to become an issue, and most already are. Sizes are rough: S
is a day or less, M a few days, L about a week.

1. **Extract the mechanism and cover draft applications. (M, issues #270 and #273.)** The version
   check on drafts, the detector, the client hook and banner, in their own package and folder with
   their own tests, plus this document's Part 1. This is the base that everything below uses.

2. **Budget: version the quarter's budget row and warn about multiple copies. (S, #277.)** One row
   per quarter, one admin at a time in practice, the smallest possible user of the mechanism. Add a
   `version` to `budgets`, a `409` on a stale `PUT /api/admin/budget`, the **Use theirs** and
   **Overwrite** choice, and the banner on the Budget page. Use compare-and-set for the recruitment's
   average cost and hiring target. It proves the mechanism on a second, unrelated screen and shows
   whether the package really is free of application knowledge.

3. **Allocations: split the Courses page into view and edit, then guard the edit page. (L, #278.)**
   The page split is new work, so this is larger than it first looked (it was M). A view-only page
   that never warns, with an Edit button; an edit page that heartbeats and warns, keyed
   `courses-edit:<recruitmentId>`; and, as the safety net, `allocationVersion` on `recruitment_courses`
   and a bulk-change counter on `Recruitment` for the cell edit and for Auto Allocate. This adds the
   one idea the budget lacks, a recruitment-level change that invalidates every row, still with only
   admin users and single-field saves.

4. **Rankings: version a course's ranking list and keep the user's pending edit on conflict. (L,
   #279.)** A version on the course's rankings, bumped by every rank edit (including the Developer
   Mode fake rankings job), a `409` on a stale edit, the warning keyed on the course, and the "your
   change has not been saved" handling that keeps the edit in the box. More users, a hot path and a
   state machine in the client make it bigger than the first three, but each save is still one row.

5. **Assignments: a recruitment-level version on the whole assignments page. (M, #280.)** A version
   bumped by every tentative assignment and by publish, a `409` on a stale assignment with a refresh
   of the view, and the warning keyed on the recruitment. It is smaller than it first looked (it was
   L), because one editor at a time is expected and no per-course narrowing is needed. Cover publish
   and applicant cancellation.

6. **Keep recruitment state fresh for admins, instructors and students. (S to M, #281.)** Refresh
   instead of a warning: refetch after each save, a background refresh with random jitter (admins
   2 to 8 seconds, instructors and students 10 to 20, set by environment variables), paused in hidden tabs and refetched on focus, cheap queries
   only, never overwriting input in progress, and a repeated Close made a no-op on the server. It
   needs no version check, detector or banner. A survey first, which updates section (e) of this
   document. Built: see section (e) for the shared `useRefreshingBackend` hook that #282 reuses.

7. **Keep the Instructors page and Courses page saves fresh. (S to M, #282.)** Refresh instead of a
   warning, with the same background refresh as #281 and a refetch after each save, for adding,
   uploading and deleting instructors, setting a catalog name, and the Courses page saves other than
   the allocations and estimates (which stay with #278). No version check, detector or banner. A
   survey first, which updates section (f) of this document.

After iteration 2 it is worth stopping to look at what the second user of the package needed that the
first did not, and to fix the package before three more screens depend on it. That is also the moment
to decide whether extracting it into a library of its own is worth doing.
