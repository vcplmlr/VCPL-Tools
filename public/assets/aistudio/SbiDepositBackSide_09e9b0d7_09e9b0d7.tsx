/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const SbiDepositBackSide: React.FC = () => {
  return (
    <div
      id="sbi-deposit-back-canvas"
      className="relative bg-white text-black p-12 box-border select-none shrink-0"
      style={{
        width: '1568px',
        height: '600px',
        fontFamily: '"Noto Sans Devanagari", Arial, Helvetica, sans-serif',
        fontSize: '15px',
        lineHeight: 1.6,
      }}
    >
      <div className="max-w-[1240px] mx-auto border-2 border-black p-8 rounded-sm bg-white">
        <h3 className="text-xl font-bold mb-6 text-center tracking-wide border-b-2 border-black pb-3">
          विविध निर्देश / Miscellaneous Instructions
        </h3>
        <div className="space-y-4 text-[14px] leading-relaxed text-slate-900 font-medium">
          <div className="flex gap-3">
            <span className="font-bold">&bull;</span>
            <div>
              <p className="font-semibold text-slate-900">
                कृपया अपनी पास बुक महीने में एक बार अवश्य अद्यतन करवाएं।
              </p>
              <p className="text-slate-700">Please get your Pass Book updated once in a month.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="font-bold">&bull;</span>
            <div>
              <p className="font-semibold text-slate-900">
                कृपया अपने खाते के विवरण/इंटरनेट बैंकिंग यूजर आईडी और पासवर्ड/एटीएम डेबिट कार्ड/क्रेडिट कार्ड/मोबाइल बैंकिंग/व्यक्तिगत जानकारी किसी भी व्यक्ति को प्रकट न करें।
              </p>
              <p className="text-slate-700">
                Please do not disclose your Account details/Internet Banking User ID and Passwords/ATM Debit Card/Credit Card/Mobile Banking/Personal Information to any person.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="font-bold">&bull;</span>
            <div>
              <p className="font-semibold text-slate-900">
                सभी शुल्क/शर्तें समय समय पर परिवर्तनीय हैं। कृपया अधिक जानकारी के लिए बैंक की वेबसाईट www.sbi.co.in को देखें।
              </p>
              <p className="text-slate-700">
                All charges/stipulations are subject to change from time to time. Please visit Bank's website www.sbi.co.in for further information.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="font-bold">&bull;</span>
            <div>
              <p className="font-semibold text-slate-900">
                नकद जमा ₹ 50000/- से अधिक के लिए, कृपया अपना पैन संख्या का उल्लेख करें अथवा फॉर्म 60 की हस्ताक्षरित कॉपी प्रस्तुत करें।
              </p>
              <p className="text-slate-700">
                For Cash Deposit exceeding ₹ 50000/- please mention your PAN No. or submit signed copy of Form 60.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="font-bold">&bull;</span>
            <div>
              <p className="font-semibold text-slate-900">
                ग्राहक यह सुनिश्चित करें की जमापर्ची का ब्यौरा सही है एवं चैक/लिखित/नकदी के विवरण के साथ मेल खाता है।
              </p>
              <p className="text-slate-700">
                The customer is obliged to ensure that the details on the deposit slip are accurate and match with the details of the cheque/instrument/cash.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="font-bold">&bull;</span>
            <div>
              <p className="font-semibold text-slate-900">
                झूठे वादों के शिकार न हों, संदिग्ध योजनाओं से सावधान रहें।
              </p>
              <p className="text-slate-700">
                Do not fall prey to false promises, beware of dubious schemes.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between text-xs text-slate-600 font-mono">
          <span>STATE BANK OF INDIA &bull; PAY-IN SLIP INSTRUCTIONS</span>
          <span>FORM NO. 100999131-V3 (BACK)</span>
        </div>
      </div>
    </div>
  );
};
