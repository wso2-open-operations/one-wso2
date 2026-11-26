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

import AdminSettingsForm from "../components/AdminSettingsSections";
import AmplifyShell from "../components/AmplifyShell";

/** The line under the title. */
export const ADMIN_SUBTITLE =
  "Amplify's rules and switches. Changes apply from the next run and are recorded in the audit log. " +
  "Your own LinkedIn link stays in Choreo Labs Settings → My Connections.";

/**
 * Amplify Admin (AmplifyAdminRoute lets in anyone with `CAN_POINT_RULES` or `CAN_ADMIN`): Coins, Point values and the
 * own-post daily limit, saved together; admins also get the LinkedIn page connection and the Amplify posting switch.
 */
export default function AmplifyAdminPage() {
  return (
    <AmplifyShell title="Amplify Admin" subtitle={ADMIN_SUBTITLE}>
      <AdminSettingsForm />
    </AmplifyShell>
  );
}
