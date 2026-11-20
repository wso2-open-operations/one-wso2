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

import { Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";

// The wording shown above every AI-drafted action plan. The text is a draft
// the user must read and edit; it has not been reviewed by anyone.
export const AI_DRAFT_NOTICE = "AI-generated draft, not reviewed. Check it and edit it before using it.";

export default function AIDraftNotice(): JSX.Element {
  return (
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {AI_DRAFT_NOTICE}
    </Typography>
  );
}
