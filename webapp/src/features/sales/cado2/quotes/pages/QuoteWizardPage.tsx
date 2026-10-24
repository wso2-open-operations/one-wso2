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

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Navigate, useNavigate, useParams } from "react-router";
import {
  AdapterDateFns,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  DatePickers,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { CloudUploadIcon, PencilIcon, ShieldCheckIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { useLeaveGuard } from "@features/sales/cado2/quotes/form/useLeaveGuard";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import {
  usePricingPreview,
  useActiveLegalEntities,
  useQuoteSettings,
  useQuoteVersion,
  useSaveDraft,
  useSyncToSalesforce,
  useSubmitVersion,
} from "@features/sales/cado2/quotes/api/useQuoteApi";
import { isConflict, problemOf } from "@features/sales/cado2/quotes/api/errors";
import type { DraftResponse, Issue, QuoteView } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  formatDateTime,
  emptyDraftForm,
  fromVersion,
  STEPS,
  stepOfField,
  alignPreview,
  storedPricing,
  toDraftInput,
  toPreviewBody,
  type DraftFormValues,
} from "@features/sales/cado2/quotes/form/draftForm";
import { FieldIssuesContext, issueMap } from "@features/sales/cado2/quotes/components/fieldIssues";
import DeleteDraftDialog from "@features/sales/cado2/quotes/components/detail/DeleteDraftDialog";
import SummaryPanel from "@features/sales/cado2/quotes/components/SummaryPanel";
import { scrollMainToTop } from "@features/sales/cado2/utils/scroll";
import OverviewStep from "@features/sales/cado2/quotes/components/steps/OverviewStep";
import ProductsStep from "@features/sales/cado2/quotes/components/steps/ProductsStep";
import QuoteActionsMenu from "@features/sales/cado2/quotes/components/detail/QuoteActionsMenu";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import CommercialStep from "@features/sales/cado2/quotes/components/steps/CommercialStep";
import ReviewStep from "@features/sales/cado2/quotes/components/steps/ReviewStep";
import LegalStep from "@features/sales/cado2/quotes/components/steps/LegalStep";
import SmallDealBanner from "@features/sales/cado2/quotes/components/SmallDealBanner";
import ApprovalPreviewPanel from "@features/sales/cado2/approvals/components/ApprovalPreviewPanel";
import ApprovalPreviewDialog from "@features/sales/cado2/approvals/components/ApprovalPreviewDialog";
import { useApprovalPreview } from "@features/sales/cado2/approvals/api/useApprovalApi";
import WizardStepper from "@features/sales/cado2/quotes/components/wizard/WizardStepper";
import StepIntro from "@features/sales/cado2/quotes/components/wizard/StepIntro";
import { nextHint, reachableStep, stepChecks } from "@features/sales/cado2/quotes/form/stepRules";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";
import { STATUS_COLOR, STATUS_LABEL, quoteLabel } from "@features/sales/cado2/quotes/lifecycle/lifecycle";
import { cado2Paths } from "@features/sales/cado2/cado2Paths";

const { LocalizationProvider } = DatePickers;

/** Live totals refresh this long after the rep stops typing. */
const PREVIEW_DEBOUNCE_MS = 500;

const REVIEW_STEP = 4;

/** "Last synced 13 Oct 2026, 10:42 (v1)", or "Not synced yet" (D77). */
function lastSynced(q: QuoteView): string {
  if (!q.sfSyncedAt) return "Not synced yet";
  const at = formatDateTime(q.sfSyncedAt);
  return `Last synced ${at}${q.sfSyncedVersion ? ` (v${q.sfSyncedVersion})` : ""}`;
}

/** Issues from the last refused save, submit or Salesforce sync (422). */
interface Refusal {
  readonly kind: "save" | "submit" | "sync";
  readonly issues: readonly Issue[];
}

/**
 * The quote wizard: new at /quotes/new, or a saved
 * version at /quotes/:quoteId/versions/:version/edit. Leaving a step with
 * changes saves the draft first; "Save draft" saves at any time.
 * Submitting freezes the version; a submitted version opens read-only on
 * Review.
 */
export default function QuoteWizardPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const quoteId = params.quoteId ? Number(params.quoteId) : null;
  const versionNumber = params.version ? Number(params.version) : null;
  const isNew = quoteId === null;

  const loaded = useQuoteVersion(quoteId, versionNumber);
  const save = useSaveDraft();
  const sync = useSyncToSalesforce();
  const notify = useCado2Toast();
  const submit = useSubmitVersion();
  const settings = useQuoteSettings();

  const form = useForm<DraftFormValues>({ defaultValues: emptyDraftForm() });
  // A new quote's first save, until the route switches to its edit URL.
  // After that the version query holds it (the save and submit hooks write the cache).
  const [created, setCreated] = useState<DraftResponse | null>(null);
  const saved = loaded.data ?? created;
  // A draft, and the caller may change it: its owner, or another AM when Admin allows it (D69).
  const editable = !saved || (saved.version.status === "DRAFT" && saved.quote.canEdit);
  useDocumentTitle(
    saved
      ? quoteLabel(saved.quote.quoteNumber, saved.version.accountName, saved.version.opportunityName)
      : "New Quote",
  );
  const [stepChoice, setStepChoice] = useState<number | null>(null);
  // Where the wizard opens, decided once: a saved draft at its first
  // incomplete step (steps are filled in order), a frozen version on Review.
  // Worked out from the loaded version, because the form is reset after this
  // render. (React's "adjust state while rendering" pattern.)
  const [opened, setOpened] = useState(false);
  if (!opened && (isNew || loaded.data)) {
    setOpened(true);
    setStepChoice(
      !loaded.data
        ? 0
        : loaded.data.version.status !== "DRAFT"
          ? REVIEW_STEP
          : reachableStep(stepChecks(fromVersion(loaded.data))),
    );
  }
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [confirmingSync, setConfirmingSync] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load a saved version into the form (and again after a save or a reload).
  useEffect(() => {
    if (loaded.data) form.reset(fromVersion(loaded.data));
  }, [loaded.data, form]);

  const { isDirty } = form.formState;
  const { confirmLeave, allowLeave } = useLeaveGuard(isDirty);

  // Live pricing while editing. A frozen or unchanged version shows its stored
  // numbers instead, so a submitted version is never re-priced with newer rules.
  const values = useWatch({ control: form.control }) as DraftFormValues;
  const previewBody = useDebouncedValue(
    useMemo(() => (editable ? toPreviewBody(values) : null), [values, editable]),
    PREVIEW_DEBOUNCE_MS,
  );
  const preview = usePricingPreview(previewBody);
  // Lined up with the form's lines: lines waiting for a category aren't priced (D72).
  const priced = useMemo(
    () => alignPreview(preview.data?.kind === "priced" ? preview.data.preview : null, values.lines),
    [preview.data, values.lines],
  );
  const previewProblems = useMemo(
    () => (preview.data?.kind === "problems" && previewBody ? preview.data.issues : []),
    [preview.data, previewBody],
  );
  const stored = useMemo(() => (saved ? storedPricing(saved) : null), [saved]);

  // A product mapped (or unmapped) since its line was added: the preview
  // priced it with the Admin's current mapping, so the form follows.
  useEffect(() => {
    if (!editable || !priced) return;
    priced.lines.forEach((p, i) => {
      const l = form.getValues(`lines.${i}`);
      if (!p || !l || l.pricebookEntryId !== p.pricebookEntryId || !p.categorySource) return;
      if (p.categorySource === "MAPPED" && p.category && (l.category !== p.category || l.categorySource !== "MAPPED")) {
        form.setValue(`lines.${i}.category`, p.category, { shouldDirty: true });
        form.setValue(`lines.${i}.categorySource`, "MAPPED", { shouldDirty: true });
      } else if (p.categorySource === "REP" && l.categorySource === "MAPPED") {
        form.setValue(`lines.${i}.categorySource`, "REP", { shouldDirty: true });
      }
    });
  }, [editable, priced, form]);

  // Approvals: what the current choices would need if submitted now.
  // Before Review they are worked out only on request ("Preview approvals");
  // on Review they are shown inline and kept up to date. Nothing is requested
  // until submission.
  const approvalInput = useCallback(
    (v: DraftFormValues) => ({ quoteId: saved?.quote.id, versionNumber: saved?.version.versionNumber, draft: toDraftInput(v) }),
    [saved?.quote.id, saved?.version.versionNumber],
  );
  const [approvalDialog, setApprovalDialog] = useState<ReturnType<typeof approvalInput> | null>(null);
  const shown = !editable ? stored : !isDirty && stored ? stored : priced;

  const refused = refusal?.issues;
  const legalEntities = useActiveLegalEntities();
  const issues: readonly Issue[] = useMemo(() => {
    if (!editable) return [];
    const seen = new Set<string>();
    return [...(refused ?? []), ...previewProblems, ...(isDirty ? [] : (saved?.issues ?? []))].filter((i) =>
      seen.has(i.field) ? false : (seen.add(i.field), true),
    );
  }, [editable, refused, previewProblems, saved, isDirty]);
  const fieldIssues = useMemo(() => issueMap([...(refused ?? []), ...previewProblems]), [refused, previewProblems]);

  // Filled in order (F5 feedback): Next unlocks when the current step is
  // complete; steps beyond the first incomplete one are locked. A frozen
  // version can be browsed freely.
  const checks = useMemo(() => stepChecks(values), [values]);
  const pricingProblems = [0, 1, 2, 3].map((i) => previewProblems.filter((p) => stepOfField(p.field) === i));
  const reachable = editable
    ? reachableStep(
        checks,
        pricingProblems.map((p) => p.length),
      )
    : REVIEW_STEP;
  const step = Math.min(stepChoice ?? 0, reachable);
  // A step is a new page to the rep, so it starts at the top: the steps share
  // one URL, so the shell's reset on navigation doesn't fire.
  useEffect(() => {
    scrollMainToTop();
  }, [step]);
  const missing = step < REVIEW_STEP && editable ? [...checks[step], ...pricingProblems[step]] : [];

  // On Review the approvals are inline and live; their blockers stop Submit.
  const reviewApprovalBody = useDebouncedValue(
    useMemo(
      () => (editable && step === REVIEW_STEP && values.opportunityId ? approvalInput(values) : null),
      [editable, step, values, approvalInput],
    ),
    PREVIEW_DEBOUNCE_MS,
  );
  const approvals = useApprovalPreview(reviewApprovalBody);
  const approvalBlockers = reviewApprovalBody ? (approvals.data?.blockers ?? []) : [];

  const editUrl = (res: DraftResponse) => cado2Paths.editVersion(res.quote.id, res.version.versionNumber);

  // A 422 lists what to fix; a 409 means it changed elsewhere (or was
  // already submitted). Other errors are shown by ErrorNotice below.
  const handleRefusal = (err: unknown, kind: Refusal["kind"]) => {
    const problem = problemOf(err);
    if (problem) setRefusal({ kind, issues: problem.issues });
    else if (isConflict(err)) setConflict(true);
  };

  /** Saves the form; the stored version, or null if the save failed. */
  const persist = async (v: DraftFormValues): Promise<DraftResponse | null> => {
    try {
      const res = await save.mutateAsync({
        quoteId: saved?.quote.id ?? null,
        version: saved?.version.versionNumber ?? null,
        input: toDraftInput(v, saved?.version.updatedAt),
      });
      if (isNew) setCreated(res);
      form.reset(fromVersion(res));
      return res;
    } catch (err) {
      handleRefusal(err, "save");
      return null;
    }
  };

  const leaveNewQuoteFor = (res: DraftResponse) => {
    if (!isNew) return;
    allowLeave();
    navigate(editUrl(res), { replace: true });
  };

  const onSave = form.handleSubmit(async (v) => {
    setRefusal(null);
    submit.reset();
    const res = await persist(v);
    if (!res) return;
    notify("Draft saved");
    leaveNewQuoteFor(res);
  });

  // Moving to another step saves the changes first. Nothing changed, or
  // a frozen version: just move. A failed save stays on the step and shows why.
  const goToStep = async (target: number) => {
    if (save.isPending || submit.isPending) return;
    if (!editable || !isDirty) {
      setStepChoice(target);
      return;
    }
    setRefusal(null);
    submit.reset();
    const res = await persist(form.getValues());
    if (!res) return;
    setStepChoice(target);
    leaveNewQuoteFor(res);
  };

  // Unsaved changes are saved first, then submitted, in one click.
  const onSubmit = form.handleSubmit(async (v) => {
    setRefusal(null);
    let current = saved;
    if (!current || isDirty) {
      current = await persist(v);
      if (!current) {
        setConfirmingSubmit(false);
        return;
      }
    }
    try {
      const res = await submit.mutateAsync({
        quoteId: current.quote.id,
        version: current.version.versionNumber,
        expectedUpdatedAt: current.version.updatedAt,
      });
      if (isNew) setCreated(res);
      form.reset(fromVersion(res));
      notify(`Version ${res.version.versionNumber} submitted for approval`);
      // Out of edit mode: a submitted version is viewed on the quote page (2026-10-13).
      allowLeave();
      navigate(cado2Paths.quote(res.quote.id));
    } catch (err) {
      handleRefusal(err, "submit");
      leaveNewQuoteFor(current);
    } finally {
      setConfirmingSubmit(false);
    }
  });

  // "Sync to Salesforce" (D77): saves first when there are changes, then
  // writes the saved draft to the opportunity.
  const onSync = form.handleSubmit(async (v) => {
    setRefusal(null);
    submit.reset();
    let current = saved;
    if (!current || isDirty) {
      current = await persist(v);
      if (!current) return;
    }
    try {
      const res = await sync.mutateAsync({
        quoteId: current.quote.id,
        version: current.version.versionNumber,
        expectedUpdatedAt: current.version.updatedAt,
      });
      if (isNew) setCreated(res);
      form.reset(fromVersion(res));
      notify("Synced to Salesforce");
    } catch (err) {
      handleRefusal(err, "sync");
    } finally {
      leaveNewQuoteFor(current);
    }
  });

  const reloadLatest = () => {
    setConflict(false);
    setRefusal(null);
    void loaded.refetch();
  };

  // Back to the quote page once the quote exists, else to My Quotes.
  if (!isNew && loaded.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading the quote" />
      </Box>
    );
  }
  if (!isNew && loaded.error) {
    return (
      <ErrorNotice error={loaded.error} onRetry={() => void loaded.refetch()} retrying={loaded.isFetching}>
        Couldn&apos;t load the quote.
      </ErrorNotice>
    );
  }

  // Edit mode only (2026-10-13): a version that can't be edited (submitted,
  // recalled, closed, or another AM's) is viewed on the quote page. This is
  // also where a submit lands.
  if (saved && !editable) {
    const latestNumber = saved.quote.versions.at(-1)?.versionNumber;
    const n = saved.version.versionNumber;
    return <Navigate to={cado2Paths.quote(saved.quote.id, "quote", false, n === latestNumber ? undefined : n)} replace />;
  }

  const chosenLegalEntity =
    legalEntities.data?.find((e) => String(e.id) === values.legalEntityId)?.name ?? legalEntityName(saved);
  // Prices are still being checked when the form differs from what was last
  // sent for pricing, or a check is in flight: Next waits for the answer.
  const pricingPending =
    editable &&
    step === 1 &&
    (preview.isFetching || JSON.stringify(toPreviewBody(values)) !== JSON.stringify(previewBody));
  const unhandled = (e: Error | null) => (e && !problemOf(e) && !isConflict(e) ? e : null);
  const saveError = unhandled(save.error);
  const submitError = unhandled(submit.error);
  const syncError = unhandled(sync.error);
  const busy = save.isPending || submit.isPending || sync.isPending;
  const hasIdentity = Boolean(values.accountId && values.opportunityId);
  // No quote starts for an account without a sales region (2026-10-07); an
  // existing draft can still be saved, but not submitted.
  const canSave = hasIdentity && (Boolean(saved) || Boolean(values.accountSalesRegion));
  const nextVersion = saved?.version.versionNumber ?? 1;
  const blockedByIssues = !isDirty && issues.length > 0;
  const version = saved?.version;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <FormProvider {...form}>
        <FieldIssuesContext.Provider value={fieldIssues}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            {/* Edit mode (2026-10-13): marked "Editing", with the same identity as
                the quote page (number, version, account), and a way back to it. */}
            <PageHeader
              back={{
                to: saved ? cado2Paths.quote(saved.quote.id) : cado2Paths.quotes,
                label: saved ? "Back to quote" : "Quotes",
                onClick: (e) => {
                  if (!confirmLeave()) e.preventDefault();
                },
              }}
              eyebrow={
                <>
                  <Chip size="small" color="primary" variant="outlined" icon={<PencilIcon size={14} />} label="Editing" />
                  {saved ? (
                    <Typography variant="body2" color="text.secondary">
                      {saved.quote.quoteNumber ?? "Draft"} · Version {saved.version.versionNumber}
                    </Typography>
                  ) : null}
                </>
              }
              title={saved ? saved.version.accountName || "New Quote" : "New Quote"}
              chips={
                <>
                  <StatusChip
                    color={version ? STATUS_COLOR[version.status] : "default"}
                    label={version ? STATUS_LABEL[version.status] : "Not saved yet"}
                  />
                  {/* A new quote is all unsaved, so "Unsaved changes" is only for saved ones. */}
                  {saved && isDirty ? (
                    <Chip size="small" variant="outlined" color="warning" label="Unsaved changes" />
                  ) : null}
                </>
              }
              actions={
                <>
                  {/* One main button, the rest under "⋯", destructive last (2026-10-13, as on the quote page). */}
                  <Button variant="contained" onClick={() => void onSave()} disabled={busy || !canSave}>
                    {save.isPending ? "Saving…" : sync.isPending ? "Syncing…" : "Save draft"}
                  </Button>
                  <QuoteActionsMenu
                    actions={[
                      // D77: the primary quote's sync, saved first.
                      ...(saved?.quote.canSync
                        ? [
                            {
                              label: "Sync to Salesforce",
                              icon: <CloudUploadIcon size={16} />,
                              detail: lastSynced(saved.quote),
                              disabled: busy || !canSave,
                              onClick: () => setConfirmingSync(true),
                            },
                          ]
                        : []),
                    ]}
                    destructive={
                      saved && saved.version.status === "DRAFT" && saved.quote.actions.includes("CLOSE")
                        ? [{ label: "Delete draft", icon: <Trash2Icon size={16} />, disabled: busy, onClick: () => setDeleting(true) }]
                        : []
                    }
                  />
                </>
              }
            />

            {version?.status === "DRAFT" && version.copiedFromVersion ? (
              <Alert severity="info" variant="outlined">
                Copied from version {version.copiedFromVersion}. Prices stay as they were in v
                {version.copiedFromVersion}.
              </Alert>
            ) : null}
            {refusal ? (
              <Alert severity="error">
                {refusal.kind === "save"
                  ? "The draft wasn't saved. Fix these and save again:"
                  : refusal.issues.some((i) => i.field === "salesforce")
                    ? `Salesforce refused the sync, so nothing changed there${refusal.kind === "submit" ? " and the version wasn't submitted" : ""}:`
                    : refusal.kind === "sync"
                      ? "The quote wasn't synced to Salesforce. Fix these first:"
                      : "The version wasn't submitted. Fix these, then submit again:"}
                <IssueLinks issues={refusal.issues} onJump={(s) => setStepChoice(Math.min(s, reachable))} />
              </Alert>
            ) : null}
            {saveError ? <ErrorNotice error={saveError}>Couldn&apos;t save the draft.</ErrorNotice> : null}
            {submitError ? <ErrorNotice error={submitError}>Couldn&apos;t submit the version.</ErrorNotice> : null}
            {syncError ? <ErrorNotice error={syncError}>Couldn&apos;t sync to Salesforce.</ErrorNotice> : null}

            <WizardStepper
              active={step}
              reachable={reachable}
              readOnly={!editable}
              onSelect={(s) => void goToStep(s)}
            />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0,1fr)",
                  lg: "minmax(0,1fr) 320px",
                },
                gap: 3,
                alignItems: "start",
              }}
            >
              <Box sx={{ minWidth: 0, order: { xs: 2, lg: 1 } }}>
                <Box sx={{ mb: 2.5 }}>
                  <StepIntro step={step} />
                </Box>
                <Box component="fieldset" disabled={!editable} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
                  {step === 0 ? <OverviewStep locked={saved !== null} quoteId={saved?.quote.id ?? null} /> : null}
                  {step === 1 ? <ProductsStep preview={shown} /> : null}
                  {step === 2 ? <CommercialStep /> : null}
                  {step === 3 ? <LegalStep /> : null}
                </Box>
                {step === REVIEW_STEP ? (
                  <>
                    {/* Rules only the server knows (e.g. a price that changed) still stop a submit. */}
                    {editable && blockedByIssues && !refusal ? (
                      <Alert severity="warning" sx={{ mb: 2.5 }}>
                        Before submitting:
                        <IssueLinks issues={issues} onJump={(s) => setStepChoice(Math.min(s, reachable))} />
                      </Alert>
                    ) : null}
                    {approvalBlockers.length ? (
                      <Alert severity="error" sx={{ mb: 2.5 }}>
                        The approvals can&apos;t be worked out yet (they are never skipped):
                        <IssueLinks issues={approvalBlockers} onJump={(s) => setStepChoice(Math.min(s, reachable))} />
                      </Alert>
                    ) : null}
                    <ReviewStep
                      preview={shown}
                      savedLegalEntityName={legalEntityName(saved)}
                      approvals={
                        editable ? (
                          <ApprovalPreviewPanel preview={approvals.data} loading={approvals.isFetching} error={approvals.error} showBlockers={false} />
                        ) : null
                      }
                    />
                  </>
                ) : null}
                {/* Under USD 30,000 (2026-10-24): right above Next and
                    Submit, where the AM's eye is when moving on, not at the
                    top of a long step. */}
                {step === 1 || step === REVIEW_STEP ? (
                  <Box sx={{ mt: 3 }}>
                    <SmallDealBanner smallDeal={shown?.smallDeal} currency={values.currencyIsoCode} tcv={shown?.totals.tcv} />
                  </Box>
                ) : null}
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 3,
                    px: 2,
                    py: 1.5,
                    borderRadius: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Button disabled={step === 0 || busy} onClick={() => void goToStep(step - 1)}>
                    ← Back
                  </Button>
                  {step < REVIEW_STEP ? (
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ flexWrap: "wrap", justifyContent: "flex-end", rowGap: 1 }}
                    >
                      {missing.length > 0 ? (
                        <Typography variant="body2" color="warning.main">
                          To continue: {nextHint(missing)}
                        </Typography>
                      ) : pricingPending ? (
                        <Typography variant="body2" color="text.secondary">
                          Checking prices…
                        </Typography>
                      ) : null}
                      <Button
                        variant="contained"
                        onClick={() => void goToStep(step + 1)}
                        disabled={missing.length > 0 || pricingPending || busy}
                      >
                        {save.isPending ? "Saving…" : `Next: ${STEPS[step + 1]} →`}
                      </Button>
                    </Stack>
                  ) : editable ? (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {blockedByIssues || approvalBlockers.length ? (
                        <Typography variant="caption" color="text.secondary">
                          Fix the {issues.length + approvalBlockers.length === 1 ? "item" : `${issues.length + approvalBlockers.length} items`}{" "}
                          above first
                        </Typography>
                      ) : null}
                      <Button
                        variant="contained"
                        onClick={() => setConfirmingSubmit(true)}
                        disabled={busy || !hasIdentity || blockedByIssues || approvalBlockers.length > 0}
                      >
                        Submit version {nextVersion}
                      </Button>
                    </Stack>
                  ) : null}
                </Paper>
              </Box>
              <Box sx={{ order: { xs: 1, lg: 2 } }}>
                <SummaryPanel
                  values={values}
                  legalEntityName={chosenLegalEntity}
                  totals={shown?.totals ?? null}
                  pricing={editable && preview.isFetching}
                  approvals={
                    editable && values.opportunityId && step < REVIEW_STEP ? (
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<ShieldCheckIcon size={16} />}
                        onClick={() => setApprovalDialog(approvalInput(values))}
                      >
                        Preview approvals
                      </Button>
                    ) : null
                  }
                />
              </Box>
            </Box>
          </Stack>

          <ApprovalPreviewDialog body={approvalDialog} onClose={() => setApprovalDialog(null)} />
          {deleting && saved ? (
            <DeleteDraftDialog
              quote={saved.quote}
              name={quoteLabel(saved.quote.quoteNumber, saved.version.accountName, saved.version.opportunityName)}
              versionNumber={saved.version.versionNumber}
              updatedAt={saved.version.updatedAt}
              onClose={() => setDeleting(false)}
              onDeleted={(res) => {
                // The draft and any unsaved edits are gone; nothing to warn about.
                allowLeave();
                navigate(res.quoteDeleted ? cado2Paths.quotes : cado2Paths.quote(saved.quote.id), { replace: true });
              }}
            />
          ) : null}
          <Dialog open={confirmingSubmit} onClose={() => !busy && setConfirmingSubmit(false)}>
            <DialogTitle>Submit version {nextVersion}?</DialogTitle>
            <DialogContent>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Version {nextVersion} will be frozen and can&apos;t be edited. Once approved, you issue the order form to
                  the customer; its {settings.data ? `${settings.data.validityDays}-day ` : ""}expiry starts then.
                </Typography>
                {isDirty || !saved ? (
                  <Typography variant="body2" color="text.secondary">
                    Your unsaved changes will be saved first.
                  </Typography>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmingSubmit(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="contained" onClick={() => void onSubmit()} disabled={busy}>
                {save.isPending ? "Saving…" : submit.isPending ? "Submitting…" : "Submit"}
              </Button>
            </DialogActions>
          </Dialog>

          {/* D77: the manual sync asks first; Salesforce is made to match the quote. */}
          <Dialog open={confirmingSync} onClose={() => !busy && setConfirmingSync(false)}>
            <DialogTitle>Sync to Salesforce?</DialogTitle>
            <DialogContent>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Version {nextVersion} of this quote is written to
                  {saved?.version.opportunityName ? ` ${saved.version.opportunityName}` : " its opportunity"} in Salesforce:
                  the subscription dates, and each product with its units, price, discounts, dates and commission.
                </Typography>
                <Typography variant="body2">
                  The opportunity then matches this quote: products on it that aren&apos;t on this quote are removed in
                  Salesforce.
                </Typography>
                {isDirty ? (
                  <Typography variant="body2" color="text.secondary">
                    Your unsaved changes will be saved first.
                  </Typography>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmingSync(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => void onSync().finally(() => setConfirmingSync(false))}
                disabled={busy}
              >
                {save.isPending ? "Saving…" : sync.isPending ? "Syncing…" : "Sync"}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={conflict} onClose={() => setConflict(false)}>
            <DialogTitle>This draft changed elsewhere</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                It was saved or submitted in another window, or by someone else, after you opened it. Reload it to see
                the latest version; your unsaved changes here will be lost.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConflict(false)}>Keep editing</Button>
              <Button variant="contained" onClick={reloadLatest}>
                Reload latest
              </Button>
            </DialogActions>
          </Dialog>
        </FieldIssuesContext.Provider>
      </FormProvider>
    </LocalizationProvider>
  );
}

/** The legal entity's name from the version's snapshot, if any. */
function legalEntityName(res: DraftResponse | null): string | null {
  const snapshot = res?.version.legalEntity as { name?: string } | null | undefined;
  return snapshot?.name ?? null;
}

/** Server-side issues, each a link to the step that owns its field. */
function IssueLinks({ issues, onJump }: { issues: readonly Issue[]; onJump: (step: number) => void }): JSX.Element {
  return (
    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
      {issues.map((i) => {
        const step = stepOfField(i.field);
        return (
          <li key={`${i.field}-${i.message}`}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => onJump(step)}
              sx={{ textAlign: "left" }}
            >
              {STEPS[step]}: {i.message}
            </Link>
          </li>
        );
      })}
    </Box>
  );
}
