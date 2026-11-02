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
          exactly as the <em>Auto assign allocations</em> button does. A
          checkbox, ticked by default, also sets allocation visibility to{" "}
          <strong>Faculty see their own courses</strong>, recorded in the change
          history like any other visibility change.
        </p>
        <p data-testid="HelpDeveloperPage-fake-rankings">
          While developer mode is on, the footer of a recruitment&apos;s Courses
          page also has a <strong>Create Fake Rankings</strong> button, enabled
          only while faculty ranking is open. It launches a job that ranks
          candidates as the faculty would, for every course that has no rankings
          yet or for a random part of them. Each course gets as many interested
          candidates as its ranking target asks for, and a checkbox also ranks
          one or two applicants who did not express interest. Courses that
          already have rankings are never changed.
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
          <code>docs/design/ConcurrentEditMitigationDesign.md</code>. Only the
          draft application form and the Courses edit page use either so far.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-version">
          <strong>The version check.</strong> A saved thing carries an integer{" "}
          <code>version</code> that starts at 1. A save sends the version the
          copy last saw. If it still matches, the server saves and counts a new
          version, in one atomic step (JPA optimistic locking), and answers with
          it. If not, nothing is changed and the answer is{" "}
          <code>409 Conflict</code> with the draft as it now stands. The form
          then stops saving, says so, and offers <em>Reload</em>.
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
          <code>{`{"others": [{"label", "samePerson"}], "heartbeatSeconds", "newest", "arrivedAtMillis"}`}</code>
          : one entry for each other <em>person</em>, however many tabs they
          have open, with <code>samePerson</code> true for the user&apos;s own
          other tabs. Names are in the body and not in headers because they are
          not always ASCII and can be long. A label is cut to 200 characters. In
          the browser a pure function composes the sentence (&quot;You are also
          editing this application in another tab or window.&quot;,
          &quot;phtcon@ucsb.edu (Phill Conrad) is also editing this
          application.&quot;, and so on, three people named and the rest
          counted) and the banner shows it as text, never as markup.
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
          and no names in the answer. Every future use must make the same check
          first.
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
          says goodbye at <code>/leave</code>, names itself in the{" "}
          <code>X-Client-Id</code> header of the allocation, estimate and Auto
          Allocate saves, and shows the banner and the modal with the noun
          &quot;page&quot;; <em>Leave this page</em> goes to the view-only page.
          Only an admin may heartbeat, and the recruitment must exist, before
          anything is recorded. The version check is not a JPA version, since
          the course refresh and the estimates also write the row: a separate{" "}
          <code>allocation_version</code> column on{" "}
          <code>recruitment_courses</code> is counted by each allocation edit,
          and <code>allocation_bulk_version</code> on <code>recruitments</code>{" "}
          is counted by Auto Allocate. An allocation edit sends both as{" "}
          <code>expectedVersion</code> and <code>expectedBulkVersion</code> and
          gets <code>409</code> when either moved; after a bulk conflict the
          page reads everything again.
        </p>
        <p data-testid="HelpDeveloperPage-simultaneous-refresh">
          <strong>Other pages.</strong> Not every page will get a warning.
          Recruitment state, and the Instructors and non-allocation Courses page
          saves, are planned to be kept fresh by a <em>refresh</em> instead
          (issues #281 and #282): a refetch after each save and a background
          refresh without a page reload, paused in hidden tabs. Each refresh
          waits a freshly drawn random time, between the base minus the jitter
          and the base plus the jitter, so clients do not synchronize. The
          planned settings, all environment variables, are{" "}
          <code>ADMIN_REFRESH_SEC=5</code> and{" "}
          <code>ADMIN_REFRESH_JITTER=3</code> (2 to 8 seconds, for admins) and{" "}
          <code>NON_ADMIN_REFRESH=15</code> and <code>NON_ADMIN_JITTER=5</code>{" "}
          (10 to 20 seconds, for instructors and students).{" "}
          <em>This is not implemented yet.</em>
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
            <tr data-testid="HelpDeveloperPage-simultaneous-row-courses-edit">
              <td>
                Courses edit page (allocations and estimated enrollments); the
                view-only page never warns
              </td>
              <td>The whole edit page for one recruitment</td>
              <td>
                <code>courses-edit:&lt;recruitmentId&gt;</code>
              </td>
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
          </tbody>
        </Table>
      </div>
    </BasicLayout>
  );
}
