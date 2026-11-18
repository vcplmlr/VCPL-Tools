/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HdfcDepositFormData, RenderMode, HdfcDenom } from '../types';
import { wordsCurrency, formatINR, wrapWords } from '../utils/numberToWords';

interface HdfcDepositSlipReplicaProps {
  data: HdfcDepositFormData;
  mode: RenderMode;
}

const DEN_LIST: HdfcDenom[] = [2000, 500, 200, 100, 50, 20, 10];
const DEN_LABELS = ['2000x', '500x', '200x', '100x', '50X', '20x', '10x'];

export const HdfcDepositSlipReplica: React.FC<HdfcDepositSlipReplicaProps> = ({ data, mode }) => {
  const isDataOnly = mode === 'data';

  // Calculate Cash Total
  let cashTotal = 0;
  DEN_LIST.forEach((d) => {
    const count = typeof data.denominations[d] === 'number' ? Number(data.denominations[d]) : 0;
    cashTotal += count * d;
  });
  const coinsNum = typeof data.coins === 'number' ? data.coins : parseFloat(String(data.coins)) || 0;
  cashTotal += coinsNum;

  // Active cheques
  const activeCheques = data.cheques.filter(
    (c) =>
      (c.bankBranch && c.bankBranch.trim() !== '') ||
      (c.city && c.city.trim() !== '') ||
      (c.chequeNo && c.chequeNo.trim() !== '') ||
      (typeof c.amount === 'number' && c.amount > 0)
  );

  const chequeTotal = activeCheques.reduce(
    (sum, c) => sum + (typeof c.amount === 'number' ? c.amount : 0),
    0
  );

  const grandTotal = cashTotal + chequeTotal;

  // Words
  const grandWords = grandTotal > 0 ? wordsCurrency(grandTotal) : '';
  const [wLeft1, wLeft2] = wrapWords(grandWords, 48);
  const [wRight1, wRight2] = wrapWords(grandWords, 58);

  // Customer copy rows (up to 6): row 0 is Cash if cashTotal > 0, followed by cheques
  const customerRows: Array<{ b: string; c: string; k: string; a: number }> = [];
  if (cashTotal > 0) {
    customerRows.push({ b: 'Cash Deposit', c: '', k: '', a: cashTotal });
  }
  activeCheques.forEach((ch) => {
    if (customerRows.length < 6) {
      customerRows.push({
        b: ch.bankBranch || 'Cheque',
        c: ch.city || '',
        k: ch.chequeNo || '',
        a: typeof ch.amount === 'number' ? ch.amount : 0,
      });
    }
  });

  // Date parsing
  const [yStr, mStr, dStr] = data.date ? data.date.split('-') : ['', '', ''];
  const ds = dStr ? dStr + mStr + yStr : '';
  const ph = 'DDMMYYYY';

  const acc = (data.accountNo || '').replace(/\s+/g, '');
  const cc = (data.creditCardNo || '').replace(/\s+/g, '');
  const loan = (data.loanAccountNo || '').replace(/\s+/g, '');
  const ph2 = (data.phone || '').replace(/\s+/g, '');
  const panUpper = (data.pan || '').toUpperCase().replace(/\s+/g, '');
  const nm = data.name || '';
  const ty = data.depositType || '';
  const sp = data.special || '';

  // Helpers
  const S = (x: number, y: number, text: React.ReactNode, style: React.CSSProperties = {}) => (
    <div
      className={`absolute whitespace-nowrap transition-opacity ${
        isDataOnly ? 'opacity-0' : 'opacity-100 text-black'
      }`}
      style={{ left: `${x}px`, top: `${y}px`, transform: 'translateY(-50%)', ...style }}
    >
      {text}
    </div>
  );

  const SC = (x: number, y: number, text: React.ReactNode, style: React.CSSProperties = {}) => (
    <div
      className={`absolute whitespace-nowrap text-center transition-opacity ${
        isDataOnly ? 'opacity-0' : 'opacity-100 text-black'
      }`}
      style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)', ...style }}
    >
      {text}
    </div>
  );

  const Bx = (x1: number, y1: number, x2: number, y2: number, style: React.CSSProperties = {}) => (
    <div
      className={`absolute transition-opacity ${
        isDataOnly ? 'border-transparent bg-transparent' : 'border border-black'
      }`}
      style={{
        left: `${x1}px`,
        top: `${y1}px`,
        width: `${x2 - x1 + 1}px`,
        height: `${y2 - y1 + 1}px`,
        ...style,
      }}
    />
  );

  const Ln = (x1: number, x2: number, y: number, style: React.CSSProperties = {}) => (
    <div
      className={`absolute transition-opacity ${
        isDataOnly ? 'border-transparent' : 'border-t border-black'
      }`}
      style={{ left: `${x1}px`, top: `${y}px`, width: `${x2 - x1}px`, height: 0, ...style }}
    />
  );

  const DB = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    val: string,
    al: 'left' | 'center' | 'right' = 'left',
    style: React.CSSProperties = {}
  ) => {
    if (!val) return null;
    return (
      <div
        className="absolute font-bold text-black flex items-center select-text overflow-hidden"
        style={{
          left: `${x1}px`,
          top: `${(y1 + y2) / 2}px`,
          width: `${x2 - x1}px`,
          transform: 'translateY(-50%)',
          justifyContent: al === 'right' ? 'flex-end' : al === 'left' ? 'flex-start' : 'center',
          padding: '0 5px',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          fontSize: '15px',
          ...style,
        }}
      >
        {val}
      </div>
    );
  };

  const chk = (x: number, y: number, on: boolean, s: number = 12) => (
    <>
      {Bx(x, y, x + s, y + s)}
      {on && DB(x - 2, y, x + s + 2, y + s, '✓', 'center', { padding: 0, fontSize: '14px' })}
    </>
  );

  const DT = (x: number, y: number, h: number, str: string, placeholder: string) => {
    const cw = (x > 1000 ? 255 : 264) / 8;
    return (
      <>
        {Array.from({ length: 8 }).map((_, i) => (
          <React.Fragment key={i}>
            {Bx(x + i * cw, y, x + (i + 1) * cw, y + h)}
            {str[i] ? (
              DB(x + i * cw, y, x + (i + 1) * cw, y + h, str[i], 'center', { padding: 0 })
            ) : (
              <div
                className={`absolute transition-opacity ${
                  isDataOnly ? 'opacity-0' : 'opacity-100 text-[#bbb]'
                }`}
                style={{
                  left: `${x + i * cw + cw / 2}px`,
                  top: `${y + h / 2}px`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: '20px',
                }}
              >
                {placeholder[i]}
              </div>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  const G = (y: number, h: number, groups: [number, number, number][], str: string) => {
    let k = 0;
    return (
      <>
        {groups.map(([x1, x2, n], gIdx) => {
          const cw = (x2 - x1) / n;
          return Array.from({ length: n }).map((_, i) => {
            const charIdx = k++;
            const char = str[charIdx] || '';
            return (
              <React.Fragment key={`${gIdx}-${i}`}>
                {Bx(x1 + i * cw, y, x1 + (i + 1) * cw, y + h)}
                {char && DB(x1 + i * cw, y, x1 + (i + 1) * cw, y + h, char, 'center', { padding: 0 })}
              </React.Fragment>
            );
          });
        })}
      </>
    );
  };

  const logo = (x: number, y: number) => (
    <svg
      className={`absolute transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100 text-black'}`}
      style={{ left: `${x}px`, top: `${y}px`, width: '140px', height: '24px' }}
      viewBox="0 0 140 24"
    >
      <rect width="140" height="24" fill="currentColor" />
      <rect x="4" y="4" width="16" height="16" fill="#fff" />
      <rect x="8" y="8" width="8" height="8" fill="currentColor" />
      <text x="26" y="18" fontFamily="Arial" fontWeight="700" fontSize="16" fill="#fff">
        HDFC BANK
      </text>
    </svg>
  );

  const cons = (t: string) => <span style={{ fontSize: '7.5px' }}>{t}</span>;
  const tw = (t: React.ReactNode) => (
    <span style={{ display: 'inline-block', verticalAlign: 'middle', fontSize: '8px', lineHeight: '9px', whiteSpace: 'normal' }}>
      {t}
    </span>
  );

  return (
    <div
      id="hdfc-deposit-slip-canvas"
      className="relative bg-white text-black select-none shrink-0"
      style={{
        width: '1568px',
        height: '610px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '14px',
        color: '#000',
      }}
    >
      {/* ========================================================= */}
      {/* LEFT SIDE (CUSTOMER COPY / KA KOFI JONG I CUSTOMER)        */}
      {/* ========================================================= */}
      {logo(43, 55)}
      {S(43, 77, 'We understand your world', { fontSize: '13px' })}
      {S(578, 44, <span><b>Deposit Slip</b> / KA DEPOSIT SLIP</span>, {
        transform: 'translate(-100%, -50%)',
        fontSize: '12px',
      })}
      {S(578, 57, <span>(Customer Copy {cons('KA KOFI JONG I CUSTOMER')})</span>, {
        transform: 'translate(-100%, -50%)',
        fontSize: '11px',
      })}

      {/* Date */}
      {S(302, 62, <span>Date / <span style={{ fontSize: '12px' }}>TARIK</span></span>, { fontSize: '16px' })}
      {DT(302, 72, 32, ds, ph)}

      {/* Account Number (4, 3, 7) */}
      {S(42, 105, <span>Account Number / {cons('KA ACCOUNT NOMBAR')}</span>, { fontSize: '17px' })}
      {G(116, 27, [[41, 165, 4], [173, 266, 3], [273, 492, 7]], acc)}

      {/* Credit Card Number (4, 4, 4, 4) */}
      {S(42, 155, <span>Credit Card Number / {cons('KA CREDIT CARD NOMBAR')}</span>, { fontSize: '17px' })}
      {G(163, 29, [[41, 168, 4], [174, 299, 4], [305, 431, 4], [437, 562, 4]], cc)}

      {/* Loan Account */}
      {S(54, 200, <i><b>Loan Account No.:</b></i>, { fontSize: '11px' })}
      {S(54, 212, cons('KA LOAN ACCOUNT NOMBAR'))}
      {chk(41, 217, data.loanAccountTicked, 14)}
      {S(58, 226, <span style={{ fontSize: '6px' }}>(✔ SNGEWBHA KDEW DA KABA RUID)</span>)}
      {G(200, 30, [[175, 490, 10]], loan)}

      {/* Name */}
      {S(42, 256, <span>Name / <span style={{ fontSize: '11px' }}>KYRTENG :</span></span>, { fontSize: '16px' })}
      {Ln(150, 560, 261)}
      {DB(150, 246, 560, 262, nm)}

      {/* Customer Copy Table */}
      {Bx(41, 268, 560, 529)}
      {Bx(41, 268, 300, 289)}
      {Bx(300, 268, 417, 289)}
      {Bx(417, 268, 560, 289)}
      {S(44, 279, (
        <span>
          <b>Cash/Cheque Details/</b> {tw(<>KA JINGTHOH BNIAH IA<br />PISA NOKOT/ KA SHEK</>)}
        </span>
      ), { fontSize: '14px' })}
      {S(304, 279, (
        <span>
          <b><i>Cheque No./</i></b> {tw(<>KA SHEK<br />NOMBAR</>)}
        </span>
      ), { fontSize: '12px' })}
      {S(448, 279, <span>Rupees/ {cons('PISA')}</span>, { fontSize: '14px' })}

      {/* 6 Rows on Customer Copy */}
      {Array.from({ length: 6 }).map((_, i) => {
        const y = 289 + i * 29.5;
        const r = customerRows[i] || { b: '', c: '', k: '', a: 0 };
        return (
          <React.Fragment key={i}>
            {Bx(41, y, 300, y + 29.5)}
            {Bx(300, y, 417, y + 29.5)}
            {Bx(417, y, 560, y + 29.5)}
            {DB(41, y, 300, y + 29.5, r.b ? (r.c ? `${r.b}, ${r.c}` : r.b) : '', 'left', { fontSize: '13px' })}
            {DB(300, y, 417, y + 29.5, r.k || '', 'left', { fontSize: '13px' })}
            {DB(417, y, 560, y + 29.5, r.a ? formatINR(r.a) : '', 'right')}
          </React.Fragment>
        );
      })}

      {/* Customer Total */}
      {Bx(300, 466, 417, 489)}
      {Bx(417, 466, 560, 489)}
      {S(305, 478, <span>Total Rs. / {cons('KYLLUM T.')}</span>, { fontSize: '13px' })}
      {DB(417, 466, 560, 489, grandTotal > 0 ? formatINR(grandTotal) : '', 'right')}

      {/* Customer Rupees in words */}
      {Bx(41, 490, 560, 528)}
      {S(45, 500, 'Rupees (In words):', { fontSize: '15px' })}
      {S(45, 519, <span style={{ font: '10px serif' }}>Tyngka da ki dak thoh</span>)}
      {Ln(165, 553, 524)}
      {DB(178, 495, 553, 509, wLeft1, 'left', { fontSize: '12.5px' })}
      {DB(178, 508, 553, 523, wLeft2, 'left', { fontSize: '12.5px' })}

      {/* Signatures */}
      {[
        [42, 194, "Depositor's Name/", 'Ka kyrteng I Nongthep'],
        [231, 383, "Depositor's  Signature /", 'Ka jingsoi I Nongthep'],
        [424, 560, "Teller's Signature/", 'Ka jingsoi I Nongshim'],
      ].map(([x1, x2, en, kh], idx) => (
        <React.Fragment key={idx}>
          {Ln(Number(x1), Number(x2), 552)}
          {SC((Number(x1) + Number(x2)) / 2, 564, en, { fontSize: '12px' })}
          {SC((Number(x1) + Number(x2)) / 2, 577, <b>{kh}</b>, { fontSize: '10.5px' })}
        </React.Fragment>
      ))}

      {/* Vertical Dashed Cut Line */}
      <div
        className={`absolute transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
        style={{
          left: '593px',
          top: 0,
          height: '610px',
          width: 0,
          borderLeft: '1px dashed #000',
        }}
      />

      {/* ========================================================= */}
      {/* RIGHT SIDE (BANK COPY / Ka kopi jong ka Bank)             */}
      {/* ========================================================= */}
      {logo(631, 55)}
      {S(631, 77, 'We understand your world', { fontSize: '13px' })}

      {/* Deposit Type Checkboxes on Bank Copy */}
      {[
        ['Loan Account No /Ka Loan account nombar', 'loan', 46],
        ['Cash /Ka pisa nokot', 'cash', 60],
        ['Local cheque/Ka shek ba na kane ka shnong', 'local', 74],
        ['Outstation Cheque/Ka shek ba na shabar shnong', 'out', 88],
        ['Credit Card Payment /Ka jingsiew na ka bynta', 'cc', 102],
      ].map(([label, code, y], idx) => (
        <React.Fragment key={idx}>
          {chk(795, Number(y) - 3, ty === code, 10)}
          {S(809, Number(y) + 3, label, { fontSize: '10px' })}
        </React.Fragment>
      ))}
      {S(922, 113, <i style={{ fontSize: '7.5px' }}>ka Credit card</i>)}

      {/* Special Options Checkboxes */}
      {sp === 'nro' && DB(984, 40, 1002, 56, '✓', 'center', { padding: 0 })}
      {S(1003, 48, (
        <span>• For NRO Account / <i style={{ fontSize: '9px' }}>Na ka bynta ka NRO account /NRO</i></span>
      ), { fontSize: '10.5px' })}
      {chk(1003, 59, sp === 'div', 10)}
      {S(1017, 64, 'Dividend / Interest warrant /', { fontSize: '10.5px' })}
      {S(1017, 76, <b style={{ fontSize: '9.5px' }}>Ka Dividend / interest warrant</b>)}
      {chk(1003, 88, sp === 'rent', 10)}
      {S(1017, 92, 'Rent / Pension / Sale proceeds of Assets /', { fontSize: '10.5px' })}
      {S(1017, 104, <b style={{ fontSize: '9.5px' }}>Ka bai-wai /Pension/ ka jingioh naba die ia ki jingdon</b>)}

      {/* Top Right Header & Date */}
      {S(1552, 41, <span><b>Deposit Slip</b> / KA DEPOSIT SLIP</span>, {
        transform: 'translate(-100%, -50%)',
        fontSize: '12px',
      })}
      {S(1552, 53, <span>(Bank Copy / {cons('Ka kopi jong ka Bank')})</span>, {
        transform: 'translate(-100%, -50%)',
        fontSize: '11px',
      })}
      {S(1265, 56, <span>Date/ <span style={{ fontSize: '12px' }}>TARIK</span></span>, { fontSize: '16px' })}
      {DT(1275, 72, 32, ds, ph)}

      {/* Contact No. & PAN */}
      {S(627, 125, <span>Contact No.: <i style={{ fontSize: '11px' }}>/Ka nombar phone</i></span>, { fontSize: '14px' })}
      {G(133, 29, [[627, 943, 10]], ph2)}

      {S(627, 173, <span>PAN No.* <i style={{ fontSize: '11px' }}>/Ka PAN nombar</i></span>, { fontSize: '14px' })}
      {G(180, 30, [[627, 943, 10]], panUpper)}

      {/* Account Number & Credit Card on Bank Copy */}
      {S(1003, 125, <span>Account Number / <i style={{ fontSize: '11px' }}>Ka Account nombar</i></span>, { fontSize: '17px' })}
      {G(131, 31, [[1003, 1128, 4], [1134, 1229, 3], [1235, 1458, 7]], acc)}

      {S(1003, 172, <span>Credit Card Number / <i style={{ fontSize: '11px' }}>Ka Credit card nombar</i></span>, { fontSize: '17px' })}
      {G(180, 30, [[1003, 1130, 4], [1134, 1263, 4], [1268, 1396, 4], [1401, 1530, 4]], cc)}

      {/* Loan Account on Bank Copy */}
      {S(1115, 225, (
        <span>
          <b><i>Loan Account No.:</i></b> Ka Loan account nombar
        </span>
      ), { fontSize: '10.5px' })}
      {chk(1336, 219, data.loanAccountTicked, 16)}
      {S(1358, 225, cons('(✔ SNGEWBHA KDEW DA KABA RUID)'))}
      {G(237, 29, [[1213, 1530, 10]], loan)}

      {/* Name on Bank Copy */}
      {S(628, 238, <span>Name / <i style={{ fontSize: '11px' }}>KYRTENG:</i></span>, { fontSize: '16px' })}
      {Ln(740, 1193, 244)}
      {DB(740, 230, 1193, 245, nm)}
      {Ln(628, 1193, 270)}

      {/* Tables on Bank Copy */}
      {Bx(627, 280, 866, 300)}
      {Bx(866, 280, 987, 300)}
      {Bx(987, 280, 1150, 300)}
      {Bx(1150, 280, 1293, 300)}
      {Bx(1293, 280, 1510, 300)}
      {S(648, 291, <span>Bank &amp; Branch <i style={{ fontSize: '10px' }}>/Ka Bank &amp; Tnat</i></span>, { fontSize: '13.5px' })}
      {S(896, 291, <span>City <i style={{ fontSize: '10px' }}>/ Nongbah</i></span>, { fontSize: '13.5px' })}
      {S(993, 291, <span>Cheque No<i style={{ fontSize: '10px' }}>/Ka Shek nombar</i></span>, { fontSize: '13px' })}
      {S(1153, 291, <span>Denomination <i style={{ fontSize: '10px' }}>/ Ki pisa</i></span>, { fontSize: '12.5px' })}
      {SC(1400, 291, <span>Rupees / <i>Tyngka</i></span>, { fontSize: '14px' })}

      {/* 7 Rows for Cheque Details on Bank Copy */}
      {Array.from({ length: 7 }).map((_, i) => {
        const rh = 25.75;
        const y = 300 + i * rh;
        const ch = activeCheques[i] || { bankBranch: '', city: '', chequeNo: '', amount: 0 };
        return (
          <React.Fragment key={i}>
            {Bx(627, y, 866, y + rh)}
            {Bx(866, y, 987, y + rh)}
            {Bx(987, y, 1150, y + rh)}
            {DB(627, y, 866, y + rh, ch.bankBranch || '', 'left', { fontSize: '12.5px' })}
            {DB(866, y, 987, y + rh, ch.city || '', 'left', { fontSize: '12.5px' })}
            {DB(987, y, 1150, y + rh, ch.chequeNo || '', 'left', { fontSize: '12.5px' })}
          </React.Fragment>
        );
      })}

      {/* 8 Rows for Denominations Table on Bank Copy */}
      {Array.from({ length: 8 }).map((_, i) => {
        const rh = 25.75;
        const y = 300 + i * rh;
        const d = DEN_LIST[i];
        const count = d && typeof data.denominations[d] === 'number' ? Number(data.denominations[d]) : 0;
        const isCoins = i === 7;

        return (
          <React.Fragment key={i}>
            {Bx(1150, y, 1213, y + rh)}
            {Bx(1213, y, 1293, y + rh)}
            {Bx(1293, y, 1510, y + rh)}
            {S(1156, y + 13, isCoins ? <span style={{ fontSize: '14px' }}>Kiwei</span> : DEN_LABELS[i], {
              fontSize: '17px',
            })}
            {isCoins ? (
              coinsNum > 0 && DB(1293, y, 1510, y + rh, formatINR(coinsNum), 'right')
            ) : (
              <>
                {count > 0 && DB(1213, y, 1293, y + rh, String(count), 'center')}
                {count > 0 && DB(1293, y, 1510, y + rh, formatINR(count * d), 'right')}
              </>
            )}
          </React.Fragment>
        );
      })}

      {/* Total Rupees on Bank Copy */}
      {Bx(1150, 506, 1293, 540)}
      {Bx(1293, 506, 1510, 540)}
      {S(1172, 517, 'Total Rupees', { fontSize: '17px' })}
      {S(1180, 531, <span style={{ fontSize: '11px' }}>Ka pisa kyllum</span>)}
      {DB(1293, 506, 1510, 540, grandTotal > 0 ? formatINR(grandTotal) : '', 'right')}

      {/* Rupees in Words on Bank Copy */}
      {Bx(627, 480, 1145, 515)}
      {S(631, 489, 'Rupees (In words) :', { fontSize: '15px' })}
      {S(636, 505, <span style={{ font: '9.5px serif' }}>Ka Pisa da ki dak thoh</span>)}
      {Ln(760, 1140, 510)}
      {DB(768, 484, 1140, 499, wRight1, 'left', { fontSize: '12.5px' })}
      {DB(768, 497, 1140, 511, wRight2, 'left', { fontSize: '12.5px' })}

      {/* Vertical Text labels */}
      <div
        className={`absolute font-bold transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100 text-black'}`}
        style={{
          left: '619px',
          top: '370px',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          fontSize: '13px',
          whiteSpace: 'nowrap',
        }}
      >
        <b>Cheque Details</b> <i style={{ fontSize: '10px' }}>/ Ka jingthoh bniah ia ki Shek</i>
      </div>

      <div
        className={`absolute font-bold transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100 text-black'}`}
        style={{
          left: '1521px',
          top: '420px',
          transform: 'translate(-50%, -50%) rotate(90deg)',
          fontSize: '13px',
          whiteSpace: 'nowrap',
        }}
      >
        <b>Cash Details</b> <i style={{ fontSize: '10px' }}>/ Ka jingthoh-bniah ia ka pisa nokot</i>
      </div>

      {/* PAN Warning */}
      {S(1152, 552, '*For cash deposits greater than Rs. 49,999/- mention PAN No.', { fontSize: '12.5px' })}
      {S(1156, 570, (
        <b><i style={{ fontSize: '11px' }}>Na ka bynta ka pisa nokot ba thep palat T. 49,999/- thoh ka PAN nombar</i></b>
      ))}

      {/* Signatures on Bank Copy */}
      {[
        [622, 770, "Depositor's Name/", 'Ka kyrteng I Nongthep'],
        [843, 963, "Depositor's Signature /", 'Ka jingsoi I Nongthep'],
        [1030, 1140, "Teller's Signature/", 'Ka jingsoi I Nongshim'],
      ].map(([x1, x2, en, kh], idx) => (
        <React.Fragment key={idx}>
          {Ln(Number(x1), Number(x2), 552)}
          {SC((Number(x1) + Number(x2)) / 2, 564, en, { fontSize: '12px' })}
          {SC((Number(x1) + Number(x2)) / 2, 577, <b>{kh}</b>, { fontSize: '10.5px' })}
        </React.Fragment>
      ))}
    </div>
  );
};
