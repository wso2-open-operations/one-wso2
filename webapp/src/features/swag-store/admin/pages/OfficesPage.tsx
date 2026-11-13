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

import { useState, type JSX } from "react";
import {
  Box,
  Button,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreAdminOffice } from "../../api/swagStoreTypes";
import TintedChip from "../../components/TintedChip";
import { useAdminOffices } from "../api/useAdminData";
import OfficeFormDialog from "../components/OfficeFormDialog";

/** `/people-ops/swag-store/settings/offices`: where orders can be collected, for fulfilment ops. */
export default function OfficesPage(): JSX.Element {
  useDocumentTitle("Pickup offices · Swag Store");
  const offices = useAdminOffices();
  // undefined: closed; null: adding; an office: editing it.
  const [editing, setEditing] = useState<SwagStoreAdminOffice | null | undefined>(undefined);

  let body: JSX.Element;
  if (offices.isPending) {
    body = <Skeleton variant="rounded" height={200} aria-label="Loading the offices" />;
  } else if (offices.isError) {
    body = (
      <ErrorNotice onRetry={() => void offices.refetch()} retrying={offices.isFetching} error={offices.error}>
        Couldn&apos;t load the offices.
      </ErrorNotice>
    );
  } else if (offices.data.length === 0) {
    body = <Typography color="text.secondary">There are no pickup offices yet. Add the first one.</Typography>;
  } else {
    body = (
      <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
        <Table size="small" aria-label="Pickup offices">
          <TableHead>
            <TableRow>
              <TableCell>Office</TableCell>
              <TableCell>Country</TableCell>
              <TableCell>Collection point</TableCell>
              <TableCell>Lead time</TableCell>
              <TableCell>HR locations</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">
                <Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                  Actions
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {offices.data.map((o) => (
              <TableRow key={o.id}>
                <TableCell sx={{ fontWeight: 600 }}>{o.name}</TableCell>
                <TableCell>{o.country || "—"}</TableCell>
                <TableCell>{o.collectionPoint || "—"}</TableCell>
                <TableCell>{o.leadTimeDays === 1 ? "1 day" : `${o.leadTimeDays} days`}</TableCell>
                <TableCell>{o.hrLocations.length > 0 ? o.hrLocations.join(", ") : "—"}</TableCell>
                <TableCell>
                  <TintedChip color={o.active ? "success" : "default"} label={o.active ? "Active" : "Inactive"} />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setEditing(o)} aria-label={`Edit ${o.name}`}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    );
  }

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
        Swag Store · Settings
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Typography component="h1" variant="h5" sx={{ m: 0 }}>
          Pickup offices
        </Typography>
        <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setEditing(null)}>
          Add office
        </Button>
      </Box>
      {body}
      {editing !== undefined && (
        // Keyed by office, so each opening starts from that office's saved values.
        <OfficeFormDialog key={editing?.id ?? "new"} office={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}
    </Box>
  );
}
