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
      </div>
    </BasicLayout>
  );
}
