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
