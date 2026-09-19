// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import {
  EMPTY_UMT_UPDATE_FILTERS,
  draftFromFilters,
  filtersFromDraft,
  type UmtUpdateFilterDraft,
  type UmtUpdateFilters,
} from "../api/umtUpdates";

const LIFECYCLE_OPTIONS = [
  ["Hotfix", "HOTFIX_LIFECYCLE"],
  ["Update", "UPDATE_LIFECYCLE"],
  ["Security update", "SECURITY_UPDATE_LIFECYCLE"],
  ["Cloud support", "CLOUD_SUPPORT_LIFECYCLE"],
] as const;

const LIFECYCLE_STATE_OPTIONS = [
  ["Development", "Development"],
  ["PR analyzed", "PR_ANALYZED"],
  ["Product analyzed", "PRODUCT_ANALYZED"],
  ["Testing environment requested", "TESTING_ENVIRONMENT_REQUESTED"],
  ["Testing environment created", "TESTING_ENVIRONMENT_CREATED"],
  ["Testing environment failed", "TESTING_ENVIRONMENT_FAILED"],
  ["Demote staging requested", "DEMOTE_STAGING_REQUESTED"],
  ["Staging requested", "STAGING_REQUESTED"],
  ["Staging / Testing", "Staging"],
  ["Waiting file approval", "WAITING_FILE_APPROVAL"],
  ["UAT staging", "UAT_STAGING"],
  ["UAT requested", "UAT_REQUESTED"],
  ["UAT", "UAT"],
  ["Released", "RELEASED"],
  ["On hold", "ON_HOLD"],
  ["Duplicate", "DUPLICATE"],
] as const;

const ISSUE_TYPE_OPTIONS = [
  ["Bug", "BUG"],
  ["New feature", "NEW_FEATURE"],
  ["Improvement", "IMPROVEMENT"],
] as const;

export default function UmtUpdateFiltersDrawer({
  open,
  filters,
  onApply,
  onClose,
}: {
  open: boolean;
  filters: UmtUpdateFilters;
  onApply: (filters: UmtUpdateFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<UmtUpdateFilterDraft>(() => draftFromFilters(filters));
  // The drawer stays mounted while closed (only `open` toggles), so an
  // initializer-only useState never sees a `filters` change made while it
  // was closed (e.g. the page's own "Clear filters" button). `filters` only
  // ever gets a new reference from the page's own setState (on Apply or
  // Clear), never from an incidental re-render, so reseeding on identity
  // change here is a reliable signal, not a spurious one.
  const [lastFilters, setLastFilters] = useState(filters);
  if (filters !== lastFilters) {
    setLastFilters(filters);
    setDraft(draftFromFilters(filters));
  }
  const set = (key: keyof UmtUpdateFilterDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(filtersFromDraft(draft));
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 680 }, maxWidth: "100vw" } } }}
    >
      <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", borderBottom: 1, borderColor: "divider", px: 3, py: 2 }}
        >
          <Typography component="h2" variant="h6" sx={{ flex: 1 }}>Filter updates</Typography>
          <IconButton aria-label="Close filters" onClick={onClose}><XIcon size={18} /></IconButton>
        </Stack>

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, p: 3 }}>
          <Field label="ID" value={draft.id} onChange={(value) => set("id", value)} />
          <Field label="ServiceNow Case ID" value={draft.serviceNowCaseId} onChange={(value) => set("serviceNowCaseId", value)} />
          <Field label="Jira ID" value={draft.jiraId} onChange={(value) => set("jiraId", value)} />
          <SelectField label="Type" value={draft.type} options={[["Update", "0"], ["Hotfix", "1"]]} onChange={(value) => set("type", value)} />
          <SelectField label="Issue type" value={draft.issueType} options={ISSUE_TYPE_OPTIONS} onChange={(value) => set("issueType", value)} />
          <SelectField label="Lifecycle state" value={draft.lifecycleState} options={LIFECYCLE_STATE_OPTIONS} onChange={(value) => set("lifecycleState", value)} />
          <SelectField label="Lifecycle" value={draft.lifecycle} options={LIFECYCLE_OPTIONS} onChange={(value) => set("lifecycle", value)} />
          <Field label="Product name" value={draft.productName} onChange={(value) => set("productName", value)} />
          <Field label="Product version" value={draft.productVersion} onChange={(value) => set("productVersion", value)} />
          <Field label="Assignee" value={draft.assignee} onChange={(value) => set("assignee", value)} />
          <Field full label="Internal GitHub issue" value={draft.internalGitIssue} onChange={(value) => set("internalGitIssue", value)} />
          <Field full label="Security internal GitHub issue" value={draft.securityInternalGitIssue} onChange={(value) => set("securityInternalGitIssue", value)} />
          <Field label="Security advisory" value={draft.securityAdvisory} onChange={(value) => set("securityAdvisory", value)} />
          <Field label="Pull request" value={draft.pullRequest} onChange={(value) => set("pullRequest", value)} />
          <Field full label="Public GitHub issue" value={draft.issue} onChange={(value) => set("issue", value)} />
          <Field full label="Artifact" value={draft.artifacts} onChange={(value) => set("artifacts", value)} />
          <DateField label="Public PR modified after" value={draft.lastUpdatedTimestampAfter} onChange={(value) => set("lastUpdatedTimestampAfter", value)} />
          <DateField label="Released without public PR" value={draft.releasedWithoutPublicPR} onChange={(value) => set("releasedWithoutPublicPR", value)} />
          <DateField label="Released date" value={draft.releasedDate} onChange={(value) => set("releasedDate", value)} />
        </Box>

        <Stack
          direction="row"
          spacing={1.5}
          sx={{ bgcolor: "background.paper", borderTop: 1, borderColor: "divider", justifyContent: "flex-end", mt: "auto", p: 2 }}
        >
          <Button variant="text" onClick={() => setDraft(draftFromFilters(EMPTY_UMT_UPDATE_FILTERS))}>Reset</Button>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button variant="contained" type="submit">Apply filters</Button>
        </Stack>
      </Box>
    </Drawer>
  );
}

function Field({ label, value, onChange, full = false }: { label: string; value: string; onChange: (value: string) => void; full?: boolean }) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      size="small"
      sx={full ? { gridColumn: { sm: "1 / -1" } } : undefined}
    />
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  return (
    <TextField select label={label} value={value} onChange={(event) => onChange(event.target.value)} size="small">
      <MenuItem value=""><em>Any</em></MenuItem>
      {options.map(([optionLabel, optionValue]) => <MenuItem key={optionValue} value={optionValue}>{optionLabel}</MenuItem>)}
    </TextField>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <TextField
      label={label}
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      size="small"
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}
