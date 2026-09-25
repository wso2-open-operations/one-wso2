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
  banksLocationKey,
  buildCreateBankAccountRequestPayload,
  validateAccountHolder,
  validateBankInfo,
  type BankAccountFormValues,
} from "./bankAccountRequestForm";

function values(overrides: Partial<BankAccountFormValues> = {}): BankAccountFormValues {
  return {
    accountName: "P Person",
    beneficiaryAddress: "No 23, Galle Road, Colombo",
    accountHolderCountry: "Sri Lanka",
    accountNumber: "1234567890",
    bankLocation: "Sri Lanka",
    bankName: "BOC",
    bankSwiftCode: "BOCCLKLX",
    bankCode: "12",
    bankAddress: "1 Bank Street, Colombo, Sri Lanka",
    branchName: "Head Office",
    branchCode: "001",
    ...overrides,
  };
}

describe("validateAccountHolder", () => {
  // The source's Yup `required()` rejects only an empty string, so a value that
  // is nothing but spaces gets through. Matched exactly, not "improved".
  it("does not trim: spaces-only name and account number pass, like the source", () => {
    const errors = validateAccountHolder(values({ accountName: "   ", accountNumber: "   " }));
    expect(errors.accountName).toBeUndefined();
    expect(errors.accountNumber).toBeUndefined();
  });

  it("requires the account holder's name", () => {
    expect(validateAccountHolder(values({ accountName: "" })).accountName).toBe(
      "Account Holder's Name is required",
    );
  });

  it("requires the account holder's address", () => {
    expect(
      validateAccountHolder(values({ beneficiaryAddress: "" })).beneficiaryAddress,
    ).toBe("Account Holder's Address is required");
  });

  it("rejects an address with fewer than three comma-separated parts", () => {
    expect(
      validateAccountHolder(values({ beneficiaryAddress: "No 23, Galle Road" }))
        .beneficiaryAddress,
    ).toBe("Address must contain at least three elements separated by commas");
  });

  it("counts comma-separated parts the way the source does: untrimmed, so a blank-but-present part still counts", () => {
    expect(
      validateAccountHolder(values({ beneficiaryAddress: "No 23, ,Colombo" })).beneficiaryAddress,
    ).toBeUndefined();
  });

  it("rejects an address with an empty part between commas", () => {
    expect(
      validateAccountHolder(values({ beneficiaryAddress: "No 23,,Colombo" })).beneficiaryAddress,
    ).toBe("Address must contain at least three elements separated by commas");
  });

  it("accepts an address with three or more comma-separated parts", () => {
    expect(
      validateAccountHolder(values({ beneficiaryAddress: "No 23, Galle Road, Colombo" }))
        .beneficiaryAddress,
    ).toBeUndefined();
  });

  it("requires the account holder's country", () => {
    expect(validateAccountHolder(values({ accountHolderCountry: "" })).accountHolderCountry).toBe(
      "Please select a country from the list",
    );
  });

  it("requires the account number", () => {
    expect(validateAccountHolder(values({ accountNumber: "" })).accountNumber).toBe(
      "Account No is required",
    );
  });

  it("rejects an account number longer than 34 characters", () => {
    expect(
      validateAccountHolder(values({ accountNumber: "1".repeat(35) })).accountNumber,
    ).toBe("Account Number must be at most 34 characters");
  });

  it("returns no errors for a fully valid submission", () => {
    expect(validateAccountHolder(values())).toEqual({});
  });
});

describe("validateBankInfo", () => {
  it("does not trim: spaces-only branch name and code pass for SALARY, like the source", () => {
    const errors = validateBankInfo(values({ branchName: "   ", branchCode: "   " }), "SALARY");
    expect(errors.branchName).toBeUndefined();
    expect(errors.branchCode).toBeUndefined();
  });

  it("requires the swift code and bank code too, as the source's schema does", () => {
    const errors = validateBankInfo(values({ bankSwiftCode: "", bankCode: "" }), "SALARY");
    expect(errors.bankSwiftCode).toBe("Swift Code is required");
    expect(errors.bankCode).toBe("Bank Code is required");
  });

  it("requires a bank location to have been selected", () => {
    expect(validateBankInfo(values({ bankLocation: "" }), "SALARY").bankLocation).toBe(
      "Bank Location is required",
    );
  });

  it("requires a bank to have been selected", () => {
    expect(validateBankInfo(values({ bankName: "" }), "SALARY").bankName).toBe(
      "Bank Name is required",
    );
  });

  it("requires the bank address, in the same three-part format", () => {
    expect(validateBankInfo(values({ bankAddress: "" }), "SALARY").bankAddress).toBe(
      "Bank Address is required",
    );
    expect(
      validateBankInfo(values({ bankAddress: "1 Bank Street" }), "SALARY").bankAddress,
    ).toBe("Address must contain at least three elements separated by commas");
  });

  it("requires branch name and branch code for SALARY", () => {
    const errors = validateBankInfo(values({ branchName: "", branchCode: "" }), "SALARY");
    expect(errors.branchName).toBe("Branch Name is required");
    expect(errors.branchCode).toBe("Branch Code is required");
  });

  it("requires branch name and branch code for REIMBURSEMENT", () => {
    const errors = validateBankInfo(values({ branchName: "", branchCode: "" }), "REIMBURSEMENT");
    expect(errors.branchName).toBe("Branch Name is required");
    expect(errors.branchCode).toBe("Branch Code is required");
  });

  it("does not require branch name or branch code for CONSULTANCY", () => {
    const errors = validateBankInfo(values({ branchName: "", branchCode: "" }), "CONSULTANCY");
    expect(errors.branchName).toBeUndefined();
    expect(errors.branchCode).toBeUndefined();
  });

  it("returns no errors for a fully valid SALARY submission", () => {
    expect(validateBankInfo(values(), "SALARY")).toEqual({});
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

  it("carries every backend field through, plus the employee email and account type", () => {
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
      bankLocation: "Sri Lanka",
      bankAddress: "1 Bank Street, Colombo, Sri Lanka",
      branchName: "Head Office",
      branchCode: "001",
      effectiveFrom: "2026-09-25",
      accountHoldersCountry: "Sri Lanka",
    });
  });

  it("sends the account holder's country under the backend's own key, for every account type", () => {
    // The backend's request record requires `accountHoldersCountry` (note the
    // plural) and, for Consultancy, uses it to build the vendor's address.
    for (const type of ["SALARY", "CONSULTANCY", "REIMBURSEMENT"] as const) {
      const payload = buildCreateBankAccountRequestPayload(
        values({ accountHolderCountry: "Maldives" }),
        type,
        "person@wso2.com",
      );
      expect(payload.accountHoldersCountry).toBe("Maldives");
      expect(payload).not.toHaveProperty("accountHolderCountry");
    }
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

describe("banksLocationKey", () => {
  it("maps the US abbreviation to the location name banks are filed under", () => {
    expect(banksLocationKey("US")).toBe("United States");
  });

  it("passes every other location through unchanged", () => {
    expect(banksLocationKey("Sri Lanka")).toBe("Sri Lanka");
    expect(banksLocationKey("")).toBe("");
  });
});
