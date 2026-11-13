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

import type { JSX } from "react";
import type { ChipProps } from "@wso2/oxygen-ui";
import type { SwagStoreOrderStatus } from "../api/swagStoreTypes";
import TintedChip from "./TintedChip";

const STATUS: Record<SwagStoreOrderStatus, { label: string; color: ChipProps["color"] }> = {
  PENDING_PAYMENT: { label: "Payment pending", color: "warning" },
  CONFIRMED: { label: "Confirmed", color: "info" },
  READY_FOR_PICKUP: { label: "Ready for pickup", color: "success" },
  COLLECTED: { label: "Collected", color: "default" },
  FAILED: { label: "Failed", color: "error" },
};

/** Payment pending, Confirmed, Ready for pickup, Collected or Failed. */
export default function OrderStatusChip({ status }: { status: SwagStoreOrderStatus }): JSX.Element {
  const { label, color } = STATUS[status] ?? { label: status, color: "default" };
  return <TintedChip color={color} label={label} />;
}
