import { render, waitFor, fireEvent, screen } from "@testing-library/react";
import OurTable, { ButtonColumn } from "main/components/Common/OurTable";
import ourTableFixtures from "fixtures/ourTableFixtures";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { convertOldStyleColumnsToNewStyle } from "main/components/Common/OurTableUtils";

describe("OurTable tests", () => {
  describe("OurTable helper tests", () => {
    test("add id when it doesn't exist", () => {
      const columns = [
        {
          Header: "Column 1",
          accessor: "col1", // accessor is the "key" in the data
        },
      ];

      const newColumns = convertOldStyleColumnsToNewStyle(columns);
      const expected = [
        {
          id: "col1",
          header: "Column 1",
          accessorKey: "col1",
          Header: "Column 1",
          accessor: "col1", // accessor is the "key" in the data
        },
      ];

      expect(newColumns).toEqual(expected);
    });
  });
  describe("OurTable component tests", () => {
    const threeRows = [
      {
        col1: "Hello",
        col2: "World",
      },
      {
        col1: "react-table",
        col2: "rocks",
      },
      {
        col1: "whatever",
        col2: "you want",
      },
    ];

    const clickMeCallback = vi.fn();

    const columns = [
      {
        Header: "Column 1",
        accessor: "col1", // accessor is the "key" in the data
      },
      {
        Header: "Column 2",
        accessor: "col2",
      },
      ButtonColumn("Click", "primary", clickMeCallback, "testId"),
    ];

    test("renders an empty table without crashing", () => {
      render(<OurTable columns={columns} data={[]} />);
    });

    test("renders a table with three rows with correct test ids", async () => {
      render(<OurTable columns={columns} data={threeRows} testid={"testid"} />);

      await waitFor(() => {
        expect(screen.getByTestId("testid-header-group-0")).toBeInTheDocument();
      });
      expect(screen.getByTestId("testid-header-col1")).toBeInTheDocument();
      expect(screen.getByTestId("testid-header-col2")).toBeInTheDocument();
      expect(screen.getByTestId("testid-row-0")).toBeInTheDocument();
      expect(screen.getByTestId("testid-row-1")).toBeInTheDocument();
      expect(screen.getByTestId("testid-row-2")).toBeInTheDocument();
    });

    test("The button appears in the table", async () => {
      render(<OurTable columns={columns} data={threeRows} />);

      await screen.findByTestId("testId-cell-row-0-col-Click-button");
      const button = screen.getByTestId("testId-cell-row-0-col-Click-button");
      fireEvent.click(button);
      await waitFor(() => expect(clickMeCallback).toBeCalledTimes(1));
    });

    /** Issue #84: fitContent sizes the table to its columns (Bootstrap w-auto). */
    test("the table fills the width unless fitContent is set", async () => {
      const { rerender } = render(
        <OurTable columns={columns} data={threeRows} />,
      );
      const table = screen.getByTestId("testid");
      expect(table).toHaveClass("table", "table-striped", "table-bordered");
      expect(table).not.toHaveClass("w-auto");
      expect(table.className).toBe("table table-striped table-bordered");

      rerender(<OurTable columns={columns} data={threeRows} fitContent />);
      expect(screen.getByTestId("testid").className).toBe(
        "table table-striped table-bordered w-auto",
      );
    });

    test("default testid is testid", async () => {
      render(<OurTable columns={columns} data={threeRows} />);
      await screen.findByTestId("testid-header-col1");
    });

    test("click on a header and a sort caret should appear", async () => {
      render(
        <OurTable columns={columns} data={threeRows} testid={"sampleTestId"} />,
      );

      await screen.findByTestId("sampleTestId-header-col1");
      const col1Header = screen.getByTestId("sampleTestId-header-col1");
      expect(col1Header).toBeInTheDocument();

      const col1SortCarets = screen.getByTestId(
        "sampleTestId-header-col1-sort-carets",
      );
      expect(col1SortCarets).toBeEmptyDOMElement();

      const col1Row0 = screen.getByTestId("sampleTestId-cell-row-0-col-col1");
      expect(col1Row0).toHaveTextContent("Hello");
    });

    test("enableSorting={false} disables the click-to-sort cursor/handler on every header", async () => {
      render(
        <OurTable
          columns={columns}
          data={threeRows}
          testid={"noSortTestId"}
          enableSorting={false}
        />,
      );

      await screen.findByTestId("noSortTestId-header-col1-sort-header");
      const col1Header = screen.getByTestId(
        "noSortTestId-header-col1-sort-header",
      );
      expect(col1Header).not.toHaveAttribute("style");

      fireEvent.click(col1Header);
      expect(
        screen.getByTestId("noSortTestId-header-col1-sort-carets"),
      ).toBeEmptyDOMElement();
    });

    test("placeholder headers work properly", async () => {
      render(
        <OurTable
          columns={ourTableFixtures.placeholderExample.columns}
          data={ourTableFixtures.placeholderExample.data}
          testid={"placeholderHeadersTest"}
        />,
      );
      await waitFor(() => {
        expect(
          screen.getByTestId("placeholderHeadersTest-header-group-0"),
        ).toBeInTheDocument();
      });
      const firstNameHeader = screen.getByTestId(
        "placeholderHeadersTest-header-firstName-sort-header",
      );
      expect(firstNameHeader).toBeInTheDocument();
      expect(firstNameHeader).toHaveTextContent("First Name");
      expect(firstNameHeader).toHaveAttribute("style", "cursor: pointer;");
    });
  });

  describe("OurTable footer tests (issue #176)", () => {
    const rows = [
      { col1: "a", n: 2 },
      { col1: "b", n: 3 },
    ];

    test("no footer row unless a column defines a footer", () => {
      render(
        <OurTable
          data={rows}
          columns={[
            { header: "Col 1", accessorKey: "col1" },
            { header: "N", accessorKey: "n" },
          ]}
          testid="t"
        />,
      );
      expect(screen.getByTestId("t").querySelector("tfoot")).toBeNull();
      expect(screen.queryByTestId("t-footer-group-0")).toBeNull();
    });

    test("renders each column's footer, a placeholder for those without one", () => {
      render(
        <OurTable
          data={rows}
          columns={[
            {
              header: "Col 1",
              accessorKey: "col1",
              footer: "Total Course Count: 2",
              meta: { style: { width: "1%" } },
            },
            { header: "N", accessorKey: "n", footer: () => <em>5</em> },
            { header: "None", accessorKey: "none" },
          ]}
          testid="t"
        />,
      );
      const tfoot = screen.getByTestId("t").querySelector("tfoot");
      expect(tfoot).not.toBeNull();
      expect(screen.getByTestId("t-footer-group-0").tagName).toBe("TR");
      expect(screen.getByTestId("t-footer-col1")).toHaveTextContent(
        "Total Course Count: 2",
      );
      expect(screen.getByTestId("t-footer-col1").tagName).toBe("TH");
      expect(screen.getByTestId("t-footer-col1")).toHaveStyle({ width: "1%" });
      expect(screen.getByTestId("t-footer-col1")).toHaveAttribute(
        "colspan",
        "1",
      );
      expect(
        screen.getByTestId("t-footer-n").querySelector("em"),
      ).toHaveTextContent("5");
      expect(screen.getByTestId("t-footer-none")).toBeEmptyDOMElement();
      // The body is still there and sortable.
      expect(screen.getByTestId("t-cell-row-1-col-n")).toHaveTextContent("3");
    });
  });

  // ---- Issue #185 ----

  test("columnVisibility leaves a column out of the headings, cells and footer", () => {
    const columns = [
      { Header: "Name", accessor: "name", footer: "Total" },
      { Header: "Age", accessor: "age", footer: "99" },
    ];
    const data = [{ name: "Ann", age: 1 }];
    render(
      <OurTable
        data={data}
        columns={columns}
        testid="vis"
        columnVisibility={{ age: false }}
      />,
    );

    expect(screen.getByTestId("vis-header-name")).toBeInTheDocument();
    expect(screen.queryByTestId("vis-header-age")).not.toBeInTheDocument();
    expect(screen.getByTestId("vis-cell-row-0-col-name")).toHaveTextContent(
      "Ann",
    );
    expect(
      screen.queryByTestId("vis-cell-row-0-col-age"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("vis-footer-name")).toHaveTextContent("Total");
    expect(screen.queryByTestId("vis-footer-age")).not.toBeInTheDocument();
  });

  test("centerHeaders centres every heading but leaves the cells' alignment alone", () => {
    const columns = [
      { Header: "Name", accessor: "name" },
      {
        Header: "Age",
        accessor: "age",
        meta: { style: { textAlign: "right", width: "1%" } },
      },
    ];
    const data = [{ name: "Ann", age: 1 }];
    const { unmount } = render(
      <OurTable data={data} columns={columns} testid="ctr" centerHeaders />,
    );

    expect(screen.getByTestId("ctr-header-name").style.textAlign).toBe(
      "center",
    );
    const age = screen.getByTestId("ctr-header-age");
    expect(age.style.textAlign).toBe("center");
    expect(age.style.width).toBe("1%");
    expect(screen.getByTestId("ctr-cell-row-0-col-age").style.textAlign).toBe(
      "right",
    );
    expect(screen.getByTestId("ctr-cell-row-0-col-name").style.textAlign).toBe(
      "",
    );
    unmount();

    render(<OurTable data={data} columns={columns} testid="plain" />);
    expect(screen.getByTestId("plain-header-name").style.textAlign).toBe("");
    expect(screen.getByTestId("plain-header-age").style.textAlign).toBe(
      "right",
    );
  });

  // ---- Issue #415 ----

  test("a column's meta.className goes on its heading, cells and footer; a column without one has no class", () => {
    const columns = [
      { Header: "Name", accessor: "name", footer: "Total" },
      {
        Header: "Age",
        accessor: "age",
        footer: "99",
        meta: { className: "age-column", style: { width: "1%" } },
      },
    ];
    render(
      <OurTable
        data={[{ name: "Ann", age: 1 }]}
        columns={columns}
        testid="cls"
      />,
    );
    expect(screen.getByTestId("cls-header-age")).toHaveClass("age-column");
    expect(screen.getByTestId("cls-cell-row-0-col-age")).toHaveClass(
      "age-column",
    );
    expect(screen.getByTestId("cls-footer-age")).toHaveClass("age-column");
    // The style still applies alongside the class.
    expect(screen.getByTestId("cls-header-age").style.width).toBe("1%");
    expect(screen.getByTestId("cls-cell-row-0-col-age").style.width).toBe("1%");
    expect(screen.getByTestId("cls-header-name")).not.toHaveAttribute("class");
    expect(screen.getByTestId("cls-cell-row-0-col-name")).not.toHaveAttribute(
      "class",
    );
    expect(screen.getByTestId("cls-footer-name")).not.toHaveAttribute("class");
  });

  // ---- Issue #476 ----

  test("a column's meta.headerClassName goes on its heading alone, after meta.className", () => {
    const columns = [
      { Header: "Name", accessor: "name", footer: "Total" },
      {
        Header: "Age",
        accessor: "age",
        footer: "99",
        meta: { className: "age-column", headerClassName: "age-heading" },
      },
      {
        Header: "Town",
        accessor: "town",
        footer: "-",
        meta: { headerClassName: "town-heading" },
      },
    ];
    render(
      <OurTable
        data={[{ name: "Ann", age: 1, town: "Goleta" }]}
        columns={columns}
        testid="hc"
      />,
    );
    expect(screen.getByTestId("hc-header-age").className).toBe(
      "age-column age-heading",
    );
    expect(screen.getByTestId("hc-cell-row-0-col-age").className).toBe(
      "age-column",
    );
    expect(screen.getByTestId("hc-footer-age").className).toBe("age-column");
    // Without a className, the heading has just its own class and the cells have none.
    expect(screen.getByTestId("hc-header-town").className).toBe("town-heading");
    expect(screen.getByTestId("hc-cell-row-0-col-town")).not.toHaveAttribute(
      "class",
    );
    expect(screen.getByTestId("hc-footer-town")).not.toHaveAttribute("class");
    expect(screen.getByTestId("hc-header-name")).not.toHaveAttribute("class");
  });

  // ---- Issue #314 ----

  test("hideLinks puts a small hide link over each listed column only, and it reports the column", async () => {
    const onHide = vi.fn();
    const columns = [
      { Header: "Id", accessor: "id" },
      { Header: "Name", accessor: "name" },
    ];
    render(
      <OurTable
        data={[{ id: 1, name: "Ann" }]}
        columns={columns}
        testid="hl"
        hideLinks={{ choices: [{ id: "name", label: "Full Name" }], onHide }}
      />,
    );

    expect(screen.queryByTestId("hl-header-id-hide")).not.toBeInTheDocument();
    const link = screen.getByRole("button", { name: "Hide Full Name column" });
    expect(link).toBe(screen.getByTestId("hl-header-name-hide"));
    expect(link).toHaveTextContent("hide");
    expect(link.style.position).toBe("absolute");
    expect(link.style.right).toBe("0.25rem");
    expect(link.style.fontSize).toBe("0.6rem");
    expect(screen.getByTestId("hl-header-name").style.position).toBe(
      "relative",
    );
    expect(screen.getByTestId("hl-header-id").style.position).toBe("");
    // It sits outside the sortable heading, so clicking it only hides.
    await userEvent.click(link);
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledWith("name");
  });

  test("hideLinks keeps centred headings centred", () => {
    render(
      <OurTable
        data={[{ name: "Ann" }]}
        columns={[{ Header: "Name", accessor: "name" }]}
        testid="hc"
        centerHeaders
        hideLinks={{
          choices: [{ id: "name", label: "Name" }],
          onHide: vi.fn(),
        }}
      />,
    );
    expect(screen.getByTestId("hc-header-name").style.textAlign).toBe("center");
  });

  // ---- Issue #342 ----

  const wideColumns = [
    { Header: "Id", accessor: "id" },
    {
      Header: "Notes",
      accessor: "notes",
      size: 400,
      minSize: 200,
      enableResizing: true,
    },
  ];

  const renderWide = (props = {}) =>
    render(
      <OurTable
        data={[{ id: 1, notes: "Long text" }]}
        columns={wideColumns}
        testid="w"
        {...props}
      />,
    );

  test("a column given a size is that wide in its heading and cells, and the others are untouched", () => {
    renderWide();
    const head = screen.getByTestId("w-header-notes");
    expect(head.style.width).toBe("400px");
    expect(head.style.minWidth).toBe("400px");
    expect(head.style.position).toBe("relative");
    const cell = screen.getByTestId("w-cell-row-0-col-notes");
    expect(cell.style.width).toBe("400px");
    expect(cell.style.minWidth).toBe("400px");
    expect(screen.getByTestId("w-header-id").style.width).toBe("");
    expect(screen.getByTestId("w-cell-row-0-col-id").style.width).toBe("");
    expect(screen.queryByTestId("w-header-id-resize")).not.toBeInTheDocument();
  });

  test("the handle is a keyboard-focusable separator that describes the column's width", () => {
    renderWide();
    const handle = screen.getByRole("separator", {
      name: "Resize Notes column",
    });
    expect(handle).toBe(screen.getByTestId("w-header-notes-resize"));
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "400");
    expect(handle).toHaveAttribute("aria-valuemin", "200");
    expect(handle).not.toHaveAttribute("aria-valuemax");
    expect(handle).toHaveAttribute("tabindex", "0");
    expect(handle.style.position).toBe("absolute");
    expect(handle.style.right).toBe("0px");
    expect(handle.style.cursor).toBe("col-resize");
    expect(handle.style.width).toBe("6px");
    expect(handle.style.userSelect).toBe("none");
    expect(handle.style.touchAction).toBe("none");
    expect(handle.style.borderRight).toBe("3px solid rgba(0, 0, 0, 0.15)");
  });

  test("a heading that is not text names its handle by the column id", () => {
    renderWide({
      columns: [
        {
          id: "notes",
          header: <span>Notes</span>,
          accessorKey: "notes",
          size: 300,
          enableResizing: true,
        },
      ],
    });
    expect(
      screen.getByRole("separator", { name: "Resize notes column" }),
    ).toBeInTheDocument();
  });

  test("dragging the handle widens and narrows the column, and never below its minimum", () => {
    renderWide();
    const handle = screen.getByTestId("w-header-notes-resize");
    fireEvent.mouseDown(handle, { clientX: 500 });
    expect(handle.style.borderRight).toBe("3px solid rgb(13, 110, 253)");
    fireEvent.mouseMove(document, { clientX: 600 });
    expect(screen.getByTestId("w-header-notes").style.width).toBe("500px");
    expect(screen.getByTestId("w-cell-row-0-col-notes").style.width).toBe(
      "500px",
    );
    fireEvent.mouseMove(document, { clientX: 200 });
    expect(screen.getByTestId("w-header-notes").style.width).toBe("200px");
    fireEvent.mouseMove(document, { clientX: 0 });
    expect(screen.getByTestId("w-header-notes").style.width).toBe("200px");
    fireEvent.mouseUp(document, { clientX: 0 });
    expect(handle.style.borderRight).toBe("3px solid rgba(0, 0, 0, 0.15)");
  });

  test("there is no maximum width", () => {
    renderWide();
    const handle = screen.getByTestId("w-header-notes-resize");
    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(document, { clientX: 5000 });
    expect(screen.getByTestId("w-header-notes").style.width).toBe("5400px");
    fireEvent.mouseUp(document, { clientX: 5000 });
  });

  test("touching the handle starts a resize too", () => {
    renderWide();
    const handle = screen.getByTestId("w-header-notes-resize");
    fireEvent.touchStart(handle, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(document, { touches: [{ clientX: 160 }] });
    expect(screen.getByTestId("w-header-notes").style.width).toBe("460px");
    fireEvent.touchEnd(document, { touches: [{ clientX: 160 }] });
  });

  test("the arrow keys resize from the keyboard, to the minimum and no less, and other keys do nothing", async () => {
    renderWide();
    const handle = screen.getByTestId("w-header-notes-resize");
    const width = () => screen.getByTestId("w-header-notes").style.width;
    handle.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(width()).toBe("420px");
    expect(handle).toHaveAttribute("aria-valuenow", "420");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(width()).toBe("380px");
    await userEvent.keyboard("{Enter}{ArrowUp}");
    expect(width()).toBe("380px");
    for (let i = 0; i < 12; i++) {
      await userEvent.keyboard("{ArrowLeft}");
    }
    expect(width()).toBe("200px");
  });

  test("arrow keys are consumed by the handle but other keys are left alone", () => {
    renderWide();
    const handle = screen.getByTestId("w-header-notes-resize");
    // fireEvent returns false when the event's default was prevented.
    expect(fireEvent.keyDown(handle, { key: "ArrowRight" })).toBe(false);
    expect(fireEvent.keyDown(handle, { key: "ArrowLeft" })).toBe(false);
    expect(fireEvent.keyDown(handle, { key: "Tab" })).toBe(true);
    expect(screen.getByTestId("w-header-notes").style.width).toBe("400px");
  });

  test("a click on the handle does not reach the elements around the table", async () => {
    const onClick = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onClick}>
        <OurTable
          data={[{ id: 1, notes: "x" }]}
          columns={wideColumns}
          testid="wb"
        />
      </div>,
    );
    await userEvent.click(screen.getByTestId("wb-header-notes-resize"));
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("wb-header-notes-sort-header"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("a click on the handle does not sort", async () => {
    render(
      <OurTable
        data={[
          { id: 1, notes: "b" },
          { id: 2, notes: "a" },
        ]}
        columns={wideColumns}
        testid="wc"
      />,
    );
    await userEvent.click(screen.getByTestId("wc-header-notes-resize"));
    expect(
      [...screen.getByTestId("wc").querySelectorAll("tbody tr")].map(
        (tr) => tr.textContent,
      ),
    ).toEqual(["1b", "2a"]);
  });

  test("the heading still sorts when clicked beside a handle", async () => {
    render(
      <OurTable
        data={[
          { id: 1, notes: "b" },
          { id: 2, notes: "a" },
        ]}
        columns={wideColumns}
        testid="ws"
      />,
    );
    const first = () => screen.getByTestId("ws-cell-row-0-col-notes");
    expect(first()).toHaveTextContent("b");
    await userEvent.click(screen.getByTestId("ws-header-notes-sort-header"));
    expect(
      [...screen.getByTestId("ws").querySelectorAll("tbody tr")].map(
        (tr) => tr.textContent,
      ),
    ).toEqual(["2a", "1b"]);
  });

  test("a resizable column's hide link keeps clear of the handle and still hides", async () => {
    const onHide = vi.fn();
    renderWide({
      hideLinks: { choices: [{ id: "notes", label: "Notes" }], onHide },
    });
    const link = screen.getByTestId("w-header-notes-hide");
    expect(link.style.right).toBe("0.6rem");
    expect(link.style.position).toBe("absolute");
    expect(screen.getByTestId("w-header-notes-resize")).toBeInTheDocument();
    await userEvent.click(link);
    expect(onHide).toHaveBeenCalledWith("notes");
  });

  test("a sized column keeps its width when its heading is centred", () => {
    renderWide({ centerHeaders: true });
    const head = screen.getByTestId("w-header-notes");
    expect(head.style.textAlign).toBe("center");
    expect(head.style.width).toBe("400px");
  });

  test("a column not marked enableResizing has neither a width nor a handle, whatever its size", () => {
    renderWide({
      columns: [{ Header: "Notes", accessor: "notes", size: 300 }],
    });
    expect(screen.getByTestId("w-header-notes").style.width).toBe("");
    expect(
      screen.queryByTestId("w-header-notes-resize"),
    ).not.toBeInTheDocument();
  });

  test("no hideLinks, no hide links", () => {
    render(
      <OurTable
        data={[{ name: "Ann" }]}
        columns={[{ Header: "Name", accessor: "name" }]}
        testid="nh"
      />,
    );
    expect(screen.queryByTestId("nh-header-name-hide")).not.toBeInTheDocument();
  });

  describe("row ids (issue #435)", () => {
    const columns = [
      { header: "Name", accessorKey: "name" },
      {
        header: "Box",
        id: "box",
        cell: ({ cell }) => (
          <input aria-label={`box for ${cell.row.original.name}`} />
        ),
      },
    ];
    const ann = { name: "Ann" };
    const bob = { name: "Bob" };
    const cy = { name: "Cy" };

    test("with getRowId, a row and the controls in it stay together when a row is added before it; the test ids keep the position", () => {
      const getRowId = vi.fn((row) => row.name);
      const { rerender } = render(
        <OurTable
          data={[bob, cy]}
          columns={columns}
          testid="ids"
          getRowId={getRowId}
        />,
      );
      const box = screen.getByLabelText("box for Bob");
      box.focus();

      rerender(
        <OurTable
          data={[ann, bob, cy]}
          columns={columns}
          testid="ids"
          getRowId={getRowId}
        />,
      );

      expect(screen.getByLabelText("box for Bob")).toBe(box);
      expect(box).toHaveFocus();
      expect(screen.getByTestId("ids-cell-row-1-col-box")).toContainElement(
        box,
      );
      expect(getRowId).toHaveBeenCalledWith(ann, 0, undefined);
    });

    test("without getRowId, a row is its position, as before", () => {
      const { rerender } = render(
        <OurTable data={[bob, cy]} columns={columns} testid="pos" />,
      );
      const first = screen.getByLabelText("box for Bob");

      rerender(
        <OurTable data={[ann, bob, cy]} columns={columns} testid="pos" />,
      );

      // The first row's elements are kept and now show the row in that position.
      expect(screen.getByLabelText("box for Ann")).toBe(first);
      expect(screen.getByTestId("pos-cell-row-0-col-box")).toContainElement(
        first,
      );
    });
  });

  describe("column pinning (issue #510)", () => {
    const EDGE =
      "inset -2px 0 0 var(--bs-table-border-color), inset 0 0 0 9999px var(--bs-table-bg-state, var(--bs-table-bg-type, var(--bs-table-accent-bg)))";
    const columns = [
      { Header: "First", accessor: "first", footer: "F" },
      { Header: "Last", accessor: "last", footer: "L" },
      { Header: "Email", accessor: "email", footer: "E" },
    ];
    const rows = [
      { first: "Ann", last: "Ash", email: "ann@ucsb.edu" },
      { first: "Bob", last: "Birch", email: "bob@ucsb.edu" },
    ];
    const renderPinned = (props = {}) =>
      render(
        <OurTable
          data={rows}
          columns={columns}
          testid="p"
          pinnedColumns={["first", "last"]}
          {...props}
        />,
      );
    const header = (id) => screen.getByTestId(`p-header-${id}`);
    const cell = (row, id) => screen.getByTestId(`p-cell-row-${row}-col-${id}`);
    const footer = (id) => screen.getByTestId(`p-footer-${id}`);

    test("without pinnedColumns nothing is sticky, as before", () => {
      render(<OurTable data={rows} columns={columns} testid="p" />);
      for (const el of [header("first"), cell(0, "first"), footer("first")]) {
        expect(el.style.position).toBe("");
        expect(el.style.left).toBe("");
        expect(el.style.width).toBe("");
        expect(el.style.zIndex).toBe("");
        expect(el.style.backgroundColor).toBe("");
        expect(el.style.boxShadow).toBe("");
      }
      expect(header("first")).not.toHaveAttribute("style");
      expect(cell(0, "first")).not.toHaveAttribute("style");
      expect(footer("first")).not.toHaveAttribute("style");
    });

    test("a pinned column's heading, cells and footer are sticky at the sum of the sizes before it, at the default size, over the table's background", () => {
      renderPinned();

      // The first pinned column sits at the left edge.
      for (const el of [header("first"), cell(0, "first"), cell(1, "first")]) {
        expect(el.style.position).toBe("sticky");
        expect(el.style.left).toBe("0px");
        expect(el.style.width).toBe("150px");
        expect(el.style.minWidth).toBe("150px");
        expect(el.style.overflowWrap).toBe("anywhere");
        expect(el.style.backgroundColor).toBe("var(--bs-table-bg)");
        // Only the last pinned column has the edge.
        expect(el.style.boxShadow).toBe("");
      }
      // The second sits after the first's 150px.
      for (const el of [header("last"), cell(0, "last"), footer("last")]) {
        expect(el.style.position).toBe("sticky");
        expect(el.style.left).toBe("150px");
        expect(el.style.width).toBe("150px");
        expect(el.style.boxShadow).toBe(EDGE);
      }
      // Headings sit over body cells, which sit over the scrolled cells.
      expect(header("first").style.zIndex).toBe("2");
      expect(header("last").style.zIndex).toBe("2");
      expect(cell(0, "first").style.zIndex).toBe("1");
      expect(cell(1, "last").style.zIndex).toBe("1");
      expect(footer("first").style.zIndex).toBe("1");
      expect(footer("first").style.position).toBe("sticky");
      expect(footer("first").style.left).toBe("0px");
      // The other column is left alone.
      for (const el of [header("email"), cell(0, "email"), footer("email")]) {
        expect(el.style.position).toBe("");
        expect(el.style.left).toBe("");
        expect(el.style.width).toBe("");
        expect(el.style.boxShadow).toBe("");
        expect(el.style.backgroundColor).toBe("");
      }
      expect(header("email")).not.toHaveAttribute("style");
    });

    test("a pinned column with a size is that wide, and the next one's offset follows it", () => {
      renderPinned({
        columns: [
          { Header: "First", accessor: "first", size: 120 },
          { Header: "Last", accessor: "last", size: 90 },
          { Header: "Email", accessor: "email" },
        ],
      });
      expect(header("first").style.width).toBe("120px");
      expect(cell(0, "first").style.minWidth).toBe("120px");
      expect(header("last").style.left).toBe("120px");
      expect(cell(1, "last").style.left).toBe("120px");
      expect(header("last").style.width).toBe("90px");
      // A size alone does not make a column resizable.
      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    });

    test("a hidden pinned column is left out of the offsets and the edge moves to the last one shown", () => {
      renderPinned({ columnVisibility: { first: false } });
      expect(screen.queryByTestId("p-header-first")).not.toBeInTheDocument();
      expect(header("last").style.left).toBe("0px");
      expect(header("last").style.boxShadow).toBe(EDGE);
      expect(cell(0, "last").style.left).toBe("0px");
      expect(cell(0, "last").style.boxShadow).toBe(EDGE);
      expect(footer("last").style.boxShadow).toBe(EDGE);
    });

    test("pinned columns come first, in the given order, whatever their place in columns", () => {
      renderPinned({ pinnedColumns: ["email", "first"] });
      const ids = (row) =>
        [...row.querySelectorAll("th, td")].map((el) =>
          el.getAttribute("data-testid"),
        );
      expect(ids(screen.getByTestId("p-header-group-0"))).toEqual([
        "p-header-email",
        "p-header-first",
        "p-header-last",
      ]);
      expect(ids(screen.getByTestId("p-row-0"))).toEqual([
        "p-cell-row-0-col-email",
        "p-cell-row-0-col-first",
        "p-cell-row-0-col-last",
      ]);
      expect(ids(screen.getByTestId("p-footer-group-0"))).toEqual([
        "p-footer-email",
        "p-footer-first",
        "p-footer-last",
      ]);
      expect(header("email").style.left).toBe("0px");
      expect(header("email").style.boxShadow).toBe("");
      expect(header("first").style.left).toBe("150px");
      expect(header("first").style.boxShadow).toBe(EDGE);
      expect(header("last").style.position).toBe("");
      // The cells still hold their own column's value.
      expect(cell(0, "email")).toHaveTextContent("ann@ucsb.edu");
      expect(cell(0, "first")).toHaveTextContent("Ann");
    });

    test("an id that is not a column is ignored", () => {
      renderPinned({ pinnedColumns: ["nope", "first"] });
      expect(header("first").style.left).toBe("0px");
      expect(header("first").style.boxShadow).toBe(EDGE);
      expect(header("last").style.position).toBe("");
      expect(
        screen.getByTestId("p-header-group-0").querySelectorAll("th"),
      ).toHaveLength(3);
    });

    test("a pinned heading with a hide link stays sticky and the link still hides; a centred heading stays centred", async () => {
      const onHide = vi.fn();
      renderPinned({
        centerHeaders: true,
        hideLinks: { choices: [{ id: "last", label: "Last" }], onHide },
      });
      const last = header("last");
      expect(last.style.position).toBe("sticky");
      expect(last.style.textAlign).toBe("center");
      expect(last.style.left).toBe("150px");
      const link = screen.getByTestId("p-header-last-hide");
      expect(link.style.position).toBe("absolute");
      await userEvent.click(link);
      expect(onHide).toHaveBeenCalledWith("last");
      // The heading still sorts (the test ids keep the row's position in the data).
      const firstRow = () =>
        screen.getByTestId("p").querySelector("tbody tr").textContent;
      await userEvent.click(screen.getByTestId("p-header-first-sort-header"));
      expect(firstRow()).toBe("AnnAshann@ucsb.edu");
      await userEvent.click(screen.getByTestId("p-header-first-sort-header"));
      expect(firstRow()).toBe("BobBirchbob@ucsb.edu");
    });

    test("resizing a pinned column moves the offset of the one after it", () => {
      renderPinned({
        columns: [
          {
            Header: "First",
            accessor: "first",
            size: 200,
            minSize: 100,
            enableResizing: true,
          },
          { Header: "Last", accessor: "last" },
          { Header: "Email", accessor: "email" },
        ],
      });
      const first = header("first");
      expect(first.style.position).toBe("sticky");
      expect(first.style.width).toBe("200px");
      expect(header("last").style.left).toBe("200px");
      const handle = screen.getByTestId("p-header-first-resize");
      expect(handle.style.position).toBe("absolute");
      fireEvent.mouseDown(handle, { clientX: 300 });
      fireEvent.mouseMove(document, { clientX: 350 });
      expect(first.style.width).toBe("250px");
      expect(header("last").style.left).toBe("250px");
      expect(cell(0, "last").style.left).toBe("250px");
      fireEvent.mouseUp(document, { clientX: 350 });
    });
  });
});
