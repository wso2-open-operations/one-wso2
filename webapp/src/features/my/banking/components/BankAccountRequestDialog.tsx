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
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { ACCOUNT_TYPE_LABEL } from "../../api/derive";
import { useBanks } from "../../api/useBanks";
import { useCreateBankAccountRequest } from "../../api/useCreateBankAccountRequest";
import type { AccountType, Bank } from "../../api/types";
import {
  buildCreateBankAccountRequestPayload,
  validateAccountDetails,
  validateBankLookup,
  type BankAccountFormErrors,
  type BankAccountFormValues,
} from "../util/bankAccountRequestForm";

const BLANK_VALUES: BankAccountFormValues = {
  bankName: "",
  bankSwiftCode: "",
  bankCode: "",
  bankLocation: "",
  accountName: "",
  beneficiaryAddress: "",
  accountNumber: "",
  bankAddress: "",
  branchName: "",
  branchCode: "",
};

type DialogStep = "lookup" | "details" | "review";
const STEP_ORDER: DialogStep[] = ["lookup", "details", "review"];
const STEP_LABELS = ["Select Bank", "Account Details", "Review"];

export interface BankAccountRequestDialogProps {
  accountType: AccountType;
  employeeEmail: string;
  onClose: () => void;
  /** Called after a successful submission — the caller closes the dialog and refetches. */
  onSuccess: () => void;
}

// The bank lookup → account details → review flow behind each panel's
// Edit/Add action, replicating the source app's Stepper dialog with this
// app's own component library. Always starts blank: a Change Request is a
// new submission, not an in-place edit of the current Active account — the
// source app's own form does the same regardless of whether one already
// exists.
export default function BankAccountRequestDialog({
  accountType,
  employeeEmail,
  onClose,
  onSuccess,
}: BankAccountRequestDialogProps) {
  const [step, setStep] = useState<DialogStep>("lookup");
  const [values, setValues] = useState<BankAccountFormValues>(BLANK_VALUES);
  const [errors, setErrors] = useState<BankAccountFormErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();

  const banksQuery = useBanks(true);
  const mutation = useCreateBankAccountRequest();

  const isConsultancy = accountType === "CONSULTANCY";
  const stepIndex = STEP_ORDER.indexOf(step);

  function set<K extends keyof BankAccountFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function selectBank(selected: Bank | null) {
    setValues((v) => ({
      ...v,
      bankName: selected?.bankName ?? "",
      bankSwiftCode: selected?.swiftCode ?? "",
      bankCode: selected?.bankCode ?? "",
      bankLocation: selected?.bankLocation ?? "",
    }));
  }

  function goToDetails() {
    const found = validateBankLookup(values);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep("details");
  }

  function goToReview() {
    const found = validateAccountDetails(values, accountType);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep("review");
  }

  async function submit() {
    setSubmitError(undefined);
    try {
      await mutation.mutateAsync(
        buildCreateBankAccountRequestPayload(values, accountType, employeeEmail),
      );
      onSuccess();
    } catch (err) {
      setSubmitError(describeError(err));
    }
  }

  const selectedBank =
    banksQuery.data?.banks.find((b) => b.bankName === values.bankName) ?? null;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{ACCOUNT_TYPE_LABEL[accountType]} bank account</DialogTitle>
      <DialogContent>
        <Stepper activeStep={stepIndex} sx={{ mb: 3 }}>
          {STEP_LABELS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {step === "lookup" &&
          (banksQuery.isError ? (
            <ErrorNotice error={banksQuery.error} onRetry={() => banksQuery.refetch()}>
              Couldn&apos;t load the bank list.
            </ErrorNotice>
          ) : (
            <Autocomplete
              options={banksQuery.data?.banks ?? []}
              loading={banksQuery.isLoading}
              getOptionLabel={(b) => `${b.bankName} (${b.swiftCode})`}
              value={selectedBank}
              onChange={(_, next) => selectBank(next)}
              renderInput={(p) => (
                <TextField
                  {...p}
                  label="Bank"
                  error={Boolean(errors.bankName)}
                  helperText={errors.bankName}
                />
              )}
            />
          ))}

        {step === "details" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Account Holder's Name"
              value={values.accountName}
              onChange={(e) => set("accountName", e.target.value)}
              error={Boolean(errors.accountName)}
              helperText={errors.accountName}
              fullWidth
            />
            <TextField
              label="Account Holder's Address"
              value={values.beneficiaryAddress}
              onChange={(e) => set("beneficiaryAddress", e.target.value)}
              error={Boolean(errors.beneficiaryAddress)}
              helperText={errors.beneficiaryAddress ?? "Street, City, Country"}
              fullWidth
            />
            <TextField
              label="Account No"
              value={values.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              error={Boolean(errors.accountNumber)}
              helperText={errors.accountNumber}
              fullWidth
            />
            <TextField
              label="Bank Address"
              value={values.bankAddress}
              onChange={(e) => set("bankAddress", e.target.value)}
              error={Boolean(errors.bankAddress)}
              helperText={errors.bankAddress ?? "Street, City, Country"}
              fullWidth
            />
            {!isConsultancy && (
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  label="Branch Name"
                  value={values.branchName}
                  onChange={(e) => set("branchName", e.target.value)}
                  error={Boolean(errors.branchName)}
                  helperText={errors.branchName}
                  fullWidth
                />
                <TextField
                  label="Branch Code"
                  value={values.branchCode}
                  onChange={(e) => set("branchCode", e.target.value)}
                  error={Boolean(errors.branchCode)}
                  helperText={errors.branchCode}
                  fullWidth
                />
              </Box>
            )}
          </Box>
        )}

        {step === "review" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <ReviewRow label="Account Type" value={ACCOUNT_TYPE_LABEL[accountType]} />
            <ReviewRow label="Account Holder's Name" value={values.accountName} />
            <ReviewRow label="Account Holder's Address" value={values.beneficiaryAddress} />
            <ReviewRow label="Account No" value={values.accountNumber} />
            <ReviewRow label="Bank" value={`${values.bankName} (${values.bankSwiftCode})`} />
            <ReviewRow label="Bank Address" value={values.bankAddress} />
            {!isConsultancy && (
              <ReviewRow label="Branch" value={`${values.branchName} · ${values.branchCode}`} />
            )}
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <Alert severity="info">
              This submits a change request — your current active account stays in effect until
              it&apos;s approved.
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {step !== "lookup" && (
          <Button onClick={() => setStep(STEP_ORDER[stepIndex - 1])}>Back</Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        {step === "lookup" && <Button variant="contained" onClick={goToDetails}>Next</Button>}
        {step === "details" && <Button variant="contained" onClick={goToReview}>Next</Button>}
        {step === "review" && (
          <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
            Submit
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
