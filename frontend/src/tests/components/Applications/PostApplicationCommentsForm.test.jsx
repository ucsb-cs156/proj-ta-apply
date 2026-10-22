import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PostApplicationCommentsForm from "main/components/Applications/PostApplicationCommentsForm";

describe("PostApplicationCommentsForm tests", () => {
  test("renders the field and its own save button", () => {
    render(<PostApplicationCommentsForm submitAction={vi.fn()} />);

    expect(screen.getByText("Post Application Comments")).toBeInTheDocument();
    expect(
      screen.getByTestId("PostApplicationCommentsForm-submit"),
    ).toHaveTextContent("Save Comments");
  });

  test("starts from the saved comments", () => {
    render(
      <PostApplicationCommentsForm
        initialContents="Finished CS 130A"
        submitAction={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("PostApplicationCommentsForm-postApplicationComments"),
    ).toHaveValue("Finished CS 130A");
  });

  /** An application that has never had comments must not start with the word "null" in it. */
  test("no saved comments means an empty box", () => {
    render(
      <PostApplicationCommentsForm
        initialContents={null}
        submitAction={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("PostApplicationCommentsForm-postApplicationComments"),
    ).toHaveValue("");
  });

  test("submits what was typed", async () => {
    const submitAction = vi.fn();
    render(<PostApplicationCommentsForm submitAction={submitAction} />);

    await userEvent.type(
      screen.getByTestId("PostApplicationCommentsForm-postApplicationComments"),
      "Took CS 190J since",
    );
    await userEvent.click(
      screen.getByTestId("PostApplicationCommentsForm-submit"),
    );

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].postApplicationComments).toBe(
      "Took CS 190J since",
    );
  });

  test("the test id prefix can be overridden", () => {
    render(
      <PostApplicationCommentsForm
        submitAction={vi.fn()}
        testIdPrefix="ApplicationPage"
      />,
    );

    expect(screen.getByTestId("ApplicationPage-submit")).toBeInTheDocument();
  });
});
