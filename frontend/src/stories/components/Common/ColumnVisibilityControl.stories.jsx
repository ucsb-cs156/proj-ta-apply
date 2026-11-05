import React, { useState } from "react";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import { columnChoices } from "main/utils/courseColumns";

export default {
  title: "components/Common/ColumnVisibilityControl",
  component: ColumnVisibilityControl,
};

const Interactive = ({ initiallyHidden, showRankings, summer }) => {
  const [hidden, setHidden] = useState(initiallyHidden);
  return (
    <ColumnVisibilityControl
      choices={columnChoices(showRankings, summer)}
      hidden={hidden}
      onToggle={(id, isHidden) =>
        setHidden((previous) =>
          isHidden
            ? [...previous, id]
            : previous.filter((other) => other !== id),
        )
      }
    />
  );
};

export const NothingHidden = () => (
  <Interactive initiallyHidden={[]} showRankings={false} summer={false} />
);

export const TwoHiddenSummerWithRankings = () => (
  <Interactive
    initiallyHidden={["room", "days"]}
    showRankings={true}
    summer={true}
  />
);

export const AllHidden = () => (
  <Interactive
    initiallyHidden={columnChoices(false, false).map((c) => c.id)}
    showRankings={false}
    summer={false}
  />
);

// Issue #343: on the Assignments page the menu also offers Show All Courses and Show Only
// Incomplete Courses. course-1 is incomplete; course-2 is exactly at its target; course-3 is over.
const assignmentChoices = [
  { id: "email", label: "Email" },
  { id: "course-1", label: "CMPSC 8 (0100)" },
  { id: "course-2", label: "CMPSC 16 (0100)" },
  { id: "course-3", label: "CMPSC 24 (0100)" },
];
const courseColumns = [
  { id: "course-1", complete: false },
  { id: "course-2", complete: true },
  { id: "course-3", complete: true },
];

const AssignmentsInteractive = ({ initiallyHidden }) => {
  const [hidden, setHidden] = useState(initiallyHidden);
  return (
    <ColumnVisibilityControl
      choices={assignmentChoices}
      courseColumns={courseColumns}
      hidden={hidden}
      onToggle={(id, isHidden) =>
        setHidden((previous) =>
          isHidden
            ? [...previous, id]
            : previous.filter((other) => other !== id),
        )
      }
    />
  );
};

export const AssignmentsPageWithCourseActions = () => (
  <AssignmentsInteractive initiallyHidden={[]} />
);

export const AssignmentsPageIncompleteOnly = () => (
  <AssignmentsInteractive initiallyHidden={["course-2", "course-3"]} />
);
