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
import type { EmployeeDirectoryRecord } from "@features/org-chart/api/orgChartTypes";
import { indexPeople } from "./useAmplifyPeople";

function record(partial: Partial<EmployeeDirectoryRecord>): EmployeeDirectoryRecord {
  return {
    employeeId: "e1",
    firstName: "Ada",
    lastName: "Lovelace",
    workEmail: "Ada@WSO2.com",
    employeeThumbnail: "https://cdn.example/ada.png",
    jobBand: null,
    startDate: "2020-01-01",
    managerEmail: "boss@wso2.com",
    businessUnit: "BU",
    team: "Team",
    subTeam: null,
    unit: null,
    employmentType: "Permanent",
    company: "WSO2",
    workLocation: "US",
    employeeStatus: "Active",
    ...partial,
  };
}

describe("indexPeople", () => {
  it("keys by lowercased work email, with full name and photo", () => {
    const people = indexPeople([record({})]);
    expect(people.get("ada@wso2.com")).toEqual({ name: "Ada Lovelace", photoUrl: "https://cdn.example/ada.png" });
  });

  it("trims the email before keying, so a padded directory value still matches a clean lookup", () => {
    const people = indexPeople([record({ workEmail: "  Ada@WSO2.com " })]);
    expect(people.get("ada@wso2.com")?.name).toBe("Ada Lovelace");
  });

  it("treats a missing or empty thumbnail as no photo", () => {
    const people = indexPeople([record({ employeeThumbnail: null }), record({ workEmail: "b@wso2.com", employeeThumbnail: "" })]);
    expect(people.get("ada@wso2.com")?.photoUrl).toBeNull();
    expect(people.get("b@wso2.com")?.photoUrl).toBeNull();
  });

  it("skips rows without a work email instead of crashing", () => {
    const people = indexPeople([
      record({ workEmail: null as unknown as string }),
      record({ workEmail: "" }),
      record({ workEmail: "grace@wso2.com", firstName: "Grace", lastName: "Hopper" }),
    ]);
    expect([...people.keys()]).toEqual(["grace@wso2.com"]);
  });
});
