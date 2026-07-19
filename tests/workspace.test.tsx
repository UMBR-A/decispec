import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DecisionWorkspace } from "../components/DecisionWorkspace";

describe("decision workspace hero flow", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("selects a claim and exposes its derived dependency state", () => {
    render(<DecisionWorkspace />);
    expect(screen.getByTestId("export-proof")).toBeDisabled();
    expect(screen.getByTestId("view-report")).toBeDisabled();
    expect(screen.getByText("Ready to run 7 deterministic checks")).toBeInTheDocument();
    expect(screen.getByTestId("verify-decision")).toHaveTextContent("Run decision tests");
    expect(screen.getByRole("row", { name: /Inspect Vendor A total/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enrollment & Device Policy/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Imported Draft Decision Memo/i })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByTestId("claim-devices"));
    expect(screen.getByRole("heading", { name: "Required devices" })).toBeInTheDocument();
    expect(screen.getByText("Derived only from declared dependencies.")).toBeInTheDocument();
  });

  it("verifies, isolates the failure, applies correction, and resets", async () => {
    vi.useFakeTimers();
    render(<DecisionWorkspace />);
    fireEvent.click(screen.getByTestId("verify-decision"));
    for (let step = 0; step < 5; step += 1) {
      await act(async () => vi.advanceTimersByTime(400));
    }
    expect(screen.getByTestId("break-decision")).toBeInTheDocument();
    expect(screen.getByTestId("export-proof")).toBeEnabled();
    expect(screen.getByTestId("view-report")).toHaveAttribute("href", "/report/demo?state=original");
    expect(screen.getAllByText("$18 per device per month", { selector: "mark" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("break-decision"));
    expect(screen.getByText("The broken dependency path is isolated")).toBeInTheDocument();
    expect(screen.getByTestId("proof-graph")).toHaveAttribute("data-graph-view", "focused");
    expect(screen.getByTestId("proof-graph")).toHaveTextContent("Quote A · $18 / device / month");
    expect(screen.getByTestId("proof-graph")).not.toHaveTextContent("Student enrollment");
    fireEvent.click(screen.getByTestId("toggle-graph-focus"));
    expect(screen.getByTestId("proof-graph")).toHaveAttribute("data-graph-view", "full");
    expect(screen.getByTestId("proof-graph")).toHaveTextContent("Student enrollment");
    fireEvent.click(screen.getByTestId("toggle-graph-focus"));
    for (let step = 0; step < 4; step += 1) {
      await act(async () => vi.advanceTimersByTime(450));
    }
    expect(screen.getByTestId("proof-diff")).toHaveTextContent("Vendor B");
    fireEvent.click(screen.getByTestId("apply-correction"));
    expect(screen.getByTestId("vendor-a-total")).toHaveTextContent("$268,677");
    expect(screen.getByText("Select Vendor B")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reset-correction"));
    expect(screen.getByTestId("vendor-a-total")).toHaveTextContent("$78,003");
    expect(screen.getByText("Decision broken", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Imported recommendation · Select Vendor A")).toBeInTheDocument();
  });
});
