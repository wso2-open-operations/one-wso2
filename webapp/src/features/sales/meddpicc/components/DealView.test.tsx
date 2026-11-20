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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// The backend is replaced by the in-memory test double in ../testing, behind the
// same client interface, so the real hooks, cache and mutations run against it.
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isEchoBackendConfigured: () => true,
}));
vi.mock("@features/sales/meddpicc/api/meddpiccClient", async (importOriginal) => {
  const { mockMeddpiccClient } = await import("@features/sales/meddpicc/testing/mockStore");
  return {
    ...(await importOriginal<typeof import("@features/sales/meddpicc/api/meddpiccClient")>()),
    httpMeddpiccClient: () => mockMeddpiccClient,
  };
});
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
// Ask AI's two requests, answered by each test.
const ask = vi.hoisted(() => ({ searchLibrary: vi.fn(), askDeal: vi.fn() }));
vi.mock("@features/sales/meddpicc/api/askAi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/sales/meddpicc/api/askAi")>()),
  searchLibrary: ask.searchLibrary,
  askDeal: ask.askDeal,
}));
const showSuccess = vi.fn();
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess, showError: vi.fn(), showWarning: vi.fn() }),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import DealView from "./DealView";
import { useDeal } from "../api/useMeddpiccData";
import { mockMeddpiccClient, resetMockStore } from "../testing/mockStore";
import type { DealTab } from "../../util/salesPaths";
import { HttpError } from "@api/http";
import type { AskAnswer } from "../types";

/** What DealPage does once the deal has loaded, without the page's shell around it. */
function LoadedDeal({ opportunityId, tab }: { opportunityId: string; tab?: DealTab }) {
  const query = useDeal(opportunityId);
  if (!query.data) return <p>Loading MEDDPICC…</p>;
  // The page's title names the deal; the view itself does not.
  return (
    <>
      <h1>{query.data.deal.name}</h1>
      <DealView detail={query.data} tab={tab} />
    </>
  );
}

function renderPanel(opportunityId: string, tab?: DealTab) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return render(<LoadedDeal opportunityId={opportunityId} tab={tab} />, { wrapper });
}

const approveButton = () => screen.getByRole("button", { name: /^Approve all/ });

beforeEach(() => {
  ask.searchLibrary.mockReset();
  ask.askDeal.mockReset();
  resetMockStore();
  showSuccess.mockClear();
});
afterEach(() => vi.restoreAllMocks());

// A page full of MUI selects and tooltips, driven by userEvent: well under a
// second each on an idle machine, but the default 5s is too tight on a busy runner.
describe("DealView", { timeout: 20000 }, () => {
  it("keeps Approve all disabled, and says why, while a proposed role has no matching contact", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });

    // Economic buyer lives in the Qualify Gate, which is collapsed; the Letter filter reaches it.
    await user.click(screen.getByRole("button", { name: /^Economic Buyer:/ }));

    expect(approveButton()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pick the matching contact for economic buyer, or mark it not known.",
    );

    await user.click(screen.getByRole("combobox", { name: "Matching contact" }));
    await user.click(await screen.findByRole("option", { name: /Grace Lim-Tan/ }));

    expect(approveButton()).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("also enables Approve all when the role is marked not known", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    await user.click(screen.getByRole("button", { name: /^Economic Buyer:/ }));

    await user.click(screen.getByRole("combobox", { name: "Matching contact" }));
    await user.click(await screen.findByRole("option", { name: "Not known — leave unset" }));

    expect(approveButton()).toBeEnabled();
  });

  it("sends the AM's edits — a clear as null — with the suggested contact matched", async () => {
    const user = userEvent.setup();
    const approve = vi.spyOn(mockMeddpiccClient, "approve");
    renderPanel("006MOCK0000BRWT");
    await screen.findByRole("heading", { name: "Brightwater – API Manager first sale" });

    await user.click(screen.getByRole("button", { name: "Edit Decision process" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("cleared")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Decision criteria" }));
    await user.click(screen.getByRole("combobox", { name: "Decision criteria" }));
    await user.click(await screen.findByRole("option", { name: "Scalability & performance" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Use this value" }));

    await user.click(approveButton());

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    expect(approve).toHaveBeenCalledWith("006MOCK0000BRWT", {
      edits: {
        decisionProcess: null,
        decisionCriteria: ["Technical fit / feature coverage", "Total cost of ownership", "Scalability & performance"],
      },
      roleMatches: { champion: "003MOCKK1" },
    });
    await waitFor(() => expect(showSuccess).toHaveBeenCalled());
  });

  it("fills the header's circles after Approve all", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000BRWT");
    await screen.findByRole("heading", { name: "Brightwater – API Manager first sale" });
    const header = screen.getByRole("group", { name: /^MEDDPICC for Brightwater/ });
    expect(within(header).getByRole("button", { name: /^Champion:/ })).toHaveAccessibleName(
      "Champion: AI suggestion waiting for approval",
    );

    await user.click(approveButton());

    await waitFor(() =>
      expect(within(header).getByRole("button", { name: /^Champion:/ })).toHaveAccessibleName(
        "Champion: filled in Salesforce",
      ),
    );
  });

  it("offers Move stage once the Gate is complete, and moves it", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000NORD");
    await screen.findByRole("heading", { name: "Nordlys Energi – identity expansion" });

    await user.click(screen.getByRole("button", { name: /Move to Proposal/ }));

    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith("Moved to Proposal."));
    // Proposal's Gate is now current, and it isn't complete, so the button goes.
    await waitFor(() => expect(screen.queryByRole("button", { name: /Move to/ })).not.toBeInTheDocument());
  });

  it("shows Salesforce's own message, and a way there, when it refuses the stage change", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000OAKR");
    await screen.findByRole("heading", { name: "Oakridge University – campus IAM" });

    await user.click(screen.getByRole("button", { name: /Move to Business Proof/ }));

    expect(await screen.findByText(/Stage can only be advanced through the Update MEDDPICC Stages flow/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open in Salesforce/ }).length).toBeGreaterThanOrEqual(2);
  });

  it("includes an unassigned call from the banner", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000HARB");
    await screen.findByRole("heading", { name: "Harbourline – API platform" });
    expect(screen.getByText(/2 earlier calls with Harbourline Logistics/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Include Harbourline Logistics – account catch-up" }));

    expect(await screen.findByText(/An earlier call with Harbourline Logistics/)).toBeInTheDocument();
  });

  it("is read-only for someone who can't edit the deal", async () => {
    renderPanel("006MOCK0000ASTE");
    await screen.findByRole("heading", { name: "Asterra Health – FHIR gateway" });
    expect(screen.getByText(/You can view this opportunity/)).toBeInTheDocument();
    // The notice says why; there is no disabled Approve all to puzzle over.
    expect(screen.queryByRole("button", { name: /^Approve all/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit / })).not.toBeInTheDocument();
  });

  // The redesign: the AM's attention goes to what the AI proposes and what is missing;
  // what Salesforce already has is folded away.
  it("opens on the current stage with what needs review and what is missing up front", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });

    // The stage path: the current stage is open, and an earlier stage's leftover shows.
    expect(screen.getByRole("button", { name: /^Technical Proof, current stage: / })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Qualify: 1 to review$/ })).toBeInTheDocument();

    const review = screen.getByRole("region", { name: "Needs your review" });
    for (const label of ["WSO2–customer use case fit", "Competitors", "Cloud service provider", "On Kubernetes"]) {
      expect(within(review).getByText(label)).toBeInTheDocument();
    }
    const missing = screen.getByRole("region", { name: "Missing" });
    expect(within(missing).getByText("POC completed")).toBeInTheDocument();
    expect(within(missing).getByText(/Where are we with the POC/)).toBeInTheDocument();

    // Already in Salesforce is folded until opened, and then one line per field.
    expect(screen.queryByText("POC required")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Already in Salesforce/ }));
    expect(await screen.findByText("POC required")).toBeInTheDocument();
    expect(screen.getByText("Empty · optional")).toBeInTheDocument();
  });

  it("moves to another stage from the path", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    await user.click(screen.getByRole("button", { name: /^Qualify: / }));
    const review = screen.getByRole("region", { name: "Needs your review" });
    expect(within(review).getByText("Economic buyer")).toBeInTheDocument();
    expect(within(review).getByRole("combobox", { name: "Matching contact" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Missing" })).toHaveTextContent("Nothing is missing in Qualify.");
  });

  it("leaves out Needs your review on a stage with nothing to review", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    await user.click(screen.getByRole("button", { name: /^Validate: / }));
    expect(screen.queryByRole("region", { name: "Needs your review" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing is waiting for review/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Missing" })).toBeInTheDocument();
  });

  it("creates the contact for a person the deal doesn't have yet, once the AM has checked the details", async () => {
    const user = userEvent.setup();
    const approve = vi.spyOn(mockMeddpiccClient, "approve");
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    await user.click(screen.getByRole("button", { name: /^Economic Buyer:/ }));

    await user.click(screen.getByRole("combobox", { name: "Matching contact" }));
    await user.click(await screen.findByRole("option", { name: "Not in Salesforce yet — create a contact" }));

    // The form starts from what was heard, and Approve all waits for the email.
    const form = screen.getByRole("group", { name: "New contact" });
    expect(within(form).getByRole("textbox", { name: /First name/ })).toHaveValue("Grace");
    expect(within(form).getByRole("textbox", { name: /Last name/ })).toHaveValue("Lim");
    expect(approveButton()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Finish the new contact for economic buyer: an email is needed.");

    await user.type(within(form).getByRole("textbox", { name: /Email/ }), "grace.lim@meridian.example");
    expect(approveButton()).toBeEnabled();
    expect(screen.getByText(/creates Grace Lim as economic buyer/)).toBeInTheDocument();

    await user.click(approveButton());

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    expect(approve.mock.calls[0]?.[1].newContacts).toEqual({
      economicBuyer: { firstName: "Grace", lastName: "Lim", email: "grace.lim@meridian.example", title: "CFO" },
    });
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining("Created in Salesforce: Grace Lim.")));
    expect(screen.queryByRole("group", { name: "New contact" })).not.toBeInTheDocument();
  });

  it("opens the full account of a suggestion beside the page, and closes it", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000BRWT");
    await screen.findByRole("heading", { name: "Brightwater – API Manager first sale" });

    await user.click(screen.getByRole("button", { name: "Where Decision process came from" }));

    const panel = screen.getByRole("dialog", { name: "Where this came from" });
    expect(within(panel).getByText("Decision process")).toBeInTheDocument();
    expect(within(panel).getByText("Both calls mention an RFP; the deep dive adds a two-week POC before it.")).toBeInTheDocument();
    expect(within(panel).getByText("Backed by 2 quotes from 2 calls, shown below word for word.")).toBeInTheDocument();
    const quotes = within(panel).getByRole("region", { name: "Every quote (2)" });
    // Each quote opens its recording at the moment it was said, in a new tab.
    const moments = within(quotes).getAllByRole("link", { name: /^Open the recording at \d+:\d\d, in a new tab$/ });
    expect(moments).toHaveLength(2);
    expect(moments[0]).toHaveAttribute("target", "_blank");
    expect(moments[0]).toHaveAttribute("href", expect.stringMatching(/^\/sales\/meetings\/\d+\?tab=transcript&t=\d+$/));
    expect(within(panel).getByRole("region", { name: "Calls on this deal" })).toHaveTextContent("mentioned it");

    await user.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Where this came from" })).not.toBeInTheDocument());
  });

  it("leads with the deal's facts, its Letters in Salesforce and what is waiting for review", async () => {
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    for (const label of ["Account", "Amount", "Close date", "Owner", "Last activity"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/^\d of 8 in Salesforce/)).toBeInTheDocument();
    // The review count rides on the MEDDPICC tab, so it shows from the Activity tab too.
    expect(screen.getByRole("tab", { name: /^MEDDPICC, \d+ to review$/ })).toBeInTheDocument();
  });

  // The score and flags themselves are covered in DealScore.test and DealFlags.test.
  it("has a deal score card with Salesforce's score, and no attention box with no flags", async () => {
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    expect(screen.getByText("Opportunity score")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Opportunity score 78.9, Strong" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Needs attention" })).not.toBeInTheDocument();
  });

  it("shows a dash on the score card where Salesforce has none", async () => {
    renderPanel("006MOCK0000BRWT");
    await screen.findByRole("heading", { name: "Brightwater – API Manager first sale" });
    expect(screen.getByRole("img", { name: "No opportunity score" })).toBeInTheDocument();
  });

  it("re-reads the deal from Salesforce on Refresh, and shows what came back", async () => {
    const user = userEvent.setup();
    const realDeal = mockMeddpiccClient.deal;
    const spy = vi.spyOn(mockMeddpiccClient, "deal");
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    expect(spy).toHaveBeenCalledWith("006MOCK0000MERI");

    // What Salesforce says now: the account was renamed there.
    spy.mockImplementationOnce(async (id, options) => {
      const fresh = await realDeal(id, options);
      return { ...fresh, deal: { ...fresh.deal, accountName: "Meridian Bank plc" } };
    });
    await user.click(screen.getByRole("button", { name: "Refresh from Salesforce" }));

    expect(spy).toHaveBeenLastCalledWith("006MOCK0000MERI", { refresh: true });
    expect(await screen.findByText("Meridian Bank plc")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("answers a question from the opportunity and the Library, with its sources, and carries the thread", async () => {
    const answer: AskAnswer = {
      answer: "The CFO signs [1]. API Manager ships Helm charts [2].",
      covered: true,
      nextQuestion: null,
      libraryUnavailable: false,
      sources: [
        { n: 1, group: "OPPORTUNITY", type: "CALL", title: "Architecture review", detail: "Call · Aisha Rahman (customer)",
          quote: "Anything over budget goes to the CFO.", occurredAt: "2026-09-22T14:30:00Z", url: null, meetingId: 91013, offsetSeconds: 600 },
        { n: 2, group: "LIBRARY", type: "LIBRARY", title: "API Manager on Kubernetes", detail: "Sales Library · Slide 4",
          quote: "Helm charts for Kubernetes.", occurredAt: null, url: "https://drive.example/doc#slide=4", meetingId: null, offsetSeconds: null },
      ],
    };
    ask.searchLibrary.mockResolvedValue([{ title: "API Manager on Kubernetes", content: "Helm charts.", link: null, page: 4, unitLabel: "Slide", documentId: "42" }]);
    ask.askDeal.mockResolvedValue(answer);
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI", "ask");
    await screen.findByRole("heading", { name: "Ask about this opportunity" });

    await user.click(screen.getByRole("button", { name: "What's blocking the next stage?" }));
    const log = screen.getByRole("log", { name: "Conversation about this opportunity" });
    expect(await within(log).findByText(/The CFO signs/)).toBeInTheDocument();
    expect(within(log).getByRole("link", { name: "Source 1" })).toHaveAttribute("href", expect.stringMatching(/#ask-.*-source-1$/));
    const fromOpportunity = within(log).getByRole("region", { name: "From this opportunity" });
    expect(within(fromOpportunity).getByRole("link", { name: /Architecture review/ })).toHaveAttribute("href", "/sales/meetings/91013?tab=meddpicc");
    const fromLibrary = within(log).getByRole("region", { name: "From the Sales Library" });
    expect(within(fromLibrary).getByRole("link", { name: /API Manager on Kubernetes/ })).toHaveAttribute("href", "https://drive.example/doc#slide=4");

    const [, first] = ask.askDeal.mock.calls[0];
    expect(first).toEqual(expect.objectContaining({ question: "What's blocking the next stage?", history: [], libraryUnavailable: false }));
    expect(first.librarySources).toHaveLength(1);

    // A typed follow-up carries the first turn, and the Library search carries the first question.
    await user.type(screen.getByRole("textbox", { name: "Your question" }), "Who signs the contract?{Enter}");
    await waitFor(() => expect(ask.askDeal).toHaveBeenCalledTimes(2));
    const [, second] = ask.askDeal.mock.calls[1];
    expect(second.history).toEqual([{ question: "What's blocking the next stage?", answer: answer.answer }]);
    expect(ask.searchLibrary.mock.calls[1][0]).toBe("Who signs the contract? | What's blocking the next stage?");

    await user.click(await screen.findByRole("button", { name: "New conversation" }));
    expect(within(log).queryByText("Who signs the contract?")).not.toBeInTheDocument();
  });

  it("sends a question once, however fast it is sent again", async () => {
    let finish: (a: AskAnswer) => void = () => {};
    ask.searchLibrary.mockResolvedValue([]);
    ask.askDeal.mockReturnValue(new Promise<AskAnswer>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI", "ask");
    const box = await screen.findByRole("textbox", { name: "Your question" });
    await user.type(box, "Who signs?{Enter}");
    await user.type(box, "Who signs?{Enter}");
    expect(await screen.findByRole("status")).toHaveTextContent(/Searching the Library|Writing the answer/);
    finish({ answer: "Not covered.", covered: false, nextQuestion: null, libraryUnavailable: false, sources: [] });
    const log = screen.getByRole("log", { name: "Conversation about this opportunity" });
    expect(await within(log).findByText("Not covered.")).toBeInTheDocument();
    expect(ask.askDeal).toHaveBeenCalledTimes(1);
    expect(within(log).getAllByText("Who signs?")).toHaveLength(1);
  });

  it("answers without the Library when it can't be searched, and says so", async () => {
    ask.searchLibrary.mockResolvedValue(null);
    ask.askDeal.mockResolvedValue({ answer: "Not covered.", covered: false, nextQuestion: "Who signs off the purchase?",
      libraryUnavailable: true, sources: [] } satisfies AskAnswer);
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI", "ask");
    await user.click(await screen.findByRole("button", { name: "Who is the economic buyer, and how do we know?" }));
    const log = screen.getByRole("log", { name: "Conversation about this opportunity" });
    expect(await within(log).findByText("Who signs off the purchase?")).toBeInTheDocument();
    expect(within(log).getByText(/Library unavailable/)).toBeInTheDocument();
    expect(ask.askDeal.mock.calls[0][1]).toEqual(expect.objectContaining({ librarySources: [], libraryUnavailable: true }));
  });

  it("says when Ask AI isn't connected, or the question was too many", async () => {
    ask.searchLibrary.mockResolvedValue([]);
    ask.askDeal.mockRejectedValueOnce(new HttpError("/ask", 404, "")).mockRejectedValueOnce(new HttpError("/ask", 429, ""));
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI", "ask");
    await user.click(await screen.findByRole("button", { name: "What's blocking the next stage?" }));
    const log = screen.getByRole("log", { name: "Conversation about this opportunity" });
    expect(await within(log).findByText("Ask AI isn't connected yet, so this question wasn't answered.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Your question" }), "Again?{Enter}");
    expect(await within(log).findByText(/asked a lot in the last minute/)).toBeInTheDocument();
  });

  it("folds an email thread into one row that opens to its messages", async () => {
    const user = userEvent.setup();
    const realDeal = mockMeddpiccClient.deal;
    const email = (id: string, title: string, occurredAt: string, actor: string) => ({
      type: "EMAIL" as const, kind: "EMAIL" as const, id, title, occurredAt, actor, letters: [], meetingId: null,
      url: `https://example.org/${id}`,
    });
    const spy = vi.spyOn(mockMeddpiccClient, "deal").mockImplementation(async (id, options) => ({
      ...(await realDeal(id, options)),
      activity: [
        email("02sC", "RE: Integration platform – pricing", "2026-09-22T10:00:00Z", "Aisha Rahman"),
        email("02sB", "Re: Integration platform – pricing", "2026-09-21T15:00:00Z", "Sophie Martin"),
        email("02sD", "Security questionnaire", "2026-09-21T09:00:00Z", "Aisha Rahman"),
        email("02sA", "Integration platform – pricing", "2026-09-20T09:00:00Z", "Sophie Martin"),
      ],
    }));
    renderPanel("006MOCK0000MERI", "activity");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    const activity = within(screen.getByRole("region", { name: "Activity" }));
    // One row for the thread, titled without its Re: prefixes; a lone email stays a row.
    expect(activity.getByText("Integration platform – pricing")).toBeInTheDocument();
    expect(activity.getByText(/^Email thread · 3 messages · last/)).toBeInTheDocument();
    expect(activity.queryByText("RE: Integration platform – pricing")).not.toBeInTheDocument();
    expect(activity.getByText("Security questionnaire")).toBeInTheDocument();

    await user.click(activity.getByRole("button", { name: "Show the 3 messages" }));
    const messages = within(activity.getByRole("list", { name: "Messages in Integration platform – pricing" }));
    expect(messages.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Integration platform – pricing"),
      expect.stringContaining("Re: Integration platform – pricing"),
      expect.stringContaining("RE: Integration platform – pricing"),
    ]);
    expect(messages.getByRole("link", { name: "RE: Integration platform – pricing" })).toHaveAttribute("href", "https://example.org/02sC");

    await user.click(activity.getByRole("button", { name: "Hide the messages" }));
    expect(activity.queryByRole("list", { name: /^Messages in / })).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it("filters the activity list and the journey by source with the chips", async () => {
    const user = userEvent.setup();
    const realDeal = mockMeddpiccClient.deal;
    const spy = vi.spyOn(mockMeddpiccClient, "deal").mockImplementation(async (id, options) => {
      const d = await realDeal(id, options);
      const extra = [
        { type: "EMAIL" as const, kind: "EMAIL" as const, id: "02sA", title: "Re: pricing", occurredAt: "2026-09-20T09:00:00Z",
          actor: "Ravi Kumar", letters: [], meetingId: null, url: "https://example.org/02sA" },
        { type: "ACTIVITY" as const, kind: "ACTIVITY" as const, id: "00TA", title: "Sent the proposal", occurredAt: "2026-09-21T09:00:00Z",
          actor: "Ravi Kumar", letters: [], meetingId: null, url: "https://example.org/00TA" },
      ];
      const calls = d.calls.map((c) => ({
        type: "CALL" as const, kind: "CUSTOMER_CALL" as const, id: String(c.meetingId), title: c.title, occurredAt: c.start,
        actor: c.host, letters: [], meetingId: c.meetingId, url: null,
      }));
      return {
        ...d,
        activity: [...extra, ...calls],
        sources: { calls: calls.length, emails: 1, activities: 1, lastActivityAt: "2026-09-21T09:00:00Z" },
      };
    });
    renderPanel("006MOCK0000MERI", "activity");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    const activity = () => screen.getByRole("region", { name: "Activity" });
    const marks = () => within(screen.getByRole("list", { name: /^Opportunity journey/ })).getAllByRole("listitem");
    const all = marks().length;
    expect(within(activity()).getByText("Re: pricing")).toBeInTheDocument();
    expect(within(activity()).getByText("Sent the proposal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Emails" }));

    expect(within(activity()).getByText("Re: pricing")).toBeInTheDocument();
    expect(within(activity()).queryByText("Sent the proposal")).not.toBeInTheDocument();
    expect(within(activity()).getByText(/^Activity \(1 of \d+\)$/)).toBeInTheDocument();
    expect(marks()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(marks()).toHaveLength(all);
    spy.mockRestore();
  });

  it("keeps the journey and activity on the Activity tab, away from the fields", async () => {
    const { unmount } = renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    expect(screen.getByRole("tab", { name: /^MEDDPICC/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("list", { name: /^Opportunity journey/ })).not.toBeInTheDocument();
    unmount();

    renderPanel("006MOCK0000MERI", "activity");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    expect(screen.getByRole("tab", { name: /^Activity/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("list", { name: /^Opportunity journey/ })).toBeInTheDocument();
    // The fields and their approval bar stay on the MEDDPICC tab.
    expect(screen.queryByRole("button", { name: /^Approve all/ })).not.toBeInTheDocument();
    // Each activity entry says what it was; without the backend's kind, a call is a customer call.
    const activity = screen.getByRole("region", { name: "Activity" });
    expect(within(activity).getAllByText(/^Customer call · /).length).toBeGreaterThan(0);
  });
});

