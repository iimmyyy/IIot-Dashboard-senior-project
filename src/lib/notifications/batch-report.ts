import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { ResearchAlert } from "@/types";

export type BatchReportContext = {
  batchLabel?: string;
  batchStatus?: string;
  startedAt?: string | null;
  generatedAt?: string;
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 48;
const green = rgb(0.09, 0.42, 0.36);
const dark = rgb(0.1, 0.16, 0.14);
const muted = rgb(0.39, 0.48, 0.45);
const border = rgb(0.87, 0.91, 0.89);
const softGreen = rgb(0.93, 0.97, 0.95);
const softAmber = rgb(0.99, 0.97, 0.91);

function pdfText(value: string) {
  return value
    .replaceAll("°", " deg ")
    .replaceAll("²", "2")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayDateTime(value?: string | null) {
  if (!value) return "Not supplied";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const words = pdfText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawWrapped(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    width: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
  },
) {
  const lineHeight = options.lineHeight ?? options.size * 1.45;
  const lines = wrapText(text, options.font, options.size, options.width);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * lineHeight,
      size: options.size,
      font: options.font,
      color: options.color ?? dark,
    });
  });
  return options.y - lines.length * lineHeight;
}

function filenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
}

export function batchReportFilename(alert: ResearchAlert) {
  const experiment = filenamePart(alert.experiment_id) || "experiment";
  const chamber = filenamePart(alert.chamber_id ?? "machine") || "machine";
  return `${experiment}-${chamber}-batch-summary.pdf`;
}

export async function createBatchSummaryPdf(
  alert: ResearchAlert,
  context: BatchReportContext = {},
) {
  const generatedAt = context.generatedAt ?? new Date().toISOString();
  const chamber = alert.chamber_id ?? "Unassigned";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`BioDry Batch Summary - ${alert.experiment_id} - ${chamber}`);
  pdf.setAuthor("BioDry Research Monitor");
  pdf.setSubject("Draft batch alert summary");
  pdf.setCreator("BioDry Research Monitor");
  pdf.setCreationDate(new Date(generatedAt));

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([pageWidth, pageHeight]);

  page.drawRectangle({
    x: 0,
    y: pageHeight - 142,
    width: pageWidth,
    height: 142,
    color: green,
  });
  page.drawText("BIODRY RESEARCH MONITOR", {
    x: margin,
    y: pageHeight - 52,
    size: 9,
    font: bold,
    color: rgb(0.78, 0.91, 0.86),
  });
  page.drawText("Batch Summary", {
    x: margin,
    y: pageHeight - 86,
    size: 27,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("DRAFT - reporting fields will be refined", {
    x: margin,
    y: pageHeight - 112,
    size: 10,
    font: regular,
    color: rgb(0.86, 0.95, 0.92),
  });

  let y = pageHeight - 174;
  const cardHeight = 116;
  page.drawRectangle({
    x: margin,
    y: y - cardHeight,
    width: pageWidth - margin * 2,
    height: cardHeight,
    color: rgb(0.98, 0.99, 0.985),
    borderColor: border,
    borderWidth: 1,
  });
  const metadata = [
    ["Experiment", alert.experiment_id],
    ["Machine", chamber],
    ["Batch", context.batchLabel ?? "Current batch"],
    ["Status", context.batchStatus ?? "Temperature peak alert triggered"],
    ["Batch started", displayDateTime(context.startedAt)],
    ["Alert detected", `${displayDateTime(alert.detected_at)} ICT`],
  ];
  metadata.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + 18 + column * 244;
    const rowY = y - 26 - row * 34;
    page.drawText(label.toUpperCase(), {
      x,
      y: rowY,
      size: 7.5,
      font: bold,
      color: muted,
    });
    page.drawText(pdfText(value), {
      x,
      y: rowY - 14,
      size: 10,
      font: bold,
      color: dark,
    });
  });

  y -= cardHeight + 30;
  page.drawText("Alert summary", { x: margin, y, size: 16, font: bold, color: dark });
  y -= 24;
  page.drawText(pdfText(alert.title), {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: green,
  });
  y = drawWrapped(page, alert.description, {
    x: margin,
    y: y - 20,
    width: pageWidth - margin * 2,
    font: regular,
    size: 10,
    color: muted,
  });

  y -= 18;
  page.drawText("Supporting values", { x: margin, y, size: 16, font: bold, color: dark });
  y -= 15;
  const values = alert.supporting_values.length
    ? alert.supporting_values
    : [{ label: "Evidence", value: "No supporting values supplied" }];
  values.slice(0, 4).forEach((item, index) => {
    const rowY = y - 30 - index * 31;
    if (index % 2 === 0)
      page.drawRectangle({
        x: margin,
        y: rowY - 10,
        width: pageWidth - margin * 2,
        height: 30,
        color: rgb(0.975, 0.985, 0.98),
      });
    page.drawText(pdfText(item.label), {
      x: margin + 12,
      y: rowY,
      size: 9.5,
      font: regular,
      color: muted,
    });
    const value = pdfText(item.value);
    page.drawText(value, {
      x: pageWidth - margin - 12 - bold.widthOfTextAtSize(value, 9.5),
      y: rowY,
      size: 9.5,
      font: bold,
      color: dark,
    });
  });
  y -= values.slice(0, 4).length * 31 + 34;

  const actionLines = wrapText(alert.action, regular, 10, pageWidth - margin * 2 - 32);
  const actionHeight = 52 + Math.max(0, actionLines.length - 1) * 14;
  page.drawRectangle({
    x: margin,
    y: y - actionHeight,
    width: pageWidth - margin * 2,
    height: actionHeight,
    color: softGreen,
  });
  page.drawText("RECOMMENDED ACTION", {
    x: margin + 16,
    y: y - 19,
    size: 8,
    font: bold,
    color: green,
  });
  drawWrapped(page, alert.action, {
    x: margin + 16,
    y: y - 37,
    width: pageWidth - margin * 2 - 32,
    font: regular,
    size: 10,
    color: dark,
    lineHeight: 14,
  });
  y -= actionHeight + 14;

  page.drawRectangle({
    x: margin,
    y: y - 50,
    width: pageWidth - margin * 2,
    height: 50,
    color: softAmber,
  });
  drawWrapped(
    page,
    "Draft scope: this PDF summarizes the current alert context only. It is not a validated final batch report or an instruction to operate equipment.",
    {
      x: margin + 14,
      y: y - 18,
      width: pageWidth - margin * 2 - 28,
      font: regular,
      size: 8.5,
      color: rgb(0.43, 0.34, 0.16),
      lineHeight: 12,
    },
  );

  page.drawLine({
    start: { x: margin, y: 38 },
    end: { x: pageWidth - margin, y: 38 },
    thickness: 0.7,
    color: border,
  });
  page.drawText(`Alert ID: ${pdfText(alert.id)}`, {
    x: margin,
    y: 22,
    size: 7.5,
    font: regular,
    color: muted,
  });
  const footer = `Generated ${displayDateTime(generatedAt)} ICT  |  Page 1 of 1`;
  page.drawText(footer, {
    x: pageWidth - margin - regular.widthOfTextAtSize(footer, 7.5),
    y: 22,
    size: 7.5,
    font: regular,
    color: muted,
  });

  return pdf.save();
}
