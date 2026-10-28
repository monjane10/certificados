// A4 horizontal sem margens; o certificado é impresso a escala 1 (1123x794 px ≈ 297x210 mm)
// e com as cores de fundo (por defeito os browsers não imprimem fundos).
export const PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .cert-frame { width: 297mm !important; height: 210mm !important; aspect-ratio: auto !important; }
  .cert-scaler { transform: none !important; }
  .cert-frame, .cert-frame * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
