// deno-lint-ignore-file no-explicit-any
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Exporta dados para Excel (.xlsx) com estilização básica.
 * @param data Array de objetos contendo os dados
 * @param fileName Nome do arquivo (sem extensão)
 * @param title Título a ser exibido na primeira linha da planilha
 */
export const exportToExcel = (data: any[], fileName: string, title: string = "Relatório") => {
  if (!data || data.length === 0) return;

  // Extrair cabeçalhos das chaves do primeiro objeto
  const headers = Object.keys(data[0]);

  // Preparar linhas da tabela
  const rows = data.map((item) => Object.values(item));

  // Criar planilha
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([]);

  // Adicionar título e subtítulo
  XLSX.utils.sheet_add_aoa(ws, [
    [title],
    [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`],
    [] // Linha em branco
  ], { origin: "A1" });

  // Adicionar cabeçalhos e dados
  XLSX.utils.sheet_add_aoa(ws, [headers, ...rows], { origin: "A4" });

  // Estilização
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4F46E5" } }, // Indigo-600
    alignment: { horizontal: "center", vertical: "center" }
  };

  const titleStyle = {
    font: { bold: true, sz: 14 }
  };

  // Aplicar estilo no título
  if (ws["A1"]) ws["A1"].s = titleStyle;

  // Aplicar estilo nos cabeçalhos
  headers.forEach((_, idx) => {
    const cellRef = XLSX.utils.encode_cell({ c: idx, r: 3 }); // Linha 4 (índice 3)
    if (ws[cellRef]) ws[cellRef].s = headerStyle;
  });

  // Ajustar largura das colunas
  const colWidths = headers.map(header => {
    // Pegar o tamanho máximo entre o cabeçalho e as linhas de dados daquela coluna
    const maxDataLength = Math.max(
      ...rows.map(row => (row[headers.indexOf(header)] ? String(row[headers.indexOf(header)]).length : 0))
    );
    return { wch: Math.max(header.length, maxDataLength) + 5 };
  });
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Dados");

  // Exportar arquivo
  XLSX.writeFile(wb, `${fileName}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
};

/**
 * Exporta dados para PDF (.pdf) com layout tabular.
 * @param data Array de objetos contendo os dados
 * @param fileName Nome do arquivo (sem extensão)
 * @param title Título do relatório
 */
export const exportToPDF = (data: any[], fileName: string, title: string = "Relatório") => {
  if (!data || data.length === 0) return;

  const doc = new jsPDF("landscape"); // Orientação paisagem para caber mais dados

  // Cabeçalho do documento
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 22);

  // Extrair cabeçalhos e linhas
  const headers = Object.keys(data[0]);
  const rows = data.map((item) => Object.values(item).map(v => String(v || "")));

  // Gerar a tabela usando jspdf-autotable
  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: [249, 250, 251] }, // Gray-50
  });

  // Salvar o arquivo
  doc.save(`${fileName}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
};
