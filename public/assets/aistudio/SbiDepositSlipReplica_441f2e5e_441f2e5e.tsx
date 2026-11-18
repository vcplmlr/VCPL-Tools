/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DepositFormData, RenderMode } from '../types';
import { words, twoDigits, formatINR, wrapWords } from '../utils/numberToWords';

interface SbiDepositSlipReplicaProps {
  data: DepositFormData;
  mode: RenderMode;
}

const DEN_LIST = [2000, 500, 200, 100, 50, 20, 10, 5] as const;

export const SbiDepositSlipReplica: React.FC<SbiDepositSlipReplicaProps> = ({ data, mode }) => {
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
    (c) => (c.details && c.details.trim() !== '') || (typeof c.amount === 'number' && c.amount > 0)
  );
  const chequeTotal = activeCheques.reduce(
    (sum, c) => sum + (typeof c.amount === 'number' ? c.amount : 0),
    0
  );

  const grandTotal = cashTotal + chequeTotal;

  // Combined rows for the 4-row tables on Left & Right
  const rows: Array<{ d: string; a: number }> = [];
  if (cashTotal > 0) {
    rows.push({ d: 'Cash Deposit', a: cashTotal });
  }
  activeCheques.forEach((c) => {
    if (rows.length < 3) {
      rows.push({ d: c.details || 'Cheque', a: typeof c.amount === 'number' ? c.amount : 0 });
    }
  });

  // Date parsing
  const [yStr, mStr, dStr] = data.date ? data.date.split('-') : ['', '', ''];
  const shortYear = yStr ? yStr.slice(2) : '';
  const date8 = (dStr || '  ') + (mStr || '  ') + (yStr || '    ');

  // Account number
  const acc = (data.accountNo || '').replace(/\s+/g, '');
  const panUpper = (data.pan || '').toUpperCase();

  // Words
  const whole = Math.floor(grandTotal);
  const paise = Math.round((grandTotal - whole) * 100);
  const wordsText = grandTotal > 0
    ? `Rupees ${words(whole) || 'Zero'}${paise ? ' and ' + twoDigits(paise) + ' Paise' : ''} Only`
    : '';

  const leftWords = wrapWords(wordsText, 38);
  const rightWords = wrapWords(wordsText, 50);

  // Helper renderers in exact 1568 x 600 px space
  const S = (x: number, y: number, text: React.ReactNode, style: React.CSSProperties = {}) => (
    <div
      className={`absolute whitespace-nowrap select-none transition-opacity ${
        isDataOnly ? 'opacity-0' : 'opacity-100 text-black'
      }`}
      style={{ left: `${x}px`, top: `${y}px`, transform: 'translateY(-50%)', ...style }}
    >
      {text}
    </div>
  );

  const Dt = (x: number, y: number, val: React.ReactNode, style: React.CSSProperties = {}) => {
    if (val === '' || val === undefined || val === null) return null;
    return (
      <div
        className="absolute whitespace-nowrap font-bold text-gray-950 font-sans tracking-tight z-10"
        style={{ left: `${x}px`, top: `${y}px`, transform: 'translateY(-50%)', ...style }}
      >
        {val}
      </div>
    );
  };

  const Bx = (x: number, y: number, w: number, h: number, style: React.CSSProperties = {}) => (
    <div
      className={`absolute transition-opacity ${
        isDataOnly ? 'border-transparent bg-transparent' : 'border border-black'
      }`}
      style={{ left: `${x}px`, top: `${y}px`, width: `${w + 1}px`, height: `${h + 1}px`, ...style }}
    />
  );

  const Ln = (x1: number, x2: number, y: number) => (
    <div
      className={`absolute transition-opacity ${
        isDataOnly ? 'border-transparent' : 'border-t border-black'
      }`}
      style={{ left: `${x1}px`, top: `${y}px`, width: `${x2 - x1}px`, height: 0 }}
    />
  );

  const Blk = (x: number, y: number, w: number, h: number, children?: React.ReactNode) => (
    <div
      className={`absolute flex items-center justify-center transition-opacity ${
        isDataOnly ? 'bg-transparent text-transparent' : 'bg-black text-white'
      }`}
      style={{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }}
    >
      {children}
    </div>
  );

  const DB = (
    x: number,
    y: number,
    w: number,
    h: number,
    val: React.ReactNode,
    al: 'left' | 'center' | 'right' = 'center',
    style: React.CSSProperties = {}
  ) => {
    if (val === '' || val === undefined || val === null) return null;
    return (
      <div
        className="absolute font-bold text-gray-950 font-sans tracking-tight z-10 flex items-center overflow-hidden"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,
          height: `${h}px`,
          justifyContent: al === 'right' ? 'flex-end' : al === 'left' ? 'flex-start' : 'center',
          padding: '0 5px',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          ...style,
        }}
      >
        {val}
      </div>
    );
  };

  const Cells = (x: number, y: number, w: number, h: number, n: number, str: string) => {
    const cw = w / n;
    return (
      <>
        {Array.from({ length: n }).map((_, i) => (
          <React.Fragment key={i}>
            {Bx(x + i * cw, y, cw, h)}
            {DB(x + i * cw, y, cw, h, str[i] || '', 'center')}
          </React.Fragment>
        ))}
      </>
    );
  };

  const Logo = (x: number, y: number) => (
    <svg
      className={`absolute transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
      style={{ left: `${x}px`, top: `${y + 12}px`, width: '24px', height: '24px' }}
      viewBox="0 0 40 40"
    >
      <circle cx="20" cy="20" r="20" fill="#0C2340" />
      <circle cx="20" cy="15" r="6" fill="#fff" />
      <rect x="17.5" y="17" width="5" height="16" fill="#fff" />
    </svg>
  );

  const Table = (
    X: number[],
    y0: number,
    hdr: string,
    cx: [number, number]
  ) => {
    const totalW = X[X.length - 1] - X[0];
    return (
      <>
        {Blk(X[0], y0, totalW, 21)}
        {S(X[0] + 12, y0 + 11, hdr, { color: isDataOnly ? 'transparent' : '#fff' })}
        {S(cx[0], y0 + 11, '₹', { color: isDataOnly ? 'transparent' : '#fff' })}
        {S(cx[1], y0 + 11, 'P.', { color: isDataOnly ? 'transparent' : '#fff' })}

        {[0, 1, 2, 3].map((r) => {
          const y = y0 + 22 + r * 21;
          const last = r === 3;
          const E = [X[0], X[1], X[5], X[6]];
          const rw = rows[r];

          return (
            <React.Fragment key={r}>
              {[0, 1, 2].map((c) => {
                if (last && c === 0) return null;
                return (
                  <React.Fragment key={`b-${r}-${c}`}>
                    {Bx(E[c], y, E[c + 1] - E[c], 21)}
                  </React.Fragment>
                );
              })}
              {last && S(X[1] - 48, y + 11, 'Total', { fontWeight: 700 })}
              {!last && rw && DB(X[0], y, X[1] - X[0], 21, rw.d, 'left')}
              {last && grandTotal > 0 && (
                <>
                  {DB(X[1], y, X[5] - X[1], 21, formatINR(whole), 'right')}
                  {DB(X[5], y, X[6] - X[5], 21, String(paise).padStart(2, '0'), 'center')}
                </>
              )}
              {!last && rw && rw.a > 0 && (
                <>
                  {DB(X[1], y, X[5] - X[1], 21, formatINR(Math.floor(rw.a)), 'right')}
                  {DB(X[5], y, X[6] - X[5], 21, String(Math.round((rw.a - Math.floor(rw.a)) * 100)).padStart(2, '0'), 'center')}
                </>
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  const mx = [551, 655, 719, 926, 968];
  const mrow = (y: number) => (
    <>
      {mx.slice(0, 4).map((xVal, i) => (
        <React.Fragment key={i}>
          {Bx(xVal, y, mx[i + 1] - xVal, 22)}
        </React.Fragment>
      ))}
    </>
  );

  return (
    <div
      id="sbi-deposit-slip-canvas"
      className="relative bg-white text-black select-none shrink-0"
      style={{
        width: '1568px',
        height: '600px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '13px',
      }}
    >
      {/* ========================================================= */}
      {/* LEFT SECTION (Customer / Depositor's Copy)                */}
      {/* ========================================================= */}
      <div
        className={`absolute whitespace-nowrap font-bold text-[17px] transition-opacity ${
          isDataOnly ? 'opacity-0' : 'opacity-100 text-black'
        }`}
        style={{ left: '288px', top: '87px', transform: 'translate(-50%, -50%)' }}
      >
        DEPOSIT / PAY IN SLIP
      </div>
      {Logo(80, 109)}
      {S(80, 148, <b style={{ fontFamily: 'Georgia, serif', fontSize: '13px' }}>State Bank of India</b>)}
      {S(80, 170, <b>Branch :</b>)}
      {Dt(148, 170, data.branch)}

      {S(393, 190, 'Date :')}
      {S(452, 190, '/')}
      {S(479, 190, '/')}
      {S(485, 190, '20')}
      {DB(428, 180, 24, 20, dStr, 'center')}
      {DB(455, 180, 24, 20, mStr, 'center')}
      {DB(496, 180, 24, 20, shortYear, 'left')}

      {S(80, 215, 'SB/CA/RD/OD/CC/TL/DL A/c No./Credit Card No.', { fontSize: '10.5px' })}
      {Cells(80, 228, 416, 21, 16, acc)}

      {S(80, 270, 'Name')}
      {Ln(122, 497, 276)}
      {Dt(126, 266, data.name)}

      {S(80, 290, 'Tel. No.')}
      {Ln(133, 497, 298)}
      {Dt(137, 288, data.tel)}

      {S(307, 313, '₹')}
      {S(472, 313, 'P.')}
      {S(80, 332, 'Amount')}
      {Bx(143, 321, 323, 21)}
      {Bx(466, 321, 31, 21)}
      {grandTotal > 0 && DB(143, 321, 323, 21, formatINR(whole), 'right')}
      {grandTotal > 0 && DB(466, 321, 31, 21, String(paise).padStart(2, '0'), 'center')}

      {S(80, 358, 'Rupees in words')}
      {Ln(192, 497, 366)}
      {Dt(196, 356, leftWords[0], { fontSize: '13px' })}
      {Dt(84, 381, leftWords[1], { fontSize: '13px' })}
      {Ln(80, 497, 391)}

      {Table([80, 338, 364, 390, 416, 470, 497], 405, 'Cash/Cheque No./Date & Name of Bank & Branch', [403, 478])}

      {S(80, 545, 'SWO / Passing Officer')}
      {Bx(299, 513, 198, 54)}
      <div
        className={`absolute text-center text-[12px] transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
        style={{ left: '398px', top: '531px', transform: 'translate(-50%, -50%)' }}
      >
        SBI toll free, 24 Hours Call Centre
      </div>
      <div
        className={`absolute text-center text-[12px] font-bold transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
        style={{ left: '398px', top: '550px', transform: 'translate(-50%, -50%)' }}
      >
        No. 18004253800, 1800112211
      </div>

      {/* Middle Perforation Vertical Dashed Line */}
      <div
        className={`absolute border-l border-dashed transition-opacity ${
          isDataOnly ? 'border-transparent' : 'border-black'
        }`}
        style={{ left: '527px', top: 0, height: '600px', width: 0 }}
      />

      {/* ========================================================= */}
      {/* MIDDLE SECTION (Cash Denominations & PAN)                 */}
      {/* ========================================================= */}
      {Bx(551, 123, 417, 83)}
      <div
        className={`absolute text-[11px] leading-[15px] font-bold transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
        style={{ left: '620px', top: '149px', transform: 'translateY(-50%)' }}
      >
        PAN NO.
        <br />
        OR
        <br />
        Form 60
      </div>
      {Cells(678, 139, 218, 21, 10, panUpper)}
      {Bx(680, 167, 22, 22)}
      {data.form60 && DB(680, 167, 22, 22, '✓', 'center', { fontSize: '18px' })}
      <div
        className={`absolute text-center text-[11px] transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
        style={{ left: '759px', top: '197px', transform: 'translate(-50%, -50%)' }}
      >
        For Cash Deposit of ₹ 50,000/- &amp; Above
      </div>

      {Blk(551, 207, 417, 25, <b className="text-[13px] tracking-wide">CASH DEPOSIT</b>)}

      {mrow(232)}
      <div className={`absolute text-center transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`} style={{ left: '603px', top: '243px', transform: 'translate(-50%, -50%)' }}>Notes</div>
      <div className={`absolute text-center transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`} style={{ left: '687px', top: '243px', transform: 'translate(-50%, -50%)' }}>No.</div>
      <div className={`absolute text-center transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`} style={{ left: '822px', top: '243px', transform: 'translate(-50%, -50%)' }}>₹</div>
      <div className={`absolute text-center transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`} style={{ left: '947px', top: '243px', transform: 'translate(-50%, -50%)' }}>P.</div>

      {DEN_LIST.map((d, i) => {
        const y = 254 + i * 22;
        const c = typeof data.denominations[d] === 'number' ? Number(data.denominations[d]) : 0;
        return (
          <React.Fragment key={d}>
            {mrow(y)}
            {S(560, y + 11, `${d} x`)}
            {c > 0 && DB(655, y, 64, 22, c, 'center')}
            {c > 0 && DB(719, y, 207, 22, formatINR(c * d), 'right')}
            {c > 0 && DB(926, y, 42, 22, '00', 'center')}
          </React.Fragment>
        );
      })}

      {mrow(430)}
      {S(560, 441, 'Coins')}
      {coinsNum > 0 && DB(719, 430, 207, 22, formatINR(coinsNum), 'right')}
      {coinsNum > 0 && DB(926, 430, 42, 22, '00', 'center')}

      {Bx(719, 452, 207, 26)}
      {Bx(926, 452, 42, 26)}
      {Bx(655, 452, 64, 26)}
      <div className={`absolute text-center font-bold transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`} style={{ left: '687px', top: '465px', transform: 'translate(-50%, -50%)' }}>
        Total
      </div>
      {cashTotal > 0 && DB(719, 452, 207, 26, formatINR(cashTotal), 'right')}
      {cashTotal > 0 && DB(926, 452, 42, 26, '00', 'center')}

      {Bx(551, 489, 417, 78)}
      {S(559, 502, '1. All Cheques must be crossed.', { fontSize: '11.5px' })}
      {S(559, 521, '2. Please mention your A/c No. and Name on back of the Cheque.', { fontSize: '11.5px' })}
      {S(559, 540, '3. Please use separate slips for Cash Deposit, Outstation Cheques and Local', { fontSize: '11.5px' })}
      {S(570, 557, 'Cheques.', { fontSize: '11.5px' })}

      {/* ========================================================= */}
      {/* RIGHT SECTION (Bank's Copy)                               */}
      {/* ========================================================= */}
      <div
        className={`absolute whitespace-nowrap font-bold text-[17px] transition-opacity ${
          isDataOnly ? 'opacity-0' : 'opacity-100 text-black'
        }`}
        style={{ left: '1240px', top: '87px', transform: 'translate(-50%, -50%)' }}
      >
        DEPOSIT / PAY IN SLIP
      </div>
      {Logo(995, 109)}
      {S(995, 148, <b style={{ fontFamily: 'Georgia, serif', fontSize: '13px' }}>State Bank of India</b>)}
      {S(995, 170, <b>Branch :</b>)}
      {Dt(1063, 170, data.branch)}

      {S(1278, 158, 'Date')}
      {Cells(1312, 147, 175, 21, 8, date8)}

      {S(995, 198, 'SB/CA/RD/OD/CC/TL/DL A/c No./Credit Card No.', { fontSize: '10.5px' })}
      {Cells(995, 210, 492, 23, 19, acc)}

      {S(995, 261, 'Name')}
      {Ln(1040, 1487, 266)}
      {Dt(1044, 256, data.name)}

      {S(995, 285, 'Tel. No./Mobile No.')}
      {Ln(1112, 1487, 291)}
      {Dt(1116, 281, data.tel)}

      {S(995, 305, 'E-mail ID')}
      {Ln(1058, 1487, 311)}
      {Dt(1062, 301, data.email)}

      {S(995, 328, 'Rupees in words')}
      {Ln(1094, 1487, 334)}
      {Dt(1098, 324, rightWords[0], { fontSize: '13px' })}
      {Dt(999, 348, rightWords[1], { fontSize: '13px' })}
      {Ln(995, 1487, 358)}

      {Table([995, 1327, 1354, 1380, 1406, 1460, 1487], 375, 'Cheque No./Date/Name of Bank & Branch', [1385, 1462])}

      {Bx(995, 500, 198, 60)}
      <div
        className={`absolute font-bold transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
        style={{ left: '1094px', top: '515px', transform: 'translate(-50%, -50%)' }}
      >
        Transaction ID
      </div>
      {Ln(995, 1193, 534)}
      {S(1002, 551, 'SWO')}
      {S(1099, 551, 'Passing Officer')}
      {S(1333, 585, 'Signature of Depositor', { fontSize: '14px' })}

      <div
        className={`absolute font-mono text-[9px] transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
        style={{ left: '1510px', top: '520px', transform: 'translate(-50%, -50%) rotate(-90deg)' }}
      >
        100999131-V3
      </div>
    </div>
  );
};
