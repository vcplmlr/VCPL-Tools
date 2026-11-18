/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const SbiNeftBackSide: React.FC = () => {
  return (
    <div
      id="sbi-neft-back-canvas"
      className="relative bg-white text-black select-none shrink-0"
      style={{
        width: '1568px',
        height: '540px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '14px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '531px',
          top: '66px',
          width: '990px',
          height: '390px',
          border: '1px solid #000000',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '531px',
          top: '84px',
          width: '990px',
          textAlign: 'center',
          font: '700 24px Arial, sans-serif',
        }}
      >
        Application for RTGS/NEFT Remittance
      </div>
      <div
        style={{
          position: 'absolute',
          left: '531px',
          top: '100px',
          width: '990px',
          borderTop: '1px solid #000000',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '541px',
          top: '112px',
          width: '972px',
          whiteSpace: 'normal',
          font: '14.4px/19px Arial, sans-serif',
          textAlign: 'justify',
        }}
      >
        <strong>Conditions for Transfer</strong>
        <br />
        1. All payment instructions be carefully checked by the remitter. As crediting the proceeds of the remittance is based on the beneficiary’s account number, the name of the bank and its branch SBI shall not be responsible if these particulars are not provided correctly by the remitter.
        <br />
        2. Applications/Message received after the business hours will be sent only the immediate next working day.
        <br />
        3. SBI shall not be responsible for any delay in processing of the payment due to RBI/RTGS/NEFT system not being available/failure of internal communication system at the recipient bank/branch/incorrect information provided by the remitter/Any incorrect credit accorded by the recipient bank/branch due to incorrect information provided by the remitter.
        <br />
        4. (i) Remitting branch shall not be liable for any or damage resulting from delay in transmission delivery or non-delivery of electronics message or any mistake, omission or error in transmission or delivery thereof or in encrypting/decrypting the message for any cause whatsoever or from misinterpretation when received or for the action of the destination bank or for any act beyond the control of State Bank of India.
        <br />
        &nbsp;&nbsp;&nbsp;(ii) If the recipient branch is closed for any reason, the account shall be credited on the immediate next working day.
        <br />
        &nbsp;&nbsp;&nbsp;(iii) Bank is free recover charges in respect of remittance returned on account of family/inadequate information.
        <br />
        5. I/We have fully read the terms and conditions of the RTGS/NEFT remittance and shall abide by the same.
      </div>
      <div
        style={{
          position: 'absolute',
          left: '1335px',
          top: '444px',
          font: '14.4px Arial, sans-serif',
          fontWeight: 600,
        }}
      >
        (Signature of applicant(s))
      </div>
    </div>
  );
};
