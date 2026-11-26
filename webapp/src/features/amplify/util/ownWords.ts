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

/** Own words "Add your thoughts" needs before the repost earns the with-your-thoughts points. */
export const OWN_WORDS_THRESHOLD = 5;

const LINK = /^(https?:\/\/|www\.)|^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)*\.[a-z]{2,}(\/\S*)?$/iu;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** The words of `text`, lowercased with edge punctuation trimmed. Hashtags, @-mentions and links are dropped. */
function words(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    if (!raw || raw.startsWith("#") || raw.startsWith("@")) continue;
    const trimmed = raw.replace(/[),.;:!?"']+$/u, "");
    if (LINK.test(trimmed)) continue;
    const word = trimmed.replace(EDGE_PUNCTUATION, "").toLowerCase();
    if (word) out.push(word);
  }
  return out;
}

/**
 * How many of the employee's own words "Add your thoughts" holds: distinct words that aren't in the post's title or
 * summary, leaving out hashtags, @-mentions, links and one-character words. Copying the title earns nothing, and
 * repeating one word counts it once.
 */
export function countOwnWords(thoughts: string, post: { title: string; summary?: string | null }): number {
  const postWords = new Set(words(`${post.title} ${post.summary ?? ""}`));
  const own = new Set<string>();
  for (const word of words(thoughts)) {
    if ([...word].length < 2 || postWords.has(word)) continue;
    own.add(word);
  }
  return own.size;
}

/** The counter under "Add your thoughts", e.g. "3 of 5 own words for +5". The count stops at the threshold. */
export function ownWordsText(count: number, points: number): string {
  return `${Math.min(count, OWN_WORDS_THRESHOLD)} of ${OWN_WORDS_THRESHOLD} own words for +${points}`;
}
