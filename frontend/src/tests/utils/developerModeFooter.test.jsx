import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { useState } from "react";

import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import DeveloperModeFooterProvider from "main/components/Nav/DeveloperModeFooterProvider";
import {
  useDeveloperModeFooterControls,
  useDeveloperModeFooterControlsValue,
} from "main/utils/developerModeFooter";
import { currentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

/** A page that registers a control in the footer's developer-mode slot while it is mounted. */
function RegisteringPage({ label }) {
  useDeveloperModeFooterControls(<button>{label}</button>);
  return <div>page body</div>;
}

/** Reads the slot directly, to show what a registering component put there. */
function SlotReader() {
  const controls = useDeveloperModeFooterControlsValue();
  return <div data-testid="slot">{controls ?? "nothing registered"}</div>;
}

function Harness({ initiallyMounted = true }) {
  const [mounted, setMounted] = useState(initiallyMounted);
  const [label, setLabel] = useState("Create Fake Things");
  return (
    <DeveloperModeFooterProvider>
      {mounted && <RegisteringPage label={label} />}
      <SlotReader />
      <button onClick={() => setMounted((m) => !m)}>toggle page</button>
      <button onClick={() => setLabel("Delete Fake Things")}>relabel</button>
    </DeveloperModeFooterProvider>
  );
}

describe("developer-mode footer slot", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.developerModeAvailable);
  });

  test("outside any provider the slot is empty and registering is harmless", () => {
    render(<SlotReader />);
    expect(screen.getByTestId("slot")).toHaveTextContent("nothing registered");
    render(<RegisteringPage label="orphan" />);
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  test("a mounted component's controls fill the slot, and leave it when it unmounts", () => {
    render(<Harness />);

    expect(screen.getByTestId("slot")).toHaveTextContent("Create Fake Things");
    expect(
      screen.getByRole("button", { name: "Create Fake Things" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "toggle page" }));
    expect(screen.getByTestId("slot")).toHaveTextContent("nothing registered");
  });

  test("when the registered controls change, the slot follows", () => {
    render(<Harness />);
    expect(screen.getByTestId("slot")).toHaveTextContent("Create Fake Things");

    fireEvent.click(screen.getByRole("button", { name: "relabel" }));

    expect(screen.getByTestId("slot")).toHaveTextContent("Delete Fake Things");
    expect(screen.queryByText("Create Fake Things")).not.toBeInTheDocument();
  });

  test("BasicLayout provides the slot, so a page's controls reach the footer while developer mode is on", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(["current user"], currentUserFixtures.adminUser);
    qc.setQueryData(["systemInfo"], systemInfoFixtures.developerModeAvailable);
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <BasicLayout>
            <RegisteringPage label="Create Fake Things" />
          </BasicLayout>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const controls = await screen.findByTestId(
      "Footer-developer-mode-controls",
    );
    expect(controls).toHaveTextContent("Create Fake Things");
    expect(
      screen.getByTestId("Footer-developer-mode-badge"),
    ).toBeInTheDocument();
  });
});
