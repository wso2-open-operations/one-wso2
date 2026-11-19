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

vi.mock("../api/useSalesData", () => ({
  useRecordingPlayback: () => ({
    data: { url: "https://stream.example/42" },
    isLoading: false,
    error: null,
    refetch: vi.fn(async () => ({ data: { url: "https://stream.example/42" } })),
  }),
}));

import { fireEvent, render } from "@testing-library/react";
import RecordingPlayer from "./RecordingPlayer";

// jsdom has no media engine: play() is "not implemented" there and returns nothing.
const play = vi.fn(() => Promise.resolve());

beforeEach(() => {
  play.mockClear();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
});

describe("RecordingPlayer opening position", () => {
  it("moves to the second it was given once the recording can seek, tells the page, and only once", () => {
    const onTimeUpdate = vi.fn();
    const { container } = render(<RecordingPlayer meetingId={42} startAt={760} onTimeUpdate={onTimeUpdate} />);
    const video = container.querySelector("video") as HTMLVideoElement;

    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(760);
    expect(onTimeUpdate).toHaveBeenCalledWith(760);
    expect(play).toHaveBeenCalledTimes(1);

    // A re-minted URL reloads the element; where playback was is restored, not where it began.
    video.currentTime = 900;
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(900);
    expect(onTimeUpdate).toHaveBeenCalledTimes(1);
  });

  it("stays at the start without one, and does not try to play", () => {
    const { container } = render(<RecordingPlayer meetingId={42} />);
    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });

  it("keeps the opening position through a load that fails before any metadata", async () => {
    const { container } = render(<RecordingPlayer meetingId={42} startAt={760} />);
    const video = container.querySelector("video") as HTMLVideoElement;
    // An expired URL fails at once: the time is still 0, and must not replace the 760.
    fireEvent.error(video);
    await Promise.resolve();
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(760);
  });

  it("is not thrown off by a browser that refuses to play", async () => {
    play.mockImplementationOnce(() => Promise.reject(new DOMException("blocked", "NotAllowedError")));
    const { container } = render(<RecordingPlayer meetingId={42} startAt={30} />);
    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedMetadata(video);
    await Promise.resolve();
    expect(video.currentTime).toBe(30);
  });
});
