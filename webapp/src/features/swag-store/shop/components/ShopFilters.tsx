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

import { useState, type FormEvent, type JSX } from "react";
import {
  alpha,
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { DEFAULT_SHOP_VIEW, SHOP_SORTS, type ShopSort, type ShopView } from "../../util/shopViewState";
import { useCategories } from "../api/useShopData";

interface ShopFiltersProps {
  readonly view: ShopView;
  readonly onChange: (next: ShopView) => void;
}

/** Search, sort, "In stock only" and category chips. Every change goes back to page 1. */
export default function ShopFilters({ view, onChange }: ShopFiltersProps): JSX.Element {
  const apply = (patch: Partial<ShopView>) => onChange({ ...view, ...patch, page: 1 });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
        {/* Keyed by the applied search, so clearing the filters also clears the box. */}
        <SearchBox key={view.q} applied={view.q} onSearch={(q) => apply({ q })} />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="swag-store-sort-label">Sort by</InputLabel>
          <Select
            labelId="swag-store-sort-label"
            label="Sort by"
            value={view.sort}
            onChange={(e) => apply({ sort: e.target.value as ShopSort })}
          >
            {SHOP_SORTS.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Checkbox checked={view.inStock} onChange={(e) => apply({ inStock: e.target.checked })} />}
          label="In stock only"
        />
      </Box>
      <CategoryChips selected={view.category} onSelect={(category) => apply({ category })} />
    </Box>
  );
}

function SearchBox({ applied, onSearch }: { applied: string; onSearch: (q: string) => void }): JSX.Element {
  const [draft, setDraft] = useState(applied);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <Box component="form" role="search" onSubmit={submit} sx={{ flex: "1 1 260px", maxWidth: 420 }}>
      <TextField
        type="search"
        size="small"
        fullWidth
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search the store"
        slotProps={{
          htmlInput: { "aria-label": "Search the store", maxLength: 100 },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton type="submit" size="small" aria-label="Search" edge="end">
                  <SearchIcon size={18} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}

function CategoryChips({ selected, onSelect }: { selected: string; onSelect: (slug: string) => void }): JSX.Element | null {
  const categories = useCategories();
  if (categories.isError) {
    return (
      <ErrorNotice onRetry={() => void categories.refetch()} retrying={categories.isFetching} error={categories.error}>
        Couldn&apos;t load the categories.
      </ErrorNotice>
    );
  }
  if (!categories.data || categories.data.length === 0) return null;
  const chips = [{ slug: DEFAULT_SHOP_VIEW.category, name: "All" }, ...categories.data];
  return (
    <Box role="group" aria-label="Categories" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {chips.map((c) => {
        const pressed = c.slug === selected;
        return (
          <Chip
            key={c.slug || "all"}
            label={c.name}
            size="small"
            variant="outlined"
            color={pressed ? "primary" : "default"}
            aria-pressed={pressed}
            onClick={() => onSelect(c.slug)}
            sx={(theme) => ({ bgcolor: pressed ? alpha(theme.palette.primary.main, 0.1) : "transparent", fontWeight: pressed ? 600 : 400 })}
          />
        );
      })}
    </Box>
  );
}
