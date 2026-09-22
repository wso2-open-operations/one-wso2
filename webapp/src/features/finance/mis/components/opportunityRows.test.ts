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
import {
  OPPORTUNITY_COLUMNS,
  opportunityRows,
  opportunityCloudTotal,
  opportunitySoftwareTotal,
  type OpportunityResponse,
} from "./opportunityRows";

// The opportunities behind one account on the Software/Cloud Customers table.
//
// Ported from digiops-finance `arrDashboard/components/OpportunitiesDialog.js`
// and `arrDashboard/hooks/useOpportunities.js`.
//
// Two totals are computed here rather than read: the backend sends `arr` and
// `cloudArr` as aggregates, and the source prefers them ONLY when they are
// present and positive, summing the components otherwise
// (`OpportunitiesDialog.js:73-80`, `:104-110`). That rule is reproduced,
// because a total that disagreed with the columns beside it is exactly what
// Finance would find during the parallel period.

const opportunity = (over: Partial<OpportunityResponse> = {}): OpportunityResponse => ({
  id: "OPP-1",
  name: "Renewal FY26",
  stageName: "Closed Won",
  confidence: "80",
  partnerType: "Direct",
  subscriptionStartDate: "2026-01-01",
  subscriptionEndDate: "2026-12-31",
  apimArr: 10,
  iamArr: 20,
  integrationArr: 30,
  apimCloudArr: 1,
  iamCloudArr: 2,
  integrationCloudArr: 3,
  choreoArr: 4,
  agentPlatformArr: 5,
  moesifArr: 6,
  ...over,
});

describe("opportunityRows", () => {
  it("carries the account onto every row, which the response does not", () => {
    const rows = opportunityRows([opportunity()], { id: "ACC-1", name: "Northwind" });
    expect(rows[0]).toMatchObject({ accountId: "ACC-1", accountName: "Northwind" });
  });

  it("reads each opportunity's own fields", () => {
    const [row] = opportunityRows([opportunity()], { id: "ACC-1", name: "Northwind" });
    expect(row).toMatchObject({
      id: "OPP-1",
      name: "Renewal FY26",
      stageName: "Closed Won",
      partnerType: "Direct",
    });
  });

  // A `decimal` arriving as a string is what a Ballerina service does when
  // precision matters, and every figure column here is one.
  it("reads a figure that arrived as a string", () => {
    const [row] = opportunityRows(
      [opportunity({ apimArr: "1234.50" as unknown as number })],
      { id: "ACC-1", name: "Northwind" },
    );
    expect(row.apimArr).toBe(1234.5);
  });

  it("reads a missing figure as zero rather than NaN", () => {
    const [row] = opportunityRows([opportunity({ apimArr: undefined })], {
      id: "ACC-1",
      name: "Northwind",
    });
    expect(row.apimArr).toBe(0);
  });

  it("reads a body that is not a list as no rows", () => {
    expect(opportunityRows(undefined, { id: "ACC-1", name: "Northwind" })).toEqual([]);
  });

  // Every row needs its own id for the table, and the backend's opportunity id
  // is not guaranteed unique across a response.
  it("gives every row its own key even when two opportunities share an id", () => {
    const rows = opportunityRows([opportunity({ id: "dup" }), opportunity({ id: "dup" })], {
      id: "ACC-1",
      name: "Northwind",
    });
    expect(rows[0].rowId).not.toBe(rows[1].rowId);
  });
});

describe("the two totals", () => {
  // The source's rule, verbatim: prefer the backend's aggregate when it is
  // present AND positive, otherwise add the components.
  it("prefers the backend's software aggregate when it sent a positive one", () => {
    expect(opportunitySoftwareTotal(opportunityRows([opportunity({ arr: 999 })], ACCOUNT)[0])).toBe(
      999,
    );
  });

  it("adds the software components when the aggregate is absent", () => {
    expect(opportunitySoftwareTotal(opportunityRows([opportunity()], ACCOUNT)[0])).toBe(60);
  });

  // `0` is treated as "not sent" by the source — `apiTotal > 0` — so an
  // opportunity whose software really is zero falls through to the sum, which
  // is also zero. The two agree, which is why the quirk is harmless and
  // reproduced rather than corrected.
  it("adds the components when the aggregate is zero, as the source does", () => {
    const row = opportunityRows(
      [opportunity({ arr: 0, apimArr: 5, iamArr: 0, integrationArr: 0 })],
      ACCOUNT,
    )[0];
    expect(opportunitySoftwareTotal(row)).toBe(5);
  });

  it("prefers the backend's cloud aggregate, and sums the six otherwise", () => {
    expect(opportunityCloudTotal(opportunityRows([opportunity({ cloudArr: 42 })], ACCOUNT)[0])).toBe(
      42,
    );
    expect(opportunityCloudTotal(opportunityRows([opportunity()], ACCOUNT)[0])).toBe(21);
  });
});

const ACCOUNT = { id: "ACC-1", name: "Northwind" };

describe("OPPORTUNITY_COLUMNS", () => {
  it("heads its columns the way the source does, in its order", () => {
    expect(OPPORTUNITY_COLUMNS.map((column) => column.label)).toEqual([
      "Account ID",
      "Account Name",
      "Opportunity Id",
      "Opportunity Name",
      "Stage Name",
      "Confidence",
      "Source",
      "Subscription Start Date",
      "Subscription End Date",
      "API Platform",
      "IAM",
      "Integration",
      "Software Total",
      // Verbatim from `tableConstants.js`'s CLOUD_BUSINESS_UNITS. These name
      // the products Finance reconciles against, so the "+ Bjira" and
      // "+ Asgardeo" tails are part of the header rather than decoration.
      "API Platform Private Cloud + Bjira",
      "IAM Private Cloud + Asgardeo",
      "Integration Private Cloud + Devant",
      "Choreo",
      "Agent Platform",
      "Moesif",
      "Cloud Total",
    ]);
  });

  // `Source` heads the partner-type column, which CONTEXT.md would otherwise
  // have called Channel / Direct. It is the source's header and Finance reads
  // it, so it stays — the same carve-out §8 makes for the Region Summary's
  // `Loss` and `First Sale`.
  it("keeps the source's word for the partner-type column", () => {
    const partnerType = OPPORTUNITY_COLUMNS.find((column) => column.key === "partnerType");
    expect(partnerType?.label).toBe("Source");
  });
});
