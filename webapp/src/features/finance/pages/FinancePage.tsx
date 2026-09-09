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

import { Box, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, CheckCheckIcon, CreditCardIcon, ReceiptTextIcon } from "@wso2/oxygen-ui-icons-react";
import { NavLink } from "react-router";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { useFinanceGate } from "../api/useFinanceGate";
import { CLAIM_APPROVAL_PATH } from "../approvals/claimApprovalTabs";
import { ccPaths } from "../cc/ccPaths";
import { expenseFinancePaths } from "../expense/expenseFinancePaths";

// The Finance overview. It said "coming soon" while the perspective was empty;
// Claim approval is here now, so it lists what is here instead.
//
// The header names the DOMAIN, not today's contents — this is a home for
// finance operations and more are coming, so a subtitle about approvals would
// need rewriting the moment the second one lands. It also does not explain what
// lives under Me: no other perspective explains its neighbours.
//
// The card is gated by the same rule as the rail entry: someone who approves no
// claims should not be offered a link to a screen that will turn them away.
export default function FinancePage() {
  const gate = useFinanceGate();

  // Each card is gated by the same id the rail uses for that entry, so the
  // overview and the menu cannot disagree about what is here.
  const entries = [
    {
      id: "claim-approval",
      show: gate.canSee("claim-approval"),
      to: CLAIM_APPROVAL_PATH,
      icon: CheckCheckIcon,
      title: "Claim approval",
      description: "Expense and OPD claims waiting on your decision, and the ones already decided.",
    },
    {
      id: "expense",
      show: gate.canSee("expense-new"),
      to: expenseFinancePaths.new,
      icon: ReceiptTextIcon,
      title: "Expense Claims",
      description: "File a new expense claim.",
    },
    {
      id: "cc",
      // The app's own landing screen, and the id its rail entry is gated by.
      show: gate.canSee("cc-dashboard"),
      to: ccPaths.dashboard,
      icon: CreditCardIcon,
      title: "Credit Card Expenses",
      description: "Categorise and submit your corporate card spend, and see what is outstanding.",
    },
  ].filter((entry) => entry.show);

  return (
    <Box>
      <PerspectiveHeader
        eyebrow="Finance perspective"
        title="Finance"
        subtitle="Operations and tools for company finances."
      />

      {gate.isResolving ? (
        <Skeleton variant="rectangular" height={132} sx={{ borderRadius: 1.5, maxWidth: 480 }} />
      ) : entries.length === 0 ? (
        // Not an error, and not "coming soon" either: the perspective is built,
        // it just holds nothing this person is party to. Reachable when the
        // card app's own /user-info says no, which is a data state rather than
        // a shape the code rules out.
        <Card variant="outlined" sx={{ p: 2.5, maxWidth: 480 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.75 }}>
            Nothing here for you yet
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            Finance holds approvals and the corporate card app. Your own claims are under Me.
          </Typography>
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
            maxWidth: 800,
          }}
        >
          {entries.map((entry) => (
            <OverviewCard key={entry.id} {...entry} />
          ))}
        </Box>
      )}
    </Box>
  );
}

/** One app on the overview: what it is, and a way in. */
function OverviewCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof CheckCheckIcon;
  title: string;
  description: string;
}) {
  return (
    <Card
      variant="outlined"
      component={NavLink}
      to={to}
      sx={{
        p: 2.5,
        display: "block",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color .12s, background-color .12s",
        "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Icon size={16} />
        <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{title}</Typography>
        <ArrowRightIcon size={15} />
      </Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{description}</Typography>
    </Card>
  );
}
