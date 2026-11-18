/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HdfcDdFormData, RenderMode } from '../types';
import { wordsCurrency } from '../utils/numberToWords';

interface HdfcDdSlipReplicaProps {
  data: HdfcDdFormData;
  mode: RenderMode;
}

const fmt = (n: number | ''): string => {
  if (n === '' || typeof n !== 'number' || isNaN(n)) return '';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const dm = (v: string): string => {
  if (!v) return '';
  return v.split('-').reverse().join('/');
};

export const HdfcDdSlipReplica: React.FC<HdfcDdSlipReplicaProps> = ({ data, mode }) => {
  const isDataOnly = mode === 'data';

  const amtNum = typeof data.amount === 'number' ? data.amount : 0;
  const wordsEng = amtNum > 0 ? wordsCurrency(amtNum) : '';

  return (
    <div
      id="hdfc-dd-slip-canvas"
      style={{
        width: '850px',
        height: '1400px',
        position: 'relative',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '13.4px',
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
            left: 0,
            top: 0,
            width: '849px',
            height: '1399px',
            border: '1px solid #000',
          }}
        />
      )}

      {/* Title */}
      <div
        className="absolute hdfc-static font-bold text-center"
        style={{
          left: '425px',
          top: '67px',
          transform: 'translateX(-50%)',
          fontSize: '15.5px',
        }}
      >
        DD Application Form
      </div>
      <div
        className="absolute hdfc-static text-center"
        style={{
          left: '425px',
          top: '88px',
          transform: 'translateX(-50%)',
          fontSize: '12.5px',
        }}
      >
        (Application form to accompany cheque only.
      </div>
      <div
        className="absolute hdfc-static font-bold text-center"
        style={{
          left: '425px',
          top: '107px',
          transform: 'translateX(-50%)',
          fontSize: '12.5px',
        }}
      >
        For DD in cash, separate form to be used)
      </div>

      {/* Date & Branch */}
      <div className="absolute hdfc-static" style={{ left: '63px', top: '163px' }}>
        Date :
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '105px', top: '178px', width: '180px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold text-slate-900" style={{ left: '108px', top: '161px', width: '175px' }}>
        {dm(data.date)}
      </div>

      <div className="absolute hdfc-static" style={{ left: '520px', top: '163px' }}>
        Branch :-
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '580px', top: '178px', width: '208px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold uppercase text-slate-900" style={{ left: '585px', top: '161px', width: '200px' }}>
        {data.branch}
      </div>

      {/* Please Issue (Tick as Applicable) */}
      <div className="absolute hdfc-static" style={{ left: '63px', top: '193px' }}>
        Please Issue <b>(Tick as Applicable)</b>
      </div>

      {/* Checkbox Demand Draft */}
      <div
        className="absolute hdfc-border flex items-center justify-center font-bold text-xs"
        style={{ left: '67px', top: '225px', width: '12px', height: '12px', border: '1px solid #000' }}
      >
        {data.isDdChecked && <span className="text-[13px] leading-none">✓</span>}
      </div>
      <div className="absolute hdfc-static" style={{ left: '90px', top: '222px' }}>
        Demand Draft payable at
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '247px', top: '238px', width: '163px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold uppercase text-slate-900" style={{ left: '252px', top: '220px', width: '155px' }}>
        {data.payableAt}
      </div>

      {/* Favoring */}
      <div className="absolute hdfc-static" style={{ left: '67px', top: '256px' }}>
        Favoring
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '123px', top: '271px', width: '662px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold uppercase text-slate-900" style={{ left: '128px', top: '254px', width: '655px' }}>
        {data.favoring}
      </div>

      {/* For amount Rs. (in figures) */}
      <div className="absolute hdfc-static" style={{ left: '67px', top: '284px' }}>
        For amount Rs.
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '163px', top: '299px', width: '262px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '168px', top: '282px', width: '255px' }}>
        {fmt(data.amount)}
      </div>

      <div className="absolute hdfc-static" style={{ left: '430px', top: '284px' }}>
        (in figures)
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '498px', top: '299px', width: '287px', borderTop: '1px solid #000' }}
        />
      )}

      {/* Amount (In words) */}
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '67px', top: '327px', width: '655px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute hdfc-static" style={{ left: '724px', top: '312px' }}>
        (In words)
      </div>
      <div
        className="absolute font-bold text-slate-900"
        style={{ left: '70px', top: '310px', width: '650px', fontSize: '12.5px' }}
      >
        {wordsEng}
      </div>

      {/* Mode of Payment :- Cheque No. */}
      <div className="absolute hdfc-static" style={{ left: '67px', top: '339px' }}>
        Mode of Payment :- Cheque No.
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '275px', top: '354px', width: '508px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '280px', top: '337px', width: '500px' }}>
        {data.chequeNo}
      </div>

      {/* Purchaser Name */}
      <div className="absolute hdfc-static" style={{ left: '67px', top: '367px' }}>
        Purchaser Name:
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '180px', top: '382px', width: '601px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold uppercase text-slate-900" style={{ left: '185px', top: '365px', width: '595px' }}>
        {data.purchaserName}
      </div>

      {/* Delivery Instructions */}
      <div className="absolute hdfc-static" style={{ left: '66px', top: '396px' }}>
        Please deliver the Demand Draft to Mr / Ms.
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '340px', top: '411px', width: '208px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold uppercase text-slate-900" style={{ left: '345px', top: '394px', width: '200px' }}>
        {data.deliverTo}
      </div>

      <div className="absolute hdfc-static" style={{ left: '552px', top: '396px' }}>
        Whose signature
      </div>
      <div className="absolute hdfc-static" style={{ left: '66px', top: '419px' }}>
        is appended below
      </div>

      {/* Signatures Row 1 */}
      {!isDataOnly && (
        <>
          <div className="absolute hdfc-border" style={{ left: '88px', top: '521px', width: '148px', borderTop: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '616px', top: '521px', width: '150px', borderTop: '1px solid #000' }} />
        </>
      )}
      <div className="absolute hdfc-static text-center" style={{ left: '88px', top: '524px', width: '148px' }}>
        Bearer's Signature
      </div>
      <div className="absolute hdfc-static text-center" style={{ left: '616px', top: '524px', width: '150px' }}>
        Customer's signature
        <br />
        (Purchaser)
      </div>

      {/* Receipt Acknowledgment */}
      <div className="absolute hdfc-static" style={{ left: '66px', top: '601px' }}>
        I acknowledge Receipt of the DD as requested
      </div>
      {!isDataOnly && (
        <>
          <div className="absolute hdfc-border" style={{ left: '88px', top: '655px', width: '148px', borderTop: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '616px', top: '655px', width: '150px', borderTop: '1px solid #000' }} />
        </>
      )}
      <div className="absolute hdfc-static text-center" style={{ left: '88px', top: '660px', width: '148px' }}>
        Signature of Recipient
      </div>
      <div className="absolute hdfc-static text-center" style={{ left: '616px', top: '656px', width: '150px' }}>
        Customer's Name
        <br />
        (Purchaser)
      </div>

      {/* Cheque & Account Enclosure Clauses */}
      <div className="absolute hdfc-static" style={{ left: '66px', top: '732px' }}>
        I / We enclose Cheque no.
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '232px', top: '748px', width: '118px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold font-mono text-slate-900" style={{ left: '235px', top: '730px', width: '112px' }}>
        {data.chequeNo}
      </div>
      <div className="absolute hdfc-static" style={{ left: '354px', top: '732px' }}>
        drawn on my /our above account in favour of “ HDFC Bank Ltd for DD.
      </div>

      <div className="absolute hdfc-static" style={{ left: '66px', top: '754px' }}>
        I / We Authorize you to Debit my / our above account towards issuance of the above DD through Cheque .
      </div>

      <div className="absolute hdfc-static" style={{ left: '66px', top: '775px' }}>
        I / We further authorize you to debit the aforesaid account for the service charges / tax, as applicable.
      </div>

      <div className="absolute hdfc-static" style={{ left: '66px', top: '795px' }}>
        I / We acknowledge that in case I / we have issued single cheque / instruction for debit to my / our account for issuing
      </div>
      <div className="absolute hdfc-static" style={{ left: '66px', top: '815px' }}>
        more than one Demand Draft, then the same will effect as multiple debit entries in my / our account.
      </div>

      {/* Dark Warning Banner (Digital Arrest / Third Party Fraud) */}
      <div
        className="absolute hdfc-blk flex flex-col items-center justify-center text-center text-white font-bold"
        style={{
          left: '66px',
          top: '860px',
          width: '718px',
          height: '84px',
          backgroundColor: '#3b3b3b',
          letterSpacing: '1px',
          fontSize: '10.6px',
          lineHeight: '16px',
        }}
      >
        <div>
          DO NOT FALL VICTIM TO ONLINE OFFERS FROM THIRD PARTIES REQUESTING PHOTOCOPIES OR IMAGES OF
        </div>
        <div>DRAFTS FOR BUSINESS DEALS OR UNDER THREAT OF DIGITAL ARREST</div>
        <div>THERE IS NO THING AS DIGITAL ARREST .PAUSE AND STAY CALM.</div>
        <div>TALK TO OUR STAFF FOR ANY ASSISTANCE</div>
      </div>

      {/* For Bank Use Only */}
      <div
        className="absolute hdfc-static font-bold"
        style={{ left: '74px', top: '982px', textDecoration: 'underline' }}
      >
        For bank Use only
      </div>

      {/* Bank Table */}
      {!isDataOnly && (
        <>
          {/* Top row */}
          <div className="absolute hdfc-border" style={{ left: '74px', top: '1003px', width: '459px', height: '81px', border: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '533px', top: '1003px', width: '258px', height: '81px', border: '1px solid #000' }} />

          {/* Subsequent rows */}
          <div className="absolute hdfc-border" style={{ left: '74px', top: '1084px', width: '459px', height: '20px', border: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '533px', top: '1084px', width: '258px', height: '20px', border: '1px solid #000' }} />

          <div className="absolute hdfc-border" style={{ left: '74px', top: '1104px', width: '459px', height: '20px', border: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '533px', top: '1104px', width: '258px', height: '20px', border: '1px solid #000' }} />

          <div className="absolute hdfc-border" style={{ left: '74px', top: '1124px', width: '459px', height: '21px', border: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '533px', top: '1124px', width: '258px', height: '21px', border: '1px solid #000' }} />

          <div className="absolute hdfc-border" style={{ left: '74px', top: '1145px', width: '459px', height: '23px', border: '1px solid #000' }} />
          <div className="absolute hdfc-border" style={{ left: '533px', top: '1145px', width: '258px', height: '23px', border: '1px solid #000' }} />
        </>
      )}

      {/* Table text */}
      <div className="absolute hdfc-static" style={{ left: '84px', top: '1008px' }}>
        Processed by (Emp code and sign)
      </div>
      <div
        className="absolute hdfc-border"
        style={{ left: '537px', top: '1006px', width: '11px', height: '11px', border: '1px solid #000' }}
      />
      <div className="absolute hdfc-static text-[8.8px]" style={{ left: '552px', top: '1007px' }}>
        Mandatory UCIC and Banned Dedupe
      </div>
      <div className="absolute hdfc-static text-[13px]" style={{ left: '551px', top: '1030px' }}>
        Authorized by (Emp code and sign)
      </div>

      <div className="absolute hdfc-static text-[13px]" style={{ left: '84px', top: '1086px' }}>
        DD / UTR No
      </div>
      <div className="absolute hdfc-static text-[13px]" style={{ left: '551px', top: '1086px' }}>
        Ref No
      </div>

      <div className="absolute hdfc-static text-[13px]" style={{ left: '84px', top: '1106px' }}>
        Charges Recovered Rs (applicable only for Non Customer):
      </div>
      <div className="absolute hdfc-static text-[13px]" style={{ left: '551px', top: '1106px' }}>
        Day end Checked by
      </div>

      <div className="absolute hdfc-static text-[13px]" style={{ left: '84px', top: '1126px' }}>
        Transaction Authorized by (2<sup>nd</sup> Level) (for amount &gt; 5 lacs).
      </div>

      <div className="absolute hdfc-static text-[13px]" style={{ left: '84px', top: '1147px' }}>
        KYC documentation done by (only for Non-HDFC Bank Customers)
      </div>

      {/* Dashed Tear Line */}
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{
            left: 0,
            top: '1236px',
            width: '850px',
            borderTop: '1px dashed #000',
          }}
        />
      )}

      {/* ============================================================== */}
      {/* CUSTOMER'S COPY (Counterfoil at Bottom) */}
      {/* ============================================================== */}
      <div
        className="absolute hdfc-static font-bold text-[11px]"
        style={{ left: '67px', top: '1257px', textDecoration: 'underline' }}
      >
        Customers Copy
      </div>
      <div className="absolute hdfc-static text-[11px]" style={{ left: '67px', top: '1273px' }}>
        (To be produced by customer while collecting DD from bank)
      </div>

      {/* Row 1: DD for Rs ... Drawn on ... */}
      <div className="absolute hdfc-static text-[11px]" style={{ left: '67px', top: '1290px' }}>
        DD for Rs.
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '118px', top: '1301px', width: '112px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold font-mono text-[11px] text-slate-900" style={{ left: '122px', top: '1288px', width: '105px' }}>
        {fmt(data.amount)}
      </div>

      <div className="absolute hdfc-static text-[11px]" style={{ left: '233px', top: '1290px' }}>
        Drawn on
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '283px', top: '1301px', width: '105px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold text-[11px] text-slate-900" style={{ left: '286px', top: '1288px', width: '100px' }}>
        {dm(data.chequeDate)}
      </div>

      {/* Row 2: Chq No: */}
      <div className="absolute hdfc-static text-[11px]" style={{ left: '67px', top: '1307px' }}>
        Chq No:
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '108px', top: '1318px', width: '117px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold font-mono text-[11px] text-slate-900" style={{ left: '112px', top: '1305px', width: '110px' }}>
        {data.chequeNo}
      </div>

      {/* Row 3: Customer Name: */}
      <div className="absolute hdfc-static text-[11px]" style={{ left: '67px', top: '1324px' }}>
        Customer Name:
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '152px', top: '1335px', width: '145px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold uppercase text-[11px] text-slate-900" style={{ left: '155px', top: '1322px', width: '140px' }}>
        {data.purchaserName}
      </div>

      {/* Row 4: Customers A/c number */}
      <div className="absolute hdfc-static text-[11px]" style={{ left: '67px', top: '1341px' }}>
        Customers A/c number
      </div>
      {!isDataOnly && (
        <div
          className="absolute hdfc-border"
          style={{ left: '180px', top: '1352px', width: '172px', borderTop: '1px solid #000' }}
        />
      )}
      <div className="absolute font-bold font-mono tracking-wider text-[11px] text-slate-900" style={{ left: '184px', top: '1339px', width: '168px' }}>
        {data.accountNo}
      </div>

      {/* Row 5: NetBanking reminder */}
      <div className="absolute hdfc-static font-bold text-[11px]" style={{ left: '67px', top: '1358px' }}>
        Request for DD / RTGS and NEFT can also be placed using NetBanking
      </div>

      {/* Bank Seal Circle */}
      {!isDataOnly && (
        <div
          className="absolute hdfc-border flex flex-col items-center justify-center font-bold text-center"
          style={{
            left: '719px',
            top: '1262px',
            width: '70px',
            height: '70px',
            borderRadius: '35px',
            border: '1px solid #000',
          }}
        >
          <div style={{ fontSize: '14px', lineHeight: '16px', textDecoration: 'underline' }}>Bank</div>
          <div style={{ fontSize: '14px', lineHeight: '16px', textDecoration: 'underline' }}>Seal</div>
        </div>
      )}

      {/* For HDFC Bank */}
      <div
        className="absolute hdfc-static font-bold text-[12px]"
        style={{ left: '710px', top: '1338px' }}
      >
        For HDFC Bank
      </div>
    </div>
  );
};
