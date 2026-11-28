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

import { Link as RouterLink, useParams } from "react-router";
import { Alert, Button, Link, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import DecisionNotice from "../../components/DecisionNotice";
import { RequestStatusChip } from "../../components/ProcurementChips";
import SavedRequestSummary from "../../components/SavedRequestSummary";
import { useProcurementMe, useRequest } from "../../api/useProcurement";
import BudgetEdit from "../components/BudgetEdit";
import HandlingPanel from "../components/HandlingPanel";
import OverrideReview from "../components/OverrideReview";
import { workspacePaths } from "../workspacePaths";

export default function TeamRequestPage() {
  const { requestId } = useParams();
  const request = useRequest(requestId);
  const me = useProcurementMe();
  const data = request.data;
  const handling = data && (data.status === "approved" || data.status === "assigned");

  return (
    <>
      <Link component={RouterLink} to={workspacePaths.queue} underline="none" sx={{ display: "inline-block", mb: 2 }}>
        ← Requests
      </Link>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{data ? `${data.reference ?? "Draft"} - ${data.title}` : "Purchase request"}</Typography>
        {data && <RequestStatusChip status={data.status} />}
      </Stack>
      {request.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void request.refetch()}>
              Retry
            </Button>
          }
        >
          {describeError(request.error)}
        </Alert>
      )}
      {request.isPending && !request.isError && <Skeleton variant="rounded" height={320} />}
      {data && (
        <Stack spacing={2}>
          <DecisionNotice request={data} />
          {handling && !me.data && me.isError && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => void me.refetch()}>
                  Retry
                </Button>
              }
            >
              Who you are could not be read, so the assignment and budget controls are hidden. {describeError(me.error)}
            </Alert>
          )}
          {data.status === "approved" && me.data && <OverrideReview request={data} me={me.data} />}
          {handling && me.data && <HandlingPanel request={data} me={me.data.email} />}
          <SavedRequestSummary request={data} budgetAction={handling && me.data ? <BudgetEdit request={data} me={me.data.email} /> : undefined} />
        </Stack>
      )}
    </>
  );
}
