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

import { useState } from "react";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type { SwagStoreWallet } from "../../api/swagStoreTypes";
import { defaultWalletOf } from "./useWallets";

const storageKey = (sub: string | undefined) => `swag-store:${sub ?? "anonymous"}:wallet`;

function readChoice(sub: string | undefined): string | undefined {
  try {
    return window.sessionStorage.getItem(storageKey(sub)) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeChoice(sub: string | undefined, address: string): void {
  try {
    window.sessionStorage.setItem(storageKey(sub), address);
  } catch {
    // Storage can be blocked. The choice then lasts only for this page.
  }
}

/**
 * The wallet the shopper pays with: the one they picked in this tab, while it
 * is still one of theirs, else the default. The pick is kept for the tab
 * (per signed-in person), so the cart and checkout agree without putting a
 * wallet address in the address bar.
 */
export function useChosenWallet(wallets: readonly SwagStoreWallet[] | undefined): {
  readonly wallet: SwagStoreWallet | undefined;
  readonly choose: (address: string) => void;
} {
  const { sub } = useSwagStoreBasis();
  const [chosen, setChosen] = useState(() => readChoice(sub));
  const wallet = wallets?.find((w) => w.walletAddress === chosen) ?? defaultWalletOf(wallets);
  const choose = (address: string) => {
    setChosen(address);
    writeChoice(sub, address);
  };
  return { wallet, choose };
}
