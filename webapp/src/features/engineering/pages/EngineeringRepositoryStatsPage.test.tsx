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

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import EngineeringRepositoryStatsPage from "./EngineeringRepositoryStatsPage";

vi.mock("recharts", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      React.createElement(actual.ResponsiveContainer, { width: 640, height: 280, children }),
  };
});

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({
    isSignedIn: true,
    isLoading: false,
    getAccessToken: async () => "test-token",
    signIn: vi.fn(),
  }),
}));

const originalConfig = window.config;

afterEach(() => {
  window.config = originalConfig;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderStats(path = "/engineering/repository-stats") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="engineering/repository-stats" element={<EngineeringRepositoryStatsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function configured(): Window["config"] {
  return {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
    ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
  } as Window["config"];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const repositories = {
  repositories: [
    {
      id: 7,
      repoName: "product-apim",
      productName: "API Manager",
      isActive: true,
      latestSnapshot: {
        stargazersCount: 120,
        forksCount: 30,
        watchersCount: 8,
        openIssuesCount: 2,
      },
    },
    {
      id: 8,
      repoName: "product-is",
      productName: "Identity Server",
      isActive: true,
      latestSnapshot: {
        stargazersCount: 40,
        forksCount: 9,
        watchersCount: 3,
        openIssuesCount: 1,
      },
    },
    {
      id: 9,
      repoName: "product-old",
      productName: "Retired",
      isActive: false,
      latestSnapshot: {
        stargazersCount: 1,
        forksCount: 1,
        watchersCount: 1,
        openIssuesCount: 1,
      },
    },
  ],
};

const clones = {
  series: [
    {
      repoId: 7,
      repoName: "product-apim",
      points: [
        { date: "2026-09-28", count: 10, uniques: 4 },
        { date: "2026-09-29", count: 6, uniques: 2 },
      ],
    },
    {
      repoId: 8,
      repoName: "product-is",
      points: [{ date: "2026-09-28", count: 1, uniques: 1 }],
    },
  ],
};

function statsFetch(url: string): Promise<Response> {
  if (url.includes("/api/v1/repositories")) return Promise.resolve(json(repositories));
  if (url.includes("/stats/clones")) return Promise.resolve(json(clones));
  if (url.includes("/stats/metric")) {
    return Promise.resolve(
      json({
        series: [
          {
            repoId: 7,
            repoName: "product-apim",
            points: [
              { date: "2026-09-01", value: 5 },
              { date: "2026-09-28", value: 3 },
            ],
          },
        ],
      }),
    );
  }
  return Promise.resolve(json({}, 404));
}

describe("Repository Stats", () => {
  it("keeps the measure in the address, explains unique cloners, and searches the table", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);

    renderStats();

    expect(await screen.findByRole("heading", { name: "Repository Stats" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Unique cloners are summed per day and the same person on different days counts separately.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Identity Server" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Retired" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "120" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "16" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "6" })).toBeInTheDocument();

    const clonesCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/clones"));
    const clonesUrl = new URL(String(clonesCall?.[0]));
    expect(clonesUrl.searchParams.get("from")).toBe("2026-08-31");
    expect(clonesUrl.searchParams.get("to")).toBe("2026-09-30");

    await userEvent.click(screen.getByRole("combobox", { name: "Measure" }));
    await userEvent.click(await screen.findByRole("option", { name: "Forks" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("stat=forks"));
    expect(screen.getByTestId("where")).toHaveTextContent("from=2026-08-31");
    expect(screen.getByTestId("where")).toHaveTextContent("to=2026-09-30");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("metric=forks")),
      ).toBe(true),
    );

    await userEvent.type(screen.getByRole("textbox", { name: "Search products" }), "Identity");
    expect(screen.queryByRole("cell", { name: "API Manager" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Identity Server" })).toBeInTheDocument();
  });

  it("reads a month as the sum of that month's daily changes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(statsFetch));
    renderStats();

    expect(await screen.findByRole("cell", { name: "120" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getAllByRole("cell", { name: "8" })).toHaveLength(4);
    expect(screen.queryByRole("cell", { name: "120" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Daily" }));
    expect(screen.queryByRole("cell", { name: "8" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "0" }).length).toBeGreaterThan(0);
  });

  it("keeps the grain in the address and asks the metric series for it", async () => {
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);
    renderStats("/engineering/repository-stats?interval=month");

    expect(await screen.findByRole("cell", { name: "120" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Chart type" })).not.toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("interval=month");
    const monthCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("interval=month"));
    const dayCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("interval=day"));
    expect(monthCall).toBeTruthy();
    expect(dayCall).toBeTruthy();
  });

  it("limits the table and the request to the products in the address", async () => {
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);
    renderStats("/engineering/repository-stats?repos=7");

    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Identity Server" })).not.toBeInTheDocument();
    const metricCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/metric"));
    expect(new URL(String(metricCall?.[0])).searchParams.get("repos")).toBe("7");
  });

  it("plots unique cloners from clone history without asking for a cloner metric", async () => {
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);
    renderStats("/engineering/repository-stats?stat=uniqueCloners&interval=cumulative");

    expect(await screen.findByRole("cell", { name: "6" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Unique cloners are summed per day and the same person on different days counts separately.",
      ),
    ).toBeInTheDocument();
    const clonesCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/clones"));
    expect(new URL(String(clonesCall?.[0])).searchParams.get("interval")).toBeNull();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("metric=uniqueCloners"))).toBe(false);
    expect(screen.getByRole("group", { name: "Chart type" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Bars" }));
    expect(screen.getByTestId("where")).not.toHaveTextContent("chart=");
  });

  it("plots only the dates the API returned", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(statsFetch));
    renderStats("/engineering/repository-stats?from=2026-08-31&to=2026-09-30");
    expect(await screen.findByText("2026-09-28")).toBeInTheDocument();
    expect(screen.queryByText("2026-08-31")).not.toBeInTheDocument();
  });

  it("does not request stats when From is after To", async () => {
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);
    renderStats("/engineering/repository-stats?from=2026-09-10&to=2026-09-01");
    expect(await screen.findByText("From is after To.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/stats/"))).toBe(false);
  });

  it("says there is no data when the range is empty", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) return json({ repositories: [] });
        return json({ series: [] });
      }),
    );
    renderStats();
    expect(await screen.findByText("No data for the selected range")).toBeInTheDocument();
  });

  it("names a failed table query when the chart request succeeded", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) return json({ repositories: [] });
        if (url.includes("metric=forks")) return json({ message: "forks unavailable" }, 500);
        return json({ series: [] });
      }),
    );
    renderStats("/engineering/repository-stats?interval=month");
    expect(await screen.findByText(/forks unavailable/i)).toBeInTheDocument();
  });

  it("shows an error the person can retry", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) return json({ repositories: [] });
      return json({ message: "no" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderStats();
    expect(await screen.findByText(/couldn't load repository stats/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/stats/")).length).toBeGreaterThan(1);
  });

  it("says Engineering is not available when the preview is off", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: false },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
    } as Window["config"];
    renderStats();
    expect(screen.getByText(/engineering isn't available yet/i)).toBeInTheDocument();
  });

  it("does not send the access token to an http address", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://stats.example",
    } as Window["config"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderStats();
    expect(screen.getByText(/needs an https address/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says Repository Stats is not connected and makes no request", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
    } as Window["config"];
    delete window.config?.ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderStats();
    expect(screen.getByText(/isn't connected yet/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}
