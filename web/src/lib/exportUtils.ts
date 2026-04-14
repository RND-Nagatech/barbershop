import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  footerRow?: (string | number)[]
) {
  const wb = XLSX.utils.book_new();
  
  // Title row + empty row + header + data
  const wsData: (string | number)[][] = [
    [title],
    [],
    headers,
    ...rows,
  ];
  if (footerRow) wsData.push(footerRow);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  // Merge title across all columns
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];

  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  footerRow?: (string | number)[]
) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title, 14, 20);

  const body = [...rows];
  if (footerRow) body.push(footerRow);

  autoTable(doc, {
    startY: 30,
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
      if (footerRow && data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 242, 235];
      }
    },
  });

  doc.save(`${filename}.pdf`);
}
