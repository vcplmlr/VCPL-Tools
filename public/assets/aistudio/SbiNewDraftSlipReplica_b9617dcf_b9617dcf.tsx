/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DemandDraftFormData, RenderMode, DdDenom } from '../types';
import { words, twoDigits, wrapWords } from '../utils/numberToWords';

interface SbiNewDraftSlipReplicaProps {
  data: DemandDraftFormData;
  mode: RenderMode;
}

const DD_DENOMS: DdDenom[] = [500, 100, 50, 20, 10, 5, 2, 1];

export const SbiNewDraftSlipReplica: React.FC<SbiNewDraftSlipReplicaProps> = ({ data, mode }) => {
  const isDataOnly = mode === 'data';

  const numAmt = typeof data.draftAmt === 'number' ? data.draftAmt : parseFloat(String(data.draftAmt)) || 0;
  const numExch = typeof data.exchangeAmt === 'number' ? data.exchangeAmt : parseFloat(String(data.exchangeAmt)) || 0;
  const grandTotal = numAmt + numExch;

  // Words
  const whole = Math.floor(numAmt);
  const paise = Math.round((numAmt - whole) * 100);
  const wordsText = numAmt > 0
    ? `Rupees ${words(whole) || 'Zero'}${paise ? ' and ' + twoDigits(paise) + ' Paise' : ''} Only`
    : '';

  const totalForWords = grandTotal > 0 ? grandTotal : numAmt;
  const wholeTotal = Math.floor(totalForWords);
  const paiseTotal = Math.round((totalForWords - wholeTotal) * 100);
  const totalWordsText = totalForWords > 0
    ? `Rupees ${words(wholeTotal) || 'Zero'}${paiseTotal ? ' and ' + twoDigits(paiseTotal) + ' Paise' : ''} Only`
    : '';

  const stubWords = wrapWords(wordsText, 38);
  const formWords = wrapWords(wordsText, 58);
  const favourWrapped = wrapWords(data.inFavourOf || '', 55);
  const addrCombined = data.applicantAddr
    ? `${data.applicantName}${data.applicantName && data.applicantAddr ? ', ' : ''}${data.applicantAddr}`
    : data.applicantName || '';
  const addrWrapped = wrapWords(addrCombined, 55);

  // Date parsing
  const [yStr, mStr, dStr] = data.date ? data.date.split('-') : ['', '', ''];
  const formattedDate = dStr ? `${dStr}/${mStr}/${yStr}` : '';
  const date8 = (dStr || '').padStart(2, ' ') + (mStr || '').padStart(2, ' ') + (yStr || '').padStart(4, ' ');

  // PAN, Mobile, Code
  const panChars = (data.pan || '').toUpperCase().padEnd(10, ' ').slice(0, 10).split('');
  const mobileChars = (data.mobile || '').replace(/\D/g, '').padEnd(10, ' ').slice(0, 10).split('');
  const codeChars = (data.codeNo || '').padStart(5, ' ').slice(0, 5).split('');

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

  const Ln = (x1: number, x2: number, y: number, dashed = false) => (
    <div
      className={`absolute transition-opacity ${
        isDataOnly ? 'border-transparent' : dashed ? 'border-t border-dashed border-slate-600' : 'border-t border-black'
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
        isDataOnly ? 'bg-transparent' : 'bg-[#F2F6FA]'
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
      {DB(x1, y1, xm, y2, v > 0 ? Math.floor(v).toLocaleString('en-IN') : '', 'right', {
        fontFamily: 'monospace',
        fontSize: '13px',
      })}
      {DB(xm, y1, x2, y2, v > 0 ? twoDigits(Math.round((v - Math.floor(v)) * 100)) : '', 'center', {
        fontFamily: 'monospace',
        fontSize: '13px',
      })}
    </>
  );

  const BoxCells = (x: number, y: number, w: number, h: number, n: number, str: string[]) => {
    const cw = w / n;
    return (
      <>
        {Array.from({ length: n }).map((_, i) => (
          <React.Fragment key={i}>
            {Bx(x + i * cw, y, x + (i + 1) * cw, y + h)}
            {DB(x + i * cw, y, x + (i + 1) * cw, y + h, str[i] && str[i] !== ' ' ? str[i] : '', 'center', {
              fontFamily: 'monospace',
              fontSize: `${Math.round(h * 0.62)}px`,
            })}
          </React.Fragment>
        ))}
      </>
    );
  };

  const Logo = (x: number, y: number) => (
    <svg
      className={`absolute transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
      style={{ left: `${x}px`, top: `${y}px`, width: '36px', height: '36px' }}
      viewBox="0 0 40 40"
    >
      <circle cx="20" cy="20" r="20" fill="#0072BC" />
      <circle cx="20" cy="15" r="6" fill="#fff" />
      <rect x="17.5" y="17" width="5" height="16" fill="#fff" />
    </svg>
  );

  return (
    <div
      id="sbi-new-draft-slip-canvas"
      className="relative bg-white text-black select-none shrink-0"
      style={{
        width: '1568px',
        height: '610px',
        fontFamily: '"Noto Sans Kannada", "Noto Sans Devanagari", Arial, Helvetica, sans-serif',
        fontSize: '12px',
      }}
    >
      {/* Top Left Code Stamp */}
      {S(24, 11, <span className="font-mono text-[10px] font-bold text-slate-600">CODE 1170465/Keerthika</span>)}

      {/* ============================================================== */}
      {/* 1. LEFT STUB (Customer Counterfoil: x: 20 to 425, y: 20 to 590)*/}
      {/* ============================================================== */}
      {Bx(20, 20, 425, 590)}

      {/* Stub Header: Pay-in slip */}
      {SC(222, 36, 'ಜಮಾ ಚೀಟಿ / जमापर्ची / PAY-IN-SLIP', { fontSize: '11px', fontWeight: 700 })}
      {SC(222, 51, 'ನಗದು / ವರ್ಗಾವಣೆ / नकद / अंतरण / CASH / TRANSFER', { fontSize: '10px', fontWeight: 600 })}
      {SC(222, 68, 'ಭಾರತೀಯ ಸ್ಟೇಟ್ ಬ್ಯಾಂಕ್ / भारतीय स्टेट बैंक', { fontSize: '12px', fontWeight: 700 })}
      {SC(222, 85, <b>STATE BANK OF INDIA</b>, { font: '700 13px Arial', letterSpacing: '0.5px' })}

      {/* Stub Branch line */}
      {S(28, 104, 'ಶಾಖೆ / शाखा / Branch :')}
      {Ln(165, 417, 112)}
      {FieldBox(167, 95, 415, 111, data.branch)}

      {/* Stub Application for DD Title */}
      {Ln(20, 425, 119)}
      {SC(222, 131, 'ಡ್ರಾಫ್ಟ್ ಮತ್ತು ಬ್ಯಾಂಕರ್ಸ್ ಚೆಕ್ಕುಗಳಿಗೆ ಅರ್ಜಿ', { fontSize: '10.5px', fontWeight: 600 })}
      {SC(222, 145, 'ड्राफ्ट / बैंकर चेकों के लिए आवेदन', { fontSize: '10.5px', fontWeight: 600 })}
      {SC(222, 159, <b>APPLICATION FOR DRAFT / BANKER'S CHEQUE</b>, { fontSize: '10px', fontWeight: 700 })}
      {Ln(20, 425, 169)}

      {/* Stub Date */}
      {S(28, 183, 'ದಿನಾಂಕ / दिनांक / Date :')}
      {Ln(175, 417, 191)}
      {FieldBox(177, 174, 415, 190, formattedDate, 'center', { fontFamily: 'monospace', fontWeight: 700 })}

      {/* Stub Applicant Name */}
      {S(28, 205, "ಅರ್ಜಿದಾರರ ಹೆಸರು / आवेदक का नाम / Applicant's Name :")}
      {Ln(28, 417, 230)}
      {FieldBox(30, 213, 415, 229, data.applicantName)}

      {/* Stub Issue in favour of */}
      {S(28, 245, 'ದಯವಿಟ್ಟು ಡ್ರಾಫ್ಟ್ / BC ನೀಡಿ / Issue draft/BC in favour of :')}
      {Ln(28, 417, 270)}
      {FieldBox(30, 253, 415, 269, favourWrapped[0] || '')}

      {/* Stub Drawn on */}
      {S(28, 285, 'ಗ್ರಾಹಕರ ಬ್ಯಾಂಕ್ / अदाकर्ता / Drawn on :')}
      {Ln(205, 417, 293)}
      {FieldBox(207, 276, 415, 292, data.drawnOn || data.payableAt)}

      {/* Stub Amount in words */}
      {S(28, 307, 'ರೂ. (ಅಕ್ಷರಗಳಲ್ಲಿ) / रुपए (शब्दों में) / Amount in words :')}
      {Ln(28, 417, 332)}
      {FieldBox(30, 315, 415, 331, stubWords[0] || '')}

      {/* Stub Amounts Table (x: 28 to 417, y: 342 to 470) */}
      {Bx(28, 342, 417, 470)}
      {Ln(28, 417, 370)}
      {/* Table vertical lines */}
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '260px', top: '342px', width: 0, height: '128px' }}
      />
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '370px', top: '342px', width: 0, height: '128px' }}
      />

      {SC(144, 356, <span className="text-[10px] font-bold">DRAFT / BC FOR</span>)}
      {SC(315, 356, <span className="text-[10.5px] font-bold">ರೂ. / Rs.</span>)}
      {SC(393, 356, <span className="text-[10.5px] font-bold">ಪೈ. / P.</span>)}

      {/* Row 1: Draft Amount */}
      {Ln(28, 417, 403)}
      {S(34, 386, <span className="text-[10.5px]">ಡ್ರಾಫ್ಟ್/ಬ್ಯಾಂಕರ್ ಚೆಕ್ / DFT. B.C.</span>)}
      {amtCells(260, 370, 417, 370, 403, numAmt)}

      {/* Row 2: Exchange */}
      {Ln(28, 417, 436)}
      {S(34, 420, <span className="text-[10.5px]">ವಿನಿಮಯ / EXCHANGE</span>)}
      {amtCells(260, 370, 417, 403, 436, numExch)}

      {/* Row 3: Total */}
      {S(34, 453, <span className="text-[10.5px] font-bold">ಒಟ್ಟು / योग / TOTAL</span>)}
      {amtCells(260, 370, 417, 436, 470, grandTotal)}

      {/* Stub Bottom Office Use Box */}
      {Bx(28, 480, 417, 578)}
      {Ln(28, 417, 502)}
      {SC(222, 491, 'ಕಛೇರಿಯ ಉಪಯೋಗಕ್ಕಾಗಿ / कार्यालय उपयोग हेतु / FOR OFFICE USE', { fontSize: '9.5px', fontWeight: 700 })}
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '222px', top: '502px', width: 0, height: '76px' }}
      />
      {SC(125, 520, 'ಗ್ರಹಕ ವ್ಯವಹಾರಗಳಾಧಿಕಾರಿ', { fontSize: '9.5px' })}
      {SC(125, 537, 'SWO', { fontSize: '10.5px', fontWeight: 700 })}

      {SC(320, 520, 'ರೊಕ್ಕದ ಅಧಿಕಾರಿ / पासकर्ता अधिकारी', { fontSize: '9.5px' })}
      {SC(320, 537, 'Cash / Passing Officer', { fontSize: '10px', fontWeight: 700 })}


      {/* ============================================================== */}
      {/* 2. RIGHT MAIN FORM (Bank Copy: x: 440 to 1548, y: 20 to 590)  */}
      {/* ============================================================== */}
      {Bx(440, 20, 1548, 590)}

      {/* Logo */}
      {Logo(455, 30)}

      {/* Header Titles */}
      {SC(980, 36, 'ಜಮಾ ಚೀಟಿ / जमापर्ची / PAY-IN-SLIP', { fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px' })}
      {SC(980, 54, 'ಭಾರತೀಯ ಸ್ಟೇಟ್ ಬ್ಯಾಂಕ್ / भारतीय स्टेट बैंक / STATE BANK OF INDIA', { fontSize: '13.5px', fontWeight: 700 })}

      {/* Cash / Transfer top right */}
      {S(1370, 34, 'CASH / TRANSFER', { fontSize: '11.5px', fontWeight: 700 })}
      {S(1370, 50, 'ನಗದು / ವರ್ಗಾವಣೆ / नकद / अंतरण', { fontSize: '10px' })}

      {/* Branch line & Date boxes */}
      {S(455, 79, 'ಶಾಖೆ / शाखा / Branch :')}
      {Ln(585, 1110, 87)}
      {FieldBox(587, 70, 1108, 86, data.branch)}

      {S(1130, 79, 'ದಿನಾಂಕ / दिनांक / Date :')}
      {BoxCells(1270, 66, 260, 26, 8, date8.split(''))}

      {/* Application Title Strip */}
      {Ln(440, 1548, 98)}
      {SC(990, 110, 'ಡ್ರಾಫ್ಟ್ ಮತ್ತು ಬ್ಯಾಂಕರ್ಸ್ ಚೆಕ್ಕುಗಳಿಗೆ ಅರ್ಜಿ / ड्राफ्ट / बैंकर चेकों के लिए आवेदन / APPLICATION FOR DRAFT / BANKER\'S CHEQUE', {
        fontSize: '11px',
        fontWeight: 700,
      })}
      {Ln(440, 1548, 122)}

      {/* Issue Selection */}
      <div className="absolute flex items-center gap-6" style={{ left: '455px', top: '129px' }}>
        <span className="font-bold text-xs select-none">
          ದಯವಿಟ್ಟು ಕೊಡಿ : ಡ್ರಾಫ್ಟ್ / ಬ್ಯಾಂಕರ್ಸ್ ಚೆಕ್ &bull; कृपया जारी करें : ड्राफ्ट / बैंकर चेक &bull; PLEASE ISSUE :
        </span>
        <label className="flex items-center gap-1.5 font-bold text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={data.issueType === 'dd'}
            readOnly
            className="w-4 h-4 rounded text-blue-600"
          />
          <span>DRAFT (ಡ್ರಾಫ್ಟ್)</span>
        </label>
        <label className="flex items-center gap-1.5 font-bold text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={data.issueType === 'bc'}
            readOnly
            className="w-4 h-4 rounded text-blue-600"
          />
          <span>BANKER'S CHEQUE (ಬ್ಯಾಂಕರ್ಸ್ ಚೆಕ್)</span>
        </label>
      </div>

      {/* Overleaf notice strip */}
      {Ln(440, 1548, 151)}
      {SC(994, 161, 'ಸೂಚನೆ : ಜಮಾ ಮಾಡಿದ ನಗದಿನ / ಚೆಕ್ಕುಗಳ ವಿವರಗಳನ್ನು ಹಿಂಬದಿಯಲ್ಲಿ ನೀಡಲು ಕೋರಿದೆ / NOTE : Please furnish details of CASH / CHEQUES deposited overleaf', {
        fontSize: '10.5px',
        fontWeight: 600,
      })}
      {Ln(440, 1548, 172)}

      {/* ============================================================== */}
      {/* Main Details: In Favour Of, Amount in Words, Branch, Code No   */}
      {/* Left side: x: 455 to 1135 | Right side: Table x: 1150 to 1530  */}
      {/* ============================================================== */}

      {/* 1. In Favour Of (Block Letters) */}
      {S(455, 186, 'ಇವರ ಹೆಸರಿಗೆ (ದೊಡ್ಡ ಅಕ್ಷರಗಳಲ್ಲಿ) / पानेवाले का नाम (स्पष्ट अक्षरों में) / IN FAVOUR OF (IN BLOCK LETTERS) :')}
      {Ln(455, 1135, 218, true)}
      {FieldBox(455, 196, 1135, 218, (data.inFavourOf || '').toUpperCase(), 'left', {
        fontSize: '14px',
        fontWeight: 700,
        letterSpacing: '0.8px',
      })}

      {/* 2. Amount in Words */}
      {S(455, 234, 'ರೂ. (ಅಕ್ಷರಗಳಲ್ಲಿ) / रुपए (शब्दों में) / Amount in words :')}
      {Ln(455, 1135, 266, true)}
      {FieldBox(455, 244, 1135, 266, formWords[0] || '', 'left', { fontSize: '12.5px' })}

      {/* 3. Payable at Branch & Code No */}
      {S(455, 286, 'ಪಾವತಿ ಶಾಖೆ / अदाकर्ता शाखा / PAYABLE AT BRANCH :')}
      {Ln(695, 935, 294)}
      {FieldBox(697, 276, 933, 293, data.payableAt)}

      {S(950, 286, 'ಕೋಡ್ ನಂ. / CODE NO. :')}
      {BoxCells(1065, 272, 70, 24, 5, codeChars)}

      {/* Right Amounts Table (x: 1150 to 1530, y: 178 to 318) */}
      {Bx(1150, 178, 1530, 318)}
      {Ln(1150, 1530, 210)}
      {/* Table vertical lines */}
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '1370px', top: '178px', width: 0, height: '140px' }}
      />
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '1475px', top: '178px', width: 0, height: '140px' }}
      />

      {SC(1260, 194, <span className="text-[11px] font-bold">DRAFT / BC FOR</span>)}
      {SC(1422, 194, <span className="text-[11px] font-bold">ರೂ. / Rs.</span>)}
      {SC(1502, 194, <span className="text-[11px] font-bold">ಪೈ. / P.</span>)}

      {/* Row 1: Draft Amount */}
      {Ln(1150, 1530, 246)}
      {S(1158, 228, <span className="text-[11px]">ಡ್ರಾಫ್ಟ್/ಬ್ಯಾಂಕರ್ ಚೆಕ್ / DFT. B.C.</span>)}
      {amtCells(1370, 1475, 1530, 210, 246, numAmt)}

      {/* Row 2: Exchange */}
      {Ln(1150, 1530, 282)}
      {S(1158, 264, <span className="text-[11px]">ವಿನಿಮಯ / EXCHANGE</span>)}
      {amtCells(1370, 1475, 1530, 246, 282, numExch)}

      {/* Row 3: Total */}
      {S(1158, 300, <span className="text-[11px] font-bold">ಒಟ್ಟು / योग / TOTAL</span>)}
      {amtCells(1370, 1475, 1530, 282, 318, grandTotal)}

      {/* Horizontal divider below details */}
      {Ln(440, 1548, 326)}

      {/* ============================================================== */}
      {/* PAN, Signature, Applicant Info, Mobile                         */}
      {/* Left side: PAN & Signature | Right side: Name/Address & Mobile */}
      {/* ============================================================== */}

      {/* Left side: PAN */}
      {S(455, 344, 'ಪ್ಯಾನ್ ಸಂಖ್ಯೆ / पैन नम्बर / PAN NUMBER :')}
      {BoxCells(655, 331, 265, 25, 10, panChars)}

      {/* Left side: Applicant Signature */}
      {S(455, 386, 'ಅರ್ಜಿದಾರರ ಸಹಿ / आवेदक के हस्ताक्षर')}
      {S(455, 402, 'Signature of the Applicant')}
      {Ln(455, 920, 426, true)}

      {/* Right side: Name & Address */}
      {S(945, 344, 'ಅರ್ಜಿದಾರರ ಹೆಸರು ಮತ್ತು ವಿಳಾಸ / NAME & Address of Applicant :')}
      {Ln(945, 1530, 368)}
      {FieldBox(947, 353, 1528, 368, addrWrapped[0] || '')}
      {addrWrapped[1] && (
        <>
          {Ln(945, 1530, 390)}
          {FieldBox(947, 375, 1528, 390, addrWrapped[1])}
        </>
      )}

      {/* Right side: Mobile */}
      {S(945, 412, 'ಮೊಬೈಲ್ / ಟೆಲಿಫೋನ್ ನಂ. / MOBILE / TEL NO. :')}
      {BoxCells(1260, 400, 270, 24, 10, mobileChars)}

      {/* ============================================================== */}
      {/* Bottom Section: FOR OFFICE USE strip (x: 450 to 1530, y: 440 to 578)*/}
      {/* ============================================================== */}
      {Bx(450, 440, 1530, 578)}
      {Ln(450, 1530, 464)}
      {SC(990, 452, 'ಕಛೇರಿಯ ಉಪಯೋಗಕ್ಕಾಗಿ / कार्यालय उपयोग हेतु / FOR OFFICE USE', {
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.5px',
      })}

      {/* Column vertical dividers */}
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '620px', top: '464px', width: 0, height: '114px' }}
      />
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '810px', top: '464px', width: 0, height: '114px' }}
      />
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '980px', top: '464px', width: 0, height: '114px' }}
      />
      <div
        className={`absolute ${isDataOnly ? 'border-transparent' : 'border-r border-black'}`}
        style={{ left: '1220px', top: '464px', width: 0, height: '114px' }}
      />

      {/* Col 1: Journal No */}
      {SC(535, 482, 'ಜರ್ನಲ್ ನಂ.', { fontSize: '10px' })}
      {SC(535, 498, 'JOURNAL NO', { fontSize: '11px', fontWeight: 600 })}

      {/* Col 2: DFT / BC No */}
      {SC(715, 482, 'DFT / B.C. NO.', { fontSize: '11px', fontWeight: 700 })}
      {SC(715, 498, 'ಡ್ರಾಫ್ಟ್ / ಬ್ಯಾಂ.ಚೆ. ಸಂಖ್ಯೆ', { fontSize: '10px' })}

      {/* Col 3: SWO */}
      {SC(895, 482, 'ಗ್ರಹಕ ವ್ಯವಹಾರಗಳಾಧಿಕಾರಿ', { fontSize: '10px' })}
      {SC(895, 498, 'SWO', { fontSize: '11.5px', fontWeight: 700 })}

      {/* Col 4: Cash / Passing Officer */}
      {SC(1100, 482, 'ರೊಕ್ಕದ ಅಧಿಕಾರಿ / पासकर्ता अधिकारी', { fontSize: '10px' })}
      {SC(1100, 498, 'Cash / Passing Officer', { fontSize: '10.5px', fontWeight: 700 })}

      {/* Col 5: Received Draft / BC */}
      {SC(1375, 480, "Received the Draft / Banker's Cheque", { fontSize: '10.5px', fontWeight: 700 })}
      {SC(1375, 496, 'ಡ್ರಾಫ್ಟ್ / ಬ್ಯಾಂಕರ್ಸ್ ಚೆಕ್ ಸ್ವೀಕರಿಸಿದೆ', { fontSize: '10px' })}
      {Ln(1235, 1515, 552, true)}
      {SC(1375, 564, 'SIGNATURE OF APPLICANT', { fontSize: '9.5px', fontWeight: 700 })}
    </div>
  );
};
