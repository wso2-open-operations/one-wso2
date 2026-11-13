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

import { useState, type JSX } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router";
import { Alert, Box, Button, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreQuote, SwagStoreWallet } from "../../api/swagStoreTypes";
import TintedChip from "../../components/TintedChip";
import { swagStorePaths } from "../../swagStorePaths";
import { formatCoins } from "../../util/coins";
import { errorCodeOf, messageFor, problemMessage } from "../../util/swagStoreError";
import { walletLabel } from "../../util/wallets";
import { usePlaceOrder, useQuote } from "../api/useCheckout";
import { useChosenWallet } from "../api/useChosenWallet";
import { useOffices } from "../api/useShopData";
import { useWallets } from "../api/useWallets";
import OfficePicker from "../components/OfficePicker";
import PlaceOrderDialog from "../components/PlaceOrderDialog";
import WalletPicker from "../components/WalletPicker";

const LAYOUT_SX = {
  display: "grid",
  gap: 3,
  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 3fr) minmax(300px, 2fr)" },
  alignItems: "start",
} as const;

/**
 * `/store/cart/checkout?office=`: pick the office and wallet, see the
 * backend's quote, and place the order. The UI never decides the total or
 * whether the order can go through; the quote does.
 */
export default function CheckoutPage(): JSX.Element {
  useDocumentTitle("Checkout · Swag Store");
  const [searchParams, setSearchParams] = useSearchParams();
  const offices = useOffices();
  const wallets = useWallets();
  const { wallet, choose: chooseWallet } = useChosenWallet(wallets.data);

  const linked = searchParams.get("office") ?? undefined;
  const officeList = offices.data?.items ?? [];
  const officeId = officeList.some((o) => o.id === linked) ? linked : (offices.data?.defaultOfficeId ?? undefined);
  const office = officeList.find((o) => o.id === officeId);
  const walletSlot = wallet && wallets.data ? wallets.data.indexOf(wallet) : -1;

  const quote = useQuote(
    office && wallet ? { pickupOfficeId: office.id, walletAddress: wallet.walletAddress, walletSlot } : undefined,
  );

  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mt: 0, mb: 2 }}>
        Checkout
      </Typography>
      <Box sx={LAYOUT_SX}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {offices.isPending ? (
            <Skeleton variant="rounded" height={120} aria-label="Loading the pickup offices" />
          ) : offices.isError ? (
            <ErrorNotice onRetry={() => void offices.refetch()} retrying={offices.isFetching} error={offices.error}>
              Couldn&apos;t load the pickup offices.
            </ErrorNotice>
          ) : officeList.length === 0 ? (
            <Alert severity="info">There are no pickup offices open right now. Try again later.</Alert>
          ) : (
            <OfficePicker
              offices={officeList}
              chosenId={officeId}
              onChoose={(id) => setSearchParams({ office: id }, { replace: true })}
            />
          )}
          {wallets.isPending ? (
            <Skeleton variant="rounded" height={80} aria-label="Loading your wallets" />
          ) : wallets.isError ? (
            <ErrorNotice onRetry={() => void wallets.refetch()} retrying={wallets.isFetching}>
              Couldn&apos;t load your wallets. {messageFor(wallets.error)}
            </ErrorNotice>
          ) : wallets.data.length === 0 ? (
            <Alert severity="info">You need an O2C wallet to pay.</Alert>
          ) : (
            <WalletPicker wallets={wallets.data} chosen={wallet} onChoose={chooseWallet} />
          )}
        </Box>
        <OrderSummary
          quote={quote}
          ready={Boolean(office && wallet)}
          officeId={office?.id}
          officeName={office?.name ?? ""}
          wallet={wallet}
        />
      </Box>
    </Box>
  );
}

interface OrderSummaryProps {
  readonly quote: ReturnType<typeof useQuote>;
  /** An office and a wallet are chosen, so there is something to price. */
  readonly ready: boolean;
  readonly officeId: string | undefined;
  readonly officeName: string;
  readonly wallet: SwagStoreWallet | undefined;
}

function OrderSummary({ quote, ready, officeId, officeName, wallet }: OrderSummaryProps): JSX.Element {
  const navigate = useNavigate();
  const place = usePlaceOrder();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  // One idempotency key per attempt at the same cart, office and wallet: a
  // retry sends it again so the order is placed once; any change gets a new one.
  const [attempt, setAttempt] = useState<{ signature: string; key: string } | null>(null);

  if (!ready) {
    return (
      <Card variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Choose a pickup office and a wallet to see your total.
        </Typography>
      </Card>
    );
  }
  if (quote.isPending) return <Skeleton variant="rounded" height={240} aria-label="Pricing your order" />;
  if (quote.isError) {
    return (
      <ErrorNotice onRetry={() => void quote.refetch()} retrying={quote.isFetching} error={quote.error}>
        Couldn&apos;t price your order.
      </ErrorNotice>
    );
  }
  const q = quote.data;
  if (q.lines.length === 0) {
    return (
      <Card variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: "grid", justifyItems: "start", gap: 1.5 }}>
        <Typography>Your cart is empty.</Typography>
        <Button component={RouterLink} to={swagStorePaths.shop} variant="outlined">
          Browse the store
        </Button>
      </Card>
    );
  }

  const signature = signatureOf(q, officeId, wallet);
  const key = attempt?.signature === signature ? attempt.key : undefined;
  const canPlace = q.canPlace && !quote.isFetching;

  const openDialog = () => {
    place.reset();
    setNotice(undefined);
    if (!key) setAttempt({ signature, key: crypto.randomUUID() });
    setOpen(true);
  };

  const confirm = () => {
    const idempotencyKey = key ?? attempt?.key;
    if (!officeId || !wallet || !idempotencyKey) return;
    place.mutate(
      {
        input: { pickupOfficeId: officeId, walletAddress: wallet.walletAddress, expectedTotal: q.total },
        idempotencyKey,
      },
      {
        onSuccess: (order) => navigate(`${swagStorePaths.order(order.orderNo)}?placed=1`),
        onError: (err) => {
          if (errorCodeOf(err) !== "quote_changed") return;
          // The cart or a price moved since the quote: show the new one rather than charge it.
          setOpen(false);
          setNotice(messageFor(err));
          void quote.refetch();
        },
      },
    );
  };

  return (
    <Card variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
        Order summary
      </Typography>
      {notice && <Alert severity="warning">{notice}</Alert>}
      <Box component="ul" sx={{ m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {q.lines.map((line) => (
          <Box component="li" key={line.lineId} sx={{ listStyle: "none" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {line.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {[line.options, `${line.quantity} × ${formatCoins(line.unitPrice)}`].filter(Boolean).join(" · ")}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={line.state === "OK" ? undefined : { color: "text.secondary", textDecoration: "line-through" }}
              >
                {formatCoins(line.unitPrice * line.quantity)}
              </Typography>
            </Box>
            {line.state !== "OK" && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5, flexWrap: "wrap" }}>
                <TintedChip color="warning" label="Can't be ordered" />
                <Typography variant="body2" color="text.secondary">
                  {line.reason}
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2">Pickup · Free</Typography>
        <Typography variant="body2">0 O2C</Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }} data-testid="quote-total">
        <Typography>Total</Typography>
        <Typography variant="h6" component="p" sx={{ fontWeight: 600 }}>
          {formatCoins(q.total)}
        </Typography>
      </Box>
      {q.problems.length > 0 && (
        <Alert severity="warning">
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {q.problems.map((p) => (
              <li key={p.code}>{problemMessage(p)}</li>
            ))}
          </Box>
        </Alert>
      )}
      <Button variant="contained" size="large" disabled={!canPlace} onClick={openDialog}>
        Place order
      </Button>
      <Typography variant="body2" color="text.secondary">
        Paid orders are final. There are no cancellations, returns or refunds.
      </Typography>
      <PlaceOrderDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        pending={place.isPending}
        error={place.isError && errorCodeOf(place.error) !== "quote_changed" ? messageFor(place.error) : undefined}
        total={q.total}
        officeName={officeName}
        walletText={wallet ? walletLabel(wallet) : ""}
      />
    </Card>
  );
}

/** What an idempotency key stands for: this office, this wallet, these lines at this total. */
function signatureOf(quote: SwagStoreQuote, officeId: string | undefined, wallet: SwagStoreWallet | undefined): string {
  const lines = quote.lines.map((l) => `${l.lineId}:${l.quantity}:${l.unitPrice}`).join(",");
  return `${officeId}|${wallet?.walletAddress}|${quote.total}|${lines}`;
}
