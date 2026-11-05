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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import TopBar from "@components/top-bar/TopBar";
import { __resetForTests } from "@features/pinned/pinnedStore";

vi.hoisted(() => {
  window.config = {
    ...window.config,
    ONE_WSO2_AGENT_ORCHESTRATOR_URL: "http://localhost:8000",
    ONE_WSO2_PREVIEW_FEATURES: { novera: true },
  } as Window["config"];
});

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({
    state: { status: "ready", sub: "user-under-test" },
    retry: () => {},
  }),
}));

vi.mock("@hooks/useAccessToken", () => ({
  useAccessToken: () => async () => "token",
}));

const mockUserInfo = vi.fn(() => ({
  data: { privileges: [987] },
  isLoading: false,
  isError: false,
}));

vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => mockUserInfo(),
}));

vi.mock("@components/top-bar/UserProfileMenu", () => ({
  default: () => <div data-testid="user-profile" />,
}));
vi.mock("@features/pinned/components/PinnedTabs", () => ({
  default: () => <div data-testid="pinned-tabs" />,
}));
vi.mock("@features/pinned/components/PinThisPageButton", () => ({
  default: () => <div data-testid="pin-button" />,
}));
vi.mock("@components/top-bar/ThemeSelect", () => ({
  default: () => <div data-testid="theme-select" />,
}));

const mockAuthedPost = vi.fn();
vi.mock("@api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@api/http")>();
  return {
    ...actual,
    authedPost: (...args: unknown[]) => mockAuthedPost(...args),
  };
});

beforeEach(() => {
  localStorage.clear();
  __resetForTests();
  mockAuthedPost.mockReset();
  mockUserInfo.mockReturnValue({
    data: { privileges: [987] },
    isLoading: false,
    isError: false,
  });
  window.config = {
    ...window.config,
    ONE_WSO2_AGENT_ORCHESTRATOR_URL: "http://localhost:8000",
    ONE_WSO2_PREVIEW_FEATURES: { novera: true },
  } as Window["config"];
});

function renderTopBar() {
  return render(
    <MemoryRouter>
      <TopBar
        collapsed={false}
        onToggleSidebar={() => {}}
        onToggleWaffle={() => {}}
        waffleOpen={false}
      />
    </MemoryRouter>,
  );
}

describe("Ask Novera Search Bar and Results", () => {
  it("renders Ask Novera search bar in TopBar with no dropdown while typing", async () => {
    renderTopBar();
    const input = screen.getByPlaceholderText("Ask Novera");
    expect(input).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(input, "leave");

    // Nothing should pop open or drop down while typing
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/How can I help you today/i)).not.toBeInTheDocument();
  });

  it("submits search on Enter and displays AI Overview first, then Leave Management button below", async () => {
    mockAuthedPost.mockResolvedValueOnce({
      response: "You currently have 14 days of annual leave remaining.",
      status: "success",
      bucket: "LEAVE_STANDARD",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "Check my leave balance{Enter}");

    // Results dropdown drops down directly below search bar
    expect(
      await screen.findByText("You currently have 14 days of annual leave remaining."),
    ).toBeInTheDocument();
    expect(screen.getByText("Novera Overview")).toBeInTheDocument();

    // Below AI Overview: Leave Management action card with Open Leave App button
    expect(screen.getByText("Leave Management")).toBeInTheDocument();
    expect(screen.getByText("Apply for leave and view leave history")).toBeInTheDocument();
    expect(screen.queryByText(/check balances/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/calendar/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Leave App" })).toBeInTheDocument();
  });

  it("suppresses AI Overview and shows only directory action button for directories without MCP", async () => {
    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "my team{Enter}");

    // Agent Orchestrator chat should NOT be called for MCP-less directory
    expect(mockAuthedPost).not.toHaveBeenCalled();

    // AI Overview should be suppressed
    expect(screen.queryByText("Novera Overview")).not.toBeInTheDocument();

    // Only the My Team directory action card and button should display
    expect(screen.getByText("My Team")).toBeInTheDocument();
    expect(
      screen.getByText("View team members, reporting structure, and employee details"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/who is.*off/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open My Team App" })).toBeInTheDocument();
  });

  it("calls AI and shows Novera Overview without false button for buckets without web app", async () => {
    mockAuthedPost.mockResolvedValueOnce({
      response: "You have vehicle WP CAD-9999 registered with pass #402.",
      status: "success",
      bucket: "PO_VEHICLES",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "vehicles{Enter}");

    expect(mockAuthedPost).toHaveBeenCalled();

    // Novera Overview should be displayed
    expect(
      await screen.findByText("You have vehicle WP CAD-9999 registered with pass #402."),
    ).toBeInTheDocument();
    expect(screen.getByText("Novera Overview")).toBeInTheDocument();

    // Should NOT show any false navigation button
    expect(screen.queryByRole("button", { name: /Open Vehicles App/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Vehicle Parking")).not.toBeInTheDocument();
  });

  it("suppresses AI Overview and displays Expense Claims button when searching expenses", async () => {
    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "expense claim{Enter}");

    expect(mockAuthedPost).not.toHaveBeenCalled();
    expect(screen.queryByText("Novera Overview")).not.toBeInTheDocument();

    expect(screen.getByText("Expense Claims")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Expenses App" })).toBeInTheDocument();
  });

  it("suppresses admin-only action card for standard employees", async () => {
    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "manage subscriptions{Enter}");

    expect(screen.queryByRole("button", { name: "Manage Subscriptions" })).not.toBeInTheDocument();
    expect(screen.queryByText("Subscription Management")).not.toBeInTheDocument();
  });

  it("shows admin-only action card for admin users", async () => {
    mockUserInfo.mockReturnValue({
      data: { privileges: [987, 999] },
      isLoading: false,
      isError: false,
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "manage subscriptions{Enter}");

    expect(await screen.findByRole("button", { name: "Manage Subscriptions" })).toBeInTheDocument();
    expect(screen.getAllByText("Manage Subscriptions").length).toBeGreaterThanOrEqual(1);
  });

  it("displays Cafeteria action card with accurate breakfast/lunch/snack hint without dinner orders", async () => {
    mockAuthedPost.mockResolvedValueOnce({
      response: "Today's lunch features steamed basmati rice with chicken curry and dhal.",
      status: "success",
      bucket: "PO_MENU",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "what is for lunch{Enter}");

    expect(
      await screen.findByText("Today's lunch features steamed basmati rice with chicken curry and dhal."),
    ).toBeInTheDocument();

    expect(screen.getByText("Cafeteria")).toBeInTheDocument();
    expect(
      screen.getByText("Check today's breakfast, lunch, and snack menu"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/dinner/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Cafeteria App" })).toBeInTheDocument();
  });

  it("supports Show more / Show less toggle for long AI responses", async () => {
    const longResponse =
      "You currently have 14 days of annual leave and 5 days of casual leave " +
      "remaining for the current calendar year. If you would like to book time off, " +
      "please specify the start and end dates along with the leave type. " +
      "You can also cancel any pending leaves directly through this assistant or view your team schedule. " +
      "Annual leave must be applied at least 3 working days in advance and is subject to manager approval. " +
      "Casual leave can be applied on the same day for urgent situations. " +
      "Medical leave requires a doctor's certificate for absences exceeding 2 consecutive days. " +
      "Half-day leaves are also supported — simply specify AM or PM when making your request. " +
      "You can view your team's leave calendar to avoid conflicts before submitting your application. " +
      "For any queries about the leave policy, please contact your HR business partner or refer to " +
      "the employee handbook available on the intranet portal under the HR Resources section.";

    mockAuthedPost.mockResolvedValueOnce({
      response: longResponse,
      status: "success",
      bucket: "LEAVE_STANDARD",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "Check my leave status{Enter}");

    expect(await screen.findByText("Novera Overview")).toBeInTheDocument();
    const showMoreBtn = screen.getByRole("button", { name: "Show more" });
    expect(showMoreBtn).toBeInTheDocument();

    await user.click(showMoreBtn);
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("closes the results dropdown on Escape", async () => {
    mockAuthedPost.mockResolvedValueOnce({
      response: "Here is your leave history.",
      status: "success",
      bucket: "LEAVE_STANDARD",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "Show leaves{Enter}");

    expect(await screen.findByText("Here is your leave history.")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clears search input on clear button click", async () => {
    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "Show leaves");

    const clearBtn = screen.getByRole("button", { name: "Clear search" });
    await user.click(clearBtn);

    expect(input).toHaveValue("");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("removes navigation button when a new query does not match any bucket", async () => {
    mockAuthedPost
      .mockResolvedValueOnce({
        response: "You have 10 leave days remaining.",
        status: "success",
        bucket: "LEAVE_STANDARD",
      })
      .mockResolvedValueOnce({
        response: "Our office WiFi network is WSO2-Corp.",
        status: "success",
      });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");

    // 1. Initial query matching leave bucket
    await user.type(input, "my leaves{Enter}");
    expect(await screen.findByRole("button", { name: "Open Leave App" })).toBeInTheDocument();

    // 2. Searching a new query from the canvas search bar updates results
    const canvasInput = screen.getByPlaceholderText("Search or ask Novera...");
    await user.clear(canvasInput);
    await user.type(canvasInput, "what is the wifi password?{Enter}");

    // 3. Submitting the new query without a bucket removes the Leave App button
    expect(await screen.findByText("Our office WiFi network is WSO2-Corp.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Leave App" })).not.toBeInTheDocument();
    expect(screen.queryByText("Leave Management")).not.toBeInTheDocument();
  });

  it("allows submitting a follow-up query from inside the palette and displays conversation history", async () => {
    mockAuthedPost
      .mockResolvedValueOnce({
        response: "You currently have 14 days of annual leave remaining.",
        status: "success",
        bucket: "LEAVE_STANDARD",
      })
      .mockResolvedValueOnce({
        response: "I have prepared your cancellation request.",
        status: "success",
        bucket: "LEAVE_STANDARD",
      });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "Check my leave balance{Enter}");

    expect(
      await screen.findByText("You currently have 14 days of annual leave remaining."),
    ).toBeInTheDocument();

    // Follow-up text field is available directly in the card's action area
    const followUpInput = screen.getByPlaceholderText("Ask a follow-up...");
    expect(followUpInput).toBeInTheDocument();

    await user.type(followUpInput, "cancel my leave on Oct 18{Enter}");

    expect(
      await screen.findByText("I have prepared your cancellation request."),
    ).toBeInTheDocument();
    expect(screen.getByText("cancel my leave on Oct 18")).toBeInTheDocument();
  });

  it("wipes typed text from search bar on Escape", async () => {
    mockAuthedPost.mockResolvedValueOnce({
      response: "You currently have 14 days of annual leave remaining.",
      status: "success",
      bucket: "LEAVE_STANDARD",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");

    await user.type(input, "my leaves{Enter}");
    expect(
      await screen.findByText("You currently have 14 days of annual leave remaining."),
    ).toBeInTheDocument();
    expect(mockAuthedPost).toHaveBeenCalledTimes(1);

    // Close palette via Escape: wipes typed text from search bar
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("wipes typed search query when clicking One WSO2 logo", async () => {
    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");

    await user.type(input, "what is for lunch");

    // Click One WSO2 brand button in header: wipes typed text
    const brandLink = screen.getByRole("link", { name: "One WSO2 home" });
    await user.click(brandLink);

    expect(input).toHaveValue("");
  });

  it("prevents sending duplicate search request when user presses Enter on already searched query", async () => {
    mockAuthedPost.mockResolvedValueOnce({
      response: "You currently have 14 days of annual leave remaining.",
      status: "success",
      bucket: "LEAVE_STANDARD",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");

    await user.type(input, "check leave{Enter}");
    expect(
      await screen.findByText("You currently have 14 days of annual leave remaining."),
    ).toBeInTheDocument();
    expect(mockAuthedPost).toHaveBeenCalledTimes(1);

    // Pressing Enter again while palette is open does not fire a second network request
    await user.keyboard("{Enter}");
    expect(mockAuthedPost).toHaveBeenCalledTimes(1);
  });

  it("ignores canvas search submissions while an existing request is pending", async () => {
    let resolveQueryA!: (value: unknown) => void;
    mockAuthedPost.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveQueryA = resolve;
        }),
    );

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");

    // 1. Submit Query A
    await user.type(input, "query A{Enter}");
    expect(mockAuthedPost).toHaveBeenCalledTimes(1);

    // 2. While Query A is in-flight, canvas is open. Submit Query B in the canvas input
    const canvasInput = screen.getByPlaceholderText("Search or ask Novera...");
    await user.clear(canvasInput);
    await user.type(canvasInput, "query B{Enter}");

    // Query B should NOT be sent because request A is in-flight
    expect(mockAuthedPost).toHaveBeenCalledTimes(1);

    // 3. Resolve Query A
    await act(async () => {
      resolveQueryA({
        response: "Answer for query A",
        status: "success",
      });
    });

    expect(await screen.findByText("Answer for query A")).toBeInTheDocument();

    // 4. Now that request A has completed, submitting Query B succeeds
    mockAuthedPost.mockResolvedValueOnce({
      response: "Answer for query B",
      status: "success",
    });
    await user.clear(canvasInput);
    await user.type(canvasInput, "query B{Enter}");
    expect(mockAuthedPost).toHaveBeenCalledTimes(2);
  });

  it("updates action button when follow-up query transitions domain bucket (e.g. leave to menu)", async () => {
    mockAuthedPost
      .mockResolvedValueOnce({
        response: "You currently have 14 days of annual leave remaining.",
        status: "success",
        bucket: "LEAVE_STANDARD",
      })
      .mockResolvedValueOnce({
        response: "Sorry, I wasn't able to fetch today's menu right now due to a technical issue.",
        status: "success",
        bucket: "PO_MENU",
      });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");

    // 1. Initial query matches Leave Management
    await user.type(input, "Check my leave balance{Enter}");
    expect(
      await screen.findByText("You currently have 14 days of annual leave remaining."),
    ).toBeInTheDocument();
    expect(screen.getByText("Leave Management")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Leave App" })).toBeInTheDocument();

    // 2. Follow-up input is embedded directly inside the reply
    const followUpInput = screen.getByPlaceholderText("Ask a follow-up...");
    expect(followUpInput).toBeInTheDocument();

    // 3. Follow-up query transitions domain to Menu / Cafeteria
    await user.type(followUpInput, "What is for lunch today?{Enter}");

    expect(
      await screen.findByText("Sorry, I wasn't able to fetch today's menu right now due to a technical issue."),
    ).toBeInTheDocument();

    // Cafeteria button should now show up, replacing the Leave Management card
    expect(screen.getByText("Cafeteria")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Cafeteria App" })).toBeInTheDocument();
    expect(screen.queryByText("Leave Management")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Leave App" })).not.toBeInTheDocument();
  });

  it("hides previous turn action card while a follow-up query is in flight", async () => {
    let resolveTurn2: (value: unknown) => void = () => {};
    const turn2Promise = new Promise((resolve) => {
      resolveTurn2 = resolve;
    });

    mockAuthedPost
      .mockResolvedValueOnce({
        response: "You currently have 14 days of annual leave remaining.",
        status: "success",
        bucket: "LEAVE_STANDARD",
      })
      .mockReturnValueOnce(turn2Promise);

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");

    // 1. Initial query matches Leave Management
    await user.type(input, "Check my leave balance{Enter}");
    expect(
      await screen.findByText("You currently have 14 days of annual leave remaining."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Leave App" })).toBeInTheDocument();

    // 2. Submit follow-up query
    const followUpInput = screen.getByPlaceholderText("Ask a follow-up...");
    await user.type(followUpInput, "What is for lunch today?{Enter}");

    // 3. While follow-up query is in-flight, previous action button must be hidden
    expect(screen.queryByRole("button", { name: "Open Leave App" })).not.toBeInTheDocument();
    expect(screen.queryByText("Leave Management")).not.toBeInTheDocument();

    // 4. Resolve follow-up query with Cafeteria bucket
    await act(async () => {
      resolveTurn2({
        response: "Today's lunch features steamed basmati rice with chicken curry.",
        status: "success",
        bucket: "PO_MENU",
      });
    });

    // 5. Cafeteria action button should now show up
    expect(
      await screen.findByText("Today's lunch features steamed basmati rice with chicken curry."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Cafeteria App" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Leave App" })).not.toBeInTheDocument();
  });

  it("closes full-screen search canvas and wipes search bar when back button or close button is clicked", async () => {
    mockAuthedPost.mockResolvedValue({
      response: "Here is your leave history.",
      status: "success",
      bucket: "LEAVE_STANDARD",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "Show leaves{Enter}");

    expect(await screen.findByText("Here is your leave history.")).toBeInTheDocument();

    // Click back button in the sticky top header
    const backBtn = screen.getByRole("button", { name: "Back to page" });
    await user.click(backBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveValue("");

    // Reopen and test close button
    await user.type(input, "Show leaves again{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close search (Esc)" });
    await user.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("allows searching directly from the full-screen canvas header search bar", async () => {
    mockAuthedPost
      .mockResolvedValueOnce({
        response: "You currently have 14 days of annual leave remaining.",
        status: "success",
        bucket: "LEAVE_STANDARD",
      })
      .mockResolvedValueOnce({
        response: "Today's lunch features steamed basmati rice with chicken curry.",
        status: "success",
        bucket: "PO_MENU",
      });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "my leaves{Enter}");

    expect(
      await screen.findByText("You currently have 14 days of annual leave remaining."),
    ).toBeInTheDocument();

    // The canvas search bar allows editing or submitting a new query
    const canvasInput = screen.getByPlaceholderText("Search or ask Novera...");
    expect(canvasInput).toHaveValue("my leaves");

    await user.clear(canvasInput);
    await user.type(canvasInput, "what is for lunch{Enter}");

    expect(
      await screen.findByText("Today's lunch features steamed basmati rice with chicken curry."),
    ).toBeInTheDocument();
    expect(screen.getByText("Cafeteria")).toBeInTheDocument();
  });

  it(
    "omits Turn 1 on follow-up, starts stream from Turn 2, and accumulates history from then on",
    async () => {
      mockAuthedPost
        .mockResolvedValueOnce({
          response:
            "You currently have 14 days of annual leave and 5 days of casual leave " +
            "remaining for the current calendar year. If you would like to book time off, " +
            "please specify the dates.",
          status: "success",
          bucket: "LEAVE_STANDARD",
        })
        .mockResolvedValueOnce(
          {
            response:
              "I have prepared your cancellation request for Oct 18. " +
              "Please confirm if you want to proceed with canceling this leave. " +
              "Once confirmed, your leave balance will be updated automatically and " +
              "a confirmation receipt will be sent to your manager and team calendar. " +
              "Any pending tasks scheduled during this duration will remain assigned to you. " +
              "If you need to re-apply for leave on alternate dates after cancellation, " +
              "you can do so immediately and the system will notify your manager again. " +
              "Note that leave cancellations are not reversible once approved by your manager. " +
              "For urgent situations, please contact your HR business partner directly at hr@wso2.com " +
              "or call the HR helpline at ext 2200 during business hours Monday to Friday. " +
              "Please also check that your project handover notes are up to date before the leave " +
              "begins, so your team can manage any dependencies in your absence smoothly. " +
              "Thank you for using the WSO2 Leave Assistant.",
            status: "success",
            bucket: "LEAVE_STANDARD",
          },
        )
        .mockResolvedValueOnce({
          response: "You also have 7 days of casual leave available.",
          status: "success",
          bucket: "LEAVE_STANDARD",
        });

      renderTopBar();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Ask Novera");
      await user.type(input, "Check my leave balance{Enter}");

      expect(
        await screen.findByText(/You currently have 14 days of annual leave/),
      ).toBeInTheDocument();

      // Initial search: query is in search bar, bubble suppressed on screen
      expect(screen.getByPlaceholderText("Search or ask Novera...")).toHaveValue(
        "Check my leave balance",
      );
      expect(
        screen.queryByText("Check my leave balance"),
      ).not.toBeInTheDocument();

      // Normal-sized responses (< 900 chars) do not show an unnecessary "Show more" button
      expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();

      // 1. Follow-up input is inside the overview reply
      const followUpInput = screen.getByPlaceholderText("Ask a follow-up...");
      expect(followUpInput).toBeInTheDocument();

      // 2. Submit Turn 2 follow-up: search bar is wiped
      await user.type(followUpInput, "cancel my leave on Oct 18{Enter}");

      expect(
        await screen.findByText(/I have prepared your cancellation request for Oct 18/),
      ).toBeInTheDocument();
      expect(screen.getByText("cancel my leave on Oct 18")).toBeInTheDocument();

      // Search bar is wiped empty on follow-up
      expect(screen.getByPlaceholderText("Search or ask Novera...")).toHaveValue("");

      // Turn 1 query and overview are NOT displayed in the UI stream
      expect(
        screen.queryByText("Check my leave balance"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/You currently have 14 days of annual leave/),
      ).not.toBeInTheDocument();

      // 3. Only the new reply has follow-up input embedded inside it
      const newFollowUpInput = screen.getByPlaceholderText("Ask a follow-up...");
      expect(newFollowUpInput).toBeInTheDocument();

      // 4. Show more / Show less toggle works on long replies without removing follow-up input
      const showMoreBtn = screen.getByRole("button", { name: "Show more" });
      await user.click(showMoreBtn);

      const showLessBtn = screen.getByRole("button", { name: "Show less" });
      expect(showLessBtn).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Ask a follow-up...")).toBeInTheDocument();

      await user.click(showLessBtn);
      expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Ask a follow-up...")).toBeInTheDocument();

      // 5. Submit Turn 3 (second follow-up): history from Turn 2 onwards accumulates and is kept
      await user.type(newFollowUpInput, "what about casual leave?{Enter}");

      expect(
        await screen.findByText("You also have 7 days of casual leave available."),
      ).toBeInTheDocument();
      expect(screen.getByText("what about casual leave?")).toBeInTheDocument();

      // Turn 2 is still preserved in history
      expect(screen.getByText("cancel my leave on Oct 18")).toBeInTheDocument();
      expect(
        screen.getByText(/I have prepared your cancellation request for Oct 18/),
      ).toBeInTheDocument();

      // Turn 1 remains omitted from the UI stream
      expect(screen.queryByText("Check my leave balance")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/You currently have 14 days of annual leave/),
      ).not.toBeInTheDocument();
    },
  );

  it("renders clickable underlined links with target _blank for markdown links and bare URLs", async () => {
    mockAuthedPost.mockResolvedValueOnce({
      response:
        "Submit your request using the [Letter Form](https://docs.google.com/forms/sample) " +
        "or visit https://example.com/portal directly.",
      status: "success",
      bucket: "PO_LETTERS",
    });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "internship letter{Enter}");

    expect(await screen.findByText("Novera Overview")).toBeInTheDocument();

    const mdLink = screen.getByRole("link", { name: "Letter Form" });
    expect(mdLink).toBeInTheDocument();
    expect(mdLink).toHaveAttribute("href", "https://docs.google.com/forms/sample");
    expect(mdLink).toHaveAttribute("target", "_blank");

    const rawLink = screen.getByRole("link", { name: "https://example.com/portal" });
    expect(rawLink).toBeInTheDocument();
    expect(rawLink).toHaveAttribute("href", "https://example.com/portal");
    expect(rawLink).toHaveAttribute("target", "_blank");
  });

  it("keeps follow-up input with messages above search result nav buttons on follow-up", async () => {
    mockAuthedPost
      .mockResolvedValueOnce({
        response:
          "Hey there! 👋 Welcome to the WSO2 Leave Assistant. Here's what I can help you with:\n\n" +
          "• Apply for Leave — e.g., \"I'd like to take annual leave from Nov 3 to Nov 5\"\n" +
          "• Check Leave Balance — e.g., \"How many casual leaves do I have left?\"",
        status: "success",
        bucket: "LEAVE_STANDARD",
      })
      .mockResolvedValueOnce({
        response: "You currently have 5 days of casual leave remaining.",
        status: "success",
        bucket: "LEAVE_STANDARD",
      });

    renderTopBar();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Ask Novera");
    await user.type(input, "Apply for leave{Enter}");

    expect(await screen.findByText("Novera Overview")).toBeInTheDocument();
    const cardFollowUpInput = screen.getByPlaceholderText("Ask a follow-up...");
    const navBtn = screen.getByRole("button", { name: "Open Leave App" });
    expect(cardFollowUpInput).toBeInTheDocument();
    expect(navBtn).toBeInTheDocument();

    // Verify follow-up input is situated above the nav button
    expect(
      Boolean(cardFollowUpInput.compareDocumentPosition(navBtn) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);

    // Type directly into follow-up text field and submit second message
    await user.type(cardFollowUpInput, "How many casual leaves do I have left?{Enter}");

    expect(
      await screen.findByText("You currently have 5 days of casual leave remaining."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("How many casual leaves do I have left?"),
    ).toBeInTheDocument();

    // After second message arrives, follow-up input is STILL directly above the nav button
    const followUpInputAfterReply = screen.getByPlaceholderText("Ask a follow-up...");
    expect(
      Boolean(followUpInputAfterReply.compareDocumentPosition(navBtn) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it("renders legacy Ask Novera button and opens coming soon modal when novera preview is disabled", async () => {
    window.config = {
      ...window.config,
      ONE_WSO2_PREVIEW_FEATURES: { novera: false },
    } as Window["config"];

    const user = userEvent.setup();
    renderTopBar();

    expect(screen.queryByPlaceholderText("Ask Novera")).not.toBeInTheDocument();
    const legacyBtn = screen.getByRole("button", { name: "Ask Novera" });
    expect(legacyBtn).toBeInTheDocument();

    await user.click(legacyBtn);

    expect(await screen.findByText("Coming soon")).toBeInTheDocument();
    expect(
      screen.getByText(/Hi! I'm Novera, WSO2's internal AI agent/i),
    ).toBeInTheDocument();
  });
});
