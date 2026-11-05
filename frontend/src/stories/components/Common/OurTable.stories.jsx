import OurTable, { ButtonColumn } from "main/components/Common/OurTable";
import ourTableFixtures from "fixtures/ourTableFixtures";

export default {
  title: "components/OurTable",
  component: OurTable,
};

const Template = (args) => {
  return <OurTable {...args} />;
};

export const SimpleExample = Template.bind({});

SimpleExample.args = {
  data: ourTableFixtures.simpleExample.data,
  columns: ourTableFixtures.simpleExample.columns,
};

export const SimpleLegacyExample = Template.bind({});

SimpleLegacyExample.args = {
  data: ourTableFixtures.simpleLegacyExample.data,
  columns: ourTableFixtures.simpleLegacyExample.columns,
};

export const NewStyleTable = Template.bind({});

NewStyleTable.args = {
  columns: ourTableFixtures.newStyleColumns.columns,
  data: ourTableFixtures.newStyleColumns.data,
};

/**
 * Issue #342: a column marked enableResizing with a size, minSize and no maxSize is that wide to
 * begin with and has a drag handle (and arrow-key resizing) at the right edge of its heading.
 */
export const ResizableColumn = Template.bind({});

ResizableColumn.args = {
  data: [
    { id: 1, notes: "A long answer that wraps in the wide column. ".repeat(6) },
    { id: 2, notes: "Short" },
  ],
  columns: [
    { header: "id", accessorKey: "id" },
    {
      header: "Notes",
      accessorKey: "notes",
      size: 400,
      minSize: 200,
      maxSize: Number.MAX_SAFE_INTEGER,
      enableResizing: true,
    },
  ],
};

export const ComplexArgs = Template.bind({});

ComplexArgs.args = {
  data: ourTableFixtures.complexData.data,
  columns: ourTableFixtures.complexData.columns,
};

const columnsWithButton = [
  ...ourTableFixtures.simpleExample.columns,
  ButtonColumn("Click", "primary", () => {}, "myTestId"),
];

export const SampleWithButtonColumn = Template.bind({});

SampleWithButtonColumn.args = {
  columns: columnsWithButton,
  data: ourTableFixtures.simpleExample.data,
  testid: "myTestId",
};

export const PlaceholderExample = Template.bind({});

PlaceholderExample.args = {
  columns: ourTableFixtures.placeholderExample.columns,
  data: ourTableFixtures.placeholderExample.data,
};

/** A small "hide" link in the top right of each listed column's heading (issue #314). */
export const WithHideLinks = Template.bind({});

WithHideLinks.args = {
  columns: ourTableFixtures.simpleExample.columns,
  data: ourTableFixtures.simpleExample.data,
  hideLinks: {
    choices: ourTableFixtures.simpleExample.columns.map((column) => ({
      id: column.accessor ?? column.accessorKey ?? column.id,
      label: column.Header ?? column.header,
    })),
    onHide: () => {},
  },
};
