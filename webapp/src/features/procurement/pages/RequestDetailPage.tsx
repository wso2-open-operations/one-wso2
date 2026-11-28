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
import { Link as RouterLink, useParams } from "react-router";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Link, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { RequestStatusChip } from "../components/ProcurementChips";
import DecisionNotice from "../components/DecisionNotice";
import SavedRequestSummary from "../components/SavedRequestSummary";
import TeamLeadEdit from "../components/TeamLeadEdit";
import RequestForm from "../request-form/RequestForm";
import { draftFromRequest } from "../request-form/requestFormModel";
import { useAttachments, useProcurementLookups, useProcurementMe, useRequest, useResubmitRequest, useCancelRequest } from "../api/useProcurement";
import { procurementPaths } from "../procurementPaths";
import type { PurchaseRequest } from "../types";

function ResubmitForm({ request, onDone }: { request: PurchaseRequest; onDone: () => void }) {
  const me = useProcurementMe();
  const lookups = useProcurementLookups();
  const attachments = useAttachments(request.id);
  const resubmit = useResubmitRequest(request.id);
  const retryOf = (failed: typeof me | typeof lookups | typeof attachments) => (
    <Button color="inherit" size="small" onClick={() => void failed.refetch()}>
      Retry
    </Button>
  );
  // Nothing to show until each has loaded once, so a failure then blocks the form.
  const blocking = !me.data && me.isError ? me : !lookups.data && lookups.isError ? lookups : !attachments.data && attachments.isError ? attachments : null;
  if (blocking) {
    return (
      <Alert severity="error" action={retryOf(blocking)}>
        {describeError(blocking.error)}
      </Alert>
    );
  }
  if (!me.data || !lookups.data || !attachments.data) return <Skeleton variant="rounded" height={320} />;
  // A later refresh can fail while the data is still held. The form stays mounted, so what has been typed and the
  // step it is on are not lost; the failure is shown beside it.
  const refreshFailed = me.isError ? me : lookups.isError ? lookups : attachments.isError ? attachments : null;
  return (
    <>
      {refreshFailed && (
        <Alert severity="warning" action={retryOf(refreshFailed)} sx={{ mb: 2 }}>
          {describeError(refreshFailed.error)}
        </Alert>
      )}
      <RequestForm
        initialDraft={draftFromRequest(request, attachments.data)}
        me={me.data}
        lookups={lookups.data}
        submitLabel="Resubmit request"
        submitting={resubmit.isPending}
        error={resubmit.isError ? describeError(resubmit.error) : undefined}
        onSubmit={(input) => resubmit.mutate(input, { onSuccess: onDone })}
      />
    </>
  );
}

export default function RequestDetailPage() {
  const { requestId } = useParams();
  // Keyed by the request, so the editor and its draft start over when another request is opened.
  return <RequestDetailContent key={requestId} />;
}

function RequestDetailContent() {
  const { requestId } = useParams();
  const request = useRequest(requestId);
  const me = useProcurementMe();
  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const cancel = useCancelRequest(requestId ?? "");
  const data = request.data;
  const isRequester = !!data && !!me.data && data.requester.email.toLowerCase() === me.data.email.toLowerCase();

  return (
    <>
      <Link component={RouterLink} to={procurementPaths.requests} underline="none" sx={{ display: "inline-block", mb: 2 }}>
        ← My requests
      </Link>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{data ? `${data.reference ?? "Draft"} - ${data.title}` : "Purchase request"}</Typography>
        {data && !editing && (
          <Stack direction="row" spacing={2} alignItems="center">
            <RequestStatusChip status={data.status} />
            {isRequester && (data.status === "submitted" || data.status === "rejected") && (
              <Button color="inherit" variant="outlined" onClick={() => setConfirmingCancel(true)}>
                Cancel request
              </Button>
            )}
            {isRequester && data.status === "rejected" && (
              <Button variant="contained" onClick={() => setEditing(true)}>
                Edit and resubmit
              </Button>
            )}
          </Stack>
        )}
      </Stack>
      <>
        <Dialog open={confirmingCancel} onClose={() => !cancel.isPending && setConfirmingCancel(false)}>
          <DialogTitle>Cancel this request?</DialogTitle>
          <DialogContent>
            <DialogContentText>The request is withdrawn and can no longer be approved or edited.</DialogContentText>
            {cancel.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {describeError(cancel.error)}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button color="inherit" disabled={cancel.isPending} onClick={() => setConfirmingCancel(false)}>
              Keep request
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(undefined, { onSuccess: () => setConfirmingCancel(false) })}
            >
              {cancel.isPending ? "Cancelling…" : "Cancel request"}
            </Button>
          </DialogActions>
        </Dialog>
        {request.isError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void request.refetch()}>
                Retry
              </Button>
            }
          >
            {describeError(request.error)}
          </Alert>
        )}
        {request.isPending && !request.isError && <Skeleton variant="rounded" height={320} />}
        {data && (
          <Stack spacing={2}>
            <DecisionNotice request={data} />
            {!editing && !me.data && me.isError && (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={() => void me.refetch()}>
                    Retry
                  </Button>
                }
              >
                Who you are could not be read, so the actions for you are hidden. {describeError(me.error)}
              </Alert>
            )}
            {editing ? (
              <>
                <Button color="inherit" variant="outlined" onClick={() => setEditing(false)} sx={{ alignSelf: "flex-start" }}>
                  Cancel editing
                </Button>
                <ResubmitForm request={data} onDone={() => setEditing(false)} />
              </>
            ) : (
              <>
                {data.status !== "rejected" && (
                  <Alert severity="info">This request is read-only in its current state.</Alert>
                )}
                <SavedRequestSummary request={data} requesterAction={me.data ? <TeamLeadEdit request={data} me={me.data.email} /> : undefined} />
              </>
            )}
          </Stack>
        )}
      </>
    </>
  );
}
