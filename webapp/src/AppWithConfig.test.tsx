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
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The provider is chosen at import time (AppWithConfig module scope) and
// ThunderProvider re-reads the URL at render time, so every case sets the
// config first and then re-imports the module under test.
const authConfig = vi.hoisted(() => ({
  baseUrl: "https://id.example.com",
  clientId: "client-id",
  afterSignInUrl: "https://app.example.com/signin",
  afterSignOutUrl: "https://app.example.com/signout",
  myAccountUrl: "https://myaccount.example.com",
  scopes: ["openid", "email", "groups", "profile"] as const,
  wellKnownEndpoint: undefined as string | undefined,
}));

vi.mock("@config/authConfig", () => ({ authConfig }));

// The stock provider is where the discovery URL has to land: ThunderProvider
// only adds the prop and renders this. Rendering the prop it receives is how
// the test tells "ThunderProvider was picked and forwarded the URL" apart from
// "the stock provider was picked".
vi.mock("@asgardeo/react", () => ({
  AsgardeoProvider: (props: { wellKnownEndpoint?: string; children?: ReactNode }) => (
    <div data-testid="sign-in-provider" data-well-known={props.wellKnownEndpoint ?? ""}>
      {props.children}
    </div>
  ),
  useAsgardeo: () => ({
    getIdToken: () => Promise.resolve("id-token"),
    getAccessToken: () => Promise.resolve("access-token"),
    signInSilently: () => Promise.resolve(),
  }),
}));

vi.mock("@api/authBridge", () => ({ registerAuthAccessors: vi.fn() }));
vi.mock("@api/silentSignInFrame", () => ({ isSilentSignInFrame: () => false }));

// Everything below the provider is another slice's concern; only the provider
// choice and the props it gets are under test here.
vi.mock("./App", () => ({ default: () => <div>the app</div> }));
vi.mock("@context/theme/ThemePreferenceContext", () => ({
  ThemePreferenceProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  PerspectiveProvider: ({ children }: { children: ReactNode }) => <div data-testid="perspective">{children}</div>,
}));
vi.mock("@components/side-rail/RailBadgeProvider", () => ({
  RailBadgeProvider: ({ children }: { children: ReactNode }) => <div data-testid="rail-badges">{children}</div>,
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  NotificationsProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@tanstack/react-query-devtools", () => ({ ReactQueryDevtools: () => null }));

async function renderApp() {
  const { default: AppWithConfig } = await import("./AppWithConfig");
  return render(<AppWithConfig />);
}

beforeEach(() => {
  vi.resetModules();
  authConfig.wellKnownEndpoint = undefined;
});

describe("AppWithConfig sign-in provider selection", () => {
  it("keeps the stock Asgardeo provider when no discovery URL is configured", async () => {
    await renderApp();

    const provider = screen.getByTestId("sign-in-provider");
    // No discovery URL, so nothing may be forwarded: the SDK must derive
    // Asgardeo's endpoints from baseUrl as it always did.
    expect(provider.getAttribute("data-well-known")).toBe("");
  });

  it("signs in through the discovery document when ONE_WSO2_AUTH_WELL_KNOWN_URL is set", async () => {
    authConfig.wellKnownEndpoint = "https://id.example.com/.well-known/openid-configuration";

    await renderApp();

    // Only ThunderProvider adds this prop; the SDK core reads it flat and
    // rejects the server's tokens without it (issuer is {baseUrl}, not
    // {baseUrl}/oauth2/token).
    expect(screen.getByTestId("sign-in-provider").getAttribute("data-well-known")).toBe(
      "https://id.example.com/.well-known/openid-configuration",
    );
  });

  it("leaves the app mounted under the provider, so the choice never hides the UI", async () => {
    await renderApp();

    expect(screen.getByText("the app")).toBeInTheDocument();
  });
});

describe("AppWithConfig badges", () => {
  // Once for the whole app, so every place that shows badges reads the same ones. Badges follow the perspective.
  it("collects the badges once, inside the perspective and around the app", async () => {
    await renderApp();

    const badges = screen.getByTestId("rail-badges");
    expect(screen.getAllByTestId("rail-badges")).toHaveLength(1);
    expect(screen.getByTestId("perspective")).toContainElement(badges);
    expect(badges).toContainElement(screen.getByText("the app"));
  });
});
