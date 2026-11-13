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
import { Link as RouterLink } from "react-router";
import { Box, Button, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreCart } from "../../api/swagStoreTypes";
import { swagStorePaths } from "../../swagStorePaths";
import { coinsShort, formatCoins } from "../../util/coins";
import { messageFor } from "../../util/swagStoreError";
import { useCart } from "../api/useCartData";
import { useChosenWallet } from "../api/useChosenWallet";
import { useRemoveCartLine, useUpdateCartLine } from "../api/useShopMutations";
import { useWallets } from "../api/useWallets";
import BalanceMeter from "../components/BalanceMeter";
import CartLineRow from "../components/CartLineRow";
import WalletPicker from "../components/WalletPicker";

/** The cart and its summary side by side on a wide screen, stacked on a phone. */
const LAYOUT_SX = {
  display: "grid",
  gap: 3,
  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(280px, 1fr)" },
  alignItems: "start",
} as const;

/** `/store/cart`: the cart's lines, the paying wallet, and Checkout. */
export default function CartPage(): JSX.Element {
  useDocumentTitle("Your cart · Swag Store");
  const cartQuery = useCart();

  let body: JSX.Element;
  if (cartQuery.isPending) {
    body = <Skeleton variant="rounded" height={240} aria-label="Loading your cart" />;
  } else if (cartQuery.isError) {
    body = (
      <ErrorNotice onRetry={() => void cartQuery.refetch()} retrying={cartQuery.isFetching} error={cartQuery.error}>
        Couldn&apos;t load your cart.
      </ErrorNotice>
    );
  } else if (cartQuery.data.lines.length === 0) {
    body = (
      <Box sx={{ py: 6, display: "grid", justifyItems: "center", gap: 1.5 }}>
        <Typography>Your cart is empty.</Typography>
        <Button component={RouterLink} to={swagStorePaths.shop} variant="outlined">
          Browse the store
        </Button>
      </Box>
    );
  } else {
    body = (
      <Box sx={LAYOUT_SX}>
        <CartLines cart={cartQuery.data} />
        <CartSummary total={cartQuery.data.total} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mt: 0, mb: 2 }}>
        Your cart
      </Typography>
      {body}
    </Box>
  );
}

function CartLines({ cart }: { cart: SwagStoreCart }): JSX.Element {
  const update = useUpdateCartLine();
  const remove = useRemoveCartLine();
  const busyLine = update.isPending ? update.variables?.lineId : remove.isPending ? remove.variables : undefined;
  const errorFor = (lineId: string): string | undefined =>
    update.isError && update.variables?.lineId === lineId
      ? messageFor(update.error)
      : remove.isError && remove.variables === lineId
        ? messageFor(remove.error)
        : undefined;

  return (
    <Card variant="outlined" sx={{ px: 2, borderRadius: 1.5 }}>
      <Box component="ul" sx={{ m: 0, p: 0 }}>
        {cart.lines.map((line, i) => (
          <CartLineRow
            key={line.id}
            line={line}
            first={i === 0}
            busy={busyLine === line.id}
            error={errorFor(line.id)}
            onQuantity={(quantity) => update.mutate({ lineId: line.id, quantity })}
            onRemove={() => remove.mutate(line.id)}
          />
        ))}
      </Box>
    </Card>
  );
}

function CartSummary({ total }: { total: number }): JSX.Element {
  const wallets = useWallets();
  const { wallet, choose } = useChosenWallet(wallets.data);
  const short = wallet ? coinsShort(total, wallet.balance) : undefined;

  const blocker =
    total <= 0
      ? "Nothing in your cart can be ordered right now."
      : wallets.isPending
        ? "Checking your balance…"
        : wallets.isError
          ? "Your balance can't be checked right now."
          : !wallet
            ? "You need an O2C wallet to pay."
            : short
              ? `This wallet is ${short} short.`
              : undefined;

  return (
    <Card variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
        Summary
      </Typography>
      {wallets.isError ? (
        <ErrorNotice onRetry={() => void wallets.refetch()} retrying={wallets.isFetching}>
          Couldn&apos;t load your wallets. {messageFor(wallets.error)}
        </ErrorNotice>
      ) : wallets.data && wallets.data.length > 0 ? (
        <WalletPicker wallets={wallets.data} chosen={wallet} onChoose={choose} />
      ) : null}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }} data-testid="cart-total">
        <Typography>Total</Typography>
        <Typography variant="h6" component="p" sx={{ fontWeight: 600 }}>
          {formatCoins(total)}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: -1.5 }}>
        Pickup at your office is free.
      </Typography>
      {wallet && total > 0 && <BalanceMeter total={total} balance={wallet.balance} />}
      {blocker && (
        <Typography variant="body2" color={short ? "error" : "text.secondary"} role="status">
          {blocker}
        </Typography>
      )}
      <Button
        component={RouterLink}
        to={swagStorePaths.checkout}
        variant="contained"
        disabled={Boolean(blocker)}
        aria-disabled={blocker ? "true" : undefined}
      >
        Checkout
      </Button>
    </Card>
  );
}
