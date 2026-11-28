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
import { Alert, Button, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useOverrideRequest } from "../../api/useProcurement";
import { TextInput } from "../../request-form/formFields";
import type { OverrideInput, ProcurementMe, PurchaseRequest } from "../../types";

const MAX_JUSTIFICATION = 2000;
const MAX_COMMENT = 1000;

/**
 * Where a Procurement admin confirms the approval of a request its team lead approved, or rejects it. A rejection
 * goes back to the requester and emails them, so each decision is its own button.
 */
export default function OverrideReview({ request, me }: { request: PurchaseRequest; me: ProcurementMe }) {
  const override = useOverrideRequest(request.id);
  const { showSuccess } = useNotifications();
  const [justification, setJustification] = useState("");
  const [comment, setComment] = useState("");
  const { decision, isOverride } = request.teamLeadDecision;
  const confirmed = isOverride && decision === "approved";
  if (!me.roles.includes("procurement_admin") || request.status !== "approved" || confirmed) return null;
  if (request.requester.email.toLowerCase() === me.email.toLowerCase()) return null;

  const decide = (choice: OverrideInput["decision"]) =>
    override.mutate(
      { decision: choice, justification, comment },
      {
        onSuccess: () =>
          showSuccess(
            choice === "approved"
              ? "The approval has been confirmed."
              : "The request has been rejected. An email notification has been sent to the requester.",
          ),
      },
    );
  const blocked = override.isPending || justification.trim() === "";

  return (
    <Stack spacing={2} sx={{ p: 2.5, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700, pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
        Procurement admin review
      </Typography>
      <Typography variant="body2" color="text.secondary">
        The team lead approved this request. Confirm the approval, or reject the request and send it back to the requester.
      </Typography>
      <TextInput
        label="Justification"
        required
        multiline
        minRows={3}
        maxLength={MAX_JUSTIFICATION}
        value={justification}
        onChange={setJustification}
        disabled={override.isPending}
      />
      <TextInput label="Note for the requester (optional)" multiline minRows={2} maxLength={MAX_COMMENT} value={comment} onChange={setComment} disabled={override.isPending} />
      {override.isError && <Alert severity="error">{describeError(override.error)}</Alert>}
      <Stack direction="row" spacing={1.5} justifyContent="flex-end">
        <Button color="error" variant="outlined" disabled={blocked} onClick={() => decide("rejected")}>
          Reject request
        </Button>
        <Button variant="contained" disabled={blocked} onClick={() => decide("approved")}>
          Confirm approval
        </Button>
      </Stack>
    </Stack>
  );
}
