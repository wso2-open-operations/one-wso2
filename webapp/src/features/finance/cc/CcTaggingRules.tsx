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
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  type Theme,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { PencilIcon, PlusIcon, SettingsIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { Fragment } from "react";
import { ClaimGroupHeading, useCollapsedGroups } from "../approvals/ClaimGroupHeading";
import { StatusChip } from "../components/FinanceChips";
import { bareAmount } from "../util/financeFormat";
import { type CcRuleGroup, groupRules, sortRules } from "./ccTaggingRuleForm";
import type { CcTaggingRule } from "./ccTypes";
import { useCcTaggingRules } from "./useCc";

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

/** A rule's amount range: from its minimum (inclusive) up to its maximum (exclusive), or `null` when open. */
function amountRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `${bareAmount(min)} – ${bareAmount(max)}`;
  if (min != null) return `≥ ${bareAmount(min)}`;
  if (max != null) return `< ${bareAmount(max)}`;
  return null;
}

/** Shown on a system rule's Delete, which is unavailable. */
const AUTO_DELETE_REASON = "System rules can only be switched off.";

/** Makes an `aria-disabled` button look and feel disabled. */
const UNAVAILABLE_SX = { color: "action.disabled", cursor: "default", "&:hover": { bgcolor: "transparent" } } as const;

/**
 * The card holder's autofill rules: those needing attention first, then the rest, each group sorted
 * by card number, supplier and account. Each row offers Configure or Edit, and Delete, which a rule added
 * by the system doesn't allow.
 */
export function CcTaggingRules({
  onAdd,
  onEdit,
  onDelete,
}: {
  /** Called to add a rule. */
  onAdd: () => void;
  /** Called to configure or edit a rule. */
  onEdit: (rule: CcTaggingRule) => void;
  /** Called to delete a rule the card holder added. */
  onDelete: (rule: CcTaggingRule) => void;
}) {
  const rules = useCcTaggingRules();
  const { isCollapsed, toggleGroup } = useCollapsedGroups<CcRuleGroup>();

  const groups = groupRules(sortRules(rules.data ?? []));

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" size="small" startIcon={<PlusIcon size={14} />} onClick={onAdd}>
          Add Rule
        </Button>
      </Stack>

      {rules.isLoading ? (
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      ) : rules.isError ? (
        <ErrorNotice error={rules.error} onRetry={() => void rules.refetch()} retrying={rules.isFetching}>
          Couldn&apos;t load your autofill rules.
        </ErrorNotice>
      ) : (rules.data ?? []).length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>No rules yet.</Typography>
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
      <ValueCell value={amountRange(rule.amountMin, rule.amountMax)} />
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
