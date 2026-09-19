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

import { Divider, Stack, Typography } from "@wso2/oxygen-ui";
import type { UmtUpdateSummary } from "../../../api/umtUpdates";
import UmtUpdateDetailsGrid from "../../UmtUpdateDetailsGrid";
import UmtUpdateViewSections from "../../UmtUpdateViewSections";

// Verifying is a read-only rendering of the same data shown in the View tab,
// so this reuses the View tab's own section components instead of
// duplicating them.
export default function UmtVerifyingStep({ id, update }: { id: string; update: UmtUpdateSummary }) {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">Verifying</Typography>
      <UmtUpdateDetailsGrid id={id} update={update} loading={false} canEdit={false} />
      <Divider />
      <UmtUpdateViewSections id={id} update={update} />
    </Stack>
  );
}
