import { render, screen } from "@testing-library/react";
import RequiredField from "main/components/Common/RequiredField";
import RequiredFieldExplanation from "main/components/Common/RequiredFieldExplanation";

/** Every element in the tree must be one HTML treats as inline, so the mark can live in a label. */
const INLINE_TAGS = ["SPAN", "ABBR", "B", "EM", "I", "STRONG", "SMALL", "SUP"];
const allInline = (element) =>
  [element, ...element.querySelectorAll("*")].every((el) =>
    INLINE_TAGS.includes(el.tagName),
  );

describe("RequiredField tests", () => {
  test("is a red asterisk in an inline span, styled by one CSS class", () => {
    render(<RequiredField />);

    const mark = screen.getByTestId("RequiredField");
    expect(mark.tagName).toBe("SPAN");
    expect(mark).toHaveTextContent("*");
    expect(mark).toHaveClass("required-field");
    expect(mark).toHaveAttribute("title", "Required");
    expect(allInline(mark)).toBe(true);
  });

  test("sits inside a label without breaking it", () => {
    render(
      <label htmlFor="x">
        Name <RequiredField />
      </label>,
    );
    expect(screen.getByText(/^Name/).tagName).toBe("LABEL");
    expect(screen.getByText(/^Name/)).toContainElement(
      screen.getByTestId("RequiredField"),
    );
  });
});

describe("RequiredFieldExplanation tests", () => {
  test("explains the mark using the mark itself, all inline", () => {
    render(<RequiredFieldExplanation />);

    const explanation = screen.getByTestId("RequiredFieldExplanation");
    expect(explanation.tagName).toBe("SPAN");
    expect(explanation).toHaveClass("required-field-explanation");
    expect(explanation).toHaveTextContent("Fields marked * are required.");
    // The example mark is the real component, so restyling it restyles the explanation too.
    expect(explanation).toContainElement(screen.getByTestId("RequiredField"));
    expect(allInline(explanation)).toBe(true);
  });
});
