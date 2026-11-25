import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import SoftOfferSection from "main/components/Student/SoftOfferSection";
import softOfferFixtures from "fixtures/softOfferFixtures";
import quartersFixtures from "fixtures/quartersFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const axiosMock = new AxiosMockAdapter(axios);
// W26 ULA (id 2), the recruitment of the fixtures' offer.
const ula = recruitmentsFixtures.threeRecruitments[1];

function renderSection(offer = softOfferFixtures.pending, props = {}) {
  const onRespond = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SoftOfferSection
        offer={offer}
        recruitment={ula}
        onRespond={onRespond}
        testIdPrefix="SO"
        {...props}
      />
    </QueryClientProvider>,
  );
  return onRespond;
}

describe("SoftOfferSection tests (issue #486)", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet("/api/quarters/one").reply(404, { message: "no" });
  });

  test("shows the lecture, its sections, the notice filled in for the quarter, the deadline and the question", async () => {
    renderSection();

    expect(screen.getByTestId("SO")).toHaveClass("border-top");
    expect(screen.getByTestId("SO-title")).toHaveTextContent("Soft Offer");
    expect(screen.getByTestId("SO-intro")).toHaveTextContent(
      "You have been recommended for a ULA position for the following course:",
    );
    const course = screen.getByTestId("SO-course");
    expect(
      [...course.querySelectorAll("th")].map((th) => th.textContent),
    ).toEqual([
      "Course Number",
      "Instructor",
      "Instructor Email",
      "Lecture Day",
      "Lecture Start Time",
      "Lecture End Time",
    ]);
    expect(screen.getByTestId("SO-course-number")).toHaveTextContent(
      "CMPSC 156",
    );
    expect(screen.getByTestId("SO-course-instructor")).toHaveTextContent(
      "CONRAD P",
    );
    expect(screen.getByTestId("SO-course-instructor-email")).toHaveTextContent(
      "phtcon@ucsb.edu",
    );
    expect(screen.getByTestId("SO-course-days")).toHaveTextContent("T R");
    expect(screen.getByTestId("SO-course-begin")).toHaveTextContent("14:00");
    expect(screen.getByTestId("SO-course-end")).toHaveTextContent("15:15");

    const sections = screen.getByTestId("SO-sections");
    expect(
      [...sections.querySelectorAll("th")].map((th) => th.textContent),
    ).toEqual([
      "Section",
      "Section Day",
      "Section Start Time",
      "Section End Time",
    ]);
    expect(
      [...screen.getByTestId("SO-section-0").querySelectorAll("td")].map(
        (td) => td.textContent,
      ),
    ).toEqual(["0101", "W", "09:00", "09:50"]);
    expect(
      [...screen.getByTestId("SO-section-2").querySelectorAll("td")].map(
        (td) => td.textContent,
      ),
    ).toEqual(["0103", "", "", ""]);
    expect(screen.getByTestId("SO-sections-note")).toHaveTextContent(
      "Which section(s) you will staff is decided by the instructor.",
    );
    expect(screen.queryByTestId("SO-sections-unavailable")).toBeNull();
    expect(screen.queryByTestId("SO-sections-none")).toBeNull();

    const notice = screen.getByTestId("SO-notice");
    expect(notice.querySelector("h1")).toHaveTextContent("Congratulations");
    expect(notice).toHaveTextContent(
      "You have been recommended for a ULA position for Winter 2026.",
    );

    expect(screen.getByTestId("SO-deadline")).toHaveTextContent(
      "Please choose an option below by 2/25/2026, 5:00:00 PM. If you do not respond by that deadline, we may need to offer this position to another candidate.",
    );
    const proceed = screen.getByTestId("SO-choice-PROCEED");
    const decline = screen.getByTestId("SO-choice-DECLINE");
    expect(proceed).toHaveAttribute("type", "radio");
    // One group, so choosing one unchecks the other.
    expect(proceed).toHaveAttribute("name", "SO-decision");
    expect(decline).toHaveAttribute("name", "SO-decision");
    expect(
      screen.getByLabelText(
        "Please proceed with a formal offer; I am likely to accept.",
      ),
    ).toBe(proceed);
    expect(screen.getByLabelText("I would like to decline this offer.")).toBe(
      decline,
    );
    expect(proceed).not.toBeChecked();
    expect(decline).not.toBeChecked();
    expect(screen.getByLabelText("Comments (optional)")).toBe(
      screen.getByTestId("SO-comments"),
    );
    expect(screen.getByTestId("SO-comments").id).toBe("SO-comments");
    expect(screen.getByTestId("SO-comments")).toHaveAttribute(
      "maxlength",
      "4000",
    );
    expect(screen.getByTestId("SO-submit")).toHaveTextContent(
      "Submit My Response",
    );
    expect(screen.getByTestId("SO-submit")).toBeDisabled();
    expect(screen.queryByTestId("SO-answer")).toBeNull();
  });

  test("Submit My Response is enabled once a choice is made, and sends the choice and the comments", async () => {
    const onRespond = renderSection();

    await userEvent.click(screen.getByTestId("SO-choice-DECLINE"));
    expect(screen.getByTestId("SO-choice-DECLINE")).toBeChecked();
    expect(screen.getByTestId("SO-choice-PROCEED")).not.toBeChecked();
    expect(screen.getByTestId("SO-submit")).toBeEnabled();
    await userEvent.click(screen.getByTestId("SO-choice-PROCEED"));
    expect(screen.getByTestId("SO-choice-PROCEED")).toBeChecked();
    expect(screen.getByTestId("SO-choice-DECLINE")).not.toBeChecked();
    await userEvent.type(screen.getByTestId("SO-comments"), "Thanks!");
    await userEvent.click(screen.getByTestId("SO-submit"));

    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenCalledWith("PROCEED", "Thanks!");
  });

  test("submitting the form with no choice made sends nothing", () => {
    const onRespond = renderSection();

    fireEvent.submit(screen.getByTestId("SO-form"));

    expect(onRespond).not.toHaveBeenCalled();
  });

  test("declining with no comments sends an empty comment", async () => {
    const onRespond = renderSection();

    await userEvent.click(screen.getByTestId("SO-choice-DECLINE"));
    await userEvent.click(screen.getByTestId("SO-submit"));

    expect(onRespond).toHaveBeenCalledWith("DECLINE", "");
  });

  test("the button is disabled while an answer is being sent", async () => {
    const onRespond = renderSection(softOfferFixtures.pending, {
      responding: true,
    });

    await userEvent.click(screen.getByTestId("SO-choice-PROCEED"));
    expect(screen.getByTestId("SO-submit")).toBeDisabled();
    await userEvent.click(screen.getByTestId("SO-submit"));
    expect(onRespond).not.toHaveBeenCalled();
  });

  test("without sections from the API, says so; with none listed, says that; blanks for unknown details; no notice block without a notice", () => {
    renderSection(softOfferFixtures.bare);

    expect(screen.getByTestId("SO-sections-unavailable")).toHaveTextContent(
      "Section times are not available right now.",
    );
    expect(screen.queryByTestId("SO-sections")).toBeNull();
    expect(screen.queryByTestId("SO-sections-note")).toBeNull();
    expect(screen.queryByTestId("SO-notice")).toBeNull();
    expect(screen.getByTestId("SO-course-instructor")).toHaveTextContent("");
    expect(screen.getByTestId("SO-course-instructor-email")).toHaveTextContent(
      "",
    );
    expect(screen.getByTestId("SO-course-days")).toHaveTextContent("");
    expect(screen.getByTestId("SO-course-begin")).toHaveTextContent("");
    expect(screen.getByTestId("SO-course-end")).toHaveTextContent("");
    // The question is still asked.
    expect(screen.getByTestId("SO-submit")).toBeInTheDocument();
  });

  test("a lecture the API lists no sections for says so", () => {
    renderSection(softOfferFixtures.noSections);

    expect(screen.getByTestId("SO-sections-none")).toHaveTextContent(
      "This lecture has no discussion sections listed.",
    );
    expect(screen.queryByTestId("SO-sections")).toBeNull();
    expect(screen.queryByTestId("SO-sections-unavailable")).toBeNull();
  });

  test("the notice renders GitHub-flavoured Markdown", () => {
    renderSection({
      ...softOfferFixtures.pending,
      notice: { id: 2, content: "Hours are ~~20~~ 10 per week." },
    });

    expect(
      screen.getByTestId("SO-notice").querySelector("del"),
    ).toHaveTextContent("20");
  });

  test("the notice's calendar fields are filled from the quarter on file", async () => {
    axiosMock.onGet("/api/quarters/one").reply(200, {
      ...quartersFixtures.threeNewestFirst[0],
      quarter: "20261",
    });
    renderSection({
      ...softOfferFixtures.pending,
      notice: { id: 2, content: "Classes start ${firstDayOfClasses}." },
    });

    expect(
      await screen.findByText(/Classes start [A-Z][a-z]+ \d+, \d{4}\./),
    ).toBeInTheDocument();
    expect(axiosMock.history.get[0].params).toEqual({ yyyyq: "20261" });
  });

  test("once answered to proceed, the answer is read-only with the time, the comments and whom to contact", () => {
    renderSection(softOfferFixtures.proceeded);

    expect(screen.queryByTestId("SO-form")).toBeNull();
    expect(screen.queryByTestId("SO-deadline")).toBeNull();
    expect(screen.queryByTestId("SO-submit")).toBeNull();
    const answer = screen.getByTestId("SO-answer");
    expect(
      within(answer)
        .getAllByRole("term")
        .map((t) => t.textContent),
    ).toEqual(["Your choice", "Submitted", "Comments"]);
    expect(screen.getByTestId("SO-answer-decision")).toHaveTextContent(
      "Please proceed with a formal offer; I am likely to accept.",
    );
    expect(screen.getByTestId("SO-answer-time")).toHaveTextContent(
      "2/21/2026, 8:05:00 AM",
    );
    expect(screen.getByTestId("SO-answer-comments")).toHaveTextContent(
      "Looking forward to it.",
    );
    expect(screen.getByTestId("SO-answer-sentence")).toHaveTextContent(
      "You have indicated that you would like to proceed to a formal offer. If you change your mind after submitting this form, please contact the ULA program directors, or the CS Department Student Affairs Manager.",
    );
    // The course and the notice are still shown above it.
    expect(screen.getByTestId("SO-course-number")).toHaveTextContent(
      "CMPSC 156",
    );
    expect(screen.getByTestId("SO-notice")).toBeInTheDocument();
  });

  test("once declined, the sentence is about declining and empty comments read (none)", () => {
    renderSection(softOfferFixtures.declined);

    expect(screen.getByTestId("SO-answer-decision")).toHaveTextContent(
      "I would like to decline this offer.",
    );
    expect(screen.getByTestId("SO-answer-time")).toHaveTextContent(
      "2/22/2026, 7:45:30 PM",
    );
    expect(screen.getByTestId("SO-answer-comments")).toHaveTextContent(
      "(none)",
    );
    expect(screen.getByTestId("SO-answer-sentence")).toHaveTextContent(
      "You have indicated that you would like to decline this offer. If you change your mind",
    );
  });

  test("uses SoftOfferSection as the default test id prefix", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SoftOfferSection
          offer={softOfferFixtures.pending}
          recruitment={ula}
          onRespond={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("SoftOfferSection")).toBeInTheDocument();
    expect(screen.getByTestId("SoftOfferSection-submit")).toBeDisabled();
  });
});
