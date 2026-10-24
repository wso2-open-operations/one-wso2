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

import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { useAsgardeo } from "@asgardeo/react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@wso2/oxygen-ui";
import { ShieldCheck } from "@wso2/oxygen-ui-icons-react";
import type { JSX } from "react";
import BasicInformationStep from "./add-risk/BasicInformationStep";
import RiskAssessmentStep from "./add-risk/RiskAssessmentStep";
import ActionPlanStep from "./add-risk/ActionPlanStep";
import { buildRiskCode, getCurrentQuarter, getCurrentYear } from "./add-risk/constants";
import { missingTemplateFields, resetForRegisterChange, templateOf } from "./add-risk/templates";
import type { TemplateField } from "./add-risk/templates";
import type { AddRiskFormValues } from "./add-risk/types";
import { darkCardSx } from "./cardStyles";
import {
  createRisk,
  fetchAssignmentTeams,
  fetchComplianceReferences,
  fetchLookupOptions,
  fetchNextSequenceID,
  fetchRiskCategories,
  fetchRiskScores,
  fetchSourceRegisterTeams,
  uploadRiskEvidence,
} from "../api/riskApi";
import type { ComplianceReference, CreateRiskResponse, LookupOption, RiskCategory, RiskScore, RiskTeam } from "../api/riskApi";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { RiskPrivilege } from "../privileges";

const STEPS = ["Basic Information", "Risk Assessment", "Risk Treatment Plan"] as const;

// Fields validated when the user clicks Next on each step.
const STEP_1_FIELDS: (keyof AddRiskFormValues)[] = [
  "year",
  "quarter",
  "sourceRegister",
  "riskTitle",
  "riskDescription",
  "riskCategory",
  "riskAcceptor",
  "identifiedByType",
  "assignedBy",
  "riskIdentifiedDate",
];

const STEP_2_FIELDS: (keyof AddRiskFormValues)[] = [
  "likelihood",
  "impact",
  "impactDescription",
  "implementationDate",
  "reassessmentDate",
];

function SuccessState({ onReset, warning }: { onReset: () => void; warning?: string | null }): JSX.Element {
  return (
    <Stack alignItems="center" justifyContent="center" gap={2} sx={{ py: 8, textAlign: "center" }}>
      <Box sx={{ color: "success.main" }}>
        <ShieldCheck size={48} />
      </Box>
      <Typography variant="h5" fontWeight={600}>
        Risk Submitted Successfully
      </Typography>
      <Typography variant="body2" color="text.secondary">
        The risk has been registered and is now pending compliance review.
        Your risk code will be confirmed in the Risk Registers.
      </Typography>
      {warning && (
        <Alert severity="warning" sx={{ textAlign: "left", maxWidth: 480 }}>
          {warning}
        </Alert>
      )}
      <Stack direction="row" gap={2} sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={onReset}>
          Add Another Risk
        </Button>
        <Button variant="contained" href="/security/risk/registers">
          View Risk Registers
        </Button>
      </Stack>
    </Stack>
  );
}

interface RiskCodeConflict {
  taken: string;
  next: string;
}

export default function AddRisk(): JSX.Element {
  const [activeStep, setActiveStep] = useState(0);
  const [riskSequenceId, setRiskSequenceId] = useState<number | null>(null);
  const [riskCodeConflict, setRiskCodeConflict] = useState<RiskCodeConflict | null>(null);

  // Fetched lookup data for dropdowns
  const [sourceRegisterTeams, setSourceRegisterTeams] = useState<RiskTeam[]>([]);
  const [assignmentTeams, setAssignmentTeams]         = useState<RiskTeam[]>([]);
  const [riskScores, setRiskScores]                   = useState<RiskScore[]>([]);
  const [complianceRefs, setComplianceRefs]           = useState<ComplianceReference[]>([]);
  const [riskCategories, setRiskCategories]           = useState<RiskCategory[]>([]);
  // Register-template lookups: ACTIVE values only, since an inactive one must
  // not be newly chosen.
  const [platforms, setPlatforms]                     = useState<LookupOption[]>([]);
  const [customers, setCustomers]                     = useState<LookupOption[]>([]);
  const [products, setProducts]                       = useState<LookupOption[]>([]);
  const [deploymentTypes, setDeploymentTypes]         = useState<LookupOption[]>([]);
  const [fetchError, setFetchError]                   = useState<string | null>(null);
  const [submitError, setSubmitError]                 = useState<string | null>(null);
  // Set only when the risk itself was created successfully but a staged
  // evidence attachment failed to upload afterward — shown on the success
  // screen (submitError's Alert doesn't render there), never treated as a
  // failed submission since the risk already exists and retrying would
  // create a duplicate.
  const [attachmentWarning, setAttachmentWarning]     = useState<string | null>(null);

  const { isSignedIn } = useAsgardeo();
  const authFetch = useAuthApiClient();

  const methods = useForm<AddRiskFormValues>({
    defaultValues: {
      year: getCurrentYear(),
      quarter: getCurrentQuarter(),
      sourceRegister: "",
      riskTitle: "",
      riskDescription: "",
      complianceReferences: [],
      riskCategory: "",
      riskAcceptor: "",
      identifiedByType: "EMPLOYEE",
      identifiedByName: "",
      identifiedByEmail: "",
      assignedBy: "",
      riskIdentifiedDate: null,
      // ── Step 2 defaults ───────────────────────────────────────────────────
      likelihood: null,
      impact: null,
      impactDescription: "",
      implementationDate: null,
      reassessmentDate: new Date(),
      // ── Step 3 defaults ───────────────────────────────────────────────────
      assignmentTeam: "",
      riskOwner: "",
      managementApprover: "",
      actionOwner: "",
      actionPlanDescription: "",
      actionSteps: [{ description: "" }],
      treatmentStrategy: "",
      progress: "",
      gitIssueUrl: "",
      emailSubject: "",
      remarks: "",
      evidenceAttachments: [],
      // ── Register-template fields (Step 1) ─────────────────────────────────
      platforms: [],
      customer: "",
      deploymentType: "",
      products: [],
      environments: [],
    },
    mode: "onSubmit",
  });

  const { trigger, handleSubmit, setError, setValue, getValues } = methods;

  // Watch the three fields that determine the risk code preview and next-sequence-id.
  const watchedYear            = methods.watch("year");
  const watchedQuarter         = methods.watch("quarter");
  const watchedSourceRegister  = methods.watch("sourceRegister");
  const watchedCustomer        = methods.watch("customer");

  // The chosen register decides which template fields the form carries.
  const selectedRegister = typeof watchedSourceRegister === "number"
    ? sourceRegisterTeams.find((t) => t.id === watchedSourceRegister)
    : undefined;
  const template = templateOf(selectedRegister);

  useEffect(() => {
    document.getElementById("main-scroll-container")?.scrollTo({ top: 0 });
  }, [activeStep]);

  // Fetch all static dropdown data once the user is ready (real auth or mock mode).
  useEffect(() => {
    if (!isSignedIn) return;
    setFetchError(null);
    Promise.all([
      // Only registers the caller may actually raise a risk in. The server
      // checks RISK_CREATE *in the chosen register*, so anything broader would
      // offer choices that 403 on submit.
      fetchSourceRegisterTeams(authFetch, true, RiskPrivilege.CreateRisk),
      fetchRiskScores(authFetch),
      fetchComplianceReferences(authFetch),
      fetchRiskCategories(authFetch),
      fetchLookupOptions(authFetch, "platforms"),
      fetchLookupOptions(authFetch, "customers"),
      fetchLookupOptions(authFetch, "products"),
      fetchLookupOptions(authFetch, "deployment-types"),
    ])
      .then(([srTeams, scores, refs, categories, plats, custs, prods, deploys]) => {
        setSourceRegisterTeams(srTeams);
        setRiskScores(scores);
        setComplianceRefs(refs);
        setRiskCategories(categories);
        setPlatforms(plats);
        setCustomers(custs);
        setProducts(prods);
        setDeploymentTypes(deploys);
      })
      .catch(() => {
        setFetchError("Failed to load form data. Please refresh the page.");
      });
  }, [isSignedIn, authFetch]);

  // "Risk Assigned To" defaults to the signed-in caller — see
  // BasicInformationStep, which owns that field and fetches its own
  // register-scoped candidate list. This used to live here, matching a
  // decoded Asgardeo ID token against the unscoped user list — broken in
  // mock-auth mode (no real session to decode) and no longer valid anyway,
  // since eligibility is now register-dependent rather than "any platform
  // user".

  // Every register offers the same assignment teams. Anyone may be assigned
  // to — you routinely hand remediation to a team you don't belong to, and
  // being assigned confers no authority — so this is not narrowed by the
  // caller's own grants.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    fetchAssignmentTeams(authFetch)
      .then((teams) => { if (!cancelled) setAssignmentTeams(teams); })
      .catch(() => {
        if (cancelled) return;
        setAssignmentTeams([]);
        setFetchError("Failed to load assignment teams. Please refresh the page.");
      });
    return () => { cancelled = true; };
  }, [isSignedIn, authFetch]);

  // Changing the register clears the template fields: the previous register's
  // Platform or Customer must not travel into a risk on a register that lacks
  // them. (Compliance references are only cleared when the new register drops
  // them — see resetForRegisterChange.)
  const previousRegister = useRef<number | "">("");
  useEffect(() => {
    if (previousRegister.current === watchedSourceRegister) return;
    previousRegister.current = watchedSourceRegister;
    const reset = resetForRegisterChange(template);
    (Object.keys(reset) as (keyof typeof reset)[]).forEach((key) => setValue(key, reset[key] as never));
  }, [watchedSourceRegister, template, setValue]);

  // Re-fetch the next sequence ID whenever year, quarter, source register — or,
  // for a Managed Services register, which counts per customer — changes.
  useEffect(() => {
    if (typeof watchedSourceRegister !== "number") {
      setRiskSequenceId(null);
      return;
    }
    const perCustomer = template === "MANAGED_SERVICES";
    if (perCustomer && typeof watchedCustomer !== "number") {
      // No number to preview until a customer is chosen.
      setRiskSequenceId(null);
      return;
    }
    if (!isSignedIn) return;
    let cancelled = false;
    fetchNextSequenceID(
      authFetch,
      watchedSourceRegister,
      watchedYear,
      watchedQuarter,
      perCustomer && typeof watchedCustomer === "number" ? watchedCustomer : undefined,
    )
      .then((id) => {
        if (!cancelled) setRiskSequenceId(id);
      })
      .catch(() => {
        if (!cancelled) setRiskSequenceId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [watchedYear, watchedQuarter, watchedSourceRegister, watchedCustomer, template, isSignedIn, authFetch]);

  const isLastStep = activeStep === STEPS.length - 1;
  const isComplete = activeStep === STEPS.length;

  const handleNext = async (): Promise<void> => {
    let valid = true;

    if (activeStep === 0) {
      valid = await trigger([...STEP_1_FIELDS, "identifiedByName"]);
      // The template fields have no field-level rules (they only exist for some
      // registers), so the register's template decides what is required here.
      const missing = missingTemplateFields(template, getValues());
      (Object.entries(missing) as [TemplateField, string][]).forEach(([field, message]) =>
        setError(field, { type: "required", message }),
      );
      if (Object.keys(missing).length > 0) valid = false;
    } else if (activeStep === 1) {
      valid = await trigger(STEP_2_FIELDS);
    }

    if (valid) setActiveStep((prev) => prev + 1);
  };

  const handleBack = (): void => setActiveStep((prev) => prev - 1);

  const handleReset = (): void => {
    setActiveStep(0);
    setRiskCodeConflict(null);
    setRiskSequenceId(null);
    setSubmitError(null);
    setAttachmentWarning(null);
    methods.reset();
  };

  const onSubmit = async (data: AddRiskFormValues): Promise<void> => {
    // Validate step 3 required fields manually — no RHF rules on these to avoid premature errors.
    let hasStep3Error = false;
    if (!data.assignmentTeam) {
      setError("assignmentTeam", { type: "required", message: "Assignment team is required" });
      hasStep3Error = true;
    }
    if (!data.riskOwner) {
      setError("riskOwner", { type: "required", message: "Risk owner is required" });
      hasStep3Error = true;
    }
    // Only a HIGH risk needs a Management Approver; the backend enforces the same rule.
    const selectedScore =
      data.likelihood != null && data.impact != null
        ? riskScores.find((sc) => sc.likelihood === data.likelihood && sc.impact === data.impact)
        : undefined;
    if (selectedScore?.risk_level === "HIGH" && !data.managementApprover) {
      setError("managementApprover", { type: "required", message: "Management approver is required for a HIGH risk" });
      hasStep3Error = true;
    }
    if (!data.actionOwner) {
      setError("actionOwner", { type: "required", message: "Action owner is required" });
      hasStep3Error = true;
    }
    if (!data.treatmentStrategy) {
      setError("treatmentStrategy", { type: "required", message: "Treatment strategy is required" });
      hasStep3Error = true;
    }
    if (!data.emailSubject?.trim()) {
      setError("emailSubject", { type: "required", message: "Email subject is required" });
      hasStep3Error = true;
    }
    data.actionSteps.forEach((step, i) => {
      if (!step.description?.trim()) {
        setError(`actionSteps.${i}.description` as FieldPath<AddRiskFormValues>, { type: "required", message: "Step description is required" });
        hasStep3Error = true;
      }
    });
    if (hasStep3Error) return;

    setSubmitError(null);
    setAttachmentWarning(null);

    let created: CreateRiskResponse;
    try {
      created = await createRisk(authFetch, data);
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string; data?: { next_sequence_id?: number } };
      if (apiErr.status === 409 && typeof data.sourceRegister === "number" && riskSequenceId !== null) {
        const nextSeqId = apiErr.data?.next_sequence_id ?? riskSequenceId + 1;
        const teamCode = sourceRegisterTeams.find(t => t.id === data.sourceRegister)?.code
          ?? String(data.sourceRegister);
        const customerCode = customers.find(c => c.id === data.customer)?.code ?? null;
        setRiskCodeConflict({
          taken: buildRiskCode(data.year, teamCode, data.quarter, riskSequenceId, customerCode),
          next:  buildRiskCode(data.year, teamCode, data.quarter, nextSeqId, customerCode),
        });
        setRiskSequenceId(nextSeqId);
      } else {
        setSubmitError(apiErr.message ?? "Failed to submit risk. Please try again.");
      }
      return;
    }

    // The risk already exists at this point — an upload failure below must
    // never be reported as a failed submission (that would invite a retry,
    // which would create a duplicate risk) and must never block reaching the
    // success step.
    // Risk-level evidence attachments ("Risk Evidence Attachment"): the risk
    // doesn't exist until the call above returns an id, so these are staged
    // in form state through the whole wizard and only uploaded now. Each
    // upload is caught individually so one failure doesn't stop the rest of
    // the batch from being attempted.
    const failedReasons: string[] = [];
    for (const attachment of data.evidenceAttachments) {
      if (!attachment.file) continue;
      try {
        await uploadRiskEvidence(authFetch, created.id, {
          evidenceType: "ACTION_PLAN_ATTACHMENT",
          file: attachment.file,
          note: attachment.note || undefined,
        });
      } catch (err) {
        failedReasons.push(err instanceof Error ? err.message : `"${attachment.file.name}" failed to upload`);
      }
    }
    if (failedReasons.length > 0) {
      setAttachmentWarning(
        `The risk was created, but one or more attachments failed to upload (${failedReasons.join("; ")}). Add them from the risk details view.`,
      );
    }

    setActiveStep(STEPS.length);
  };

  const stepContent: JSX.Element[] = [
    <BasicInformationStep
      riskSequenceId={riskSequenceId}
      sourceRegisterTeams={sourceRegisterTeams}
      complianceRefs={complianceRefs}
      riskCategories={riskCategories}
      lookups={{ platforms, customers, products, deploymentTypes }}
      onCustomerAdded={(c) =>
        setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
      }
    />,
    <RiskAssessmentStep riskScores={riskScores} />,
    <ActionPlanStep
      assignmentTeams={assignmentTeams}
      riskScores={riskScores}
    />,
  ];

  return (
    // No `maxWidth: 1500, mx: "auto"` clamp, unlike the grc-platform source:
    // One WSO2's side rail is narrower, so the clamp left the form centred in a
    // band of whitespace while Risk Registers and every other page run edge to
    // edge. Same reason as CreateAuditPage, which dropped the same clamp.
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
        Add a Risk
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Complete all three steps to register a new risk in the system.
      </Typography>

      <FormProvider {...methods}>
        <Paper
          component="form"
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: 2,
            ...darkCardSx,
          }}
          onSubmit={(e) => e.preventDefault()}
          noValidate
        >
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Divider sx={{ mb: 4 }} />

          {isComplete ? (
            <SuccessState onReset={handleReset} warning={attachmentWarning} />
          ) : (
            <Stack gap={4}>
              {fetchError && (
                <Alert severity="error">
                  {fetchError}
                </Alert>
              )}

              {riskCodeConflict && (
                <Alert
                  severity="warning"
                  onClose={() => setRiskCodeConflict(null)}
                >
                  Risk code <strong>{riskCodeConflict.taken}</strong> was just claimed by another
                  submission. Your new risk code is <strong>{riskCodeConflict.next}</strong>.
                  Please review and resubmit.
                </Alert>
              )}

              {submitError && (
                <Alert severity="error" onClose={() => setSubmitError(null)}>
                  {submitError}
                </Alert>
              )}

              {stepContent[activeStep]}

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleBack}
                  disabled={activeStep === 0}
                >
                  Back
                </Button>

                <Typography variant="body2" color="text.secondary">
                  Step {activeStep + 1} of {STEPS.length}
                </Typography>

                {isLastStep ? (
                  <Button variant="contained" type="button" onClick={() => handleSubmit(onSubmit)()}>
                    Submit
                  </Button>
                ) : (
                  <Button type="button" variant="contained" onClick={handleNext}>
                    Next
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
        </Paper>
      </FormProvider>
    </Box>
  );
}
