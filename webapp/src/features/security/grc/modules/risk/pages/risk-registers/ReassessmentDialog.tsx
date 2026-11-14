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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseDateOnly, toDateOnlyString } from "@features/security/grc/utils/dateTime";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { originalPlanHelp } from "./utils";
import {
  AdapterDateFns,
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  DatePickers,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { JSX } from "react";
import {
  fetchManagementApprovers,
  fetchRiskAssignerCandidates,
  fetchRiskOwnerCandidates,
  resolveUserByEmail,
  searchEmployees,
  suggestLikelihood,
} from "../../api/riskApi";
import type {
  CreateAssessmentPayload,
  EmployeeOption,
  RiskDetail,
  RiskScore,
  RiskScoreInfo,
  UserOption,
} from "../../api/riskApi";
import { dialogPaperSx } from "../cardStyles";
import RiskScoreGrid from "./RiskScoreGrid";

const { DatePicker, LocalizationProvider } = DatePickers;

// Minimum characters before searching — matches the backend's own floor.
const MIN_EMPLOYEE_SEARCH_LEN = 2;
const EMPLOYEE_SEARCH_DEBOUNCE_MS = 300;

// withCurrent keeps the risk's saved person selectable even when they are not
// among today's candidates, so opening the dialog never silently blanks a field.
function withCurrent(candidates: UserOption[], id: number, name: string): UserOption[] {
  if (!id || candidates.some((u) => u.id === id)) return candidates;
  return [...candidates, { id, display_name: name || `User #${id}`, email: "", risk_team_ids: [] }];
}

interface ReassessmentDialogProps {
  open: boolean;
  riskCode: string;
  // The risk being assessed — source of the current owner, approver,
  // assigner, action owner and implementation date the "Risk details" section
  // starts from.
  detail: RiskDetail;
  // Only used to show the current Action Owner's name — RiskDetail carries the
  // action owner's id but not their name.
  users: UserOption[];
  // True for the risk's Risk Assigner (or a compliance admin). Only they may
  // change these details; everyone else sees them read-only. The backend
  // enforces the same rule.
  canEditRiskDetails: boolean;
  // True only when the current user is this risk's Risk Assigner. A compliance
  // admin can edit the details too but keeps that right after handing the risk
  // on, so the hand-off warning is for the assigner alone.
  isRiskAssigner: boolean;
  riskScores: RiskScore[];
  // The risk's residual score before this assessment — RiskDetail.effective_score,
  // i.e. the latest reassessment if one exists, else the gross score. Null only
  // when the caller has no detail loaded yet.
  previousScore: RiskScoreInfo | null;
  // True when previousScore is actually the gross score (no reassessment has
  // ever been recorded) — worded "Initial" rather than "Previous" since it
  // isn't a residual assessment at all.
  previousIsInitial: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAssessmentPayload) => Promise<void>;
}

export default function ReassessmentDialog({
  open,
  riskCode,
  detail,
  users,
  canEditRiskDetails,
  isRiskAssigner,
  riskScores,
  previousScore,
  previousIsInitial,
  onClose,
  onSubmit,
}: ReassessmentDialogProps): JSX.Element {
  const authFetch = useAuthApiClient();
  const [likelihood, setLikelihood] = useState(0);
  const [impact, setImpact] = useState(0);
  const [progress, setProgress] = useState("");
  const [reassessmentDate, setReassessmentDate] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const [ownerId, setOwnerId] = useState(detail.owner_id);
  const [managementApproverId, setManagementApproverId] = useState(detail.management_approver_id);
  const [assignerId, setAssignerId] = useState(detail.assigner_id);
  const [implementationDate, setImplementationDate] = useState<Date | null>(parseDateOnly(detail.implementation_date));
  const [assignerCandidates, setAssignerCandidates] = useState<UserOption[]>([]);
  const [ownerCandidates, setOwnerCandidates] = useState<UserOption[]>([]);
  const [approverCandidates, setApproverCandidates] = useState<UserOption[]>([]);
  const [candidatesError, setCandidatesError] = useState(false);

  // Action Owner can be any employee, searched live against the HR entity and
  // resolved to a user id on selection — same as Update Assignees.
  const currentActionOwnerId = detail.action_plan?.action_owner_id ?? null;
  const [actionOwnerId, setActionOwnerId] = useState<number | null>(currentActionOwnerId);
  const [actionOwnerOptions, setActionOwnerOptions] = useState<EmployeeOption[]>([]);
  const currentActionOwnerOption = useMemo<EmployeeOption | null>(() => {
    const u = users.find((x) => x.id === currentActionOwnerId);
    return u ? { name: u.display_name, email: u.email } : null;
  }, [users, currentActionOwnerId]);
  const [actionOwnerSelected, setActionOwnerSelected] = useState<EmployeeOption | null>(currentActionOwnerOption);
  const [actionOwnerSearchLoading, setActionOwnerSearchLoading] = useState(false);
  const [actionOwnerResolving, setActionOwnerResolving] = useState(false);
  const [actionOwnerError, setActionOwnerError] = useState<string | null>(null);
  const actionOwnerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every pick or clear, so a slower lookup for an earlier pick can
  // never overwrite a later one.
  const actionOwnerRequest = useRef(0);

  const runActionOwnerSearch = useCallback((query: string) => {
    if (query.trim().length < MIN_EMPLOYEE_SEARCH_LEN) {
      setActionOwnerOptions([]);
      setActionOwnerError(null);
      return;
    }
    setActionOwnerSearchLoading(true);
    setActionOwnerError(null);
    searchEmployees(authFetch, query)
      .then(setActionOwnerOptions)
      .catch(() => {
        setActionOwnerOptions([]);
        setActionOwnerError("Unable to reach the employee directory. Please try again.");
      })
      .finally(() => setActionOwnerSearchLoading(false));
  }, [authFetch]);

  const handleActionOwnerInputChange = (value: string): void => {
    if (actionOwnerDebounce.current) clearTimeout(actionOwnerDebounce.current);
    actionOwnerDebounce.current = setTimeout(() => runActionOwnerSearch(value), EMPLOYEE_SEARCH_DEBOUNCE_MS);
  };

  // Start from the risk as it is each time the dialog opens on it.
  useEffect(() => {
    if (!open) return;
    setOwnerId(detail.owner_id);
    setManagementApproverId(detail.management_approver_id);
    setAssignerId(detail.assigner_id);
    setImplementationDate(parseDateOnly(detail.implementation_date));
    setActionOwnerId(detail.action_plan?.action_owner_id ?? null);
    setActionOwnerSelected(currentActionOwnerOption);
    setActionOwnerError(null);
    // A lookup still pending from a previous opening must not land on this one.
    actionOwnerRequest.current++;
    setActionOwnerResolving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens on a risk; re-running when the users list arrives would wipe the user's unsaved picks
  }, [open, detail]);

  // Fill in the current Action Owner's name if the users list lands after the
  // dialog opened, without touching a replacement the user already picked.
  useEffect(() => {
    setActionOwnerSelected((selected) => selected ?? currentActionOwnerOption);
  }, [currentActionOwnerOption]);

  // Candidates are role-filtered as in Add Risk and Update Assignees, so only
  // someone who already holds the grant can be picked. Only the assigner can
  // change them, so nobody else needs the lists. The assigner list is scoped to
  // the source register, as in Update Assignees.
  useEffect(() => {
    if (!open || !canEditRiskDetails) return;
    let cancelled = false;
    const teamIds = [detail.source_register_id, detail.assignment_team_id];
    setCandidatesError(false);
    void Promise.allSettled([
      fetchRiskOwnerCandidates(authFetch, teamIds),
      fetchManagementApprovers(authFetch, teamIds),
      fetchRiskAssignerCandidates(authFetch, [detail.source_register_id]),
    ]).then(([owners, approvers, assigners]) => {
      if (cancelled) return;
      if (owners.status !== "fulfilled" || approvers.status !== "fulfilled" || assigners.status !== "fulfilled") {
        setCandidatesError(true);
        return;
      }
      setOwnerCandidates(owners.value);
      setApproverCandidates(approvers.value);
      setAssignerCandidates(assigners.value);
    });
    return () => { cancelled = true; };
  }, [open, canEditRiskDetails, authFetch, detail.source_register_id, detail.assignment_team_id]);

  const ownerOptions = withCurrent(ownerCandidates, detail.owner_id, detail.owner_name);
  const assignerOptions = withCurrent(assignerCandidates, detail.assigner_id, detail.assigner_name);
  const approverOptions = withCurrent(approverCandidates, detail.management_approver_id, detail.management_approver_name);
  const currentImplementationDate = toDateOnlyString(parseDateOnly(detail.implementation_date));

  // A reassessment that makes the risk HIGH needs a Management Approver — the
  // one it already has or one picked here. 0 means none. The backend enforces
  // the same rule.
  const becomesHigh =
    likelihood > 0 &&
    impact > 0 &&
    riskScores.find((sc) => sc.likelihood === likelihood && sc.impact === impact)?.risk_level === "HIGH";
  const approverMissing = becomesHigh && !managementApproverId;

  // ── Suggest Likelihood ─────────────────────────────────────────────────
  // Explicit button only — same reasoning as every other "Suggest" button in
  // this feature (Category, the Add Risk flow's Likelihood suggestion).
  const [suggestion, setSuggestion] = useState<{
    score: number;
    reason: string;
    confidence: "high" | "medium" | "low";
  } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // A risk whose category was later archived/deleted has an empty
  // risk_categories array — suggestLikelihood needs a real category id, so
  // the button stays disabled rather than silently sending category_id: 0.
  const canSuggestLikelihood = detail.risk_categories.length > 0;

  const handleSuggestLikelihood = useCallback(async () => {
    const categoryId = detail.risk_categories[0]?.id;
    if (categoryId == null) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestLikelihood(
        authFetch,
        detail.risk_title,
        detail.risk_description,
        detail.impact_description ?? "",
        detail.compliance_references.map((r) => r.id),
        categoryId,
        detail.source_register_id,
      );
      setSuggestion(result);
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : undefined;
      setSuggestError(
        status === 404
          ? "AI likelihood suggestions aren't enabled yet."
          : `Couldn't get a suggestion${message ? `: ${message}` : ""} — please pick a score manually.`,
      );
    } finally {
      setSuggesting(false);
    }
  }, [authFetch, detail]);

  const handleClose = () => {
    if (submitting) return;
    setLikelihood(0);
    setImpact(0);
    setProgress("");
    setReassessmentDate(null);
    setOwnerId(detail.owner_id);
    setManagementApproverId(detail.management_approver_id);
    setAssignerId(detail.assigner_id);
    setImplementationDate(parseDateOnly(detail.implementation_date));
    setActionOwnerId(currentActionOwnerId);
    setActionOwnerSelected(currentActionOwnerOption);
    setActionOwnerError(null);
    // Drop a lookup still in flight, so it can't overwrite the reset owner.
    actionOwnerRequest.current++;
    setActionOwnerResolving(false);
    setErrors({});
    setApiError("");
    setSuggestion(null);
    setSuggestError(null);
    onClose();
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!likelihood || !impact) e.grid = "Please select a residual risk score from the grid.";
    if (!progress.trim()) e.progress = "Progress is required.";
    if (!reassessmentDate) {
      e.reassessmentDate = "Reassessment date is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (reassessmentDate < today) e.reassessmentDate = "Reassessment date cannot be in the past.";
    }
    if (approverMissing) {
      e.approver = canEditRiskDetails
        ? "A Management Approver is required for a HIGH risk."
        : "A Management Approver is required for a HIGH risk. Ask the Risk Assigner to set it.";
    }
    // Only a date the assigner actually changed is checked: an untouched,
    // already-past implementation date (an overdue risk) must not block saving.
    if (canEditRiskDetails) {
      if (!implementationDate) {
        // Clearing is not supported: the payload would omit it and the old date would silently stay.
        if (currentImplementationDate) e.implementationDate = "Implementation date is required.";
      } else if (Number.isNaN(implementationDate.getTime())) {
        e.implementationDate = "Enter a valid implementation date.";
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (toDateOnlyString(implementationDate) !== currentImplementationDate && implementationDate < today) {
          e.implementationDate = "Implementation date cannot be in the past.";
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError("");
    try {
      const payload: CreateAssessmentPayload = {
        likelihood,
        impact,
        progress: progress.trim(),
        reassessment_date: toDateOnlyString(reassessmentDate)!,
      };
      // Only when the user asked for a suggestion — the key is otherwise left
      // out of the request entirely.
      if (suggestion) payload.ai_likelihood_suggestion = suggestion;
      // Only what changed, and only from the assigner — the backend refuses
      // anyone else who sends them.
      if (canEditRiskDetails) {
        if (ownerId !== detail.owner_id) payload.owner_id = ownerId;
        if (managementApproverId !== detail.management_approver_id) payload.management_approver_id = managementApproverId;
        if (assignerId !== detail.assigner_id) payload.assigner_id = assignerId;
        if (actionOwnerId !== null && actionOwnerId !== currentActionOwnerId) payload.action_owner_id = actionOwnerId;
        const nextDate = toDateOnlyString(implementationDate);
        if (nextDate && nextDate !== currentImplementationDate) payload.implementation_date = nextDate;
      }
      await onSubmit(payload);
      handleClose();
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle>
        <Typography component="span" variant="h6" fontWeight={700} display="block">
          Reassess Risk
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary" display="block">
          {riskCode} : Record a residual risk assessment
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack gap={3} sx={{ pt: 1 }}>
          {apiError && <Alert severity="error">{apiError}</Alert>}

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
              <Typography variant="body2" fontWeight={600}>
                Residual Risk Score <span style={{ color: "red" }}>*</span>
              </Typography>
              <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
                {previousScore && (
                  <Typography variant="caption" color="text.secondary">
                    {previousIsInitial ? "Initial" : "Previous"}:{" "}
                    <strong>{previousScore.risk_level}</strong> · Score {previousScore.risk_rating}
                  </Typography>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSuggestLikelihood}
                  disabled={suggesting || submitting || !canSuggestLikelihood}
                  startIcon={suggesting ? <CircularProgress size={14} /> : undefined}
                >
                  {suggesting ? "Suggesting…" : "Suggest Likelihood"}
                </Button>
              </Stack>
            </Stack>

            {suggestError && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                {suggestError}
              </Alert>
            )}
            {!suggestError && suggestion && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                <Typography variant="body2">
                  <strong>Suggested Likelihood: {suggestion.score}</strong> ({suggestion.confidence}{" "}
                  confidence): {suggestion.reason}. The highlighted row below is the suggestion — pick
                  the cell in that row matching this risk's Impact.
                </Typography>
              </Alert>
            )}

            <RiskScoreGrid
              riskScores={riskScores}
              likelihood={likelihood}
              impact={impact}
              onChange={(l, i) => {
                setLikelihood(l);
                setImpact(i);
                if (errors.grid) setErrors((prev) => ({ ...prev, grid: "" }));
              }}
              error={errors.grid}
              suggestedLikelihood={suggestion?.score}
              previousLikelihood={previousScore?.likelihood}
              previousImpact={previousScore?.impact}
            />
          </Box>

          <Divider />

          <TextField
            label="Progress"
            multiline
            rows={3}
            fullWidth
            required
            value={progress}
            onChange={(e) => {
              setProgress(e.target.value);
              if (errors.progress) setErrors((prev) => ({ ...prev, progress: "" }));
            }}
            error={!!errors.progress}
            helperText={errors.progress}
            placeholder="Describe the current remediation progress..."
            disabled={submitting}
          />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Reassessment Date *"
              value={reassessmentDate}
              onChange={(d) => {
                setReassessmentDate(d);
                if (errors.reassessmentDate) setErrors((prev) => ({ ...prev, reassessmentDate: "" }));
              }}
              disablePast
              slotProps={{
                desktopPaper: {
                  sx: {
                    backdropFilter: "none",
                    backgroundColor: "var(--oxygen-palette-background-default)",
                  },
                },
                textField: {
                  fullWidth: true,
                  error: !!errors.reassessmentDate,
                  helperText: errors.reassessmentDate,
                  disabled: submitting,
                },
              }}
            />
          </LocalizationProvider>

          <Divider />

          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
              Risk details
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              {canEditRiskDetails
                ? "Changes here are saved with the assessment and don't send the risk for re-approval."
                : "Only the Risk Assigner can change these."}
            </Typography>
            <Stack gap={2}>
              {candidatesError && (
                <Alert severity="error">
                  Unable to load the Risk Owner, Risk Assigner and Management Approver candidates. Close the dialog and try again.
                </Alert>
              )}
              <FormControl fullWidth disabled={submitting || !canEditRiskDetails}>
                <InputLabel id="assess-risk-owner-label">Risk Owner</InputLabel>
                <Select labelId="assess-risk-owner-label" label="Risk Owner" value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))}>
                  {ownerOptions.map((u) => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth disabled={submitting || !canEditRiskDetails}>
                <InputLabel id="assess-risk-assigner-label">Risk Assigner</InputLabel>
                <Select labelId="assess-risk-assigner-label" label="Risk Assigner" value={assignerId} onChange={(e) => setAssignerId(Number(e.target.value))}>
                  {assignerOptions.map((u) => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}
                </Select>
                {isRiskAssigner && assignerId !== detail.assigner_id && (
                  <FormHelperText>You will no longer be able to change this risk's details once it is saved.</FormHelperText>
                )}
              </FormControl>
              <FormControl fullWidth disabled={submitting || !canEditRiskDetails} error={!!errors.approver || approverMissing}>
                <InputLabel id="assess-management-approver-label">Management Approver</InputLabel>
                <Select
                  labelId="assess-management-approver-label"
                  label="Management Approver"
                  value={managementApproverId}
                  onChange={(e) => {
                    setManagementApproverId(Number(e.target.value));
                    if (errors.approver) setErrors((prev) => ({ ...prev, approver: "" }));
                  }}
                >
                  {/* A LOW/MEDIUM risk may have none; it cannot be re-picked once chosen. */}
                  {!detail.management_approver_id && <MenuItem value={0}>None</MenuItem>}
                  {approverOptions.map((u) => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}
                </Select>
                {(errors.approver || approverMissing) && (
                  <FormHelperText>
                    {errors.approver ||
                      (canEditRiskDetails
                        ? "A Management Approver is required for a HIGH risk."
                        : "A Management Approver is required for a HIGH risk. Ask the Risk Assigner to set it.")}
                  </FormHelperText>
                )}
              </FormControl>
              <Autocomplete
                options={actionOwnerOptions}
                loading={actionOwnerSearchLoading || actionOwnerResolving}
                filterOptions={(opts) => opts}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.email === value.email}
                value={actionOwnerSelected}
                // The backend can only set the owner of an existing plan and
                // answers 409 otherwise, so don't offer a pick that can only fail.
                disabled={submitting || !canEditRiskDetails || !detail.action_plan}
                onInputChange={(_, newInputValue, reason) => {
                  if (reason === "input") handleActionOwnerInputChange(newInputValue);
                }}
                onChange={(_, newValue) => {
                  // An Action Owner is replaced, never removed, so clearing the
                  // field puts the current one back.
                  const request = ++actionOwnerRequest.current;
                  if (!newValue) {
                    setActionOwnerResolving(false);
                    setActionOwnerSelected(currentActionOwnerOption);
                    setActionOwnerId(currentActionOwnerId);
                    return;
                  }
                  setActionOwnerResolving(true);
                  resolveUserByEmail(authFetch, newValue)
                    .then((resolved) => {
                      if (request !== actionOwnerRequest.current) return;
                      setActionOwnerSelected(newValue);
                      setActionOwnerId(resolved.id);
                      setActionOwnerError(null);
                    })
                    .catch(() => {
                      if (request !== actionOwnerRequest.current) return;
                      setActionOwnerSelected(currentActionOwnerOption);
                      setActionOwnerId(currentActionOwnerId);
                      setActionOwnerError("Unable to link this employee to a user account. Please try again.");
                    })
                    .finally(() => {
                      if (request === actionOwnerRequest.current) setActionOwnerResolving(false);
                    });
                }}
                loadingText="Searching…"
                noOptionsText={actionOwnerError ?? "Type at least 2 characters of the employee's email to search"}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Action Owner"
                    placeholder="Search by email"
                    error={!!actionOwnerError}
                    helperText={
                      actionOwnerError ??
                      (!detail.action_plan
                        ? "This risk has no action plan, so there is no Action Owner to set."
                        : originalPlanHelp(detail.action_plan))
                    }
                  />
                )}
              />
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Implementation Date"
                  value={implementationDate}
                  onChange={(d) => {
                    setImplementationDate(d);
                    if (errors.implementationDate) setErrors((prev) => ({ ...prev, implementationDate: "" }));
                  }}
                  disabled={submitting || !canEditRiskDetails}
                  slotProps={{
                    desktopPaper: {
                      sx: {
                        backdropFilter: "none",
                        backgroundColor: "var(--oxygen-palette-background-default)",
                      },
                    },
                    textField: {
                      fullWidth: true,
                      error: !!errors.implementationDate,
                      helperText: errors.implementationDate,
                    },
                  }}
                />
              </LocalizationProvider>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || actionOwnerResolving}
          variant="contained"
        >
          {submitting ? "Saving..." : "Save Assessment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
