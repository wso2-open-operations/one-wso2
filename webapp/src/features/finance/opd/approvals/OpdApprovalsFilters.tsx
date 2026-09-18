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

import { useRef, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  TextField,
} from "@wso2/oxygen-ui";
import { FilterIcon } from "@wso2/oxygen-ui-icons-react";
import {
  activeFilterCount,
  emptyApprovalFilters,
  periodLabel,
  tabHasYearRange,
  type OpdApprovalFilters,
  type OpdApprovalPeriod,
  type OpdApprovalTab,
} from "./opdApprovals";

const PERIODS: OpdApprovalPeriod[] = ["this", "last", "custom"];

/**
 * Year Range and Filters — `FilterHolder.tsx`.
 *
 * Year Range sits on the page and applies as it changes; email and claim id
 * live behind Filters and hold their edits until Apply, as the source's dialog
 * does. Built from the same controls as the other finance screens, so the
 * perspective reads as one app.
 */
export function OpdApprovalsFilters({
  tab,
  filters,
  onChange,
}: {
  tab: OpdApprovalTab;
  filters: OpdApprovalFilters;
  onChange: (next: OpdApprovalFilters) => void;
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draftEmail, setDraftEmail] = useState(filters.email);
  const [draftClaimId, setDraftClaimId] = useState(filters.claimId);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const extra = activeFilterCount(tab, filters);

  const open = (el: HTMLElement) => {
    setDraftEmail(filters.email);
    setDraftClaimId(filters.claimId);
    setAnchor(el);
  };

  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center", rowGap: 1.5 }}>
      {/* :74-76 — Pending is "what is waiting now", so it carries no year. */}
      {tabHasYearRange(tab) && (
        <FormControl size="small">
          <InputLabel id="opd-approvals-range">Year Range</InputLabel>
          <Select
            labelId="opd-approvals-range"
            label="Year Range"
            value={filters.period}
            sx={{ minWidth: 150 }}
            onChange={(e) => onChange({ ...filters, period: e.target.value as OpdApprovalPeriod })}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p} value={p}>
                {periodLabel(p)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <FormControl size="small" ref={fieldRef}>
        <Select
          value=""
          displayEmpty
          open={false}
          sx={{ minWidth: 130 }}
          onOpen={() => {
            if (fieldRef.current) open(fieldRef.current);
          }}
          // No floating label: the funnel and the word sit inside the field,
          // the way the source draws this control.
          renderValue={() => (
            <Stack direction="row" alignItems="center" spacing={1}>
              <FilterIcon size={15} />
              <span>Filters{extra > 0 ? ` (${extra})` : ""}</span>
            </Stack>
          )}
          inputProps={{ "aria-label": "Filters" }}
        />
      </FormControl>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 2, width: 300 } } }}
      >
        <Stack spacing={2}>
          {tabHasYearRange(tab) && filters.period === "custom" && (
            <Stack direction="row" spacing={1}>
              <TextField
                select
                size="small"
                label="From"
                fullWidth
                value={filters.startYear}
                onChange={(e) => onChange({ ...filters, startYear: Number(e.target.value) })}
              >
                {years.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="To"
                fullWidth
                value={filters.endYear}
                onChange={(e) => onChange({ ...filters, endYear: Number(e.target.value) })}
              >
                {years.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          <TextField
            size="small"
            label="Filter by email"
            placeholder="someone@wso2.com"
            fullWidth
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
          />
          <TextField
            size="small"
            label="Filter by claim ID"
            placeholder="OPD-…"
            fullWidth
            value={draftClaimId}
            onChange={(e) => setDraftClaimId(e.target.value)}
          />

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button
              size="small"
              onClick={() => {
                // Cancel, not Clear: the source's dialog abandons the edit and
                // leaves the queue exactly as it was.
                setAnchor(null);
              }}
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                onChange({ ...filters, email: draftEmail, claimId: draftClaimId });
                setAnchor(null);
              }}
              sx={{ textTransform: "none" }}
            >
              Apply
            </Button>
          </Stack>

          {extra > 0 && (
            <Box>
              <Button
                size="small"
                onClick={() => {
                  onChange(emptyApprovalFilters());
                  setAnchor(null);
                }}
                sx={{ textTransform: "none" }}
              >
                Clear filters
              </Button>
            </Box>
          )}
        </Stack>
      </Popover>
    </Stack>
  );
}
