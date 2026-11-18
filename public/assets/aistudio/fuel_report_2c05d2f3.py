#!/usr/bin/env python3
"""
Monthly Fuel Report Generator  (IOCL XTRAPOWER / Easy Fuel)
===========================================================

Input : IOCL "Easy Fuel Customer Transaction Details" Excel file (.xlsx)
Output: "<Mon YY> - report.xlsx"  (same layout as the manual Aug'26 report)

What it does
  1. Finds the header row automatically (the row that has "Txn Type").
  2. Keeps only  Txn Type = "Sale"  (drops Fund Allocation / Recharge /
     Recharge Reverse / Incentive rows).
  3. Sorts by Txn ID (oldest first) and renumbers SNo. 1..N.
  4. Keeps these columns: SNo., Terminal ID, Merchant ID, Merchant Name,
     Merchant PAN, Merchant State, Location, Customer ID/Card PAN,
     Name of Card Holder, Txn ID, Txn Date, Txn Type, Txn Mode,
     Txn Mode Value, Product, Currency, Price (= RSP), Quantity, Amount.
  5. Adds the summary block with live Excel formulas
     (Total, then PETROL / DIESEL / ... and Grand Total).
  6. Runs sanity checks and prints a reconciliation summary.

Usage
  python fuel_report.py                      -> opens a file picker
  python fuel_report.py IOCL_Report.xlsx     -> report saved next to the input
  python fuel_report.py IOCL.xlsx -o out.xlsx
  python fuel_report.py IOCL.xlsx --pdf EasyFuelStatement.pdf
        (optional: also reconciles the total against the PDF's
         "CCMS SALE" figure)

Requires:  pip install openpyxl pandas   (pypdf optional, for --pdf)
"""
import argparse
import os
import re
import sys
from datetime import datetime

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, Side
from openpyxl.utils import get_column_letter

# ----------------------------------------------------------------------------
# Settings (change here if the layout ever changes)
# ----------------------------------------------------------------------------
KEEP_TXN_TYPE = "Sale"

# (output header, source column in IOCL file)
COLUMNS = [
    ("SNo.", None),                       # generated
    ("Terminal ID", "Terminal ID"),
    ("Merchant ID", "Merchant ID"),
    ("Merchant Name", "Merchant Name"),
    ("Merchant PAN", "Merchant PAN"),
    ("Merchant State", "Merchant State"),
    ("Location", "Location"),
    ("Customer ID/Card PAN", "Customer ID/Card PAN"),
    ("Name of Card Holder", "Name of Card Holder"),
    ("Txn ID", "Txn ID"),
    (" Txn Date", "Txn Date"),            # header keeps the leading space of the original
    ("Txn Type", "Txn Type"),
    ("Txn Mode", "Txn Mode"),
    ("Txn Mode Value", "Txn Mode Value"),
    ("Product", "Product"),
    ("Currency", "Currency"),
    ("Price", "RSP"),
    ("Quantity", "Quantity"),
    ("Amount", "Amount"),
]
WIDTHS = [7.1, 15.9, 16.3, 36.8, 15, 15.9, 40.8, 28.1, 20.7, 13, 20.3,
          10.4, 11.3, 20.9, 9.6, 10.4, 8.6, 11.6, 13.3]
INT_COLS = {"Terminal ID", "Merchant ID", "Txn ID"}            # stored as numbers
TEXT_COLS = {"Customer ID/Card PAN", "Txn Mode Value"}          # stored as text (16-digit)
NUM_COLS = {"Price", "Quantity", "Amount"}
NUM_FMT = '_ * #,##0.00_ ;_ * \\-#,##0.00_ ;_ * "-"??_ ;_ @_ '
FONT = "Calibri"
THIN = Side(style="thin")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


# ----------------------------------------------------------------------------
# Reading
# ----------------------------------------------------------------------------
def load_iocl(path):
    """Return (dataframe, period_text). Header row is auto-detected."""
    raw = pd.read_excel(path, header=None, dtype=object)
    header_row = None
    for i in range(min(len(raw), 40)):
        vals = [str(v).strip() for v in raw.iloc[i].tolist()]
        if "Txn Type" in vals and "Amount" in vals:
            header_row = i
            break
    if header_row is None:
        raise SystemExit("ERROR: could not find the header row (a row with "
                         "'Txn Type' and 'Amount'). Is this the IOCL Easy Fuel "
                         "transaction details file?")

    period = ""
    for i in range(header_row):
        for v in raw.iloc[i].tolist():
            if isinstance(v, str) and "Period" in v:
                period = v

    df = raw.iloc[header_row + 1:].copy()
    df.columns = [str(c).strip() for c in raw.iloc[header_row].tolist()]
    df = df.dropna(how="all")
    df = df[pd.to_numeric(df["SNo."], errors="coerce").notna()]  # drop footers
    return df.reset_index(drop=True), period


def month_label(period_text, df):
    """'Aug'26' + start/end dates, from the Period line or from the data."""
    m = re.search(r"(\d{2}/\d{2}/\d{4})\s*To\s*(\d{2}/\d{2}/\d{4})", period_text or "")
    if m:
        start = datetime.strptime(m.group(1), "%d/%m/%Y")
        end = datetime.strptime(m.group(2), "%d/%m/%Y")
    else:
        d = pd.to_datetime(df["Txn Date"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
        start, end = d.min().to_pydatetime(), d.max().to_pydatetime()
    return start.strftime("%b'%y"), start, end


# ----------------------------------------------------------------------------
# Building
# ----------------------------------------------------------------------------
def build_sales(df):
    sales = df[df["Txn Type"].astype(str).str.strip() == KEEP_TXN_TYPE].copy()
    sales["_id"] = pd.to_numeric(sales["Txn ID"])
    sales = sales.sort_values("_id").reset_index(drop=True)
    return sales


def clean(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    return v


def write_report(sales, label, out_path):
    wb = Workbook()
    ws = wb.active
    ws.title = label

    hdr_font = Font(name=FONT, size=11, bold=True)
    body_font = Font(name=FONT, size=11)

    # header
    for c, (head, _) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=c, value=head)
        cell.font, cell.border = hdr_font, BORDER
        ws.column_dimensions[get_column_letter(c)].width = WIDTHS[c - 1]

    # body
    for r, (_, row) in enumerate(sales.iterrows(), start=2):
        for c, (head, src) in enumerate(COLUMNS, start=1):
            if src is None:
                val = r - 1
            else:
                val = clean(row[src])
                if val is not None:
                    if head in INT_COLS:
                        val = int(float(val))
                    elif head in NUM_COLS:
                        val = float(val)
                    else:
                        val = str(val)
            cell = ws.cell(row=r, column=c, value=val)
            cell.font, cell.border = body_font, BORDER
            if head in NUM_COLS:
                cell.number_format = NUM_FMT

    first, last = 2, 1 + len(sales)
    ws.auto_filter.ref = f"A1:S{last}"
    ws.freeze_panes = "A2"

    # summary block (live formulas)
    tot_row = last + 2
    bold12 = Font(name=FONT, size=12, bold=True)
    ws.merge_cells(start_row=tot_row, start_column=10, end_row=tot_row, end_column=16)
    t = ws.cell(row=tot_row, column=10, value=f"Fuel Statements for the Month of {label}")
    t.font, t.alignment = bold12, Alignment(horizontal="center")
    ws.cell(row=tot_row, column=17, value="Total").font = bold12
    for col in ("R", "S"):
        c = ws[f"{col}{tot_row}"]
        c.value = f"=SUM({col}{first}:{col}{last})"
        c.font, c.number_format = bold12, NUM_FMT

    found = {str(p).strip() for p in sales["Product"].dropna()}
    products = [p for p in ("PETROL", "DIESEL") if p in found] + sorted(found - {"PETROL", "DIESEL"})
    pr = tot_row + 2
    p_first = pr
    for p in products:
        ws.cell(row=pr, column=17, value=p).font = body_font
        for col in ("R", "S"):
            c = ws[f"{col}{pr}"]
            c.value = (f"=SUMIF($O${first}:$O${last},$Q{pr},"
                       f"${col}${first}:${col}${last})")
            c.font, c.number_format = body_font, NUM_FMT
        pr += 1
    p_last = pr - 1
    gt = pr + 1
    ws.cell(row=gt, column=17, value="Total").font = bold12
    for col in ("R", "S"):
        c = ws[f"{col}{gt}"]
        c.value = f"=SUM({col}{p_first}:{col}{p_last})"
        c.font, c.number_format = bold12, NUM_FMT
    ws.cell(row=gt + 2, column=10,
            value="Check (grand total - total, must be 0):").font = body_font
    for col in ("R", "S"):
        c = ws[f"{col}{gt + 2}"]
        c.value = f"=ROUND({col}{gt}-{col}{tot_row},2)"
        c.font, c.number_format = body_font, NUM_FMT

    wb.save(out_path)
    return last, tot_row, gt


# ----------------------------------------------------------------------------
# Checks
# ----------------------------------------------------------------------------
def pdf_sale_total(pdf_path):
    try:
        from pypdf import PdfReader
    except ImportError:
        return None, "pypdf not installed (pip install pypdf) - PDF check skipped"
    text = PdfReader(pdf_path).pages[0].extract_text()
    m = re.search(r"CCMS\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)", text)
    if not m:
        return None, "could not read the summary line in the PDF - check skipped"
    return float(m.group(3)), None          # OP.BAL, RECHARGE, CCMS SALE, ...


def run_checks(df, sales, start, end, pdf_path=None):
    issues, notes = [], []
    amt = pd.to_numeric(sales["Amount"])
    qty = pd.to_numeric(sales["Quantity"])
    price = pd.to_numeric(sales["RSP"])

    if sales["Txn ID"].duplicated().any():
        issues.append("Duplicate Txn IDs: " +
                      ", ".join(map(str, sales.loc[sales["Txn ID"].duplicated(), "Txn ID"])))
    bad = sales[(sales["Status"].astype(str).str.strip() != "PT")]
    if len(bad):
        issues.append(f"{len(bad)} sale(s) with Status other than PT: "
                      + ", ".join(map(str, bad["Txn ID"])))
    for col in ("Merchant Name", "Name of Card Holder", "Product", "Quantity", "RSP", "Amount"):
        n = sales[col].isna().sum()
        if n:
            issues.append(f"{n} sale(s) with blank '{col}'")
    diff = (qty * price - amt).abs()
    off = sales[diff > 1.0]
    if len(off):
        issues.append(f"{len(off)} sale(s) where Qty x Price differs from Amount by > Rs.1: "
                      + ", ".join(map(str, off["Txn ID"])))
    d = pd.to_datetime(sales["Txn Date"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
    out = sales[(d < pd.Timestamp(start)) | (d >= pd.Timestamp(end) + pd.Timedelta(days=1))]
    if len(out):
        issues.append(f"{len(out)} sale(s) dated outside the period")
    odd = set(sales["Product"].dropna().astype(str).str.strip()) - {"PETROL", "DIESEL"}
    if odd:
        notes.append("Extra product(s) found and added to the summary: " + ", ".join(sorted(odd)))

    # reconciliation
    all_types = df["Txn Type"].value_counts().to_dict()
    notes.append("Rows in IOCL file by type: " +
                 ", ".join(f"{k}={v}" for k, v in all_types.items()))
    if pdf_path:
        total, err = pdf_sale_total(pdf_path)
        if err:
            notes.append("PDF: " + err)
        elif abs(total - amt.sum()) < 0.005:
            notes.append(f"PDF reconciliation OK: CCMS SALE {total:,.2f} = report total")
        else:
            issues.append(f"PDF CCMS SALE {total:,.2f} != report total {amt.sum():,.2f} "
                          f"(difference {total - amt.sum():,.2f})")
    return issues, notes


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def pick_file():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        p = filedialog.askopenfilename(title="Select the IOCL report (.xlsx)",
                                       filetypes=[("Excel", "*.xlsx *.xls")])
        root.destroy()
        if p:
            return p
    except Exception:
        pass
    return input("Path of the IOCL report (.xlsx): ").strip().strip('"')


def main():
    ap = argparse.ArgumentParser(description="IOCL Easy Fuel monthly report generator")
    ap.add_argument("input", nargs="?", help="IOCL transaction details .xlsx")
    ap.add_argument("-o", "--output", help="output .xlsx path")
    ap.add_argument("--pdf", help="optional IOCL monthly statement PDF for total reconciliation")
    a = ap.parse_args()

    src = a.input or pick_file()
    if not src or not os.path.isfile(src):
        sys.exit(f"File not found: {src}")
    if src.lower().endswith(".pdf"):
        sys.exit("The PDF statement has no Price / Quantity columns, so the report "
                 "cannot be built from it.\nPlease use the IOCL transaction-details "
                 "EXCEL file (and pass the PDF with --pdf if you want a total check).")

    df, period = load_iocl(src)
    label, start, end = month_label(period, df)
    sales = build_sales(df)
    if sales.empty:
        sys.exit("No 'Sale' rows found in this file.")

    fname = label.replace("'", " ") + " - report.xlsx"      # e.g. "Aug 26 - report.xlsx"
    out = a.output or os.path.join(os.path.dirname(os.path.abspath(src)), fname)
    last, tot_row, gt = write_report(sales, label, out)
    issues, notes = run_checks(df, sales, start, end, a.pdf)

    amt = pd.to_numeric(sales["Amount"])
    qty = pd.to_numeric(sales["Quantity"])
    print(f"\nReport saved : {out}")
    print(f"Period       : {start:%d/%m/%Y} to {end:%d/%m/%Y}  ({label})")
    print(f"Sale rows    : {len(sales)}")
    print(f"Total        : Qty {qty.sum():,.3f} L   Amount Rs. {amt.sum():,.2f}")
    for p, g in sales.groupby(sales["Product"].astype(str).str.strip()):
        print(f"  {p:<8}: Qty {pd.to_numeric(g['Quantity']).sum():,.3f} L   "
              f"Amount Rs. {pd.to_numeric(g['Amount']).sum():,.2f}")
    for n in notes:
        print("Note         :", n)
    if issues:
        print("\nATTENTION - please review:")
        for i in issues:
            print("  !", i)
    else:
        print("\nAll checks passed.")


if __name__ == "__main__":
    main()
