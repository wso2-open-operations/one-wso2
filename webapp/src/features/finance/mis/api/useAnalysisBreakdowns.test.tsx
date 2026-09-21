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

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpError } from "@api/http";

// The two breakdowns' reads — N calls of one endpoint, each answering with one
// figure, reassembled into a series.
//
// The request BODIES are pinned in `misAnalysisRequest.test.ts`. What is under
// test here is the reassembly, which is where a figure can land against the
// wrong industry: `useColumnQueries` returns a positional list, and these hooks
// turn it back into something keyed by name.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: { exitArrSearch: "https://mis.example/exit-arr/search" },
}));

// Answers keyed by the body's distinguishing field, so a figure can be traced
// to the call that asked for it — which is the whole point of these tests.
const byPartnerType = new Map<string, unknown>();
const byIndustryAnswer = new Map<string, unknown>();
const authedPost = vi.fn(async (_url: string, body: { partnerType?: string; industries?: string[] }) => {
  const answer = body.industries
    ? byIndustryAnswer.get(body.industries[0])
    : byPartnerType.get(String(body.partnerType));
  if (answer instanceof Error) throw answer;
  return answer;
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (url: string, _token: string, body: unknown) => authedPost(url, body as never),
  };
});

const { useAnalysisIndustries, useAnalysisPartnerModels } = await import(
  "./useAnalysisBreakdowns"
);
const { defaultAnalysisFilters } = await import("../util/misAnalysisFilters");
const { ANALYSIS_INDUSTRIES } = await import("../components/analysisBreakdowns");

const ON = { year: 2026, month: 9, day: 21 };
const filters = defaultAnalysisFilters(ON);

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
  >
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  authedPost.mockClear();
  byPartnerType.clear();
  byIndustryAnswer.clear();
});

describe("the partner-model split", () => {
  it("puts each model's figure against that model", async () => {
    byPartnerType.set("Channel", 300);
    byPartnerType.set("Direct", 700);
    const { result } = renderHook(() => useAnalysisPartnerModels(filters, ON), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.channel).toBe(300);
    expect(result.current.direct).toBe(700);
  });

  // The figures come back as a positional list, and the two calls can settle in
  // either order. Matching on the model NAME rather than on an index is what
  // stops Channel's figure landing against Direct.
  it("does not depend on which of the two answered first", async () => {
    byPartnerType.set("Channel", 111);
    byPartnerType.set("Direct", 999);
    const { result } = renderHook(() => useAnalysisPartnerModels(filters, ON), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.channel).toBe(111);
  });

  // The side that was not asked about — the reader has narrowed to one model —
  // stays absent rather than becoming 0. The chart drops a zero segment either
  // way; what this buys is that a FAILURE can say so.
  it("leaves the unasked side absent when the reader narrowed to one model", async () => {
    byPartnerType.set("Channel", 500);
    const narrowed = { ...filters, partnerType: "Channel" };
    const { result } = renderHook(() => useAnalysisPartnerModels(narrowed, ON), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.channel).toBe(500);
    expect(result.current.direct).toBeUndefined();
    expect(authedPost).toHaveBeenCalledTimes(1);
  });

  // The case that tells a NAME lookup from a POSITIONAL one, and the only one
  // that does. Narrowed to Channel there is one column and it is index 0, so
  // reading by position happens to be right; narrowed to DIRECT there is still
  // one column at index 0, and reading by position would report the figure as
  // Channel's — a chart confidently labelling the whole book with the wrong
  // partner model. (Found by mutation: replacing the name lookup with
  // `columns[0]`/`columns[1]` left this suite green until this case existed.)
  it("puts a Direct-only figure against Direct, not against the first column", async () => {
    byPartnerType.set("Direct", 500);
    const narrowed = { ...filters, partnerType: "Direct" };
    const { result } = renderHook(() => useAnalysisPartnerModels(narrowed, ON), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.direct).toBe(500);
    expect(result.current.channel).toBeUndefined();
  });

  it("says so, with a retry, when both reads failed", async () => {
    const failure = new HttpError("https://mis.example", 403, "");
    byPartnerType.set("Channel", failure);
    byPartnerType.set("Direct", failure);
    const { result } = renderHook(() => useAnalysisPartnerModels(filters, ON), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.channel).toBeUndefined();
    expect(result.current.errorMessage).not.toBe("");
  });

  // One failing call blanks only itself — the source's `allSettled` behaviour,
  // which falls out of these being separate queries. Half a split is still not
  // drawn, but that is the chart's decision and it can tell which half is gone.
  it("keeps the half that answered when only one read failed", async () => {
    byPartnerType.set("Channel", 300);
    byPartnerType.set("Direct", new HttpError("https://mis.example", 403, ""));
    const { result } = renderHook(() => useAnalysisPartnerModels(filters, ON), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.channel).toBe(300);
    expect(result.current.direct).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });
});

describe("the industry breakdown", () => {
  const offered = [...ANALYSIS_INDUSTRIES];

  it("puts each industry's figure against that industry", async () => {
    byIndustryAnswer.set("Information", 400);
    byIndustryAnswer.set("Utilities", 100);
    const { result } = renderHook(
      () => useAnalysisIndustries(filters, ON, offered),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.byIndustry.Information).toBe(400);
    expect(result.current.byIndustry.Utilities).toBe(100);
  });

  it("asks once per industry the chart names", async () => {
    for (const industry of offered) byIndustryAnswer.set(industry, 1);
    const { result } = renderHook(
      () => useAnalysisIndustries(filters, ON, offered),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).toHaveBeenCalledTimes(offered.length);
  });

  // The whole reason `asked` is carried rather than inferred. An industry that
  // WAS asked and answered zero belongs in the set; one that was never asked
  // does not — and from `byIndustry` alone the two look identical.
  it("reports which industries it asked about, zero answers included", async () => {
    byIndustryAnswer.set("Information", 0);
    const { result } = renderHook(
      () => useAnalysisIndustries(filters, ON, ["Information"]),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.asked.has("Information")).toBe(true);
    expect(result.current.byIndustry.Information).toBe(0);
    expect(result.current.asked.has("Utilities")).toBe(false);
  });

  it("asks about nothing, and reports nothing asked, with no list from the backend", () => {
    const { result } = renderHook(() => useAnalysisIndustries(filters, ON, []), { wrapper });
    expect(authedPost).not.toHaveBeenCalled();
    expect(result.current.asked.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  // One industry failing leaves the others standing, so a single bad call costs
  // one bar rather than the chart. It is still in `asked` — the question WAS
  // put — and the absent amount is what the chart reads.
  it("loses only the industry whose read failed", async () => {
    byIndustryAnswer.set("Information", 400);
    byIndustryAnswer.set("Utilities", new HttpError("https://mis.example", 403, ""));
    const { result } = renderHook(
      () => useAnalysisIndustries(filters, ON, ["Information", "Utilities"]),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.byIndustry.Information).toBe(400);
    expect(result.current.byIndustry.Utilities).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it("asks nothing while it is disabled", () => {
    renderHook(() => useAnalysisIndustries(filters, ON, offered, false), { wrapper });
    expect(authedPost).not.toHaveBeenCalled();
  });
});
