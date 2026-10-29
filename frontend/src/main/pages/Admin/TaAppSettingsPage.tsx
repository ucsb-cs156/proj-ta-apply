import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import NameListCard from "main/components/AppSettings/NameListCard";
import NoticeEditorCard from "main/components/Notices/NoticeEditorCard";
import LegacyApplicationsUploadCard from "main/components/Applications/LegacyApplicationsUploadCard";

/** The admin-maintained lists behind the TA application form: /admin/settings/ta */
export default function TaAppSettingsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>TA App Settings</h1>
        <p>
          The lists a TA applicant chooses from. Changes take effect
          immediately; they do not alter applications already submitted.
        </p>
        <NameListCard
          title="Majors List for TAs"
          itemLabel="major"
          listKey="ta-majors"
          testIdPrefix="TaAppSettingsPage-majors"
        />
        <NameListCard
          title="Topics List for TAs"
          itemLabel="topic"
          listKey="ta-topics"
          testIdPrefix="TaAppSettingsPage-topics"
        />
        <NoticeEditorCard type="TA" testIdPrefix="TaAppSettingsPage-notices" />
        <LegacyApplicationsUploadCard testIdPrefix="TaAppSettingsPage-legacy" />
      </div>
    </BasicLayout>
  );
}
