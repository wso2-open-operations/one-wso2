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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCreateBankAccountRequestPayload,
  validateAccountDetails,
  validateBankLookup,
  type BankAccountFormValues,
} from "./bankAccountRequestForm";

function values(overrides: Partial<BankAccountFormValues> = {}): BankAccountFormValues {
  return {
    bankName: "BOC",
    bankSwiftCode: "BOCCLKLX",
    bankCode: "12",
    bankLocation: "Colombo",
    accountName: "P Person",
    beneficiaryAddress: "No 23, Galle Road, Colombo",
    accountNumber: "1234567890",
    bankAddress: "1 Bank Street, Colombo, Sri Lanka",
    branchName: "Head Office",
    branchCode: "001",
    ...overrides,
  };
}

describe("validateBankLookup", () => {
  it("requires a bank to have been selected", () => {
    expect(validateBankLookup(values({ bankName: "" }))).toEqual({
      bankName: "Select a bank to continue",
    });
  });

  it("passes once a bank is selected", () => {
    expect(validateBankLookup(values())).toEqual({});
  });
});

describe("validateAccountDetails", () => {
  it("requires the account holder's name", () => {
    expect(validateAccountDetails(values({ accountName: "" }), "SALARY").accountName).toBe(
      "Account Holder's Name is required",
    );
  });

  it("requires the account holder's address", () => {
    expect(
      validateAccountDetails(values({ beneficiaryAddress: "" }), "SALARY").beneficiaryAddress,
    ).toBe("Account Holder's Address is required");
  });

  it("rejects an address with fewer than three comma-separated parts", () => {
    expect(
      validateAccountDetails(values({ beneficiaryAddress: "No 23, Galle Road" }), "SALARY")
        .beneficiaryAddress,
    ).toBe("Address should be in the format: Street, City, Country");
  });

  it("accepts an address with three or more comma-separated parts", () => {
    expect(
      validateAccountDetails(values({ beneficiaryAddress: "No 23, Galle Road, Colombo" }), "SALARY")
        .beneficiaryAddress,
    ).toBeUndefined();
  });

  it("requires the account number", () => {
    expect(validateAccountDetails(values({ accountNumber: "" }), "SALARY").accountNumber).toBe(
      "Account No is required",
    );
  });

  it("rejects an account number longer than 34 characters", () => {
    expect(
      validateAccountDetails(values({ accountNumber: "1".repeat(35) }), "SALARY").accountNumber,
    ).toBe("Account Number must be at most 34 characters");
  });

  it("requires the bank address, in the same three-part format", () => {
    expect(validateAccountDetails(values({ bankAddress: "" }), "SALARY").bankAddress).toBe(
      "Bank Address is required",
    );
    expect(
      validateAccountDetails(values({ bankAddress: "1 Bank Street" }), "SALARY").bankAddress,
    ).toBe("Address should be in the format: Street, City, Country");
  });

  it("requires branch name and branch code for SALARY", () => {
    const errors = validateAccountDetails(values({ branchName: "", branchCode: "" }), "SALARY");
    expect(errors.branchName).toBe("Branch Name is required");
    expect(errors.branchCode).toBe("Branch Code is required");
  });

  it("requires branch name and branch code for REIMBURSEMENT", () => {
    const errors = validateAccountDetails(
      values({ branchName: "", branchCode: "" }),
      "REIMBURSEMENT",
    );
    expect(errors.branchName).toBe("Branch Name is required");
    expect(errors.branchCode).toBe("Branch Code is required");
  });

  it("does not require branch name or branch code for CONSULTANCY", () => {
    const errors = validateAccountDetails(
      values({ branchName: "", branchCode: "" }),
      "CONSULTANCY",
    );
    expect(errors.branchName).toBeUndefined();
    expect(errors.branchCode).toBeUndefined();
  });

  it("returns no errors for a fully valid SALARY submission", () => {
    expect(validateAccountDetails(values(), "SALARY")).toEqual({});
  });
});

describe("buildCreateBankAccountRequestPayload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25)); // 25 Sep 2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("carries every field through, plus the employee email and account type", () => {
    const payload = buildCreateBankAccountRequestPayload(values(), "SALARY", "person@wso2.com");
    expect(payload).toEqual({
      employeeEmail: "person@wso2.com",
      accountType: "SALARY",
      accountName: "P Person",
      accountNumber: "1234567890",
      beneficiaryAddress: "No 23, Galle Road, Colombo",
      bankName: "BOC",
      bankSwiftCode: "BOCCLKLX",
      bankCode: "12",
      bankLocation: "Colombo",
      bankAddress: "1 Bank Street, Colombo, Sri Lanka",
      branchName: "Head Office",
      branchCode: "001",
      effectiveFrom: "2026-09-25",
    });
  });

  it("sends empty branch name/code for CONSULTANCY, never the source app's own placeholders", () => {
    const payload = buildCreateBankAccountRequestPayload(
      values({ branchName: "", branchCode: "" }),
      "CONSULTANCY",
      "person@wso2.com",
    );
    expect(payload.branchName).toBe("");
    expect(payload.branchCode).toBe("");
  });

  it("stamps effectiveFrom as today, regardless of account type", () => {
    const payload = buildCreateBankAccountRequestPayload(values(), "CONSULTANCY", "person@wso2.com");
    expect(payload.effectiveFrom).toBe("2026-09-25");
  });
});
