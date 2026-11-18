#!/usr/bin/env python3
"""
Form 26AS / Annual Tax Statement (TRACES PDF)  ->  single Excel sheet

Usage:
    python3 form26as_to_excel.py  <input.pdf>  [output.xlsx]

What it extracts (everything in one sheet, one row per transaction):
  * Assessee header : PAN, name, address, financial year, assessment year, data-updated date
  * Part I   (TDS)  : deductor Sr.No, name, TAN, deductor totals, and every transaction line
  * Part VI  (TCS)  : collector Sr.No, name, TAN, collector totals, and every transaction line
  * Each transaction: section (+ description), txn date, status of booking, date of booking,
                      remarks (e.g. B / G reversal flags), amount paid/credited,
                      tax deducted/collected, TDS/TCS deposited
  * Other parts (II, III, IV, V, VII-X): checked for data; if any part contains real
    rows (not "No Transactions Present") the tool prints a WARNING so nothing is silently lost.

Verification (printed to console):
  For every deductor/collector, the sum of the transaction rows is compared with the
  totals printed in the PDF. Any mismatch is listed.

Requires: pdftotext (poppler) OR pdfplumber, and openpyxl.
"""
import re
import subprocess
import sys
from datetime import datetime
from decimal import Decimal

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# --------------------------------------------------------------------------
# Section descriptions (from the legend printed in the statement)
# --------------------------------------------------------------------------
SECTION_DESC = {
    "192": "Salary",
    "192A": "TDS on PF withdrawal",
    "193": "Interest on Securities",
    "194": "Dividends",
    "194A": "Interest other than 'Interest on securities'",
    "194B": "Winning from lottery or crossword puzzle, etc",
    "194BA": "Winnings from online games",
    "194BB": "Winning from horse race",
    "194C": "Payments to contractors and sub-contractors",
    "194D": "Insurance commission",
    "194DA": "Payment in respect of life insurance policy",
    "194E": "Payments to non-resident sportsmen or sports associations",
    "194EE": "Payments in respect of deposits under National Savings Scheme",
    "194G": "Commission, price, etc. on sale of lottery tickets",
    "194H": "Commission or brokerage",
    "194I(A)": "Rent on hiring of plant and machinery",
    "194I(B)": "Rent on other than plant and machinery",
    "194IA": "TDS on Sale of immovable property",
    "194IB": "Payment of rent by certain individuals or HUF",
    "194IC": "Payment under specified agreement",
    "194J(A)": "Fees for technical services",
    "194J(B)": "Fees for professional services or royalty etc",
    "194JB": "Fees for professional services or royalty etc (194J(b))",
    "194K": "Income payable in respect of units of a specified mutual fund / UTI",
    "194LA": "Payment of compensation on acquisition of certain immovable property",
    "194LB": "Income by way of interest from Infrastructure Debt fund",
    "194LBA": "Certain income from units of a business trust",
    "194LBB": "Income in respect of units of investment fund",
    "194LBC": "Income in respect of investment in securitization trust",
    "194LD": "TDS on interest on bonds / government securities",
    "194M": "Payment of certain sums by certain individuals or HUF",
    "194N": "Payment of certain amounts in cash",
    "194O": "Payment of certain sums by e-commerce operator to e-commerce participant",
    "194P": "Deduction of tax in case of specified senior citizen",
    "194Q": "TDS on payment of certain sum for purchase of goods",
    "194R": "Benefits or perquisites of business or profession",
    "194S": "Payment for transfer of virtual digital asset",
    "194T": "Payment of salary, remuneration, commission, bonus or interest to a partner of firm",
    "195": "Other sums payable to a non-resident",
    "206CA": "TCS - alcoholic liquor for human consumption",
    "206CB": "TCS - Timber / forest produce under forest lease",
    "206CC": "TCS - Timber obtained by mode other than forest lease",
    "206CE": "TCS - Scrap",
    "206CF": "TCS - Parking lots",
    "206CG": "TCS - Toll plaza",
    "206CH": "TCS - Mine or quarry",
    "206CI": "TCS - Tendu leaves",
    "206CJ": "TCS - Sale of certain minerals",
    "206CK": "TCS - Cash sale of bullion and jewellery",
    "206CL": "TCS - Sale of motor vehicle",
    "206CM": "TCS - Sale in cash of any goods (other than bullion/jewellery)",
    "206CN": "TCS - Providing of any services (other than Chapter XVII-B)",
}

STATUS_DESC = {
    "F": "Final",
    "U": "Unmatched",
    "M": "Matched",
    "P": "Provisional",
    "O": "Overbooked",
    "Z": "Mismatch",
}

REMARK_DESC = {
    "A": "Rectification of error in challan uploaded by bank",
    "B": "Rectification of error in statement uploaded by deductor",
    "D": "Rectification of error in Form 24G filed by Accounts Officer",
    "E": "Rectification of error in Challan by Assessing Officer",
    "F": "Lower/No deduction certificate u/s 197",
    "G": "Reprocessing of Statement",
    "T": "Transporter",
    "W": "For Part III, details as submitted by Deductor",
}

# --------------------------------------------------------------------------
# Regexes
# --------------------------------------------------------------------------
AMT = r"-?\d[\d,]*\.\d{2}"
DATE = r"\d{2}-[A-Za-z]{3}-\d{4}"
TAN = r"[A-Z]{4}\d{5}[A-Z]"

RE_DEDUCTOR = re.compile(
    rf"^\s*(\d{{1,4}})\s+(.+?)\s+({TAN})\s+({AMT})\s+({AMT})\s+({AMT})\s*$"
)
RE_TXN = re.compile(
    rf"^\s*(\d{{1,4}})\s+(\S+)\s+({DATE})\s+([A-Z])\s+({DATE})\s+(\S+)\s+({AMT})\s+({AMT})\s+({AMT})\s*$"
)
RE_PART = re.compile(r"^\s*PART[\s-]*(I{1,3}|IV|V|VI{1,3}|IX|X)\b", re.I)
RE_PART_NAME = re.compile(r"^\s*PART[\s-]*([IVX]+)\s*[-–]?", re.I)


def D(s):
    return Decimal(s.replace(",", ""))


def to_date(s):
    return datetime.strptime(s, "%d-%b-%Y")


# --------------------------------------------------------------------------
# PDF -> text
# --------------------------------------------------------------------------
def pdf_to_text(path):
    try:
        out = subprocess.run(
            ["pdftotext", "-layout", path, "-"],
            capture_output=True, text=True, check=True,
        ).stdout
        if out.strip():
            return out
    except Exception:
        pass
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(path) as pdf:
            for p in pdf.pages:
                pages.append(p.extract_text(layout=True) or "")
        return "\n".join(pages)
    except Exception as e:
        raise RuntimeError(f"Could not read the PDF (install pdfplumber or poppler's pdftotext): {e}")


# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------
def parse_header(text):
    head = text[:4000]
    info = {}
    m = re.search(r"Permanent Account Number \(PAN\)\s+([A-Z]{5}\d{4}[A-Z])", head)
    info["PAN"] = m.group(1) if m else ""
    m = re.search(r"Current Status of PAN\s+(\w+)", head)
    info["PAN Status"] = m.group(1) if m else ""
    m = re.search(r"Financial Year\s+(\d{4}-\d{2})", head)
    info["Financial Year"] = m.group(1) if m else ""
    m = re.search(r"Assessment Year\s+(\d{4}-\d{2})", head)
    info["Assessment Year"] = m.group(1) if m else ""
    m = re.search(r"Name of Assessee\s+(.+)", head)
    info["Name of Assessee"] = m.group(1).strip() if m else ""
    m = re.search(r"Address of Assessee\s+(.+)\n\s+(.+)", head)
    info["Address"] = (m.group(1).strip() + " " + m.group(2).strip()) if m else ""
    m = re.search(r"Data updated till\s+(\S+)", head)
    info["Data updated till"] = m.group(1) if m else ""
    return info


def parse_statement(text):
    lines = text.splitlines()

    part = None            # 'I' (TDS) or 'VI' (TCS) while inside those parts, else other id
    cur = None             # current deductor/collector dict
    last_was_deductor = False
    deductors = []         # list of dicts with totals
    rows = []
    other_part_data = {}   # part id -> True if it has real data
    other_part_seen = set()

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            continue

        # ---- part switching -------------------------------------------------
        mp = re.match(r"^\s*PART[\s-]*([IVX]+)\b", line)
        if mp and "Details" in line or (mp and re.match(r"^\s*PART X", line)):
            pid = mp.group(1).upper()
            part = pid
            cur = None
            last_was_deductor = False
            if pid not in ("I", "VI"):
                other_part_seen.add(pid)
            continue

        # ---- other parts: look for 'No Transactions Present' vs real data ---
        if part not in (None, "I", "VI"):
            if "No Transactions Present" in line:
                other_part_data.setdefault(part, False)
            elif part in ("VII", "II", "III", "IV", "V", "VIII", "IX", "X"):
                # any numeric data row in these parts (ignore headers / legends)
                if re.search(rf"{DATE}", line) and re.search(AMT, line):
                    other_part_data[part] = True
            if line.strip().startswith(("Contact Information", "*Notes", "Legends used")):
                part = None
            continue

        if part not in ("I", "VI"):
            continue

        # ---- skip repeating page headers / table headers --------------------
        s = line.strip()
        if (s.startswith("Assessee PAN") or s.startswith("Sr. No") or s.startswith("Credited")
                or s.startswith("Debited") or s.startswith("Deposited") or s.startswith("Asset)")
                or s.startswith("Name of")):
            last_was_deductor = False if s.startswith("Sr. No") else last_was_deductor
            continue

        # ---- deductor / collector line --------------------------------------
        m = RE_DEDUCTOR.match(line)
        if m and not RE_TXN.match(line):
            cur = {
                "part": "TDS" if part == "I" else "TCS",
                "sr": int(m.group(1)),
                "name": re.sub(r"\s+", " ", m.group(2)).strip(),
                "tan": m.group(3),
                "tot_amt": D(m.group(4)),
                "tot_tax": D(m.group(5)),
                "tot_dep": D(m.group(6)),
            }
            deductors.append(cur)
            last_was_deductor = True
            continue

        # ---- transaction line -----------------------------------------------
        m = RE_TXN.match(line)
        if m and cur is not None:
            sec = m.group(2)
            rows.append({
                "part": cur["part"],
                "d_sr": cur["sr"], "d_name": cur["name"], "d_tan": cur["tan"],
                "d_tot_amt": cur["tot_amt"], "d_tot_tax": cur["tot_tax"], "d_tot_dep": cur["tot_dep"],
                "t_sr": int(m.group(1)),
                "section": sec,
                "txn_date": to_date(m.group(3)),
                "status": m.group(4),
                "book_date": to_date(m.group(5)),
                "remarks": m.group(6),
                "amt": D(m.group(7)),
                "tax": D(m.group(8)),
                "dep": D(m.group(9)),
            })
            last_was_deductor = False
            continue

        # ---- name continuation (e.g. address wrapped to second line) --------
        if cur is not None and last_was_deductor:
            extra = re.sub(r"\s+", " ", s)
            cur["name"] = (cur["name"] + " " + extra).strip()
            for r in rows:
                pass
            continue

    return deductors, rows, other_part_data, other_part_seen


# --------------------------------------------------------------------------
# Verification
# --------------------------------------------------------------------------
def verify(deductors, rows):
    problems = []
    for d in deductors:
        rs = [r for r in rows if r["part"] == d["part"] and r["d_sr"] == d["sr"]]
        sa = sum((r["amt"] for r in rs), Decimal(0))
        st = sum((r["tax"] for r in rs), Decimal(0))
        sd = sum((r["dep"] for r in rs), Decimal(0))
        if (abs(sa - d["tot_amt"]) > Decimal("1.00") or abs(st - d["tot_tax"]) > Decimal("1.00")
                or abs(sd - d["tot_dep"]) > Decimal("1.00")):
            problems.append((d, len(rs), sa, st, sd))
    return problems


# --------------------------------------------------------------------------
# Excel output
# --------------------------------------------------------------------------
COLUMNS = [
    ("Type (TDS/TCS)", 12),
    ("Deductor / Collector Sr.No", 12),
    ("Name of Deductor / Collector", 44),
    ("TAN", 14),
    ("Txn Sr.No", 8),
    ("Section", 10),
    ("Section Description", 42),
    ("Transaction Date", 14),
    ("Status of Booking", 10),
    ("Status Meaning", 12),
    ("Date of Booking", 14),
    ("Remarks Code", 9),
    ("Remarks Meaning", 36),
    ("Amount Paid / Credited", 18),
    ("Tax Deducted / Collected", 18),
    ("TDS / TCS Deposited", 18),
    ("Deductor Total Amount (as per PDF)", 20),
    ("Deductor Total Tax (as per PDF)", 20),
    ("Deductor Total Deposited (as per PDF)", 20),
]


def _write_combined_sheet(ws, header, rows):
    bold = Font(bold=True)
    hdr_fill = PatternFill("solid", fgColor="1F4E78")
    hdr_font = Font(bold=True, color="FFFFFF")
    thin = Side(style="thin", color="BFBFBF")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    rev_fill = PatternFill("solid", fgColor="FDE9E7")

    # --- assessee block -----------------------------------------------------
    ws["A1"] = "ANNUAL TAX STATEMENT (FORM 26AS) - CONSOLIDATED"
    ws["A1"].font = Font(bold=True, size=14)
    info_rows = [
        ("PAN", header.get("PAN")),
        ("Name of Assessee", header.get("Name of Assessee")),
        ("Address", header.get("Address")),
        ("Financial Year", header.get("Financial Year")),
        ("Assessment Year", header.get("Assessment Year")),
        ("PAN Status", header.get("PAN Status")),
        ("Data updated till", header.get("Data updated till")),
    ]
    r = 2
    for k, v in info_rows:
        ws.cell(r, 1, k).font = bold
        ws.cell(r, 3, v)
        r += 1

    # --- summary block (live formulas over the table below) -----------------
    hdr_row = r + 6
    first = hdr_row + 1
    last = hdr_row + len(rows)
    ws.cell(r, 1, "Summary (formulas, include reversals)").font = bold
    ws.cell(r + 1, 1, "TDS - Amount Paid/Credited")
    ws.cell(r + 1, 3, f'=SUMIFS(N{first}:N{last},A{first}:A{last},"TDS")')
    ws.cell(r + 2, 1, "TDS - Tax Deducted")
    ws.cell(r + 2, 3, f'=SUMIFS(O{first}:O{last},A{first}:A{last},"TDS")')
    ws.cell(r + 3, 1, "TCS - Amount Paid/Debited")
    ws.cell(r + 3, 3, f'=SUMIFS(N{first}:N{last},A{first}:A{last},"TCS")')
    ws.cell(r + 4, 1, "TCS - Tax Collected")
    ws.cell(r + 4, 3, f'=SUMIFS(O{first}:O{last},A{first}:A{last},"TCS")')
    for rr in range(r + 1, r + 5):
        ws.cell(rr, 3).number_format = "#,##0.00"
        ws.cell(rr, 3).alignment = Alignment(horizontal="left")

    # --- table header -------------------------------------------------------
    for ci, (name, width) in enumerate(COLUMNS, start=1):
        c = ws.cell(hdr_row, ci, name)
        c.font = hdr_font
        c.fill = hdr_fill
        c.border = border
        c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        ws.column_dimensions[get_column_letter(ci)].width = width
    ws.row_dimensions[hdr_row].height = 45

    # --- data ---------------------------------------------------------------
    rr = hdr_row + 1
    for x in rows:
        sec_key = x["section"].upper()
        sec_desc = SECTION_DESC.get(sec_key) or SECTION_DESC.get(re.sub(r"\(.*\)", "", sec_key), "")
        remark = "" if x["remarks"] == "-" else x["remarks"]
        vals = [
            x["part"], x["d_sr"], x["d_name"], x["d_tan"], x["t_sr"], x["section"], sec_desc,
            x["txn_date"], x["status"], STATUS_DESC.get(x["status"], ""),
            x["book_date"], remark, REMARK_DESC.get(remark, ""),
            float(x["amt"]), float(x["tax"]), float(x["dep"]),
            float(x["d_tot_amt"]), float(x["d_tot_tax"]), float(x["d_tot_dep"]),
        ]
        for ci, v in enumerate(vals, start=1):
            c = ws.cell(rr, ci, v)
            c.border = border
            if ci in (8, 11):
                c.number_format = "DD-MMM-YYYY"
                c.alignment = Alignment(horizontal="center")
            elif ci >= 14:
                c.number_format = "#,##0.00;[Red]-#,##0.00"
            elif ci in (2, 5, 9, 12):
                c.alignment = Alignment(horizontal="center")
            if x["amt"] < 0:
                c.fill = rev_fill
        rr += 1

    # --- grand total row ----------------------------------------------------
    ws.cell(rr, 1, "TOTAL (all rows incl. reversals)").font = bold
    for col in (14, 15, 16):
        L = get_column_letter(col)
        c = ws.cell(rr, col, f"=SUBTOTAL(109,{L}{first}:{L}{last})")
        c.font = bold
        c.number_format = "#,##0.00;[Red]-#,##0.00"
        c.border = border

    ws.auto_filter.ref = f"A{hdr_row}:{get_column_letter(len(COLUMNS))}{last}"
    ws.freeze_panes = ws.cell(hdr_row + 1, 4)


# --------------------------------------------------------------------------
# Party-wise output
# --------------------------------------------------------------------------
_BOLD = Font(bold=True)
_HDR_FILL = PatternFill("solid", fgColor="1F4E78")
_HDR_FONT = Font(bold=True, color="FFFFFF")
_THIN = Side(style="thin", color="BFBFBF")
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)
_REV_FILL = PatternFill("solid", fgColor="FDE9E7")
_NUM = "#,##0.00;[Red]-#,##0.00"
_LINK_FONT = Font(color="0563C1", underline="single")


def _safe_sheet_name(label, used):
    """Excel sheet names: max 31 chars, no \\ / * ? : [ ] and must be unique."""
    base = re.sub(r"[\\/*?:\[\]]", "", label).strip()[:31] or "Party"
    name, i = base, 2
    while name.lower() in used:
        suffix = f" ({i})"
        name = base[: 31 - len(suffix)] + suffix
        i += 1
    used.add(name.lower())
    return name


def _write_table(ws, hdr_row, rows):
    """Header + one line per transaction + total row. Returns (first, last) data rows."""
    for ci, (name, width) in enumerate(COLUMNS, start=1):
        c = ws.cell(hdr_row, ci, name)
        c.font, c.fill, c.border = _HDR_FONT, _HDR_FILL, _BORDER
        c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        ws.column_dimensions[get_column_letter(ci)].width = width
    ws.row_dimensions[hdr_row].height = 45

    rr = hdr_row + 1
    for x in rows:
        sec_key = x["section"].upper()
        sec_desc = SECTION_DESC.get(sec_key) or SECTION_DESC.get(re.sub(r"\(.*\)", "", sec_key), "")
        remark = "" if x["remarks"] == "-" else x["remarks"]
        vals = [
            x["part"], x["d_sr"], x["d_name"], x["d_tan"], x["t_sr"], x["section"], sec_desc,
            x["txn_date"], x["status"], STATUS_DESC.get(x["status"], ""),
            x["book_date"], remark, REMARK_DESC.get(remark, ""),
            float(x["amt"]), float(x["tax"]), float(x["dep"]),
            float(x["d_tot_amt"]), float(x["d_tot_tax"]), float(x["d_tot_dep"]),
        ]
        for ci, v in enumerate(vals, start=1):
            c = ws.cell(rr, ci, v)
            c.border = _BORDER
            if ci in (8, 11):
                c.number_format = "DD-MMM-YYYY"
                c.alignment = Alignment(horizontal="center")
            elif ci >= 14:
                c.number_format = _NUM
            elif ci in (2, 5, 9, 12):
                c.alignment = Alignment(horizontal="center")
            if x["amt"] < 0:
                c.fill = _REV_FILL
        rr += 1
    first, last = hdr_row + 1, rr - 1
    ws.cell(rr, 1, "TOTAL (incl. reversals)").font = _BOLD
    for col in (14, 15, 16):
        L = get_column_letter(col)
        c = ws.cell(rr, col, f"=SUBTOTAL(109,{L}{first}:{L}{last})")
        c.font, c.number_format, c.border = _BOLD, _NUM, _BORDER
    ws.auto_filter.ref = f"A{hdr_row}:{get_column_letter(len(COLUMNS))}{last}"
    return first, last


def _write_party_sheet(ws, d, rows, header, has_summary):
    ws["A1"] = d["name"]
    ws["A1"].font = Font(bold=True, size=13)
    if has_summary:
        ws["F1"] = "<< Back to Party Summary"
        ws["F1"].hyperlink = "#'Party Summary'!A1"
        ws["F1"].font = _LINK_FONT
    kind = "TDS (Tax Deducted at Source)" if d["part"] == "TDS" else "TCS (Tax Collected at Source)"
    info = [
        ("Type", kind),
        ("TAN", d["tan"]),
        ("Assessee", f"{header.get('Name of Assessee','')} ({header.get('PAN','')})  AY {header.get('Assessment Year','')}"),
        ("Total Amount (as per PDF)", float(d["tot_amt"])),
        ("Total Tax (as per PDF)", float(d["tot_tax"])),
        ("Total Deposited (as per PDF)", float(d["tot_dep"])),
    ]
    r = 2
    for k, v in info:
        ws.cell(r, 1, k).font = _BOLD
        c = ws.cell(r, 3, v)
        if isinstance(v, float):
            c.number_format = _NUM
            c.alignment = Alignment(horizontal="left")
        r += 1
    hdr_row = r + 1
    _write_table(ws, hdr_row, rows)
    ws.freeze_panes = ws.cell(hdr_row + 1, 4)


def _write_summary_sheet(ws, header, deductors, by_party, sheet_names):
    ws["A1"] = "PARTY SUMMARY"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = "Assessee"
    ws["A2"].font = _BOLD
    ws["C2"] = f"{header.get('Name of Assessee','')} ({header.get('PAN','')})  FY {header.get('Financial Year','')}  AY {header.get('Assessment Year','')}"
    ws["A3"] = "Click a party name to jump to its sheet."

    cols = [("Type", 8), ("Sr.No", 7), ("Name of Deductor / Collector (click to open)", 50), ("TAN", 14),
            ("No. of Txns", 10), ("Amount Paid / Credited", 20), ("Tax Deducted / Collected", 20),
            ("TDS / TCS Deposited", 20), ("Amount as per PDF", 20), ("Tax as per PDF", 20),
            ("Check", 12)]
    hdr = 5
    for ci, (n, w) in enumerate(cols, start=1):
        c = ws.cell(hdr, ci, n)
        c.font, c.fill, c.border = _HDR_FONT, _HDR_FILL, _BORDER
        c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        ws.column_dimensions[get_column_letter(ci)].width = w
    ws.row_dimensions[hdr].height = 32

    r = hdr + 1
    for d in deductors:
        k = (d["part"], d["sr"])
        rs = by_party.get(k, [])
        sa = sum((x["amt"] for x in rs), Decimal(0))
        st = sum((x["tax"] for x in rs), Decimal(0))
        sd = sum((x["dep"] for x in rs), Decimal(0))
        ok = (abs(sa - d["tot_amt"]) <= 1 and abs(st - d["tot_tax"]) <= 1 and abs(sd - d["tot_dep"]) <= 1)
        vals = [d["part"], d["sr"], d["name"], d["tan"], len(rs), float(sa), float(st), float(sd),
                float(d["tot_amt"]), float(d["tot_tax"]), "OK" if ok else "MISMATCH"]
        for ci, v in enumerate(vals, start=1):
            c = ws.cell(r, ci, v)
            c.border = _BORDER
            if ci in (6, 7, 8, 9, 10):
                c.number_format = _NUM
            if ci in (1, 2, 5, 11):
                c.alignment = Alignment(horizontal="center")
        link = ws.cell(r, 3)
        link.hyperlink = f"#'{sheet_names[k]}'!A1"
        link.font = _LINK_FONT
        if not ok:
            ws.cell(r, 11).font = Font(bold=True, color="C00000")
        r += 1
    last = r - 1
    for label in ("TDS", "TCS"):
        ws.cell(r, 1, f"TOTAL {label}").font = _BOLD
        for col in (5, 6, 7, 8, 9, 10):
            L = get_column_letter(col)
            c = ws.cell(r, col, f'=SUMIFS({L}{hdr+1}:{L}{last},$A{hdr+1}:$A{last},"{label}")')
            c.font, c.border = _BOLD, _BORDER
            if col >= 6:
                c.number_format = _NUM
        r += 1
    ws.auto_filter.ref = f"A{hdr}:{get_column_letter(len(cols))}{last}"
    ws.freeze_panes = ws.cell(hdr + 1, 4)


def write_excel(path, header, rows, deductors, combined=True, partywise=False):
    """combined  -> one sheet '26AS' with every transaction of every party.
       partywise -> 'Party Summary' + one sheet per deductor/collector."""
    wb = Workbook()
    first_sheet = True

    def new_sheet(title):
        nonlocal first_sheet
        if first_sheet:
            ws = wb.active
            ws.title = title
            first_sheet = False
        else:
            ws = wb.create_sheet(title)
        return ws

    used = {"26as", "party summary"}
    if combined:
        _write_combined_sheet(new_sheet("26AS"), header, rows)
    if partywise:
        by_party = {}
        for x in rows:
            by_party.setdefault((x["part"], x["d_sr"]), []).append(x)
        sheet_names = {
            (d["part"], d["sr"]): _safe_sheet_name(f"{d['part']}-{d['sr']:02d} {d['name']}", used)
            for d in deductors
        }
        _write_summary_sheet(new_sheet("Party Summary"), header, deductors, by_party, sheet_names)
        for d in deductors:
            k = (d["part"], d["sr"])
            _write_party_sheet(new_sheet(sheet_names[k]), d, by_party.get(k, []), header, True)
    wb.save(path)


# --------------------------------------------------------------------------
# One call that does everything (used by the command line AND the web page)
# --------------------------------------------------------------------------
def convert(pdf_path, out_path, combined=True, partywise=False):
    if not (combined or partywise):
        raise ValueError("Select at least one output option (combined sheet and/or party-wise sheets).")
    text = pdf_to_text(pdf_path)
    header = parse_header(text)
    deductors, rows, other, seen = parse_statement(text)
    if not rows:
        raise ValueError("No TDS/TCS transactions were found. Is this a TRACES 'Annual Tax Statement' (Form 26AS) PDF "
                         "with selectable text (not a scanned image)?")
    key = {(d["part"], d["sr"]): d for d in deductors}
    for r in rows:
        r["d_name"] = key[(r["part"], r["d_sr"])]["name"]

    problems = verify(deductors, rows)
    write_excel(out_path, header, rows, deductors, combined=combined, partywise=partywise)

    totals = {}
    for t in ("TDS", "TCS"):
        totals[t] = {
            "parties": sum(1 for d in deductors if d["part"] == t),
            "rows": sum(1 for r in rows if r["part"] == t),
            "amount": f"{sum((r['amt'] for r in rows if r['part'] == t), Decimal(0)):,.2f}",
            "tax": f"{sum((r['tax'] for r in rows if r['part'] == t), Decimal(0)):,.2f}",
        }
    warnings = []
    flagged = sorted(p for p, v in other.items() if v)
    if flagged:
        warnings.append(f"Parts {flagged} appear to contain data that this tool does not export - please check the PDF.")
    return {
        "assessee": header.get("Name of Assessee", ""),
        "pan": header.get("PAN", ""),
        "assessment_year": header.get("Assessment Year", ""),
        "total_rows": len(rows),
        "totals": totals,
        "sheets": (1 if combined else 0) + ((1 + len(deductors)) if partywise else 0),
        "verified": not problems,
        "problems": [f"[{d['part']} #{d['sr']}] {d['name']} ({d['tan']}): {n} rows, "
                     f"amount {sa} vs PDF {d['tot_amt']}, tax {st} vs PDF {d['tot_tax']}"
                     for d, n, sa, st, sd in problems],
        "warnings": warnings,
    }


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Convert a Form 26AS / Annual Tax Statement PDF to Excel.")
    ap.add_argument("pdf")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--partywise", action="store_true", help="add one sheet per deductor/collector (+ Party Summary)")
    ap.add_argument("--no-combined", action="store_true", help="skip the single combined sheet")
    a = ap.parse_args()
    out = a.out or re.sub(r"\.pdf$", "", a.pdf, flags=re.I) + "_26AS.xlsx"
    try:
        res = convert(a.pdf, out, combined=not a.no_combined, partywise=a.partywise)
    except (ValueError, RuntimeError) as e:
        sys.exit(f"ERROR: {e}")
    print(f"Assessee      : {res['assessee']}  ({res['pan']})  AY {res['assessment_year']}")
    for t in ("TDS", "TCS"):
        s = res["totals"][t]
        print(f"{t}: {s['parties']} parties, {s['rows']} rows, amount {s['amount']}, tax {s['tax']}")
    print(f"Sheets written: {res['sheets']}")
    for w in res["warnings"]:
        print("WARNING:", w)
    if res["verified"]:
        print("VERIFICATION OK: every party's rows add up to the totals printed in the PDF.")
    else:
        print("VERIFICATION FAILED:")
        for p in res["problems"]:
            print("  ", p)
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
