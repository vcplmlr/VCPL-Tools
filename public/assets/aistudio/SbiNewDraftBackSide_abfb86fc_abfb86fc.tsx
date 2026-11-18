/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DemandDraftFormData, RenderMode, DdDenom } from '../types';
import { formatINR, twoDigits } from '../utils/numberToWords';

interface SbiNewDraftBackSideProps {
  data?: DemandDraftFormData;
  mode?: RenderMode;
}

const CASH_ROWS: { denom: DdDenom; label: string }[] = [
  { denom: 1000, label: '1000' },
  { denom: 500, label: '500' },
  { denom: 100, label: '100' },
  { denom: 50, label: '50' },
  { denom: 20, label: '20' },
  { denom: 10, label: '10' },
  { denom: 5, label: '5' },
  { denom: 2, label: '2' },
  { denom: 1, label: '1' },
];

export const SbiNewDraftBackSide: React.FC<SbiNewDraftBackSideProps> = ({ data, mode = 'full' }) => {
  const isDataOnly = mode === 'data';

  // Calculate cash rows and total
  let totalCash = 0;
  const renderedCashRows = CASH_ROWS.map(({ denom, label }) => {
    const count = data?.denominations ? data.denominations[denom] : '';
    const numCount = typeof count === 'number' ? count : parseInt(String(count)) || 0;
    const amount = numCount > 0 ? numCount * denom : 0;
    totalCash += amount;
    return {
      denom,
      label,
      count: numCount > 0 ? numCount : '',
      amount: amount > 0 ? amount : '',
    };
  });

  const coinsVal = typeof data?.coins === 'number' ? data.coins : parseFloat(String(data?.coins)) || 0;
  totalCash += coinsVal;

  // Cheque list
  const cheques = data?.cheques || [
    { drawnBank: '', branch: '', chequeNo: '', amount: '' },
    { drawnBank: '', branch: '', chequeNo: '', amount: '' },
    { drawnBank: '', branch: '', chequeNo: '', amount: '' },
  ];

  let totalCheque = 0;
  cheques.forEach((c) => {
    const a = typeof c.amount === 'number' ? c.amount : parseFloat(String(c.amount)) || 0;
    totalCheque += a;
  });

  return (
    <div
      id="sbi-new-draft-back-canvas"
      className="relative bg-white text-black select-none shrink-0"
      style={{
        width: '1568px',
        height: '680px',
        fontFamily: '"Noto Sans Kannada", "Noto Sans Devanagari", Arial, Helvetica, sans-serif',
        fontSize: '13px',
      }}
    >
      {/* Outer Border */}
      <div
        className={`absolute inset-x-[80px] top-[24px] bottom-[30px] border border-black ${
          isDataOnly ? 'border-transparent' : 'border-black'
        }`}
      >
        {/* Top Header */}
        <div
          className={`w-full py-2.5 text-center border-b border-black font-bold select-none ${
            isDataOnly ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ fontSize: '13px' }}
        >
          ಜಮಾ ಮಾಡಿದ ನಗದಿನ / ಚೆಕ್ಕುಗಳ ವಿವರ / जमा की गई नकदी एवं चेकों के विवरण / Details of CASH/CHEQUES deposited
        </div>

        {/* Content Split: 50% Cheques, 50% Cash */}
        <div className="flex w-full h-[578px]">
          {/* ============================================================== */}
          {/* LEFT HALF: DETAILS OF CHEQUE                                   */}
          {/* ============================================================== */}
          <div
            className={`w-1/2 h-full border-r border-black flex flex-col ${
              isDataOnly ? 'border-transparent' : 'border-black'
            }`}
          >
            {/* Cheque Table Header */}
            <div
              className={`w-full py-1 text-center font-bold text-xs border-b border-black select-none ${
                isDataOnly ? 'opacity-0' : 'opacity-100'
              }`}
            >
              ಚೆಕ್ಕುಗಳ ವಿವರಗಳು / चेक के विवरण / DETAILS OF CHEQUE
            </div>

            {/* Column Titles */}
            <div
              className={`grid grid-cols-12 border-b border-black text-center font-bold text-[11px] select-none ${
                isDataOnly ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <div className="col-span-4 p-1.5 border-r border-black leading-tight">
                ಗ್ರಾಹಕರ ಬ್ಯಾಂಕ್ / कौनसे बैंक पर आहरीत है / DRAWN ON BANK
              </div>
              <div className="col-span-3 p-1.5 border-r border-black leading-tight">
                ಶಾಖೆ / शाखा / BRANCH
              </div>
              <div className="col-span-2 p-1.5 border-r border-black leading-tight">
                ಚೆಕ್ ಸಂಖ್ಯೆ / चेक क्रमांक / CHEQUE NO.
              </div>
              <div className="col-span-3 p-1.5 leading-tight">
                ಮೊತ್ತಗಳು / राशि / AMOUNT (Rs. &amp; P.)
              </div>
            </div>

            {/* Cheque Rows (10 rows) */}
            <div className="flex-1 flex flex-col">
              {Array.from({ length: 10 }).map((_, idx) => {
                const item = cheques[idx] || { drawnBank: '', branch: '', chequeNo: '', amount: '' };
                const numA = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-12 flex-1 border-b border-black text-xs items-center ${
                      isDataOnly ? 'border-transparent' : 'border-black'
                    }`}
                  >
                    <div
                      className={`col-span-4 h-full px-2 flex items-center font-bold border-r border-black truncate ${
                        isDataOnly ? 'border-transparent' : 'border-black'
                      }`}
                    >
                      {item.drawnBank}
                    </div>
                    <div
                      className={`col-span-3 h-full px-2 flex items-center font-bold border-r border-black truncate ${
                        isDataOnly ? 'border-transparent' : 'border-black'
                      }`}
                    >
                      {item.branch}
                    </div>
                    <div
                      className={`col-span-2 h-full px-2 flex items-center justify-center font-mono font-bold border-r border-black ${
                        isDataOnly ? 'border-transparent' : 'border-black'
                      }`}
                    >
                      {item.chequeNo}
                    </div>
                    <div className="col-span-3 h-full px-2 flex items-center justify-end font-mono font-bold">
                      {numA > 0 ? (
                        <>
                          <span>{Math.floor(numA).toLocaleString('en-IN')}</span>
                          <span className="text-[10px] text-slate-500 ml-1">
                            .{twoDigits(Math.round((numA - Math.floor(numA)) * 100))}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {/* Total Cheque Row */}
              <div className="grid grid-cols-12 h-10 items-center font-bold text-xs bg-slate-50/50">
                <div
                  className={`col-span-9 h-full px-4 flex items-center font-bold border-r border-black ${
                    isDataOnly ? 'border-transparent' : 'border-black'
                  }`}
                >
                  <span className={isDataOnly ? 'opacity-0' : 'opacity-100'}>
                    ಒಟ್ಟು / योग / TOTAL CHEQUES
                  </span>
                </div>
                <div className="col-span-3 h-full px-2 flex items-center justify-end font-mono font-bold">
                  {totalCheque > 0 ? `₹${formatINR(totalCheque)}` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT HALF: DETAILS OF CASH                                    */}
          {/* ============================================================== */}
          <div className="w-1/2 h-full flex flex-col">
            {/* Cash Table Header */}
            <div
              className={`w-full py-1 text-center font-bold text-xs border-b border-black select-none ${
                isDataOnly ? 'opacity-0' : 'opacity-100'
              }`}
            >
              ನಗದಿನ ವಿವರಗಳು / नकदी के विवरण / DETAILS OF CASH
            </div>

            {/* Column Titles */}
            <div
              className={`grid grid-cols-12 border-b border-black text-center font-bold text-[11px] select-none ${
                isDataOnly ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <div className="col-span-4 p-1.5 border-r border-black leading-tight">
                ಮೌಲ್ಯವರ್ಗ / मूल्यवर्ग / DENOMINATION
              </div>
              <div className="col-span-4 p-1.5 border-r border-black leading-tight">
                ಸಂಖ್ಯೆ / संख्या / No. of Pieces
              </div>
              <div className="col-span-4 p-1.5 leading-tight">
                ಮೊತ್ತಗಳು / राशि / AMOUNT (Rs. &amp; P.)
              </div>
            </div>

            {/* Cash Rows: 1000, 500, 100, 50, 20, 10, 5, 2, 1, Coins */}
            <div className="flex-1 flex flex-col">
              {renderedCashRows.map((row) => (
                <div
                  key={row.denom}
                  className={`grid grid-cols-12 flex-1 border-b border-black text-xs items-center ${
                    isDataOnly ? 'border-transparent' : 'border-black'
                  }`}
                >
                  <div
                    className={`col-span-4 h-full px-3 flex items-center justify-between font-mono font-bold border-r border-black ${
                      isDataOnly ? 'border-transparent' : 'border-black'
                    }`}
                  >
                    <span className={isDataOnly ? 'opacity-0' : 'opacity-100'}>₹{row.label}</span>
                    <span className={`text-[11px] ${isDataOnly ? 'opacity-0' : 'text-slate-400'}`}>&times;</span>
                  </div>
                  <div
                    className={`col-span-4 h-full px-2 flex items-center justify-center font-mono font-bold border-r border-black ${
                      isDataOnly ? 'border-transparent' : 'border-black'
                    }`}
                  >
                    {row.count}
                  </div>
                  <div className="col-span-4 h-full px-3 flex items-center justify-end font-mono font-bold">
                    {typeof row.amount === 'number' && row.amount > 0 ? (
                      <>
                        <span>{Math.floor(row.amount).toLocaleString('en-IN')}</span>
                        <span className="text-[10px] text-slate-500 ml-1">.00</span>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}

              {/* Coins Row */}
              <div
                className={`grid grid-cols-12 flex-1 border-b border-black text-xs items-center ${
                  isDataOnly ? 'border-transparent' : 'border-black'
                }`}
              >
                <div
                  className={`col-span-8 h-full px-3 flex items-center font-bold border-r border-black select-none ${
                    isDataOnly ? 'border-transparent' : 'border-black'
                  }`}
                >
                  <span className={isDataOnly ? 'opacity-0' : 'opacity-100'}>
                    ನಾಣ್ಯಗಳು / सिक्के / Coins
                  </span>
                </div>
                <div className="col-span-4 h-full px-3 flex items-center justify-end font-mono font-bold">
                  {coinsVal > 0 ? (
                    <>
                      <span>{Math.floor(coinsVal).toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-slate-500 ml-1">
                        .{twoDigits(Math.round((coinsVal - Math.floor(coinsVal)) * 100))}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Total Cash Row */}
              <div className="grid grid-cols-12 h-10 items-center font-bold text-xs bg-slate-50/50">
                <div
                  className={`col-span-8 h-full px-4 flex items-center font-bold border-r border-black ${
                    isDataOnly ? 'border-transparent' : 'border-black'
                  }`}
                >
                  <span className={isDataOnly ? 'opacity-0' : 'opacity-100'}>
                    ಒಟ್ಟು ಯೋಗ / TOTAL CASH
                  </span>
                </div>
                <div className="col-span-4 h-full px-3 flex items-center justify-end font-mono font-bold text-blue-700">
                  {totalCash > 0 ? `₹${formatINR(totalCash)}` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
