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

import type { SwagStoreWallet } from "../api/swagStoreTypes";

/** A wallet address cut to its ends, such as "0x12ab…9f3c", so wallets can be told apart without the whole string. */
export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** "Default wallet" or "Wallet", with the address's ends. */
export function walletLabel(wallet: SwagStoreWallet): string {
  return `${wallet.defaultWallet ? "Default wallet" : "Wallet"} · ${shortAddress(wallet.walletAddress)}`;
}
