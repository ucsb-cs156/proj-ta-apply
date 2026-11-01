import { render, screen } from "@testing-library/react";
import ApplicationOriginBadge from "main/components/Applications/ApplicationOriginBadge";
import { originLabel } from "main/utils/adminApplications";

describe("ApplicationOriginBadge tests", () => {
  test("an applicant's own application gets no badge and no label", () => {
    const { container } = render(
      <ApplicationOriginBadge origin="APPLICANT" testId="badge" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(originLabel("APPLICANT")).toBe("");
  });

  test("an admin's test application gets a yellow badge", () => {
    render(<ApplicationOriginBadge origin="ADMIN_TEST" testId="badge" />);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Test application (admin)");
    expect(badge).toHaveClass("text-bg-warning");
    expect(badge).not.toHaveClass("text-bg-danger");
  });

  test("a developer-mode fake application gets a red badge", () => {
    render(<ApplicationOriginBadge origin="DEVELOPER_MODE" testId="badge" />);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Fake application (developer mode)");
    expect(badge).toHaveClass("text-bg-danger");
    expect(badge).not.toHaveClass("text-bg-warning");
  });

  test("the short form says just test or fake", () => {
    const { rerender } = render(
      <ApplicationOriginBadge origin="ADMIN_TEST" short testId="badge" />,
    );
    expect(screen.getByTestId("badge")).toHaveTextContent(/^test$/);
    rerender(
      <ApplicationOriginBadge origin="DEVELOPER_MODE" short testId="badge" />,
    );
    expect(screen.getByTestId("badge")).toHaveTextContent(/^fake$/);
  });
});
