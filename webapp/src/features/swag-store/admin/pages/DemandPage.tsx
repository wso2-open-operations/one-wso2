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

import { useId, useState, type FormEvent, type JSX } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  Drawer,
  IconButton,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreDemandRow } from "../../api/swagStoreTypes";
import { formatCivilDate, formatInstant } from "../../util/civilDate";
import { groupDemand, restockDate, type DemandProduct } from "../../util/demand";
import { messageFor } from "../../util/swagStoreError";
import { useAdminDemand } from "../api/useAdminData";
import { usePatchVariant } from "../api/useAdminMutations";
import { swagStoreAdminPaths } from "../swagStoreAdminItems";

const people = (n: number) => `${n.toLocaleString()} ${n === 1 ? "person" : "people"}`;
const dateText = (civil: string | null) => (civil ? (formatCivilDate(civil) ?? civil) : "Not set");

/**
 * `/people-ops/swag-store/demand` (and `/demand/:productId`, which opens a product's drawer):
 * what people are waiting for, so the store team knows what to restock and can tell shoppers when.
 */
export default function DemandPage(): JSX.Element {
  useDocumentTitle("Demand · Swag Store");
  const { productId } = useParams();
  const navigate = useNavigate();
  const demand = useAdminDemand();
  const products = groupDemand(demand.data ?? []);

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
        Swag Store
      </Typography>
      <Typography component="h1" variant="h5" sx={{ m: 0 }}>
        Demand
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "70ch", mt: 0.5, mb: 2 }}>
        People waiting for items that are out of stock. Set a restock date they will see, then receive stock to
        email them.
      </Typography>
      {demand.isPending ? (
        <Skeleton variant="rounded" height={220} aria-label="Loading the demand board" />
      ) : demand.isError ? (
        <ErrorNotice onRetry={() => void demand.refetch()} retrying={demand.isFetching} error={demand.error}>
          Couldn&apos;t load the demand board.
        </ErrorNotice>
      ) : products.length === 0 ? (
        <Typography color="text.secondary">Nobody is waiting for anything right now.</Typography>
      ) : (
        <DemandTable products={products} />
      )}
      {productId && demand.isSuccess && (
        <DemandDrawer
          key={productId}
          productId={productId}
          product={products.find((p) => p.productId === productId)}
          onClose={() => navigate(swagStoreAdminPaths.demand)}
        />
      )}
    </Box>
  );
}

function DemandTable({ products }: { products: readonly DemandProduct[] }): JSX.Element {
  return (
    <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Product</TableCell>
            <TableCell align="right">Waiting</TableCell>
            <TableCell align="right">Options</TableCell>
            <TableCell>First asked</TableCell>
            <TableCell>Next restock</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.productId} hover>
              <TableCell>
                <Link component={RouterLink} to={swagStoreAdminPaths.demandProduct(p.productId)} sx={{ fontWeight: 600 }}>
                  {p.productName}
                </Link>
              </TableCell>
              <TableCell align="right">{people(p.waiting)}</TableCell>
              <TableCell align="right">
                {p.variants.length} {p.variants.length === 1 ? "option" : "options"}
              </TableCell>
              <TableCell>{formatInstant(p.firstAlertAt)}</TableCell>
              <TableCell>{dateText(p.nextRestock)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

interface DemandDrawerProps {
  readonly productId: string;
  /** Undefined when nobody waits for the product any more. */
  readonly product: DemandProduct | undefined;
  readonly onClose: () => void;
}

function DemandDrawer({ productId, product, onClose }: DemandDrawerProps): JSX.Element {
  const titleId = useId();
  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 460 }, p: 2.5 }, role: "dialog", "aria-labelledby": titleId } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 2 }}>
        <Typography id={titleId} component="h2" variant="h6" sx={{ m: 0 }}>
          {product?.productName ?? "Demand"}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <XIcon size={18} />
        </IconButton>
      </Box>
      {product ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {product.variants.map((v) => (
            <WaitingOption key={v.variantId} productId={productId} row={v} />
          ))}
          <Box>
            <Button component={RouterLink} to={swagStoreAdminPaths.product(productId)} variant="contained">
              Receive stock
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Receiving stock emails everyone waiting for that option.
            </Typography>
          </Box>
        </Box>
      ) : (
        <Typography color="text.secondary">Nobody is waiting for this product now.</Typography>
      )}
    </Drawer>
  );
}

/** One option people wait for, with the restock date they see on the shop. */
function WaitingOption({ productId, row }: { productId: string; row: SwagStoreDemandRow }): JSX.Element {
  const patch = usePatchVariant(productId);
  const labelId = useId();
  const saved = restockDate(row.restockEta) ?? "";
  const [date, setDate] = useState(saved);
  const label = row.options || row.sku;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    patch.mutate({ variantId: row.variantId, patch: { restockEta: date || null } });
  };

  return (
    <Box
      component="form"
      onSubmit={submit}
      role="group"
      aria-labelledby={labelId}
      sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
    >
      <Typography id={labelId} variant="subtitle2" component="h3" sx={{ m: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {row.pendingAlerts.toLocaleString()} waiting · first asked {formatInstant(row.firstAlertAt)} · {row.free.toLocaleString()} free
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          type="date"
          label="Restock date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button type="submit" variant="outlined" size="small" disabled={patch.isPending}>
          {patch.isPending ? "Saving…" : "Save date"}
        </Button>
      </Box>
      {patch.isError && <Alert severity="error">{messageFor(patch.error)}</Alert>}
      {patch.isSuccess && (
        <Typography variant="body2" role="status" color="success.main">
          Saved.
        </Typography>
      )}
    </Box>
  );
}
