import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { Accordion } from "react-bootstrap";
import csvFixtures from "fixtures/csvFixtures";

export default function HelpCsvPage() {
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
              <p>
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

        <h2 className="my-4">CSV Download formats</h2>
        <p>
          The app does not currently offer any CSV downloads. This section will
          be updated as download features are added.
        </p>
      </div>
    </BasicLayout>
  );
}
