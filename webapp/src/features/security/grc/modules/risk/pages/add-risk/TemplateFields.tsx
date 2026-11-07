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

import { useMemo, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Box, ComplexSelect, FormHelperText, Link, Stack, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { LookupOption, RegisterTemplate } from "../../api/riskApi";
import FieldLabel from "./FieldLabel";
import PillMultiSelect from "./PillMultiSelect";
import PlatformPicker from "./PlatformPicker";
import AddCustomerDialog from "./AddCustomerDialog";
import { ENVIRONMENTS, platformChoices } from "./templates";
import type { AddRiskFormValues } from "./types";

export interface TemplateLookups {
  platforms: LookupOption[];
  customers: LookupOption[];
  products: LookupOption[];
  deploymentTypes: LookupOption[];
}

interface TemplateFieldsProps {
  template: RegisterTemplate;
  lookups: TemplateLookups;
  // The platforms and sub-platforms the chosen register offers; empty offers
  // every active one.
  offeredPlatformIds: number[];
}

interface CustomerFieldProps {
  lookups: Pick<TemplateLookups, "customers">;
  // Called when the user adds a customer from here, so the page can add it to
  // the list this field renders.
  onCustomerAdded: (customer: LookupOption) => void;
}

// The Managed Services customer. It sits directly under the Source Register,
// above the risk code, because the customer's code is part of that code and the
// number after it counts per customer: until a customer is chosen there is no
// code to preview. It can't come before the register — the register's template
// decides whether a risk has a customer at all.
export function CustomerField({ lookups, onCustomerAdded }: CustomerFieldProps): JSX.Element {
  const { control, clearErrors, setValue } = useFormContext<AddRiskFormValues>();
  const [adding, setAdding] = useState(false);

  return (
    <Box sx={{ maxWidth: { sm: "50%" } }}>
      <Controller
        name="customer"
        control={control}
        render={({ field, fieldState }) => (
          <Box>
            <FieldLabel required>Customer Name</FieldLabel>
            <ComplexSelect
              {...field}
              fullWidth
              error={!!fieldState.error}
              displayEmpty
              onChange={(e) => {
                field.onChange(e);
                if (e.target.value) clearErrors("customer");
              }}
            >
              <ComplexSelect.MenuItem value="" disabled sx={{ display: "none" }}>
                Select a customer
              </ComplexSelect.MenuItem>
              {lookups.customers.map((c) => (
                <ComplexSelect.MenuItem key={c.id} value={c.id}>
                  {c.name}
                  {c.code ? ` (${c.code})` : ""}
                </ComplexSelect.MenuItem>
              ))}
            </ComplexSelect>
            {fieldState.error && <FormHelperText error>{fieldState.error.message}</FormHelperText>}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
              Can't find the customer?{" "}
              <Link component="button" type="button" variant="caption" onClick={() => setAdding(true)}>
                Add new customer
              </Link>
              . Its code goes into the risk code and can't be changed after the risk is created.
            </Typography>
          </Box>
        )}
      />
      <AddCustomerDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(customer) => {
          onCustomerAdded(customer);
          setValue("customer", customer.id, { shouldValidate: true, shouldDirty: true });
          clearErrors("customer");
        }}
      />
    </Box>
  );
}

// The fields a register's template adds to Basic Information
// (RISK_MODULE_DESIGN.md §14). Renders nothing for the Standard template, whose
// fields are the original ones.
//
//   Aggregated        → Platform
//   Managed Services  → Deployment Type, Product, Environment (the Customer Name
//                       is CustomerField, shown above the risk code)
//
// Every one is required. The Source Register is what brings these up, so
// there is no way to pick a template here.
export default function TemplateFields({ template, lookups, offeredPlatformIds }: TemplateFieldsProps): JSX.Element | null {
  const { control, clearErrors } = useFormContext<AddRiskFormValues>();
  const platforms = useWatch({ control, name: "platforms" });
  const products = useWatch({ control, name: "products" });
  const environments = useWatch({ control, name: "environments" });
  const offeredKey = offeredPlatformIds.join(",");
  const choices = useMemo(
    () => platformChoices(lookups.platforms, offeredPlatformIds),
    // offeredKey stands in for the array, which is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups.platforms, offeredKey],
  );

  if (template === "STANDARD") return null;

  return (
    <Stack gap={3}>
      {template === "AGGREGATED" && (
        <Controller
          name="platforms"
          control={control}
          render={({ field, fieldState }) => (
            <PlatformPicker
              choices={choices}
              value={platforms}
              onChange={(next) => {
                field.onChange(next);
                if (next.length > 0) clearErrors("platforms");
              }}
              error={fieldState.error?.message}
            />
          )}
        />
      )}

      {template === "MANAGED_SERVICES" && (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              alignItems: "flex-start",
            }}
          >
            <Controller
              name="deploymentType"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <FieldLabel required>Deployment Type</FieldLabel>
                  <ComplexSelect
                    {...field}
                    fullWidth
                    error={!!fieldState.error}
                    displayEmpty
                    onChange={(e) => {
                      field.onChange(e);
                      if (e.target.value) clearErrors("deploymentType");
                    }}
                  >
                    <ComplexSelect.MenuItem value="" disabled sx={{ display: "none" }}>
                      Select a deployment type
                    </ComplexSelect.MenuItem>
                    {lookups.deploymentTypes.map((d) => (
                      <ComplexSelect.MenuItem key={d.id} value={d.id}>
                        {d.name}
                      </ComplexSelect.MenuItem>
                    ))}
                  </ComplexSelect>
                  {fieldState.error && <FormHelperText error>{fieldState.error.message}</FormHelperText>}
                </Box>
              )}
            />
          </Box>

          <Controller
            name="products"
            control={control}
            render={({ field, fieldState }) => (
              <PillMultiSelect
                label="Product"
                required
                ariaLabel="Products"
                options={lookups.products.map((p) => ({ value: p.id, label: p.name }))}
                value={products}
                onChange={(next) => {
                  field.onChange(next);
                  if (next.length > 0) clearErrors("products");
                }}
                error={fieldState.error?.message}
                emptyMessage="No products have been added yet. Ask a platform admin to add them."
              />
            )}
          />

          <Controller
            name="environments"
            control={control}
            render={({ field, fieldState }) => (
              <PillMultiSelect
                label="Environment"
                required
                ariaLabel="Environments"
                options={ENVIRONMENTS}
                value={environments}
                onChange={(next) => {
                  field.onChange(next);
                  if (next.length > 0) clearErrors("environments");
                }}
                error={fieldState.error?.message}
              />
            )}
          />
        </>
      )}
    </Stack>
  );
}
