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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// The Testing step offers a Retrigger next to an automated result that has
// not succeeded, and the real fetch and post hooks run: only the HTTP helpers
// are stubbed.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UmtStagingTestResultRecord, UmtUpdateSummary } from "../api/umtUpdates";
import {
  UMT_RETRIGGER_POLL_WINDOW_MS,
  umtCanRetriggerAutomatedTest,
  umtShouldPollStagingTestResults,
} from "../lib/umtTesting";

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const notify = vi.hoisted(() => ({ showSuccess: vi.fn(), showError: vi.fn() }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ ...notify, showWarning: vi.fn() }),
}));

const state = vi.hoisted(() => ({ records: [] as unknown[] }));
const authedGet = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => state.records);
const authedPost = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null);
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedGet: (...args: unknown[]) => authedGet(...args),
    authedPost: (...args: unknown[]) => authedPost(...args),
  };
});

// `@config/apiConfig` reads `window.config` at module load.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const { default: UmtTestingStep } = await import("../components/edit/testing/UmtTestingStep");
const { useUmtStagingTestResults } = await import("../api/useUmtTesting");
const { umtServiceUrls } = await import("@config/apiConfig");

function record(
  productId: number,
  productName: string,
  baseVersion: string,
  automatedTestResult: string,
  channel?: string,
): UmtStagingTestResultRecord {
  return { productId, productName, baseVersion, automatedTestResult, manualTestResult: "success", channel };
}

const FAILED = record(1, "wso2am", "4.2.0", "failure");
const UNSTABLE = record(2, "wso2is", "7.0.0", "unstable");
const PENDING = record(3, "wso2mi", "4.3.0", "pending");
const SUCCEEDED = record(4, "wso2si", "4.3.1", "success");
const BUILDING = record(5, "wso2sp", "4.4.0", "building");

function renderStep(lifecycleState = "Staging") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const update = { id: 42, lifecycleState, products: [] } as UmtUpdateSummary;
  render(
    <QueryClientProvider client={client}>
      <UmtTestingStep id="42" update={update} />
    </QueryClientProvider>,
  );
  return client;
}

// The refetchInterval the results query is currently polling by.
function resultsInterval(client: QueryClient) {
  const [query] = client.getQueryCache().findAll({ queryKey: ["umt-update-staging-test-results"] });
  return (query?.options as unknown as { refetchInterval: (q: unknown) => number | false }).refetchInterval(query);
}

const retriggerButton = (productName: string) => screen.queryByRole("button", { name: new RegExp(`Retrigger.*${productName}`) });

beforeEach(() => {
  state.records = [FAILED, UNSTABLE, PENDING, SUCCEEDED, BUILDING];
  authedGet.mockClear();
  authedPost.mockClear();
  notify.showSuccess.mockClear();
  notify.showError.mockClear();
});

describe("Retrigger on the Testing step", () => {
  it("is offered next to each automated result that has not succeeded and is not running", async () => {
    renderStep();
    await screen.findByText("wso2am - 4.2.0");

    expect(retriggerButton("wso2am")).toBeInTheDocument();
    expect(retriggerButton("wso2is")).toBeInTheDocument();
    expect(retriggerButton("wso2mi")).toBeInTheDocument();
    expect(retriggerButton("wso2si")).not.toBeInTheDocument();
    expect(retriggerButton("wso2sp")).not.toBeInTheDocument();
  });

  it("is offered on a full-channel row, or one with no channel, and not on another channel", async () => {
    state.records = [
      record(1, "wso2am", "4.2.0", "failure", "full"),
      record(2, "wso2is", "7.0.0", "failure"),
      record(3, "wso2mi", "4.3.0", "failure", "security"),
    ];
    renderStep();
    await screen.findByText("wso2am - 4.2.0");

    expect(retriggerButton("wso2am")).toBeInTheDocument();
    expect(retriggerButton("wso2is")).toBeInTheDocument();
    expect(retriggerButton("wso2mi")).not.toBeInTheDocument();
  });

  it("is not offered on a row missing its product name or base version", async () => {
    state.records = [
      { ...FAILED, productId: 6, productName: null },
      { ...FAILED, productId: 7, baseVersion: undefined },
      FAILED,
    ];
    renderStep();
    await screen.findByText("wso2am - 4.2.0");

    expect(screen.getAllByRole("button", { name: /Retrigger/ })).toHaveLength(1);
  });

  it("is not offered before the update reaches Staging", async () => {
    renderStep("TestingEnvironmentCreated");
    await screen.findByText("wso2am - 4.2.0");

    expect(retriggerButton("wso2am")).not.toBeInTheDocument();
  });

  it("posts the product and its base version, then shows the run as building", async () => {
    state.records = [FAILED];
    authedPost.mockImplementationOnce(async () => {
      state.records = [{ ...FAILED, automatedTestResult: "building" }];
      return null;
    });
    renderStep();
    await userEvent.click(await screen.findByRole("button", { name: /Retrigger.*wso2am/ }));

    await waitFor(() => expect(notify.showSuccess).toHaveBeenCalledWith("Retrigger request submitted."));
    expect(authedPost).toHaveBeenCalledTimes(1);
    expect(authedPost).toHaveBeenCalledWith(
      umtServiceUrls.updateIntegrationTestStagingRetrigger("42", "wso2am", "4.2.0"),
      "token",
      null,
    );
    expect(await screen.findByText("Building")).toBeInTheDocument();
    expect(retriggerButton("wso2am")).not.toBeInTheDocument();
  });

  it("keeps polling after a retrigger even when the refetch still shows the previous result", async () => {
    state.records = [FAILED];
    const client = renderStep();
    await screen.findByText("wso2am - 4.2.0");
    expect(resultsInterval(client)).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: /Retrigger.*wso2am/ }));

    await waitFor(() => expect(notify.showSuccess).toHaveBeenCalledWith("Retrigger request submitted."));
    expect(screen.getByText("Failure")).toBeInTheDocument();
    await waitFor(() => expect(resultsInterval(client)).toBe(3000));
  });

  it("withholds Retrigger from an accepted row while the refetch still shows the previous result, then offers it again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      state.records = [FAILED, UNSTABLE];
      renderStep();
      await user.click(await screen.findByRole("button", { name: /Retrigger.*wso2am/ }));

      await waitFor(() => expect(notify.showSuccess).toHaveBeenCalledWith("Retrigger request submitted."));
      expect(screen.getByText("Failure")).toBeInTheDocument();
      expect(retriggerButton("wso2am")).not.toBeInTheDocument();
      expect(retriggerButton("wso2is")).toBeInTheDocument();
      expect(authedPost).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(UMT_RETRIGGER_POLL_WINDOW_MS);
      });

      expect(retriggerButton("wso2am")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a failed retrigger and keeps the button", async () => {
    state.records = [FAILED];
    authedPost.mockRejectedValueOnce(new Error("The request failed"));
    renderStep();

    await userEvent.click(await screen.findByRole("button", { name: /Retrigger.*wso2am/ }));

    await waitFor(() => expect(notify.showError).toHaveBeenCalledTimes(1));
    expect(notify.showError).toHaveBeenCalledWith(expect.stringContaining("Failed to retrigger"));
    expect(notify.showSuccess).not.toHaveBeenCalled();
    expect(retriggerButton("wso2am")).toBeEnabled();
  });
});

describe("the product heading on the Testing step", () => {
  it("links to the staging build when the record has a build URL", async () => {
    state.records = [{ ...SUCCEEDED, buildUrlWithBuildId: "https://jenkins.example.com/job/wso2si/12/" }];
    renderStep();

    const link = await screen.findByRole("link", { name: "wso2si - 4.3.1 (staging build, opens in a new tab)" });
    expect(link).toHaveAttribute("href", "https://jenkins.example.com/job/wso2si/12/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("is plain text when the build URL is blank", async () => {
    state.records = [{ ...SUCCEEDED, buildUrlWithBuildId: " " }];
    renderStep();

    await screen.findByText("wso2si - 4.3.1");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("is plain text when the build URL is not http or https", async () => {
    state.records = [{ ...SUCCEEDED, buildUrlWithBuildId: "javascript:alert(1)" }];
    renderStep();

    await screen.findByText("wso2si - 4.3.1");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("is plain text when the build URL does not parse", async () => {
    state.records = [{ ...SUCCEEDED, buildUrlWithBuildId: "https://jenkins.example.com:bad-port/job/12/" }];
    renderStep();

    await screen.findByText("wso2si - 4.3.1");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("which automated results can be retriggered", () => {
  it("is every result except a success and a run in progress", () => {
    for (const result of ["failure", "unstable", "pending", "error", "", null, undefined]) {
      expect(umtCanRetriggerAutomatedTest(result)).toBe(true);
    }
    for (const result of ["success", "building", "SUCCESS", " Building "]) {
      expect(umtCanRetriggerAutomatedTest(result)).toBe(false);
    }
  });
});

describe("polling the staging results at Staging", () => {
  it("continues while a run is building, and stops once none is", () => {
    expect(umtShouldPollStagingTestResults("Staging", [SUCCEEDED, BUILDING])).toBe(true);
    expect(umtShouldPollStagingTestResults("Staging", [SUCCEEDED, FAILED])).toBe(false);
    expect(umtShouldPollStagingTestResults("Staging", [])).toBe(false);
    expect(umtShouldPollStagingTestResults("Staging", undefined)).toBe(false);
  });

  it("continues for a bounded window after a retrigger, even with no run building", () => {
    const retriggeredAt = 1_000_000;
    const within = retriggeredAt + UMT_RETRIGGER_POLL_WINDOW_MS - 1;
    const after = retriggeredAt + UMT_RETRIGGER_POLL_WINDOW_MS;

    expect(umtShouldPollStagingTestResults("Staging", [FAILED], retriggeredAt, within)).toBe(true);
    expect(umtShouldPollStagingTestResults("Staging", [FAILED], retriggeredAt, after)).toBe(false);
    expect(umtShouldPollStagingTestResults("Staging", [BUILDING], retriggeredAt, after)).toBe(true);
    expect(umtShouldPollStagingTestResults("Staging", [FAILED], null, within)).toBe(false);
    expect(umtShouldPollStagingTestResults("TestingEnvironmentFailed", [FAILED], retriggeredAt, within)).toBe(false);
  });

  it("is what the results query follows", async () => {
    async function intervalFor(records: UmtStagingTestResultRecord[]) {
      state.records = records;
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      renderHook(() => useUmtStagingTestResults("42", "Staging"), { wrapper });
      await waitFor(() => expect(client.getQueryCache().findAll()[0]?.state.data).toBeDefined());
      const query = client.getQueryCache().findAll()[0];
      return (query.options as unknown as { refetchInterval: (q: unknown) => number | false }).refetchInterval(query);
    }

    expect(await intervalFor([BUILDING])).toBe(3000);
    expect(await intervalFor([SUCCEEDED])).toBe(false);
  });
});
