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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { humanizeHttpError } from "@api/http";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { EmployeePersonalInfo, UpdatePersonalInfoPayload } from "../api/types";
import { ageFromDob, display, formatDate } from "../api/derive";
import { useUpdatePersonalInfo } from "../api/useUpdatePersonalInfo";
import EditToggle from "./EditToggle";
import FieldGrid, { type FieldDef } from "./FieldGrid";

// Scalar fields the current (non-admin) user can update via PATCH
// /employees/{id}/personal-info. Emergency contacts live in their own
// component (EmergencyContacts.tsx) which hits the same endpoint but only
// sends the emergencyContacts field.
type EditableKey =
  | "personalEmail"
  | "personalPhone"
  | "residentNumber"
  | "postalCode"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "stateOrProvince"
  | "country";

type FormState = Record<EditableKey, string>;

// Personal info block. Identity fields (admin-only) sit up top labelled
// "Personal details (restricted)". Contact/address flips between a
// read-only FieldGrid and controlled text inputs via the top-right Edit /
// Cancel edit toggle. Save/Discard bar at the bottom in edit mode.
//
// `viewOnly` renders the card without any way into edit mode — used by the
// People Ops employee detail page, which shows a colleague's profile. Named
// `viewOnly` rather than `readOnly` only because a local `readOnly` field
// list already exists below and shadowing it would read badly.
export default function PersonalInfo({
  personalInfo,
  employeeId,
  isLoading,
  viewOnly = false,
}: {
  personalInfo?: EmployeePersonalInfo;
  employeeId?: string;
  isLoading?: boolean;
  viewOnly?: boolean;
}) {
  const initial = useMemo<FormState>(() => toFormState(personalInfo), [personalInfo]);
  const [form, setForm] = useState<FormState>(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdatePersonalInfo(employeeId);
  const { showSuccess, showError } = useNotifications();

  // Outside an edit, the form follows the latest saved details.
  const [prevInitial, setPrevInitial] = useState(initial);
  const [prevEditing, setPrevEditing] = useState(editing);
  if (prevInitial !== initial || prevEditing !== editing) {
    setPrevInitial(initial);
    setPrevEditing(editing);
    if (!editing) setForm(initial);
  }

  if (!personalInfo) {
    return (
      <Card variant="outlined" sx={{ p: 2 }}>
        {isLoading ? (
          <Stack spacing={1.5}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={38} sx={{ borderRadius: 1 }} />
            ))}
          </Stack>
        ) : (
          <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1 }}>
            Personal information isn't available for your account right now.
          </Typography>
        )}
      </Card>
    );
  }

  const p = personalInfo;
  const isDirty = !stateEqual(form, initial);
  const validation = validate(form);
  const hasValidationError = Object.values(validation).some(Boolean);
  const canSave = editing && isDirty && !hasValidationError && !mutation.isPending && Boolean(employeeId);

  const enterEdit = () => {
    setForm(initial);
    setError(null);
    setEditing(true);
  };
  const discardEdit = () => {
    setForm(initial);
    setError(null);
    setEditing(false);
  };
  const submit = () => {
    if (!canSave) return;
    setError(null);
    mutation.mutate(buildPatch(initial, form), {
      onSuccess: () => {
        setEditing(false);
        showSuccess("Personal information updated");
      },
      onError: (err) => {
        const msg = humanizeHttpError(err);
        setError(msg);
        showError(msg);
      },
    });
  };

  const readOnly: FieldDef[] = [
    { label: "Title", value: display(p.title) },
    { label: "First name", value: display(p.firstName) },
    { label: "Last name", value: display(p.lastName) },
    { label: "Full name", value: display(p.fullName) },
    { label: "NIC", value: display(p.nicOrPassport) },
    { label: "Date of birth", value: formatDate(p.dob) },
    { label: "Age", value: ageFromDob(p.dob) },
    { label: "Gender", value: display(p.gender) },
    { label: "Nationality", value: display(p.nationality) },
  ];

  const setScalar = (key: EditableKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Card variant="outlined" sx={{ p: 2, position: "relative" }}>
      {!viewOnly && (
        <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
          <EditToggle
            editing={editing}
            onEnter={enterEdit}
            onCancel={discardEdit}
            canEdit={Boolean(employeeId)}
            pending={mutation.isPending}
          />
        </Box>
      )}
      {editing && (
        <Typography sx={{ fontSize: 11, color: "primary.dark", fontStyle: "italic", mb: 0.75 }}>
          Identity fields (name, DOB, gender, nationality, NIC) are managed by the people operations team.
        </Typography>
      )}
      <FieldGrid fields={readOnly} />

      <Box sx={{ mt: 2.25 }}>
        {editing ? (
          <EditableGrid form={form} onScalarChange={setScalar} validation={validation} />
        ) : (
          <ReadOnlyContactGrid form={form} />
        )}
      </Box>

      {editing && (
        <>
          {error && (
            <Alert severity="error" sx={{ mt: 2, fontSize: 12.5 }}>
              {error}
            </Alert>
          )}
          <Stack
            direction="row"
            spacing={1}
            justifyContent="flex-end"
            sx={{ mt: 2.25, pt: 1.75, borderTop: 1, borderColor: "divider" }}
          >
            <Button variant="outlined" size="small" onClick={discardEdit} disabled={mutation.isPending}>
              Discard changes
            </Button>
            <Button variant="contained" size="small" onClick={submit} disabled={!canSave}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </Stack>
        </>
      )}
    </Card>
  );
}

// ---- helpers ---------------------------------------------------------------

function toFormState(p?: EmployeePersonalInfo): FormState {
  return {
    personalEmail: p?.personalEmail ?? "",
    personalPhone: p?.personalPhone ?? "",
    residentNumber: p?.residentNumber ?? "",
    postalCode: p?.postalCode ?? "",
    addressLine1: p?.addressLine1 ?? "",
    addressLine2: p?.addressLine2 ?? "",
    city: p?.city ?? "",
    stateOrProvince: p?.stateOrProvince ?? "",
    country: p?.country ?? "",
  };
}

function stateEqual(a: FormState, b: FormState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Only send fields that actually changed. Cleared values → null so the
// backend nullable column takes the update; unchanged values are omitted.
function buildPatch(initial: FormState, current: FormState): UpdatePersonalInfoPayload {
  const patch: UpdatePersonalInfoPayload = {};
  const keys: EditableKey[] = [
    "personalEmail",
    "personalPhone",
    "residentNumber",
    "postalCode",
    "addressLine1",
    "addressLine2",
    "city",
    "stateOrProvince",
    "country",
  ];
  for (const key of keys) {
    const before = (initial[key] ?? "").trim();
    const after = (current[key] ?? "").trim();
    if (before === after) continue;
    patch[key] = after === "" ? null : after;
  }
  return patch;
}

// Client-side patterns match the backend's regex constraints — backend
// still has the final say and any 4xx message is surfaced verbatim.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{5,}$/;

interface ValidationErrors {
  personalEmail?: string;
  personalPhone?: string;
  residentNumber?: string;
}

function validate(f: FormState): ValidationErrors {
  const errors: ValidationErrors = {};
  if (f.personalEmail.trim() && !EMAIL_RE.test(f.personalEmail.trim()))
    errors.personalEmail = "Enter a valid email address";
  if (f.personalPhone.trim() && !PHONE_RE.test(f.personalPhone.trim()))
    errors.personalPhone = "Enter a valid phone number";
  if (f.residentNumber.trim() && !PHONE_RE.test(f.residentNumber.trim()))
    errors.residentNumber = "Enter a valid resident number";
  return errors;
}


// ---- subcomponents ---------------------------------------------------------

function EditableGrid({
  form,
  onScalarChange,
  validation,
}: {
  form: FormState;
  onScalarChange: (key: EditableKey) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  validation: ValidationErrors;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        gap: "14px 22px",
      }}
    >
      <LabelledInput label="Personal email" value={form.personalEmail} onChange={onScalarChange("personalEmail")} error={validation.personalEmail} />
      <LabelledInput label="Personal phone" value={form.personalPhone} onChange={onScalarChange("personalPhone")} error={validation.personalPhone} />
      <LabelledInput label="Resident number" value={form.residentNumber} onChange={onScalarChange("residentNumber")} error={validation.residentNumber} />
      <LabelledInput label="Postal code" value={form.postalCode} onChange={onScalarChange("postalCode")} />
      <LabelledInput label="Address line 1" value={form.addressLine1} onChange={onScalarChange("addressLine1")} span={2} />
      <LabelledInput label="Address line 2" value={form.addressLine2} onChange={onScalarChange("addressLine2")} span={2} />
      <LabelledInput label="City" value={form.city} onChange={onScalarChange("city")} />
      <LabelledInput label="State / province" value={form.stateOrProvince} onChange={onScalarChange("stateOrProvince")} />
      <LabelledInput label="Country" value={form.country} onChange={onScalarChange("country")} />
    </Box>
  );
}

function ReadOnlyContactGrid({ form }: { form: FormState }) {
  const rows: FieldDef[] = [
    { label: "Personal email", value: display(form.personalEmail) },
    { label: "Personal phone", value: display(form.personalPhone) },
    { label: "Resident number", value: display(form.residentNumber) },
    { label: "Postal code", value: display(form.postalCode) },
    { label: "Address line 1", value: display(form.addressLine1), span: 2 },
    { label: "Address line 2", value: display(form.addressLine2), span: 2 },
    { label: "City", value: display(form.city) },
    { label: "State / province", value: display(form.stateOrProvince) },
    { label: "Country", value: display(form.country) },
  ];
  return <FieldGrid fields={rows} />;
}

function LabelledInput({
  label,
  value,
  onChange,
  span,
  error,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  span?: 1 | 2;
  error?: string;
}) {
  return (
    <Box sx={{ gridColumn: span === 2 ? "span 2" : undefined }}>
      <Typography
        sx={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "text.disabled",
          fontWeight: 600,
          mb: 0.375,
        }}
      >
        {label}
      </Typography>
      <TextField
        size="small"
        fullWidth
        value={value}
        onChange={onChange}
        error={Boolean(error)}
        helperText={error}
      />
    </Box>
  );
}
