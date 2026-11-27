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

import type { JSX, ReactNode } from "react";
import { Avatar, Box, Chip } from "@wso2/oxygen-ui";
import { usePeopleFaces, type PersonFace } from "../api/usePeopleFaces";
import { Two } from "./StatusChips";

const initials = (name: string): string =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** A round photo, or the person's initials when there is none. */
export function PersonAvatar({ name, photo, size = 28 }: { readonly name: string; readonly photo?: string; readonly size?: number }): JSX.Element {
  return (
    <Avatar src={photo} alt="" sx={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initials(name)}
    </Avatar>
  );
}

/** A removable person: photo, first name, and the email underneath. */
export function PersonChip({ email, name, face, onDelete }: { readonly email: string; readonly name?: string; readonly face: PersonFace; readonly onDelete: () => void }): JSX.Element {
  const first = face.firstName ?? name?.split(" ")[0] ?? email;
  return (
    <Chip
      variant="outlined"
      avatar={<PersonAvatar name={face.fullName ?? name ?? email} photo={face.photo} />}
      title={face.fullName ?? name ?? email}
      label={
        <Box sx={{ lineHeight: 1.25 }}>
          <Box sx={{ fontSize: 13, fontWeight: 600 }}>{first}</Box>
          <Box sx={{ fontSize: 11.5, color: "text.secondary" }}>{email}</Box>
        </Box>
      }
      onDelete={onDelete}
      sx={{ height: "auto", py: 0.5, borderRadius: 999, "& .MuiChip-avatar": { width: 28, height: 28, ml: 0.5 } }}
    />
  );
}

/** A person on a detail page: their photo (initials when the directory has none) beside the name and the lines under it. */
export function PersonTwo({ name, email, sub }: { readonly name: string; readonly email?: string; readonly sub?: ReactNode }): JSX.Element {
  const faceOf = usePeopleFaces();
  const face = email ? faceOf(email) : {};
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <PersonAvatar name={name || email || ""} photo={face.photo} size={32} />
      <Two main={name} sub={sub} />
    </Box>
  );
}
