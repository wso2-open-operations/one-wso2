// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedPost = vi.fn(() => Promise.resolve(null));
const authedPut = vi.fn(() => Promise.resolve(null));
const fetchWithReauth = vi.fn();
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (...args: unknown[]) => authedPost(...(args as [])),
    authedPut: (...args: unknown[]) => authedPut(...(args as [])),
    fetchWithReauth: (...args: unknown[]) => fetchWithReauth(...(args as [])),
  };
});

function textResponse(body: string, ok = true, status = 200) {
  return { ok, status, text: async () => body };
}

// `@config/apiConfig` reads `window.config` once at module-load time (jsdom
// has no such global), so this must be set before the dynamic imports below
// trigger that module's first evaluation.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const {
  useUmtPrAnalysisStatus,
  useUmtStartPullRequestAnalysis,
  useUmtProceedFromPrAnalysis,
  useUmtUploadPullRequestAnalysisFile,
} = await import("./useUmtPrAnalysis");
const { umtServiceUrls } = await import("@config/apiConfig");

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  authedPost.mockClear();
  authedPut.mockClear();
  fetchWithReauth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtPrAnalysisStatus", () => {
  it("seeds from the initial status without an immediate fetch", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUmtPrAnalysisStatus("42", "COMPLETED", true), {
      wrapper: wrapper(client),
    });
    expect(result.current.data).toBe("COMPLETED");
    expect(fetchWithReauth).not.toHaveBeenCalled();
  });

  // Regression test: the backend sends `content-type: application/json` but
  // the body is a bare, unquoted status word (e.g. `COMPLETED`, not
  // `"COMPLETED"`) — not valid JSON. Parsing it as JSON throws on every poll,
  // so the query never leaves its seeded initialData. This must be read as
  // plain text.
  it("reads the bare (non-JSON) status text the backend actually returns", async () => {
    fetchWithReauth.mockResolvedValue(textResponse("COMPLETED"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ["umt-update-pr-analysis-status", "user-under-test", "42"];

    renderHook(() => useUmtPrAnalysisStatus("42", "QUEUED", true), { wrapper: wrapper(client) });
    await act(async () => {
      await client.refetchQueries({ queryKey });
    });

    expect(client.getQueryData(queryKey)).toBe("COMPLETED");
  });

  it("computes a 3s refetch interval while queued or processing, and stops once terminal — purely from the current status, with no other state to get stuck", () => {
    fetchWithReauth.mockResolvedValue(textResponse("QUEUED"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtPrAnalysisStatus("42", "QUEUED", true), { wrapper: wrapper(client) });

    const queryKey = ["umt-update-pr-analysis-status", "user-under-test", "42"];
    const query = client.getQueryCache().find({ queryKey });
    expect(query).toBeDefined();
    const options = query!.options as unknown as { refetchInterval: (q: unknown) => number | false };
    const refetchInterval = options.refetchInterval;

    expect(refetchInterval({ state: { data: "QUEUED" } })).toBe(3000);
    expect(refetchInterval({ state: { data: "PROCESSING" } })).toBe(3000);
    expect(refetchInterval({ state: { data: "COMPLETED" } })).toBe(false);
    expect(refetchInterval({ state: { data: "failed: some reason" } })).toBe(false);
  });
});

describe("useUmtStartPullRequestAnalysis", () => {
  it("POSTs the analysis payload and invalidates status + results", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtStartPullRequestAnalysis("42"), { wrapper: wrapper(client) });

    const payload = {
      updateId: "42",
      pullRequests: [{ pr: "https://github.com/wso2/repo/pull/1" }],
      additionalFileOperations: [],
      bundlesInfoChanges: [],
      isInstructionsOnly: false,
      isContainerizedUpdate: false,
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.updatePullRequestAnalysis("42"), "token", payload);
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining(["umt-update-pr-analysis-status", "umt-update-pull-request-analysis"]),
    );
  });
});

describe("useUmtProceedFromPrAnalysis", () => {
  it("promotes lifecycleState to PRAnalyzed then starts product analysis, and invalidates the right queries", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtProceedFromPrAnalysis("42"), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.update("42"), "token", {
      lifecycleState: "PRAnalyzed",
    });
    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.updateProductAnalysis("42"), "token", {});

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        "umt-update",
        "umt-updates",
        "umt-update-lifecycle-history",
        "umt-update-product-analysis",
      ]),
    );
  });
});

describe("useUmtUploadPullRequestAnalysisFile", () => {
  it("uploads multipart fields to the file endpoint", async () => {
    fetchWithReauth.mockResolvedValue({ ok: true });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useUmtUploadPullRequestAnalysisFile("42"), { wrapper: wrapper(client) });

    const file = new File(["contents"], "bundle.jar");
    await act(async () => {
      await result.current.mutateAsync({
        relativePath: "/repository/components/plugins/bundle.jar",
        sourceFilePath: "",
        file,
      });
    });

    expect(fetchWithReauth).toHaveBeenCalledTimes(1);
    const [url, init] = fetchWithReauth.mock.calls[0];
    expect(url).toBe(umtServiceUrls.updatePullRequestAnalysisFile("42"));
    expect(init.method).toBe("POST");
    const formData = init.body as FormData;
    expect(formData.get("relativePath")).toBe("/repository/components/plugins/bundle.jar");
    expect(formData.get("id")).toBe("42");
    expect(formData.get("file")).toBe(file);
  });

  it("throws when the upload response is not ok", async () => {
    fetchWithReauth.mockResolvedValue({ ok: false, status: 400, text: async () => "bad request" });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useUmtUploadPullRequestAnalysisFile("42"), { wrapper: wrapper(client) });

    await expect(
      result.current.mutateAsync({ relativePath: "/a", sourceFilePath: "", file: new File([], "a") }),
    ).rejects.toThrow();
  });
});

// Regression test for a real bug: UmtPrAnalysisStep.tsx's "awaitingConfirmation"
// reset used to fire on ANY confirmed status (QUEUED/PROCESSING/COMPLETED/
// failed) transitioning from unconfirmed to confirmed. That broke whenever
// Analyze was re-run on an update whose PREVIOUS run already left a terminal
// status (e.g. COMPLETED) — the "confirmed" boolean was already true before
// the click and never dipped to false in between, so the reset condition
// never fired even once the backend reported COMPLETED again for the new
// run — hasConfirmedSignal was already true (from the PREVIOUS run's
// terminal status) before the click, so it never saw a false→true edge to
// reset on. Fixed not by patching that reset heuristic but by removing the
// flag entirely: the backend commits praStatus to QUEUED synchronously
// before the start-analysis POST returns (verified directly against
// UpdateManagerHelper#pullRequestAnalysisSubmit / UpdateRepository#savePraInfo
// in the real backend source), so the query invalidation the mutation fires
// on success is guaranteed to refetch an already-fresh status — the plain
// isInFlight check in refetchInterval is sufficient on its own. This test
// wires the REAL mutation + REAL status hook together (no hand-rolled flag)
// to prove the full flow self-terminates even when the previous run also
// ended in COMPLETED.
describe("PR-analysis status polling stops after re-running Analyze (regression)", () => {
  let statusCallCount: number;

  function nextStatusResponse() {
    statusCallCount += 1;
    if (statusCallCount === 1) return textResponse("QUEUED");
    if (statusCallCount === 2) return textResponse("PROCESSING");
    return textResponse("COMPLETED");
  }

  function Harness() {
    const status = useUmtPrAnalysisStatus("100000", "COMPLETED", true);
    const startAnalysis = useUmtStartPullRequestAnalysis("100000");
    return (
      <button
        onClick={() =>
          void startAnalysis.mutateAsync({
            updateId: "100000",
            pullRequests: [],
            additionalFileOperations: [],
            bundlesInfoChanges: [],
            isInstructionsOnly: false,
            isContainerizedUpdate: false,
          })
        }
        data-testid="analyze"
      >
        {status.data ?? "loading"}
      </button>
    );
  }

  beforeEach(() => {
    statusCallCount = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops polling once the NEW run genuinely completes, even though the previous run also ended in COMPLETED", async () => {
    authedPost.mockResolvedValue(null);
    fetchWithReauth.mockImplementation(() => Promise.resolve(nextStatusResponse()));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { getByTestId } = render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fetchWithReauth.mockClear();
    statusCallCount = 0;

    // Click Analyze — the real mutation POSTs, then its onSuccess invalidates
    // the status query, triggering an immediate refetch (QUEUED).
    await act(async () => {
      await getByTestId("analyze").click();
    });
    // Next poll: PROCESSING.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    // Next poll: COMPLETED (the new run's real completion).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    const callsRightAfterCompleted = fetchWithReauth.mock.calls.length;

    // Advance well beyond several more poll intervals.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(fetchWithReauth.mock.calls.length).toBe(callsRightAfterCompleted);
  });
});
