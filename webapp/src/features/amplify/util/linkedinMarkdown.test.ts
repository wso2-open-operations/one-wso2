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
import {
  activeMentions,
  buildCommentary,
  linkedInLength,
  splitCommentary,
  toBold,
  toItalic,
  toLinkedInText,
  toMonospace,
  type TrackedMention,
} from "./linkedinMarkdown";

const S = "̶";

describe("toLinkedInText", () => {
  it("turns **bold** and __bold__ into sans-serif bold, digits too", () => {
    expect(toLinkedInText("**Az09**")).toBe("𝗔𝘇𝟬𝟵");
    expect(toLinkedInText("a __Big__ day")).toBe("a 𝗕𝗶𝗴 day");
  });

  it("turns *italic* and _italic_ into sans-serif italic, digits unchanged", () => {
    expect(toLinkedInText("*Az 9*")).toBe("𝘈𝘻 9");
    expect(toLinkedInText("so _very_ good")).toBe("so 𝘷𝘦𝘳𝘺 good");
  });

  it("leaves snake_case and lone asterisks alone", () => {
    expect(toLinkedInText("use my_var_name here")).toBe("use my_var_name here");
    expect(toLinkedInText("2 * 3 * 4")).toBe("2 * 3 * 4");
  });

  it("turns ***x*** into bold italic", () => {
    expect(toLinkedInText("***Go***")).toBe("𝙂𝙤");
  });

  it("strikes ~~text~~ with U+0336 after each character, spaces unstruck", () => {
    expect(toLinkedInText("~~ab c~~")).toBe(`a${S}b${S} c${S}`);
  });

  it("turns - and * list lines into bullets and keeps numbering", () => {
    expect(toLinkedInText("- one\n* two\n1. first\n2. second")).toBe("● one\n● two\n1. first\n2. second");
  });

  it("turns > quote into a bar-led line", () => {
    expect(toLinkedInText("> wise words")).toBe("▌ wise words");
  });

  it("turns inline and fenced code into monospace and drops the fences", () => {
    expect(toLinkedInText("run `npm ci` now")).toBe(`run ${toMonospace("npm ci")} now`);
    expect(toLinkedInText("```\nbal run\n```")).toBe(toMonospace("bal run"));
    expect(toLinkedInText("`**not bold**`")).toBe(toMonospace("**not bold**"));
  });

  it("turns [text](url) into text (url) without styling the URL", () => {
    expect(toLinkedInText("[docs](https://wso2.com/a_b_c)")).toBe("docs (https://wso2.com/a_b_c)");
  });

  it("turns a header of any level into a bold line", () => {
    expect(toLinkedInText("# Big news")).toBe(toBold("Big news"));
    expect(toLinkedInText("### Small")).toBe(toBold("Small"));
  });

  it("leaves plain text, hashtags and non-ASCII letters untouched", () => {
    expect(toLinkedInText("Héllo #wso2 ünïcode — 日本")).toBe("Héllo #wso2 ünïcode — 日本");
    expect(toLinkedInText("**café**")).toBe(`${toBold("caf")}é`);
  });

  it("styles emphasis inside list items", () => {
    expect(toLinkedInText("- *new*")).toBe(`● ${toItalic("new")}`);
  });
});

describe("mentions", () => {
  const jane: TrackedMention = { label: "Jane Smith", ref: "person:jane@wso2.com", kind: "PERSON" };
  const wso2: TrackedMention = { label: "WSO2", ref: "org:wso2", kind: "ORGANIZATION" };

  it("sends each tracked @label as a wire token", () => {
    expect(buildCommentary("Thanks @Jane Smith and @WSO2!", [jane, wso2])).toBe(
      "Thanks @[Jane Smith](amplify:person:jane@wso2.com) and @[WSO2](amplify:org:wso2)!",
    );
  });

  it("keeps the token intact through the markdown converter (placeholders survive)", () => {
    expect(buildCommentary("**Hi @Jane Smith** ~~@WSO2~~", [jane, wso2])).toBe(
      `${toBold("Hi ")}@[Jane Smith](amplify:person:jane@wso2.com) @[WSO2](amplify:org:wso2)`,
    );
  });

  it("drops a mention whose text was edited away", () => {
    expect(buildCommentary("Thanks @Jane Smit", [jane])).toBe("Thanks @Jane Smit");
    expect(activeMentions("Thanks @Jane Smit", [jane])).toEqual([]);
    expect(activeMentions("Thanks @Jane Smithers", [jane])).toEqual([]);
  });

  it("maps a person picked twice to two occurrences, but not a third typed by hand", () => {
    expect(buildCommentary("@WSO2 @WSO2 @WSO2", [wso2, wso2])).toBe(
      "@[WSO2](amplify:org:wso2) @[WSO2](amplify:org:wso2) @WSO2",
    );
  });

  it("strips brackets and line breaks from labels", () => {
    const odd: TrackedMention = { label: "A [B]", ref: "person:a", kind: "PERSON" };
    expect(buildCommentary("@A [B]", [odd])).toBe("@[A B](amplify:person:a)");
  });

  it("treats raw token syntax typed by hand as plain markdown", () => {
    expect(buildCommentary("@[x](amplify:person:y)", [])).toBe("@x (amplify:person:y)");
  });

  it("drops Private Use Area characters the employee typed", () => {
    expect(buildCommentary("a\uE000b", [])).toBe("ab");
  });
});

describe("linkedInLength", () => {
  it("counts UTF-16 code units", () => {
    expect(linkedInLength("abc")).toBe(3);
    expect(linkedInLength(toBold("ab"))).toBe(4);
    expect(linkedInLength("😀")).toBe(2);
  });

  it("counts a mention token as its label only", () => {
    expect(linkedInLength("Hi @[Jane Smith](amplify:person:jane@wso2.com)!")).toBe("Hi Jane Smith!".length);
  });
});

describe("splitCommentary", () => {
  const tags = (wire: string) => splitCommentary(wire).filter((p) => p.kind === "hashtag").map((p) => p.text);

  // The same cases as the backend's little_text_test.bal, so preview and post agree.
  it("marks a # at the start of a word followed by letters or digits", () => {
    expect(tags("Go #Ballerina!")).toEqual(["#Ballerina"]);
    expect(tags("#first and (#second)")).toEqual(["#first", "#second"]);
    expect(tags("Unicode #café2026")).toEqual(["#café2026"]);
  });

  it("leaves a # inside a word, alone, or before an underscore as text", () => {
    expect(tags("C# and # and #_x and a#b")).toEqual([]);
    expect(tags("x_#tag and \\#tag and &#tag")).toEqual([]);
  });

  it("keeps only the letters and digits as the tag", () => {
    expect(splitCommentary("#tag_rest")).toEqual([
      { kind: "hashtag", text: "#tag" },
      { kind: "text", text: "_rest" },
    ]);
  });

  it("treats a # right after a mention as inside a word", () => {
    expect(tags("@[Jane](amplify:person:e-1)#tag")).toEqual([]);
    expect(tags("@[Jane](amplify:person:e-1) #tag")).toEqual(["#tag"]);
  });

  it("shows a mention as its label", () => {
    expect(splitCommentary("Hi @[Jane Smith](amplify:person:e-1)!")).toEqual([
      { kind: "text", text: "Hi " },
      { kind: "mention", text: "Jane Smith" },
      { kind: "text", text: "!" },
    ]);
  });
});
