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

import { Box, Button, Card, Stack, Typography } from "@wso2/oxygen-ui";
import { ACCOUNT_TYPE_LABEL, display } from "../../api/derive";
import type { AccountType, BankAccount } from "../../api/types";

// One field row's label + the BankAccount key it reads. Mirrors
// digiops-hr's own per-Account-Type field configuration (bankAccount.tsx) —
// same fields, same order, this app's own rendering.
interface FieldConfig {
  key: keyof BankAccount;
  label: string;
}

// Consultancy is paid differently from a Salary or Reimbursement account,
// so its field set differs from the other two: payment method + effective
// month instead of the bank-location/swift/branch block.
const ACCOUNT_TYPE_FIELDS: Record<AccountType, FieldConfig[]> = {
  SALARY: [
    { key: "accountName", label: "Account Holder's Name" },
    { key: "beneficiaryAddress", label: "Account Holder's Address" },
    { key: "accountNumber", label: "Account No" },
    { key: "bankLocation", label: "Bank Location" },
    { key: "bankName", label: "Bank Name" },
    { key: "bankSwiftCode", label: "Bank Swift Code" },
    { key: "bankCode", label: "Bank Code" },
    { key: "branchName", label: "Branch Name" },
    { key: "bankAddress", label: "Bank Address" },
  ],
  CONSULTANCY: [
    { key: "accountName", label: "Account Holder's Name" },
    { key: "beneficiaryAddress", label: "Account Holder's Address" },
    { key: "bankName", label: "Bank Name" },
    { key: "accountNumber", label: "Account No" },
    { key: "paymentMethod", label: "Payment Method" },
    { key: "effectiveFrom", label: "Effective Month" },
  ],
  REIMBURSEMENT: [
    { key: "accountName", label: "Account Holder's Name" },
    { key: "beneficiaryAddress", label: "Account Holder's Address" },
    { key: "accountNumber", label: "Account No" },
    { key: "bankLocation", label: "Bank Location" },
    { key: "bankName", label: "Bank Name" },
    { key: "bankSwiftCode", label: "Bank Swift Code" },
    { key: "bankCode", label: "Bank Code" },
  ],
};

export interface BankAccountPanelProps {
  accountType: AccountType;
  /** The employee's current Active account of this type, or undefined if they don't have one yet. */
  account: BankAccount | undefined;
  /** Set (with a reason) to disable the Edit/Add action; unset to leave it enabled. */
  disabledReason?: string;
  /** Opens the edit/add flow for this Account Type. */
  onEdit?: () => void;
}

export default function BankAccountPanel({
  accountType,
  account,
  disabledReason,
  onEdit,
}: BankAccountPanelProps) {
  const fields = ACCOUNT_TYPE_FIELDS[accountType];

  return (
    <Card variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
          {ACCOUNT_TYPE_LABEL[accountType]}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={Boolean(disabledReason)}
          onClick={onEdit}
        >
          {account ? "Edit" : "Add"}
        </Button>
      </Stack>

      {!account ? (
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", py: 1.5 }}>
          Not set up yet.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {fields.map((f) => (
            <Box key={f.key}>
              <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{f.label}</Typography>
              <Typography sx={{ fontSize: 13 }}>{display(account[f.key] as string | null)}</Typography>
            </Box>
          ))}
        </Stack>
      )}

      {disabledReason && (
        <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 1.5 }}>
          {disabledReason}
        </Typography>
      )}
    </Card>
  );
}
