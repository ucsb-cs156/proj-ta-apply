import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import PriorCourseworkModal from "main/components/PriorCoursework/PriorCourseworkModal";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";

function renderModal({ course = null, show = true } = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <PriorCourseworkModal
      show={show}
      course={course}
      onSave={onSave}
      onCancel={onCancel}
      testIdPrefix="M"
    />,
  );
  return { onSave, onCancel };
}

describe("PriorCourseworkModal tests", () => {
  test("adding starts as a UCSB course with the school box visible but locked and blank", () => {
    renderModal();

    expect(
      screen.getByTestId("M").querySelector(".modal-header"),
    ).toHaveTextContent("Add Course");
    expect(screen.getByTestId("M-ucsbCourse")).toBeChecked();
    const school = screen.getByTestId("M-otherSchool");
    expect(school).toBeDisabled();
    expect(school).toHaveValue("");
    expect(school).toHaveAttribute("placeholder", "");
    // Required marks: course number always, the school only when unlocked.
    expect(
      screen.getByText(/^Course Number/).querySelector(".required-field"),
    ).not.toBeNull();
    expect(
      screen.getByText(/^Other School/).querySelector(".required-field"),
    ).toBeNull();
    expect(screen.getByTestId("RequiredFieldExplanation")).toBeInTheDocument();
    expect(screen.getByTestId("M-save")).toHaveTextContent("Add Course");
  });

  test("unticking UCSB course unlocks and requires the school; re-ticking empties it", async () => {
    renderModal();

    await userEvent.click(screen.getByTestId("M-ucsbCourse"));
    const school = screen.getByTestId("M-otherSchool");
    expect(school).toBeEnabled();
    expect(school).toHaveAttribute("placeholder", "Where the course was taken");
    expect(
      screen.getByText(/^Other School/).querySelector(".required-field"),
    ).not.toBeNull();

    await userEvent.type(school, "UCLA");
    await userEvent.click(screen.getByTestId("M-ucsbCourse"));
    expect(school).toBeDisabled();
    expect(school).toHaveValue("");
  });

  test("a course number is required", async () => {
    const { onSave } = renderModal();

    await userEvent.type(screen.getByTestId("M-courseNumber"), "   ");
    await userEvent.click(screen.getByTestId("M-save"));

    await waitFor(() =>
      expect(screen.getByTestId("M-courseNumber")).toHaveClass("is-invalid"),
    );
    expect(
      screen.getByText("A course number is required."),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test("the school is required for a course not taken at UCSB", async () => {
    const { onSave } = renderModal();

    await userEvent.click(screen.getByTestId("M-ucsbCourse"));
    await userEvent.type(screen.getByTestId("M-courseNumber"), "CS 101");
    await userEvent.type(screen.getByTestId("M-otherSchool"), "  ");
    await userEvent.click(screen.getByTestId("M-save"));

    await waitFor(() =>
      expect(screen.getByTestId("M-otherSchool")).toHaveClass("is-invalid"),
    );
    expect(
      screen.getByText(
        "The school is required for a course not taken at UCSB.",
      ),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test("saving a UCSB course trims the answers and nulls the blanks and the school", async () => {
    const { onSave } = renderModal();

    await userEvent.type(screen.getByTestId("M-courseNumber"), "  CMPSC 156 ");
    await userEvent.type(screen.getByTestId("M-courseTitle"), " Advanced App ");
    await userEvent.type(screen.getByTestId("M-term"), "  ");
    await userEvent.type(screen.getByTestId("M-grade"), "A");
    await userEvent.click(screen.getByTestId("M-save"));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toStrictEqual({
      ucsbCourse: true,
      otherSchool: null,
      courseNumber: "CMPSC 156",
      courseTitle: "Advanced App",
      term: null,
      grade: "A",
    });
  });

  test("saving a course taken elsewhere keeps the school", async () => {
    const { onSave } = renderModal();

    await userEvent.click(screen.getByTestId("M-ucsbCourse"));
    await userEvent.type(screen.getByTestId("M-otherSchool"), " De Anza ");
    await userEvent.type(screen.getByTestId("M-courseNumber"), "CIS 22A");
    await userEvent.click(screen.getByTestId("M-save"));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toStrictEqual({
      ucsbCourse: false,
      otherSchool: "De Anza",
      courseNumber: "CIS 22A",
      courseTitle: null,
      term: null,
      grade: null,
    });
  });

  test("editing pre-fills the row and keeps its id on save", async () => {
    const { onSave } = renderModal({
      course: priorCourseworkFixtures.elsewhere,
    });

    expect(screen.getByText("Edit Course")).toBeInTheDocument();
    expect(screen.getByTestId("M-ucsbCourse")).not.toBeChecked();
    expect(screen.getByTestId("M-otherSchool")).toHaveValue(
      "Another University",
    );
    expect(screen.getByTestId("M-courseNumber")).toHaveValue("CS 143");
    expect(screen.getByTestId("M-courseTitle")).toHaveValue("Compilers");
    expect(screen.getByTestId("M-term")).toHaveValue("Spring 2024");
    expect(screen.getByTestId("M-grade")).toHaveValue("A-");
    expect(screen.getByTestId("M-save")).toHaveTextContent("Save Changes");

    await userEvent.clear(screen.getByTestId("M-grade"));
    await userEvent.type(screen.getByTestId("M-grade"), "A");
    await userEvent.click(screen.getByTestId("M-save"));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toStrictEqual({
      ...priorCourseworkFixtures.elsewhere,
      grade: "A",
    });
  });

  test("editing a row with null answers shows blanks", () => {
    renderModal({
      course: {
        ...priorCourseworkFixtures.ucsbCourse,
        courseTitle: null,
        term: null,
        grade: null,
      },
    });
    expect(screen.getByTestId("M-courseTitle")).toHaveValue("");
    expect(screen.getByTestId("M-term")).toHaveValue("");
    expect(screen.getByTestId("M-grade")).toHaveValue("");
  });

  test("Cancel and the close button report back without saving", async () => {
    const { onSave, onCancel } = renderModal();

    await userEvent.click(screen.getByTestId("M-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByLabelText("Close"));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onSave).not.toHaveBeenCalled();
  });

  test("is not rendered while hidden", () => {
    renderModal({ show: false });
    expect(screen.queryByTestId("M")).toBeNull();
  });

  /** The same modal is reused; reopening for a different row must not show the old one's text. */
  test("reopening for another row resets the fields", async () => {
    const { rerender } = render(
      <PriorCourseworkModal
        show={true}
        course={priorCourseworkFixtures.ucsbCourse}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        testIdPrefix="M"
      />,
    );
    expect(screen.getByTestId("M-courseNumber")).toHaveValue("CMPSC 263");

    rerender(
      <PriorCourseworkModal
        show={false}
        course={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        testIdPrefix="M"
      />,
    );
    rerender(
      <PriorCourseworkModal
        show={true}
        course={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        testIdPrefix="M"
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("M-courseNumber")).toHaveValue(""),
    );
    expect(screen.getByTestId("M-ucsbCourse")).toBeChecked();
  });

  test("uses PriorCourseworkModal as the default test id prefix", () => {
    render(
      <PriorCourseworkModal
        show={true}
        course={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId("PriorCourseworkModal-save")).toBeInTheDocument();
  });
});
