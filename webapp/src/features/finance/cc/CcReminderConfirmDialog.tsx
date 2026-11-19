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

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@wso2/oxygen-ui";
import { useId } from "react";
import type { CcCardLeadCompliance } from "./ccTypes";
import { describeReminderConfirmation } from "./ccUiText";

/**
 * Asks before a card lead's reminder email goes out.
 *
 * Shaped like the rule delete dialog beside it rather than like the shared
 * confirmation: the two sit one click apart in the same app, so they are built
 * the same way — sized to their text instead of the full width, and a plain
 * Cancel against a filled button naming the action.
 *
 * Unlike that delete, this closes as soon as it is confirmed rather than
 * holding while the request runs. The send reports itself on the row it came
 * from, which keeps its spinner and its sent count either way, and the lock
 * behind that row is what stops a second send — not this dialog staying up.
 */
export function CcReminderConfirmDialog({
  lead,
  dateFrom,
  onConfirm,
  onClose,
}: {
  /** The lead awaiting confirmation; `null` closes the dialog. */
  lead: CcCardLeadCompliance | null;
  /** The range the table was built from, named in the text and sent with the mail. */
  dateFrom?: string;
  /** Called with the lead when the send is confirmed. */
  onConfirm: (lead: CcCardLeadCompliance) => void;
  /** Called when the dialog is done, sent or not. */
  onClose: () => void;
}) {
  const titleId = useId();

  if (!lead) return null;

  const { title, recipient, scope } = describeReminderConfirmation(lead, dateFrom);

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          An email goes to <strong>{recipient}</strong> {scope}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          autoFocus
          onClick={() => {
            onConfirm(lead);
            onClose();
          }}
        >
          Send reminder
        </Button>
      </DialogActions>
    </Dialog>
  );
}
