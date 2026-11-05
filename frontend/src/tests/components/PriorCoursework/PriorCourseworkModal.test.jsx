import { render, screen, waitFor, within } from "@testing-library/react";
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
    await userEvent.type(screen.getByTestId("M-grade"), "  ");
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
    // "Spring 2024" is brought to the standard form and shown through the dropdown.
    expect(screen.getByTestId("M-term")).toHaveValue("S24");
    expect(screen.getByTestId("M-freeText")).not.toBeChecked();
    expect(screen.getByTestId("M-grade")).toHaveValue("A-");
    expect(screen.getByTestId("M-save")).toHaveTextContent("Save Changes");

    await userEvent.clear(screen.getByTestId("M-grade"));
    await userEvent.type(screen.getByTestId("M-grade"), "A");
    await userEvent.click(screen.getByTestId("M-save"));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toStrictEqual({
      ...priorCourseworkFixtures.elsewhere,
      term: "S24",
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
    expect(screen.getByTestId("M-freeText")).not.toBeChecked();
    expect(screen.getByTestId("M-grade")).toHaveValue("");
  });

  describe("term", () => {
    afterEach(() => vi.useRealTimers());

    test("is a dropdown of quarters, current first, back 8 years, with a legend", () => {
      // 2026-11-03 is in the fall quarter.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 10, 3, 12, 0, 0));
      renderModal();

      const options = within(screen.getByTestId("M-term"))
        .getAllByRole("option")
        .map((option) => option.textContent);
      expect(options[0]).toBe("Select a term");
      expect(options[1]).toBe("F26");
      expect(options[2]).toBe("M26");
      expect(options[options.length - 1]).toBe("F18");
      expect(options).toHaveLength(1 + 33);
      expect(screen.getByTestId("M-termLegend")).toHaveTextContent(
        "F: Fall, W: Winter, S: Spring, M: Summer",
      );
      expect(screen.getByTestId("M-termLegend")).toHaveClass("small");
      expect(
        screen.getByLabelText("Check to enter term in free text"),
      ).not.toBeChecked();
      expect(screen.queryByTestId("M-termText")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Term")).toBe(screen.getByTestId("M-term"));
      expect(screen.getByTestId("M-term")).toHaveAttribute("id", "M-term");
      expect(screen.getByTestId("M-freeText")).toHaveAttribute(
        "id",
        "M-freeText",
      );
    });

    test("a chosen quarter is saved", async () => {
      const { onSave } = renderModal();
      await userEvent.type(screen.getByTestId("M-courseNumber"), "CS 1");
      await userEvent.selectOptions(screen.getByTestId("M-term"), "W25");
      await userEvent.click(screen.getByTestId("M-save"));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave.mock.calls[0][0].term).toBe("W25");
    });

    test("a standard term older than the dropdown is still offered", () => {
      renderModal({
        course: { ...priorCourseworkFixtures.ucsbCourse, term: "F05" },
      });
      expect(screen.getByTestId("M-term")).toHaveValue("F05");
      expect(screen.getByTestId("M-freeText")).not.toBeChecked();
    });

    test("a term that cannot be converted opens in free text, and is saved as typed", async () => {
      const { onSave } = renderModal({
        course: { ...priorCourseworkFixtures.ucsbCourse, term: "Semester 1" },
      });
      expect(screen.getByTestId("M-freeText")).toBeChecked();
      expect(screen.getByTestId("M-termText")).toHaveValue("Semester 1");
      expect(screen.queryByTestId("M-term")).not.toBeInTheDocument();
      expect(screen.queryByTestId("M-termLegend")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Term")).toBe(
        screen.getByTestId("M-termText"),
      );

      await userEvent.click(screen.getByTestId("M-save"));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave.mock.calls[0][0].term).toBe("Semester 1");
    });

    test("free text that can be made standard is saved in the standard form", async () => {
      const { onSave } = renderModal();
      await userEvent.type(screen.getByTestId("M-courseNumber"), "CS 1");
      await userEvent.click(screen.getByTestId("M-freeText"));
      await userEvent.type(screen.getByTestId("M-termText"), "Fall 2025");
      await userEvent.click(screen.getByTestId("M-save"));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave.mock.calls[0][0].term).toBe("F25");
    });

    test("ticking free text carries the chosen quarter over; unticking carries a standard one back", async () => {
      renderModal();
      await userEvent.selectOptions(screen.getByTestId("M-term"), "S25");
      await userEvent.click(screen.getByTestId("M-freeText"));
      expect(screen.getByTestId("M-termText")).toHaveValue("S25");

      await userEvent.clear(screen.getByTestId("M-termText"));
      await userEvent.type(screen.getByTestId("M-termText"), "Winter 2024");
      await userEvent.click(screen.getByTestId("M-freeText"));
      expect(screen.getByTestId("M-term")).toHaveValue("W24");
    });

    test("unticking free text with an unconvertible term clears the dropdown", async () => {
      renderModal({
        course: { ...priorCourseworkFixtures.ucsbCourse, term: "Semester 1" },
      });
      await userEvent.click(screen.getByTestId("M-freeText"));
      expect(screen.getByTestId("M-term")).toHaveValue("");
    });
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

  // Issue #309: the modal sits inside the application form in the React tree.
  test("saving does not submit a form the modal is rendered inside", async () => {
    const outerSubmit = vi.fn((event) => event.preventDefault());
    const onSave = vi.fn();
    render(
      <form onSubmit={outerSubmit}>
        <PriorCourseworkModal
          show={true}
          course={null}
          onSave={onSave}
          onCancel={vi.fn()}
          testIdPrefix="M"
        />
      </form>,
    );
    await userEvent.type(screen.getByTestId("M-courseNumber"), "CMPSC 24");
    await userEvent.click(screen.getByTestId("M-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(outerSubmit).not.toHaveBeenCalled();
  });

  // Issue #323: the columns hold 16 (grade), 64 (term) and 255 characters; the server refuses more.
  describe("length limits", () => {
    const paste = async (testId, text) => {
      await userEvent.click(screen.getByTestId(testId));
      await userEvent.paste(text);
    };

    const fields = [
      ["grade", "M-grade", 16, "grade", {}],
      ["course title", "M-courseTitle", 255, "courseTitle", {}],
      ["term typed as free text", "M-termText", 64, "term", { freeText: true }],
      ["course number", "M-courseNumber", 255, "courseNumber", {}],
      ["other school", "M-otherSchool", 255, "otherSchool", { other: true }],
    ];

    test.each(fields)(
      "%s is accepted at %i characters and refused one over",
      async (_name, testId, max, key, how) => {
        const { onSave } = renderModal();
        if (how.other)
          await userEvent.click(screen.getByTestId("M-ucsbCourse"));
        if (how.freeText)
          await userEvent.click(screen.getByTestId("M-freeText"));
        if (key !== "courseNumber") await paste("M-courseNumber", "CMPSC 24");
        if (key === "otherSchool") {
          // nothing else needed
        }

        // One over: shown as invalid, with the message, and nothing is saved.
        await paste(testId, "x".repeat(max + 1));
        await userEvent.click(screen.getByTestId("M-save"));
        await waitFor(() =>
          expect(screen.getByTestId(testId)).toHaveClass("is-invalid"),
        );
        expect(
          screen
            .getByTestId(testId)
            .parentElement.querySelector(".invalid-feedback"),
        ).toHaveTextContent(`${max} characters max`);
        expect(onSave).not.toHaveBeenCalled();

        // At the limit: saved.
        await userEvent.clear(screen.getByTestId(testId));
        await paste(testId, "x".repeat(max));
        await userEvent.click(screen.getByTestId("M-save"));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(screen.getByTestId(testId)).not.toHaveClass("is-invalid");
      },
    );

    test("spaces around a value do not count towards its limit", async () => {
      const { onSave } = renderModal();
      await paste("M-courseNumber", "CMPSC 24");
      await paste("M-grade", `  ${"x".repeat(16)}  `);
      await userEvent.click(screen.getByTestId("M-save"));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave.mock.calls[0][0].grade).toBe("x".repeat(16));
    });
  });
});
