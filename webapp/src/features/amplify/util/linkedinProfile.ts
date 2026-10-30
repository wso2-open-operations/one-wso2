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

// Same rule as amplify-api (connection:isProfileUrl): https://[www.]linkedin.com/in/<name>
const PROFILE_URL = /^https:\/\/(www\.)?linkedin\.com\/in\/[\p{L}\p{N}_%.-]{3,100}\/?$/u;

/** True for a LinkedIn member profile URL such as https://www.linkedin.com/in/your-name. */
export const isLinkedInProfileUrl = (value: string): boolean => value.length <= 255 && PROFILE_URL.test(value);
