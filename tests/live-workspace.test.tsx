import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveAnalysisWorkspace } from "../components/LiveAnalysisWorkspace";
import { demoProject, demoSourceSpanIds } from "../lib/demo/fixture";
import { evaluateGraph, resetGraph } from "../lib/domain/engine";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("live analysis workspace", () => {
  it("calls live analysis only after explicit action and renders engine-derived results", async () => {
    const graph = resetGraph(demoProject.graph);
    const evaluation = evaluateGraph(graph, demoSourceSpanIds);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      provider: { name: "OpenAI", mode: "live-openai", model: "gpt-5.6-terra" },
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      requestId: "req_mock",
      latencyMs: 1000,
      analysis: { sourceSpans: demoProject.sourceSpans, graph },
      evaluation,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<LiveAnalysisWorkspace />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/recommendation you want to test/i), { target: { value: "Select Vendor A." } });
    fireEvent.change(screen.getByPlaceholderText(/Paste evidence text/i), { target: { value: "Evidence passage." } });
    fireEvent.click(screen.getByTestId("test-live-decision"));
    await screen.findByRole("heading", { name: "Decision broken" });
    expect(screen.getByRole("heading", { name: "Decision Test Suite" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(request.body)).not.toMatch(/OPENAI_API_KEY|sk-proj/i);
  });

  it("shows a safe error and never substitutes the demo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "Analysis could not be completed.", code: "timeout" }), { status: 504, headers: { "Content-Type": "application/json" } }));
    render(<LiveAnalysisWorkspace />);
    fireEvent.change(screen.getByPlaceholderText(/recommendation you want to test/i), { target: { value: "A draft" } });
    fireEvent.change(screen.getByPlaceholderText(/Paste evidence text/i), { target: { value: "Evidence" } });
    fireEvent.click(screen.getByTestId("test-live-decision"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Analysis could not be completed"));
    expect(screen.queryByText("Vendor B is $182,748 less")).not.toBeInTheDocument();
  });
});
