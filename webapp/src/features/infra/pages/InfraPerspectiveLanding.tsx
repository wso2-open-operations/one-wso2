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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import PerspectiveLanding from "@components/perspective-landing/PerspectiveLanding";
import { isInfraBackendConfigured } from "@config/apiConfig";
import InfraShell from "../components/InfraShell";

/**
 * `/infra` forwards to the first rail item when the backend is set. When it is
 * not, show the same configuration notice InfraShell used on the old Overview
 * instead of PerspectiveLanding's empty "Nothing here" state.
 */
export default function InfraPerspectiveLanding() {
  if (!isInfraBackendConfigured()) {
    return (
      <InfraShell title="Digital Operations" requireAuthorized={false}>
        {null}
      </InfraShell>
    );
  }
  return <PerspectiveLanding />;
}
