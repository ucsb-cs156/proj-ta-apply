import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import AskForFeedbackCard from "main/components/InstructorFeedbackSettings/AskForFeedbackCard";
import FeedbackNotesEditorCard from "main/components/InstructorFeedbackSettings/FeedbackNotesEditorCard";

/**
 * What instructors are shown around their allocation feedback form (issue #429):
 * /admin/instructorFeedbackSettings. A card per setting: whether instructors are asked for feedback
 * at all (issue #430), then the notes on TA/ULA tradeoffs.
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
        <AskForFeedbackCard testIdPrefix="InstructorFeedbackSettingsPage-ask" />
        <FeedbackNotesEditorCard testIdPrefix="InstructorFeedbackSettingsPage-notes" />
      </div>
    </BasicLayout>
  );
}
