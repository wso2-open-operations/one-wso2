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

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  Box,
  Card,
  CircularProgress,
  ListingTable,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { Bar, BarChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState, type JSX } from "react";
import { useSearchParams } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  dailyRange,
  getCloneSeries,
  getMetricSeries,
  getRepositories,
  isCredentialedProductDownloadStatsUrl,
  isProductDownloadStatsConfigured,
  productDownloadStatsBackendUrl,
  type CloneSeriesItem,
  type DailySeries,
  type ReleaseDownloadGrain,
  type RepositoryMeasure,
  type RepositorySnapshot,
} from "@features/engineering/api/productDownloadStats";
import { dailyChartModel } from "./dailyChartModel";
import { formatCount, productLabel } from "./display";

type StatKey = RepositoryMeasure | "clones" | "uniqueCloners";
type TableMode = "total" | "month" | "day";

const STAT_OPTIONS: ReadonlyArray<{ value: StatKey; label: string }> = [
  { value: "stars", label: "Stars" },
  { value: "forks", label: "Forks" },
  { value: "watchers", label: "Watchers" },
  { value: "openIssues", label: "Open Issues" },
  { value: "clones", label: "Total Clones" },
  { value: "uniqueCloners", label: "Unique Cloners" },
];

const GITHUB_MEASURES: readonly RepositoryMeasure[] = ["stars", "forks", "watchers", "openIssues"];

function readGrain(value: string | null): ReleaseDownloadGrain {
  if (value === "month" || value === "cumulative") return value;
  return "day";
}

function readStat(value: string | null): StatKey {
  return STAT_OPTIONS.some((option) => option.value === value) ? (value as StatKey) : "stars";
}

function readRepos(value: string | null): number[] {
  return (value ?? "")
    .split(",")
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function defaultTableDate(mode: TableMode, to: string): string {
  if (mode === "day") return to;
  if (mode === "month") return to.slice(0, 7);
  return "";
}

function isGithubMeasure(stat: StatKey): stat is RepositoryMeasure {
  return (GITHUB_MEASURES as readonly string[]).includes(stat);
}

// Total uses the latest snapshot. Day and month read the daily change series:
// a month is the sum of that month's changes, not the last day's change.
function changeAt(
  series: readonly DailySeries[] | undefined,
  repoId: number,
  mode: TableMode,
  date: string,
): number | null {
  if (mode === "total" || series == null || date === "") return null;
  const item = series.find((candidate) => candidate.repoId === repoId);
  if (!item) return 0;
  if (mode === "day") return item.points.find((point) => point.date === date)?.value ?? 0;
  return item.points
    .filter((point) => point.date.startsWith(date))
    .reduce((sum, point) => sum + point.value, 0);
}

function snapshotCount(
  snapshot: RepositorySnapshot | null | undefined,
  field: keyof RepositorySnapshot,
): number {
  return snapshot?.[field] ?? 0;
}

function cloneTotals(
  series: readonly CloneSeriesItem[],
  mode: TableMode,
  date: string,
): Map<number, { count: number; uniques: number }> {
  const totals = new Map<number, { count: number; uniques: number }>();
  for (const item of series) {
    let points = item.points;
    if (mode === "month" && date !== "") {
      points = item.points.filter((point) => point.date.startsWith(date));
    } else if (mode === "day" && date !== "") {
      points = item.points.filter((point) => point.date === date);
    }
    totals.set(item.repoId, {
      count: points.reduce((sum, point) => sum + point.count, 0),
      uniques: points.reduce((sum, point) => sum + point.uniques, 0),
    });
  }
  return totals;
}

// Clone history has no grain of its own. Month sums the days, and cumulative
// is a running total of those daily counts.
function cloneChartSeries(
  series: readonly CloneSeriesItem[],
  field: "count" | "uniques",
  interval: ReleaseDownloadGrain,
): DailySeries[] {
  return series.map((item) => {
    const daily = item.points.map((point) => ({ date: point.date, value: point[field] }));
    if (interval === "month") {
      const byMonth = new Map<string, number>();
      for (const point of daily) {
        const month = point.date.slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + point.value);
      }
      return {
        repoId: item.repoId,
        repoName: item.repoName,
        points: [...byMonth.entries()]
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([date, value]) => ({ date, value })),
      };
    }
    if (interval === "cumulative") {
      let running = 0;
      return {
        repoId: item.repoId,
        repoName: item.repoName,
        points: daily.map((point) => {
          running += point.value;
          return { date: point.date, value: running };
        }),
      };
    }
    return { repoId: item.repoId, repoName: item.repoName, points: daily };
  });
}

export default function EngineeringRepositoryStatsPage(): JSX.Element {
  const preview = isPreviewEnabled("engineering");
  const configured = isProductDownloadStatsConfigured();
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const allowed = isCredentialedProductDownloadStatsUrl(base);
  const defaults = dailyRange();
  const from = params.get("from") || defaults.from;
  const to = params.get("to") || defaults.to;
  const interval = readGrain(params.get("interval"));
  const stat = readStat(params.get("stat"));
  const repos = readRepos(params.get("repos"));
  const enabled = preview && configured && allowed;
  const rangeInverted = from > to;
  const queryEnabled = enabled && !rangeInverted;
  const repoKey = repos.join(",");
  const [tableMode, setTableMode] = useState<TableMode>("total");
  const [tableDate, setTableDate] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [chart, setChart] = useState<"line" | "bar">("line");

  const repositories = useQuery({
    queryKey: ["product-download-stats", "repositories", base],
    enabled,
    queryFn: async () => getRepositories(await getToken()),
  });
  const clones = useQuery({
    queryKey: ["product-download-stats", "clones", base, from, to, repoKey],
    enabled: queryEnabled,
    queryFn: async () => getCloneSeries(await getToken(), { from, to, repos }),
  });
  const chartMeasure = isGithubMeasure(stat) ? stat : null;
  const metric = useQuery({
    queryKey: ["product-download-stats", "metric", base, chartMeasure, from, to, interval, repoKey],
    enabled: queryEnabled && chartMeasure != null,
    queryFn: async () =>
      getMetricSeries(await getToken(), {
        metric: chartMeasure ?? "stars",
        from,
        to,
        interval,
        repos,
      }),
  });
  const starsTable = useDayMetric("stars", { base, from, to, repoKey, repos, queryEnabled, getToken });
  const forksTable = useDayMetric("forks", { base, from, to, repoKey, repos, queryEnabled, getToken });
  const watchersTable = useDayMetric("watchers", { base, from, to, repoKey, repos, queryEnabled, getToken });
  const issuesTable = useDayMetric("openIssues", { base, from, to, repoKey, repos, queryEnabled, getToken });

  if (!preview) {
    return <Typography>Engineering isn't available yet.</Typography>;
  }
  if (!configured) {
    return (
      <Typography>
        Product Download Stats isn't connected yet. Set{" "}
        <code>ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL</code> in config.js.
      </Typography>
    );
  }
  if (!allowed) {
    return (
      <Typography>
        Product Download Stats needs an https address. An http address is only accepted for
        localhost.
      </Typography>
    );
  }

  const replace = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    if (!params.get("from")) next.set("from", from);
    if (!params.get("to")) next.set("to", to);
    for (const [key, value] of Object.entries(updates)) {
      if ((key === "from" || key === "to") && (value == null || value === "")) continue;
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const active = (repositories.data?.repositories ?? []).filter(
    (repository) => repository.isActive !== false,
  );
  const names = new Map(
    active.map((repository) => [repository.id, productLabel(repository.productName, repository.repoName)]),
  );
  const listed = active.filter((repository) => {
    if (repos.length > 0 && !repos.includes(repository.id)) return false;
    const label = productLabel(repository.productName, repository.repoName);
    return productSearch === "" || label.toLowerCase().includes(productSearch.toLowerCase());
  });

  const chartPending = chartMeasure == null ? clones.isPending : metric.isPending;
  const chartFailed = chartMeasure == null ? clones.isError || clones.data == null : metric.isError || metric.data == null;
  const tableQueries = [starsTable, forksTable, watchersTable, issuesTable];
  const tablePending = tableQueries.some((query) => query.isPending) || clones.isPending;
  const tableFailed =
    clones.isError ||
    clones.data == null ||
    tableQueries.some((query) => query.isError || query.data == null);
  const statsError = [metric, clones, ...tableQueries].find((query) => query.error != null)?.error;

  const retry = () => {
    void repositories.refetch();
    void clones.refetch();
    void starsTable.refetch();
    void forksTable.refetch();
    void watchersTable.refetch();
    void issuesTable.refetch();
    void metric.refetch();
  };

  const chartSeries =
    chartMeasure == null
      ? cloneChartSeries(clones.data?.series ?? [], stat === "uniqueCloners" ? "uniques" : "count", interval)
      : (metric.data?.series ?? []);
  const label = STAT_OPTIONS.find((option) => option.value === stat)?.label ?? "Stars";
  const totals = cloneTotals(clones.data?.series ?? [], tableMode, tableDate);

  return (
    <Box>
      <Typography component="h1" variant="h5">
        Repository Stats
      </Typography>
      <Typography sx={{ mt: 1 }}>
        Unique cloners are summed per day and the same person on different days counts separately.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ my: 2, flexWrap: "wrap" }}>
        <TextField
          label="From"
          type="date"
          size="small"
          value={from}
          onChange={(event) => replace({ from: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={to}
          onChange={(event) => replace({ to: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Select
          size="small"
          inputProps={{ "aria-label": "Measure" }}
          value={stat}
          onChange={(event) => replace({ stat: event.target.value })}
        >
          {STAT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          inputProps={{ "aria-label": "Grain" }}
          value={interval}
          onChange={(event) => replace({ interval: event.target.value })}
        >
          <MenuItem value="day">Daily</MenuItem>
          <MenuItem value="month">Monthly</MenuItem>
          <MenuItem value="cumulative">Cumulative</MenuItem>
        </Select>
        <Select
          size="small"
          multiple
          displayEmpty
          inputProps={{ "aria-label": "Products" }}
          value={repos.map(String)}
          onChange={(event) => {
            const value = event.target.value;
            const selected = (typeof value === "string" ? value.split(",") : value).filter(Boolean);
            replace({ repos: selected.length > 0 ? selected.join(",") : null });
          }}
          renderValue={(selected) =>
            selected.length === 0 ? "All products" : `${selected.length} selected`
          }
        >
          {active.map((repository) => (
            <MenuItem key={repository.id} value={String(repository.id)}>
              {productLabel(repository.productName, repository.repoName)}
            </MenuItem>
          ))}
        </Select>
        {interval !== "month" && (
          <ToggleButtonGroup
            exclusive
            size="small"
            aria-label="Chart type"
            value={chart}
            onChange={(_event, value: "line" | "bar" | null) => {
              if (value) setChart(value);
            }}
          >
            <ToggleButton value="line">Line</ToggleButton>
            <ToggleButton value="bar">Bars</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      {rangeInverted ? (
        <Typography>From is after To.</Typography>
      ) : repositories.isPending ? (
        <Loading label="Loading products…" />
      ) : repositories.isError || repositories.data == null ? (
        <ErrorNotice onRetry={retry} error={repositories.error}>
          Couldn't load products.
        </ErrorNotice>
      ) : chartPending || tablePending ? (
        <Loading label="Loading repository stats…" />
      ) : chartFailed || tableFailed ? (
        <ErrorNotice onRetry={retry} error={statsError}>
          Couldn't load repository stats.
        </ErrorNotice>
      ) : (
        <>
          {chartSeries.every((item) => item.points.length === 0) ? (
            <Typography>No data for the selected range</Typography>
          ) : (
            <StatsChart
              series={chartSeries}
              names={names}
              interval={interval}
              chart={chart}
              title={`${label} over time`}
            />
          )}
          {active.length === 0 ? null : (
          <Card sx={{ p: 2, mt: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2, justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Typography component="h2" variant="h6">
                Current stats
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {tableMode !== "total" && (
                  <TextField
                    label={tableMode === "month" ? "Month" : "Day"}
                    type={tableMode === "month" ? "month" : "date"}
                    size="small"
                    value={tableDate}
                    onChange={(event) => setTableDate(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                )}
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  aria-label="Table range"
                  value={tableMode}
                  onChange={(_event, value: TableMode | null) => {
                    if (!value) return;
                    setTableMode(value);
                    setTableDate(defaultTableDate(value, to));
                  }}
                >
                  <ToggleButton value="total">Total</ToggleButton>
                  <ToggleButton value="month">Monthly</ToggleButton>
                  <ToggleButton value="day">Daily</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>
            <TextField
              label="Search products"
              size="small"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              sx={{ mb: 2 }}
            />
            {listed.length === 0 ? (
              <Typography>No products match your search</Typography>
            ) : (
              <ListingTable.Provider>
                <ListingTable.Container>
                  <ListingTable bordered>
                    <ListingTable.Head>
                      <ListingTable.Row>
                        <ListingTable.Cell>Product</ListingTable.Cell>
                        <ListingTable.Cell align="right">Stars</ListingTable.Cell>
                        <ListingTable.Cell align="right">Forks</ListingTable.Cell>
                        <ListingTable.Cell align="right">Watchers</ListingTable.Cell>
                        <ListingTable.Cell align="right">Open Issues</ListingTable.Cell>
                        <ListingTable.Cell align="right">Clones</ListingTable.Cell>
                        <ListingTable.Cell align="right">Unique Cloners</ListingTable.Cell>
                      </ListingTable.Row>
                    </ListingTable.Head>
                    <ListingTable.Body>
                      {listed.map((repository) => {
                        const snapshot = repository.latestSnapshot;
                        const clonesForRepo = totals.get(repository.id);
                        const stars =
                          changeAt(starsTable.data?.series, repository.id, tableMode, tableDate) ??
                          snapshotCount(snapshot, "stargazersCount");
                        const forks =
                          changeAt(forksTable.data?.series, repository.id, tableMode, tableDate) ??
                          snapshotCount(snapshot, "forksCount");
                        const watchers =
                          changeAt(watchersTable.data?.series, repository.id, tableMode, tableDate) ??
                          snapshotCount(snapshot, "watchersCount");
                        const issues =
                          changeAt(issuesTable.data?.series, repository.id, tableMode, tableDate) ??
                          snapshotCount(snapshot, "openIssuesCount");
                        return (
                          <ListingTable.Row key={repository.id}>
                            <ListingTable.Cell>
                              {productLabel(repository.productName, repository.repoName)}
                            </ListingTable.Cell>
                            <ListingTable.Cell align="right">{formatCount(stars)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">{formatCount(forks)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">{formatCount(watchers)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">{formatCount(issues)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">
                              {formatCount(clonesForRepo?.count ?? 0)}
                            </ListingTable.Cell>
                            <ListingTable.Cell align="right">
                              {formatCount(clonesForRepo?.uniques ?? 0)}
                            </ListingTable.Cell>
                          </ListingTable.Row>
                        );
                      })}
                    </ListingTable.Body>
                  </ListingTable>
                </ListingTable.Container>
              </ListingTable.Provider>
            )}
          </Card>
          )}
        </>
      )}
    </Box>
  );
}

function useDayMetric(
  metric: RepositoryMeasure,
  args: {
    base: string;
    from: string;
    to: string;
    repoKey: string;
    repos: number[];
    queryEnabled: boolean;
    getToken: () => Promise<string>;
  },
): UseQueryResult<{ series: DailySeries[] }, Error> {
  return useQuery({
    queryKey: ["product-download-stats", "metric", "day", args.base, metric, args.from, args.to, args.repoKey],
    enabled: args.queryEnabled,
    queryFn: async () =>
      getMetricSeries(await args.getToken(), {
        metric,
        from: args.from,
        to: args.to,
        interval: "day",
        repos: args.repos,
      }),
  });
}

function Loading({ label }: { label: string }): JSX.Element {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <CircularProgress size={16} />
      <Typography>{label}</Typography>
    </Stack>
  );
}

function StatsChart({
  series,
  names,
  interval,
  chart,
  title,
}: {
  series: DailySeries[];
  names: Map<number, string>;
  interval: ReleaseDownloadGrain;
  chart: "line" | "bar";
  title: string;
}): JSX.Element {
  // Plot only the dates the API returned. Filling the calendar would add days
  // the series never had and break the line between real points.
  const { data, lines } = dailyChartModel(series, names, { from: "", to: "" });
  const bars = interval === "month" || chart === "bar";
  return (
    <Box>
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      <Box sx={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          {bars ? (
            <BarChart data={data}>
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value: number) => formatCount(value)} />
              <Tooltip />
              <Legend />
              {lines.map((line) => (
                <Bar key={line.repoId} name={line.name} dataKey={line.dataKey} fill={line.stroke} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data}>
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value: number) => formatCount(value)} />
              <Tooltip />
              <Legend />
              {lines.map((line) => (
                <Line
                  key={line.repoId}
                  name={line.name}
                  type="monotone"
                  dataKey={line.dataKey}
                  stroke={line.stroke}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
