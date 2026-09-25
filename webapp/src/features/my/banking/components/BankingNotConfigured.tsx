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

import { Tooltip, Typography } from "@wso2/oxygen-ui";

// What every Banking surface shows when no banking backend URL is configured:
// a muted "Not configured" with the setting to change on hover. One
// component so the page, its tabs and the overview card cannot word it
// differently.
export default function BankingNotConfigured({ sx }: { sx?: Record<string, string | number> }) {
  return (
    <Tooltip title="Set ONE_WSO2_BANKING_BACKEND_URL to enable this." placement="top">
      <Typography sx={{ color: "text.disabled", fontStyle: "italic", cursor: "help", ...sx }}>
        Not configured
      </Typography>
    </Tooltip>
  );
}
