declare module "pdf-parse" {
  interface PdfResult {
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    text?: string;
    version?: string;
  }
  function pdfParse(data: Buffer | string): Promise<PdfResult>;
  export default pdfParse;
}
