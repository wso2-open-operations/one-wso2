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

import { VISUALLY_HIDDEN_SX } from "@components/screen-badge/screenBadgeSx";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon, CircleHelpIcon, CopyIcon, SparklesIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { dismissAutofillGuide, isAutofillGuideDismissed } from "../ccAutofillGuideStore";
import { ccBillsAddress } from "../ccTypes";

/** How long the copy button shows it copied. */
const COPIED_MS = 1500;
const TITLE_ID = "cc-autofill-guide-title";

/**
 * The intro card at the top of Autofill Rules. It shows until the user dismisses it, and always while they have no
 * rules, since then there's nothing on the page to explain how rules come about.
 */
export function CcAutofillGuideCard({
  sub,
  hasRules,
}: {
  /** The user's Asgardeo `sub`, which the dismissal is kept under. Until it's known, Got it hides the card for now. */
  sub: string | undefined;
  /** Whether the user has any rules. Without them, the card stays and offers no Got it. */
  hasRules: boolean;
}) {
  const [dismissed, setDismissed] = useState(() => isAutofillGuideDismissed(sub));
  if (dismissed && hasRules) return null;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color: "primary.main", display: "flex" }}>
          <SparklesIcon size={20} />
        </Box>
        <Typography variant="body2" sx={{ flex: 1 }}>
          Autofill attaches your bills to your card transactions and fills in their expense details. To see how,
          select{" "}
          <InlineIcon label="How it works" color="text.secondary">
            <CircleHelpIcon size={15} aria-hidden />
          </InlineIcon>{" "}
          beside <strong>Add Rule</strong>.
        </Typography>
        {hasRules && (
          <Button
            size="small"
            onClick={() => {
              dismissAutofillGuide(sub);
              setDismissed(true);
            }}
          >
            Got it
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

/** "How autofill works": the steps from a bill arriving to a transaction filled in by a rule. */
export function CcAutofillGuideDialog({
  open,
  onClose,
  inbox,
  workEmail,
}: {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called to close the dialog. */
  onClose: () => void;
  /** The bills inbox from the runtime config. Without one, the step about sending bills is left out. */
  inbox: string;
  /** The user's work email, whose name before the `@` makes their billing address. */
  workEmail: string;
}) {
  const address = ccBillsAddress(inbox, workEmail);
  const steps: { title: string; body: ReactNode }[] = [
    ...(address
      ? [
          {
            title: "Send your bills to your billing address",
            body: (
              <>
                <BillsAddress address={address} />
                Set it as the billing email with suppliers such as GitHub or AWS, or forward bills to it.
              </>
            ),
          },
        ]
      : []),
    {
      title: "The receipt is attached for you",
      body:
        "A bill is matched to one of your new transactions with the same amount, dated from 3 days before to 7 " +
        "days after it. It won't replace a receipt that's already attached. Only bills in USD are matched.",
    },
    {
      title: "Your rules fill in the details",
      body: (
        <>
          A rule applies when the bill's supplier contains the rule's supplier, the account matches, and the amount
          is in range. If several apply, the one with the longest supplier is used (e.g. "Uber Eats" over "Uber" when
          the bill's supplier is "Uber Eats"). Transactions you've already started filling in are left as they are.
          Nothing is submitted automatically, so review and submit them from Pending Submissions, where they're
          marked with{" "}
          <InlineIcon label="a sparkles icon, read out as filled by a rule" color="primary.main">
            <SparklesIcon size={15} aria-hidden />
          </InlineIcon>
          .
        </>
      ),
    },
    {
      title: "New suppliers get a rule to set up",
      body: (
        <>
          When no rule applies, one is added for that supplier and account. <strong>New</strong> on Autofill Rules
          means a rule needs setting up, and <strong>Fix</strong> means a rule has a value that has been removed from
          the system. Until it's set up or fixed, the rule fills in nothing.
        </>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby={TITLE_ID}>
      <DialogTitle id={TITLE_ID} sx={{ pr: 6 }}>
        How autofill works
      </DialogTitle>
      <IconButton aria-label="Close" onClick={onClose} size="small" sx={{ position: "absolute", right: 12, top: 12 }}>
        <XIcon size={18} />
      </IconButton>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {steps.map((step, i) => (
            <Box key={step.title}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                <Chip label={i + 1} size="small" color="primary" sx={{ fontWeight: 700, minWidth: 26, height: 22 }} />
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {step.title}
                </Typography>
              </Stack>
              <Typography component="div" variant="body2" sx={{ pl: 4.5, color: "text.secondary" }}>
                {step.body}
              </Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

/** An icon in running text, read out by its label. */
function InlineIcon({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", verticalAlign: "middle", color }}>
      {children}
      <Box component="span" sx={VISUALLY_HIDDEN_SX}>
        {label}
      </Box>
    </Box>
  );
}

/** The user's billing address, with a button that copies it. */
function BillsAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // The address stays on screen to copy by hand.
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ my: 1, px: 1.5, py: 0.75, borderRadius: 1, bgcolor: "action.hover", width: "fit-content" }}
    >
      <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "text.primary" }}>{address}</Typography>
      <Tooltip title={copied ? "Copied" : "Copy"}>
        <IconButton size="small" aria-label={copied ? "Copied" : "Copy billing address"} onClick={() => void copy()}>
          {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
