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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HttpError } from "@api/http";

const mutate = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useClaimOwnPost: () => ({ mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError, showSuccess }),
}));

import SubmitOwnPostDialog, { OWN_POST_NEXT_STEPS, OWN_POST_SUBMITTED_MESSAGE } from "./SubmitOwnPostDialog";

const POST = "https://www.linkedin.com/posts/jane_choreo-labs-activity-7400000000000000000-AbCd";
const problem = (status: number, code: string) =>
  new HttpError("https://api.test/external-shares", status, JSON.stringify({ status, code }));

const link = () => screen.getByLabelText(/LinkedIn post link/);
const note = () => screen.getByLabelText(/Note for the reviewer/);
const certify = () => screen.getByRole("checkbox", { name: /I wrote this post myself, and it's about Choreo Labs/ });
const submit = () => screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement;

function fillValid() {
  fireEvent.change(link(), { target: { value: POST } });
  fireEvent.click(certify());
}

describe("SubmitOwnPostDialog", () => {
  beforeEach(() => {
    mutate.mockReset();
    showSuccess.mockClear();
    showError.mockClear();
  });

  it("asks for the link, an optional note and the certification, and says what happens next", () => {
    render(<SubmitOwnPostDialog open onClose={() => {}} />);
    expect(screen.getByText("Submit your own post")).toBeTruthy();
    expect(link()).toBeTruthy();
    expect(note().getAttribute("maxlength")).toBe("500");
    expect(certify()).toBeTruthy();
    expect(screen.getByText(OWN_POST_NEXT_STEPS)).toBeTruthy();
    expect(OWN_POST_NEXT_STEPS).toMatch(/Waiting for review/);
    expect(OWN_POST_NEXT_STEPS).toMatch(/\+10 points, and \+15 more if featured/);
  });

  it("keeps Submit off until there is a LinkedIn post link and the box is ticked", () => {
    render(<SubmitOwnPostDialog open onClose={() => {}} />);
    expect(submit().disabled).toBe(true);
    fireEvent.change(link(), { target: { value: POST } });
    expect(submit().disabled).toBe(true);
    fireEvent.click(certify());
    expect(submit().disabled).toBe(false);
  });

  it("refuses a link that isn't a LinkedIn post, once the field is left", () => {
    render(<SubmitOwnPostDialog open onClose={() => {}} />);
    fireEvent.change(link(), { target: { value: "https://medium.com/@jane/my-post" } });
    fireEvent.click(certify());
    expect(screen.queryByText(/Paste the link to your LinkedIn post/)).toBeNull();
    fireEvent.blur(link());
    expect(screen.getByText(/Paste the link to your LinkedIn post/)).toBeTruthy();
    expect(submit().disabled).toBe(true);
    fireEvent.click(submit());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("explains that a short lnkd.in link can't be used", () => {
    render(<SubmitOwnPostDialog open onClose={() => {}} />);
    fireEvent.change(link(), { target: { value: "https://lnkd.in/abc" } });
    fireEvent.blur(link());
    expect(screen.getByText(/Short lnkd.in links can't be checked/)).toBeTruthy();
  });

  it("sends the link as evidenceUrl with certified: true, and no note when there is none", () => {
    render(<SubmitOwnPostDialog open onClose={() => {}} />);
    fillValid();
    fireEvent.click(submit());
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ evidenceUrl: POST, certified: true });
  });

  it("sends the trimmed note for the reviewer when there is one", () => {
    render(<SubmitOwnPostDialog open onClose={() => {}} />);
    fillValid();
    fireEvent.change(note(), { target: { value: "  Written for the launch.  " } });
    fireEvent.click(submit());
    expect(mutate.mock.calls[0][0]).toEqual({ evidenceUrl: POST, certified: true, note: "Written for the launch." });
  });

  it("thanks the employee and closes on success", () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_body, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<SubmitOwnPostDialog open onClose={onClose} />);
    fillValid();
    fireEvent.click(submit());
    expect(showSuccess).toHaveBeenCalledWith(OWN_POST_SUBMITTED_MESSAGE);
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ["EVIDENCE_ALREADY_CLAIMED", 409, "This post has already been submitted."],
    ["DAILY_LIMIT_REACHED", 429, "You've reached today's limit for submitting your own posts. Try again tomorrow."],
  ])("explains %s and stays open", (code, status, message) => {
    const onClose = vi.fn();
    mutate.mockImplementation((_body, opts: { onError: (e: unknown) => void }) => opts.onError(problem(status, code)));
    render(<SubmitOwnPostDialog open onClose={onClose} />);
    fillValid();
    fireEvent.click(submit());
    expect(showError).toHaveBeenCalledWith(message);
    expect(onClose).not.toHaveBeenCalled();
  });
});
