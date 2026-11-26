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

import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { loadRemote, registerRemotes } from "@module-federation/runtime";

// Remotes are registered here at runtime rather than listed in vite.config.ts,
// so the address of each one comes from config.js and can differ by
// environment without a rebuild.
const registered = new Set<string>();

/**
 * A lazy component served by another deployment.
 *
 * `entry` is the URL of that deployment's remoteEntry.js and `expose` is the
 * name it publishes the component under. Nothing is fetched until the
 * component first renders.
 */
export function remoteComponent<P extends object>(
  name: string,
  entry: string,
  expose: string,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => {
    if (!registered.has(name)) {
      registerRemotes([{ name, entry, type: "module" }]);
      registered.add(name);
    }
    const loaded = await loadRemote<{ default: ComponentType<P> }>(`${name}/${expose}`);
    if (!loaded?.default) throw new Error(`Remote "${name}" does not expose "${expose}".`);
    return loaded;
  });
}
