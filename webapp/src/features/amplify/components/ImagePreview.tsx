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

import { Box } from "@wso2/oxygen-ui";

/** The image as the post card shows it: 16:9, rounded, on the black area. */
export default function ImagePreview({ url }: { url: string }) {
  return (
    <Box sx={{ aspectRatio: "16 / 9", borderRadius: 1, overflow: "hidden", bgcolor: "common.black" }}>
      <Box
        component="img"
        src={url}
        alt="Preview of the post image"
        sx={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
      />
    </Box>
  );
}
