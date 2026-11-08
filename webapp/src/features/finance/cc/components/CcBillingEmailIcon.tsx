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

import { useNotifications } from "@context/notifications/NotificationsContext";
import { Box, IconButton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { CheckIcon, CopyIcon, ExternalLinkIcon, MailIcon } from "@wso2/oxygen-ui-icons-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { gmailSearchUrl } from "../ccBillingEmail";
import type { CcBillingEmailRef } from "../ccTypes";

/** How long the copy button shows it copied. */
const COPIED_MS = 1500;
const TEXT_SX = { fontSize: 12 } as const;

/** Marks a transaction matched with a billing email. Its tooltip shows the subject, to copy or open in Gmail. */
export function CcBillingEmailIcon({
  txnId,
  billingEmailRef,
  tabIndex = 0,
}: {
  /** The transaction's ID, which names the icon. */
  txnId: number;
  /** The billing email the transaction was matched with. */
  billingEmailRef: CcBillingEmailRef;
  /** The icon's tab index. A grid that moves focus between its cells passes its cell's. */
  tabIndex?: number;
}) {
  return (
    <Tooltip title={<EmailDetails billingEmailRef={billingEmailRef} />} describeChild>
      <Box
        component="span"
        role="img"
        tabIndex={tabIndex}
        aria-label={`Transaction ${txnId} has a billing email`}
        sx={{ display: "inline-flex", alignItems: "center", color: "primary.main" }}
      >
        <MailIcon size={16} aria-hidden />
      </Box>
    </Tooltip>
  );
}

/** Stops a mouse press from moving focus to the pressed element. Its click still fires. */
function preventMouseFocus(event: MouseEvent) {
  event.preventDefault();
}

/** The tooltip's content: a heading, the subject, a button that copies it and a link that opens it in Gmail. */
function EmailDetails({ billingEmailRef }: { billingEmailRef: CcBillingEmailRef }) {
  const { showWarning } = useNotifications();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(billingEmailRef.subject);
    } catch {
      showWarning("Couldn't copy the subject");
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <Box>
      <Typography sx={{ ...TEXT_SX, fontWeight: 700 }}>Billing email subject</Typography>
      {/* The tooltip closes when anything in it loses focus, so its buttons don't take focus from a click. */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography sx={{ ...TEXT_SX, overflowWrap: "anywhere" }}>{billingEmailRef.subject}</Typography>
        <IconButton
          size="small"
          color="inherit"
          aria-label={copied ? "Copied" : "Copy the subject"}
          onMouseDown={preventMouseFocus}
          onClick={() => void copy()}
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        </IconButton>
        <IconButton
          size="small"
          color="inherit"
          component="a"
          href={gmailSearchUrl(billingEmailRef.messageId)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open the email in Gmail"
          onMouseDown={preventMouseFocus}
        >
          <ExternalLinkIcon size={14} />
        </IconButton>
      </Stack>
    </Box>
  );
}
