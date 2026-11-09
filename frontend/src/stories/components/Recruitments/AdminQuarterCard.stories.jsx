import React from "react";
import { Card } from "react-bootstrap";
import AdminQuarterCard, {
  QUARTER_CARD_STORAGE_PREFIX,
} from "main/components/Recruitments/AdminQuarterCard";

/**
 * The card remembers its state in localStorage, so each story first forgets what an earlier story
 * left, and starts from its own default.
 */
const forgetQuarterCards = (Story) => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(QUARTER_CARD_STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
  return <Story />;
};

export default {
  title: "components/Recruitments/AdminQuarterCard",
  component: AdminQuarterCard,
  decorators: [forgetQuarterCards],
};

/** Stands in for the quarter's nested recruitment cards. */
const placeholder = (
  <Card className="mb-3">
    <Card.Body className="text-muted">
      The quarter&apos;s TA and ULA recruitment cards are nested here.
    </Card.Body>
  </Card>
);

const Template = (args) => (
  <AdminQuarterCard {...args}>{placeholder}</AdminQuarterCard>
);

/**
 * Open, with both a TA and a ULA recruitment: the row is headed W26 with a caret, and the buttons
 * are Budget Planning, "Allocate TA and ULA slots to Courses", which opens the quarter's
 * Combined Allocation page, /admin/allocations/QXX (issue #358), and Instructor Feedback, which
 * opens /admin/instructorFeedback/QXX (issue #427). Clicking the row (anywhere but
 * the buttons) closes the card; clicking a button navigates and leaves the card open.
 */
export const Open = Template.bind({});
Open.args = {
  quarter: "20261",
  ta: { id: 1 },
  ula: { id: 2 },
  defaultOpen: true,
};

/** Closed, as an older quarter starts: the row and its buttons only; the nested cards are not rendered. */
export const Closed = Template.bind({});
Closed.args = { quarter: "20254", ta: { id: 1 }, ula: { id: 2 } };

/** Only a TA recruitment: the button says "Allocate TA slots to Courses". */
export const TaOnly = Template.bind({});
TaOnly.args = { quarter: "20262", ta: { id: 3 }, defaultOpen: true };

/** Only a ULA recruitment: the button says "Allocate ULA slots to Courses". */
export const UlaOnly = Template.bind({});
UlaOnly.args = { quarter: "20261", ula: { id: 2 }, defaultOpen: true };

/** Neither (the home page never shows this): the button is greyed out. */
export const Neither = Template.bind({});
Neither.args = { quarter: "20264", defaultOpen: true };
