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

import { useMemo, useState } from "react";
import {
  AdapterDateFns,
  Autocomplete,
  Box,
  Button,
  Card,
  Collapse,
  DatePickers,
  FormControl,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { BarChart } from "@wso2/oxygen-ui-charts-react";
import { FilterIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { localIsoDate } from "@utils/localDate";
import { useUmtMeta } from "../api/useUmtMeta";
import { useUmtPlatformStats } from "../api/useUmtPlatformStats";
import type {
  UmtPlatformStatsFilter,
  UmtPlatformStatsRequest,
} from "../api/umtStatisticsTypes";
import UmtShell from "../components/UmtShell";

const { DatePicker, LocalizationProvider } = DatePickers;

const PLATFORM_OPTIONS = [
  { label: "APIM Platform", value: "APIM" },
  { label: "IAM Platform", value: "IAM" },
  { label: "Integration Platform", value: "Integration" },
  { label: "Financial Service Platform", value: "Financial_Services" },
  { label: "Healthcare Platform", value: "Healthcare" },
];

const FILTER_OPTIONS: Array<{
  label: string;
  value: Exclude<UmtPlatformStatsFilter, "all">;
}> = [
  { label: "Product", value: "product" },
  { label: "Version", value: "version" },
  { label: "Update origin", value: "update_origin" },
  { label: "Update lifecycle", value: "update_lifecycle" },
  { label: "Extended support", value: "extended_support" },
];

const SKELETON_BAR_HEIGHTS = [45, 70, 55, 85, 60, 40, 75, 50];
const SKELETON_GRID_OFFSETS = [0, 25, 50, 75];

// Mirrors BarChart's own geometry — its 24px side margins, the 60px recharts
// y-axis gutter and the bottom legend — so the chart lands where the skeleton was.
const SKELETON_AXIS_GUTTER = 84;

function StatisticsChartSkeleton() {
  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%", pr: 3, pt: 1.5, width: "100%" }}
    >
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Stack
          sx={{
            alignItems: "flex-end",
            justifyContent: "space-between",
            pr: 1,
            width: SKELETON_AXIS_GUTTER,
          }}
        >
          {[0, 1, 2, 3, 4].map((tick) => (
            <Skeleton key={tick} variant="text" width={28} sx={{ fontSize: 12 }} />
          ))}
        </Stack>

        <Box
          sx={{
            alignItems: "flex-end",
            borderBottom: 1,
            borderColor: "text.primary",
            borderLeft: 1,
            display: "flex",
            flex: 1,
            gap: 2,
            position: "relative",
            px: 2,
          }}
        >
          {SKELETON_GRID_OFFSETS.map((offset) => (
            <Box
              key={offset}
              sx={{
                borderColor: "divider",
                borderTop: "1px dashed",
                left: 0,
                position: "absolute",
                right: 0,
                top: `${offset}%`,
              }}
            />
          ))}

          {SKELETON_BAR_HEIGHTS.map((height, index) => (
            <Skeleton
              key={index}
              variant="rectangular"
              sx={{ flex: 1, height: `${height}%`, position: "relative" }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, ml: `${SKELETON_AXIS_GUTTER}px`, mt: 1, px: 2 }}>
        {SKELETON_BAR_HEIGHTS.map((_, index) => (
          <Box key={index} sx={{ display: "flex", flex: 1, justifyContent: "center" }}>
            <Skeleton variant="text" width={44} sx={{ fontSize: 12 }} />
          </Box>
        ))}
      </Box>

      <Stack direction="row" spacing={3} sx={{ justifyContent: "center", pb: 1, pt: 4 }}>
        {[0, 1, 2].map((item) => (
          <Stack key={item} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <Skeleton variant="circular" width={10} height={10} />
            <Skeleton variant="text" width={64} sx={{ fontSize: 13 }} />
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

// setMonth alone overflows when the target month is shorter — on 31 August it
// lands on "31 February", i.e. 3 March, silently dropping late February from
// the default range. Move to the 1st first, then clamp to the month's length.
function sixMonthsAgo(): Date {
  const date = new Date();
  const dayOfMonth = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() - 6);
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  return date;
}

function statsRequest(
  platform: string,
  breakdown: (typeof FILTER_OPTIONS)[number] | null,
  product: { value: string } | null,
  fromDate: Date | null,
  toDate: Date | null,
): UmtPlatformStatsRequest {
  return {
    platform,
    filter: breakdown?.value ?? "all",
    ...(product && breakdown?.value !== "product" ? { product: product.value } : {}),
    ...(fromDate ? { from: localIsoDate(fromDate) } : {}),
    ...(toDate ? { to: localIsoDate(toDate) } : {}),
  };
}

export default function UmtStatisticsPage() {
  return (
    <UmtShell title="Statistics">
      <UmtStatisticsBody />
    </UmtShell>
  );
}

function UmtStatisticsBody() {
  const meta = useUmtMeta();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [platform, setPlatform] = useState(PLATFORM_OPTIONS[0]);
  const [breakdown, setBreakdown] = useState<(typeof FILTER_OPTIONS)[number] | null>(null);
  const [product, setProduct] = useState<{ label: string; value: string } | null>(null);
  const [fromDate, setFromDate] = useState<Date | null>(sixMonthsAgo);
  const [toDate, setToDate] = useState<Date | null>(() => new Date());
  const [request, setRequest] = useState<UmtPlatformStatsRequest>(() =>
    statsRequest(PLATFORM_OPTIONS[0].value, null, null, sixMonthsAgo(), new Date()),
  );
  const statistics = useUmtPlatformStats(request);

  const productOptions = useMemo(() => {
    const productNames = new Set<string>();

    for (const [metadataName, products] of Object.entries(meta.data?.products ?? {})) {
      for (const metadataProduct of products) {
        // /meta returns every product, platform or not. Only a product whose
        // platform was backfilled can be charted: the stats endpoints are
        // platform-scoped, so a null platform matches no valid selection.
        if (metadataProduct.platform === platform.value) {
          productNames.add(metadataProduct.name || metadataName);
        }
      }
    }

    return [...productNames].map((name) => ({ label: name, value: name }));
  }, [meta.data?.products, platform.value]);

  const selectedProduct =
    product && productOptions.some((option) => option.value === product.value) ? product : null;
  const productDisabled =
    breakdown?.value === "product" || meta.isPending || productOptions.length === 0;

  const chartBars = useMemo(() => {
    const series = new Set<string>();
    for (const row of statistics.data ?? []) {
      for (const key of Object.keys(row)) {
        if (key !== "month") series.add(key);
      }
    }

    return [...series].sort().map((dataKey) => ({
      dataKey,
      name: dataKey === "value" ? "Total" : dataKey,
      stackId: "updates",
    }));
  }, [statistics.data]);

  const resetFilters = () => {
    const defaultFrom = sixMonthsAgo();
    const defaultTo = new Date();
    setBreakdown(null);
    setProduct(null);
    setFromDate(defaultFrom);
    setToDate(defaultTo);
    setRequest(statsRequest(platform.value, null, null, defaultFrom, defaultTo));
  };

  // A picker can hand back a non-null Date that fails to parse what the user
  // typed (MUI's own docs note this), so "not null" isn't enough to trust it.
  const fromDateError = fromDate && Number.isNaN(fromDate.getTime()) ? "Invalid date." : null;
  const toDateError = toDate && Number.isNaN(toDate.getTime()) ? "Invalid date." : null;
  const rangeError =
    !fromDateError && !toDateError && fromDate && toDate && fromDate.getTime() > toDate.getTime()
      ? "From date must be before To date."
      : null;
  const dateRangeValid = !fromDateError && !toDateError && !rangeError;

  const applyFilters = () => {
    if (!dateRangeValid) return;
    setRequest(statsRequest(platform.value, breakdown, selectedProduct, fromDate, toDate));
  };

  return (
      <Card
        variant="outlined"
        sx={{ backgroundColor: "transparent", display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "center", flexShrink: 0, justifyContent: "flex-end", p: 3 }}
        >
          <FormControl sx={{ width: 240 }} size="small">
            <Autocomplete
              options={PLATFORM_OPTIONS}
              value={platform}
              disableClearable
              size="small"
              getOptionLabel={(option) => option.label}
              onChange={(_event, option) => {
                setPlatform(option);
                setProduct(null);
                setRequest(statsRequest(option.value, breakdown, null, fromDate, toDate));
              }}
              renderInput={(params) => <TextField {...params} label="Platform" />}
            />
          </FormControl>

          <Button
            variant="contained"
            startIcon={<FilterIcon size={16} />}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filter
          </Button>
        </Stack>

        <Collapse in={filtersOpen} sx={{ flexShrink: 0 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: "center",
              borderColor: "divider",
              borderTop: 1,
              flexWrap: "wrap",
              justifyContent: "flex-end",
              px: 3,
              py: 2,
            }}
          >
            <FormControl sx={{ width: 240 }} size="small">
              <Autocomplete
                options={FILTER_OPTIONS}
                value={breakdown}
                size="small"
                getOptionLabel={(option) => option.label}
                onChange={(_event, option) => {
                  setBreakdown(option);
                  if (option?.value === "product") setProduct(null);
                }}
                renderInput={(params) => <TextField {...params} label="Breakdown by" />}
              />
            </FormControl>

            <FormControl sx={{ width: 240 }} size="small">
              <Autocomplete
                options={productOptions}
                value={selectedProduct}
                disabled={productDisabled}
                loading={meta.isPending}
                size="small"
                getOptionLabel={(option) => option.label}
                onChange={(_event, option) => setProduct(option)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Product"
                    error={meta.isError}
                    helperText={meta.isError ? "Couldn't load products." : undefined}
                  />
                )}
              />
            </FormControl>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="From"
                value={fromDate}
                onChange={setFromDate}
                slotProps={{
                  textField: {
                    size: "small",
                    error: !!(fromDateError ?? rangeError),
                    helperText: fromDateError ?? rangeError ?? undefined,
                  },
                }}
                sx={{ width: 200 }}
              />
              <DatePicker
                label="To"
                value={toDate}
                onChange={setToDate}
                slotProps={{
                  textField: {
                    size: "small",
                    error: !!(toDateError ?? rangeError),
                    helperText: toDateError ?? rangeError ?? undefined,
                  },
                }}
                sx={{ width: 200 }}
              />
            </LocalizationProvider>

            <Button variant="outlined" onClick={resetFilters}>
              Reset
            </Button>
            <Button variant="contained" onClick={applyFilters} disabled={!dateRangeValid}>
              Apply
            </Button>
          </Stack>
        </Collapse>

        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            flex: 1,
            justifyContent: "center",
            minHeight: 0,
            p: 3,
            width: "100%",
          }}
        >
          {statistics.isPending ? (
            <StatisticsChartSkeleton />
          ) : statistics.isError ? (
            <ErrorNotice
              error={statistics.error}
              onRetry={() => void statistics.refetch()}
              retrying={statistics.isFetching}
            >
              Couldn&apos;t load statistics.
            </ErrorNotice>
          ) : statistics.data?.length && chartBars.length ? (
            <BarChart
              data={statistics.data}
              xAxisDataKey="month"
              height="100%"
              bars={chartBars}
              grid={{ show: true }}
              legend={{ show: true }}
              tooltip={{ wrapperStyle: { zIndex: 1 } }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No statistics found for these filters.
            </Typography>
          )}
        </Box>
      </Card>
  );
}
