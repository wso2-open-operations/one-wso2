/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * The introductory tour: the chrome, and nothing else.
 *
 * Scope is deliberately the things that are the same for everyone — where the
 * app menu is, how to keep a page, how to change the theme, where your landing
 * page is set. Nothing about leave, claims or approvals: those differ by role,
 * they are covered by the screens' own copy, and a first-run tour that walks
 * someone through a queue they cannot open is worse than no tour.
 *
 * `selector` finds the control to point at. Every step that can uses a
 * `data-tour` attribute, so the dependency is visible in the component that owns
 * it and restyling cannot break it.
 *
 * The rail is the exception, and it is Oxygen's doing: `Sidebar.Nav` and
 * `Sidebar.Item` drop unknown props, `data-*` and `id` included, so nothing put
 * on them reaches the DOM (verified against 0.6.0 — a marker there silently
 * never appears, and the step would vanish with no error anywhere). It renders
 * `aside > nav`, so that is what the rail step matches. The Settings marker
 * sits on the list around that row: a span inside the label is markable, but
 * Oxygen names a collapsed row with String(label children), and an element
 * there is announced as "[object Object]".
 *
 * A step whose selector matches nothing — a control hidden at a narrow width — is
 * skipped rather than anchored to nowhere.
 */
export interface TourStep {
  /** CSS selector for the element to point at. Omitted for a standalone step. */
  selector?: string;
  title: string;
  body: string;
  /**
   * Opens the app launcher for the duration of this step. Only the app-menu step
   * uses it: seeing the panel is the point, and describing a panel that stays
   * shut teaches nothing. Every other step only points.
   */
  opensLauncher?: boolean;
  /**
   * Put the card beside the target rather than under it.
   *
   * Below is the default and suits a small control in the bar. It suits a large
   * panel far less: the launcher fills the top-right corner, so a card beneath
   * it dangles into the middle of the page instead of reading as belonging to
   * the thing it describes. Declared per step rather than inferred from the
   * target's size or position, because which reads better is a judgement about
   * that particular screen.
   */
  prefer?: "side";
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: "Welcome to One WSO2",
    body: "This takes about a minute.",
  },
  {
    selector: '[data-tour="app-menu"]',
    opensLauncher: true,
    prefer: "side",
    title: "This is home base",
    body:
      "Everything opens from here — your personal Me space, plus every functional app " +
      "you're entitled to, all behind one login. And we're just getting started — more " +
      "apps are on the way.",
  },
  {
    selector: '[data-tour="favourite"]',
    opensLauncher: true,
    prefer: "side",
    title: "Star it, keep it close",
    body:
      "Tap the star on any app to pin it to Favourites. The stuff you use daily stays up " +
      "top — no digging required.",
  },
  {
    // Direct child: Oxygen renders `aside > nav`, and a descendant selector
    // would also match any nav nested deeper inside an aside.
    selector: "aside > nav",
    title: "Moving around inside an app",
    body:
      "This is the navigation for the app you're currently in. It only shows what applies " +
      "to you — so it may differ from a colleague's.",
  },
  {
    selector: '[data-tour="pin"]',
    title: "Keep a page within reach",
    body:
      "Pin a page and it sits in the top bar for one-tap access. Your filters are saved " +
      "too, so it's exactly as you left it.",
  },
  {
    selector: '[data-tour="theme"]',
    title: "Make it easier on the eyes",
    body:
      "Two controls: one picks the colour palette, the other switches between light, dark " +
      "and following your system. Both are remembered.",
  },
  {
    selector: '[data-tour="settings"]',
    title: "Choose where you start",
    body: "Settings lets you pick which app One WSO2 opens on when you arrive.",
  },
  {
    title: "That's the tour",
    body:
      "Happy exploring. If you want to see the walkthrough again, it's under your name in " +
      "the top-right corner.",
  },
];
