import React, { useState } from "react";
import { HttpResponse, http } from "msw";
import BulkUcsbCoursesModal from "main/components/PriorCoursework/BulkUcsbCoursesModal";
import PriorCourseworkSection from "main/components/PriorCoursework/PriorCourseworkSection";
import PriorCourseworkModal from "main/components/PriorCoursework/PriorCourseworkModal";
import PriorCourseworkTable from "main/components/PriorCoursework/PriorCourseworkTable";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";
import coursesFixtures from "fixtures/coursesFixtures";

export default {
  title: "components/PriorCoursework/PriorCourseworkSection",
  component: PriorCourseworkSection,
  parameters: {
    // Add Multiple UCSB CMPSC Courses lists the course table (issue #100).
    msw: {
      handlers: [
        http.get("/api/courses/all", () =>
          HttpResponse.json(coursesFixtures.threeCourses),
        ),
      ],
    },
  },
};

/** The whole thing, holding its own rows so Add / Edit / Delete work in the story. */
const Interactive = (args) => {
  const [courses, setCourses] = useState(args.courses ?? []);
  return (
    <PriorCourseworkSection {...args} courses={courses} onChange={setCourses} />
  );
};

export const EmptyTa = Interactive.bind({});
EmptyTa.args = { type: "TA" };

export const ThreeCoursesTa = Interactive.bind({});
ThreeCoursesTa.args = {
  type: "TA",
  courses: priorCourseworkFixtures.threeCourses,
};

export const EmptyUla = Interactive.bind({});
EmptyUla.args = { type: "ULA" };

/** After a submit attempt with too few courses. */
export const TooFew = Interactive.bind({});
TooFew.args = {
  type: "TA",
  courses: [priorCourseworkFixtures.ucsbCourse],
  invalid: true,
};

export const ModalAdding = () => (
  <PriorCourseworkModal
    show={true}
    course={null}
    onSave={(course) => console.log("save", course)}
    onCancel={() => console.log("cancel")}
  />
);

export const ModalEditingACourseTakenElsewhere = () => (
  <PriorCourseworkModal
    show={true}
    course={priorCourseworkFixtures.elsewhere}
    onSave={(course) => console.log("save", course)}
    onCancel={() => console.log("cancel")}
  />
);

/** Several UCSB courses at once, from the course table the admin populated (issue #100). */
export const BulkAddModal = () => (
  <BulkUcsbCoursesModal
    show={true}
    onAdd={(courses) => console.log("add", courses)}
    onCancel={() => console.log("cancel")}
  />
);

export const ReadOnlyTable = () => (
  <PriorCourseworkTable
    courses={priorCourseworkFixtures.threeCourses}
    onEdit={() => {}}
    onDelete={() => {}}
    readOnly
  />
);
