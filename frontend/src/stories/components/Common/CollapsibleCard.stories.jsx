import React from "react";
import CollapsibleCard from "main/components/Common/CollapsibleCard";

export default {
  title: "components/Common/CollapsibleCard",
  component: CollapsibleCard,
};

// Each story clears its own remembered setting, so it always starts as a first visit would.
const Fresh = ({ storageKey, open }) => {
  const key = `collapsibleCard.${storageKey}`;
  if (open) {
    localStorage.setItem(key, "open");
  } else {
    localStorage.removeItem(key);
  }
  return (
    <CollapsibleCard title="Change History" storageKey={storageKey}>
      <p>Every change to this recruitment itself, newest first.</p>
    </CollapsibleCard>
  );
};

export const Closed = () => <Fresh storageKey="story-closed" open={false} />;

export const Open = () => <Fresh storageKey="story-open" open={true} />;
