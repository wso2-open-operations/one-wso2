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

import { HttpError } from "@api/http";
import { Box, CircularProgress, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { SparklesIcon } from "@wso2/oxygen-ui-icons-react";
import type { ReactNode } from "react";
import { describeRuleError } from "../ccCopy";
import { ruleAmountRange } from "../ccTaggingRuleList";
import type { CcTaggingRule } from "../ccTypes";
import { useCcTaggingRule } from "../useCc";

const TEXT_SX = { fontSize: 12 } as const;

/**
 * Marks a transaction an autofill rule filled in. Its tooltip shows the rule as it is now, loaded only once the
 * tooltip opens.
 */
export function CcAutoTaggedIcon({
  txnId,
  ruleId,
  tabIndex = 0,
}: {
  /** The transaction's ID, which names the icon. */
  txnId: number;
  /** The ID of the rule that filled the transaction in. */
  ruleId: number;
  /** The icon's tab index. A grid that moves focus between its cells passes its cell's. */
  tabIndex?: number;
}) {
  return (
    <Tooltip title={<RuleDetails ruleId={ruleId} />} describeChild>
      <Box
        component="span"
        role="img"
        tabIndex={tabIndex}
        aria-label={`Transaction ${txnId} was filled by a rule`}
        sx={{ display: "inline-flex", alignItems: "center", color: "primary.main" }}
      >
        <SparklesIcon size={16} aria-hidden />
      </Box>
    </Tooltip>
  );
}

/** The tooltip's content. It's mounted only while the tooltip is open, so the rule loads only then. */
function RuleDetails({ ruleId }: { ruleId: number }) {
  const rule = useCcTaggingRule(ruleId);

  if (rule.isError) {
    const deleted = rule.error instanceof HttpError && rule.error.status === 404;
    return (
      <Typography sx={TEXT_SX}>
        {deleted ? "Filled by a rule that has since been deleted." : describeRuleError(rule.error)}
      </Typography>
    );
  }
  if (rule.isPending || !rule.data) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={12} color="inherit" />
        <Typography sx={TEXT_SX}>Loading the rule…</Typography>
      </Stack>
    );
  }
  return <RuleSummary rule={rule.data} />;
}

/**
 * The rule's state, what it matches and the details it fills in, leaving out what it doesn't set. A rule without an
 * account still shows one, since it matches only bills that show none.
 */
function RuleSummary({ rule }: { rule: CcTaggingRule }) {
  const state = [!rule.active && "inactive", rule.outdated && "outdated"].filter(Boolean).join(", ");
  const rows: [string, ReactNode][] = [
    ["Card", rule.ccNumber],
    ["Supplier", rule.supplier],
    [
      "Account",
      rule.account ?? (
        <Box component="span" sx={{ fontStyle: "italic", opacity: 0.75 }}>
          (none)
        </Box>
      ),
    ],
    ["Amount Range ($)", ruleAmountRange(rule)],
    ["Expense Category", rule.expenseCategoryLabel],
    ["Expense Type", rule.expenseTypeLabel],
    ["Comment", rule.comment],
    ["Sub Region", rule.subRegion],
    ["Product Unit", rule.productUnit],
    ["Business Unit", rule.businessUnit],
  ];

  return (
    <Box>
      <Typography sx={{ ...TEXT_SX, fontWeight: 700, mb: 0.5 }}>
        {state ? `Filled by rule (now ${state})` : "Filled by rule"}
      </Typography>
      <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1.5, m: 0, ...TEXT_SX }}>
        {rows
          .filter(([, value]) => value)
          .map(([term, value]) => (
            <Box key={term} sx={{ display: "contents" }}>
              <Box component="dt" sx={{ opacity: 0.75 }}>
                {term}
              </Box>
              <Box component="dd" sx={{ m: 0 }}>
                {value}
              </Box>
            </Box>
          ))}
      </Box>
    </Box>
  );
}
