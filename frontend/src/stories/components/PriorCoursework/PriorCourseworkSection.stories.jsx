import React, { useState } from "react";
import PriorCourseworkSection from "main/components/PriorCoursework/PriorCourseworkSection";
import PriorCourseworkModal from "main/components/PriorCoursework/PriorCourseworkModal";
import PriorCourseworkTable from "main/components/PriorCoursework/PriorCourseworkTable";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";

export default {
  title: "components/PriorCoursework/PriorCourseworkSection",
  component: PriorCourseworkSection,
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

export const ReadOnlyTable = () => (
  <PriorCourseworkTable
    courses={priorCourseworkFixtures.threeCourses}
    onEdit={() => {}}
    onDelete={() => {}}
    readOnly
  />
);
