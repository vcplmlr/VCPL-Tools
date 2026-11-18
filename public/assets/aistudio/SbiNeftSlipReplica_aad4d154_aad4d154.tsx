/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NeftRtgsFormData, RenderMode } from '../types';
import { wordsCurrency, formatINR } from '../utils/numberToWords';

interface SbiNeftSlipReplicaProps {
  data: NeftRtgsFormData;
  mode: RenderMode;
}

export const SbiNeftSlipReplica: React.FC<SbiNeftSlipReplicaProps> = ({ data, mode }) => {
  const isDataOnly = mode === 'data';

  const numAmt = typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount)) || 0;
  const numChg = typeof data.charges === 'number' ? data.charges : parseFloat(String(data.charges)) || 0;
  const grandTotal = numAmt + numChg;

  const wordsAmount = wordsCurrency(numAmt);
  const wordsTotal = wordsCurrency(grandTotal);

  // Dates
  const [yStr, mStr, dStr] = data.date ? data.date.split('-') : ['', '', ''];
  const formattedDate = dStr ? `${dStr}/${mStr}/${yStr}` : '';

  const [cyStr, cmStr, cdStr] = data.chqDate ? data.chqDate.split('-') : ['', '', ''];
  const formattedChqDate = cdStr ? `${cdStr}/${cmStr}/${cyStr}` : '';

  const isRtgs = data.transferType === 'rtgs';
  const isCheque = data.mode2 === 'chq';
  const ifscUpper = (data.ifsc || '').toUpperCase();

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

  const R = (y1: number, y2: number, xs: number[]) => (
    <>
      {xs.slice(0, xs.length - 1).map((xVal, i) => (
        <React.Fragment key={i}>
          {Bx(xVal, y1, xs[i + 1], y2)}
        </React.Fragment>
      ))}
    </>
  );

  const DB = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    val: React.ReactNode,
    al: 'left' | 'center' | 'right' = 'left',
    style: React.CSSProperties = {}
  ) => {
    if (val === '' || val === undefined || val === null) return null;
    return (
      <div
        className="absolute font-bold text-gray-950 font-serif tracking-tight z-10 flex items-center overflow-hidden"
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

  const Cells = (x: number, y: number, w: number, h: number, n: number, str: string) => {
    const cw = w / n;
    return (
      <>
        {Array.from({ length: n }).map((_, i) => (
          <React.Fragment key={i}>
            {Bx(x + i * cw, y, x + (i + 1) * cw, y + h)}
            {DB(x + i * cw, y, x + (i + 1) * cw, y + h, (str[i] || '').trim(), 'center', { padding: 0 })}
          </React.Fragment>
        ))}
      </>
    );
  };

  const L = (x: number, y1: number, y2: number, t: React.ReactNode, s: React.CSSProperties = {}) =>
    S(x, (y1 + y2) / 2, t, s);

  const Logo = (x: number, y: number) => (
    <svg
      className={`absolute transition-opacity ${isDataOnly ? 'opacity-0' : 'opacity-100'}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: '96px',
        height: '34px',
        color: '#1f2f93',
        transform: 'translateY(-50%)',
      }}
      viewBox="0 0 112 40"
    >
      <circle cx="19" cy="21" r="17" fill="#17a3dc" />
      <circle cx="19" cy="16" r="5.5" fill="#fff" />
      <rect x="17" y="18" width="4" height="14" fill="#fff" />
      <text
        x="38"
        y="35"
        fontFamily="Arial Black, Arial, sans-serif"
        fontWeight="900"
        fontSize="38"
        fill="currentColor"
      >
        SBI
      </text>
    </svg>
  );

  const tick = (x1: number, y1: number, x2: number, y2: number, on: boolean) => (
    <>
      {Bx(x1, y1, x2, y2)}
      {on && DB(x1, y1, x2, y2, '✓', 'center', { fontSize: '20px', padding: 0 })}
    </>
  );

  return (
    <div
      id="sbi-neft-slip-canvas"
      className="relative bg-white text-black select-none shrink-0"
      style={{
        width: '1568px',
        height: '540px',
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '17px',
      }}
    >
      {/* ========================================================= */}
      {/* LEFT STUB (Customer Counterfoil: x: 79 to 455)            */}
      {/* ========================================================= */}
      {R(40, 76, [79, 455])}
      {Logo(86, 58)}
      {S(234, 58, <b>State Bank of India</b>, { fontSize: '21px' })}

      {R(76, 101, [79, 225, 285, 335, 455])}
      {DB(79, 76, 225, 101, data.branch, 'center')}
      {SC(255, 89, <b>Branch</b>, { fontSize: '13px' })}
      {SC(310, 89, <b>Date</b>, { fontSize: '13px' })}
      {DB(335, 76, 455, 101, formattedDate)}

      {R(101, 132, [79, 198, 228, 455])}
      {L(90, 101, 132, 'Received', { fontSize: '16px' })}
      {S(201, 117, '₹', { fontSize: '26px' })}
      {grandTotal > 0 && DB(228, 101, 455, 132, formatINR(grandTotal), 'right')}

      {R(132, 160, [79, 198, 455])}
      {L(90, 132, 160, 'From', { fontSize: '16px' })}
      {DB(198, 132, 455, 160, data.applicantName)}

      {R(160, 197, [79, 455])}
      {S(81, 172, 'For Remittance of NEFT/RTGS by way of (i) Transfer', { fontSize: '14px' })}
      {S(81, 188, '(only NEFT), (ii)Cheque (NEFT/RTGS) USING', { fontSize: '14px' })}

      {/* Cheque No */}
      {R(197, 220, [79, 226, 455])}
      {L(90, 197, 220, 'Cheque No.', { fontSize: '15px' })}
      {DB(226, 197, 455, 220, data.chqNo)}

      {/* Favouring */}
      {R(220, 247, [79, 226, 455])}
      {L(90, 220, 247, 'Favouring', { fontSize: '15px' })}
      {DB(226, 220, 455, 247, data.benName)}

      {/* A/C NO */}
      {R(247, 275, [79, 226, 455])}
      {L(90, 247, 275, 'A/C NO.', { fontSize: '15px' })}
      {DB(226, 247, 455, 275, data.benAcc)}

      {/* IFSC CODE */}
      {R(275, 302, [79, 226, 455])}
      {L(90, 275, 302, 'IFSC CODE', { fontSize: '15px' })}
      {DB(226, 275, 455, 302, ifscUpper)}

      {/* Beneficiary Bank & Branch */}
      {R(302, 342, [79, 226, 455])}
      {S(90, 316, 'Beneficiary Bank', { fontSize: '15px' })}
      {S(90, 332, '& Branch', { fontSize: '15px' })}
      {DB(226, 302, 455, 342, data.benBank)}

      {/* Amount, Charges & Total */}
      {R(342, 368, [79, 198, 226, 455])}
      {L(90, 342, 368, 'Amount', { fontSize: '15px' })}
      {S(207, 355, '₹', { fontSize: '24px' })}
      {numAmt > 0 && DB(226, 342, 455, 368, formatINR(numAmt), 'right')}

      {R(368, 394, [79, 198, 226, 455])}
      {L(90, 368, 394, 'Bank Charges', { fontSize: '15px' })}
      {S(207, 381, '₹', { fontSize: '24px' })}
      {numChg > 0 && DB(226, 368, 455, 394, formatINR(numChg), 'right')}

      {R(394, 422, [79, 198, 226, 455])}
      {L(90, 394, 422, 'Total', { fontSize: '15px' })}
      {S(207, 408, '₹', { fontSize: '24px' })}
      {grandTotal > 0 && DB(226, 394, 455, 422, formatINR(grandTotal), 'right')}

      {/* Rupees */}
      {R(422, 452, [79, 158, 455])}
      {L(90, 422, 452, '(Rupees', { fontSize: '15px' })}
      {DB(158, 422, 455, 452, wordsTotal, 'left', {
        whiteSpace: 'normal',
        lineHeight: '13px',
        fontSize: '11.5px',
        padding: '0 5px',
      })}

      {/* For office use */}
      {R(452, 470, [79, 455])}
      {L(82, 452, 470, 'For office Use', { fontSize: '15px' })}

      {R(470, 505, [79, 267, 455])}
      {S(90, 482, 'UTR No.', { fontSize: '15px' })}
      {S(345, 495, 'Branch Manager', { fontSize: '15px' })}

      {/* ========================================================= */}
      {/* RIGHT MAIN APPLICATION FORM (x: 488 to 1502)             */}
      {/* ========================================================= */}
      {R(41, 80, [488, 790, 1265, 1337, 1502])}
      {Logo(494, 60)}
      {S(603, 60, 'State Bank of India', { fontSize: '22px' })}
      {SC(1027, 56, <b><i><u>Application for RTGS/NEFT Remittance</u></i></b>, { fontSize: '22px' })}
      {SC(1300, 55, 'Date', { fontSize: '22px' })}
      {DB(1337, 41, 1502, 80, formattedDate)}

      {R(80, 108, [488, 580, 815, 962, 995, 1115, 1265, 1502])}
      {L(497, 80, 108, <b>Branch</b>, { fontSize: '20px' })}
      {DB(580, 80, 815, 108, data.branch, 'center')}

      {/* NEFT Box */}
      {Bx(822, 83, 845, 105)}
      {!isRtgs && DB(822, 83, 845, 105, '✓', 'center', { fontSize: '20px', padding: 0 })}
      {S(897, 94, <b>NEFT</b>, { fontSize: '20px' })}

      {/* RTGS Box */}
      {Bx(970, 84, 992, 104)}
      {isRtgs && DB(970, 84, 992, 104, '✓', 'center', { fontSize: '20px', padding: 0 })}
      {S(1044, 94, <b>RTGS</b>, { fontSize: '20px' })}

      {S(1120, 94, <b>Branch Code</b>, { fontSize: '20px' })}
      {DB(1265, 80, 1502, 108, data.bcode)}

      {/* Sum of row */}
      {R(108, 137, [488, 680, 713, 975, 1008, 1502])}
      {L(497, 108, 137, 'Please remit the sum of', { fontSize: '16.5px' })}
      {S(684, 122, '₹', { fontSize: '26px' })}
      {numAmt > 0 && DB(713, 108, 975, 137, formatINR(numAmt), 'left')}
      {S(982, 122, '₹', { fontSize: '26px' })}
      {DB(1008, 108, 1502, 137, wordsAmount, 'left', { fontSize: '14px' })}

      {/* Debit account no */}
      {R(137, 168, [488, 1502])}
      {L(497, 137, 168, 'By Debiting my our Account No.', { fontSize: '19px' })}
      {data.debitAcc && (
        <div
          className="absolute font-bold text-gray-950 font-serif tracking-widest z-10"
          style={{ left: '768px', top: '153px', transform: 'translateY(-50%)', letterSpacing: '11px', fontSize: '15px' }}
        >
          {data.debitAcc}
        </div>
      )}
      {S(1018, 153, 'by way of', { fontSize: '19px' })}
      {tick(1125, 141, 1148, 163, !isCheque)}
      {S(1158, 150, 'Transfer (only NEFT)', { fontSize: '16px' })}
      {tick(1322, 141, 1345, 163, isCheque)}
      {S(1348, 150, <>Cheque <span style={{ fontSize: '14px' }}>(NEFT/RTGS)</span></>, { fontSize: '16px' })}

      {/* Cheque row */}
      {R(168, 202, [488, 650, 815, 918, 1045, 1502])}
      {L(497, 168, 202, 'Using Cheque No.', { fontSize: '18px' })}
      {DB(650, 168, 815, 202, data.chqNo)}
      {SC(866, 181, 'Dated', { fontSize: '18px' })}
      {DB(918, 168, 1045, 202, formattedChqDate)}
      {S(1053, 179, 'For the total amount including your charges, as per the details given', { fontSize: '12.5px' })}
      {S(1053, 194, 'below:', { fontSize: '12.5px' })}

      {/* Beneficiary Name */}
      {R(202, 235, [488, 713, 1502])}
      {L(497, 202, 235, 'Name of the Beneficiary', { fontSize: '18px' })}
      {DB(713, 202, 1502, 235, data.benName)}

      {/* Beneficiary Bank & Branch */}
      {R(235, 280, [488, 713, 1502])}
      {S(497, 247, 'Beneficiary Bank &', { fontSize: '18px' })}
      {S(497, 268, 'Branch', { fontSize: '18px' })}
      {DB(713, 235, 1502, 280, data.benBank)}

      {/* IFSC CODE (11 Cells) */}
      {R(280, 310, [488, 713])}
      {L(497, 280, 310, 'IFSC CODE:', { fontSize: '18px' })}
      {Cells(713, 280, 482, 30, 11, ifscUpper)}
      {Bx(1195, 280, 1502, 310)}

      {/* Beneficiary Account No (18 Cells) */}
      {R(310, 340, [488, 713])}
      {L(497, 310, 340, 'Beneficiary Account No.', { fontSize: '18px' })}
      {Cells(713, 310, 789, 30, 18, data.benAcc)}

      {/* Amount in Words */}
      {R(340, 368, [488, 713, 760, 1502])}
      {L(497, 340, 368, 'Amount (in Words)', { fontSize: '17px' })}
      {S(722, 352, '₹', { fontSize: '24px' })}
      {DB(760, 340, 1502, 368, wordsAmount, 'left', { fontSize: '13.5px' })}

      {/* Amount in Figures, Charges & Total */}
      {R(368, 397, [488, 713, 760, 918, 1028, 1203, 1315, 1502])}
      {L(497, 368, 397, 'Amount (in Figures)', { fontSize: '17px' })}
      {S(722, 381, '₹', { fontSize: '24px' })}
      {numAmt > 0 && DB(760, 368, 918, 397, formatINR(numAmt), 'right', { fontSize: '15px' })}
      {S(930, 382, 'Charges  ₹', { fontSize: '17px' })}
      {numChg > 0 && DB(1028, 368, 1203, 397, formatINR(numChg), 'right', { fontSize: '15px' })}
      {S(1213, 382, 'Total  ₹', { fontSize: '17px' })}
      {grandTotal > 0 && DB(1315, 368, 1502, 397, formatINR(grandTotal), 'right', { fontSize: '15px' })}

      {/* Name of Applicant & Address */}
      {R(397, 426, [488, 713, 1025, 1108, 1502])}
      {L(497, 397, 426, 'Name of the Applicant', { fontSize: '17px' })}
      {DB(713, 397, 1025, 426, data.applicantName, 'left', { fontSize: '14.5px' })}
      {SC(1066, 411, 'Address', { fontSize: '17px' })}
      {DB(1108, 397, 1502, 426, data.applicantAddr, 'left', { fontSize: '12.5px' })}

      {/* Mobile No (10 cells), Tel No & UTR */}
      {R(426, 455, [488, 607, 827, 905, 1050, 1203, 1502])}
      {L(497, 426, 455, 'Mobile No.', { fontSize: '17px' })}
      {Cells(607, 426, 220, 29, 10, data.mobile)}
      {SC(866, 441, 'Tel No.', { fontSize: '17px' })}
      {DB(905, 426, 1050, 455, data.tel, 'left', { fontSize: '14px' })}
      {S(1058, 440, 'UTR No. & Date', { fontSize: '17px' })}

      {/* Signatures */}
      {R(455, 507, [488, 650, 967, 1203, 1502])}
      {SC(569, 481, '(for Office Use)', { fontSize: '18px' })}
      {SC(808, 481, '(Please see conditions on the reverse)', { fontSize: '18px' })}
      {SC(1085, 481, 'Signature of Applicant(s)', { fontSize: '18px' })}
    </div>
  );
};
