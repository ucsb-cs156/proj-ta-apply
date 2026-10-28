import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import NameListCard from "main/components/AppSettings/NameListCard";

/** The admin-maintained lists behind the ULA application form: /admin/settings/ula */
export default function UlaAppSettingsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>ULA App Settings</h1>
        <p>
          The lists a ULA applicant chooses from. Changes take effect
          immediately; they do not alter applications already submitted.
        </p>
        <NameListCard
          title="Majors List for ULAs"
          itemLabel="major"
          listKey="ula-majors"
          testIdPrefix="UlaAppSettingsPage-majors"
        />
        <NameListCard
          title="Topics List for ULAs"
          itemLabel="topic"
          listKey="ula-topics"
          testIdPrefix="UlaAppSettingsPage-topics"
        />
      </div>
    </BasicLayout>
  );
}
