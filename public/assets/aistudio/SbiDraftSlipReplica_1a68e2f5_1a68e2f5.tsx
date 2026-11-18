/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DemandDraftFormData, RenderMode, DdDenom } from '../types';
import { words, twoDigits, formatINR, wrapWords } from '../utils/numberToWords';

interface SbiDraftSlipReplicaProps {
  data: DemandDraftFormData;
  mode: RenderMode;
}

const DD_DENOMS: DdDenom[] = [500, 100, 50, 20, 10, 5, 2, 1];

export const SbiDraftSlipReplica: React.FC<SbiDraftSlipReplicaProps> = ({ data, mode }) => {
  const isDataOnly = mode === 'data';

  const numAmt = typeof data.draftAmt === 'number' ? data.draftAmt : parseFloat(String(data.draftAmt)) || 0;
  const numExch = typeof data.exchangeAmt === 'number' ? data.exchangeAmt : parseFloat(String(data.exchangeAmt)) || 0;
  const grandTotal = numAmt + numExch;

  // Calculate cash total
  let totalCash = 0;
  DD_DENOMS.forEach((d) => {
    const count = typeof data.denominations[d] === 'number' ? Number(data.denominations[d]) : 0;
    totalCash += count * d;
  });

  // Words
  const whole = Math.floor(numAmt);
  const paise = Math.round((numAmt - whole) * 100);
  const wordsText = numAmt > 0
    ? `Rupees ${words(whole) || 'Zero'}${paise ? ' and ' + twoDigits(paise) + ' Paise' : ''} Only`
    : '';

  const stubWords = wrapWords(wordsText, 38);
  const formWords = wrapWords(wordsText, 50);
  const favourWrapped = wrapWords(data.inFavourOf, 46);
  const addrCombined = data.applicantAddr
    ? `${data.applicantName}${data.applicantName && data.applicantAddr ? ', ' : ''}${data.applicantAddr}`
    : data.applicantName;
  const addrWrapped = wrapWords(addrCombined, 50);

  // Date parsing
  const [yStr, mStr, dStr] = data.date ? data.date.split('-') : ['', '', ''];
  const formattedDate = dStr ? `${dStr}/${mStr}/${yStr}` : '';
  const datePadded = '     ' + (dStr || '  ') + (mStr || '  ') + (yStr || '    ');
  const date8 = (dStr || '').padStart(2, ' ') + (mStr || '').padStart(2, ' ') + (yStr || '').padStart(4, ' ');

  // Words for Total Amount
  const totalForWords = grandTotal > 0 ? grandTotal : numAmt;
  const wholeTotal = Math.floor(totalForWords);
  const paiseTotal = Math.round((totalForWords - wholeTotal) * 100);
  const totalWordsText = totalForWords > 0
    ? `Rupees ${words(wholeTotal) || 'Zero'}${paiseTotal ? ' and ' + twoDigits(paiseTotal) + ' Paise' : ''} Only`
    : '';
  const stubTotalWords = wrapWords(totalWordsText, 38);

  // Helpers
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

  const SC = (x: number, y: number, text: React.ReactNode, style: React.CSSProperties = {}) => (
    <div
      className={`absolute whitespace-nowrap select-none text-center transition-opacity ${
        isDataOnly ? 'opacity-0' : 'opacity-100 text-black'
      }`}
      style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)', ...style }}
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

  const Bx = (x1: number, y1: number, x2: number, y2: number) => (
    <div
      className={`absolute transition-opacity ${
        isDataOnly ? 'border-transparent bg-transparent' : 'border border-black'
      }`}
      style={{
        left: `${x1}px`,
        top: `${y1}px`,
        width: `${x2 - x1 + 1}px`,
        height: `${y2 - y1 + 1}px`,
      }}
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

  const DB = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    val: React.ReactNode,
    al: 'left' | 'center' | 'right' = 'center',
    style: React.CSSProperties = {}
  ) => {
    if (val === '' || val === undefined || val === null) return null;
    return (
      <div
        className="absolute font-bold text-gray-950 font-sans tracking-tight z-10 flex items-center overflow-hidden"
        style={{
          left: `${x1}px`,
          top: `${y1}px`,
          width: `${x2 - x1}px`,
          height: `${y2 - y1}px`,
          justifyContent: al === 'right' ? 'flex-end' : al === 'left' ? 'flex-start' : 'center',
          padding: '0 6px',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          ...style,
        }}
      >
        {val}
      </div>
    );
  };

  const FieldBox = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    val: React.ReactNode,
    al: 'left' | 'center' | 'right' = 'left',
    style: React.CSSProperties = {}
  ) => (
    <div
      className={`absolute transition-colors flex items-center overflow-hidden rounded-xs z-10 ${
        isDataOnly ? 'bg-transparent' : 'bg-[#F4F7FB]'
      }`}
      style={{
        left: `${x1}px`,
        top: `${y1}px`,
        width: `${x2 - x1}px`,
        height: `${y2 - y1}px`,
        justifyContent: al === 'right' ? 'flex-end' : al === 'center' ? 'center' : 'flex-start',
        padding: '0 8px',
        ...style,
      }}
    >
      {val !== '' && val !== undefined && val !== null ? (
        <span className="font-bold text-gray-950 font-sans tracking-tight truncate whitespace-nowrap">
          {val}
        </span>
      ) : null}
    </div>
  );

  const amtCells = (x1: number, xm: number, x2: number, y1: number, y2: number, v: number) => (
    <>
      {Bx(x1, y1, xm, y2)}
      {Bx(xm, y1, x2, y2)}
      {v > 0 && DB(x1, y1, xm, y2, formatINR(Math.floor(v)), 'right')}
      {v > 0 && DB(xm, y1, x2, y2, String(Math.round((v - Math.floor(v)) * 100)).padStart(2, '0'), 'center')}
    </>
  );

  const Cells = (x: number, y: number, w: number, h: number, n: number, str: string) => {
    const cw = w / n;
    return (
      <>
        {Array.from({ length: n }).map((_, i) => (
          <React.Fragment key={i}>
            {Bx(x + i * cw, y, x + (i + 1) * cw, y + h)}
            {DB(x + i * cw, y, x + (i + 1) * cw, y + h, str[i] || '', 'center')}
          </React.Fragment>
        ))}
      </>
    );
  };

  const Logo = (x: number, y: number) => (
    <svg
      className={`absolute transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
      style={{ left: `${x}px`, top: `${y}px`, width: '38px', height: '38px' }}
      viewBox="0 0 40 40"
    >
      <circle cx="20" cy="20" r="20" fill="currentColor" />
      <circle cx="20" cy="15" r="6" fill="#fff" />
      <rect x="17.5" y="17" width="5" height="16" fill="#fff" />
    </svg>
  );

  const X_BOT = [485, 612, 700, 850, 940, 1075, 1150, 1240, 1545];

  return (
    <div
      id="sbi-draft-slip-canvas"
      className="relative bg-white text-black select-none shrink-0"
      style={{
        width: '1568px',
        height: '680px',
        fontFamily: '"Noto Sans Devanagari", Arial, Helvetica, sans-serif',
        fontSize: '14px',
      }}
    >
      {/* ============================================================== */}
      {/* LEFT STUB (Customer Counterfoil: x: 85 to 408, y: 22 to 618)   */}
      {/* ============================================================== */}
      {Bx(85, 22, 408, 618)}

      {/* 1. Header & Branch */}
      {SC(246, 42, 'भारतीय स्टेट बैंक', { fontSize: '15px' })}
      {SC(246, 64, <b>STATE BANK OF INDIA</b>, { font: '700 16px Arial' })}

      {FieldBox(92, 80, 280, 106, data.branch, 'left', { fontSize: '13px' })}
      {S(286, 93, 'शाखा/BRANCH', { fontSize: '12px', fontWeight: 600 })}

      {/* Date with 8 boxed cells */}
      {S(92, 127, 'दिनांक/DATE', { fontSize: '12px', fontWeight: 600 })}
      {Cells(184, 114, 216, 26, 8, date8)}
      {Ln(85, 408, 146)}

      {/* 2. Name of Applicant */}
      {S(92, 158, 'आवेदक का नाम/Name of Applicant', { fontSize: '12px', fontWeight: 600 })}
      {FieldBox(92, 172, 400, 204, data.applicantName, 'left', { fontSize: '14px' })}
      {Ln(85, 408, 214)}

      {/* 3. In Favour of & Payable at Branch */}
      {S(92, 226, 'नामे में/In Favour of', { fontSize: '12px', fontWeight: 600 })}
      {FieldBox(92, 238, 400, 268, data.inFavourOf, 'left', { fontSize: '13px' })}
      {S(92, 280, 'शाखा पर देय/Payable at (Branch)', { fontSize: '12px', fontWeight: 600 })}
      {FieldBox(92, 292, 400, 318, data.payableAt, 'left', { fontSize: '13px' })}
      {Ln(85, 408, 326)}

      {/* 4. Total Amount in words */}
      {S(92, 338, 'कुल राशि (शब्दों में)/TOTAL AMOUNT (in words)', { fontSize: '12px', fontWeight: 600 })}
      <div
        className={`absolute flex flex-col justify-center overflow-hidden rounded-xs z-10 ${
          isDataOnly ? 'bg-transparent' : 'bg-[#F4F7FB]'
        }`}
        style={{ left: '92px', top: '348px', width: '308px', height: '38px', padding: '0 8px' }}
      >
        {stubTotalWords[0] && (
          <span className="font-bold text-gray-950 font-sans text-[11px] leading-tight truncate">
            {stubTotalWords[0]}
          </span>
        )}
        {stubTotalWords[1] && (
          <span className="font-bold text-gray-950 font-sans text-[11px] leading-tight truncate">
            {stubTotalWords[1]}
          </span>
        )}
      </div>
      {Ln(85, 408, 395)}

      {/* 5. Amounts Table (y: 395 to 528) */}
      <div
        className={`absolute transition-opacity ${
          isDataOnly ? 'border-transparent' : 'border-r border-black'
        }`}
        style={{ left: '205px', top: '395px', width: 0, height: '133px' }}
      />
      <div
        className={`absolute transition-opacity ${
          isDataOnly ? 'border-transparent' : 'border-r border-black'
        }`}
        style={{ left: '345px', top: '395px', width: 0, height: '133px' }}
      />

      {/* Header Row */}
      {SC(275, 410, 'रु०/Rs.', { fontSize: '12.5px', fontWeight: 600 })}
      {SC(376, 410, 'पै०/P.', { fontSize: '12.5px', fontWeight: 600 })}
      {Ln(85, 408, 425)}

      {/* Row 1: Draft / Banker's Cheque Amount */}
      {S(90, 434, 'ड्राफ्ट/', { fontSize: '11px', lineHeight: '1.1' })}
      {S(90, 446, 'बैंक चैक/राशि', { fontSize: '11px', lineHeight: '1.1' })}
      {S(90, 458, <b>Dft. B.C. Amt.</b>, { fontSize: '11px', lineHeight: '1.1' })}
      {FieldBox(206, 426, 344, 464, numAmt > 0 ? formatINR(Math.floor(numAmt)) : '', 'right', { fontSize: '14px' })}
      {FieldBox(346, 426, 407, 464, numAmt > 0 ? String(Math.round((numAmt - Math.floor(numAmt)) * 100)).padStart(2, '0') : '', 'center', { fontSize: '13px' })}
      {Ln(85, 408, 465)}

      {/* Row 2: Exchange / Commission */}
      {S(90, 480, 'विनिमय/Exchange', { fontSize: '12px' })}
      {FieldBox(206, 466, 344, 494, numExch > 0 ? formatINR(Math.floor(numExch)) : '', 'right', { fontSize: '14px' })}
      {FieldBox(346, 466, 407, 494, numExch > 0 ? String(Math.round((numExch - Math.floor(numExch)) * 100)).padStart(2, '0') : '', 'center', { fontSize: '13px' })}
      {Ln(85, 408, 495)}

      {/* Row 3: Total */}
      {S(90, 511, <b>योग/TOTAL</b>, { fontSize: '13px' })}
      {FieldBox(206, 496, 344, 527, totalForWords > 0 ? formatINR(Math.floor(totalForWords)) : '', 'right', { fontSize: '14px' })}
      {FieldBox(346, 496, 407, 527, totalForWords > 0 ? String(Math.round((totalForWords - Math.floor(totalForWords)) * 100)).padStart(2, '0') : '', 'center', { fontSize: '13px' })}
      {Ln(85, 408, 528)}

      {/* 6. Signature / Passing Box (y: 528 to 618) */}
      <div
        className={`absolute transition-opacity ${
          isDataOnly ? 'border-transparent' : 'border-r border-black'
        }`}
        style={{ left: '205px', top: '528px', width: 0, height: '90px' }}
      />
      {S(92, 550, 'रोकड़िया', { fontSize: '13px' })}
      {S(92, 572, <b>Cashier</b>, { fontSize: '13px' })}
      {SC(306, 550, 'रोकड़ अधिकारी /', { fontSize: '12.5px' })}
      {SC(306, 570, 'पासकर्ता अधिकारी', { fontSize: '12.5px' })}
      {SC(306, 594, <b>Cash/Passing Officer</b>, { fontSize: '13px' })}

      {/* Form caption */}
      {S(85, 634, "State Bank of India | Draft / Banker's Cheque Application Form", { fontSize: '12px', color: '#374151', fontStyle: 'italic' })}

      <div
        className={`absolute font-bold text-[19px] tracking-[1px] transition-opacity ${
          isDataOnly ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ left: '40px', top: '320px', transform: 'translate(-50%,-50%) rotate(-90deg)' }}
      >
        DONATE BLOOD – SAVE LIFE
      </div>

      {/* ============================================================== */}
      {/* RIGHT FORM (Bank Main Copy: x: 485 to 1545, y: 28 to 618)      */}
      {/* ============================================================== */}
      {Bx(485, 28, 1545, 618)}

      {Logo(497, 50)}
      {SC(645, 50, 'भारतीय स्टेट बैंक', { fontSize: '15px' })}
      {SC(645, 75, <b>STATE BANK OF INDIA</b>, { font: '700 16px Arial' })}
      {Bx(485, 28, 770, 155)}
      {Ln(530, 640, 135)}
      {S(642, 132, 'शाखा /BRANCH')}
      {DB(528, 114, 640, 134, data.branch, 'left', { fontSize: '13px' })}

      {S(780, 60, 'ड्राफ्ट / चेक आवेदन पत्र', { fontSize: '15px' })}
      {S(780, 86, <b>Draft/Banker's Cheque Application Form</b>, { font: '700 14px Arial' })}

      {Cells(1158, 50, 367, 26, 13, datePadded)}

      {S(780, 118, 'कृपया जारी करें')}
      {S(780, 140, 'Please issue')}
      {Bx(890, 124, 942, 150)}
      {data.issueType === 'dd' && DB(890, 124, 942, 150, '✓', 'center', { fontSize: '18px' })}
      {S(955, 126, 'ड्राफ्ट')}
      {S(955, 144, 'Draft')}

      {Bx(1065, 124, 1117, 150)}
      {data.issueType === 'bc' && DB(1065, 124, 1117, 150, '✓', 'center', { fontSize: '18px' })}
      {S(1134, 126, 'बैंकर चैक')}
      {S(1128, 146, "Banker's Cheque")}
      {Ln(1285, 1425, 147)}
      {Ln(1450, 1520, 147)}
      {Ln(770, 1545, 155)}

      {/* Particulars (Cash notes breakdown: x: 485 to 770) */}
      {Bx(485, 155, 622, 205)}
      {S(493, 172, 'विवरण')}
      {S(493, 193, 'PARTICULARS')}
      {Bx(622, 155, 705, 205)}
      {SC(663, 180, 'रु० /Rs.')}
      {Bx(705, 155, 770, 205)}
      {SC(738, 180, 'पै० /P.')}

      {DD_DENOMS.map((d, i) => {
        const y = 205 + 35 * i;
        const c = typeof data.denominations[d] === 'number' ? Number(data.denominations[d]) : 0;
        return (
          <React.Fragment key={d}>
            {Bx(485, y, 622, y + 35)}
            {SC(553, y + 18, `X ${d}`, { fontSize: '16px' })}
            {Bx(622, y, 770, y + 35)}
            {c > 0 && DB(622, y, 705, y + 35, formatINR(c), 'right')}
            {c > 0 && DB(705, y, 770, y + 35, '00', 'center')}
            {Bx(705, y, 770, y + 35)}
          </React.Fragment>
        );
      })}

      {Bx(485, 485, 622, 518)}
      {S(493, 501, 'PARTITION NO.', { fontSize: '12px', fontWeight: 700 })}
      {Bx(622, 485, 705, 518)}
      {Bx(705, 485, 770, 518)}
      {totalCash > 0 && DB(622, 485, 705, 518, formatINR(totalCash), 'right')}
      {totalCash > 0 && DB(705, 485, 770, 518, '00', 'center')}

      {/* Middle: Beneficiary, Amount in words, Branch, Code No. */}
      {Bx(770, 155, 1215, 272)}
      {S(778, 172, 'नाम में /In Favour of')}
      {Dt(790, 212, favourWrapped[0], { fontSize: '16px' })}
      {Dt(790, 240, favourWrapped[1], { fontSize: '16px' })}

      {Bx(770, 272, 1215, 350)}
      {S(778, 288, 'रुपये /For Rupees')}
      {Dt(790, 316, formWords[0], { fontSize: '14px' })}
      {Dt(790, 338, formWords[1], { fontSize: '14px' })}

      {Bx(770, 350, 1215, 385)}
      {S(778, 366, 'शाखा पर देय /Payable at (Branch)')}
      {Dt(1005, 366, data.payableAt, { fontSize: '14px' })}

      {Bx(770, 385, 1215, 420)}
      {S(930, 404, 'कूट सं० /Code No.')}
      {Cells(1075, 385, 140, 35, 5, data.codeNo || '')}

      {Bx(770, 420, 1075, 485)}
      {S(778, 440, 'आवेदक के हस्ताक्षर')}
      {S(778, 466, 'Signature of Applicant')}

      {Bx(770, 485, 1075, 518)}
      {S(778, 501, 'PARTITION NO.')}

      {/* Right Amounts Box (x: 1215 to 1545) */}
      {Bx(1215, 155, 1335, 305)}
      {S(1228, 190, 'ड्राफ्ट/')}
      {S(1228, 214, 'बैंक चेक/राशि')}
      {S(1228, 240, 'DFT./')}
      {S(1228, 262, 'B.C. Amt.')}

      {Bx(1335, 155, 1480, 195)}
      {SC(1408, 175, 'रु० /Rs.')}
      {Bx(1480, 155, 1545, 195)}
      {SC(1512, 175, 'पै० /P.')}

      {amtCells(1335, 1480, 1545, 195, 305, numAmt)}

      {Bx(1215, 305, 1335, 350)}
      {S(1228, 320, 'विनिमय /')}
      {S(1228, 340, 'Exchange')}
      {amtCells(1335, 1480, 1545, 305, 350, numExch)}

      {Bx(1215, 350, 1335, 420)}
      {S(1228, 372, 'योग /')}
      {S(1228, 394, 'TOTAL')}
      {amtCells(1335, 1480, 1545, 350, 420, grandTotal)}

      {/* Applicant name & address */}
      {Bx(1075, 420, 1545, 518)}
      {S(1083, 437, 'आवेदक का नाम व पता /')}
      {S(1083, 460, 'NAME AND ADDRESS OF APPLICANT/CUSTOMER NO.', { font: '13.5px Arial' })}
      {Dt(1090, 488, addrWrapped[0], { fontSize: '14px' })}
      {Dt(1090, 508, addrWrapped[1], { fontSize: '14px' })}

      {/* Bottom Processing Strip (8 Boxes) */}
      {X_BOT.slice(0, 8).map((xVal, i) => (
        <React.Fragment key={i}>
          {Bx(xVal, 518, X_BOT[i + 1], 615)}
        </React.Fragment>
      ))}

      {SC(548, 537, 'रोकड़िया/अंतरण', { fontSize: '13px' })}
      {SC(548, 555, 'सारणी क्र०', { fontSize: '13px' })}
      {SC(548, 574, "Cashier's/Transfer", { font: '12.5px Arial' })}
      {SC(548, 590, 'Scroll No.', { font: '12.5px Arial' })}

      {SC(656, 538, 'रोकड़िया', { fontSize: '13px' })}
      {SC(656, 566, 'Cashier', { font: '13.5px Arial' })}

      {SC(775, 538, 'रोकड़ अधिकारी/', { fontSize: '13px' })}
      {SC(775, 556, 'पासकर्ता अधिकारी', { fontSize: '13px' })}
      {SC(775, 576, 'Cash/Passing Officer', { font: '12px Arial' })}

      {SC(895, 538, 'सूची बही', { fontSize: '13px' })}
      {SC(895, 566, 'Jotting Book', { font: '13.5px Arial' })}

      {SC(1007, 538, 'ड्रा०/बैंक चैक सं.', { fontSize: '13px' })}
      {SC(1007, 566, 'Dft./B.C. No', { font: '13.5px Arial' })}

      {SC(1112, 538, 'जांचकर्ता', { fontSize: '13px' })}
      {SC(1112, 566, 'Checked', { font: '13.5px Arial' })}
      {SC(1195, 538, 'हस्ताक्षर', { fontSize: '13px' })}
      {SC(1195, 566, 'Signed', { font: '13.5px Arial' })}

      {S(1246, 538, 'ड्रा०/बैंक चैक प्राप्त किया/Received the Dft./B.C.', { fontSize: '12.5px' })}
      {S(1396, 598, 'आवेदक / Applicant', { fontSize: '14px' })}

      <div
        className={`absolute font-sans text-[12px] transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
        style={{ left: '485px', top: '640px' }}
      >
        C.S.D. FBD, 3545/3-6-03/30,000 Pads/NDP &nbsp; CC No.-5003234
      </div>
    </div>
  );
};
