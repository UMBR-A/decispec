import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "../app/page";
import { LiveAnalysisWorkspace } from "../components/LiveAnalysisWorkspace";

afterEach(cleanup);

describe("product presentation and accessibility", () => {
  it("explains the required inputs and the deterministic result on the landing page", () => {
    render(<Home />);

    expect(screen.getByText("Source evidence")).toBeInTheDocument();
    expect(screen.getByText("AI-written recommendation")).toBeInTheDocument();
    expect(screen.getByText(/binds each claim to exact source text/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Analyze my decision/i })).toHaveAttribute("href", "/workspace/live");
  });

  it("associates live analysis inputs with explicit labels and guidance", () => {
    render(<LiveAnalysisWorkspace />);

    expect(screen.getByRole("textbox", { name: "AI-written memo" })).toHaveAttribute("aria-describedby", expect.stringContaining("draft-recommendation-help"));
    expect(screen.getByRole("textbox", { name: "Evidence documents" })).toHaveAttribute("aria-describedby", "supporting-evidence-help");
    expect(screen.getByTestId("test-live-decision")).toBeDisabled();
    expect(screen.getByText(/API is called only when you press Test decision/i)).toBeInTheDocument();
  });
});
