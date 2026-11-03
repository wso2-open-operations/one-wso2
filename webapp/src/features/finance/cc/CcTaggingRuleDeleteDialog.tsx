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
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@wso2/oxygen-ui";
import { useId } from "react";
import { CC_RULE_SNACK, describeRuleError } from "./ccCopy";
import type { CcTaggingRule } from "./ccTypes";
import { useCcDeleteTaggingRule } from "./useCcMutations";

/**
 * Asks before deleting a rule the card holder added. Stays open while the delete runs, and on a
 * failure, which it shows inside.
 */
export function CcTaggingRuleDeleteDialog({
  rule,
  onClose,
}: {
  /** The rule to delete. */
  rule: CcTaggingRule;
  /** Called when the dialog is done, deleted or not. */
  onClose: () => void;
}) {
  const remove = useCcDeleteTaggingRule();
  const { showSuccess } = useNotifications();
  const titleId = useId();

  const handleDelete = () =>
    remove.mutate(rule.id, {
      onSuccess: () => {
        showSuccess(CC_RULE_SNACK.deleted);
        onClose();
      },
    });

  return (
    <Dialog open onClose={remove.isPending ? undefined : onClose} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>Delete rule?</DialogTitle>
      <DialogContent>
        {remove.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {describeRuleError(remove.error)}
          </Alert>
        )}
        <DialogContentText>
          The rule for <strong>{rule.supplier}</strong> on card {rule.ccNumber} will stop filling in
          transactions. Transactions it already filled in keep their details.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={remove.isPending} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          autoFocus
          onClick={handleDelete}
          disabled={remove.isPending}
          startIcon={remove.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
