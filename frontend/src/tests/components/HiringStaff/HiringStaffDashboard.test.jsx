import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import HiringStaffDashboard from "main/components/HiringStaff/HiringStaffDashboard";
import HiringStaffRecruitmentCard from "main/components/HiringStaff/HiringStaffRecruitmentCard";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("HiringStaffDashboard (issue #505)", () => {
  const older = {
    ...recruitmentsFixtures.releasedUla,
    id: 7,
    quarter: "20244",
    softOffersReleasedAt: "2024-10-01T08:00:00",
    softOfferDeadline: "2024-10-08T17:00:00",
  };

  test("a card per recruitment, in the order given, under the heading", () => {
    renderIn(
      <HiringStaffDashboard
        recruitments={[recruitmentsFixtures.releasedUla, older]}
        testIdPrefix="H"
      />,
    );
    expect(screen.getByTestId("H-heading")).toHaveTextContent(
      "ULA Recruitments with Soft Offers Released",
    );
    expect(screen.getByTestId("H-heading").tagName).toBe("H3");
    const names = [
      ...screen.getByTestId("H").querySelectorAll("[data-testid$='-name']"),
    ].map((e) => e.textContent);
    expect(names).toEqual(["F25 ULA", "F24 ULA"]);
    expect(screen.getByTestId("H-card-7-release")).toHaveTextContent(
      "Soft offers released 10/1/2024, 8:00:00 AM. Deadline: 10/8/2024, 5:00:00 PM.",
    );
    expect(
      screen.getByTestId("H-card-7-soft-offer-results-button"),
    ).toHaveAttribute("href", "/admin/recruitments/7/softOffers");
    expect(screen.queryByTestId("H-none")).toBeNull();
  });

  test("says so when there is nothing, and treats a non-list as nothing", () => {
    renderIn(<HiringStaffDashboard recruitments={[]} testIdPrefix="H" />);
    expect(screen.getByTestId("H-none")).toHaveTextContent(
      "No ULA recruitment has released soft offers yet.",
    );
    expect(screen.queryByTestId("H-card-5-card")).toBeNull();

    renderIn(
      <HiringStaffDashboard recruitments={undefined} testIdPrefix="G" />,
    );
    expect(screen.getByTestId("G-none")).toBeInTheDocument();
  });

  test("the defaults: the dashboard's and the card's own prefixes", () => {
    renderIn(<HiringStaffDashboard recruitments={[]} />);
    expect(screen.getByTestId("HiringStaffDashboard-none")).toBeInTheDocument();
    renderIn(
      <HiringStaffRecruitmentCard
        recruitment={recruitmentsFixtures.releasedUla}
      />,
    );
    expect(
      screen.getByTestId("HiringStaffRecruitmentCard-name"),
    ).toHaveTextContent("F25 ULA");
  });

  test("the card has exactly one button, Soft Offer Results", () => {
    renderIn(
      <HiringStaffRecruitmentCard
        recruitment={recruitmentsFixtures.releasedUla}
        testIdPrefix="C"
      />,
    );
    const card = screen.getByTestId("C-card");
    expect(card.querySelectorAll("a, button")).toHaveLength(1);
    const button = screen.getByTestId("C-soft-offer-results-button");
    expect(button).toHaveTextContent("Soft Offer Results");
    expect(button).toHaveClass("btn", "btn-primary");
    expect(button).toHaveAttribute("href", "/admin/recruitments/5/softOffers");
    expect(screen.getByTestId("C-release")).toHaveTextContent(
      "Soft offers released 10/20/2025, 9:30:00 AM. Deadline: 10/25/2025, 5:00:00 PM.",
    );
  });
});
