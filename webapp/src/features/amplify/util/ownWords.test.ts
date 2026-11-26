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

import { describe, expect, it } from "vitest";
import { OWN_WORDS_THRESHOLD, countOwnWords, ownWordsText } from "./ownWords";

const post = {
  title: "Choreo Labs at KubeCon North America",
  summary: "Meet the team at booth P12 and see the platform engineering demos live.",
};

describe("countOwnWords", () => {
  it("counts words that aren't in the title or summary", () => {
    // proud, of, come, say, hi; "the", "team", "at", "booth", "P12" are the post's own words.
    expect(countOwnWords("Proud of the team, come say hi at booth P12", post)).toBe(5);
  });

  it("gives nothing for copying the title or the summary", () => {
    expect(countOwnWords("Choreo Labs at KubeCon North America!", post)).toBe(0);
    expect(countOwnWords(post.summary, post)).toBe(0);
  });

  it("ignores case and the punctuation around a word", () => {
    expect(countOwnWords("KUBECON! (Great) demos, really.", post)).toBe(2);
  });

  it("leaves out hashtags, @-mentions and links", () => {
    expect(
      countOwnWords("#PlatformEngineering @ChoreoLabs https://choreo.dev/x www.wso2.com wso2.com/kubecon great", post),
    ).toBe(1);
  });

  it("leaves out one-character words", () => {
    expect(countOwnWords("I a x love it", post)).toBe(2);
  });

  it("counts a repeated word once", () => {
    expect(countOwnWords("great great great great great", post)).toBe(1);
  });

  it("is zero for empty thoughts and works without a summary", () => {
    expect(countOwnWords("   ", post)).toBe(0);
    expect(countOwnWords("Booth demos rock", { title: "KubeCon", summary: null })).toBe(3);
  });
});

describe("ownWordsText", () => {
  it("shows progress toward the threshold and stops there", () => {
    expect(ownWordsText(3, 5)).toBe(`3 of ${OWN_WORDS_THRESHOLD} own words for +5`);
    expect(ownWordsText(9, 5)).toBe("5 of 5 own words for +5");
  });
});
