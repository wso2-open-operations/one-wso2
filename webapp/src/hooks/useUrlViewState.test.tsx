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
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";
import { useUrlViewState, type UrlViewCodec } from "./useUrlViewState";

// Finance MIS is the first route in One WSO2 to carry filter state in the URL,
// and this is the piece that binds a screen's pure codec to the address bar.
// The codec itself is the screen's; what is shared is this — reading the query
// string, and writing one back without turning the back button into a filter
// log.

/** A stand-in screen whose whole view is one word. */
const wordCodec: UrlViewCodec<string> = {
  parse: (search) => new URLSearchParams(search).get("q") ?? "",
  serialize: (word) => (word ? `q=${word}` : ""),
};

function renderAt(search: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/a-screen${search}`]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({
      state: useUrlViewState(wordCodec),
      location: useLocation(),
      navigationType: useNavigationType(),
    }),
    { wrapper },
  );
}

describe("reading", () => {
  it("reports the view the URL describes", () => {
    const { result } = renderAt("?q=opening");
    expect(result.current.state.view).toBe("opening");
  });

  it("reports the codec's own answer for a URL that says nothing", () => {
    const { result } = renderAt("");
    expect(result.current.state.view).toBe("");
  });

  it("follows the URL changing under it", () => {
    const { result } = renderAt("?q=opening");
    act(() => result.current.state.setView("closing"));
    expect(result.current.state.view).toBe("closing");
  });
});

describe("writing", () => {
  it("puts the serialised view in the address", () => {
    const { result } = renderAt("");
    act(() => result.current.state.setView("closing"));
    expect(result.current.location.search).toBe("?q=closing");
  });

  // The back button belongs to the reader's navigation, not to their filtering.
  // Pushing an entry per applied filter would bury the page they arrived from
  // under a dozen near-identical addresses.
  it("replaces the current entry rather than pushing a new one", () => {
    const { result } = renderAt("?q=opening");
    act(() => result.current.state.setView("closing"));
    expect(result.current.navigationType).toBe("REPLACE");
  });

  // A default view serialises to nothing, and nothing has to reach the address
  // bar as nothing — not as a trailing "?" that makes two identical views look
  // like two different links.
  it("leaves no query string at all for a view that serialises to nothing", () => {
    const { result } = renderAt("?q=opening");
    act(() => result.current.state.setView(""));
    expect(result.current.location.search).toBe("");
    expect(result.current.state.view).toBe("");
  });
});
