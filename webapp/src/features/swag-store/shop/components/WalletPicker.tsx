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
import { Box, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Typography } from "@wso2/oxygen-ui";
import type { SwagStoreWallet } from "../../api/swagStoreTypes";
import { formatBalance } from "../../util/coins";
import { walletLabel } from "../../util/wallets";

interface WalletPickerProps {
  readonly wallets: readonly SwagStoreWallet[];
  readonly chosen: SwagStoreWallet | undefined;
  readonly onChoose: (address: string) => void;
}

/** "Pay with": the shopper's wallets, default first, each with its balance. */
export default function WalletPicker({ wallets, chosen, onChoose }: WalletPickerProps): JSX.Element {
  return (
    <FormControl component="fieldset" sx={{ width: "100%" }}>
      <FormLabel component="legend" sx={{ mb: 0.5, fontWeight: 600, color: "text.primary" }}>
        Pay with
      </FormLabel>
      <RadioGroup value={chosen?.walletAddress ?? ""} onChange={(e) => onChoose(e.target.value)}>
        {wallets.map((w) => (
          <FormControlLabel
            key={w.walletAddress}
            value={w.walletAddress}
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2" component="span" sx={{ display: "block" }}>
                  {walletLabel(w)}
                </Typography>
                <Typography variant="body2" component="span" color="text.secondary">
                  {formatBalance(w.balance)}
                </Typography>
              </Box>
            }
            sx={{ alignItems: "flex-start", my: 0.25, ".MuiRadio-root": { pt: 0.5 } }}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
}
