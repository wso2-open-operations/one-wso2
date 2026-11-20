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

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Reveal from "./Reveal";

describe("Reveal", () => {
  it("keeps its children out of the DOM until shown", () => {
    render(<Reveal label="secrets">top secret</Reveal>);
    expect(screen.queryByText("top secret")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show secrets" }));
    expect(screen.getByText("top secret")).toBeInTheDocument();
  });

  it("hides them again from the eye button", () => {
    render(<Reveal label="secrets" defaultRevealed>top secret</Reveal>);
    fireEvent.click(screen.getByRole("button", { name: "Hide secrets" }));
    expect(screen.queryByText("top secret")).not.toBeInTheDocument();
  });

  it("defers to the caller in controlled mode", () => {
    const onChange = vi.fn();
    render(
      <Reveal label="secrets" revealed={false} onRevealedChange={onChange}>
        top secret
      </Reveal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show secrets" }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText("top secret")).not.toBeInTheDocument();
  });

  it("puts the hide button in the header row when given one, only once revealed", () => {
    render(
      <Reveal label="secrets" header={<span>Title</span>}>
        top secret
      </Reveal>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide secrets" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show secrets" }));
    const hide = screen.getByRole("button", { name: "Hide secrets" });
    expect(hide.parentElement).toBe(screen.getByText("Title").parentElement?.parentElement);
  });
});
