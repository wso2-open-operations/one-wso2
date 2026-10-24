// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import type { UmtBaseProduct, UmtCreateProductRequest } from "../api/umtProducts";

// Base products have no numeric id of their own, so the DataGrid row id is
// composite. A plain `${name}-${version}` join is ambiguous when either field
// contains a hyphen (e.g. name "foo-bar" + version "1" collides with name
// "foo" + version "bar-1"), so the pair is JSON-encoded instead — the array
// structure and JSON's own escaping keep every distinct (name, version) pair
// unique.
export function productRowId(product: UmtBaseProduct): string {
  return JSON.stringify([product.name, product.version]);
}

export interface UmtCreateProductFormValues {
  name: string;
  version: string;
  leadMail: string;
  edMail: string;
  ftpHost: string;
  ftpPort: string;
  ftpUsername: string;
  ftpPassword: string;
  ftpAbsolutePath: string;
}

export const EMPTY_CREATE_PRODUCT_FORM: UmtCreateProductFormValues = {
  name: "",
  version: "",
  leadMail: "",
  edMail: "",
  ftpHost: "",
  ftpPort: "",
  ftpUsername: "",
  ftpPassword: "",
  ftpAbsolutePath: "",
};

// A well-formed address: text, one @, and a domain of at least two labels
// split by single dots, so no empty label and no leading or trailing dot, with
// no spaces anywhere.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// Whether the value, ignoring surrounding whitespace, is a well-formed email
// address. A format check only, which is all a form can know about an address:
// it says nothing about whether the address is deliverable.
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

// A product version is three dot-separated numbers, such as 4.0.0.
export function isValidProductVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value.trim());
}

// Every field is required, blank after trimming is not accepted, the version
// must be X.Y.Z, and the lead and ED emails must be well formed.
export function isCreateProductFormValid(values: UmtCreateProductFormValues): boolean {
  return (
    Object.values(values).every((value) => value.trim().length > 0) &&
    isValidProductVersion(values.version) &&
    isValidEmail(values.leadMail) &&
    isValidEmail(values.edMail)
  );
}

// Legacy suffixes the typed version with `.0.full` before submitting (e.g.
// "4.0.0" becomes "4.0.0.0.full"). Confirmed with the product owner to keep
// reproducing this exactly rather than "fixing" it, since the real backend
// version-format contract wasn't re-verified from source this pass.
export function buildUmtCreateProductRequest(
  values: UmtCreateProductFormValues,
): UmtCreateProductRequest {
  return {
    name: values.name.trim(),
    version: `${values.version.trim()}.0.full`,
    leadMail: values.leadMail.trim(),
    edMail: values.edMail.trim(),
    ftpHost: values.ftpHost.trim(),
    ftpPort: values.ftpPort.trim(),
    ftpUsername: values.ftpUsername.trim(),
    ftpPassword: values.ftpPassword, // not trimmed: a password may legitimately contain edge whitespace
    ftpAbsolutePath: values.ftpAbsolutePath.trim(),
  };
}
