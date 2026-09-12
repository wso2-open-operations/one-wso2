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

import { Box, Button, Card, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon, LockIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink } from "react-router";

// What someone sees when they open a MIS screen they cannot use. A padlock on a
// neutral surface, not an Alert: nothing has failed, and dressing a locked door
// as a fault makes the screen read as broken. Same reasoning, and the same
// shape, as MarketingOpsLocked.
//
// ---- why there are two messages ------------------------------------------
//
// MIS has two independent privileges — one for the ARR dashboards, one for the
// Flash Dashboard — so "you have MIS access, just not to this screen" is an
// ordinary situation rather than an edge case. Finance sees Flash; revenue
// leadership sees ARR; few people see both. Telling a Flash user who opened ARR
// Build that they have no MIS access would simply be false, and would send them
// to ask for something they already hold.
//
// ---- what it does not say -------------------------------------------------
//
// No privilege numbers and no LDAP group names. Those are backend vocabulary
// (see misTypes.ts), and the numbers in particular mean something different
// everywhere else in this app. Nor is there a link to ask someone: no support
// address, Slack channel or service-desk route is configured anywhere here, and
// inventing one would be worse than saying it plainly.
//
// Back to Home goes to /me, which every authenticated employee can reach — it
// is also where App.tsx sends "/" and any unmatched route. Without it the only
// exit is the browser's back button, which is what makes a locked door feel
// like a wall.
export default function MisLocked({ isAuthorized }: { isAuthorized: boolean }) {
  return (
    <Card variant="outlined" sx={{ mt: 1.5, p: 3, maxWidth: 620 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
        {/* Neutral, not tinted: the padlock is the whole message and it should
            not read as a status colour. Hidden from assistive tech — the
            heading beside it says the same thing in words. */}
        <Box
          aria-hidden="true"
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            bgcolor: "action.hover",
            color: "text.secondary",
          }}
        >
          <LockIcon size={20} />
        </Box>
        <Box>
          {/* h2 under the shell's h1, so heading order holds for anyone
              navigating by headings — variant="subtitle1" would render an h6
              and leave a four-level gap. Matches MarketingOpsLocked. */}
          <Typography
            component="h2"
            sx={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", mb: 0.6 }}
          >
            {isAuthorized
              ? "This is not one of the MIS screens you can open"
              : "You don't have access to Finance MIS"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: "60ch" }}>
            {isAuthorized
              ? "Finance MIS grants the revenue dashboards and the Flash Dashboard separately, and this screen belongs to the half you don't hold. The MIS screens you can open are in the Finance menu on the left."
              : "Finance MIS reports company-wide recurring revenue and the monthly P&L, so access is granted to specific finance and leadership groups rather than to everyone. Ask a Finance MIS administrator if you need it."}
          </Typography>
          <Button
            component={RouterLink}
            to="/me"
            variant="outlined"
            size="small"
            startIcon={<ArrowLeftIcon size={16} />}
          >
            Back to Home
          </Button>
        </Box>
      </Box>
    </Card>
  );
}
