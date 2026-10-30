import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import PriorCourseworkSection from "main/components/PriorCoursework/PriorCourseworkSection";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";
import coursesFixtures from "fixtures/coursesFixtures";

const axiosMock = new AxiosMockAdapter(axios);

function renderSection({
  type = "TA",
  courses = [],
  invalid = false,
  subjectArea = undefined,
} = {}) {
  const onChange = vi.fn();
  render(
    // The bulk-add modal fetches the course table, so a query client is needed once it opens.
    <QueryClientProvider client={new QueryClient()}>
      <PriorCourseworkSection
        type={type}
        courses={courses}
        onChange={onChange}
        invalid={invalid}
        subjectArea={subjectArea}
        testIdPrefix="S"
      />
    </QueryClientProvider>,
  );
  return onChange;
}

describe("PriorCourseworkSection tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  test("a TA applicant is told to list at least three courses", () => {
    renderSection({ type: "TA" });

    expect(
      screen.getByText(/^Prior Coursework/).querySelector(".required-field"),
    ).not.toBeNull();
    expect(screen.getByTestId("S-instructions")).toHaveTextContent(
      "TA applicants must list at least 3 courses; there is no maximum.",
    );
    expect(screen.getByTestId("S-empty")).toHaveTextContent(
      "No courses listed yet.",
    );
    expect(screen.getByTestId("S-count")).toHaveTextContent(
      "0 of at least 3 listed",
    );
    expect(screen.queryByTestId("S-too-few")).toBeNull();
  });

  test("a ULA applicant is told to list all relevant background, at least one course", () => {
    renderSection({ type: "ULA" });

    expect(screen.getByTestId("S-instructions")).toHaveTextContent(
      "every course that is relevant background for the courses you are applying to be a ULA for",
    );
    expect(screen.getByTestId("S-count")).toHaveTextContent(
      "0 of at least 1 listed",
    );
  });

  test("lists the courses given, and the count", () => {
    renderSection({ courses: priorCourseworkFixtures.threeCourses });

    expect(screen.queryByTestId("S-empty")).toBeNull();
    expect(
      screen.getByTestId("S-table-cell-row-2-col-courseNumber"),
    ).toHaveTextContent("CS 143");
    expect(screen.getByTestId("S-count")).toHaveTextContent(
      "3 of at least 3 listed",
    );
  });

  test("when flagged with too few courses it says so, but not once there are enough", () => {
    renderSection({
      type: "TA",
      courses: [priorCourseworkFixtures.ucsbCourse],
      invalid: true,
    });
    expect(screen.getByTestId("S-too-few")).toHaveTextContent(
      "Please list at least 3 courses.",
    );
  });

  test("the flag is not shown when there are enough courses", () => {
    renderSection({
      type: "TA",
      courses: priorCourseworkFixtures.threeCourses,
      invalid: true,
    });
    expect(screen.queryByTestId("S-too-few")).toBeNull();
  });

  test("Add Course opens the modal and a saved course is appended", async () => {
    const onChange = renderSection({
      courses: [priorCourseworkFixtures.ucsbCourse],
    });

    expect(screen.queryByTestId("S-modal")).toBeNull();
    await userEvent.click(screen.getByTestId("S-add-button"));
    expect(screen.getByTestId("S-modal")).toBeInTheDocument();
    expect(screen.getByTestId("S-modal-courseNumber")).toHaveValue("");

    await userEvent.type(
      screen.getByTestId("S-modal-courseNumber"),
      "CMPSC 16",
    );
    await userEvent.click(screen.getByTestId("S-modal-save"));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0]).toEqual([
      priorCourseworkFixtures.ucsbCourse,
      {
        ucsbCourse: true,
        otherSchool: null,
        courseNumber: "CMPSC 16",
        courseTitle: null,
        term: null,
        grade: null,
      },
    ]);
    await waitFor(() => expect(screen.queryByTestId("S-modal")).toBeNull());
  });

  /** Issue #100: several UCSB courses at once, from the course table. */
  test("Add Multiple UCSB CMPSC Courses opens the bulk modal and the courses ticked are appended", async () => {
    axiosMock
      .onGet("/api/courses/all")
      .reply(200, coursesFixtures.threeCourses);
    const onChange = renderSection({
      courses: [priorCourseworkFixtures.ucsbCourse],
    });

    const button = screen.getByTestId("S-bulk-button");
    expect(button).toHaveTextContent("Add Multiple UCSB CMPSC Courses");
    // Not mounted, so the course table is not fetched, until the button is clicked.
    expect(screen.queryByTestId("S-bulk")).toBeNull();
    expect(axiosMock.history.get.length).toBe(0);

    await userEvent.click(button);
    expect(screen.getByTestId("S-bulk")).toBeInTheDocument();
    await userEvent.click(
      await screen.findByTestId("S-bulk-row-CMPSC-16-taken"),
    );
    await userEvent.selectOptions(
      screen.getByTestId("S-bulk-row-CMPSC-16-grade"),
      "B+",
    );
    await userEvent.click(screen.getByTestId("S-bulk-add"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([
      priorCourseworkFixtures.ucsbCourse,
      {
        ucsbCourse: true,
        otherSchool: null,
        courseNumber: "CMPSC 16",
        courseTitle: "Problem Solving with Computers I",
        term: null,
        grade: "B+",
      },
    ]);
    await waitFor(() => expect(screen.queryByTestId("S-bulk")).toBeNull());
  });

  test("the bulk button names the subject area given", () => {
    renderSection({ subjectArea: "ECE" });

    expect(screen.getByTestId("S-bulk-button")).toHaveTextContent(
      "Add Multiple UCSB ECE Courses",
    );
  });

  test("Cancel in the bulk modal closes it and changes nothing", async () => {
    axiosMock
      .onGet("/api/courses/all")
      .reply(200, coursesFixtures.threeCourses);
    const onChange = renderSection();

    await userEvent.click(screen.getByTestId("S-bulk-button"));
    await userEvent.click(await screen.findByTestId("S-bulk-cancel"));

    await waitFor(() => expect(screen.queryByTestId("S-bulk")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  test("without the invalid prop, too few courses are not complained about", () => {
    render(
      <PriorCourseworkSection
        type="TA"
        courses={[]}
        onChange={vi.fn()}
        testIdPrefix="S"
      />,
    );
    expect(screen.queryByTestId("S-too-few")).toBeNull();
  });

  test("Edit on the first row opens the modal on that row", async () => {
    renderSection({ courses: priorCourseworkFixtures.threeCourses });

    await userEvent.click(
      screen.getByTestId("S-table-cell-row-0-col-edit-button"),
    );
    expect(screen.getByTestId("S-modal-courseNumber")).toHaveValue("CMPSC 263");
    expect(screen.getByTestId("S-modal-grade")).toHaveValue("A");
  });

  test("Edit opens the modal on that row and a save replaces just that row", async () => {
    const onChange = renderSection({
      courses: priorCourseworkFixtures.threeCourses,
    });

    await userEvent.click(
      screen.getByTestId("S-table-cell-row-1-col-edit-button"),
    );
    expect(screen.getByTestId("S-modal-courseNumber")).toHaveValue(
      "CMPSC 290A",
    );

    await userEvent.clear(screen.getByTestId("S-modal-grade"));
    await userEvent.type(screen.getByTestId("S-modal-grade"), "A+");
    await userEvent.click(screen.getByTestId("S-modal-save"));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0]).toEqual([
      priorCourseworkFixtures.ucsbCourse,
      { ...priorCourseworkFixtures.inProgress, grade: "A+" },
      priorCourseworkFixtures.elsewhere,
    ]);
  });

  test("Delete removes just that row", async () => {
    const onChange = renderSection({
      courses: priorCourseworkFixtures.threeCourses,
    });

    await userEvent.click(
      screen.getByTestId("S-table-cell-row-0-col-delete-button"),
    );

    expect(onChange).toHaveBeenCalledWith([
      priorCourseworkFixtures.inProgress,
      priorCourseworkFixtures.elsewhere,
    ]);
  });

  test("Cancel in the modal changes nothing", async () => {
    const onChange = renderSection({
      courses: priorCourseworkFixtures.threeCourses,
    });

    await userEvent.click(
      screen.getByTestId("S-table-cell-row-0-col-edit-button"),
    );
    await userEvent.click(screen.getByTestId("S-modal-cancel"));

    await waitFor(() => expect(screen.queryByTestId("S-modal")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  test("tolerates a non-array courses prop", () => {
    renderSection({ courses: null });
    expect(screen.getByTestId("S-empty")).toBeInTheDocument();
  });

  test("uses PriorCoursework as the default test id prefix", () => {
    render(
      <PriorCourseworkSection type="TA" courses={[]} onChange={vi.fn()} />,
    );
    expect(
      screen.getByTestId("PriorCoursework-add-button"),
    ).toBeInTheDocument();
  });
});
