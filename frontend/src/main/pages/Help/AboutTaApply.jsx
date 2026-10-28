import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { Accordion } from "react-bootstrap";

export default function AboutTaApply() {
  return (
    <BasicLayout>
      <div className="pt-2">
        <h1 className="my-4">About proj-ta-apply</h1>
        <p>Proj-ta-apply allows:</p>
        <ul>
          <li>
            Admins (typically the Student Affairs Manager and/or the ULA program
            directors) to open application periods for TA and ULA applications
          </li>
          <li>Students to apply for TA and ULA positions</li>
          <li>
            Faculty to review and rank TA and/or ULA applicants for their own
            courses
          </li>
          <li>
            Admins to make assignments to final positions based on student
            applications and faculty rankings.
          </li>
        </ul>

        <h2 className="my-4">Key Features</h2>

        <p>
          Here are some value added features over using basic tools such as a
          Google Form. More information is available about the features for
          various types of users by clicking on the roles below.
        </p>
        <Accordion>
          <Accordion.Item eventKey="0">
            <Accordion.Header>For students</Accordion.Header>
            <Accordion.Body>
              <ul>
                <li>
                  The application keeps track of past applications so that
                  information does not need to be entered &quot;from
                  scratch&quot;; instead, students can just update their
                  previous applications.
                </li>
              </ul>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>For admins</Accordion.Header>
            <Accordion.Body>
              <ul>
                <li>
                  The application can pull information from the UCSB Registrar
                  API to populate a list of courses being offered in a
                  particular quarter, so that information about course
                  preferences on the application is relevant.
                </li>
                <li>
                  Admins can select which courses are hiring for TAs and or ULAs
                  separately.
                </li>
              </ul>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="2">
            <Accordion.Header>For faculty</Accordion.Header>
            <Accordion.Body>
              <ul>
                <li>
                  Faculty are shown only the applications that are relevant for
                  the courses they are teaching, rather than having to navigate
                  through many tabs on a spreadsheet.
                </li>
              </ul>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </div>
    </BasicLayout>
  );
}
