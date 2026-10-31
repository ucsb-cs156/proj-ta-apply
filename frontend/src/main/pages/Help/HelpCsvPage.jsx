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
          Admins can bulk-upload email addresses from a CSV file on the
          Instructors admin page. Click below for details and an example.
        </p>
        <p data-testid="emailUploadsIntro">
          The file must have a header row containing a column named{" "}
          <code>email</code> (the header name is case-insensitive); a file with
          just that column is enough. Each row is processed independently: an
          address that is already on the list is skipped rather than reported as
          an error, and a malformed row is skipped and reported rather than
          aborting the rows that already succeeded. Re-uploading the same file
          is therefore safe.
        </p>
        <Accordion data-testid="emailUploadsAccordion">
          <Accordion.Item eventKey="1">
            <Accordion.Header>Instructor Emails</Accordion.Header>
            <Accordion.Body>
              <p data-testid="instructorCsvDescription">
                On the <i>Instructors</i> admin page, admins can upload a CSV of
                instructors. Each address uploaded is permitted to log in as an
                instructor and review applications for their own courses. A{" "}
                <code>catalogName</code> column, when present, sets each
                instructor&apos;s catalog name (including for an instructor
                already on the list) when the value is a name on record, one the
                Populate Courses job has seen; other columns, such as{" "}
                <code>firstName</code> and <code>lastName</code>, are accepted
                but ignored, since names come from the users table when the
                instructor first logs in. Here is an example file:
              </p>
              <pre className="csvExample" data-testid="instructorCsvExample">
                {csvFixtures.instructorEmails}
              </pre>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <h2 className="my-4" id="settings-lists">
          App Settings Lists CSV formats (Majors, Topics and Interests)
        </h2>
        <p data-testid="settingsListsDescription">
          On the <i>TA App Settings</i> and <i>ULA App Settings</i> admin pages,
          each of the five lists (TA majors, TA topics, ULA majors, ULA topics,
          ULA interests) can be downloaded as a CSV file and filled from one.
          All use the same shape, so a list set up on a QA site can be
          downloaded there and uploaded unchanged to production.
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

        <h2 className="my-4" id="legacy-ta-applications">
          Legacy TA Applications CSV upload format
        </h2>
        <p data-testid="legacyImportDescription">
          On the <i>TA App Settings</i> admin page, the{" "}
          <i>Import Legacy TA Applications</i> card takes the old PHP TA
          application&apos;s database export and a quarter, and creates one
          application per row in that quarter&apos;s TA recruitment, as if the
          student had entered it. A student who applied through the old app then
          finds their next application already filled in with those answers. The
          recruitment must exist first (create it under <i>Recruitments</i>); a
          row whose email already has an application in it is skipped, so
          re-uploading is safe, and a row without a usable email is skipped and
          reported.
        </p>
        <Accordion data-testid="legacyImportAccordion">
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              How the legacy columns are matched
            </Accordion.Header>
            <Accordion.Body>
              <p data-testid="legacyImportMapping">
                The file must have a header row with at least <code>email</code>
                , <code>first_name</code> and <code>last_name</code>; the other
                legacy columns are used when present and ignored when not.
                Names, GPAs, year, graduation date, residency status, language
                exam and class level map to the matching fields; <code>CS</code>{" "}
                as a major means Computer Science. <code>coursework_ucsb</code>{" "}
                (<code>course:grade</code>), <code>coursework_other</code> (
                <code>title:school:equivalent UCSB course</code>) and{" "}
                <code>coursework_290</code> (
                <code>description:instructor:grade</code>) become rows of the
                prior coursework table; <code>knowledge</code> (
                <code>topic:rating</code>) becomes topic proficiencies, named as
                the TA topics list spells them when they match, and a topic the
                list does not have is added to it (the import reports which);{" "}
                <code>prev_experience</code> becomes one line per course; the
                desired courses become enthusiastic interest in each course the
                recruitment lists. Preferred job and hours, and desired courses
                the recruitment does not list, are kept in the applicant&apos;s
                comments; the submission dates and reviewer comments go into the
                admin comments. Here is an example with one row:
              </p>
              <pre className="csvExample" data-testid="legacyImportCsvExample">
                {csvFixtures.legacyTaApplications}
              </pre>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <h2 className="my-4" id="legacy-ula-applications">
          ULA Form Responses CSV upload format
        </h2>
        <p data-testid="legacyUlaImportDescription">
          On the <i>ULA App Settings</i> admin page, the{" "}
          <i>Import ULA Form Responses</i> card takes the ULA application Google
          Form&apos;s &quot;Form Responses&quot; sheet, downloaded as CSV, and a
          quarter, and creates one application per row in that quarter&apos;s
          ULA recruitment, as if the student had entered it. The recruitment
          must exist first; a row whose email already has an application in it
          is skipped, so re-uploading is safe, and a row without a usable email
          is skipped and reported. Columns are found by the start of their
          question text, so both the form&apos;s original headers and the
          condensed ones in{" "}
          <code>docs/sample-data/legacy-ula-csv-example.csv</code> are accepted.
        </p>
        <Accordion data-testid="legacyUlaImportAccordion">
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              How the form&apos;s columns are matched
            </Accordion.Header>
            <Accordion.Body>
              <p data-testid="legacyUlaImportMapping">
                The file must have <code>Email Address</code>,{" "}
                <code>First name</code> and <code>Last name</code>; the other
                questions are used when present. The perm number, expected
                graduation, BS/MS answers, prior-employment answers (the
                employee ID only when it is a number), previous LA service
                (&quot;More than 6&quot; reads as 7), training commitment and
                explanation, GPA (as Overall GPA), major (matched to the ULA
                majors list, <code>CMPSC (Computer Science)</code> becoming
                Computer Science), changing major and video link map to the
                matching fields. The course-preference grid becomes Enthusiastic
                or Would Consider interest in each course the recruitment lists
                (Not Applicable is dropped); First and Second Choice become the
                two choices when the recruitment lists them, otherwise a note in
                the comments; the lecture and section availability answers
                become yes/no, with &quot;Only one per week&quot; noted in the
                availability comments. The familiarity grids become topic
                proficiencies and the activity grid becomes interests, named as
                the ULA lists spell them when a name matches (
                <code>CSIL computing environment</code> matches{" "}
                <code>CSIL</code>); a name the lists lack is added to them, and
                the import reports which. A free-text answer to the
                TA-eligibility question goes into the applicant&apos;s comments;
                the timestamp goes into the admin comments. Here is an example
                with a few of the columns and one row:
              </p>
              <pre
                className="csvExample"
                data-testid="legacyUlaImportCsvExample"
              >
                {csvFixtures.legacyUlaResponses}
              </pre>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <h2 className="my-4">CSV Download formats</h2>
        <p data-testid="instructorsDownloadDescription">
          The <i>Instructors</i> admin page offers a{" "}
          <b>Download Instructors (CSV)</b> button that saves the whole list:
          columns <code>email</code>, <code>firstName</code>,{" "}
          <code>lastName</code> and <code>catalogName</code>, with a header row
          and every cell quoted. The upload accepts this shape, so the list can
          be moved from one deployment to another; the name columns are blank
          for an instructor who has not logged in yet.
        </p>
        <p data-testid="rankingsCsvDescription">
          <b>Download Rankings CSV</b> on a recruitment card saves the faculty
          rankings: the applicant identity columns for the recruitment&apos;s
          type, then <code>tentativeAssignment</code> (the lecture the admin has
          pencilled the applicant into on the Assignments page, written as the
          lecture&apos;s column heading, blank if none), then one column per
          lecture headed <code>COURSE (section S, enroll E)</code> holding that
          lecture&apos;s rank for the applicant. Directly under the header come
          three planning rows labelled <code>Allocation</code>,{" "}
          <code>Assigned</code> and <code>Left to assign</code> in the first
          column, with each lecture&apos;s numbers under its column and every
          other cell blank; applicant rows follow. Test applications are left
          out; the full layout is described on the For Admins help page.
        </p>
        <p data-testid="assignmentsCsvDescription">
          Once a recruitment&apos;s assignments are published, the assignments
          page offers two downloads of the same table it shows, header row first
          and every cell quoted. <b>Download CSV (row per course)</b> has{" "}
          <code>Course</code> (for example <code>CMPSC 8</code>),{" "}
          <code>Instructor</code>, <code>Instructor email</code> (
          <code>Not mapped</code> when no single instructor record has that
          catalog name), then one column per assigned person headed{" "}
          <code>TA</code> or <code>ULA</code> holding{" "}
          <code>First Last (email)</code>; there are as many of those columns as
          the fullest course needs, and courses with nobody assigned are still
          listed. <b>Download CSV (row per student)</b> has{" "}
          <code>First name</code>, <code>Last name</code>, <code>Email</code>,{" "}
          <code>Course assignment</code>, <code>Course instructor</code>,{" "}
          <code>Course instructor email</code> and, for a ULA recruitment,{" "}
          <code>First time ULA</code> (<code>yes</code> when the applicant
          reported no previous quarters as a ULA). Only real, uncancelled
          applicants with an assignment are included.
        </p>
        <p data-testid="downloadsSummary">
          Besides the App Settings lists described above, the{" "}
          <i>Recruitments</i> admin page offers a <b>CSV</b> button per
          recruitment that downloads every application to it, one row per
          application, with a header row and every cell quoted. Test
          applications are included, flagged in the <code>testApplication</code>{" "}
          column.
        </p>
        <p data-testid="applicationsCsvDescription">
          The columns differ by recruitment type: a TA file has{" "}
          <code>classLevel</code>, <code>residencyStatus</code>,{" "}
          <code>languageExam</code> and <code>languageExamDatePassed</code>; a
          ULA file has <code>previousServiceAsUla</code>, <code>videoLink</code>
          , the ULA questions from the old Google Form (<code>permNumber</code>,{" "}
          <code>bsMsStudent</code>, <code>studentStatusNextQuarter</code>,{" "}
          <code>wantsTaEligibility</code>, <code>otherCampusJob</code>,{" "}
          <code>priorUcsbEmployment</code>, <code>employeeId</code>,{" "}
          <code>i9Appointment</code>, <code>trainingCommitment</code>,{" "}
          <code>trainingCommitmentExplanation</code>, <code>changingMajor</code>
          ), the six lecture and section availability columns (only the ULA form
          asks about availability) and, last, <code>interests</code>. Answers
          that are lists are folded into one column each:{" "}
          <code>priorCoursework</code> holds each course&apos;s school (
          <code>UCSB</code> or the other school&apos;s name), number, title,
          term and grade separated by commas, with the courses separated by
          semicolons, for example{" "}
          <code>
            UCSB,CMPSC 130A,Data Structures,F25,A;De Anza College,CIS 22A,Intro
            to C,Fall 2023,
          </code>
          ; <code>topicProficiencies</code>, <code>interests</code> and{" "}
          <code>courseInterests</code> hold <code>name:value</code> pairs
          separated by commas, in name order, for example{" "}
          <code>C++:5,Java:4</code>.
        </p>
      </div>
    </BasicLayout>
  );
}
