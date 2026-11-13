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
  platform: string;
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
  platform: "",
  ftpHost: "",
  ftpPort: "",
  ftpUsername: "",
  ftpPassword: "",
  ftpAbsolutePath: "",
};

// A well-formed address: a local part of the characters an address may carry
// unquoted, one @, and a domain of at least two labels split by single dots.
// A label is letters, digits and hyphens, up to 63 characters, and starts and
// ends with a letter or digit, so there is no empty label and no leading or
// trailing dot. Spaces, commas and brackets are not accepted anywhere.
const EMAIL_LOCAL = "[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+";
const EMAIL_LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
const EMAIL_REGEX = new RegExp(`^${EMAIL_LOCAL}@${EMAIL_LABEL}(?:\\.${EMAIL_LABEL})+$`);

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

// A port is a whole number from 1 to 65535, with no sign or other characters.
export function isValidFtpPort(value: string): boolean {
  const text = value.trim();
  return /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= 65535;
}

// The fields that must be filled. Every form field except the platform is
// here; the Record type makes a new form field fail to compile until it is
// added.
const REQUIRED_FIELDS: Record<Exclude<keyof UmtCreateProductFormValues, "platform">, true> = {
  name: true,
  version: true,
  leadMail: true,
  edMail: true,
  ftpHost: true,
  ftpPort: true,
  ftpUsername: true,
  ftpPassword: true,
  ftpAbsolutePath: true,
};

// Every required field is filled (blank after trimming is not accepted), the
// version must be X.Y.Z, the lead and ED emails must be well formed, and the
// FTP port must be a port number.
export function isCreateProductFormValid(values: UmtCreateProductFormValues): boolean {
  const requiredKeys = Object.keys(REQUIRED_FIELDS) as (keyof typeof REQUIRED_FIELDS)[];
  return (
    requiredKeys.every((key) => values[key].trim().length > 0) &&
    isValidProductVersion(values.version) &&
    isValidEmail(values.leadMail) &&
    isValidEmail(values.edMail) &&
    isValidFtpPort(values.ftpPort)
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
    ...(values.platform ? { platform: values.platform } : {}),
    FTPHost: values.ftpHost.trim(),
    FTPPort: values.ftpPort.trim(),
    FTPUsername: values.ftpUsername.trim(),
    FTPPassword: values.ftpPassword, // not trimmed: a password may legitimately contain edge whitespace
    FTPPath: values.ftpAbsolutePath.trim(),
  };
}

// Some add-product rejections carry a JSON object as their message, e.g.
// `{"message":"Product already exists"}`. Returns the inner message for those,
// and the text unchanged otherwise.
export function unwrapUmtErrorMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: unknown } | null;
    if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // not JSON
  }
  return text;
}
