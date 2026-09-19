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

import type { UmtUpdateProduct } from "../api/umtUpdates";

// A single product already has a non-blank description AND instruction on
// the backend — used to seed the step's initial rows table.
export function umtProductHasDescriptionInstruction(product: UmtUpdateProduct): boolean {
  return Boolean(product.description?.trim()) && Boolean(product.instruction?.trim());
}

// True when EVERY product on the update already has a non-blank description
// AND instruction — the shell's Proceed-gate rule. Unlike Integration Tests'
// equivalent gate, this disables Proceed when there are no products at all,
// rather than treating an empty list as vacuously complete — so this
// deliberately returns `false`, not `true`, for a null/empty list.
export function isDescriptionInstructionComplete(
  products: UmtUpdateProduct[] | null | undefined,
): boolean {
  if (!products || products.length === 0) return false;
  return products.every(umtProductHasDescriptionInstruction);
}
