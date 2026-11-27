import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter as Router } from "react-router";
import { vi } from "vitest";

import FundingSourceForm, {
  ABBREVIATION_FIXED_NOTE,
  ABBREVIATION_REQUIRED,
  ABBREVIATION_TOO_LONG,
  EXPLANATION_REQUIRED,
} from "main/components/FundingSources/FundingSourceForm";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";

const mockedNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockedNavigate,
}));

/** Issue #512: the create and edit form of a funding source. */
describe("FundingSourceForm tests", () => {
  const testId = "FundingSourceForm";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders the two fields, the required-field note and the buttons", async () => {
    render(
      <Router>
        <FundingSourceForm submitAction={vi.fn()} />
      </Router>,
    );

    expect(await screen.findByTestId(`${testId}-abbreviation`)).toHaveValue("");
    expect(screen.getByTestId(`${testId}-explanation`)).toHaveValue("");
    expect(screen.getByLabelText(/^Abbreviation/)).toBe(
      screen.getByTestId(`${testId}-abbreviation`),
    );
    expect(screen.getByLabelText(/^Explanation/)).toBe(
      screen.getByTestId(`${testId}-explanation`),
    );
    expect(screen.getByTestId(`${testId}-abbreviation`)).not.toHaveAttribute(
      "readonly",
    );
    expect(screen.getByTestId(`${testId}-explanation`)).toHaveAttribute(
      "maxlength",
      "255",
    );
    expect(screen.queryByTestId(`${testId}-abbreviation-note`)).toBeNull();
    expect(screen.getByTestId(`${testId}-submit`)).toHaveTextContent("Create");
    expect(screen.getByTestId(`${testId}-cancel`)).toHaveTextContent("Cancel");
    expect(screen.getAllByText("*").length).toBeGreaterThanOrEqual(2);
  });

  test("Cancel goes back", async () => {
    render(
      <Router>
        <FundingSourceForm submitAction={vi.fn()} />
      </Router>,
    );
    fireEvent.click(await screen.findByTestId(`${testId}-cancel`));
    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith(-1));
  });

  test("refuses blank fields and names each one", async () => {
    const submitAction = vi.fn();
    render(
      <Router>
        <FundingSourceForm submitAction={submitAction} />
      </Router>,
    );

    fireEvent.change(await screen.findByTestId(`${testId}-abbreviation`), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByTestId(`${testId}-explanation`), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByTestId(`${testId}-submit`));

    expect(await screen.findByText(ABBREVIATION_REQUIRED)).toBeInTheDocument();
    expect(screen.getByText(EXPLANATION_REQUIRED)).toBeInTheDocument();
    expect(screen.getByTestId(`${testId}-abbreviation`)).toHaveClass(
      "is-invalid",
    );
    expect(screen.getByTestId(`${testId}-explanation`)).toHaveClass(
      "is-invalid",
    );
    expect(submitAction).not.toHaveBeenCalled();
  });

  test("refuses an abbreviation of more than 10 characters, counting it after trimming", async () => {
    const submitAction = vi.fn();
    render(
      <Router>
        <FundingSourceForm submitAction={submitAction} />
      </Router>,
    );

    const abbreviation = await screen.findByTestId(`${testId}-abbreviation`);
    fireEvent.change(abbreviation, { target: { value: " abcdefghijk " } });
    fireEvent.change(screen.getByTestId(`${testId}-explanation`), {
      target: { value: "Eleven letters" },
    });
    fireEvent.click(screen.getByTestId(`${testId}-submit`));

    expect(await screen.findByText(ABBREVIATION_TOO_LONG)).toBeInTheDocument();
    expect(screen.getByText(ABBREVIATION_TOO_LONG)).toHaveTextContent(
      "Abbreviation is at most 10 characters.",
    );
    expect(screen.queryByText(ABBREVIATION_REQUIRED)).toBeNull();
    expect(submitAction).not.toHaveBeenCalled();

    // Ten characters, once the spaces are trimmed, is accepted.
    fireEvent.change(abbreviation, { target: { value: " abcdefghij " } });
    fireEvent.click(screen.getByTestId(`${testId}-submit`));
    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction).toHaveBeenCalledWith({
      abbreviation: "abcdefghij",
      explanation: "Eleven letters",
    });
    expect(screen.queryByText(ABBREVIATION_TOO_LONG)).toBeNull();
  });

  test("submits both values trimmed, as typed (no upper-casing)", async () => {
    const submitAction = vi.fn();
    render(
      <Router>
        <FundingSourceForm submitAction={submitAction} />
      </Router>,
    );

    fireEvent.change(await screen.findByTestId(`${testId}-abbreviation`), {
      target: { value: "  nsf " },
    });
    fireEvent.change(screen.getByTestId(`${testId}-explanation`), {
      target: { value: " National Science Foundation  " },
    });
    fireEvent.click(screen.getByTestId(`${testId}-submit`));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction).toHaveBeenCalledWith({
      abbreviation: "nsf",
      explanation: "National Science Foundation",
    });
    expect(screen.getByTestId(`${testId}-abbreviation`)).not.toHaveClass(
      "is-invalid",
    );
  });

  test("on the edit page the fields are filled in and the abbreviation is read-only", async () => {
    const submitAction = vi.fn();
    render(
      <Router>
        <FundingSourceForm
          initialContents={fundingSourcesFixtures.oneSource}
          submitAction={submitAction}
          buttonLabel="Update"
          abbreviationReadOnly
        />
      </Router>,
    );

    const abbreviation = await screen.findByTestId(`${testId}-abbreviation`);
    expect(abbreviation).toHaveValue("NSF");
    expect(abbreviation).toHaveAttribute("readonly");
    expect(screen.getByTestId(`${testId}-explanation`)).toHaveValue(
      "National Science Foundation",
    );
    expect(screen.getByTestId(`${testId}-abbreviation-note`)).toHaveTextContent(
      ABBREVIATION_FIXED_NOTE,
    );
    expect(screen.getByTestId(`${testId}-abbreviation-note`)).toHaveTextContent(
      "The abbreviation cannot be changed. To change it, delete this funding source and create another.",
    );
    expect(screen.getByTestId(`${testId}-submit`)).toHaveTextContent("Update");

    fireEvent.change(screen.getByTestId(`${testId}-explanation`), {
      target: { value: "NSF grant " },
    });
    fireEvent.click(screen.getByTestId(`${testId}-submit`));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction).toHaveBeenCalledWith({
      abbreviation: "NSF",
      explanation: "NSF grant",
    });
  });
});
