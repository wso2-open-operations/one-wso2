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
import { Alert, Box, Skeleton, Snackbar, Tooltip, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useBankingEmployee } from "../../api/useBankingEmployee";
import { isBankingBackendConfigured, useBankAccounts } from "../../api/useBankAccounts";
import { useBankingConfig } from "../../api/useBankingConfig";
import { useBankingGate } from "../../api/useBankingGate";
import { formatOrdinal, isPastThreshold, isReimbursementEligible } from "../../api/bankingRules";
import type { AccountType } from "../../api/types";
import BankAccountPanel from "../components/BankAccountPanel";
import BankAccountRequestDialog from "../components/BankAccountRequestDialog";

// The first of BankingPage's tabs — ported from digiops-hr's banking
// webapp "Change Bank Account" tab. Three Account Types, each with its own
// multi-step edit form and its own eligibility/deadline rules, is more
// than a dashboard card can hold — and the port's whole point is to keep
// the source app's logic intact, not compress it to fit a smaller
// surface. No Employee Details header here — that information is already
// shown on MyProfilePage, so repeating it would just be a second,
// driftable copy.
export default function MyAccountsTab() {
  // Email from the sign-in token and everything else from the banking
  // backend, as in the source app.
  const asgardeoUser = useAsgardeoUser();
  const ownerEmail = asgardeoUser.email;
  const employee = useBankingEmployee(ownerEmail);
  const accounts = useBankAccounts(ownerEmail);
  const config = useBankingConfig();
  const gate = useBankingGate();
  const configured = isBankingBackendConfigured();
  const [editingType, setEditingType] = useState<AccountType | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; severity: "success" | "error"; message: string }>(
    { open: false, severity: "success", message: "" },
  );

  function handleSubmitted() {
    setEditingType(null);
    void accounts.refetch();
    setSnack({
      open: true,
      severity: "success",
      message: "Your bank account change request has been submitted.",
    });
  }

  if (!configured) {
    return (
      <Tooltip title="Set ONE_WSO2_BANKING_BACKEND_URL to enable this." placement="top">
        <Typography sx={{ color: "text.disabled", fontStyle: "italic", cursor: "help" }}>
          Not configured
        </Typography>
      </Tooltip>
    );
  }

  if (!asgardeoUser.ready || employee.isLoading || accounts.isLoading) {
    return <PanelsSkeleton />;
  }

  if (!ownerEmail) {
    return <ErrorNotice>Couldn&apos;t determine your work email from your sign-in.</ErrorNotice>;
  }

  if (employee.isError) {
    return (
      <ErrorNotice error={employee.error} onRetry={() => employee.refetch()}>
        Couldn&apos;t load your employee details.
      </ErrorNotice>
    );
  }

  if (accounts.isError) {
    return (
      <ErrorNotice error={accounts.error} onRetry={() => accounts.refetch()}>
        Couldn&apos;t load your bank accounts.
      </ErrorNotice>
    );
  }

  const workLocation = employee.data?.location;
  const today = new Date();

  const activeAccountOf = (type: AccountType) =>
    accounts.data?.bankAccounts.find((a) => a.accountType === type && a.accountStatus === "ACTIVE");

  // The Salary/Consultancy day-of-month cutoff and the Reimbursement
  // location allow-list both read the app-config directly; Consultancy's
  // role restriction is decided by the gate instead, since that also needs
  // the caller's Asgardeo groups, not just the config.
  function disabledReasonFor(type: AccountType): string | undefined {
    if (type === "CONSULTANCY" && gate.isResolving) return "Loading…";
    if (type === "CONSULTANCY" && gate.isError) return "Couldn't verify eligibility.";
    if (type !== "CONSULTANCY" && config.isPending) return "Loading…";
    if (config.isError || !config.data) return "Couldn't load banking configuration.";

    if (type === "REIMBURSEMENT") {
      return isReimbursementEligible(workLocation, config.data.reimbursementsAllowedCountries)
        ? undefined
        : "Not available for your work location.";
    }

    const thresholdDay = type === "SALARY" ? config.data.salaryThreshold : config.data.consultancyThreshold;
    return isPastThreshold(today, thresholdDay)
      ? `Changes allowed only until the ${formatOrdinal(thresholdDay)} of each month.`
      : undefined;
  }

  // Fails open on showing the panel (hiding it would wrongly hide
  // Consultancy from an eligible employee whenever the gate hasn't
  // resolved yet or failed) — Edit itself is what fails closed, via
  // disabledReasonFor above.
  const showConsultancy = gate.isResolving || gate.isError || !gate.isConsultancyRestricted;

  return (
    <Box>
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: `repeat(${showConsultancy ? 3 : 2}, 1fr)` },
          gap: 1.75,
        }}
      >
        <BankAccountPanel
          accountType="SALARY"
          account={activeAccountOf("SALARY")}
          disabledReason={disabledReasonFor("SALARY")}
          onEdit={() => setEditingType("SALARY")}
        />
        {showConsultancy && (
          <BankAccountPanel
            accountType="CONSULTANCY"
            account={activeAccountOf("CONSULTANCY")}
            disabledReason={disabledReasonFor("CONSULTANCY")}
            onEdit={() => setEditingType("CONSULTANCY")}
          />
        )}
        <BankAccountPanel
          accountType="REIMBURSEMENT"
          account={activeAccountOf("REIMBURSEMENT")}
          disabledReason={disabledReasonFor("REIMBURSEMENT")}
          onEdit={() => setEditingType("REIMBURSEMENT")}
        />
      </Box>
      {config.data && (
        <Alert severity="warning" sx={{ mt: 1.75 }}>
          Please note that changes to <b>salary</b> bank details can be made only until the{" "}
          <b>{formatOrdinal(config.data.salaryThreshold)}</b>, and <b>consultancy</b> bank details
          until the <b>{formatOrdinal(config.data.consultancyThreshold)}</b>.
        </Alert>
      )}
      {editingType && (
        <BankAccountRequestDialog
          accountType={editingType}
          employeeEmail={ownerEmail ?? ""}
          allCountries={config.data?.allCountries ?? []}
          employeeWorkLocation={workLocation}
          customLocationMap={config.data?.customLocationMap ?? []}
          onClose={() => setEditingType(null)}
          onSuccess={handleSubmitted}
        />
      )}
    </Box>
  );
}

function PanelsSkeleton() {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.75 }}>
      <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
    </Box>
  );
}
