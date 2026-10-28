import { useEffect } from "react";
import { useLocation } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { Accordion } from "react-bootstrap";
import csvFixtures from "fixtures/csvFixtures";

export default function HelpCsvPage() {
  const location = useLocation();

  // Links from the admin pages point at a section (#settings-lists); scroll to it on arrival.
  // Stryker disable all : the hash never changes while the page is mounted in a test, so the
  // dependency list cannot be told apart from an empty one; the behaviour itself is tested.
  useEffect(() => {
    if (!location.hash) return;
    const element = document.getElementById(location.hash.slice(1));
    if (element) {
      element.scrollIntoView();
    }
  }, [location.hash]);
  // Stryker restore all

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1 className="my-4">CSV Upload/Download Formats</h1>

        <h2 className="my-4">Email List CSV Upload formats</h2>
        <p>
          Admins can bulk-upload email addresses from a CSV file on the Grad
          Students and Instructors admin pages. Both uploads use the same
          format; click on each one below for details and an example.
        </p>
        <p>
          In both cases, the file must have a header row containing a column
          named <code>email</code> (the header name is case-insensitive); any
          additional columns are ignored. Each row is processed independently:
          an address that is already on the list is skipped rather than reported
          as an error, and a malformed row is skipped and reported rather than
          aborting the rows that already succeeded. Re-uploading the same file
          is therefore safe.
        </p>
        <Accordion data-testid="emailUploadsAccordion">
          <Accordion.Item eventKey="0">
            <Accordion.Header>Grad Student Emails</Accordion.Header>
            <Accordion.Body>
              <p>
                On the <i>Grad Students</i> admin page, admins can upload a CSV
                of grad student email addresses. Each address uploaded is
                permitted to log in as a grad student and apply for TA
                positions. Here is an example file:
              </p>
              <pre className="csvExample" data-testid="gradStudentCsvExample">
                {csvFixtures.gradStudentEmails}
              </pre>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>Instructor Emails</Accordion.Header>
            <Accordion.Body>
              <p data-testid="instructorCsvDescription">
                On the <i>Instructors</i> admin page, admins can upload a CSV of
                instructor email addresses. Each address uploaded is permitted
                to log in as an instructor and review applications for their own
                courses. Here is an example file (note that the{" "}
                <code>name</code> column is ignored; only the <code>email</code>{" "}
                column is used):
              </p>
              <pre className="csvExample" data-testid="instructorCsvExample">
                {csvFixtures.instructorEmails}
              </pre>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <h2 className="my-4" id="settings-lists">
          App Settings Lists CSV formats (Majors and Topics)
        </h2>
        <p data-testid="settingsListsDescription">
          On the <i>TA App Settings</i> and <i>ULA App Settings</i> admin pages,
          each of the four lists (TA majors, TA topics, ULA majors, ULA topics)
          can be downloaded as a CSV file and filled from one. The two use the
          same shape, so a list set up on a QA site can be downloaded there and
          uploaded unchanged to production.
        </p>
        <Accordion data-testid="settingsListsAccordion">
          <Accordion.Item eventKey="0">
            <Accordion.Header>Download format</Accordion.Header>
            <Accordion.Body>
              <p>
                The download has a header row and one column, <code>name</code>,
                with one name per row in the order the list is shown. Every
                value is quoted, so a name containing a comma survives the trip.
                Here is an example:
              </p>
              <pre
                className="csvExample"
                data-testid="settingsDownloadCsvExample"
              >
                {csvFixtures.settingsNames}
              </pre>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>Upload format</Accordion.Header>
            <Accordion.Body>
              <p data-testid="settingsUploadDescription">
                The upload accepts the download format as is. It also accepts
                less: the header row must contain a column named{" "}
                <code>name</code> (the header name is case-insensitive), other
                columns are ignored, quoting is optional, surrounding whitespace
                is trimmed, blank rows are skipped, and a name already in the
                list is skipped rather than reported as an error, so
                re-uploading a file is safe. Here is an example file that is
                accepted:
              </p>
              <pre
                className="csvExample"
                data-testid="settingsUploadCsvExample"
              >
                {csvFixtures.settingsNamesLenient}
              </pre>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <h2 className="my-4">CSV Download formats</h2>
        <p data-testid="downloadsSummary">
          The only CSV downloads currently offered are the App Settings lists
          described above. This section will be updated as download features are
          added.
        </p>
      </div>
    </BasicLayout>
  );
}
