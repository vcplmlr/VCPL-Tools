/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HdfcNeftFormData, RenderMode } from '../types';
import { numberToWordsIndian } from '../utils/numberToWords';

interface HdfcNeftSlipReplicaProps {
  data: HdfcNeftFormData;
  mode: RenderMode;
}

const fmt = (n: number | ''): string => {
  if (n === '' || typeof n !== 'number' || isNaN(n)) return '';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const dmy = (v: string): string => {
  if (!v) return '';
  return v.split('-').reverse().join('');
};

const formatDate = (v: string): string => {
  if (!v) return '';
  return v.split('-').reverse().join('/');
};

const splitWords = (text: string, maxLen = 36): [string, string] => {
  if (!text) return ['', ''];
  if (text.length <= maxLen) return [text, ''];
  const lastSpace = text.lastIndexOf(' ', maxLen);
  if (lastSpace === -1) return [text.slice(0, maxLen), text.slice(maxLen)];
  return [text.slice(0, lastSpace), text.slice(lastSpace + 1)];
};

export const HdfcNeftSlipReplica: React.FC<HdfcNeftSlipReplicaProps> = ({ data, mode }) => {
  const isDataOnly = mode === 'data';

  // Words calculation
  const amtNum = typeof data.amount === 'number' ? data.amount : 0;
  const wordsEng = amtNum > 0 ? `Rupees ${numberToWordsIndian(amtNum)} Only` : '';
  const [wordsLine1, wordsLine2] = splitWords(wordsEng, 36);

  const formattedDate = formatDate(data.date);
  const remitterLeiDigits = (data.remitterLei || '').toUpperCase().padEnd(20, ' ');
  const remitterLeiExpiryDigits = dmy(data.remitterLeiExpiry);
  const benAccDigits = (data.beneficiaryAccountNo || '').padEnd(16, ' ');
  const benAccConfirmDigits = (data.beneficiaryAccountNoConfirm || '').padEnd(16, ' ');
  const benLeiDigits = (data.beneficiaryLei || '').toUpperCase().padEnd(20, ' ');
  const benLeiExpiryDigits = dmy(data.beneficiaryLeiExpiry);

  return (
    <div
      id="hdfc-neft-slip-canvas"
      style={{
        width: '856px',
        height: '1400px',
        position: 'relative',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '14px',
        lineHeight: 1.4,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
      className={`print:bg-white select-none ${isDataOnly ? 'hdfc-data-only' : ''}`}
    >
      <style>{`
        .hdfc-data-only .hdfc-static { color: transparent !important; border-color: transparent !important; }
        .hdfc-data-only .hdfc-blk { background: transparent !important; color: transparent !important; }
        .hdfc-data-only .hdfc-border { border-color: transparent !important; }
      `}</style>

      {/* Outer Border */}
      {!isDataOnly && (
        <div
          className="absolute hdfc-border pointer-events-none"
          style={{
            left: '5px',
            top: '3px',
            width: '846px',
            height: '1394px',
            border: '1px solid #000',
          }}
        />
      )}

      {/* Header Title */}
      <div
        className="absolute hdfc-static font-bold"
        style={{
          left: '430px',
          top: '30px',
          transform: 'translateX(-50%)',
          fontSize: '18px',
          textDecoration: 'underline',
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}
      >
        RTGS / NEFT Request Form
      </div>

      {/* HDFC Bank Logo */}
      <div
        className="absolute hdfc-static"
        style={{ left: '663px', top: '36px', width: '146px', height: '24px' }}
      >
        <svg style={{ width: '146px', height: '24px', color: '#000' }} viewBox="0 0 146 24">
          <rect width="146" height="24" fill="currentColor" />
          <rect x="4" y="4" width="16" height="16" fill="#fff" />
          <rect x="8" y="8" width="8" height="8" fill="currentColor" />
          <text
            x="26"
            y="17"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="bold"
            fontSize="14"
            fill="#fff"
            letterSpacing="0.05em"
          >
            HDFC BANK
          </text>
        </svg>
      </div>

      {/* Request Type Checkboxes */}
      {/* RTGS Box */}
      <div
        className="absolute hdfc-border flex items-center justify-center font-bold text-xs"
        style={{
          left: '76px',
          top: '54px',
          width: '14px',
          height: '14px',
          border: '1px solid #000',
        }}
      >
        {data.type === 'rtgs' && <span className="text-[13px] leading-none">✓</span>}
      </div>
      <div
        className="absolute hdfc-static"
        style={{ left: '98px', top: '53px', fontSize: '13.9px' }}
      >
        RTGS
      </div>

      {/* NEFT Box */}
      <div
        className="absolute hdfc-border flex items-center justify-center font-bold text-xs"
        style={{
          left: '335px',
          top: '54px',
          width: '14px',
          height: '14px',
          border: '1px solid #000',
        }}
      >
        {data.type === 'neft' && <span className="text-[13px] leading-none">✓</span>}
      </div>
      <div
        className="absolute hdfc-static"
        style={{ left: '362px', top: '53px', fontSize: '13.9px' }}
      >
        NEFT
      </div>

      {/* For RTGS / NEFT */}
      <div
        className="absolute hdfc-static font-bold"
        style={{
          left: '77px',
          top: '76px',
          fontSize: '14px',
          textDecoration: 'underline',
        }}
      >
        For RTGS / NEFT
      </div>

      {/* Date of Request */}
      <div
        className="absolute hdfc-static"
        style={{ left: '556px', top: '75px', fontSize: '11.8px' }}
      >
        Date of Request :
      </div>
      {/* Date line + value */}
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{
            left: '641px',
            top: '91px',
            width: '156px',
            borderTop: '1px solid #000',
          }}
        />
      )}
      <div
        className="absolute font-bold text-slate-900"
        style={{
          left: '645px',
          top: '73px',
          width: '150px',
          fontSize: '13px',
        }}
      >
        {formattedDate}
      </div>

      {/* Maximum Limit for NEFT Transaction Table */}
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{
            left: '78px',
            top: '104px',
            width: '717px',
            height: '107px',
            border: '1px solid #000',
          }}
        >
          {/* Header Divider */}
          <div style={{ position: 'absolute', left: 0, top: '18px', width: '100%', borderTop: '1px solid #000' }} />
          {/* Row 1 Divider */}
          <div style={{ position: 'absolute', left: 0, top: '37px', width: '100%', borderTop: '1px solid #000' }} />
          {/* Row 2 Divider */}
          <div style={{ position: 'absolute', left: 0, top: '62px', width: '100%', borderTop: '1px solid #000' }} />
          {/* Row 3 Divider */}
          <div style={{ position: 'absolute', left: 0, top: '83px', width: '100%', borderTop: '1px solid #000' }} />
          {/* Vertical Column Divider (x=478 relative = 556 - 78) */}
          <div style={{ position: 'absolute', left: '478px', top: '18px', width: '1px', height: '65px', background: '#000' }} />
        </div>
      )}
      <div
        className="absolute hdfc-static font-bold text-center"
        style={{ left: '78px', top: '106px', width: '717px', fontSize: '12px' }}
      >
        Maximum Limit for NEFT Transaction
      </div>
      <div className="absolute hdfc-static" style={{ left: '83px', top: '124px', fontSize: '12px' }}>
        HDFC Bank Customer
      </div>
      <div className="absolute hdfc-static" style={{ left: '561px', top: '124px', fontSize: '12px' }}>
        No Limit
      </div>
      <div className="absolute hdfc-static" style={{ left: '83px', top: '144px', fontSize: '12px' }}>
        HDFC Bank Customer - Indo Nepal NEFT Remittance
      </div>
      <div className="absolute hdfc-static" style={{ left: '561px', top: '144px', fontSize: '12px' }}>
        via Account - Up to INR 200000/-
      </div>
      <div className="absolute hdfc-static" style={{ left: '83px', top: '168px', fontSize: '12px' }}>
        Non HDFC Bank Customer &amp; Indo Nepal NEFT Remittance
      </div>
      <div className="absolute hdfc-static" style={{ left: '561px', top: '168px', fontSize: '12px' }}>
        Up to INR 50,000/-
      </div>
      <div className="absolute hdfc-static" style={{ left: '83px', top: '191px', fontSize: '12px' }}>
        Purpose of Remittance to Nepal - tick one (Family Maintenance / Retirement Fund / Pension Fund / Others ______)
      </div>

      {/* Row: Time */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '214px', fontSize: '13.9px' }}>
        Time
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '110px', top: '227px', width: '102px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '114px', top: '211px', width: '95px', fontSize: '13px' }}>
        {data.time}
      </div>

      {/* Row: Customer's Name */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '237px', fontSize: '13.9px' }}>
        Customer's Name
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '192px', top: '250px', width: '603px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900 uppercase" style={{ left: '198px', top: '234px', width: '595px', fontSize: '13px' }}>
        {data.name}
      </div>

      {/* Row: Account no / Chq no / Favouring text */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '261px', fontSize: '13.9px' }}>
        Account no
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '150px', top: '274px', width: '162px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono tracking-wider text-slate-900" style={{ left: '154px', top: '258px', width: '155px', fontSize: '13px' }}>
        {data.accountNo}
      </div>

      <div className="absolute hdfc-static" style={{ left: '318px', top: '261px', fontSize: '13.9px' }}>
        Chq no
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '362px', top: '274px', width: '148px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '366px', top: '258px', width: '140px', fontSize: '13px' }}>
        {data.chequeNo}
      </div>

      <div className="absolute hdfc-static" style={{ left: '515px', top: '262px', fontSize: '10px' }}>
        favouring HDFC Bank Ltd for NEFT/RTGS (whichever applicable)
      </div>

      {/* Row: Mobile No & Tel No */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '284px', fontSize: '13.9px' }}>
        Mobile No
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '145px', top: '297px', width: '275px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '149px', top: '281px', width: '265px', fontSize: '13px' }}>
        {data.mobile}
      </div>

      <div className="absolute hdfc-static" style={{ left: '425px', top: '284px', fontSize: '13.9px' }}>
        Tel No
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '470px', top: '297px', width: '323px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '475px', top: '281px', width: '315px', fontSize: '13px' }}>
        {data.tel}
      </div>

      {/* Row: Remitter Legal Entity Identifier Code (LEI) (20 Boxes) */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '307px', fontSize: '13.4px' }}>
        Remitter Legal Entity Identifier Code (LEI)
      </div>
      {/* 20 Boxes: x=335, y=303, w=458, h=23, cw=22.9 */}
      <div className="absolute flex" style={{ left: '335px', top: '303px', width: '458px', height: '23px' }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`hdfc-border flex items-center justify-center font-mono font-bold text-xs ${
              !isDataOnly ? 'border border-black' : ''
            }`}
            style={{ width: `${458 / 20}px`, height: '23px' }}
          >
            {remitterLeiDigits[i]?.trim()}
          </div>
        ))}
      </div>
      <div className="absolute hdfc-static" style={{ left: '78px', top: '330px', fontSize: '10.5px' }}>
        (*Only applicable for Rs.50 cr &amp; above transaction for non-individual accounts)
      </div>

      {/* LEI Expiry Date (DDMMYYYY) */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '353px', fontSize: '13.9px' }}>
        LEI Expiry Date:
      </div>
      {/* 8 boxes at x=216, y=350, h=22, cw=25.5 */}
      <div className="absolute flex" style={{ left: '216px', top: '350px', width: '204px', height: '22px' }}>
        {'DDMMYYYY'.split('').map((ph, i) => (
          <div
            key={i}
            className={`hdfc-border flex items-center justify-center font-mono font-bold text-xs ${
              !isDataOnly ? 'border border-black' : ''
            }`}
            style={{ width: '25.5px', height: '22px' }}
          >
            {remitterLeiExpiryDigits[i] ? (
              <span className="text-black font-bold">{remitterLeiExpiryDigits[i]}</span>
            ) : !isDataOnly ? (
              <span className="text-slate-400 font-normal">{ph}</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Address of Remitter & Email id */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '376px', fontSize: '13.9px' }}>
        Address of Remitter (Mandatory for Non HDFC Bank Customer)
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '472px', top: '389px', width: '321px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '476px', top: '373px', width: '315px', fontSize: '12px' }}>
        {data.remitterAddress}
      </div>

      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '78px', top: '409px', width: '402px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute hdfc-static" style={{ left: '483px', top: '395px', fontSize: '13.9px' }}>
        Email id
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '538px', top: '409px', width: '255px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '542px', top: '393px', width: '250px', fontSize: '12px' }}>
        {data.remitterEmail}
      </div>

      {/* Non HDFC Bank Customer Cash Deposited */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '424px', fontSize: '13.9px' }}>
        In case of Non HDFC Bank Customer Amount of Cash Deposited Rs.
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '506px', top: '437px', width: '215px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '512px', top: '421px', width: '200px', fontSize: '13px' }}>
        {fmt(data.cashDeposited)}
      </div>

      {/* BENEFICIARY DETAILS */}
      <div
        className="absolute hdfc-static font-bold"
        style={{ left: '78px', top: '445px', fontSize: '13.9px', textDecoration: 'underline' }}
      >
        Beneficiary details :
      </div>

      {/* Beneficiary Name & Contact No */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '466px', fontSize: '13.9px' }}>
        Name
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '118px', top: '479px', width: '370px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold uppercase text-slate-900" style={{ left: '122px', top: '463px', width: '360px', fontSize: '13px' }}>
        {data.beneficiaryName}
      </div>

      <div className="absolute hdfc-static" style={{ left: '493px', top: '466px', fontSize: '13.9px' }}>
        Beneficiary Contact No.
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '641px', top: '479px', width: '148px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '646px', top: '463px', width: '140px', fontSize: '13px' }}>
        {data.beneficiaryContact}
      </div>

      {/* Address */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '487px', fontSize: '13.9px' }}>
        Address
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '135px', top: '500px', width: '650px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '140px', top: '484px', width: '645px', fontSize: '12px' }}>
        {data.beneficiaryAddress}
      </div>

      {/* Account No (16 Boxes) */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '509px', fontSize: '13.9px' }}>
        Account No :
      </div>
      {/* 16 Boxes at x=229, y=505, w=409, h=21, cw=25.56 */}
      <div className="absolute flex" style={{ left: '229px', top: '505px', width: '409px', height: '21px' }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className={`hdfc-border flex items-center justify-center font-mono font-bold text-xs ${
              !isDataOnly ? 'border border-black' : ''
            }`}
            style={{ width: `${409 / 16}px`, height: '21px' }}
          >
            {benAccDigits[i]?.trim()}
          </div>
        ))}
      </div>

      {/* Re-Confirm Account No (16 Boxes) */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '531px', fontSize: '13.9px' }}>
        Re-Confirm Account no:
      </div>
      {/* 16 Boxes at x=229, y=526, w=409, h=21, cw=25.56 */}
      <div className="absolute flex" style={{ left: '229px', top: '526px', width: '409px', height: '21px' }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className={`hdfc-border flex items-center justify-center font-mono font-bold text-xs ${
              !isDataOnly ? 'border border-black' : ''
            }`}
            style={{ width: `${409 / 16}px`, height: '21px' }}
          >
            {benAccConfirmDigits[i]?.trim()}
          </div>
        ))}
      </div>

      {/* Bank Name & Branch + IFSC Code */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '553px', fontSize: '13.9px' }}>
        Bank Name &amp; Branch :
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '230px', top: '566px', width: '258px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900 uppercase" style={{ left: '235px', top: '550px', width: '250px', fontSize: '12px' }}>
        {data.beneficiaryBankBranch}
      </div>

      <div className="absolute hdfc-static" style={{ left: '493px', top: '553px', fontSize: '13.9px' }}>
        IFSC Code
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '562px', top: '566px', width: '198px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono tracking-widest text-slate-900 uppercase" style={{ left: '566px', top: '550px', width: '190px', fontSize: '13px' }}>
        {data.beneficiaryIfsc}
      </div>

      {/* A/c Type: Resident, Non Resident, FCRA & Purpose */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '574px', fontSize: '13.9px' }}>
        A/c Type :
      </div>
      {/* Resident */}
      <div
        className="absolute hdfc-border flex items-center justify-center font-bold text-xs"
        style={{ left: '147px', top: '575px', width: '12px', height: '12px', border: '1px solid #000' }}
      >
        {data.beneficiaryAccountType === 'res' && <span className="text-[12px] leading-none">✓</span>}
      </div>
      <div className="absolute hdfc-static" style={{ left: '165px', top: '574px', fontSize: '13.9px' }}>
        Resident
      </div>
      {/* Non Resident */}
      <div
        className="absolute hdfc-border flex items-center justify-center font-bold text-xs"
        style={{ left: '228px', top: '575px', width: '12px', height: '12px', border: '1px solid #000' }}
      >
        {data.beneficiaryAccountType === 'nr' && <span className="text-[12px] leading-none">✓</span>}
      </div>
      <div className="absolute hdfc-static" style={{ left: '243px', top: '574px', fontSize: '13.9px' }}>
        Non Resident
      </div>
      {/* FCRA */}
      <div
        className="absolute hdfc-border flex items-center justify-center font-bold text-xs"
        style={{ left: '335px', top: '575px', width: '12px', height: '12px', border: '1px solid #000' }}
      >
        {data.beneficiaryAccountType === 'fcra' && <span className="text-[12px] leading-none">✓</span>}
      </div>
      <div className="absolute hdfc-static" style={{ left: '350px', top: '574px', fontSize: '13.9px' }}>
        FCRA
      </div>

      <div className="absolute hdfc-static" style={{ left: '414px', top: '574px', fontSize: '13.9px' }}>
        Purpose
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '470px', top: '587px', width: '292px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '475px', top: '571px', width: '285px', fontSize: '12px' }}>
        {data.purpose}
      </div>

      {/* Beneficiary Legal Entity Identifier Code (LEI) (20 Boxes) */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '602px', fontSize: '13.4px' }}>
        Beneficiary Legal Entity Identifier Code (LEI)
      </div>
      {/* 20 Boxes at x=335, y=598, w=458, h=23, cw=22.9 */}
      <div className="absolute flex" style={{ left: '335px', top: '598px', width: '458px', height: '23px' }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`hdfc-border flex items-center justify-center font-mono font-bold text-xs ${
              !isDataOnly ? 'border border-black' : ''
            }`}
            style={{ width: `${458 / 20}px`, height: '23px' }}
          >
            {benLeiDigits[i]?.trim()}
          </div>
        ))}
      </div>
      <div className="absolute hdfc-static" style={{ left: '78px', top: '625px', fontSize: '10.5px' }}>
        (*Only applicable for Rs.50 cr &amp; above transaction for non-individual accounts)
      </div>

      {/* Beneficiary LEI Expiry Date (DDMMYYYY) */}
      <div className="absolute hdfc-static" style={{ left: '78px', top: '647px', fontSize: '13.9px' }}>
        LEI Expiry Date:
      </div>
      {/* 8 boxes at x=216, y=644, h=22, cw=25.5 */}
      <div className="absolute flex" style={{ left: '216px', top: '644px', width: '204px', height: '22px' }}>
        {'DDMMYYYY'.split('').map((ph, i) => (
          <div
            key={i}
            className={`hdfc-border flex items-center justify-center font-mono font-bold text-xs ${
              !isDataOnly ? 'border border-black' : ''
            }`}
            style={{ width: '25.5px', height: '22px' }}
          >
            {benLeiExpiryDigits[i] ? (
              <span className="text-black font-bold">{benLeiExpiryDigits[i]}</span>
            ) : !isDataOnly ? (
              <span className="text-slate-400 font-normal">{ph}</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Amount to be credited (in figures) & (In Words) */}
      <div className="absolute hdfc-static" style={{ left: '75px', top: '674px', fontSize: '13.9px' }}>
        Amount to be credited (in figures):
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '290px', top: '687px', width: '190px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '295px', top: '671px', width: '180px', fontSize: '13px' }}>
        {fmt(data.amount)}
      </div>

      <div className="absolute hdfc-static" style={{ left: '484px', top: '674px', fontSize: '13.9px' }}>
        (In Words):
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '555px', top: '687px', width: '233px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '558px', top: '670px', width: '230px', fontSize: '11px' }}>
        {wordsLine1}
      </div>

      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '75px', top: '706px', width: '713px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '80px', top: '692px', width: '705px', fontSize: '11px' }}>
        {wordsLine2}
      </div>

      {/* Remarks */}
      <div className="absolute hdfc-static" style={{ left: '75px', top: '708px', fontSize: '13.9px' }}>
        Remarks:
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '137px', top: '721px', width: '648px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '142px', top: '705px', width: '640px', fontSize: '12px' }}>
        {data.remarks}
      </div>

      {/* BANV (Beneficiary Bank Account Name Verification) Section */}
      <div className="absolute hdfc-static text-[9px] leading-tight" style={{ left: '75px', top: '740px', width: '715px' }}>
        <b>Beneficiary Bank Account Name Verification (BANV) (Not applicable for Indo-Nepal Remittance):</b> To ensure a smooth transaction, HDFC Bank requires you to confirm how the beneficiary's bank account name details should be verified. If you want HDFC Bank to process your transaction, then select either of one option.
      </div>

      {/* Option 1 */}
      <div
        className="absolute hdfc-border flex items-center justify-center font-bold text-[10px]"
        style={{ left: '62px', top: '769px', width: '12px', height: '12px', border: '1px solid #000' }}
      >
        {data.banvOption === '1' && <span className="leading-none">✓</span>}
      </div>
      <div className="absolute hdfc-static text-[9px] leading-[11px]" style={{ left: '78px', top: '767px', width: '712px' }}>
        <b>Option 1 – HDFC Bank to verify the beneficiary bank account name</b>
        <br />
        I/We have not verified the beneficiary's bank account name and request HDFC Bank to verify the same. If the verification fails due to any reason whatsoever including but not limited to mismatch in beneficiary bank account name with the details provided hereinabove, I/We authorise HDFC Bank to cancel the transaction and not to process it.
      </div>

      {/* Option 2 */}
      <div
        className="absolute hdfc-border flex items-center justify-center font-bold text-[10px]"
        style={{ left: '62px', top: '803px', width: '12px', height: '12px', border: '1px solid #000' }}
      >
        {data.banvOption === '2' && <span className="leading-none">✓</span>}
      </div>
      <div className="absolute hdfc-static text-[9px] leading-[11px]" style={{ left: '78px', top: '801px', width: '712px' }}>
        <b>Option 2 - Beneficiary bank account name is verified by the customer/remitter</b>
        <br />
        I/We have verified the beneficiary bank account number, IFSC code and the same belongs to the intended beneficiary, details given hereinabove. I/We authorise HDFC Bank to transfer the funds as per the request and details mentioned hereinabove at my/our own risk and consequences, even if the beneficiary's bank account name verification is not successful at Bank's end due to any reason. I/We shall not hold HDFC Bank responsible and liable for such remittance.
      </div>

      {/* Terms Agreement & Declaration */}
      <div className="absolute hdfc-static" style={{ left: '76px', top: '845px', fontSize: '13.5px', lineHeight: '18px' }}>
        <b>I/we agree to terms and conditions mentioned overleaf.</b> For Indo Nepal remittance. I/we declare that the
        <br />
        purpose of remittance is for above selected purpose only.
      </div>

      <div className="absolute hdfc-static" style={{ left: '76px', top: '883px', fontSize: '13.9px' }}>
        Signature of Authorized signatory
      </div>

      {/* Cyber Fraud Alert - Black Banner */}
      <div
        className="absolute hdfc-blk flex flex-col items-center justify-center text-center text-white font-bold"
        style={{
          left: '75px',
          top: '900px',
          width: '770px',
          height: '51px',
          backgroundColor: '#000000',
        }}
      >
        <div style={{ fontSize: '12.5px', lineHeight: '16px' }}>
          THERE IS NO SUCH THING AS DIGITAL ARREST. PAUSE AND STAY CALM.
        </div>
        <div style={{ fontSize: '12.5px', lineHeight: '16px' }}>
          REAL AUTHORITIES NEVER DEMAND MONEY ON VIDEO CALLS OR OVER TELEPHONE CALLS.
        </div>
        <div style={{ fontSize: '12.5px', lineHeight: '16px' }}>
          TALK TO OUR STAFF FOR ANY ASSISTANCE
        </div>
      </div>

      {/* Signatories lines */}
      {!isDataOnly && (
        <>
          <div className="absolute hdfc-border" style={{ left: '290px', top: '992px', width: '118px', borderTop: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '486px', top: '992px', width: '118px', borderTop: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '674px', top: '992px', width: '116px', borderTop: '1px solid #000' }} />
        </>
      )}
      <div className="absolute hdfc-static text-center" style={{ left: '290px', top: '997px', width: '118px', fontSize: '13.9px' }}>
        1st Signatory
      </div>
      <div className="absolute hdfc-static text-center" style={{ left: '486px', top: '997px', width: '118px', fontSize: '13.9px' }}>
        2nd Signatory
      </div>
      <div className="absolute hdfc-static text-center" style={{ left: '674px', top: '997px', width: '116px', fontSize: '13.9px' }}>
        3rd signatory
      </div>

      {/* For Bank Use Only Header */}
      <div
        className="absolute hdfc-static font-bold"
        style={{ left: '77px', top: '1010px', fontSize: '11.5px', textDecoration: 'underline' }}
      >
        For bank Use only
      </div>

      {/* Bank Use Only Table */}
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '77px', top: '1022px', width: '718px', height: '107px', border: '1px solid #000' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: `${i * 15.2}px`,
                width: '100%',
                borderTop: '1px solid #000',
              }}
            />
          ))}
          {/* Vertical divider at 446px (523 - 77) */}
          <div style={{ position: 'absolute', left: '446px', top: 0, width: '1px', height: '100%', background: '#000' }} />
        </div>
      )}

      {/* Bank Use Table Text */}
      <div className="absolute hdfc-static" style={{ left: '87px', top: '1024px', fontSize: '10px' }}>
        Processed by (Emp code and sign)
      </div>
      <div className="absolute hdfc-static" style={{ left: '528px', top: '1024px', fontSize: '10px' }}>
        Authorized by (Emp code and sign)
      </div>

      <div className="absolute hdfc-static" style={{ left: '87px', top: '1039px', fontSize: '10px' }}>
        DD / UTR No
      </div>
      <div className="absolute hdfc-static" style={{ left: '528px', top: '1039px', fontSize: '10px' }}>
        Ref No
      </div>

      <div className="absolute hdfc-static" style={{ left: '87px', top: '1054px', fontSize: '10px' }}>
        Charges Recovered Rs (applicable only for Non Customer):
      </div>
      <div className="absolute hdfc-static" style={{ left: '528px', top: '1054px', fontSize: '10px' }}>
        Day end Checked by
      </div>

      <div className="absolute hdfc-static" style={{ left: '87px', top: '1070px', fontSize: '10px' }}>
        Transaction Authorized by (2<sup>nd</sup> Level) (for amount &gt; 5 lacs):
      </div>

      <div className="absolute hdfc-static" style={{ left: '87px', top: '1085px', fontSize: '10px' }}>
        KYC documentation done by (only for Non-HDFC Bank Customers)
      </div>

      <div className="absolute hdfc-static" style={{ left: '87px', top: '1100px', fontSize: '10px' }}>
        BANV Status
      </div>
      {/* Success Box */}
      <div
        className="absolute hdfc-border"
        style={{ left: '270px', top: '1101px', width: '10px', height: '10px', border: '1px solid #000' }}
      />
      <div className="absolute hdfc-static" style={{ left: '284px', top: '1100px', fontSize: '10px' }}>
        Success
      </div>
      {/* Failed Box */}
      <div
        className="absolute hdfc-border"
        style={{ left: '345px', top: '1101px', width: '10px', height: '10px', border: '1px solid #000' }}
      />
      <div className="absolute hdfc-static" style={{ left: '360px', top: '1100px', fontSize: '10px' }}>
        Failed
      </div>

      <div className="absolute hdfc-static" style={{ left: '87px', top: '1115px', fontSize: '10px' }}>
        Remark for BANV:
      </div>

      {/* Vertical Form Code */}
      <div
        className="absolute hdfc-static"
        style={{
          left: '805px',
          top: '1060px',
          transform: 'translate(-50%, -50%) rotate(90deg)',
          fontSize: '9px',
          letterSpacing: '0.04em',
        }}
      >
        92929/13.03.2026_M019
      </div>

      {/* RTGS/NEFT Terms and conditions Paragraph */}
      <div
        className="absolute hdfc-static text-justify"
        style={{
          left: '77px',
          top: '1137px',
          width: '718px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '8.3px',
          lineHeight: '9.4px',
        }}
      >
        <b>RTGS / NEFT Terms and conditions:</b> (1) I / We hereby authorize HDFC Bank Ltd. to carry out the RTGS/NEFT transaction as per details mentioned above (Tick the appropriate field). (2) I / We hereby agree that the aforesaid details including the IFSC code and the beneficiary account are correct. (3) I / We further acknowledge that HDFC Bank accepts no liability for any consequences arising out of erroneous details provided by me/us. (4) I / We authorize the bank to debit my / our account with the charges plus taxes as applicable for this transaction. (5) I / We agree that requests submitted after the cut off time will be sent in next batch or next working day as applicable. (6) I/we agree that the credit will be affected to the beneficiary account number as per the details mentioned above and subject to the applicable RBI guidelines (7) I / We also understand that the remitting Bank shall not be liable for any loss of damage arising or resulting from delay in transmission delivery or non-delivery of Electronic message or any mistake, omission, or error in transmission or delivery thereof or in deciphering the message from any cause whatsoever or from its misinterpretation received or the action of the destination Bank or any act beyond the control. (8) I/We agree that incase of NEFT Transaction if we do not have an account with the bank, we will produce Original identification proof while giving the request. In case I/We submit form 60, we will also submit the address proof. (9) In case the RTGS and NEFT option is not ticked by us, I/We authorize you to execute the transaction <b>less than Rupees Two Lacs through NEFT and greater than or equal to Rupees Two Lacs through RTGS</b> and debit the charges as applicable
      </div>

      {/* Dashed Tear Line */}
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{
            left: 0,
            top: '1238px',
            width: '856px',
            borderTop: '1px dashed #000',
          }}
        />
      )}

      {/* ============================================================== */}
      {/* CUSTOMER'S COPY (Counterfoil at Bottom) */}
      {/* ============================================================== */}
      <div
        className="absolute hdfc-static font-bold"
        style={{ left: '52px', top: '1246px', fontSize: '12px', textDecoration: 'underline' }}
      >
        Customers Copy
      </div>

      {/* Row 1: Received application for RTGS / NEFT for an amount of Rs. ... vide Cash / Cheque number */}
      <div className="absolute hdfc-static" style={{ left: '52px', top: '1266px', fontSize: '11.3px' }}>
        Received application for RTGS / NEFT for an amount of Rs.
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '372px', top: '1278px', width: '123px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '376px', top: '1264px', width: '115px', fontSize: '11.5px' }}>
        {fmt(data.amount)}
      </div>

      <div className="absolute hdfc-static" style={{ left: '500px', top: '1266px', fontSize: '11.3px' }}>
        vide Cash / Cheque number
      </div>

      {/* Row 2: Chq no ... to be credited to Account number ... of ... */}
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '52px', top: '1298px', width: '85px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '54px', top: '1284px', width: '80px', fontSize: '11.5px' }}>
        {data.chequeNo}
      </div>

      <div className="absolute hdfc-static" style={{ left: '142px', top: '1286px', fontSize: '11.3px' }}>
        to be credited to Account number
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '330px', top: '1298px', width: '150px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '334px', top: '1284px', width: '145px', fontSize: '11.5px' }}>
        {data.beneficiaryAccountNo}
      </div>

      <div className="absolute hdfc-static" style={{ left: '486px', top: '1286px', fontSize: '11.3px' }}>
        of
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '497px', top: '1298px', width: '150px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold text-slate-900 uppercase" style={{ left: '501px', top: '1284px', width: '145px', fontSize: '11px' }}>
        {data.beneficiaryBankBranch}
      </div>

      {/* Row 3: Bank with IFSC Code ... Customers will be guided by the Terms... */}
      <div className="absolute hdfc-static" style={{ left: '52px', top: '1312px', fontSize: '11.3px' }}>
        Bank with IFSC Code
      </div>
      {!isDataOnly && (
        <div className="absolute hdfc-border" style={{ left: '162px', top: '1324px', width: '108px', borderTop: '1px solid #000' }} />
      )}
      <div className="absolute font-bold font-mono text-slate-900 uppercase" style={{ left: '166px', top: '1310px', width: '102px', fontSize: '11.5px' }}>
        {data.beneficiaryIfsc}
      </div>

      <div className="absolute hdfc-static" style={{ left: '273px', top: '1312px', fontSize: '11.3px' }}>
        . Customers will be guided by the Terms and Conditions mentioned in the form.
      </div>

      {/* Row 4: Liability disclaimer */}
      <div className="absolute hdfc-static" style={{ left: '52px', top: '1330px', fontSize: '11.3px' }}>
        HDFC Bank will accept no liability for any consequences arising out of eronous details provided by the Customer.
      </div>

      {/* NetBanking reminder */}
      <div className="absolute hdfc-static font-bold" style={{ left: '52px', top: '1352px', fontSize: '11.3px' }}>
        Request for DD / RTGS and NEFT can also be placed using NetBanking
      </div>

      {/* Bank Seal Circle */}
      {!isDataOnly && (
        <div
          className="absolute hdfc-border flex flex-col items-center justify-center font-bold text-center"
          style={{
            left: '722px',
            top: '1262px',
            width: '64px',
            height: '56px',
            borderRadius: '28px',
            border: '1px solid #000',
          }}
        >
          <div style={{ fontSize: '13px', lineHeight: '14px' }}>Bank</div>
          <div style={{ fontSize: '13px', lineHeight: '14px' }}>Seal</div>
        </div>
      )}

      {/* For HDFC Bank */}
      <div
        className="absolute hdfc-static font-bold"
        style={{ left: '716px', top: '1334px', fontSize: '12px' }}
      >
        For HDFC Bank
      </div>

      {/* PTO */}
      <div
        className="absolute hdfc-static"
        style={{ left: '820px', top: '1375px', fontSize: '11px' }}
      >
        PTO
      </div>
    </div>
  );
};
