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

import { Box, Chip, Skeleton } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useAmplifyCategories } from "../api/useAmplifyData";

/** The category chips (Product news, Customer win, …) from GET /categories. One is always chosen. */
export default function CategoryPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const categories = useAmplifyCategories();

  if (categories.isPending) return <Skeleton variant="rounded" height={32} width={360} />;
  if (categories.isError) {
    return (
      <ErrorNotice error={categories.error} onRetry={() => void categories.refetch()} retrying={categories.isFetching}>
        Couldn&apos;t load the categories.
      </ErrorNotice>
    );
  }

  return (
    <Box role="radiogroup" aria-label="Category" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {categories.data.map((c) => {
        const selected = c.code === value;
        return (
          <Chip
            key={c.code}
            role="radio"
            aria-checked={selected}
            label={c.label}
            color="primary"
            variant={selected ? "filled" : "outlined"}
            onClick={disabled ? undefined : () => onChange(c.code)}
            sx={{ fontWeight: 600 }}
          />
        );
      })}
    </Box>
  );
}
