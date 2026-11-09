import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import FeedbackNotesEditorCard from "main/components/InstructorFeedbackSettings/FeedbackNotesEditorCard";

/**
 * What instructors are shown around their allocation feedback form (issue #429):
 * /admin/instructorFeedbackSettings. Today the notes on TA/ULA tradeoffs; the page has room for
 * other settings of the same form, each a card.
 */
export default function InstructorFeedbackSettingsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Instructor Feedback Settings</h1>
        <p>
          What instructors see around the form on their home page where they
          give feedback on their courses&apos; TA and ULA allocations. Changes
          take effect immediately.
        </p>
        <FeedbackNotesEditorCard testIdPrefix="InstructorFeedbackSettingsPage-notes" />
      </div>
    </BasicLayout>
  );
}
