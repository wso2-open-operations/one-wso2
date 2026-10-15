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

import { describe, expect, it } from "vitest";
import { describeUpdateError } from "./useMasterDataMutations";
import { MASTER_DATA_SNACK } from "./masterDataCopy";
import { HttpError } from "@api/http";

const conflict = new HttpError("/expense-types/1", 409, "Conflict");

describe("what a failed update tells the reader", () => {
  // The backend answers 409 to two opposite refusals. Reported the same way,
  // a reader told to "delete other active connections" would go looking for
  // references when the actual blocker is an inactive Gl code.
  it("names the Gl code when a reactivation is refused", () => {
    expect(describeUpdateError(conflict, { status: "active" })).toBe(
      MASTER_DATA_SNACK.error.reactivateConflict,
    );
  });

  it("names the linked data when a retire is refused", () => {
    expect(describeUpdateError(conflict, { status: "inactive" })).toBe(
      MASTER_DATA_SNACK.error.deleteConflict,
    );
  });

  // An edit that never touched status carries none, and the references
  // reading is the one that applies.
  it("falls back to linked data when the patch carries no status", () => {
    expect(describeUpdateError(conflict, { expenseType: "Renamed" })).toBe(
      MASTER_DATA_SNACK.error.deleteConflict,
    );
    expect(describeUpdateError(conflict)).toBe(MASTER_DATA_SNACK.error.deleteConflict);
  });

  it("says the generic thing for anything that is not a 409", () => {
    expect(describeUpdateError(new HttpError("/expense-types/1", 500, "Boom"))).toBe(
      MASTER_DATA_SNACK.error.updating,
    );
    expect(describeUpdateError(new Error("network"))).toBe(MASTER_DATA_SNACK.error.updating);
  });
});
