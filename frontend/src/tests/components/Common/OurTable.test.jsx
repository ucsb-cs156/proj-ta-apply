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
});
