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
import { Link as RouterLink } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  type ChipProps,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreAlert, SwagStoreAlertStatus } from "../../api/swagStoreTypes";
import TintedChip from "../../components/TintedChip";
import { swagStorePaths } from "../../swagStorePaths";
import { formatInstant } from "../../util/civilDate";
import { messageFor } from "../../util/swagStoreError";
import { useAlerts, useCancelAlert } from "../api/useAlerts";

const STATUS: Record<SwagStoreAlertStatus, { label: string; color: ChipProps["color"] }> = {
  PENDING: { label: "Waiting", color: "info" },
  NOTIFIED: { label: "Back in stock", color: "success" },
  CLOSED: { label: "Closed", color: "default" },
};

/** `/store/alerts`: the shopper's "Notify me" alerts, and a way to stop the waiting ones. */
export default function AlertsPage(): JSX.Element {
  useDocumentTitle("Stock alerts · Swag Store");
  const alerts = useAlerts();
  const cancel = useCancelAlert();

  let body: JSX.Element;
  if (alerts.isPending) {
    body = <Skeleton variant="rounded" height={160} aria-label="Loading your alerts" />;
  } else if (alerts.isError) {
    body = (
      <ErrorNotice onRetry={() => void alerts.refetch()} retrying={alerts.isFetching} error={alerts.error}>
        Couldn&apos;t load your alerts.
      </ErrorNotice>
    );
  } else if (alerts.data.items.length === 0) {
    body = (
      <Box sx={{ py: 6, display: "grid", justifyItems: "center", gap: 1.5, textAlign: "center" }}>
        <Typography>You have no stock alerts.</Typography>
        <Typography variant="body2" color="text.secondary">
          On an item that&apos;s out of stock, choose Notify me and we&apos;ll email you when it&apos;s back.
        </Typography>
        <Button component={RouterLink} to={swagStorePaths.shop} variant="outlined">
          Browse the store
        </Button>
      </Box>
    );
  } else {
    body = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {cancel.isError && <Alert severity="error">Couldn&apos;t remove the alert. {messageFor(cancel.error)}</Alert>}
        <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
          <Table size="small" aria-label="Stock alerts">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Option</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Added</TableCell>
                <TableCell align="right">
                  <Box component="span" sx={visuallyHidden}>
                    Actions
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.data.items.map((a) => (
                <AlertRow
                  key={a.id}
                  alert={a}
                  removing={cancel.isPending && cancel.variables === a.id}
                  onRemove={() => cancel.mutate(a.id)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mt: 0, mb: 0.5 }}>
        Stock alerts
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "70ch", mb: 2 }}>
        We email you once when an item you asked about is back in stock. Sold-out items won&apos;t come back, so
        they have no waiting list.
      </Typography>
      {body}
    </Box>
  );
}

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

function AlertRow({ alert, removing, onRemove }: { alert: SwagStoreAlert; removing: boolean; onRemove: () => void }): JSX.Element {
  const status = STATUS[alert.status] ?? { label: alert.status, color: "default" as const };
  const what = alert.options ? `${alert.productName}, ${alert.options}` : alert.productName;
  return (
    <TableRow>
      <TableCell>
        <Link component={RouterLink} to={swagStorePaths.product(alert.productSlug)} sx={{ fontWeight: 600 }}>
          {alert.productName}
        </Link>
      </TableCell>
      <TableCell>{alert.options || "—"}</TableCell>
      <TableCell>
        <TintedChip color={status.color} label={status.label} />
      </TableCell>
      <TableCell>{formatInstant(alert.createdAt)}</TableCell>
      <TableCell align="right">
        {alert.status === "PENDING" && (
          <Button size="small" onClick={onRemove} disabled={removing} aria-label={`Remove the alert for ${what}`}>
            {removing ? "Removing…" : "Remove"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
