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

import { useId, type JSX } from "react";
import { Link as RouterLink } from "react-router";
import { Alert, Box, IconButton, Link, Tooltip, Typography } from "@wso2/oxygen-ui";
import { Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import type { SwagStoreCartLine, SwagStoreLineState } from "../../api/swagStoreTypes";
import ProductImage from "../../components/ProductImage";
import QuantityStepper from "../../components/QuantityStepper";
import TintedChip from "../../components/TintedChip";
import { swagStorePaths } from "../../swagStorePaths";
import { formatCoins } from "../../util/coins";

/** The cart refuses more than this on one line. */
const MAX_LINE_QUANTITY = 99;

const STATE_LABEL: Record<Exclude<SwagStoreLineState, "OK">, string> = {
  OUT_OF_STOCK: "Out of stock",
  REMOVED: "No longer sold",
  LIMIT: "Over the limit",
};

interface CartLineRowProps {
  readonly line: SwagStoreCartLine;
  /** The first row draws no rule above it. */
  readonly first?: boolean;
  readonly onQuantity: (quantity: number) => void;
  readonly onRemove: () => void;
  /** A change to this line is in flight. */
  readonly busy: boolean;
  /** Why the last change to this line was refused. */
  readonly error?: string;
}

/** One cart line: photo, name, options, price, quantity and Remove. A line that can't be ordered says why. */
export default function CartLineRow({ line, first = false, onQuantity, onRemove, busy, error }: CartLineRowProps): JSX.Element {
  const nameId = useId();
  const what = line.options ? `${line.name}, ${line.options}` : line.name;
  const orderable = line.state === "OK";
  return (
    <Box
      component="li"
      aria-labelledby={nameId}
      sx={{
        display: "grid",
        gridTemplateColumns: "64px minmax(0, 1fr)",
        gap: 2,
        py: 2,
        listStyle: "none",
        borderTop: first ? 0 : 1,
        borderColor: "divider",
      }}
    >
      <ProductImage src={line.image} alt="" height={64} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ minWidth: 0 }}>
            <Link id={nameId} component={RouterLink} to={swagStorePaths.product(line.productSlug)} sx={{ fontWeight: 600 }}>
              {line.name}
            </Link>
            {line.options && (
              <Typography variant="body2" color="text.secondary">
                {line.options}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {formatCoins(line.unitPrice)} each
            </Typography>
          </Box>
          <Typography
            sx={{ fontWeight: 600, ...(orderable ? {} : { color: "text.secondary", textDecoration: "line-through" }) }}
          >
            {formatCoins(line.lineTotal)}
          </Typography>
        </Box>
        {!orderable && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <TintedChip color="warning" label={STATE_LABEL[line.state]} />
            <Typography variant="body2" color="text.secondary">
              {line.reason ? `${line.reason} ` : ""}Not included in the total.
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <QuantityStepper
            value={line.quantity}
            max={MAX_LINE_QUANTITY}
            onChange={onQuantity}
            disabled={busy}
            label={`Quantity of ${what}`}
          />
          <Tooltip title="Remove">
            <span>
              <IconButton aria-label={`Remove ${what}`} onClick={onRemove} disabled={busy} size="small">
                <Trash2Icon size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {error && (
          <Alert severity="error" sx={{ py: 0 }}>
            {error}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
