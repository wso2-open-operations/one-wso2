// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JSX } from "react";
import { MemoryRouter, useLocation } from "react-router";
import DashboardAgentLauncher from "./DashboardAgentLauncher";
import * as api from "./dashboardAgentApi";
import type { Starter, Widget, WidgetResult } from "./dashboardAgentApi";

vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({ useAuthApiClient: () => vi.fn() }));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));
vi.mock("@wso2/oxygen-ui-charts-react", () => ({
  BarChart: ({ data }: { data: unknown[] }) => <div data-testid="bar-chart">{data.length} bars</div>,
}));
vi.mock("./dashboardAgentApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dashboardAgentApi")>()),
  fetchStarters: vi.fn(),
  interpretWidget: vi.fn(),
  runWidget: vi.fn(),
}));

const fetchStarters = vi.mocked(api.fetchStarters);
function LocationProbe(): JSX.Element {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

const interpretWidget = vi.mocked(api.interpretWidget);
const runWidget = vi.mocked(api.runWidget);

const kpiWidget = (title: string): Widget => ({
  title,
  visual: "kpi",
  spec: { dataset: "risks", measures: ["risk_count"], dimensions: [], filters: [], limit: 100 },
});
// The backend still sends ready-made views; the popup must not show them.
const starter: Starter = { id: "s1", title: "Risk heat map", description: "Open risks.", widget: kpiWidget("Risk heat map") };
const total = (n: number): WidgetResult => ({
  columns: [{ id: "risk_count", role: "measure", kind: "int", label: "Number of risks" }],
  rows: [[n]],
  truncated: false,
});

async function openChat(): Promise<void> {
  render(<DashboardAgentLauncher />);
  await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
}

async function ask(text: string): Promise<void> {
  await userEvent.type(screen.getByLabelText("Your request"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchStarters.mockResolvedValue([starter]);
  runWidget.mockResolvedValue(total(12));
});

describe("DashboardAgentLauncher", () => {
  it("shows nothing when the assistant is not available to the user", async () => {
    fetchStarters.mockResolvedValue(null);
    render(<DashboardAgentLauncher />);
    await waitFor(() => expect(fetchStarters).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Ask AI" })).not.toBeInTheDocument();
  });

  it("opens a chat that shows nothing until the user asks", async () => {
    await openChat();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Risk assistant")).toBeInTheDocument();
    expect(within(dialog).getByText(/ask me anything about your risks/i)).toBeInTheDocument();
    // No ready-made views, no widget, no query run by default.
    expect(within(dialog).queryByText("Risk heat map")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/build a dashboard widget/i)).not.toBeInTheDocument();
    expect(runWidget).not.toHaveBeenCalled();
    expect(interpretWidget).not.toHaveBeenCalled();
  });
});

describe("Audit assistant chat", () => {
  it("has its own wording and sends its questions to the audit assistant", async () => {
    interpretWidget.mockResolvedValue({ action: "reply", message: "Hello!" });
    render(
      <MemoryRouter>
        <DashboardAgentLauncher hub="audit" />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Audit assistant")).toBeInTheDocument();
    expect(within(dialog).getByText(/ask me anything about your audits/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/risks/i)).not.toBeInTheDocument();
    await ask("hi");
    expect(interpretWidget).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ message: "hi" }), "audit");
  });

  it("runs its widgets against the audit assistant too", async () => {
    interpretWidget.mockResolvedValue({
      action: "widget",
      widget: { title: "Controls", visual: "kpi", spec: { dataset: "controls", measures: ["control_count"], dimensions: [], filters: [], limit: 100 } },
    });
    runWidget.mockResolvedValue({ columns: [{ id: "control_count", label: "Number of controls", role: "measure", kind: "int" }], rows: [[12]], truncated: false, summary: "There are 12 controls." } as never);
    render(
      <MemoryRouter>
        <DashboardAgentLauncher hub="audit" />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    await ask("how many controls?");
    expect(await screen.findByText("There are 12 controls.")).toBeInTheDocument();
    expect(runWidget).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dataset: "controls" }), "audit");
  });
});

describe("Risk assistant chat", () => {
  it("answers a greeting in plain words and shows no widget", async () => {
    interpretWidget.mockResolvedValue({ action: "reply", message: "Hello! What would you like to know about your risks?" });
    await openChat();
    await ask("hi");

    expect(await screen.findByText("Hello! What would you like to know about your risks?")).toBeInTheDocument();
    expect(runWidget).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /show query/i })).not.toBeInTheDocument();
  });

  it("answers a data question with a widget inside the conversation", async () => {
    interpretWidget.mockResolvedValue({ action: "widget", widget: kpiWidget("Open risks"), note: "Counted by residual score." });
    await openChat();
    await ask("how many open risks are there");

    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("Open risks")).toBeInTheDocument();
    expect(screen.getByText("Counted by residual score.")).toBeInTheDocument();
    expect(runWidget).toHaveBeenCalledWith(expect.anything(), kpiWidget("Open risks").spec, "risk");
  });

  it("shows the sentence the backend wrote from the numbers", async () => {
    interpretWidget.mockResolvedValue({ action: "widget", widget: kpiWidget("Open risks") });
    runWidget.mockResolvedValue({ ...total(12), summary: "There are 12 risks." });
    await openChat();
    await ask("how many open risks");
    expect(await screen.findByText("There are 12 risks.")).toBeInTheDocument();
  });

  it("lists individual risks as a table when asked", async () => {
    const list: Widget = {
      title: "Approved risks",
      visual: "table",
      spec: { dataset: "risk_list", measures: [], dimensions: [], columns: ["risk_code", "risk_title"], filters: [], limit: 50 },
    };
    interpretWidget.mockResolvedValue({ action: "widget", widget: list });
    runWidget.mockResolvedValue({
      columns: [
        { id: "risk_code", role: "column", kind: "text", label: "Risk code" },
        { id: "risk_title", role: "column", kind: "text", label: "Title" },
      ],
      rows: [["2026-ASG-Q4-0001", "Weak TLS"]],
      truncated: false,
      summary: "Showing 1 risk.",
    });
    await openChat();
    await ask("list the approved risks");
    expect(await screen.findByText("Weak TLS")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 risk.")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Risk code" })).toBeInTheDocument();
  });

  it("keeps earlier answers on screen and refines the latest widget on a follow-up", async () => {
    interpretWidget
      .mockResolvedValueOnce({ action: "widget", widget: kpiWidget("Open risks") })
      .mockResolvedValueOnce({ action: "widget", widget: kpiWidget("Open risks, High only") });
    runWidget.mockResolvedValueOnce(total(30)).mockResolvedValueOnce(total(4));
    await openChat();

    await ask("open risks");
    expect(await screen.findByText("30")).toBeInTheDocument();
    expect(interpretWidget.mock.calls[0][1].current).toBeUndefined();

    await ask("only High");
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument(); // the first answer is still there

    const second = interpretWidget.mock.calls[1][1];
    expect(second.current?.title).toBe("Open risks");
    expect(second.history.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(second.message).toBe("only High");
  });

  it("answers a data question with a short lead-in, then the widget with its own title", async () => {
    interpretWidget.mockResolvedValue({ action: "widget", widget: kpiWidget("Your risks") });
    await openChat();
    await ask("what are the risks I have");
    expect(await screen.findByText("Here you go.")).toBeInTheDocument();
    expect(screen.getByText("Your risks")).toBeInTheDocument();
    expect(screen.queryByText(/here is your risks/i)).not.toBeInTheDocument();
  });

  it("tells the user when it could not find the person they asked about", async () => {
    interpretWidget.mockResolvedValue({
      action: "reply",
      message: "I couldn't find anyone called “tharushi”. Try their full name or their email.",
    });
    await openChat();
    await ask("tharushi's risks");
    expect(await screen.findByText(/couldn't find anyone called “tharushi”/)).toBeInTheDocument();
    expect(runWidget).not.toHaveBeenCalled();
  });

  it("offers a link to the risk it explains, and closes the popup when it is followed", async () => {
    interpretWidget.mockResolvedValue({
      action: "reply",
      message: "Risk 2026-INT-Q4-0002: “Weak TLS”\n\nWhere it stands\n• Status: Approved.",
      risk_link: { id: 7, code: "2026-INT-Q4-0002" },
    });
    render(
      <MemoryRouter>
        <DashboardAgentLauncher />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    await ask("tell me about 2026-INT-Q4-0002");

    const link = await screen.findByRole("link", { name: /open 2026-INT-Q4-0002 in risk registers/i });
    expect(link).toHaveAttribute("href", "/security/risk/registers?riskId=7");
    await userEvent.click(link);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("answers a single number as plain text, with no card", async () => {
    interpretWidget.mockResolvedValue({ action: "widget", widget: kpiWidget("Total risks"), note: "Showing all risks." });
    runWidget.mockResolvedValue({
      columns: [{ id: "risk_count", label: "Number of risks", role: "measure" }],
      rows: [[65]],
      truncated: false,
      summary: "There are 65 risks.",
    } as never);
    await openChat();
    await ask("how many risks do we have?");
    expect(await screen.findByText("There are 65 risks.")).toBeInTheDocument();
    expect(screen.queryByText("Total risks")).not.toBeInTheDocument();
    expect(screen.queryByText("Number of risks")).not.toBeInTheDocument();
    expect(screen.queryByText("Here you go.")).not.toBeInTheDocument();
    expect(screen.queryByText("Showing all risks.")).not.toBeInTheDocument();
  });

  it("takes the user to a control the assistant found, and closes the popup", async () => {
    interpretWidget.mockResolvedValue({
      action: "reply",
      message: "Taking you to CA-01 in HIPAA GRC Platform 2027.",
      navigate: { audit_id: 12, control_id: 340 },
    });
    render(
      <MemoryRouter initialEntries={["/security/audit/audits"]}>
        <DashboardAgentLauncher hub="audit" />
        <LocationProbe />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    await ask("take me to CA-01 in HIPAA GRC Platform 2027");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/security/audit/audits/12?control=340"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not take the user anywhere when no control was found", async () => {
    interpretWidget.mockResolvedValue({ action: "reply", message: "I couldn't find that control with the access you have." });
    render(
      <MemoryRouter initialEntries={["/security/audit/audits"]}>
        <DashboardAgentLauncher hub="audit" />
        <LocationProbe />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    await ask("take me to ZZ-99");
    expect(await screen.findByText(/couldn't find that control/)).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/security/audit/audits");
    expect(screen.getByTestId("where")).not.toHaveTextContent("control=");
  });

  it("links a control's number in a list, and never shows the ids", async () => {
    interpretWidget.mockResolvedValue({
      action: "widget",
      widget: { title: "Overdue controls", visual: "table", spec: { dataset: "control_list", columns: ["control_number", "audit"], measures: [], dimensions: [], filters: [], limit: 50 } },
    });
    runWidget.mockResolvedValue({
      columns: [
        { id: "control_number", label: "Control", role: "column", kind: "text" },
        { id: "audit", label: "Audit", role: "column", kind: "text" },
        { id: "audit_id", label: "Audit ID", role: "column", kind: "int" },
        { id: "control_id", label: "Control ID", role: "column", kind: "int" },
      ],
      rows: [["CA-01", "HIPAA 2027", 12, 340]],
      truncated: false,
    } as never);
    render(
      <MemoryRouter>
        <DashboardAgentLauncher hub="audit" />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    await ask("overdue controls");
    const link = await screen.findByRole("link", { name: "CA-01" });
    expect(link).toHaveAttribute("href", "/security/audit/audits/12?control=340");
    expect(screen.queryByText("Audit ID")).not.toBeInTheDocument();
    expect(screen.queryByText("340")).not.toBeInTheDocument();
  });

  it("describes a control with a link, a timeline and no navigation", async () => {
    interpretWidget.mockResolvedValue({
      action: "reply",
      message: "Control CA-01 in HIPAA 2027\n\nWhere it stands\n• Status: Complete.",
      control_link: { audit_id: 12, control_id: 340, code: "CA-01" },
      timeline: { events: [{ date: "1 Oct 2026", text: "Bob created the control." }] },
    });
    render(
      <MemoryRouter>
        <DashboardAgentLauncher hub="audit" />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    await ask("tell me about CA-01");
    const link = await screen.findByRole("link", { name: /open ca-01 in the audit hub/i });
    expect(link).toHaveAttribute("href", "/security/audit/audits/12?control=340");
    expect(screen.getByText("Bob created the control.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // still here: nothing took the user away
  });

  it("compares two controls, each heading linking to its control", async () => {
    interpretWidget.mockResolvedValue({
      action: "reply",
      message: "Comparing CA-01 and CA-02. They differ in: status.",
      compare: {
        risks: [
          { id: 340, code: "CA-01", audit_id: 12 },
          { id: 341, code: "CA-02", audit_id: 12 },
        ],
        rows: [{ label: "Status", values: ["Complete", "Pending"], differs: true }],
      },
    });
    render(
      <MemoryRouter>
        <DashboardAgentLauncher hub="audit" />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    await ask("compare CA-01 and CA-02");
    const table = await screen.findByRole("table", { name: "Risk comparison" });
    expect(within(table).getByRole("link", { name: "CA-02" })).toHaveAttribute("href", "/security/audit/audits/12?control=341");
  });

  it("draws a risk's history as a timeline", async () => {
    interpretWidget.mockResolvedValue({
      action: "reply",
      message: "Risk 2026-INT-Q4-0002: “Weak TLS”",
      risk_link: { id: 7, code: "2026-INT-Q4-0002" },
      timeline: {
        note: "Showing the latest 12 of 17 events.",
        events: [
          { date: "5 Oct 2026", text: "Bob created the risk." },
          { date: "8 Oct 2026", text: "Alice approved it." },
        ],
      },
    });
    await openChat();
    await ask("what happened to 2026-INT-Q4-0002");
    expect(await screen.findByText("Bob created the risk.")).toBeInTheDocument();
    expect(screen.getByText("8 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("Showing the latest 12 of 17 events.")).toBeInTheDocument();
  });

  it("shows two risks side by side and marks where they differ", async () => {
    interpretWidget.mockResolvedValue({
      action: "reply",
      message: "Comparing A-1 and B-2. They differ in: status.",
      compare: {
        risks: [
          { id: 1, code: "A-1" },
          { id: 2, code: "B-2" },
        ],
        rows: [
          { label: "Status", values: ["Approved", "Closed"], differs: true },
          { label: "Register", values: ["Main", "Main"], differs: false },
        ],
      },
    });
    render(
      <MemoryRouter>
        <DashboardAgentLauncher />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    await ask("compare A-1 and B-2");
    const table = await screen.findByRole("table", { name: "Risk comparison" });
    expect(within(table).getByRole("link", { name: "A-1" })).toHaveAttribute("href", "/security/risk/registers?riskId=1");
    expect(within(table).getByRole("link", { name: "B-2" })).toBeInTheDocument();
    expect(within(table).getByText("Closed")).toBeInTheDocument();
    const rows = within(table).getAllByRole("row");
    expect(rows.find((r) => r.getAttribute("data-differs") === "true")).toHaveTextContent("Status");
    expect(rows.find((r) => r.textContent?.startsWith("Register"))).toHaveAttribute("data-differs", "false");
  });

  it("says plainly when the assistant is temporarily unavailable", async () => {
    interpretWidget.mockRejectedValue(Object.assign(new Error("service unavailable"), { status: 503 }));
    await openChat();
    await ask("risks");
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
  });

  it("shows a clarifying question and runs nothing", async () => {
    interpretWidget.mockResolvedValue({ action: "clarify", question: "Which quarter do you mean?" });
    await openChat();
    await ask("trend of risks");
    expect(await screen.findByText("Which quarter do you mean?")).toBeInTheDocument();
    expect(runWidget).not.toHaveBeenCalled();
  });

  it("shows the 'cannot do that' message as plain text", async () => {
    interpretWidget.mockResolvedValue({ action: "unsupported", message: "I can only help with the risk register." });
    await openChat();
    await ask("close all risks");
    expect(await screen.findByText("I can only help with the risk register.")).toBeInTheDocument();
    expect(runWidget).not.toHaveBeenCalled();
  });

  it("tells the user to wait when they are rate limited", async () => {
    interpretWidget.mockRejectedValue(Object.assign(new Error("too many"), { status: 429 }));
    await openChat();
    await ask("risks");
    expect(await screen.findByText(/wait a minute/i)).toBeInTheDocument();
  });

  it("keeps a failed query inside its widget and generic", async () => {
    interpretWidget.mockResolvedValue({ action: "widget", widget: kpiWidget("Open risks") });
    runWidget.mockRejectedValue(Object.assign(new Error("gateway responded 500: secret detail"), { status: 500 }));
    await openChat();
    await ask("open risks");
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret detail/)).not.toBeInTheDocument();
  });

  it("cannot send an empty message", async () => {
    await openChat();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("expands to full screen and back", async () => {
    await openChat();
    await userEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByRole("button", { name: "Exit full screen" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
  });


  it("starts over", async () => {
    interpretWidget.mockResolvedValue({ action: "widget", widget: kpiWidget("Open risks") });
    await openChat();
    await ask("open risks");
    await screen.findByText("12");
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByText(/ask me anything about your risks/i)).toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });
});
