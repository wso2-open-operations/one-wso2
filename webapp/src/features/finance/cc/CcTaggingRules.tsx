/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import ErrorNotice from "@components/error-notice/ErrorNotice";
import {
  alpha,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Popover,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  type Theme,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  CircleHelpIcon,
  FilterIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
  XIcon,
} from "@wso2/oxygen-ui-icons-react";
import { Fragment, useRef, useState } from "react";
import { ClaimGroupHeading, useCollapsedGroups } from "../approvals/ClaimGroupHeading";
import { StatusChip } from "../components/FinanceChips";
import { CcPickOne } from "./CcPickOne";
import { describeRuleError } from "./ccCopy";
import {
  type CcRuleFilters,
  type CcRuleGroup,
  filterRules,
  groupRules,
  NO_RULE_FILTERS,
  ruleAmountRange,
  ruleFilterCount,
  ruleFilterOptions,
  sortRules,
} from "./ccTaggingRuleList";
import { type CcTaggingRule, ccCardIsActive, ccHolderCardName } from "./ccTypes";
import { useCcOwnCards, useCcTaggingRules } from "./useCc";

/** The groups in the order shown, each with its heading, note and row accent. */
const GROUPS: readonly { key: CcRuleGroup; label: string; note?: string; accent?: "warning" | "error" }[] = [
  { key: "unconfigured", label: "Unconfigured rules", note: "needs details", accent: "warning" },
  { key: "outdated", label: "Outdated rules", note: "values no longer offered", accent: "error" },
  { key: "rules", label: "Rules" },
];

/**
 * The columns and their share of the table's width. Set rather than sized by content, so folding a
 * group doesn't move them.
 */
const COLUMNS: readonly { label: string; width: string }[] = [
  { label: "Card", width: "10%" },
  { label: "Supplier", width: "15%" },
  { label: "Account", width: "31%" },
  { label: "Amount Range ($)", width: "16%" },
  { label: "Added By", width: "8%" },
  { label: "Status", width: "9%" },
  { label: "Actions", width: "11%" },
];

/** The narrowest the table gets before it scrolls sideways. */
const TABLE_MIN_WIDTH = 1000;

const CELL = { fontSize: 12.5, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" } as const;

/** Shown in place of a value the rule leaves open. */
const OPEN = "—";

/** A row's tint and 3px leading edge in its group's accent colour. */
function accentSx(accent: "warning" | "error" | undefined) {
  if (!accent) return undefined;
  return {
    bgcolor: (theme: Theme) => alpha(theme.palette[accent].main, 0.08),
    "& > td:first-of-type": { boxShadow: (theme: Theme) => `inset 3px 0 0 ${theme.palette[accent].main}` },
  };
}

/** A cell holding a value, or a dimmed dash when there is none. */
function ValueCell({ value }: { value: string | null }) {
  return <TableCell sx={value ? CELL : { ...CELL, color: "text.disabled" }}>{value || OPEN}</TableCell>;
}

/** The Added By filter's options: a rule's source, named as the Added By column names it. */
const ADDED_BY_OPTIONS: Record<string, string> = { manual: "You", auto: "System" };

/** What a Filter popover select calls its "narrows nothing" option. */
const NO_FILTER = "No Filter";

/** Shown on a system rule's Delete, which is unavailable. */
const AUTO_DELETE_REASON = "System rules can only be switched off.";

/** Makes an `aria-disabled` button look and feel disabled. */
const UNAVAILABLE_SX = { color: "action.disabled", cursor: "default", "&:hover": { bgcolor: "transparent" } } as const;

/**
 * The card holder's autofill rules: those needing attention first, then the rest, each group sorted
 * by card number, supplier and account. A search and a Filter popover narrow the list, and each group's
 * heading counts only the rules that match. Each row offers Configure or Edit, and Delete, which a rule
 * added by the system doesn't allow.
 */
export function CcTaggingRules({
  onAdd,
  onEdit,
  onDelete,
  onHowItWorks,
}: {
  /** Called to add a rule. */
  onAdd: () => void;
  /** Called to configure or edit a rule. */
  onEdit: (rule: CcTaggingRule) => void;
  /** Called to delete a rule the card holder added. */
  onDelete: (rule: CcTaggingRule) => void;
  /** Called to open the guide to how autofill works. */
  onHowItWorks: () => void;
}) {
  const rules = useCcTaggingRules();
  const ownCards = useCcOwnCards();
  const { isCollapsed, toggleGroup } = useCollapsedGroups<CcRuleGroup>();
  const [filters, setFilters] = useState<CcRuleFilters>(NO_RULE_FILTERS);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const all = rules.data ?? [];
  const matching = filterRules(all, filters);
  // Whether the list is empty only because the rules that match are inactive.
  const onlyInactiveMatch =
    matching.length === 0 && !filters.showInactive && filterRules(all, { ...filters, showInactive: true }).length > 0;
  const groups = groupRules(sortRules(matching));
  const options = ruleFilterOptions(all, filters);
  const filterCount = ruleFilterCount(filters);
  const narrow = (patch: Partial<CcRuleFilters>) => setFilters((f) => ({ ...f, ...patch }));
  // Reset and Clear leave Show inactive as it is: it's how the list is viewed, not a filter.
  const keepView = (next: CcRuleFilters): CcRuleFilters => ({ ...next, showInactive: filters.showInactive });

  const activeCards = ownCards.cards.filter(ccCardIsActive);
  const cardLabel = (ccNumber: string) => {
    const card = ownCards.cards.find((c) => c.ccNumber === ccNumber);
    return card ? `${ccHolderCardName(card, activeCards)} (${ccNumber})` : ccNumber;
  };

  return (
    <>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        {/* Kept in view while they narrow, so a filter left from before the last rule went can't hide the next. */}
        {(all.length > 0 || filterCount > 0 || filters.search) && (
          <>
            <TextField
              size="small"
              placeholder="Search rules"
              value={filters.search}
              onChange={(e) => narrow({ search: e.target.value })}
              sx={{ width: 260 }}
              slotProps={{
                htmlInput: { "aria-label": "Search rules", ref: searchRef },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon size={16} />
                    </InputAdornment>
                  ),
                  endAdornment: filters.search && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        edge="end"
                        aria-label="Clear search"
                        onClick={() => {
                          narrow({ search: "" });
                          searchRef.current?.focus();
                        }}
                      >
                        <XIcon size={14} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              variant="text"
              size="small"
              startIcon={<FilterIcon size={16} />}
              onClick={(e) => setFilterAnchor(e.currentTarget)}
              aria-label={filterCount > 0 ? `Filter, ${filterCount} applied` : "Filter"}
              aria-haspopup="dialog"
              aria-expanded={filterAnchor !== null}
            >
              Filter
              {filterCount > 0 && (
                <Chip label={filterCount} size="small" color="primary" sx={{ ml: 0.75, height: 18, fontSize: 10.5 }} />
              )}
            </Button>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={filters.showInactive}
                  onChange={(e) => narrow({ showInactive: e.target.checked })}
                />
              }
              label="Show inactive"
              slotProps={{ typography: { sx: { fontSize: 13 } } }}
            />
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="How it works">
          <IconButton size="small" aria-label="How it works" onClick={onHowItWorks}>
            <CircleHelpIcon size={22} />
          </IconButton>
        </Tooltip>
        <Button variant="contained" size="small" startIcon={<PlusIcon size={14} />} onClick={onAdd}>
          Add Rule
        </Button>
      </Stack>

      <Popover
        open={filterAnchor !== null}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { role: "dialog", "aria-label": "Filter" } }}
      >
        <Stack spacing={2} sx={{ p: 2, width: 320 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Filter</Typography>
            <IconButton size="small" aria-label="Close filters" onClick={() => setFilterAnchor(null)}>
              <XIcon size={16} />
            </IconButton>
          </Stack>
          <CcPickOne
            label="Card"
            value={filters.card}
            onChange={(card) => narrow({ card })}
            options={options.cards}
            optionLabel={cardLabel}
            emptyLabel={NO_FILTER}
          />
          <CcPickOne
            label="Category"
            value={filters.category}
            onChange={(category) => narrow({ category })}
            options={options.categories}
            emptyLabel={NO_FILTER}
          />
          <CcPickOne
            label="Added By"
            value={filters.addedBy}
            onChange={(addedBy) => narrow({ addedBy })}
            options={Object.keys(ADDED_BY_OPTIONS)}
            optionLabel={(o) => ADDED_BY_OPTIONS[o]}
            emptyLabel={NO_FILTER}
          />
          <Stack direction="row" justifyContent="flex-end">
            <Button
              size="small"
              variant="outlined"
              disabled={filterCount === 0}
              onClick={() => setFilters(keepView({ ...NO_RULE_FILTERS, search: filters.search }))}
            >
              Reset
            </Button>
          </Stack>
        </Stack>
      </Popover>

      {rules.isLoading ? (
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      ) : rules.isError ? (
        <ErrorNotice onRetry={() => void rules.refetch()} retrying={rules.isFetching}>
          Couldn&apos;t load your autofill rules. {describeRuleError(rules.error)}
        </ErrorNotice>
      ) : all.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>No rules yet.</Typography>
      ) : matching.length === 0 ? (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 3 }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            {onlyInactiveMatch ? "Only inactive rules match." : "No rules match."}
          </Typography>
          {onlyInactiveMatch ? (
            <Button size="small" onClick={() => narrow({ showInactive: true })}>
              Show inactive
            </Button>
          ) : (
            <Button size="small" onClick={() => setFilters(keepView(NO_RULE_FILTERS))}>
              Clear
            </Button>
          )}
        </Stack>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ tableLayout: "fixed", minWidth: TABLE_MIN_WIDTH }}>
            <colgroup>
              {COLUMNS.map((c) => (
                <col key={c.label} style={{ width: c.width }} />
              ))}
            </colgroup>
            <TableHead>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableCell
                    key={c.label}
                    align={c.label === "Actions" ? "right" : undefined}
                    sx={{ ...CELL, fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {GROUPS.filter((g) => groups[g.key].length > 0).map((g) => (
                <Fragment key={g.key}>
                  <ClaimGroupHeading
                    label={g.label}
                    count={groups[g.key].length}
                    note={g.note}
                    colSpan={COLUMNS.length}
                    collapsed={isCollapsed(g.key)}
                    onToggle={() => toggleGroup(g.key)}
                  />
                  {!isCollapsed(g.key) &&
                    groups[g.key].map((r) => (
                      <RuleRow
                        key={r.id}
                        rule={r}
                        group={g}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </>
  );
}

/** One rule's row, in the group it is listed under. */
function RuleRow({
  rule,
  group,
  onEdit,
  onDelete,
}: {
  rule: CcTaggingRule;
  group: (typeof GROUPS)[number];
  onEdit: (rule: CcTaggingRule) => void;
  onDelete: (rule: CcTaggingRule) => void;
}) {
  const isAuto = rule.source === "auto";
  const configure = group.key === "unconfigured";

  return (
    <TableRow hover sx={accentSx(group.accent)}>
      <TableCell sx={{ ...CELL, whiteSpace: "nowrap" }}>{rule.ccNumber}</TableCell>
      <TableCell sx={{ ...CELL, fontWeight: 600 }}>{rule.supplier}</TableCell>
      <ValueCell value={rule.account} />
      <ValueCell value={ruleAmountRange(rule)} />
      <TableCell sx={CELL}>{isAuto ? "System" : "You"}</TableCell>
      <TableCell sx={CELL}>
        <StatusChip label={rule.active ? "Active" : "Inactive"} color={rule.active ? "success" : "default"} />
      </TableCell>
      <TableCell sx={CELL} align="right">
        <Stack direction="row" justifyContent="flex-end" gap={0.5}>
          <Tooltip title={configure ? "Configure" : "Edit"}>
            <IconButton
              size="small"
              aria-label={`${configure ? "Configure" : "Edit"} rule for ${rule.supplier}`}
              onClick={() => onEdit(rule)}
            >
              {configure ? <SettingsIcon size={16} /> : <PencilIcon size={16} />}
            </IconButton>
          </Tooltip>
          {/* `aria-disabled` rather than `disabled`, so the button keeps focus and the reason reaches the
              keyboard and screen readers as its description. */}
          <Tooltip title={isAuto ? AUTO_DELETE_REASON : "Delete"} describeChild={isAuto}>
            <IconButton
              size="small"
              color="error"
              aria-label={`Delete rule for ${rule.supplier}`}
              aria-disabled={isAuto || undefined}
              onClick={isAuto ? undefined : () => onDelete(rule)}
              sx={isAuto ? UNAVAILABLE_SX : undefined}
            >
              <TrashIcon size={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
}
