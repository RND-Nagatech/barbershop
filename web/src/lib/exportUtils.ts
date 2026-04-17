import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ExportMeta = {
  periodText?: string;
  branchName?: string;
};

const BORDER_COLOR = "C8C8C8";
const borderThin = {
  top: { style: "thin", color: { rgb: BORDER_COLOR } },
  bottom: { style: "thin", color: { rgb: BORDER_COLOR } },
  left: { style: "thin", color: { rgb: BORDER_COLOR } },
  right: { style: "thin", color: { rgb: BORDER_COLOR } },
} as const;

const applyBorders = (ws: XLSX.WorkSheet, range: XLSX.Range) => {
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] || (ws[addr] = { t: "s", v: "" } as any);
      cell.s = {
        ...(cell.s || {}),
        border: borderThin,
      };
    }
  }
};

export function exportToExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  footerRow?: (string | number)[] | (string | number)[][],
  meta?: ExportMeta,
) {
  const wb = XLSX.utils.book_new();
  
  const metaLines = [String(title || "").toUpperCase(), meta?.periodText, meta?.branchName ? String(meta.branchName).toUpperCase() : ""].filter(Boolean);
  const padRow = (row: (string | number)[]) => {
    if (row.length >= headers.length) return row;
    return [...row, ...Array(headers.length - row.length).fill("")];
  };

  // Meta rows + empty row + header + data
  const wsData: (string | number)[][] = [
    ...metaLines.map((l) => [l]),
    [],
    headers,
    ...rows.map(padRow),
  ];
  if (footerRow) {
    const footers = Array.isArray(footerRow[0]) ? (footerRow as (string | number)[][]) : [footerRow as (string | number)[]];
    wsData.push(...footers.map(padRow));
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  // Merges + styles for meta rows
  const merges: XLSX.Range[] = [];
  metaLines.forEach((_line, idx) => {
    merges.push({ s: { r: idx, c: 0 }, e: { r: idx, c: headers.length - 1 } });
    const addr = XLSX.utils.encode_cell({ r: idx, c: 0 });
    ws[addr].s = {
      font: { bold: idx === 0 },
      alignment: { horizontal: "center", vertical: "center" },
    };
  });
  ws["!merges"] = merges;

  const headerRowIndex = metaLines.length + 1; // after meta lines + blank row
  const footerCount = footerRow ? (Array.isArray(footerRow[0]) ? (footerRow as any).length : 1) : 0;
  const lastRow = wsData.length - 1;

  // Style header row
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    const cell = ws[addr];
    if (!cell) continue;
    cell.s = {
      ...(cell.s || {}),
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "2D2824" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: borderThin,
    };
  }

  // Apply borders for table area (header -> last row)
  applyBorders(ws, { s: { r: headerRowIndex, c: 0 }, e: { r: lastRow, c: headers.length - 1 } });

  // Footer rows style (if present)
  if (footerCount > 0) {
    for (let r = lastRow - footerCount + 1; r <= lastRow; r++) {
      for (let c = 0; c < headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        cell.s = {
          ...(cell.s || {}),
          font: { bold: true },
          fill: { patternType: "solid", fgColor: { rgb: "F5F2EB" } },
          border: borderThin,
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  footerRow?: (string | number)[] | (string | number)[][],
  meta?: ExportMeta,
) {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const titleUpper = String(title || "").toUpperCase();
  const periodText = String(meta?.periodText || "");
  const branchName = meta?.branchName ? String(meta.branchName).toUpperCase() : "";

  let y = 18;
  doc.setFontSize(14);
  doc.text(titleUpper, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(10);
  if (periodText) {
    doc.text(periodText, pageWidth / 2, y, { align: "center" });
    y += 5;
  }
  if (branchName) {
    doc.text(branchName, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const body = [...rows];
  const footers = footerRow
    ? (Array.isArray((footerRow as any)[0]) ? (footerRow as (string | number)[][]) : [footerRow as (string | number)[]])
    : [];
  if (footers.length) body.push(...footers);

  autoTable(doc, {
    startY: Math.max(28, y),
    head: [headers],
    body,
    theme: "grid",
    headStyles: {
      fillColor: [45, 40, 36],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [200, 200, 200],
      lineWidth: 0.5,
    },
    footStyles: {
      fillColor: [245, 242, 235],
      fontStyle: "bold",
    },
    didParseCell: (data) => {
      if (footers.length && data.section === "body" && data.row.index >= body.length - footers.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 242, 235];
      }
    },
  });

  doc.save(`${filename}.pdf`);
}
