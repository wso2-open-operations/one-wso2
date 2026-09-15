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

import type { ParFreeBusyResponse } from "../api/types";

export interface ParTimeSlot {
  start: string;
  end: string;
  label: string;
}

// par-app's own working hours (calendarSlice/index.ts) — 30-minute slots,
// 9am to 5pm.
const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;

/** 12-hour "9:00 AM" style label, matching calendarSlice's own formatter. */
function formatTimeForDisplay(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

// Ports calendarSlice's own generateAvailableTimeSlots: every 30-minute
// working-hours slot on `date` that doesn't overlap any busy period in
// `freeBusy.calendars` (every attendee's calendar, unioned). If `date` is
// today, slots already in the past are skipped by starting from the
// current hour rather than WORKING_HOURS_START.
export function generateAvailableTimeSlots(date: string, freeBusy: ParFreeBusyResponse): ParTimeSlot[] {
  const busySlots = Object.values(freeBusy.calendars ?? {}).flatMap((calendar) =>
    (calendar.busy ?? []).map((slot) => ({
      start: new Date(slot.start).getTime(),
      end: new Date(slot.end).getTime(),
    })),
  );

  const selectedDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  const isToday =
    date ===
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const startHour = isToday ? today.getHours() : WORKING_HOURS_START;

  const slots: ParTimeSlot[] = [];
  for (let hour = startHour; hour <= WORKING_HOURS_END; hour++) {
    for (const minute of [0, 30]) {
      if (hour === WORKING_HOURS_END && minute > 0) continue;

      const slotStart = new Date(selectedDate);
      slotStart.setHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      // Starting from the current hour still lets in one elapsed slot when
      // "now" is partway through it (e.g. 13:15 → the 13:00 slot is already
      // in the past).
      if (isToday && slotStart.getTime() <= today.getTime()) continue;

      const overlapsBusy = busySlots.some(
        (busy) => slotStart.getTime() < busy.end && slotEnd.getTime() > busy.start,
      );
      if (overlapsBusy) continue;

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        label: `${formatTimeForDisplay(slotStart.getHours(), slotStart.getMinutes())} - ${formatTimeForDisplay(slotEnd.getHours(), slotEnd.getMinutes())}`,
      });
    }
  }
  return slots;
}
