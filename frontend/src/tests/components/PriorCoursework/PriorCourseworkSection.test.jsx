import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import PriorCourseworkSection from "main/components/PriorCoursework/PriorCourseworkSection";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";

function renderSection({ type = "TA", courses = [], invalid = false } = {}) {
  const onChange = vi.fn();
  render(
    <PriorCourseworkSection
      type={type}
      courses={courses}
      onChange={onChange}
      invalid={invalid}
      testIdPrefix="S"
    />,
  );
  return onChange;
}

describe("PriorCourseworkSection tests", () => {
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
