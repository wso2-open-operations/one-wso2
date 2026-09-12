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

import type { ReactNode } from "react";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { misPaths } from "@constants/misApps";
import { MIS_PERIODS, MIS_SCALES, MIS_TABLES } from "./misViewVocabulary";
import { ScalePreferenceProvider } from "./ScalePreferenceContext";
import { useMisViewState } from "./useMisViewState";
import { useMisScale } from "./useMisScale";

// Spec §10.7 and §4: Scale is held two ways at once, and this is where the two
// meet. A link carries it so that a view someone shares renders as they saw it;
// a stored preference carries it so that a reader who works in thousands keeps
// working in thousands. The link wins — and it does NOT overwrite the
// preference, so the recipient's own way of reading survives someone else's
// link.

const STORAGE_KEY = "one-wso2.scale";
const { UNITS, THOUSANDS } = MIS_SCALES;

beforeEach(() => {
  localStorage.clear();
});

function renderAt(search: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`${misPaths.arrBuild}${search}`]}>
      <ScalePreferenceProvider>{children}</ScalePreferenceProvider>
    </MemoryRouter>
  );
  return renderHook(
    () => {
      const view = useMisViewState(MIS_PERIODS.ANNUALLY);
      return { view, scale: useMisScale(view), location: useLocation() };
    },
    { wrapper },
  );
}

describe("with nothing in the link", () => {
  it("shows units when the reader has never chosen", () => {
    expect(renderAt("").result.current.scale.scale).toBe(UNITS);
  });

  it("shows the Scale the reader chose on the last MIS screen", () => {
    localStorage.setItem(STORAGE_KEY, THOUSANDS);
    expect(renderAt("").result.current.scale.scale).toBe(THOUSANDS);
  });

  it("seeds the address from the preference, so the link the reader copies is what they see", () => {
    // The source's own words: "A Scale in the URL is adopted into the session
    // store on mount; otherwise the session Scale seeds the URL"
    // (arrDashboard/hooks/useViewStateUrl.js). Without this half, a reader who
    // works in thousands copies a link that renders in units for everyone else.
    localStorage.setItem(STORAGE_KEY, THOUSANDS);
    const { result } = renderAt("");
    expect(result.current.location.search).toBe("?scale=k");
  });

  it("leaves the address alone for a reader working in units", () => {
    // Units is the default and a default is never written — spec §4.
    localStorage.setItem(STORAGE_KEY, UNITS);
    expect(renderAt("").result.current.location.search).toBe("");
  });

  it("seeds without disturbing the rest of the view", () => {
    localStorage.setItem(STORAGE_KEY, THOUSANDS);
    const { result } = renderAt("?table=customers&years=3");
    expect(result.current.location.search).toContain("table=customers");
    expect(result.current.location.search).toContain("years=3");
    expect(result.current.location.search).toContain("scale=k");
  });
});

describe("with a Scale in the link", () => {
  it("renders as the sender saw it, over the reader's own preference", () => {
    localStorage.setItem(STORAGE_KEY, UNITS);
    expect(renderAt("?scale=k").result.current.scale.scale).toBe(THOUSANDS);
  });

  it("leaves the reader's preference exactly as it found it", () => {
    localStorage.setItem(STORAGE_KEY, UNITS);
    renderAt("?scale=k");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(UNITS);
  });

  it("does not write a preference for a reader who has never chosen one", () => {
    renderAt("?scale=k");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("choosing a Scale", () => {
  it("puts it in the address and remembers it", () => {
    const { result } = renderAt("");

    act(() => result.current.scale.setScale(THOUSANDS));

    expect(result.current.scale.scale).toBe(THOUSANDS);
    expect(result.current.location.search).toBe("?scale=k");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(THOUSANDS);
  });

  it("takes it back out of the address on the way to units", () => {
    // Units is the default, and a default is never written — spec §4.
    const { result } = renderAt("?scale=k");

    act(() => result.current.scale.setScale(UNITS));

    expect(result.current.scale.scale).toBe(UNITS);
    expect(result.current.location.search).toBe("");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(UNITS);
  });

  it("overrides a link that said otherwise, once the reader has said so here", () => {
    localStorage.setItem(STORAGE_KEY, UNITS);
    const { result } = renderAt("?scale=k");

    act(() => result.current.scale.setScale(UNITS));

    expect(result.current.scale.scale).toBe(UNITS);
  });
});

describe("the rest of the view changing", () => {
  it("leaves the Scale where it was", () => {
    const { result } = renderAt("?scale=k");

    act(() => result.current.view.setView({ table: MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS }));

    expect(result.current.location.search).toContain("scale=k");
    expect(result.current.scale.scale).toBe(THOUSANDS);
  });
});
