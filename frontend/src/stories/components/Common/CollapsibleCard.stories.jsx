import React from "react";
import CollapsibleCard from "main/components/Common/CollapsibleCard";

export default {
  title: "components/Common/CollapsibleCard",
  component: CollapsibleCard,
};

// Each story clears its own remembered setting, so it always starts as a first visit would.
const Fresh = ({ storageKey, open, subtitle }) => {
  const key = `collapsibleCard.${storageKey}`;
  if (open) {
    localStorage.setItem(key, "open");
  } else {
    localStorage.removeItem(key);
  }
  return (
    <CollapsibleCard
      title="Change History"
      subtitle={subtitle}
      storageKey={storageKey}
    >
      <p>Every change to this recruitment itself, newest first.</p>
    </CollapsibleCard>
  );
};

export const Closed = () => <Fresh storageKey="story-closed" open={false} />;

export const Open = () => <Fresh storageKey="story-open" open={true} />;

/** Issue #391: a smaller line beneath the title, on the header. */
export const WithSubtitle = () => (
  <Fresh
    storageKey="story-subtitle"
    open={false}
    subtitle="Track changes to hiring targets"
  />
);
