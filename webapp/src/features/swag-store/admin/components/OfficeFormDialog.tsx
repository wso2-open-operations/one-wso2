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

import { useState, type FormEvent, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
} from "@wso2/oxygen-ui";
import type { SwagStoreAdminOffice, SwagStoreOfficeInput } from "../../api/swagStoreTypes";
import { messageFor } from "../../util/swagStoreError";
import { useSaveOffice } from "../api/useAdminMutations";

const EMPTY: SwagStoreOfficeInput = {
  name: "",
  address: "",
  country: "",
  collectionPoint: "",
  hours: "",
  leadTimeDays: 2,
  hrLocations: [],
  active: true,
  sort: 0,
};

/** An office's editable fields: everything but its id. */
function toInput(office: SwagStoreAdminOffice): SwagStoreOfficeInput {
  return {
    name: office.name,
    address: office.address,
    country: office.country,
    collectionPoint: office.collectionPoint,
    hours: office.hours,
    leadTimeDays: office.leadTimeDays,
    hrLocations: office.hrLocations,
    active: office.active,
    sort: office.sort,
  };
}

interface OfficeFormDialogProps {
  /** The office to edit, or undefined to add one. */
  readonly office?: SwagStoreAdminOffice;
  readonly onClose: () => void;
}

/**
 * Add or edit a pickup office. An edit sends the whole office back. The dialog
 * stays open and can't be closed while saving; the backend's refusal shows inline.
 */
export default function OfficeFormDialog({ office, onClose }: OfficeFormDialogProps): JSX.Element {
  const save = useSaveOffice();
  const [form, setForm] = useState<SwagStoreOfficeInput>(() => (office ? toInput(office) : EMPTY));
  const [locations, setLocations] = useState(() => (office?.hrLocations ?? []).join(", "));
  const title = office ? `Edit ${office.name}` : "Add office";
  const set = <K extends keyof SwagStoreOfficeInput>(field: K, value: SwagStoreOfficeInput[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const leadOk = Number.isInteger(form.leadTimeDays) && form.leadTimeDays >= 0 && form.leadTimeDays <= 60;
  const canSave = form.name.trim() !== "" && leadOk && !save.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const hrLocations = locations
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    const trimmed: SwagStoreOfficeInput = {
      ...form,
      name: form.name.trim(),
      address: form.address.trim(),
      country: form.country.trim(),
      collectionPoint: form.collectionPoint.trim(),
      hours: form.hours.trim(),
      hrLocations,
    };
    save.mutate({ id: office?.id, office: trimmed }, { onSuccess: onClose });
  };

  const text = (field: "name" | "address" | "country" | "collectionPoint" | "hours", label: string, required = false) => (
    <TextField
      label={label}
      size="small"
      required={required}
      value={form[field]}
      onChange={(e) => set(field, e.target.value)}
      slotProps={{ htmlInput: { maxLength: 200 } }}
    />
  );

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="swag-store-office-form">
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle id="swag-store-office-form">{title}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {text("name", "Name", true)}
          {text("address", "Address")}
          {text("country", "Country")}
          {text("collectionPoint", "Collection point")}
          {text("hours", "Hours")}
          <TextField
            label="Lead time (working days)"
            size="small"
            type="number"
            value={Number.isNaN(form.leadTimeDays) ? "" : form.leadTimeDays}
            onChange={(e) => set("leadTimeDays", e.target.value === "" ? Number.NaN : Number(e.target.value))}
            error={!leadOk}
            helperText={leadOk ? "From payment to ready for pickup." : "A whole number from 0 to 60."}
            slotProps={{ htmlInput: { min: 0, max: 60, step: 1 } }}
          />
          <TextField
            label="HR locations"
            size="small"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            helperText="Comma-separated. People in these HR locations get this office by default."
          />
          <FormControlLabel
            control={<Checkbox checked={form.active} onChange={(e) => set("active", e.target.checked)} />}
            label="Open for pickup"
          />
          {save.isError && <Alert severity="error">{messageFor(save.error)}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSave}
            startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
