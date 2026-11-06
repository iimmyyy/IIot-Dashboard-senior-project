import { describe, expect, it } from "vitest";
import { demoAlerts } from "@/lib/mock/data";
import { batchReportFilename, createBatchSummaryPdf } from "./batch-report";

describe("batch summary PDF", () => {
  it("creates a one-page PDF with a stable batch filename", async () => {
    const alert = demoAlerts()[0];
    const bytes = await createBatchSummaryPdf(alert, {
      batchLabel: "Batch 2",
      batchStatus: "Ready for review",
      startedAt: "2026-10-23T01:00:00Z",
      generatedAt: "2026-10-30T02:00:00Z",
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(2_000);
    expect(batchReportFilename(alert)).toMatch(/\.pdf$/);
  });
});
