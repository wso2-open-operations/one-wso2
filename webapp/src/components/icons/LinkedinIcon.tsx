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

import { forwardRef } from "react";
import type { LucideProps } from "@wso2/oxygen-ui-icons-react";

/**
 * Lucide dropped brand icons in v1; `@wso2/oxygen-ui-icons-react` re-exports
 * Lucide and keeps a few brand marks (Facebook, GitHub, …) but not LinkedIn.
 * Keep the previous Lucide path here until Oxygen ships one.
 */
export const LinkedinIcon = forwardRef<SVGSVGElement, LucideProps>(
  (
    {
      color = "currentColor",
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      className,
      "aria-hidden": ariaHidden,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      ...rest
    },
    ref,
  ) => {
    const resolvedStrokeWidth =
      absoluteStrokeWidth && typeof size === "number"
        ? (Number(strokeWidth) * 24) / size
        : strokeWidth;

    const hasAccessibleName = Boolean(ariaLabel ?? ariaLabelledby);
    const resolvedAriaHidden = ariaHidden ?? (hasAccessibleName ? undefined : true);

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={resolvedStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden={resolvedAriaHidden}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        {...rest}
      >
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect width="4" height="12" x="2" y="9" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    );
  },
);

LinkedinIcon.displayName = "LinkedinIcon";
