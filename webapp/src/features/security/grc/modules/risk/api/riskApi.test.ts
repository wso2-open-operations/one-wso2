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
import type { AddRiskFormValues } from "../pages/add-risk/types";
import { buildCreateRiskPayload } from "./riskApi";

const formValues = (riskAcceptor: AddRiskFormValues["riskAcceptor"]): AddRiskFormValues =>
  ({
    complianceReferences: [],
    riskCategory: "",
    riskAcceptor,
    sourceRegister: "",
    identifiedByType: "TOOL",
    identifiedByName: "",
    identifiedByEmail: "",
    assignedBy: "",
    riskIdentifiedDate: null,
    implementationDate: null,
    reassessmentDate: null,
    assignmentTeam: "",
    riskOwner: "",
    managementApprover: "",
    actionOwner: "",
    actionSteps: [],
    platforms: [],
    customer: "",
    deploymentType: "",
    products: [],
    environments: [],
  }) as unknown as AddRiskFormValues;

describe("buildCreateRiskPayload — risk acceptor", () => {
  it("sends the chosen acceptor", () => {
    expect(buildCreateRiskPayload(formValues("CUSTOMER")).risk_acceptor).toBe("CUSTOMER");
    expect(buildCreateRiskPayload(formValues("WSO2")).risk_acceptor).toBe("WSO2");
  });

  it("leaves it out while none is chosen", () => {
    expect(buildCreateRiskPayload(formValues("")).risk_acceptor).toBeUndefined();
  });
});
