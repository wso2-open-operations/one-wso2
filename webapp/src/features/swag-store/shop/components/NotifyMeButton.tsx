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

import type { JSX } from "react";
import { Alert, Box, Button, CircularProgress, Typography } from "@wso2/oxygen-ui";
import { BellIcon } from "@wso2/oxygen-ui-icons-react";
import { messageFor } from "../../util/swagStoreError";
import { useAlerts, useCancelAlert, useCreateAlert } from "../api/useAlerts";

interface NotifyMeButtonProps {
  /** An out-of-stock variant of a restockable product. Sold-out items have no waiting list. */
  readonly variantId: string;
  readonly productSlug: string;
}

/**
 * "Notify me" for an out-of-stock choice, or, once set, what happens next and
 * how to stop it. If the alerts can't be read, the button still works: the
 * backend returns an alert already waiting instead of adding a second one.
 */
export default function NotifyMeButton({ variantId, productSlug }: NotifyMeButtonProps): JSX.Element {
  const alerts = useAlerts();
  const create = useCreateAlert(productSlug);
  const cancel = useCancelAlert(productSlug);

  const waiting = alerts.data?.items.find((a) => a.variantId === variantId && a.status === "PENDING");
  // Until the list is read again, the alert just made stands in for it.
  const justCreated = create.isSuccess && create.variables === variantId ? create.data : undefined;
  const alertId = waiting?.id ?? justCreated;

  if (alerts.isPending && !alertId) {
    return <CircularProgress size={20} aria-label="Checking your alerts" />;
  }

  if (alertId) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
        <Typography variant="body2" role="status" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <BellIcon size={16} aria-hidden="true" />
          We&apos;ll email you when it&apos;s back in stock.
        </Typography>
        <Button
          size="small"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate(alertId, { onSuccess: () => create.reset() })}
        >
          {cancel.isPending ? "Stopping…" : "Stop notifying me"}
        </Button>
        {cancel.isError && <Alert severity="error">{messageFor(cancel.error)}</Alert>}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
      <Button
        variant="outlined"
        startIcon={create.isPending ? <CircularProgress size={16} color="inherit" /> : <BellIcon size={16} />}
        disabled={create.isPending}
        onClick={() => create.mutate(variantId, { onSuccess: () => cancel.reset() })}
      >
        {create.isPending ? "Saving…" : "Notify me"}
      </Button>
      {create.isError && create.variables === variantId && <Alert severity="error">{messageFor(create.error)}</Alert>}
    </Box>
  );
}
