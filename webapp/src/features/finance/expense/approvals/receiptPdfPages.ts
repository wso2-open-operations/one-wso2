/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * pdf.js is loaded the first time a PDF receipt actually needs rendering, not
 * with the app. It is about a megabyte, and only the handful of people who
 * print a claim carrying a PDF bill ever need it.
 *
 * The worker it parses documents on comes from Vite as a built URL, so that
 * file is emitted and fingerprinted with the rest of the bundle rather than
 * fetched from a CDN at run time.
 */
let pdfjsModule: Promise<typeof import("pdfjs-dist")> | null = null;

function loadPdfjs() {
  pdfjsModule ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    return pdfjs;
  });
  return pdfjsModule;
}

/**
 * Renders every page of a PDF to a PNG data URL.
 *
 * A browser cannot print a PDF: it shows one only in its own viewer, and an
 * `<iframe>` of one prints blank. Drawing each page to a canvas turns the
 * receipt into pictures the print stylesheet can lay out like any other,
 * which is how the standalone app put PDF bills in its report.
 *
 * @param url - Object URL of the fetched receipt.
 * @param scale - Render scale. 1.5 keeps text on a scanned bill readable
 *   without making the page heavy enough to stall the print dialog.
 * @returns One PNG data URL per page, or an empty array if the file could not
 *   be read — the caller says so on the page rather than dropping it. Never a
 *   partial document: half a bill read as a whole one would be worse than
 *   saying the receipt could not be read at all.
 */
export async function pdfPagesToImages(url: string, scale = 1.5): Promise<string[]> {
  let loadingTask: { destroy: () => Promise<void> } | null = null;
  try {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({ url });
    loadingTask = task;
    const pdf = await task.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      // Giving back the pages read so far would present a truncated bill as a
      // complete one, with nothing to say the rest is missing.
      if (!context) return [];

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      pages.push(canvas.toDataURL("image/png"));
    }

    return pages;
  } catch {
    return [];
  } finally {
    // Releases the document and the worker behind it. The pages are already
    // data URLs by now, so nothing here is still needed — and a claim with
    // several PDF bills would otherwise hold a worker open for each one.
    // A failure to tear down must not throw away a bill that did render, so
    // this swallows it: the worst case is a worker that outlives the print.
    await loadingTask?.destroy().catch(() => undefined);
  }
}
