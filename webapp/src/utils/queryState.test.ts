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
  booleanParam,
  integerParam,
  listParam,
  oneOfParam,
  queryReader,
  queryWriter,
} from "./queryState";

// The two rules every parameter here exists to keep, and the reason this is a
// module rather than a handful of inline ternaries at each call site:
//
//   1. A default view writes an EMPTY query string. Anything else and a link is
//      full of noise that says nothing, and "did this link carry state?" stops
//      being answerable.
//   2. A value nobody recognises is IGNORED, never thrown on. A link picks up a
//      typo, an old parameter, a marketing `utm_source`; every one of those has
//      to land on the default view rather than a stack trace.
//
// The per-screen vocabulary lives with its screen. What lives here is the
// mechanics both of those rules need.

describe("booleanParam", () => {
  it("writes the compact form a URL wants", () => {
    expect(booleanParam.format(true)).toBe("1");
    expect(booleanParam.format(false)).toBe("0");
  });

  // Someone editing a link by hand writes what reads like a boolean, not what
  // the serialiser happens to emit. Both cost one branch to accept.
  it("reads the compact form and the spelled-out one", () => {
    expect(booleanParam.parse("1")).toBe(true);
    expect(booleanParam.parse("true")).toBe(true);
    expect(booleanParam.parse("0")).toBe(false);
    expect(booleanParam.parse("false")).toBe(false);
  });

  it("has no opinion about anything else", () => {
    expect(booleanParam.parse("maybe")).toBeUndefined();
    expect(booleanParam.parse("")).toBeUndefined();
    expect(booleanParam.parse("TRUE")).toBeUndefined();
  });
});

describe("listParam", () => {
  it("round-trips a comma-separated list", () => {
    expect(listParam.format(["EMEA", "APAC"])).toBe("EMEA,APAC");
    expect(listParam.parse("EMEA,APAC")).toEqual(["EMEA", "APAC"]);
  });

  it("tolerates the whitespace a pasted link picks up", () => {
    expect(listParam.parse("EMEA, APAC ,  NA")).toEqual(["EMEA", "APAC", "NA"]);
  });

  // An empty list is not a filter. Returning [] would count as a recognised
  // value and make `?region=` look like an applied filter that matches nothing.
  it("treats a list with nothing in it as no value at all", () => {
    expect(listParam.parse("")).toBeUndefined();
    expect(listParam.parse(",,")).toBeUndefined();
    expect(listParam.parse(" , ")).toBeUndefined();
  });
});

describe("oneOfParam", () => {
  const channel = oneOfParam(["All", "Channel", "Direct"] as const);

  it("accepts exactly the values offered", () => {
    expect(channel.parse("Direct")).toBe("Direct");
    expect(channel.parse("Both")).toBeUndefined();
  });

  // The allowed list is the display vocabulary, so it is case-sensitive on
  // purpose: "direct" is not a value this app ever wrote.
  it("does not guess at casing", () => {
    expect(channel.parse("direct")).toBeUndefined();
  });
});

describe("integerParam", () => {
  const years = integerParam({ min: 1, max: 10 });

  it("accepts whole numbers inside the range", () => {
    expect(years.parse("1")).toBe(1);
    expect(years.parse("10")).toBe(10);
    expect(years.format(3)).toBe("3");
  });

  it("refuses the ways a number can be wrong", () => {
    expect(years.parse("0")).toBeUndefined();
    expect(years.parse("11")).toBeUndefined();
    expect(years.parse("-1")).toBeUndefined();
    expect(years.parse("3.5")).toBeUndefined();
    expect(years.parse("x")).toBeUndefined();
  });

  // `Number("")` is 0 and `Number(" ")` is 0, which would sail through a bare
  // `Number.isInteger` check on a range that happened to include zero.
  it("refuses an empty value rather than reading it as zero", () => {
    expect(integerParam({ min: 0, max: 10 }).parse("")).toBeUndefined();
    expect(integerParam({ min: 0, max: 10 }).parse("   ")).toBeUndefined();
  });
});

describe("the writer", () => {
  it("omits a value that equals the default", () => {
    const query = queryWriter();
    query.setIfChanged("ytd", true, true, booleanParam);
    expect(query.toString()).toBe("");
  });

  it("writes a value that differs from the default", () => {
    const query = queryWriter();
    query.setIfChanged("ytd", false, true, booleanParam);
    expect(query.toString()).toBe("ytd=0");
  });

  // A filter the caller has not set yet is not a filter set to nothing.
  it("omits a value that is not there", () => {
    const query = queryWriter();
    query.setIfChanged("ytd", undefined, true, booleanParam);
    query.setIfChanged("years", null, 5, integerParam({ min: 1, max: 10 }));
    expect(query.toString()).toBe("");
  });

  // Lists are rebuilt on every apply, so they are never the same object as the
  // default. Comparing by reference would write every list filter into every
  // URL, and the default view would stop serialising to "".
  it("compares lists by their contents, not by identity", () => {
    const query = queryWriter();
    query.setIfChanged("region", ["EMEA"], ["EMEA"], listParam);
    expect(query.toString()).toBe("");

    const changed = queryWriter();
    changed.setIfChanged("region", ["EMEA", "APAC"], ["EMEA"], listParam);
    expect(changed.toString()).toBe("region=EMEA%2CAPAC");
  });

  it("writes a value with no default unconditionally", () => {
    const query = queryWriter();
    query.set("scale", "k");
    expect(query.toString()).toBe("scale=k");
  });

  it("keeps parameters in the order they were written", () => {
    const query = queryWriter();
    query.set("table", "customers");
    query.setIfChanged("years", 3, 5, integerParam({ min: 1, max: 10 }));
    query.setIfChanged("ytd", false, true, booleanParam);
    expect(query.toString()).toBe("table=customers&years=3&ytd=0");
  });
});

describe("the reader", () => {
  it("reads a recognised value and counts it as view state", () => {
    const query = queryReader("?ytd=0");
    expect(query.read("ytd", booleanParam)).toBe(false);
    expect(query.recognised).toBe(1);
  });

  it("works with or without the leading question mark", () => {
    expect(queryReader("ytd=0").read("ytd", booleanParam)).toBe(false);
    expect(queryReader("?ytd=0").read("ytd", booleanParam)).toBe(false);
  });

  // The whole point of the ignore rule: a malformed value must leave no trace,
  // or a link with a typo in it still counts as carrying a view and the screen
  // shows a half-restored one instead of the default.
  it("ignores a malformed value without counting it", () => {
    const query = queryReader("?ytd=maybe&years=99");
    expect(query.read("ytd", booleanParam)).toBeUndefined();
    expect(query.read("years", integerParam({ min: 1, max: 10 }))).toBeUndefined();
    expect(query.recognised).toBe(0);
  });

  it("ignores a parameter that is not there", () => {
    const query = queryReader("?utm_source=mail");
    expect(query.read("ytd", booleanParam)).toBeUndefined();
    expect(query.recognised).toBe(0);
  });

  // Some parameters ride along in the URL without being part of the view — a
  // display preference, say. They are read, but a link carrying only one of
  // them is still a link carrying no view.
  it("can read a parameter without counting it as view state", () => {
    const query = queryReader("?scale=k");
    expect(query.read("scale", oneOfParam(["k"] as const), { countsAsViewState: false })).toBe("k");
    expect(query.recognised).toBe(0);
  });

  it("counts each recognised parameter once", () => {
    const query = queryReader("?ytd=0&years=3&region=EMEA,APAC");
    query.read("ytd", booleanParam);
    query.read("years", integerParam({ min: 1, max: 10 }));
    query.read("region", listParam);
    expect(query.recognised).toBe(3);
  });
});
