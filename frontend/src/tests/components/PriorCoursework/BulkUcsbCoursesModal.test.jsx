import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import BulkUcsbCoursesModal from "main/components/PriorCoursework/BulkUcsbCoursesModal";
import coursesFixtures from "fixtures/coursesFixtures";

const axiosMock = new AxiosMockAdapter(axios);

function renderModal({ subjectArea = undefined, show = true } = {}) {
  const onAdd = vi.fn();
  const onCancel = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BulkUcsbCoursesModal
        show={show}
        subjectArea={subjectArea}
        onAdd={onAdd}
        onCancel={onCancel}
        testIdPrefix="B"
      />
    </QueryClientProvider>,
  );
  return { onAdd, onCancel };
}

describe("BulkUcsbCoursesModal tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
    axiosMock
      .onGet("/api/courses/all")
      .reply(200, coursesFixtures.threeCourses);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("lists every course in the table with a box, a term and a grade", async () => {
    renderModal();

    expect(await screen.findByTestId("B-row-CMPSC-130A")).toBeInTheDocument();
    expect(
      screen.getByText("Add Multiple UCSB CMPSC Courses"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("B-instructions")).toHaveTextContent(
      "Tick each course you have taken",
    );
    // textContent, since toHaveTextContent would squeeze the padding this checks for.
    expect(screen.getByTestId("B-row-CMPSC-130A-courseId").textContent).toBe(
      "CMPSC   130A",
    );
    expect(screen.getByTestId("B-row-CMPSC-130A-courseId")).toHaveStyle({
      whiteSpace: "pre",
      fontFamily: "monospace",
    });
    expect(screen.getByTestId("B-row-CMPSC-130A-title")).toHaveTextContent(
      "Data Structures and Algorithms I",
    );
    expect(screen.getByTestId("B-row-CMPSC-1A")).toBeInTheDocument();
    expect(screen.getByTestId("B-row-CMPSC-130A-taken")).not.toBeChecked();
    // The label is wired to the box by id.
    expect(screen.getByTestId("B-row-CMPSC-130A-taken")).toHaveAttribute(
      "id",
      "B-row-CMPSC-130A-taken",
    );
    expect(screen.getByTestId("B-row-CMPSC-130A-taken")).toHaveAccessibleName(
      "Took CMPSC 130A",
    );

    // The term runs from the current quarter back ten years, newest first.
    const term = screen.getByTestId("B-row-CMPSC-130A-term");
    const terms = [...term.options].map((o) => o.textContent);
    expect(terms.length).toBe(42);
    expect(terms.slice(0, 3)).toEqual(["Term", "F26", "M26"]);
    expect(terms[41]).toBe("F16");
    expect(term).toHaveAccessibleName("Term for CMPSC 130A");

    const grade = screen.getByTestId("B-row-CMPSC-130A-grade");
    expect([...grade.options].map((o) => o.textContent)).toEqual([
      "Grade",
      "IP",
      "A+",
      "A",
      "A-",
      "B+",
      "B",
      "B-",
      "C+",
      "C",
      "C-",
      "D+",
      "D",
      "D-",
      "F",
    ]);
    expect(grade).toHaveAccessibleName("Grade for CMPSC 130A");
    expect(axiosMock.history.get[0].url).toBe("/api/courses/all");
  });

  test("the subject area is named in the title", async () => {
    renderModal({ subjectArea: "ECE" });

    expect(
      await screen.findByText("Add Multiple UCSB ECE Courses"),
    ).toBeInTheDocument();
  });

  test("says so while loading and when the table is empty", async () => {
    axiosMock.onGet("/api/courses/all").reply(200, []);
    renderModal();

    expect(screen.getByTestId("B-none")).toHaveTextContent("Loading courses…");
    await waitFor(() =>
      expect(screen.getByTestId("B-none")).toHaveTextContent(
        "No courses are listed yet.",
      ),
    );
    expect(screen.getByTestId("B-add")).toBeDisabled();
  });

  test("nothing ticked: the add button is disabled and says Add 0 Courses", async () => {
    renderModal();

    await screen.findByTestId("B-row-CMPSC-130A");
    expect(screen.getByTestId("B-add")).toBeDisabled();
    expect(screen.getByTestId("B-add")).toHaveTextContent(/^Add 0 Courses$/);
  });

  test("the courses ticked are added in list order, with term and grade, and the box can be unticked", async () => {
    const { onAdd } = renderModal();

    await userEvent.click(await screen.findByTestId("B-row-CMPSC-16-taken"));
    expect(screen.getByTestId("B-add")).toHaveTextContent(/^Add 1 Course$/);
    expect(screen.getByTestId("B-add")).toBeEnabled();

    await userEvent.click(screen.getByTestId("B-row-CMPSC-130A-taken"));
    await userEvent.selectOptions(
      screen.getByTestId("B-row-CMPSC-130A-term"),
      "20254",
    );
    await userEvent.selectOptions(
      screen.getByTestId("B-row-CMPSC-130A-grade"),
      "A-",
    );
    // Ticked then unticked: not added.
    await userEvent.click(screen.getByTestId("B-row-CMPSC-156-taken"));
    await userEvent.click(screen.getByTestId("B-row-CMPSC-156-taken"));
    expect(screen.getByTestId("B-row-CMPSC-156-taken")).not.toBeChecked();
    expect(screen.getByTestId("B-add")).toHaveTextContent(/^Add 2 Courses$/);

    await userEvent.click(screen.getByTestId("B-add"));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toEqual([
      {
        ucsbCourse: true,
        otherSchool: null,
        courseNumber: "CMPSC 130A",
        courseTitle: "Data Structures and Algorithms I",
        term: "F25",
        grade: "A-",
      },
      {
        ucsbCourse: true,
        otherSchool: null,
        courseNumber: "CMPSC 16",
        courseTitle: "Problem Solving with Computers I",
        term: null,
        grade: null,
      },
    ]);
  });

  test("choosing a term or a grade ticks the course", async () => {
    const { onAdd } = renderModal();

    await userEvent.selectOptions(
      await screen.findByTestId("B-row-CMPSC-156-term"),
      "20261",
    );
    expect(screen.getByTestId("B-row-CMPSC-156-taken")).toBeChecked();
    await userEvent.selectOptions(
      screen.getByTestId("B-row-CMPSC-165A-grade"),
      "IP",
    );
    expect(screen.getByTestId("B-row-CMPSC-165A-taken")).toBeChecked();
    expect(screen.getByTestId("B-add")).toHaveTextContent("Add 2 Courses");

    await userEvent.click(screen.getByTestId("B-add"));
    expect(
      onAdd.mock.calls[0][0].map((row) => [
        row.courseNumber,
        row.term,
        row.grade,
      ]),
    ).toEqual([
      ["CMPSC 156", "W26", null],
      ["CMPSC 165A", null, "IP"],
    ]);
  });

  test("Cancel and the close button call onCancel without adding", async () => {
    const { onAdd, onCancel } = renderModal();

    await userEvent.click(await screen.findByTestId("B-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(
      within(screen.getByTestId("B")).getByLabelText("Close"),
    );
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("tolerates a non-array response", async () => {
    axiosMock.onGet("/api/courses/all").reply(200, { not: "a list" });
    renderModal();

    await waitFor(() =>
      expect(screen.getByTestId("B-none")).toHaveTextContent(
        "No courses are listed yet.",
      ),
    );
  });

  test("uses BulkUcsbCoursesModal as the default test id prefix", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BulkUcsbCoursesModal show onAdd={() => {}} onCancel={() => {}} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByTestId("BulkUcsbCoursesModal-row-CMPSC-156"),
    ).toBeInTheDocument();
  });
});
