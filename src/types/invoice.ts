export interface InvoiceLineItem {
  item: string;
  mat: string;
  desc: string;
  hsn: string;
  qty: number;
  uom: string;
  price: number;
  gross: number;
  disc: number;
  net: number;
  rate: number; // decimal e.g. 0.18 for 18%
  IGST: number;
  CGST: number;
  SGST: number;
  cessRate: number; // decimal e.g. 0.17 for 17%
  cessAmt: number;
}

export interface ExtractedPageRows {
  n: number;
  rows: string[][];
}

export interface InvoiceRecord {
  fid: number;
  file: string;
  key: string;
  no: string;
  date: string;
  cust: string;
  code: string;
  cgst: string; // Customer GSTIN
  sup: string;
  sgst: string; // Supplier GSTIN
  pos: string;
  irn: string;
  del: string;
  ord: string;
  gi: string;
  rc: string;
  pay: string;
  amt: number; // Printed Invoice Amount
  roundOff: number;
  cess: number;
  items: InvoiceLineItem[];
  pages: ExtractedPageRows[];
  parserMode: string;
  pdfBuffer?: ArrayBuffer;
  pdfPassword?: string;
}

export interface ValidationIssue {
  sev: 'err' | 'warn';
  chk: string;
  msg: string;
  invoiceFid: number;
  invoiceNo: string;
  file: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  byInvoice: Map<number, ValidationIssue[]>;
}

export interface InvoiceSettings {
  tol: number;
  includePagesInExcel: boolean;
}

export interface AggGroup {
  n: number;
  qty: number;
  net: number;
  IGST: number;
  CGST: number;
  SGST: number;
  cessAmt: number;
}

export interface HsnAggGroup extends AggGroup {
  hsn: string;
  desc: string;
  rate: number;
}

export interface RateAggGroup extends AggGroup {
  rate: number;
  hsnCodes: Set<string>;
}

export interface InvoiceAggGroup extends AggGroup {
  fid: number;
  no: string;
  date: string;
  cust: string;
  amt: number;
  roundOff: number;
}

export interface PartyAggGroup {
  name: string;
  gstin: string;
  state: string;
  invoiceIds: Set<number>;
  lines: number;
  qty: number;
  net: number;
  IGST: number;
  CGST: number;
  SGST: number;
  cessAmt: number;
}
