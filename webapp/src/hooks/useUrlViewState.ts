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

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Binds a screen's pure view codec to the address bar.
 *
 * Finance MIS is the first route in One WSO2 to carry filter state in the URL —
 * `features/pinned/pinnableRoute.ts` said as much before it arrived — so the
 * binding is built here, shared, rather than inside the first app to need it.
 * The vocabulary stays with the screen; what is shared is only this: read the
 * query string, and write one back without turning the back button into a log
 * of every filter the reader tried.
 *
 * The URL is the single source of truth. The source MIS app instead kept the
 * view in React state and mirrored it into the address on an effect, which
 * needed a first-render snapshot, a ref to the live location, and a guard
 * against the mirror racing its own write. None of that is needed if the
 * address IS the state; `setView` navigates, the router re-renders, and the
 * view comes back out of the codec.
 */
export interface UrlViewCodec<TRead, TWrite = TRead> {
  /** What this query string says. Called with no leading `?`. */
  parse(search: string): TRead;
  /** The query string for a view, without a leading `?`. Empty for a default view. */
  serialize(view: TWrite): string;
}

export interface UrlViewState<TRead, TWrite = TRead> {
  /** The view the address currently describes. */
  view: TRead;
  /**
   * Put a view in the address.
   *
   * Replaces the current history entry by default: applying a filter is not a
   * step the reader should have to take back one at a time, and pushing one
   * entry per applied filter buries the page they arrived from. Pass
   * `{ push: true }` for a move that IS worth going back from.
   *
   * The serialised view becomes the whole query string, so anything else the
   * address was carrying does not survive. That is what "a view is fully
   * described by its URL" costs, and the alternative — merging — leaves
   * parameters behind that no longer describe anything on screen.
   */
  setView(next: TWrite, options?: { push?: boolean }): void;
}

/**
 * Read and write one screen's view as its query string.
 *
 * The two type parameters are separate because reading and writing are not
 * symmetric: a URL carries only what someone changed, while a screen holds a
 * complete view. Screens whose two halves do match can supply one type and
 * ignore the second.
 */
export function useUrlViewState<TRead, TWrite = TRead>({
  parse,
  serialize,
}: UrlViewCodec<TRead, TWrite>): UrlViewState<TRead, TWrite> {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();

  const view = useMemo(() => parse(search), [parse, search]);

  const setView = useCallback(
    (next: TWrite, { push = false }: { push?: boolean } = {}) => {
      setSearchParams(serialize(next), { replace: !push });
    },
    [serialize, setSearchParams],
  );

  return { view, setView };
}
