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

// My requests — the caller's own submissions. Open to every employee.

import ProcurementShell from "@features/procurement/components/ProcurementShell";
import PurchaseRequestsList from "@features/procurement/components/PurchaseRequestsList";
import { useMyRequests } from "@features/procurement/api/usePurchaseRequests";
import { usePurchasingMe } from "@features/procurement/api/usePurchasingMe";

export default function MyRequestsPage() {
  const requests = useMyRequests();
  const me = usePurchasingMe();

  return (
    <ProcurementShell
      title="My requests"
      subtitle="Track the purchasing requests you've submitted, and where each one is in its approval chain."
    >
      <PurchaseRequestsList
        data={requests.data}
        isLoading={requests.isPending}
        isError={requests.isError}
        error={requests.error}
        onRetry={() => void requests.refetch()}
        me={me.data}
        emptyMessage="You haven't submitted any requests yet"
      />
    </ProcurementShell>
  );
}
