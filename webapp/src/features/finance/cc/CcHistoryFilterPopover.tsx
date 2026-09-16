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

import { cloneElement, useState } from "react";
import {
  Badge,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { FilterIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import {
  ALL,
  CC_HISTORY_PERIODS,
  CC_HISTORY_STATUSES,
  ccHistoryActiveFilters,
  ccHistoryChipLabel,
  ccHistoryClear,
  ccHistoryFieldsShown,
  ccHistoryResetAll,
  type CcHistoryFilterName,
  type CcHistoryFilterState,
} from "./ccHistoryFilters";
import type { CcTxnStatus } from "./ccTypes";

/**
 * The source's **Advanced Filter** — `HistoryFilterPopover.tsx`.
 *
 * Five filters behind one trigger rather than spread across the page, because
 * two of them come and go with what is selected and a row of appearing and
 * disappearing selects is worse than a panel you open.
 *
 * Two things are the source's and look like omissions:
 *
 *  - **There is no Apply.** Every field commits the moment it changes and the
 *    popover stays open, so a reader can narrow twice without reopening it.
 *    Reset is the only button, and it is dead until something is narrowed.
 *  - **The chips appear twice**, here under a divider and again on the page
 *    above the grid, so what is narrowing the list is readable without opening
 *    anything. `CcHistoryFilterChips` below is the same strip, exported for the
 *    page to render.
 */
export function CcHistoryFilters({
  state,
  viewer,
  users,
  leads,
  cards,
  onChange,
}: {
  state: CcHistoryFilterState;
  viewer: { canSeeOthers: boolean; isFinance: boolean };
  users: string[];
  leads: string[];
  /** Already narrowed to the selected user and marked when closed. */
  cards: { value: string; label: string }[];
  onChange: (patch: Partial<CcHistoryFilterState>) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const shown = ccHistoryFieldsShown(state, viewer);
  const active = ccHistoryActiveFilters(state, viewer);

  return (
    <>
      {/* :115-124 — the words before the icon, and a badge rather than a
          tooltip. Approve Submissions has the tooltip and puts its label after
          the icon; this screen does neither, which is the source's own
          inconsistency and not worth smoothing over. */}
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Advanced Filter</Typography>
        <IconButton size="small" aria-label="Advanced Filter" onClick={(e) => setAnchor(e.currentTarget)}>
          <Badge badgeContent={active.length} color="primary" sx={{ "& .MuiBadge-badge": { fontSize: 10, height: 16, minWidth: 16 } }}>
            <FilterIcon size={18} />
          </Badge>
        </IconButton>
      </Stack>

      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={2} sx={{ p: 2.5, width: 350 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Advanced Filter</Typography>
            <IconButton size="small" aria-label="Close filters" onClick={() => setAnchor(null)}>
              <XIcon size={16} />
            </IconButton>
          </Stack>

          {/* :162-170 — always, and capital S, unlike Approve's lowercase. */}
          <Field label="Filter by Status">
            <Select
              value={state.status}
              onChange={(e) => onChange({ status: e.target.value as CcTxnStatus | typeof ALL })}
            >
              {CC_HISTORY_STATUSES.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </Field>

          {/* :172-186 — finance only, and only once a row could have a lead
              worth filtering by. */}
          {shown.lead && (
            <Field label="Filter by Lead">
              <Select value={state.lead} onChange={(e) => onChange({ lead: String(e.target.value) })}>
                <MenuItem value={ALL}>No Filter</MenuItem>
                {leads.map((l) => (
                  <MenuItem key={l} value={l}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
            </Field>
          )}

          {shown.user && (
            <Field label="Filter by User">
              {/* :136-140 — changing the user resets the card, because the card
                  options are that person's and the old one may not be theirs. */}
              <Select
                value={state.user}
                onChange={(e) => onChange({ user: String(e.target.value), card: ALL })}
              >
                <MenuItem value={ALL}>No Filter</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Filter by Card">
            <Select value={state.card} onChange={(e) => onChange({ card: String(e.target.value) })}>
              <MenuItem value={ALL}>No Filter</MenuItem>
              {cards.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
          </Field>

          {/* :223-231 — only while the status is the default. Lower-case p in
              the label, which is the source's, not a slip of ours. */}
          {shown.period && (
            <Field label="Filter by period">
              <Select value={state.days} onChange={(e) => onChange({ days: Number(e.target.value) })}>
                {CC_HISTORY_PERIODS.map((p) => (
                  <MenuItem key={p.days} value={p.days}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </Field>
          )}

          {active.length > 0 && (
            <>
              <Divider />
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Active Filters</Typography>
              <CcHistoryFilterChips state={state} viewer={viewer} onChange={onChange} />
            </>
          )}

          <Stack direction="row" justifyContent="flex-end">
            {/* :276-284 — the only button, and dead until there is something to
                undo. There is no Apply: the fields have already applied. */}
            <Button
              size="small"
              variant="outlined"
              disabled={active.length === 0}
              onClick={() => onChange(ccHistoryResetAll())}
            >
              Reset
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}

/**
 * One chip per narrowed filter, each clearing only itself.
 *
 * Rendered both inside the popover and on the page (`index.tsx:516-549`), which
 * is why it is its own export rather than living inside the panel.
 */
export function CcHistoryFilterChips({
  state,
  viewer,
  onChange,
}: {
  state: CcHistoryFilterState;
  viewer: { canSeeOthers: boolean; isFinance: boolean };
  onChange: (patch: Partial<CcHistoryFilterState>) => void;
}) {
  const active = ccHistoryActiveFilters(state, viewer);
  if (active.length === 0) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
      {active.map((name: CcHistoryFilterName) => (
        <Chip
          key={name}
          size="small"
          label={ccHistoryChipLabel(name, state)}
          onDelete={() => onChange(ccHistoryClear(name))}
        />
      ))}
    </Stack>
  );
}

/**
 * A labelled select. The label is what the tests and a screen reader find the
 * control by, so it carries an id of its own — the source's labels are several
 * words, and a generated id has to survive the spaces.
 */
function Field({ label, children }: { label: string; children: React.ReactElement }) {
  // Several words, so the spaces have to go or the id is invalid.
  const id = `cc-history-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <FormControl size="small" fullWidth>
      <InputLabel id={id}>{label}</InputLabel>
      {/* `label` as well as `labelId`: the first names the control, the second
          tells the outline to leave a gap for the floating caption. */}
      {cloneElement(children as React.ReactElement<{ labelId?: string; label?: string }>, {
        labelId: id,
        label,
      })}
    </FormControl>
  );
}
