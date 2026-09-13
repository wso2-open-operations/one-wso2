/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { CalendarIcon, FileSearchIcon, FilterIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { todayIso } from "../../util/financeFormat";
import {
  CLAIM_RANGE_CUSTOM,
  CLAIM_RANGE_LATEST,
  type ApprovalFilters,
} from "./expenseApprovalTypes";

/**
 * FilterHolder.tsx in its lead/finance shape: a claim-range control and a
 * popover holding the employee and claim-ID filters. Both hold their edits
 * behind an Apply — this search spans every claim the approver can see, so a
 * request per keystroke is the wrong shape, and Apply is what the source does.
 *
 * Two of the user view's filters are deliberately absent. The Status select is
 * not here because the tab already decides the status, and the submission-scope
 * select is about the reader's own claims, which this screen never shows.
 */
export function ExpenseApprovalFilters({
  filters,
  onChange,
  showRange,
  employeeEmails,
}: {
  filters: ApprovalFilters;
  onChange: (next: ApprovalFilters) => void;
  /**
   * `isClaimRangeVisible` — false on the Pending tab, where the source hides
   * the range control and stops sending `limit` (`Approvals.tsx:44`).
   */
  showRange: boolean;
  /** Options for the employee filter, from `/employees`. */
  employeeEmails: string[];
}) {
  const rangeFieldRef = useRef<HTMLDivElement | null>(null);
  const moreFieldRef = useRef<HTMLDivElement | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  // Both popovers edit a copy and commit on Apply, so a cancelled edit leaves
  // the live filters — and the query they drive — untouched.
  const [draftStart, setDraftStart] = useState(filters.startDate);
  const [draftEnd, setDraftEnd] = useState(filters.endDate);
  const [draftEmail, setDraftEmail] = useState(filters.email);
  const [draftClaimId, setDraftClaimId] = useState(filters.claimId);

  const openRange = (anchor: HTMLElement) => {
    setDraftStart(filters.startDate);
    setDraftEnd(filters.endDate);
    setRangeAnchor(anchor);
  };

  const openMore = (anchor: HTMLElement) => {
    setDraftEmail(filters.email);
    setDraftClaimId(filters.claimId);
    setMoreAnchor(anchor);
  };

  const rangeReady = Boolean(draftStart) && Boolean(draftEnd) && draftStart <= draftEnd;
  const hasCustomRange = Boolean(filters.startDate) && Boolean(filters.endDate);
  const extraCount = (filters.email ? 1 : 0) + (filters.claimId ? 1 : 0);

  return (
    <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}>
      {showRange && (
        <FormControl size="small" ref={rangeFieldRef}>
          <InputLabel id="expense-approval-range">Claim Range</InputLabel>
          <Select
            labelId="expense-approval-range"
            label="Claim Range"
            value={filters.range}
            sx={{ minWidth: 150 }}
            onChange={(e) => {
              if (String(e.target.value) === CLAIM_RANGE_CUSTOM) {
                // Picking "Custom Date" only opens the picker — the range is
                // not applied until there are two dates to apply.
                if (rangeFieldRef.current) openRange(rangeFieldRef.current);
                return;
              }
              onChange({ ...filters, range: CLAIM_RANGE_LATEST, startDate: "", endDate: "" });
            }}
          >
            <MenuItem value={CLAIM_RANGE_LATEST}>{CLAIM_RANGE_LATEST}</MenuItem>
            <MenuItem value={CLAIM_RANGE_CUSTOM}>{CLAIM_RANGE_CUSTOM}</MenuItem>
          </Select>
        </FormControl>
      )}

      {showRange && hasCustomRange && (
        <ButtonBase
          onClick={(e) => openRange(e.currentTarget)}
          aria-label={`Claim range ${filters.startDate} to ${filters.endDate}`}
          sx={{
            height: 40,
            px: 1.5,
            gap: 1,
            border: 1,
            borderColor: "divider",
            borderRadius: "8px",
            backgroundColor: "var(--oxygen-palette-background-paper)",
            color: "text.secondary",
            "&:hover": { borderColor: "text.primary" },
          }}
        >
          <Typography sx={{ fontSize: 13 }}>
            {filters.startDate} ~ {filters.endDate}
          </Typography>
          <CalendarIcon size={15} />
        </ButtonBase>
      )}

      {/* The same outlined field as the range select beside it rather than a
          Button dressed to match: a real Select brings the white ground, the
          height and the chevron for free. Its own menu never opens —
          `open={false}` with an `onOpen` that raises the popover below. */}
      <FormControl size="small" ref={moreFieldRef}>
        <Select
          value=""
          displayEmpty
          open={false}
          onOpen={() => {
            if (moreFieldRef.current) openMore(moreFieldRef.current);
          }}
          renderValue={() => (
            <Stack direction="row" alignItems="center" spacing={1}>
              <FilterIcon size={15} />
              <span>Filters{extraCount > 0 ? ` (${extraCount})` : ""}</span>
            </Stack>
          )}
          inputProps={{ "aria-label": "Filters" }}
          sx={{ minWidth: 150 }}
        />
      </FormControl>

      <Popover
        open={Boolean(rangeAnchor)}
        anchorEl={rangeAnchor}
        onClose={() => setRangeAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 1.5 }}>Custom date range</Typography>
          {/* Native date inputs, as the port uses everywhere rather than MUI X's
              pickers (`LeaveDateField`). The claim-history port's month grid is
              the richer control; when that branch lands the two should share it. */}
          <Stack spacing={1.5}>
            <TextField
              size="small"
              type="date"
              label="From"
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIso() } }}
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: draftStart || undefined, max: todayIso() },
              }}
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
            />
          </Stack>
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            <Button size="small" onClick={() => setRangeAnchor(null)}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={!rangeReady}
              onClick={() => {
                onChange({
                  ...filters,
                  range: CLAIM_RANGE_CUSTOM,
                  startDate: draftStart,
                  endDate: draftEnd,
                });
                setRangeAnchor(null);
              }}
            >
              Apply
            </Button>
          </Stack>
        </Box>
      </Popover>

      <Popover
        open={Boolean(moreAnchor)}
        anchorEl={moreAnchor}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, width: 300 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.75 }}>Filters</Typography>
          <Stack spacing={1.75}>
            {/* FilterHolder.tsx:225-253 — the approver's filter is the employee
                the claim belongs to, offered as the list of everyone rather
                than typed from memory. */}
            <Autocomplete
              options={employeeEmails}
              size="small"
              value={draftEmail || null}
              onChange={(_e, value) => setDraftEmail(value ?? "")}
              renderInput={(params) => <TextField {...params} label="Filter by email" fullWidth />}
            />
            <TextField
              size="small"
              label="Filter by claim ID"
              value={draftClaimId}
              onChange={(e) => setDraftClaimId(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {draftClaimId.length > 0 ? (
                        <IconButton
                          size="small"
                          aria-label="Clear claim ID"
                          onClick={() => setDraftClaimId("")}
                        >
                          <XIcon size={15} />
                        </IconButton>
                      ) : (
                        <FileSearchIcon size={15} opacity={0.6} />
                      )}
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2.5 }}>
            <Button size="small" onClick={() => setMoreAnchor(null)}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                onChange({ ...filters, email: draftEmail.trim(), claimId: draftClaimId.trim() });
                setMoreAnchor(null);
              }}
            >
              Apply
            </Button>
          </Stack>
        </Box>
      </Popover>
    </Stack>
  );
}
