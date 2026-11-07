import { Link } from "react-router";
import { Table } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { DEVELOPER_MENU_ENTRIES } from "main/utils/helpPages";
import useScrollToHash from "main/utils/useScrollToHash";

/**
 * The developer's handbook: /help/developer (issue #266). A table of every option on the Developer
 * menu, each linking to the section below that says what the page does, followed by what Developer
 * Mode adds to the footer. These sections used to be part of the For Admins page.
 */
export default function HelpDeveloperPage(): React.JSX.Element {
  // The table's links point at a section (#jobs); scroll to it on arrival.
  useScrollToHash();

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpDeveloperPage">
        <h1 className="my-4">For Developers</h1>
        <p data-testid="HelpDeveloperPage-intro">
          The Developer menu is offered to admins. For the rest of the
          admin&apos;s handbook, see <Link to="/help/admins">For Admins</Link>.
        </p>
        <Table striped bordered size="sm" data-testid="HelpDeveloperPage-menu">
          <thead>
            <tr>
              <th>Option</th>
              <th>What it is for</th>
            </tr>
          </thead>
          <tbody>
            {DEVELOPER_MENU_ENTRIES.map((entry) => (
              <tr
                key={entry.path}
                data-testid={`HelpDeveloperPage-menu-${entry.section}`}
              >
                <td>
                  <a href={`#${entry.section}`}>{entry.label}</a>
                </td>
                <td>{entry.summary}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p data-testid="HelpDeveloperPage-more">
          Not on the menu, but for developers:{" "}
          <a href="#simultaneous-editing">Simultaneous Editing</a> explains,
          under the hood, how the app copes with the same thing being open in
          more than one tab or window.
        </p>

        <h2 className="my-3 h4" id="jobs">
          Jobs
        </h2>
        <p>
          <Link to="/admin/jobs">Jobs</Link> lists every background job that has
          run, with its status and log: the job that fills the Courses table,
          the job that fills a recruitment&apos;s course list (launched on
          creation, by Populate, and by the nightly refresh), and a test job
          that can be launched here to check the job system itself. When a
          course list looks wrong, its job&apos;s log says what the UCSB API
          returned.
        </p>

        <h2 className="my-3 h4" id="developer-info">
          Developer Info
        </h2>
        <p>
          <Link to="/admin/developer">Developer Info</Link> shows which branch
          and commit are deployed, links to the backend&apos;s API
          documentation, and the system settings the app was started with. It is
          for checking what is running, not for changing anything.
        </p>

        <h2 className="my-3 h4" id="developer-mode">
          Developer Mode
        </h2>
        <p data-testid="HelpDeveloperPage-developer-mode">
          <Link to="/admin/developer-mode">Developer Mode</Link> is a switch for{" "}
          <strong>test instances only</strong>. It exists only where the
          instance was started with <code>ENABLE_DEVELOPER_MODE=true</code>;
          production is started without it, and then the menu item and the
          switch are not there at all. While the switch is on, a red{" "}
          <strong>Developer Mode</strong> badge appears in the footer of every
          page, for everyone, as a reminder that the instance may hold fake
          data. Page-specific controls for creating that data appear in the
          footer too, in red, just to the left of the badge, and never among the
          page&apos;s own buttons. Flipping the switch is not recorded in any
          change history.
        </p>
        <p data-testid="HelpDeveloperPage-auto-create-recruitments">
          While developer mode is on, the footer of the home page has a red{" "}
          <strong>Auto Create Recruitments</strong> button. It proposes the
          quarter after the current one, skipping Summer (and lets you pick
          another: the four quarters before the current one up to the next one,
          or the next two in Spring, since only those have courses to fill in),
          and shows what it would do: a TA recruitment and a ULA recruitment for
          that quarter, each only if one does not exist yet, with the tentative
          opening date a week from today and the primary consideration date a
          week after that. If both exist already there is nothing to create.{" "}
          <em>Create Recruitments</em> then creates them exactly as the{" "}
          <em>Create New Recruitment</em> button would, so their course lists
          are filled in the usual way; nothing is opened, and no hiring target
          is set.
        </p>
        <p data-testid="HelpDeveloperPage-fake-allocations">
          While developer mode is on, the footer of a recruitment&apos;s Courses
          page has a <strong>Fake Hiring Targets and Allocations</strong>{" "}
          button. It sets the recruitment&apos;s hiring target (one position per
          course unless you choose another number, up to three per course),
          fills in the enrollment estimates from the schedule&apos;s maximum
          enrollment, from current enrollment, or leaves the ones already
          entered, and then auto-assigns the allocations across the courses,
          exactly as the Combined Allocation page&apos;s{" "}
          <em>Auto assign allocations</em> button does. A checkbox, ticked by
          default, also sets allocation visibility to{" "}
          <strong>Faculty see their own courses</strong>, recorded in the change
          history like any other visibility change. The footer of the Combined
          Allocation page (<code>/admin/allocations/QXX</code>) has the same
          button for the whole quarter: its modal has a hiring target box for
          each of the quarter&apos;s recruitments that has a course (
          <em>TA hiring target</em>, <em>ULA hiring target</em>), and one click
          does the above for both, with the same estimate source and visibility
          choice.
        </p>
        <p data-testid="HelpDeveloperPage-fake-rankings">
          While developer mode is on, the footer of a recruitment&apos;s Courses
          page also has a <strong>Create Fake Rankings</strong> button, enabled
          only while faculty ranking is open. It launches a job that ranks
          candidates as the faculty would, for every course that has no rankings
          yet or for a random part of them. Each course gets as many interested
          candidates as its ranking target asks for, and a checkbox also ranks
          one or two applicants who did not express interest. Courses that
          already have rankings are never changed. The Combined Allocation
          page&apos;s footer has the same button for the whole quarter: one
          click launches a job for each of the quarter&apos;s recruitments whose
          faculty review is Open and which has a course; when only one of the
          two qualifies the modal says which, and that the other is left alone.
          The button is disabled while neither qualifies.
        </p>

        <h2 className="my-3 h4" id="dates-and-times">
          Dates and Times
        </h2>
        <p data-testid="HelpDeveloperPage-dates-and-times">
          Every date and time the app shows or accepts is Pacific Time
          (America/Los_Angeles), whatever zone the server or the browser is in
          (issue #293). A <strong>calendar date</strong> (an opening date, a
          deadline) has no zone and is shown as entered. A{" "}
          <strong>date and time</strong> the app records (when an application
          was submitted, when a change was made) is stored in the database as
          Pacific wall-clock time, so it reads the same in the database as on
          the screen; the one exact instant, when a user was last online, is
          stored with its zone and converted for display. The backend takes
          &quot;now&quot; and &quot;today&quot; from <code>AppTime</code> and
          the frontend formats and works out &quot;today&quot; only in{" "}
          <code>pacificTime.ts</code>; a test fails if anything else calls{" "}
          <code>toLocaleString</code> or reads the browser's clock. The design
          is in <code>docs/design/PacificTimeDesign.md</code>.
        </p>

        <h2 className="my-3 h4" id="simultaneous-editing">
          Simultaneous Editing
        </h2>
        <p data-testid="HelpDeveloperPage-simultaneous-editing">
          Some screens save as the user works, so the same screen open twice, in
          two tabs, two windows or on two devices, would let the last save
          silently overwrite the first. Two mechanisms deal with it. The{" "}
          <strong>version check</strong> is the safeguard: it refuses a save
          from a copy that is out of date. The{" "}
          <strong>multi-tab warning</strong> is the courtesy: it tells the user,
          before anything is refused, that another copy is open, and who. The
          full design, including where else it is planned, is{" "}
          <code>docs/design/ConcurrentEditMitigationDesign.md</code>. So far the
          draft application form, the faculty rankings, the editing of a
          submitted application, the assignments page, the Budget page and the
          Courses edit page use them; recruitment state is kept fresh by a
          refresh instead (see below).
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-version">
          <strong>The version check.</strong> A saved thing carries an integer{" "}
          <code>version</code> that starts at 1. A save sends the version the
          copy last saw. If it still matches, the server saves and counts a new
          version, in one atomic step (JPA optimistic locking), and answers with
          it. If not, nothing is changed and the answer is{" "}
          <code>409 Conflict</code> with the draft as it now stands. The form
          then stops saving, says so, and offers <em>Reload</em>. Where the
          saved thing is a whole page of numbers that several admins might
          touch, a simpler form is used: the Assignments page of a recruitment
          has a recruitment-level <code>assignmentsVersion</code>, counted up by
          one atomic update (
          <code>WHERE id = ? AND assignments_version = ?</code>) on every
          tentative assignment, on publishing or taking back, and on an
          applicant cancelling. A stale tentative assignment is answered{" "}
          <code>409</code> with the current assignments, and the page shows them
          and a message, without repeating the click.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-compare">
          <strong>Compare-and-set.</strong> Where a version column would be
          heavy, a save carries the value the page last saw (
          <code>expected</code>) and the server applies it only if that is still
          the stored value; otherwise nothing changes and the answer is{" "}
          <code>409 Conflict</code> with the current value. The Budget page uses
          a version for the budget&apos;s lines (every cost and fund figure
          lives on the budget row since issue #388) and compare-and-set for each
          recruitment&apos;s hiring target, which the recruitment&apos;s row
          shares with many other pages. The page keeps what the user typed, says
          what is stored now, and offers <em>Use theirs</em> and{" "}
          <em>Overwrite</em>.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-heartbeat">
          <strong>The client id and the heartbeat.</strong> Each tab makes a
          random identifier with <code>crypto.randomUUID()</code> and keeps it
          in memory only, never in storage, so a duplicated or restored tab does
          not inherit another&apos;s. It goes to the server in the{" "}
          <code>X-Client-Id</code> header of every save, and of a{" "}
          <strong>heartbeat</strong>:{" "}
          <code>POST /api/draftApplications/heartbeat?id=</code>, sent as soon
          as the draft is open and then as often as the server asks (every 5
          seconds by default). A heartbeat changes nothing, not even the
          draft&apos;s version. It exists so that a tab that is open but idle is
          seen too.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-goodbye">
          <strong>The goodbye.</strong> A tab that leaves says so, with{" "}
          <code>POST /api/draftApplications/leave?id=</code> and the same{" "}
          <code>X-Client-Id</code>, so that the server forgets it at once and
          the other tab&apos;s warning goes within a heartbeat instead of after
          the timeout. It is sent on the <code>pagehide</code> event (not{" "}
          <code>beforeunload</code> or <code>unload</code>, which are not
          reliably delivered and defeat the back/forward cache) and when the
          hook unmounts, which is how moving to another page of the app looks,
          since that fires no <code>pagehide</code>. It uses <code>fetch</code>{" "}
          with <code>keepalive: true</code>, not <code>sendBeacon</code>, so
          that the <code>X-Client-Id</code> and CSRF headers can be sent. After{" "}
          <code>pagehide</code> the tab stops its heartbeats; if the browser
          restores the page from its cache (<code>pageshow</code> with{" "}
          <code>persisted</code>), it announces itself again at once. A goodbye
          is authorized exactly like a heartbeat. Delivery is not guaranteed (a
          crash, a killed mobile tab, a lost network), so the timeout below
          stays as the fallback.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-detector">
          <strong>The detector and its identity.</strong> A{" "}
          <code>ClientActivityDetector</code>, in the package{" "}
          <code>edu.ucsb.cs.taapply.concurrency</code>, which imports nothing
          from the rest of the app, remembers for each <em>resource key</em> (
          <code>draft:&lt;draftId&gt;</code>) and each client id when it was
          last seen and who it is. The <em>app</em> says who: a stable person
          key (the user&apos;s email) and a label to show others (
          <code>email (Full Name)</code>, or just the email), and the detector
          treats the key and the label as opaque. It answers the heartbeat with
          a JSON body,{" "}
          <code>{`{"others": [{"label", "samePerson", "admin"}], "heartbeatSeconds", "newest", "arrivedAtMillis"}`}</code>
          : one entry for each other <em>person</em>, however many tabs they
          have open, with <code>samePerson</code> true for the user&apos;s own
          other tabs and <code>admin</code> true for an admin (the app says so
          in the identity, and the detector only passes it on). Names are in the
          body and not in headers because they are not always ASCII and can be
          long. A label is cut to 200 characters. In the browser a pure function
          composes the sentence (&quot;You are also editing this application in
          another tab or window.&quot;, &quot;phtcon@ucsb.edu (Phill Conrad) is
          also editing this application.&quot;, and so on, three people named
          and the rest counted) and the banner shows it as text, never as
          markup. The tab that arrived later (the modal, and the banner of the
          newest tab) says who is <em>already</em> there instead (&quot;You
          already have this application open for editing in another tab or
          window.&quot;, &quot;A already has this page open for editing.&quot;,
          &quot;A and B already have this page open for editing.&quot;), with
          the singular verb for one person. The closing sentence depends on who
          is involved. When every other copy is the user&apos;s own, on the
          application form and the faculty ranking page, it asks the user to
          close the extra ones (&quot;Please know that this is risky; we
          recommend closing all but one of these.&quot;). When another person is
          involved, whose window the user cannot close, and on admin pages (the{" "}
          <code>admin</code> option of <code>audience</code> on the banner and
          the modal), it is &quot;We recommend that only one admin edits this
          page at a time.&quot; The noun is still a parameter of the first
          sentence, but this one always says &quot;page&quot;. A submitted
          application is edited on two pages at once, the applicant&apos;s and
          the admin&apos;s, and they say different things (issue #302): with{" "}
          <code>audience=&quot;applicant&quot;</code>, an admin among the others
          replaces the whole message with &quot;Admin A (Name) has this
          application open for editing. We recommend that you close this window
          and try again in a few minutes. If this message persists, please reach
          out to A&quot; (the first admin&apos;s email, and &quot;have&quot;
          with several, named as above); with{" "}
          <code>audience=&quot;applicationAdmin&quot;</code>, an applicant among
          the others gets the closing sentence &quot;We recommend that you wait
          a few minutes or ask them to close it.&quot;, followed by the admin
          sentence if other admins are there too. The wording was confirmed by
          the maintainer.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-modal">
          <strong>The modal and how the newer tab is chosen.</strong> A client
          is the <em>newest</em> when it arrived after every other active client
          (the user&apos;s own tabs and other people alike). Its arrival is the
          time it was first seen in its present stay, kept while it keeps
          beating and renewed if it said goodbye or was forgotten and came back;
          clients that arrive at the same instant are ordered by their
          identifiers, so there is always exactly one newest. The answer says{" "}
          <code>newest</code> and <code>arrivedAtMillis</code>. Only the newest
          tab shows a modal that must be answered, with three choices:{" "}
          <em>Leave this page</em> (says goodbye, then goes to the home page; it
          does not rely on <code>window.close()</code>),{" "}
          <em>Wait for the other tabs or windows to close, then resume here</em>{" "}
          (the page stays covered, and the modal closes by itself when a
          heartbeat shows no one else), and <em>Continue anyway</em> (the modal
          closes, the banner stays). The older tabs keep only the banner, so the
          first editor is never interrupted mid-typing, and two tabs cannot both
          choose to wait for the other and be stuck: the oldest tab is never
          asked to wait. A waiting tab that stops being the newest is released.
          No button takes the focus, Enter is ignored for the first second, and
          Escape and clicks outside do nothing. A choice to continue lasts until
          the tab arrives afresh, so the modal does not return at every
          heartbeat.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-authorization">
          <strong>Authorization.</strong> The detector tells names to anyone who
          asks, so the app must check that the caller may use the resource{" "}
          <em>before</em> it records the caller or asks who else is there.
          Otherwise anyone could probe resource keys to learn who is working
          where. For a draft only its owner may heartbeat, say goodbye or save,
          and anyone else gets <code>403</code> with nothing recorded or removed
          and no names in the answer. For a submitted application the owner or
          any admin may. Every future use must make the same check first.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-timing">
          <strong>Timing.</strong> Two environment variables, read by the
          server, set how fast a closed tab is noticed. A value that is missing,
          blank, not a whole number or less than 1 is replaced by the default. A
          tab is forgotten after the heartbeat interval times the missed
          heartbeats, 15 seconds by default, and the other tab learns at its
          next heartbeat: a closed tab with no goodbye is noticed in about 15 to
          20 seconds, and one that says goodbye in about one heartbeat, 5
          seconds. The server tells clients the interval in each heartbeat
          answer. The integration tests use an interval of 2 and 3 missed
          heartbeats, a 6 second window.
        </p>
        <Table
          striped
          bordered
          size="sm"
          data-testid="HelpDeveloperPage-simultaneous-timing-table"
        >
          <thead>
            <tr>
              <th>Variable</th>
              <th>Default</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr data-testid="HelpDeveloperPage-simultaneous-timing-interval">
              <td>
                <code>CLIENT_HEARTBEAT_INTERVAL_SEC</code>
              </td>
              <td>
                <code>5</code>
              </td>
              <td>How often an open tab sends a heartbeat.</td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-timing-missed">
              <td>
                <code>CLIENT_TIMEOUT_MISSED_HEARTBEATS</code>
              </td>
              <td>
                <code>3</code>
              </td>
              <td>
                A tab is considered gone after this many heartbeat intervals
                with no word from it.
              </td>
            </tr>
          </tbody>
        </Table>
        <p data-testid="HelpDeveloperPage-simultaneous-limits">
          <strong>Limits.</strong> The detector keeps its state in memory, so it
          works for one server process only; with several, each would see only
          its own requests, and the state would have to move to the database
          behind the same interface. A restart forgets who was open, so the
          warning is absent for up to one window. Browsers slow the timers of
          hidden tabs, so a tab in the background can heartbeat later than the
          timeout. The server then forgets it, the warning in the visible tab
          goes for a while, and when the background tab beats again it arrives
          afresh as the newest and the warning returns. That is accepted:
          raising the two variables makes it rarer. The warning is advice and
          never a lock; the version check still protects the data.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-courses">
          <strong>The Courses pages.</strong> A recruitment&apos;s Courses page
          is split in two. The view-only page (
          <code>/admin/recruitments/:id/courses</code>) is the default, edits
          nothing, and neither heartbeats nor warns. The edit page (
          <code>/admin/recruitments/:id/courses/edit</code>) heartbeats{" "}
          <code>POST /api/recruitmentcourses/heartbeat?recruitmentId=</code>,
          says goodbye at <code>/leave</code>, and shows the banner and the
          modal with the noun &quot;page&quot;; <em>Leave this page</em> goes to
          the view-only page. Since issue #358 the edit page keeps Populate, Add
          by enroll code, Remove and allocation visibility, none of which name
          the tab (the hiring target is on the Budget page and Publish
          Assignments on the Assignments page); the allocation, estimate,
          fill-estimates and Auto Allocate saves, which name the tab in the{" "}
          <code>X-Client-Id</code> header, are made from the Combined Allocation
          page (next) under this same key. Only an admin may heartbeat, and the
          recruitment must exist, before anything is recorded. The version check
          is not a JPA version, since the course refresh also writes the row
          (and so did the estimates, until issue #363 moved them to{" "}
          <code>budget_courses</code>): a separate{" "}
          <code>allocation_version</code> column on{" "}
          <code>recruitment_courses</code> is counted by each allocation edit,
          and <code>allocation_bulk_version</code> on <code>recruitments</code>{" "}
          is counted by Auto Allocate. An allocation edit sends both as{" "}
          <code>expectedVersion</code> and <code>expectedBulkVersion</code> and
          gets <code>409</code> when either moved; after a bulk conflict the
          page reads everything again.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-combined">
          <strong>The Combined Allocation page (issue #358).</strong>{" "}
          <code>/admin/allocations/QXX</code> edits the same allocations and
          estimates as the Courses edit pages of the quarter&apos;s TA and ULA
          recruitments, so it has no key of its own: it heartbeats{" "}
          <code>POST /api/recruitmentcourses/heartbeat?recruitmentId=</code>{" "}
          once for each recruitment of the quarter (two heartbeats when it has
          both), under that page&apos;s key{" "}
          <code>courses-edit:&lt;recruitmentId&gt;</code>, with one{" "}
          <code>X-Client-Id</code> for both (<code>useClientActivity</code>{" "}
          takes a <code>clientId</code> to share), and says goodbye at{" "}
          <code>/leave</code> for each. So the combined page and the edit pages
          warn each other about the same allocations. The two answers are put
          together by <code>mergeStandings</code>: everyone named by either,
          each person once; the tab is the newest only if both say so, so of two
          tabs that share a recruitment only the later one is asked and none
          waits on another that waits on it; and the arrival is the later of the
          two. The banner and the modal use the noun &quot;quarter&apos;s
          allocations&quot;; <em>Leave this page</em> goes to the quarter&apos;s
          Budget page. The allocation, estimate, fill-estimates and Auto
          Allocate saves name the tab; the conversion factor save, which is{" "}
          <code>PUT /api/admin/budget</code>, does not, because the page does
          not heartbeat <code>budget:&lt;quarter&gt;</code>: that field is
          guarded by a version check of its own (the budget row&apos;s{" "}
          <code>conversionVersion</code>, issue #375, counted apart from the{" "}
          <code>version</code> of the three budget lines, so the two pages never
          refuse each other&apos;s saves), and a save that named a tab the
          Budget page never hears a heartbeat from would make that page warn
          about a tab that is not there.
        </p>
        <p data-testid="HelpDeveloperPage-courses-columns">
          <strong>Which Courses columns show (issue #300).</strong> The
          view-only and edit pages keep the hidden columns in the browser&apos;s
          local storage, under{" "}
          <code>recruitmentCourses.hiddenColumns.&lt;id&gt;</code>, through{" "}
          <code>useStoredHiddenColumns</code>; nothing is stored on the server,
          and the Courses page no longer uses{" "}
          <code>/api/admin/hiddencolumns</code>, which the Applications and
          Assignments pages still do. Faculty read{" "}
          <code>/recruitments/:id/courses</code> (the old{" "}
          <code>/allocations</code> route redirects to it) from{" "}
          <code>GET /api/instructor/recruitments/:id/courses</code>. For anyone
          but an admin, <code>enrollmentEstimate</code>, <code>allocation</code>{" "}
          and <code>unroundedAllocation</code> are left out of the JSON unless
          the recruitment&apos;s allocation visibility is{" "}
          <code>ALL_COURSES</code> (a value that still exists in the backend but
          is no longer selectable in the user interface, issue #366), and the
          table omits the matching columns (
          <code>AllocationsRelatedColumns</code>) instead of hiding them. Since
          issue #358 the admin&apos;s own view-only and edit pages omit those
          five columns too (<code>omitColumns</code>, and{" "}
          <code>adminColumnChoices</code> leaves them out of the Columns menu):
          the admin edits them on the Combined Allocation page, and the faculty
          Courses page is the only table that still shows them, as text.
        </p>
        <h3 className="mt-4 h5" id="state-refresh">
          Refresh instead of a warning: keeping recruitment state fresh
        </h3>
        <p data-testid="HelpDeveloperPage-simultaneous-refresh">
          <strong>Why a refresh.</strong> Where a recruitment is in the process
          (its settings and dates, which Recruitment Steps boxes have a green
          check, whether applications and faculty rankings are open or closed,
          allocation visibility, whether assignments are published) is read by
          admins, instructors and students and changed by admins one click at a
          time. The danger is not two people overwriting one field; it is a copy
          that has gone stale and shows a step as open that was closed a minute
          ago. So there is no version check, no detector and no banner (issue
          #281). Instead every page that shows that state re-reads it in the
          background, <em>without a page reload</em>, and after every save. The
          server stays the safeguard: the status endpoints take the target state
          (<code>status=OPEN</code>), not a toggle, so a click made in the few
          seconds before a refresh is judged by the server, and the
          prerequisites of each step are enforced there. Setting the status a
          recruitment already has changes and records nothing: a repeated Close
          does not stamp <code>actualClosingDate</code> again.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-refresh-how">
          <strong>How.</strong> One shared mechanism,{" "}
          <code>useRefreshingBackend</code> in{" "}
          <code>main/utils/useRefreshingBackend.ts</code>, takes the same
          arguments as <code>useBackend</code> and adds a react-query{" "}
          <code>refetchInterval</code> <em>function</em>. react-query asks it
          again after every fetch, so each wait is a freshly drawn random time,
          uniform between <em>base minus jitter</em> and{" "}
          <em>base plus jitter</em> seconds, not one drawn when the page loaded.
          The random wait exists to avoid synchronized waves of requests: a
          classroom of students who open the home page at the same moment drift
          apart instead of asking the server at the same instant every time. The
          draw is <code>nextRefreshMs(timing, random)</code> in{" "}
          <code>main/utils/refreshInterval.ts</code>, which takes the random
          source as an argument so tests are deterministic. Admins (anyone with
          the admin role, even one who is also an instructor) use the first pair
          of settings below; instructors and students use the second. A hidden
          tab does not refresh (<code>refetchIntervalInBackground</code> is
          false) and a tab that is shown or focused again refetches at once.
          Options passed by a caller win over these.
        </p>
        <Table
          striped
          bordered
          size="sm"
          data-testid="HelpDeveloperPage-simultaneous-refresh-table"
        >
          <thead>
            <tr>
              <th>Variable</th>
              <th>Default</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr data-testid="HelpDeveloperPage-refresh-admin-sec">
              <td>
                <code>ADMIN_REFRESH_SEC</code>
              </td>
              <td>
                <code>5</code>
              </td>
              <td>Mean seconds between refreshes for admins.</td>
            </tr>
            <tr data-testid="HelpDeveloperPage-refresh-admin-jitter">
              <td>
                <code>ADMIN_REFRESH_JITTER</code>
              </td>
              <td>
                <code>3</code>
              </td>
              <td>
                Admins wait uniformly between 5 - 3 and 5 + 3 seconds (2 to 8).
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-refresh-non-admin-refresh">
              <td>
                <code>NON_ADMIN_REFRESH</code>
              </td>
              <td>
                <code>15</code>
              </td>
              <td>
                Mean seconds between refreshes for instructors and students.
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-refresh-non-admin-jitter">
              <td>
                <code>NON_ADMIN_JITTER</code>
              </td>
              <td>
                <code>5</code>
              </td>
              <td>
                Instructors and students wait uniformly between 15 - 5 and 15 +
                5 seconds (10 to 20).
              </td>
            </tr>
          </tbody>
        </Table>
        <p data-testid="HelpDeveloperPage-simultaneous-refresh-rules">
          <strong>Bad values.</strong> A typing mistake can never make a client
          refresh in a tight loop or never. A mean that is missing, not a number
          or below 1 second is replaced by its default. A jitter that is
          missing, not a number, negative or larger than its mean is replaced by
          its default, and a jitter is never larger than its mean. Whatever the
          settings, no wait is ever shorter than 1 second. The server checks the
          values when it builds the answer and the browser checks them again, so
          either side alone is safe.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-refresh-deploy">
          <strong>Setting them on a deployed instance.</strong> The Vite
          frontend reads build-time variables only, so these are not Vite
          variables. They are ordinary environment variables of the server
          process (in <code>.env</code> on localhost), read into{" "}
          <code>application.properties</code> and sent to every page in the
          public <code>/api/systemInfo</code> answer, like{" "}
          <code>ENABLE_DEVELOPER_MODE</code>. Change the variable and restart
          the server: no rebuild is needed, and a page picks the new values up
          the next time it loads. Do not set them very low on a busy instance;
          the jitter spreads the requests out, but every open page still asks
          once per interval.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-refresh-pages">
          <strong>Which pages refresh.</strong> Only the cheap reads that carry
          the state: the admin recruitment list and each card&apos;s Recruitment
          Steps (<code>/api/admin/recruitments/all</code> and{" "}
          <code>/api/admin/recruitments/&#123;id&#125;/steps</code>), the
          instructor and student sections of the home page (the{" "}
          <code>HOME_PAGE_QUERY_KEYS</code>:{" "}
          <code>/api/instructor/recruitments</code>,{" "}
          <code>/api/recruitments/applicable</code> and{" "}
          <code>/api/applications/mine</code>, plus{" "}
          <code>/api/draftApplications/mine</code>), the faculty ranking
          page&apos;s header state, and the list the application form checks to
          see that applications are still open. The endpoint that counts
          applications for each recruitment, and the heavy tables (applications,
          rankings, assignments), are not refreshed this way, and a
          student&apos;s home page never asks an admin endpoint.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-refresh-admin-pages">
          <strong>
            The Instructors page and the view-only Courses page (issue #282).
          </strong>{" "}
          These pages change small, infrequent settings, each to an absolute
          value, so they refresh instead of warning, with the same hook and the
          same four settings (admins only use them, so the admin pair applies).
          Each save already refetches its lists when it succeeds, and the
          background refresh covers a change made by another admin. The queries
          that refresh are <code>/api/admin/instructors/get</code> and{" "}
          <code>/api/admin/instructors/catalogNames</code> (Instructors),{" "}
          <code>/api/courses/all</code> (Courses), and{" "}
          <code>/api/recruitmentcourses/all</code> and{" "}
          <code>/api/admin/recruitments/all</code> (a recruitment&apos;s course
          list). On the course list only the <strong>view-only page</strong>{" "}
          refreshes in the background; the <strong>edit page</strong> does not,
          because it is guarded by a warning instead (issue #278) and its saves
          carry the versions the list holds, so the list must not move under an
          admin who is editing (it still refetches after each save). The ranking
          summaries are heavier and are not refreshed this way. Input in
          progress is protected as follows: the Catalog Name dropdown keeps
          showing what it showed (or what was just chosen) while it has focus,
          and follows the stored value again when it is left; the enrollment
          estimate and allocation boxes show their own draft while they have
          focus; and a CSV being chosen lives in the upload form&apos;s own
          state.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-refresh-input">
          <strong>Input in progress.</strong> A refresh updates what is shown
          but never replaces what a person is typing. A deadline being typed
          lives in the page&apos;s own state, not in the refreshed data. A
          confirmation for an action that no longer applies (Close applications
          when they are already closed) closes itself and says so, and nothing
          is sent. A student whose recruitment closes while the application form
          is open keeps the form and everything typed: it says that the draft is
          kept as of its last automatic save and can no longer be submitted,
          turns off Submit and Save Draft, and stops trying to save (draft saves
          are refused once applications close, issue #276).
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-ranking">
          <strong>The version check on rankings.</strong> A course&apos;s whole
          ranking list has one version, in its own table, bumped by every rank
          edit and by the Developer Mode fake rankings job; no row means version
          0. The candidates are sent with the version they were read at, a rank
          save names it as <code>?version=</code>, and the server moves the
          version on with a single compare-and-set statement before it changes
          the ranking, so of several saves made from one version only one is
          accepted. The others get <code>409 Conflict</code> with the current
          version; the page reads the candidates again, keeps what the
          instructor typed in its box and offers <em>Save again</em>. The
          candidates are read after the version, so a change in between can only
          make a save refused, never wrongly accepted. Only someone who may rank
          the course (its instructor while reviews are Open) may heartbeat or
          say goodbye for <code>ranking:&lt;recruitmentCourseId&gt;</code>: an
          instructor of another course, or an admin who does not teach the
          course, gets <code>403</code> and is neither recorded nor told who is
          there.
        </p>
        <p>Where the version check and the warning are used so far:</p>
        <Table
          striped
          bordered
          size="sm"
          data-testid="HelpDeveloperPage-simultaneous-table"
        >
          <thead>
            <tr>
              <th>Page</th>
              <th>Scope</th>
              <th>Key</th>
              <th>PR</th>
            </tr>
          </thead>
          <tbody>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-draft">
              <td>Application form draft</td>
              <td>One applicant&apos;s draft for one recruitment</td>
              <td>
                <code>draft:&lt;draftId&gt;</code>
              </td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/283"
                  target="_blank"
                  rel="noreferrer"
                >
                  #283
                </a>
                {", "}
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/285"
                  target="_blank"
                  rel="noreferrer"
                >
                  #285
                </a>
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-state">
              <td>
                Recruitment settings and steps, for admins, instructors and
                students
              </td>
              <td>
                Background refresh; no warning, no version check, no detector
              </td>
              <td>None (refresh, not a key)</td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/286"
                  target="_blank"
                  rel="noreferrer"
                >
                  #286
                </a>
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-ranking">
              <td>Faculty rankings</td>
              <td>One recruitment course&apos;s ranking list</td>
              <td>
                <code>ranking:&lt;recruitmentCourseId&gt;</code>
              </td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/287"
                  target="_blank"
                  rel="noreferrer"
                >
                  #287
                </a>
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-application">
              <td>
                Student apply page when editing a submitted application, and the
                Admin application edit page
              </td>
              <td>One application, edited by its applicant or by an admin</td>
              <td>
                <code>application:&lt;applicationId&gt;</code>
              </td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/308"
                  target="_blank"
                  rel="noreferrer"
                >
                  #308
                </a>
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-assignments">
              <td>Assignments (admin)</td>
              <td>The whole assignments page for one recruitment</td>
              <td>
                <code>assignments:&lt;recruitmentId&gt;</code>
              </td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/289"
                  target="_blank"
                  rel="noreferrer"
                >
                  #289
                </a>
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-budget">
              <td>Budget</td>
              <td>
                One quarter&apos;s budget (compare-and-set for a
                recruitment&apos;s hiring target, keyed{" "}
                <code>recruitment:&lt;id&gt;</code>)
              </td>
              <td>
                <code>budget:&lt;quarter&gt;</code>
              </td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/290"
                  target="_blank"
                  rel="noreferrer"
                >
                  #290
                </a>
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-courses-edit">
              <td>
                Courses edit page (Populate, Remove, visibility; the allocations
                and estimated enrollments are edited under this key from the
                Combined Allocation page); the view-only page never warns
              </td>
              <td>The whole edit page for one recruitment</td>
              <td>
                <code>courses-edit:&lt;recruitmentId&gt;</code>
              </td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/288"
                  target="_blank"
                  rel="noreferrer"
                >
                  #288
                </a>
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-combined">
              <td>
                Combined Allocation page (allocations and estimates of both
                recruitments of a quarter)
              </td>
              <td>
                The Courses edit page of every recruitment of the quarter: one
                heartbeat per recruitment under that page&apos;s key, with one
                client id, so the combined page and the edit pages warn each
                other
              </td>
              <td>
                <code>courses-edit:&lt;recruitmentId&gt;</code> (one per
                recruitment)
              </td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/373"
                  target="_blank"
                  rel="noreferrer"
                >
                  #373
                </a>
              </td>
            </tr>
            <tr data-testid="HelpDeveloperPage-simultaneous-row-admin-pages">
              <td>Instructors page and the view-only Courses page</td>
              <td>
                Background refresh plus a refetch after each save; no warning,
                no version check, no detector
              </td>
              <td>None (refresh, not a key)</td>
              <td>
                <a
                  href="https://github.com/ucsb-cs156/proj-ta-apply/pull/291"
                  target="_blank"
                  rel="noreferrer"
                >
                  #291
                </a>
              </td>
            </tr>
          </tbody>
        </Table>
      </div>
    </BasicLayout>
  );
}
