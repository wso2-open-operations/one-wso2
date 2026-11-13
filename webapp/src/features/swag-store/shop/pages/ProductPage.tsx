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

import { useMemo, useState, type JSX } from "react";
import { Link as RouterLink, useParams, useSearchParams } from "react-router";
import { Alert, Box, Button, CircularProgress, Skeleton, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreProductDetail, SwagStoreVariant } from "../../api/swagStoreTypes";
import PriceTag from "../../components/PriceTag";
import QuantityStepper from "../../components/QuantityStepper";
import StockChip from "../../components/StockChip";
import { swagStorePaths } from "../../swagStorePaths";
import { formatCivilDate } from "../../util/civilDate";
import { messageFor } from "../../util/swagStoreError";
import {
  missingOptions,
  priceRange,
  selectedVariant,
  selectionFromSearch,
  selectionToSearch,
  type OptionSelection,
} from "../../util/variantState";
import { useOffices, useProduct } from "../api/useShopData";
import { useAddToCart } from "../api/useShopMutations";
import AlternativesRow from "../components/AlternativesRow";
import OptionPicker from "../components/OptionPicker";
import ProductGallery from "../components/ProductGallery";

/** The cart refuses more than this on one line. */
const MAX_LINE_QUANTITY = 99;

/** `/store/p/:slug`: one product, its options, and Add to cart. The chosen options live in the address. */
export default function ProductPage(): JSX.Element {
  const { slug = "" } = useParams();
  const product = useProduct(slug);
  useDocumentTitle(product.data ? `${product.data.name} · Swag Store` : "Swag Store");

  let body: JSX.Element;
  if (product.isPending) {
    body = <Skeleton variant="rounded" height={420} aria-label="Loading the item" />;
  } else if (product.isError) {
    body =
      product.error instanceof HttpError && product.error.status === 404 ? (
        <Box sx={{ py: 6, display: "grid", justifyItems: "center", gap: 1.5 }}>
          <Typography variant="body1">This item isn&apos;t in the store.</Typography>
          <Button component={RouterLink} to={swagStorePaths.shop} variant="outlined">
            Back to the store
          </Button>
        </Box>
      ) : (
        <ErrorNotice onRetry={() => void product.refetch()} retrying={product.isFetching} error={product.error}>
          Couldn&apos;t load this item.
        </ErrorNotice>
      );
  } else if (product.data.status === "REMOVED") {
    body = <RemovedProduct product={product.data} />;
  } else {
    // Keyed by product, so a new product starts with a fresh quantity and add state.
    body = <ActiveProduct key={product.data.id} product={product.data} />;
  }

  return (
    <Box>
      <Button
        component={RouterLink}
        to={swagStorePaths.shop}
        size="small"
        startIcon={<ArrowLeftIcon size={16} />}
        sx={{ mb: 1, ml: -1 }}
      >
        Swag Store
      </Button>
      {body}
    </Box>
  );
}

function RemovedProduct({ product }: { product: SwagStoreProductDetail }): JSX.Element {
  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mt: 0, mb: 1 }}>
        {product.name}
      </Typography>
      <StockChip availability="SOLD_OUT" removed />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: "70ch" }}>
        This item has been taken off the store. Orders already placed for it are still being prepared.
      </Typography>
      <AlternativesRow items={product.alternatives} />
    </Box>
  );
}

function ActiveProduct({ product }: { product: SwagStoreProductDetail }): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const selection = useMemo(() => selectionFromSearch(product, search), [product, search]);
  const variant = selectedVariant(product, selection);
  const missing = missingOptions(product, selection);
  const range = priceRange(product);

  const choose = (next: OptionSelection) => setSearchParams(selectionToSearch(product, next), { replace: true });

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 4 },
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 5fr) minmax(0, 6fr)" },
          alignItems: "start",
        }}
      >
        <ProductGallery images={product.images} name={product.name} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <Box>
            <Typography component="h1" variant="h5" sx={{ mt: 0, mb: 0.5 }}>
              {product.name}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              {variant ? (
                <PriceTag amount={variant.price} variant="h6" />
              ) : (
                <PriceTag amount={range.min} from={range.min < range.max} variant="h6" />
              )}
              {variant && (
                <StockChip availability={variant.availability} stockLeft={variant.stockLeft} restockEta={variant.restockEta} />
              )}
            </Box>
          </Box>
          {product.description && (
            <Typography variant="body2" sx={{ whiteSpace: "pre-line", maxWidth: "70ch" }}>
              {product.description}
            </Typography>
          )}
          {product.options.length > 0 && <OptionPicker product={product} selection={selection} onChange={choose} />}
          <BuyBox product={product} variant={variant} missing={missing} hasCombination={missing.length > 0 || Boolean(variant)} />
          <PickupLine />
          <Typography variant="body2" color="text.secondary">
            Before you order: Paid orders are final. There are no cancellations, returns or refunds.
          </Typography>
        </Box>
      </Box>
      <AlternativesRow items={product.alternatives} />
    </Box>
  );
}

interface BuyBoxProps {
  readonly product: SwagStoreProductDetail;
  readonly variant: SwagStoreVariant | undefined;
  readonly missing: readonly string[];
  /** False when every option is chosen but no variant has that combination. */
  readonly hasCombination: boolean;
}

function BuyBox({ product, variant, missing, hasCombination }: BuyBoxProps): JSX.Element {
  const [quantity, setQuantity] = useState(1);
  const add = useAddToCart();

  const buyable = variant?.availability === "IN_STOCK" || variant?.availability === "LOW_STOCK";
  const max = Math.max(
    1,
    Math.min(MAX_LINE_QUANTITY, product.maxPerUser ?? MAX_LINE_QUANTITY, variant?.stockLeft ?? MAX_LINE_QUANTITY),
  );
  const shownQuantity = Math.min(quantity, max);
  // The outcome belongs to the variant it was for; choosing another clears it.
  const outcomeShown = add.variables?.variantId === variant?.id;

  const hint = !hasCombination
    ? "This combination isn't made. Choose another option."
    : missing.length > 0
      ? `Choose a ${listOf(missing.map((m) => m.toLowerCase()))}.`
      : variant?.availability === "OUT_OF_STOCK"
        ? restockHint(variant.restockEta)
        : variant?.availability === "SOLD_OUT"
          ? "Sold out. It won't be restocked. Have a look at the items below instead."
          : undefined;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <QuantityStepper value={shownQuantity} max={max} onChange={setQuantity} disabled={!buyable || add.isPending} />
        {product.maxPerUser !== null && (
          <Typography variant="body2" color="text.secondary">
            Max {product.maxPerUser} per person
          </Typography>
        )}
      </Box>
      <Box>
        <Button
          variant="contained"
          disabled={!buyable || add.isPending}
          onClick={() => variant && add.mutate({ variantId: variant.id, quantity: shownQuantity })}
          startIcon={add.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {add.isPending ? "Adding…" : "Add to cart"}
        </Button>
      </Box>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
      {outcomeShown && add.isSuccess && (
        <Alert
          severity="success"
          role="status"
          action={
            <Button component={RouterLink} to={swagStorePaths.cart} color="inherit" size="small">
              View cart
            </Button>
          }
        >
          Added to your cart.
        </Alert>
      )}
      {outcomeShown && add.isError && <Alert severity="error">{messageFor(add.error)}</Alert>}
    </Box>
  );
}

/** "Pick up at Colombo, about 2 working days after you pay." Nothing while the offices load or fail. */
function PickupLine(): JSX.Element | null {
  const offices = useOffices();
  if (!offices.data || offices.data.items.length === 0) return null;
  const home = offices.data.items.find((o) => o.id === offices.data.defaultOfficeId);
  return (
    <Typography variant="body2">
      {home
        ? `Pick up at ${home.name}, about ${home.leadTimeDays} working ${home.leadTimeDays === 1 ? "day" : "days"} after you pay.`
        : "Pick it up at a WSO2 office. You choose the office at checkout."}
    </Typography>
  );
}

function restockHint(eta: string | null): string {
  const back = eta ? formatCivilDate(eta) : undefined;
  return back ? `Out of stock. It should be back around ${back}.` : "Out of stock. It will be restocked.";
}

/** "colour", "colour and size", "colour, size and fit". */
function listOf(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
