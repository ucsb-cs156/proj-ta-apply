import { render, screen } from "@testing-library/react";
import QuarterCards from "main/components/Quarters/QuarterCards";
import quartersFixtures from "fixtures/quartersFixtures";

describe("QuarterCards tests", () => {
  const cell = (quarter, suffix) =>
    screen.getByTestId(`QuarterCards-card-${quarter}-${suffix}`);

  test("one card per quarter, in the order given, with the names on the header", () => {
    render(<QuarterCards quarters={quartersFixtures.threeNewestFirst} />);

    const cards = screen.getByTestId("QuarterCards").querySelectorAll(".card");
    expect(cards).toHaveLength(3);
    expect(
      [
        ...screen
          .getByTestId("QuarterCards")
          .querySelectorAll("[data-testid$='-qyy']"),
      ].map((el) => el.textContent),
    ).toEqual(["S22", "W22", "F21"]);
    expect(cell("20214", "qyy")).toHaveTextContent("F21");
    expect(cell("20214", "qyy").tagName).toBe("STRONG");
    expect(cell("20214", "name")).toHaveTextContent("FALL 2021");
    expect(cell("20214", "quarter")).toHaveTextContent("20214");
    expect(cell("20214", "category")).toHaveTextContent("FALL");
    expect(cell("20214", "academicYear")).toHaveTextContent("2021-2022");
    expect(cell("20214", "card")).toHaveClass("card", "h-100");
    // The short and long names read as two words on the header.
    expect(
      cell("20214", "card").querySelector(".card-header"),
    ).toHaveTextContent("F21 FALL 2021");
  });

  test("every date is shown, the passes with their time, nulls blank", () => {
    render(
      <QuarterCards quarters={[quartersFixtures.f21, quartersFixtures.s22]} />,
    );

    expect(cell("20214", "firstDayOfQuarter")).toHaveTextContent("2021-09-26");
    expect(cell("20214", "firstDayOfClasses")).toHaveTextContent("2021-10-01");
    expect(cell("20214", "lastDayToAddUnderGrad")).toHaveTextContent(
      "2021-10-18",
    );
    expect(cell("20214", "lastDayToAddGrad")).toHaveTextContent("2021-10-18");
    expect(cell("20214", "lastDayThirdWeek")).toHaveTextContent("2021-10-19");
    expect(cell("20214", "lastDayOfClasses")).toHaveTextContent("2021-12-10");
    expect(cell("20214", "firstDayOfFinals")).toHaveTextContent("2021-12-11");
    expect(cell("20214", "lastDayOfFinals")).toHaveTextContent("2021-12-17");
    expect(cell("20214", "lastDayOfSchedule")).toHaveTextContent("2022-01-01");
    expect(cell("20214", "feeDeadline")).toHaveTextContent("2021-09-13");
    expect(cell("20214", "pass1Begin")).toHaveTextContent("2021-05-10 09:00");
    expect(cell("20214", "pass2Begin")).toHaveTextContent("2021-05-24 09:00");
    expect(cell("20214", "pass3Begin")).toHaveTextContent("2021-06-07 09:00");
    // The labels, in order, each beside its value.
    const labels = [...cell("20214", "card").querySelectorAll("dt")].map(
      (dt) => dt.textContent,
    );
    expect(labels).toEqual([
      "Category",
      "Academic year",
      "First day of quarter",
      "First day of classes",
      "Last day to add (undergrad)",
      "Last day to add (grad)",
      "Last day of third week",
      "Last day of classes",
      "First day of finals",
      "Last day of finals",
      "Last day of schedule",
      "Fee deadline",
      "Pass 1 begins",
      "Pass 2 begins",
      "Pass 3 begins",
    ]);
    expect(cell("20222", "lastDayOfClasses").textContent).toBe("");
    expect(cell("20222", "pass1Begin").textContent).toBe("");
    expect(screen.queryByText("null")).toBeNull();
  });

  test("no quarters, or something that is not a list, says so with the given prefix", () => {
    const { rerender } = render(
      <QuarterCards quarters={[]} testIdPrefix="Q" />,
    );
    expect(screen.getByTestId("Q-none")).toHaveTextContent(
      "No quarters on file yet.",
    );
    expect(screen.queryByTestId("Q")).toBeNull();

    rerender(<QuarterCards quarters={undefined} testIdPrefix="Q" />);
    expect(screen.getByTestId("Q-none")).toBeInTheDocument();

    rerender(
      <QuarterCards quarters={[quartersFixtures.w22]} testIdPrefix="Q" />,
    );
    expect(screen.getByTestId("Q-card-20221-qyy")).toHaveTextContent("W22");
    expect(screen.queryByTestId("Q-none")).toBeNull();
  });
});
