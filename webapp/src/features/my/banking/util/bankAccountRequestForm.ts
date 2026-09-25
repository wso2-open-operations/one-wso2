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

import type { AccountType } from "../../api/types";
import type { CreateBankAccountRequestPayload } from "../../api/types";

export interface BankAccountFormValues {
  accountName: string;
  beneficiaryAddress: string;
  // UI-only — drives the Bank Location step's default, never sent to the
  // backend (the source app's own request body has no country field
  // either, only bankLocation).
  accountHolderCountry: string;
  accountNumber: string;
  bankLocation: string;
  bankName: string;
  bankSwiftCode: string;
  bankCode: string;
  bankAddress: string;
  branchName: string;
  branchCode: string;
}

export type BankAccountFormErrors = Partial<Record<keyof BankAccountFormValues, string>>;

// An address needs at least three comma-separated parts (street, city,
// country) — same requirement the source app enforces before a bank account
// change is accepted.
function isWellFormedAddress(value: string): boolean {
  return value.trim().split(",").filter((part) => part.trim().length > 0).length >= 3;
}

// Step 1 — Account Holder Info.
export function validateAccountHolder(values: BankAccountFormValues): BankAccountFormErrors {
  const errors: BankAccountFormErrors = {};

  if (!values.accountName.trim()) {
    errors.accountName = "Account Holder's Name is required";
  }

  if (!values.beneficiaryAddress.trim()) {
    errors.beneficiaryAddress = "Account Holder's Address is required";
  } else if (!isWellFormedAddress(values.beneficiaryAddress)) {
    errors.beneficiaryAddress = "Address should be in the format: Street, City, Country";
  }

  if (!values.accountHolderCountry) {
    errors.accountHolderCountry = "Select a country to continue";
  }

  if (!values.accountNumber.trim()) {
    errors.accountNumber = "Account No is required";
  } else if (values.accountNumber.length > 34) {
    errors.accountNumber = "Account Number must be at most 34 characters";
  }

  return errors;
}

// Step 2 — Bank Info.
export function validateBankInfo(
  values: BankAccountFormValues,
  accountType: AccountType,
): BankAccountFormErrors {
  const errors: BankAccountFormErrors = {};

  if (!values.bankLocation) {
    errors.bankLocation = "Select a bank location to continue";
  }

  if (!values.bankName) {
    errors.bankName = "Select a bank to continue";
  }

  if (!values.bankAddress.trim()) {
    errors.bankAddress = "Bank Address is required";
  } else if (!isWellFormedAddress(values.bankAddress)) {
    errors.bankAddress = "Address should be in the format: Street, City, Country";
  }

  // Consultancy accounts are paid without a branch reference — matches the
  // source app's Yup schema, which only requires these two for the other
  // Account Types.
  if (accountType !== "CONSULTANCY") {
    if (!values.branchName.trim()) errors.branchName = "Branch Name is required";
    if (!values.branchCode.trim()) errors.branchCode = "Branch Code is required";
  }

  return errors;
}

// Today's date as YYYY-MM-DD. The source app stamps this automatically at
// submit time for every Account Type — it is never a field the employee
// edits, despite Consultancy's "Effective Month" appearing on the read-only
// summary once an account exists.
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildCreateBankAccountRequestPayload(
  values: BankAccountFormValues,
  accountType: AccountType,
  employeeEmail: string,
): CreateBankAccountRequestPayload {
  return {
    employeeEmail,
    accountType,
    accountName: values.accountName,
    accountNumber: values.accountNumber,
    beneficiaryAddress: values.beneficiaryAddress,
    bankName: values.bankName,
    bankSwiftCode: values.bankSwiftCode,
    bankCode: values.bankCode,
    bankLocation: values.bankLocation,
    bankAddress: values.bankAddress,
    // Consultancy has no branch reference — sent empty rather than omitted,
    // matching the source app's own request shape (its form always carries
    // these two keys, just not required for Consultancy).
    branchName: accountType === "CONSULTANCY" ? "" : values.branchName,
    branchCode: accountType === "CONSULTANCY" ? "" : values.branchCode,
    effectiveFrom: todayIsoDate(),
  };
}
