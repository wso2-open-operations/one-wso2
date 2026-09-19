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

import { useState } from "react";
import { useParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
} from "@wso2/oxygen-ui";
import { Bell, BellOff } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { UmtUpdateFieldChange } from "../api/useUmtUpdateFieldMutation";
import { useUmtUpdateFieldMutation } from "../api/useUmtUpdateFieldMutation";
import { useUmtLifecycleTransition } from "../api/useUmtLifecycleTransition";
import { useUmtMeta } from "../api/useUmtMeta";
import { useUmtUpdate } from "../api/useUmtUpdate";
import { useUmtMarkAsDuplicate, useUmtOnHoldUpdate } from "../api/useUmtUpdateActions";
import { useUmtUpdateSubscription } from "../api/useUmtUpdateSubscription";
import { useUmtUserInfo } from "../api/useUmtUserInfo";
import { UMT_ROLE_ID } from "../api/umtTypes";
import { readPersistedSelectedTab, writePersistedSelectedTab } from "../lib/umtLocalState";
import { useNotifications } from "@context/notifications/NotificationsContext";
import UmtShell from "../components/UmtShell";
import UmtUpdateDetailsGrid from "../components/UmtUpdateDetailsGrid";
import UmtUpdateEditTab from "../components/edit/UmtUpdateEditTab";
import UmtLifecycleHistory from "../components/UmtLifecycleHistory";
import UmtUpdateBranchTab from "../components/UmtUpdateBranchTab";
import UmtUpdateViewSections from "../components/UmtUpdateViewSections";
import { DashboardWidgetHolder } from "../components/UmtWidgets";

const UPDATE_VIEW_CHIP_SX = {
  borderColor: "currentColor",
  color: "info.main",
  fontSize: 13,
} as const;

const UMT_EDIT_ROLE_IDS = new Set<number>(Object.values(UMT_ROLE_ID));

export default function UmtUpdateView() {
  const { id } = useParams<{ id: string }>();

  return (
    <UmtShell title="Update Information" backTo="/umt/updates">
      <UmtUpdateBody id={id} />
    </UmtShell>
  );
}

function UmtUpdateBody({ id }: { id: string | undefined }) {
  // Persisted per update id, so the last-viewed tab does not carry over
  // between different updates.
  const [selectedTab, setSelectedTabState] = useState(() => (id ? (readPersistedSelectedTab(id) ?? "view") : "view"));
  const setSelectedTab = (tab: string) => {
    setSelectedTabState(tab);
    if (id) writePersistedSelectedTab(id, tab);
  };
  const update = useUmtUpdate(id);
  const userInfo = useUmtUserInfo();
  const meta = useUmtMeta();
  const subscription = useUmtUpdateSubscription(id ?? "");
  const fieldMutation = useUmtUpdateFieldMutation(id ?? "");
  const onHoldMutation = useUmtOnHoldUpdate(id ?? "");
  const markDuplicateMutation = useUmtMarkAsDuplicate(id ?? "");
  const reopenMutation = useUmtLifecycleTransition(id ?? "");
  const { showSuccess, showError } = useNotifications();

  const [onHoldDialogOpen, setOnHoldDialogOpen] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState("");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateOfId, setDuplicateOfId] = useState("");

  if (!id || !/^\d+$/.test(id)) {
    return <Alert severity="error">The update id is invalid.</Alert>;
  }

  if (update.isError) {
    return (
      <ErrorNotice
        error={update.error}
        onRetry={() => void update.refetch()}
        retrying={update.isFetching}
      >
        Couldn&apos;t load update #{id}.
      </ErrorNotice>
    );
  }

  const headerValues = [
    { key: "issue-type", value: update.data?.issueType },
    { key: "lifecycle", value: update.data?.lifecycle },
    { key: "lifecycle-state", value: update.data?.lifecycleState },
  ];
  const workEmail = userInfo.data?.workEmail;
  const isSubscribed = Boolean(
    workEmail && update.data?.watcherList?.includes(workEmail),
  );
  const subscriptionAction = isSubscribed ? "unsubscribe" : "subscribe";
  const hasEditRole = Boolean(
    userInfo.data?.roles?.some((role) => UMT_EDIT_ROLE_IDS.has(role)),
  );
  const canEditDevelopmentFields =
    hasEditRole && update.data?.lifecycleState === "Development";
  // Mark as Duplicate and On Hold are only offered before the update has
  // left early triage.
  const canUseEarlyActionRow = ["Development", "PRAnalyzed", "ProductAnalyzed"].includes(
    update.data?.lifecycleState ?? "",
  );
  const canReopen = update.data?.lifecycleState === "OnHold";

  const handleSubscription = () => {
    subscription.mutate(subscriptionAction, {
      onSuccess: () => {
        showSuccess(isSubscribed ? `Unsubscribed from update ${id}` : `Subscribed to update ${id}`);
      },
      onError: (error) => {
        showError(
          `${isSubscribed ? "Unsubscribe" : "Subscribe"} failed. ${describeError(error)}`,
        );
      },
    });
  };

  const handleFieldSave = async (change: UmtUpdateFieldChange) => {
    try {
      await fieldMutation.mutateAsync(change);
      showSuccess(`${fieldLabel(change.field)} updated for update ${id}`);
    } catch (error) {
      showError(`${fieldLabel(change.field)} update failed. ${describeError(error)}`);
      throw error;
    }
  };

  async function handleOnHoldSubmit() {
    const reason = onHoldReason.trim();
    if (!reason) return;
    try {
      await onHoldMutation.mutateAsync(reason);
      showSuccess(`Update ${id} put on hold.`);
      setOnHoldDialogOpen(false);
      setOnHoldReason("");
    } catch (error) {
      showError(`Failed to put update on hold. ${describeError(error)}`);
    }
  }

  async function handleMarkDuplicateSubmit() {
    const targetId = duplicateOfId.trim();
    if (!targetId) return;
    try {
      await markDuplicateMutation.mutateAsync(targetId);
      showSuccess(`Update ${id} marked as a duplicate of ${targetId}.`);
      setDuplicateDialogOpen(false);
      setDuplicateOfId("");
    } catch (error) {
      showError(`Failed to mark as duplicate. ${describeError(error)}`);
    }
  }

  async function handleReopen() {
    try {
      await reopenMutation.mutateAsync("Development");
      showSuccess(`Update ${id} reopened.`);
    } catch (error) {
      showError(`Failed to reopen update. ${describeError(error)}`);
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: "100%", pb: 4, width: "100%" }}>
      <DashboardWidgetHolder
        title={
          <Stack component="span" direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Box component="span">Update #{id}</Box>
            <Button
              variant={isSubscribed ? "outlined" : "contained"}
              size="small"
              disabled={update.isPending || userInfo.isPending || !workEmail}
              loading={subscription.isPending}
              startIcon={isSubscribed ? <BellOff size={17} /> : <Bell size={17} />}
              onClick={handleSubscription}
            >
              {isSubscribed ? "Unsubscribe" : "Subscribe"}
            </Button>
            {canUseEarlyActionRow && (
              <>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => setDuplicateDialogOpen(true)}
                >
                  Mark as Duplicate
                </Button>
                <Button variant="outlined" color="error" size="small" onClick={() => setOnHoldDialogOpen(true)}>
                  On Hold
                </Button>
              </>
            )}
            {canReopen && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                loading={reopenMutation.isPending}
                onClick={() => void handleReopen()}
              >
                Reopen
              </Button>
            )}
          </Stack>
        }
        backgroundColor="background.paper"
        actions={
          <Stack direction="row" spacing={1}>
            {headerValues.map(({ key, value }) =>
              update.isPending ? (
                <Skeleton key={key} variant="rounded" width={80} height={24} />
              ) : (
                <Chip
                  key={key}
                  label={displayValue(value)}
                  size="small"
                  variant="outlined"
                  sx={UPDATE_VIEW_CHIP_SX}
                />
              ),
            )}
          </Stack>
        }
      >
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={selectedTab}
            onChange={(_event, value: string) => setSelectedTab(value)}
            aria-label="Update sections"
          >
            <Tab label="View" value="view" />
            <Tab label="Branch" value="branch" />
            <Tab label="Edit" value="edit" />
            <Tab label="LifeCycle History" value="lifecycle-history" />
          </Tabs>
        </Box>
        {selectedTab === "view" && (
          <Box role="tabpanel" aria-label="View" sx={{ pt: 3 }}>
            <UmtUpdateDetailsGrid
              id={id}
              update={update.data}
              loading={update.isPending}
              canEdit={canEditDevelopmentFields}
              userEmails={meta.data?.userEmails ?? []}
              userEmailsLoading={meta.isPending}
              savingField={fieldMutation.isPending ? fieldMutation.variables?.field : undefined}
              onSave={handleFieldSave}
            />
            {update.data && (
              <>
                <Divider sx={{ mt: 3 }} />
                <UmtUpdateViewSections id={id} update={update.data} />
              </>
            )}
          </Box>
        )}
        {selectedTab === "branch" && update.data && (
          <Box role="tabpanel" aria-label="Branch" sx={{ pt: 3 }}>
            <UmtUpdateBranchTab
              id={id}
              products={meta.data?.products ?? {}}
              update={update.data}
            />
          </Box>
        )}
        {selectedTab === "edit" && update.data && (
          <Box role="tabpanel" aria-label="Edit" sx={{ pt: 3 }}>
            <UmtUpdateEditTab key={id} id={id} update={update.data} />
          </Box>
        )}
        {selectedTab === "lifecycle-history" && (
          <Box role="tabpanel" aria-label="LifeCycle History" sx={{ pt: 3 }}>
            <UmtLifecycleHistory id={id} />
          </Box>
        )}
      </DashboardWidgetHolder>

      <Dialog open={onHoldDialogOpen} onClose={() => setOnHoldDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Enter reason to change for On Hold</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            maxRows={12}
            label="Reason"
            value={onHoldReason}
            onChange={(event) => setOnHoldReason(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOnHoldDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!onHoldReason.trim()}
            loading={onHoldMutation.isPending}
            onClick={() => void handleOnHoldSubmit()}
          >
            Proceed
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Duplicate of Update Id</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter the id of the update this one duplicates.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Update Id"
            value={duplicateOfId}
            onChange={(event) => setDuplicateOfId(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!duplicateOfId.trim()}
            loading={markDuplicateMutation.isPending}
            onClick={() => void handleMarkDuplicateSubmit()}
          >
            Proceed
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function fieldLabel(field: UmtUpdateFieldChange["field"]): string {
  switch (field) {
    case "assignedTo":
      return "Assigned To";
    case "developedBy":
      return "Developed By";
    case "worstCaseEstimate":
      return "Worst Case Date";
  }
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const normalizedValue = String(value).trim();
  return normalizedValue || "N/A";
}
