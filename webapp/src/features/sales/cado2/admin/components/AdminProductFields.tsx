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

import { useState, type HTMLAttributes, type JSX, type Key } from "react";
import { Autocomplete, Chip, TextField } from "@wso2/oxygen-ui";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import type { FormulaProduct } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  ProductListContext,
  productLabel,
  useProductList,
} from "@features/sales/cado2/components/product-list/productList";
import { ProductListPaper, ProductOption } from "@features/sales/cado2/components/product-list/ProductListParts";
import { useFormulaProducts } from "@features/sales/cado2/admin/pricing-formulas/api/usePricingFormulaAdmin";

// The Admin's Salesforce product pickers, any currency or price book: used by
// the pricing formula editor (D81) and the product bundles page.

/** A product in a list: a formula's chosen product may lack a description. */
type ListedProduct = FormulaProduct & { readonly description?: string | null };

/**
 * The product dropdown, as the Add line dialog's (2026-10-15): opening it
 * lists products a page at a time as it scrolls; typing searches the name or
 * product code; each shows as "Name (CODE)" with its description.
 */
function useProductDropdown(term: string, open: boolean) {
  const products = useFormulaProducts(useDebouncedValue(term, 300), open);
  const options: ListedProduct[] = products.data ?? [];
  const { state, listboxProps } = useProductList(products, options.length);
  return {
    options,
    state,
    common: {
      getOptionLabel: (p: ListedProduct) => productLabel(p.name, p.code),
      isOptionEqualToValue: (a: ListedProduct, b: ListedProduct) => a.id === b.id,
      filterOptions: (x: ListedProduct[]) => x,
      loading: products.isPending && products.fetchStatus !== "idle",
      slots: { paper: ProductListPaper },
      slotProps: { listbox: listboxProps },
      renderOption: ({ key, ...props }: HTMLAttributes<HTMLLIElement> & { key: Key }, p: ListedProduct) => (
        <ProductOption key={key} liProps={props} name={p.name} code={p.code} description={p.description} />
      ),
      noOptionsText: products.error ? "Couldn't load the products. Try again." : "No matching products",
    },
  };
}

export function ProductField({
  value,
  onChange,
  error,
  label = "Product",
}: {
  value: FormulaProduct | null;
  onChange: (p: FormulaProduct | null) => void;
  error?: string;
  label?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const list = useProductDropdown(term, open);
  return (
    <ProductListContext.Provider value={list.state}>
      <Autocomplete
        {...list.common}
        options={list.options}
        value={value}
        onOpen={() => setOpen(true)}
        onChange={(_, p) => onChange(p)}
        // Choosing fills the box with the label: that isn't a search.
        onInputChange={(_, v, reason) => setTerm(reason === "reset" ? "" : v)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Search by name or product code"
            error={!!error}
            helperText={error}
          />
        )}
      />
    </ProductListContext.Provider>
  );
}

export function ProductsField({
  name,
  value,
  onChange,
  error,
  helperText = "Stands for the total of these products' lines on the quote, after their discount",
}: {
  name: string;
  value: readonly FormulaProduct[];
  onChange: (p: FormulaProduct[]) => void;
  error?: string;
  helperText?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const list = useProductDropdown(term, open);
  return (
    <ProductListContext.Provider value={list.state}>
      <Autocomplete
        {...list.common}
        multiple
        disableCloseOnSelect
        size="small"
        options={list.options}
        value={[...value]}
        onOpen={() => setOpen(true)}
        onChange={(_, p) => onChange(p)}
        onInputChange={(_, v, reason) => reason !== "reset" && setTerm(v)}
        inputValue={term}
        renderValue={(chosen, getItemProps) =>
          chosen.map((p, i) => {
            const { key, ...props } = getItemProps({ index: i });
            return <Chip key={key} size="small" label={productLabel(p.name, p.code)} {...props} />;
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={value.length ? "" : "Search by name or product code"}
            error={!!error}
            helperText={error ?? helperText}
            inputProps={{ ...params.inputProps, "aria-label": `Products of ${name}` }}
          />
        )}
      />
    </ProductListContext.Provider>
  );
}
