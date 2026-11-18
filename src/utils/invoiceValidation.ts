import {
  AggGroup,
  HsnAggGroup,
  InvoiceAggGroup,
  InvoiceLineItem,
  InvoiceRecord,
  PartyAggGroup,
  RateAggGroup,
  ValidationIssue,
  ValidationResult,
} from '../types/invoice';
import {
  INDIAN_STATES,
  isValidGstin,
  makeSampleGstin,
  parseInvoiceDate,
  round2,
  STANDARD_GST_SLABS,
} from './invoiceParser';

export const lineTaxTotal = (i: InvoiceLineItem): number =>
  round2(i.IGST + i.CGST + i.SGST + (i.cessAmt || 0));

export const lineGstOnly = (i: InvoiceLineItem): number =>
  round2(i.IGST + i.CGST + i.SGST);

export const invoiceNetTotal = (v: InvoiceRecord): number =>
  round2(v.items.reduce((s, i) => s + i.net, 0));

export const invoiceTaxTotal = (v: InvoiceRecord): number =>
  round2(v.items.reduce((s, i) => s + lineTaxTotal(i), 0));

export const invoiceComputedTotal = (v: InvoiceRecord): number =>
  round2(invoiceNetTotal(v) + invoiceTaxTotal(v) + (v.roundOff || 0));

export function validateInvoices(
  list: InvoiceRecord[],
  tolerance = 1
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const byInvoice = new Map<number, ValidationIssue[]>();
  const seenNo = new Map<string, InvoiceRecord>();
  const seenIrn = new Map<string, InvoiceRecord>();
  const dupNoMarked = new Set<number>();

  const add = (
    v: InvoiceRecord,
    sev: 'err' | 'warn',
    chk: string,
    msg: string
  ) => {
    const issue: ValidationIssue = {
      sev,
      chk,
      msg,
      invoiceFid: v.fid,
      invoiceNo: v.no,
      file: v.file,
    };
    issues.push(issue);
    const arr = byInvoice.get(v.fid) || [];
    arr.push(issue);
    byInvoice.set(v.fid, arr);
  };

  const formatLineList = (nums: (number | string)[]) =>
    `line${nums.length > 1 ? 's ' : ' '}${nums.slice(0, 8).join(', ')}${
      nums.length > 8 ? ' ...' : ''
    }`;

  const inr = (x: number) =>
    `₹ ${x.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  for (const v of list) {
    byInvoice.set(v.fid, []);

    const computed = invoiceComputedTotal(v);
    const diff = round2(computed - v.amt);
    if (v.items.length === 0) {
      add(v, 'err', 'No line items', 'This invoice has no line items.');
    } else if (Math.abs(diff) > tolerance) {
      add(
        v,
        'err',
        'Total mismatch',
        `Computed ${inr(computed)} vs printed ${inr(v.amt)} (difference ${inr(diff)}).`
      );
    }

    if (!v.date) {
      add(v, 'warn', 'Missing date', 'No invoice date was found.');
    } else if (!parseInvoiceDate(v.date)) {
      add(
        v,
        'warn',
        'Unreadable date',
        `“${v.date}” could not be parsed as a date, so it is excluded from the monthly trend.`
      );
    }

    if (!v.cust) {
      add(v, 'warn', 'Missing customer', 'No customer / buyer name was detected.');
    }

    for (const [key, label] of [
      ['cgst', 'Customer'],
      ['sgst', 'Supplier'],
    ] as const) {
      const g = v[key];
      if (g && !isValidGstin(g)) {
        add(v, 'warn', `${label} GSTIN invalid`, `${g} fails the 15-character GSTIN checksum test.`);
      }
    }

    const buyerG = v.cgst || '';
    const supplierG = v.sgst || '';
    if (/^\d{2}/.test(buyerG) && /^\d{2}/.test(supplierG)) {
      const sameState = buyerG.slice(0, 2) === supplierG.slice(0, 2);
      const igstSum = v.items.reduce((s, i) => s + i.IGST, 0);
      const csSum = v.items.reduce((s, i) => s + i.CGST + i.SGST, 0);
      if (sameState && igstSum > 0.5) {
        add(
          v,
          'err',
          'Wrong tax type',
          `Both parties are in ${
            INDIAN_STATES[buyerG.slice(0, 2)] || 'the same state'
          } (intra-state) but IGST of ${inr(igstSum)} was charged — CGST + SGST expected.`
        );
      }
      if (!sameState && csSum > 0.5) {
        add(
          v,
          'err',
          'Wrong tax type',
          `Supply is inter-state (${
            INDIAN_STATES[supplierG.slice(0, 2)] || supplierG.slice(0, 2)
          } → ${
            INDIAN_STATES[buyerG.slice(0, 2)] || buyerG.slice(0, 2)
          }) but CGST/SGST of ${inr(csSum)} was charged — IGST expected.`
        );
      }
    }

    const grp = {
      hsn: [] as number[],
      hsnLen: [] as number[],
      rate: [] as string[],
      half: [] as number[],
      calc: [] as number[],
      qty: [] as number[],
      gross: [] as number[],
    };

    v.items.forEach((it, idx) => {
      const ln = idx + 1;
      const h = String(it.hsn || '');
      const pct = Math.round(it.rate * 10000) / 100;
      const gst = lineGstOnly(it);

      if (!h || h === 'N/A') grp.hsn.push(ln);
      else if (![4, 6, 8].includes(h.length)) grp.hsnLen.push(ln);

      if (!STANDARD_GST_SLABS.includes(pct)) grp.rate.push(`${ln} (${pct}%)`);
      if (Math.abs(it.CGST - it.SGST) > 0.05) grp.half.push(ln);
      if (Math.abs(it.net * it.rate - gst) > Math.max(1.5, gst * 0.006)) {
        grp.calc.push(ln);
      }
      if (it.qty <= 0 || it.net < 0) grp.qty.push(ln);
      if (
        it.price > 0 &&
        Math.abs(it.qty * it.price - it.gross) > Math.max(1.5, it.gross * 0.005)
      ) {
        grp.gross.push(ln);
      }
    });

    if (grp.hsn.length)
      add(v, 'warn', 'Missing HSN/SAC', `No HSN/SAC code on ${formatLineList(grp.hsn)}.`);
    if (grp.hsnLen.length)
      add(
        v,
        'warn',
        'HSN length',
        `HSN/SAC should be 4, 6, or 8 digits — check ${formatLineList(grp.hsnLen)}.`
      );
    if (grp.rate.length)
      add(v, 'warn', 'Unusual GST rate', `Non-standard GST slab on ${formatLineList(grp.rate)}.`);
    if (grp.half.length)
      add(v, 'warn', 'CGST ≠ SGST', `CGST and SGST differ on ${formatLineList(grp.half)}.`);
    if (grp.calc.length)
      add(
        v,
        'warn',
        'Tax ≠ rate × taxable',
        `Tax does not match rate × taxable value on ${formatLineList(grp.calc)}.`
      );
    if (grp.qty.length)
      add(
        v,
        'warn',
        'Non-positive qty/value',
        `Zero or negative quantity/value on ${formatLineList(grp.qty)}.`
      );
    if (grp.gross.length)
      add(
        v,
        'warn',
        'Qty × price ≠ gross',
        `Gross value differs from qty × unit price on ${formatLineList(grp.gross)}.`
      );

    if (v.no) {
      const existing = seenNo.get(v.no);
      if (existing) {
        add(v, 'err', 'Duplicate invoice no', `${v.no} also appears in ${existing.file}.`);
        if (!dupNoMarked.has(existing.fid)) {
          dupNoMarked.add(existing.fid);
          add(existing, 'err', 'Duplicate invoice no', `${v.no} also appears in ${v.file}.`);
        }
      } else {
        seenNo.set(v.no, v);
      }
    }

    if (v.irn && v.irn.length >= 16) {
      const existingIrn = seenIrn.get(v.irn);
      if (existingIrn) {
        add(v, 'err', 'Duplicate IRN', `Same IRN as ${existingIrn.file}.`);
      } else {
        seenIrn.set(v.irn, v);
      }
    }
  }

  const rank = { err: 0, warn: 1 };
  issues.sort((a, b) => rank[a.sev] - rank[b.sev]);

  return { issues, byInvoice };
}

const mkGroup = (): AggGroup => ({
  n: 0,
  qty: 0,
  net: 0,
  IGST: 0,
  CGST: 0,
  SGST: 0,
  cessAmt: 0,
});

const addToGroup = (g: AggGroup, i: InvoiceLineItem) => {
  g.n += 1;
  g.qty += i.qty;
  g.net += i.net;
  g.IGST += i.IGST;
  g.CGST += i.CGST;
  g.SGST += i.SGST;
  g.cessAmt += i.cessAmt || 0;
};

export function aggregateInvoices(invs: InvoiceRecord[]): {
  hsn: HsnAggGroup[];
  rate: RateAggGroup[];
  inv: InvoiceAggGroup[];
  tot: AggGroup;
} {
  const H = new Map<string, HsnAggGroup>();
  const R = new Map<number, RateAggGroup>();
  const I = new Map<number, InvoiceAggGroup>();
  const tot = mkGroup();

  for (const v of invs) {
    for (const i of v.items) {
      const hsnCode = i.hsn || 'N/A';
      const hk = `${hsnCode}|${i.rate}`;
      let h = H.get(hk);
      if (!h) {
        h = { hsn: hsnCode, desc: i.desc, rate: i.rate, ...mkGroup() };
        H.set(hk, h);
      }
      addToGroup(h, i);

      let r = R.get(i.rate);
      if (!r) {
        r = { rate: i.rate, ...mkGroup(), hsnCodes: new Set<string>() };
        R.set(i.rate, r);
      }
      addToGroup(r, i);
      r.hsnCodes.add(hsnCode);

      let q = I.get(v.fid);
      if (!q) {
        q = {
          fid: v.fid,
          no: v.no,
          date: v.date,
          cust: v.cust,
          amt: v.amt,
          roundOff: v.roundOff || 0,
          ...mkGroup(),
        };
        I.set(v.fid, q);
      }
      addToGroup(q, i);
      addToGroup(tot, i);
    }
  }

  return {
    hsn: [...H.values()].sort(
      (a, b) => String(a.hsn).localeCompare(String(b.hsn)) || a.rate - b.rate
    ),
    rate: [...R.values()].sort((a, b) => a.rate - b.rate),
    inv: [...I.values()],
    tot,
  };
}

export function aggregateParties(invs: InvoiceRecord[]): PartyAggGroup[] {
  const map = new Map<string, PartyAggGroup>();
  for (const v of invs) {
    const nm = (v.cust || '(Unknown)').trim();
    const gstinKey = v.cgst ? v.cgst.trim().toUpperCase() : '';
    const key = gstinKey || nm.toLowerCase();
    let p = map.get(key);
    if (!p) {
      p = {
        name: nm,
        gstin: gstinKey,
        state: INDIAN_STATES[gstinKey.slice(0, 2)] || '',
        invoiceIds: new Set<number>(),
        lines: 0,
        qty: 0,
        net: 0,
        IGST: 0,
        CGST: 0,
        SGST: 0,
        cessAmt: 0,
      };
      map.set(key, p);
    }
    if (!p.gstin && gstinKey) {
      p.gstin = gstinKey;
      p.state = INDIAN_STATES[gstinKey.slice(0, 2)] || '';
    }
    p.invoiceIds.add(v.fid);
    for (const i of v.items) {
      p.lines += 1;
      p.qty += i.qty;
      p.net += i.net;
      p.IGST += i.IGST;
      p.CGST += i.CGST;
      p.SGST += i.SGST;
      p.cessAmt += i.cessAmt || 0;
    }
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export function autoFixInvoices(invs: InvoiceRecord[]): {
  updated: InvoiceRecord[];
  fixedCount: number;
  summary: string;
} {
  let fixedCount = 0;

  const updated = invs.map((inv) => {
    let changed = false;
    const nextCgst = (inv.cgst || '').replace(/\s+/g, '').toUpperCase();
    const nextSgst = (inv.sgst || '').replace(/\s+/g, '').toUpperCase();
    const nextIrn = (inv.irn || '').replace(/\s+/g, '').toUpperCase();
    if (nextCgst !== inv.cgst || nextSgst !== inv.sgst || nextIrn !== inv.irn) {
      changed = true;
    }

    let nextPos = inv.pos || '';
    if (!nextPos && /^\d{2}/.test(nextCgst) && INDIAN_STATES[nextCgst.slice(0, 2)]) {
      nextPos = INDIAN_STATES[nextCgst.slice(0, 2)];
      changed = true;
    }

    const hasBothStateCodes = /^\d{2}/.test(nextCgst) && /^\d{2}/.test(nextSgst);
    const sameState = hasBothStateCodes && nextCgst.slice(0, 2) === nextSgst.slice(0, 2);

    const nextItems = inv.items.map((it) => {
      let itemChanged = false;
      let igst = it.IGST;
      let cgst = it.CGST;
      let sgst = it.SGST;
      const uom = (it.uom || '').trim();
      if (uom !== (it.uom || '')) itemChanged = true;

      if (hasBothStateCodes) {
        if (sameState && igst > 0.5 && cgst === 0 && sgst === 0) {
          const half = round2(igst / 2);
          cgst = half;
          sgst = half;
          igst = 0;
          itemChanged = true;
        } else if (!sameState && cgst + sgst > 0.5 && igst === 0) {
          igst = round2(cgst + sgst);
          cgst = 0;
          sgst = 0;
          itemChanged = true;
        }
      }

      if (igst === 0 && cgst + sgst > 0 && Math.abs(cgst - sgst) > 0.05 && Math.abs(cgst - sgst) <= 2) {
        const half = round2((cgst + sgst) / 2);
        cgst = half;
        sgst = half;
        itemChanged = true;
      }

      if (itemChanged) {
        changed = true;
        return { ...it, IGST: igst, CGST: cgst, SGST: sgst, uom };
      }
      return it;
    });

    if (changed) fixedCount += 1;
    return {
      ...inv,
      cgst: nextCgst,
      sgst: nextSgst,
      irn: nextIrn,
      pos: nextPos,
      items: nextItems,
    };
  });

  const summary =
    fixedCount > 0
      ? `Auto-fixed formatting, Place of Supply & intra/inter-state tax heads across ${fixedCount} invoice(s).`
      : 'No automatically fixable GST formatting or tax-head issues found.';

  return { updated, fixedCount, summary };
}

export function aggregateHsnOnly(
  invs: InvoiceRecord[]
): { hsn: string; desc: string; net: number }[] {
  const map = new Map<string, { hsn: string; desc: string; net: number }>();
  for (const v of invs) {
    for (const i of v.items) {
      const k = i.hsn || 'N/A';
      let g = map.get(k);
      if (!g) {
        g = { hsn: k, desc: i.desc, net: 0 };
        map.set(k, g);
      }
      g.net += i.net;
    }
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export function aggregateMonthlyTrend(
  invs: InvoiceRecord[]
): { k: number; label: string; net: number; tax: number }[] {
  const map = new Map<number, { k: number; label: string; net: number; tax: number }>();
  for (const v of invs) {
    const dt = parseInvoiceDate(v.date);
    const k = dt ? dt.getFullYear() * 100 + dt.getMonth() + 1 : 0;
    let g = map.get(k);
    if (!g) {
      g = {
        k,
        label: dt
          ? dt.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
          : 'Undated',
        net: 0,
        tax: 0,
      };
      map.set(k, g);
    }
    g.net += invoiceNetTotal(v);
    g.tax += invoiceTaxTotal(v);
  }
  return [...map.values()].sort((a, b) => a.k - b.k).slice(-12);
}

export function buildSampleInvoices(startFid: number): InvoiceRecord[] {
  const supGstin = makeSampleGstin('29AAACS1234F1Z');
  const b1 = makeSampleGstin('29AABCS5678K1Z');
  const b2 = makeSampleGstin('27AAECO4321M1Z');
  const b3 = makeSampleGstin('33AAGCB9876P1Z');
  const badGstin = b2.slice(0, 14) + (b2[14] === 'X' ? 'Y' : 'X');

  const mkItem = (
    idx: number,
    hsn: string,
    desc: string,
    qty: number,
    price: number,
    rate: number,
    ty: 'I' | 'CS',
    disc = 0,
    cessRate = 0,
    uom = 'Nos.'
  ): InvoiceLineItem => {
    const gross = round2(qty * price);
    const net = round2(gross - disc);
    const tax = round2(net * rate);
    const cessAmt = round2(net * cessRate);
    return {
      item: String(idx),
      mat: '',
      desc,
      hsn,
      qty,
      uom,
      price,
      gross,
      disc,
      net,
      rate,
      IGST: ty === 'I' ? tax : 0,
      CGST: ty === 'CS' ? round2(tax / 2) : 0,
      SGST: ty === 'CS' ? round2(tax / 2) : 0,
      cessRate,
      cessAmt,
    };
  };

  const rawSamples: Array<{
    no: string;
    date: string;
    cust: string;
    cgst: string;
    sup: string;
    sgst: string;
    items: InvoiceLineItem[];
    roundOff?: number;
    amtOverride?: number;
    mode: string;
  }> = [
    {
      no: 'NC/26-27/0101',
      date: '05/08/2026',
      cust: 'Sunrise Traders Pvt Ltd',
      cgst: b1,
      sup: 'Nimbus Components Pvt Ltd',
      sgst: supGstin,
      mode: 'Table Engine',
      items: [
        mkItem(1, '8471', 'Laptop 14-inch i5', 5, 42500, 0.18, 'CS'),
        mkItem(2, '8473', 'Docking station USB-C', 12, 3800, 0.18, 'CS'),
        mkItem(3, '8528', 'Monitor 24-inch IPS', 8, 9800, 0.18, 'CS', 1500),
      ],
    },
    {
      no: 'Car/2526/04/12',
      date: '30-Apr-25',
      cust: 'MY CONCRETE',
      cgst: b1,
      sup: 'Varsha Cars Pvt Ltd',
      sgst: supGstin,
      roundOff: 0.3,
      mode: 'Tally Invoice',
      items: [
        mkItem(1, '87032291', 'X1 sDrive 18i M SPORT', 1, 3503448, 0.28, 'CS', 475862, 0.17),
      ],
    },
    {
      no: 'NC/26-27/0102',
      date: '22/08/2026',
      cust: 'Orion Retail LLP',
      cgst: b2,
      sup: 'Nimbus Components Pvt Ltd',
      sgst: supGstin,
      mode: 'Table Engine',
      items: [
        mkItem(1, '8517', 'Enterprise Wi-Fi Router', 20, 2450, 0.18, 'I'),
        mkItem(2, '8544', 'Shielded Cable Assembly', 150, 185, 0.18, 'I'),
        mkItem(3, '3926', 'ABS Protective Enclosure', 60, 420, 0.18, 'I'),
      ],
    },
    {
      no: 'Oth/2526/05/2',
      date: '02-May-25',
      cust: 'MY CONCRETE',
      cgst: b1,
      sup: 'Varsha Cars Pvt Ltd',
      sgst: supGstin,
      roundOff: 0.34,
      mode: 'Service Invoice',
      items: [
        mkItem(1, '998729', 'Facilitation Charges (Post Sale)', 1, 38787, 0.18, 'CS', 0, 0, ''),
      ],
    },
    {
      no: 'NC/26-27/0104',
      date: '03/10/2026',
      cust: 'Bluewave Exports',
      cgst: b3,
      sup: 'Nimbus Components Pvt Ltd',
      sgst: supGstin,
      mode: 'Table Engine',
      amtOverride: 300900 + 1840, // Deliberate mismatch for audit showcase
      items: [
        mkItem(1, '8471', 'Rack Server Unit', 2, 128000, 0.18, 'I'),
        mkItem(2, '8504', 'Online UPS 3kVA', 4, 21500, 0.18, 'I'),
      ],
    },
    {
      no: 'NC/26-27/0105',
      date: '11/11/2026',
      cust: 'Orion Retail LLP',
      cgst: badGstin, // Deliberate invalid checksum + intra/inter mismatch + unusual slab
      sup: 'Nimbus Components Pvt Ltd',
      sgst: supGstin,
      mode: 'Table Engine',
      items: [
        mkItem(1, '8517', 'Wireless router', 10, 2450, 0.18, 'CS'),
        mkItem(2, '8544', 'Cable assembly', 80, 185, 0.17, 'I'),
        mkItem(3, '', 'Freight charges', 1, 2500, 0.18, 'I'),
      ],
    },
  ];

  return rawSamples.map((s, idx) => {
    const roundOff = s.roundOff || 0;
    const totalTax = round2(s.items.reduce((acc, i) => acc + lineTaxTotal(i), 0));
    const totalNet = round2(s.items.reduce((acc, i) => acc + i.net, 0));
    const totalCess = round2(s.items.reduce((acc, i) => acc + (i.cessAmt || 0), 0));
    const amt = s.amtOverride ?? round2(totalNet + totalTax + roundOff);
    const id = startFid + idx + 1;
    const file = `sample-${s.no.replace(/\W+/g, '-')}.pdf`;
    return {
      fid: id,
      file,
      key: `sample|${id}`,
      no: s.no,
      date: s.date,
      cust: s.cust,
      code: '',
      cgst: s.cgst,
      sup: s.sup,
      sgst: s.sgst,
      pos: INDIAN_STATES[s.cgst.slice(0, 2)] || '',
      irn: '',
      del: '',
      ord: '',
      gi: '',
      rc: 'No',
      pay: '30 days',
      amt,
      roundOff,
      cess: totalCess,
      items: s.items,
      pages: [
        {
          n: 1,
          rows: [
            ['TAX INVOICE', s.no],
            ['Sample multi-format invoice data generated inside VCPL Tools'],
          ],
        },
      ],
      parserMode: s.mode,
    };
  });
}
