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

// riskPath is where a risk opens: the register's own deep link. The register
// checks what the user may see, so a link is only ever a shortcut and never a way
// in.
export const riskPath = (id: number): string => `/security/risk/registers?riskId=${id}`;

// controlPath is where a control opens: the Audit Hub's own deep link. The Audit
// Hub checks what the user may see, so a link is only ever a shortcut and never a
// way in.
export const controlPath = (auditId: number, controlId: number): string =>
  `/security/audit/audits/${auditId}?control=${controlId}`;
