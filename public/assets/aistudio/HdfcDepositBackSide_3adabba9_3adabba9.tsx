/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const HdfcDepositBackSide: React.FC = () => {
  return (
    <div
      id="hdfc-deposit-back-canvas"
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
      {/* LEFT SECTION: CONDITIONS (ENGLISH)                        */}
      {/* ========================================================= */}
      <div
        className="absolute font-bold whitespace-nowrap text-center text-black"
        style={{
          left: '497px',
          top: '44px',
          transform: 'translate(-50%, -50%)',
          fontSize: '16px',
          letterSpacing: '1px',
        }}
      >
        CONDITIONS
      </div>

      <div
        className="absolute text-black text-justify"
        style={{
          left: '65px',
          top: '76px',
          width: '862px',
          font: '13.7px/18.2px Arial',
        }}
      >
        1. Items deposited are subject to subsequent verification and scrutiny for any discrepancies which will be notified to the account holder. 
        2. This pay-in-slip is only a record of deposits over the counter and does not purport to be a credit advice. Credits will be reflected in the statement of account. 
        3. Items drawn on other bank / branches in the city will be sent for clearing as per clearing house rules / directives. 
        4. Items payable outside city of deposit will be sent for collection and proceeds credited on realisation. Items which are purchased/ discounted at the deposit holders request will be sent for collection for realisation. If the payment of the item is not received, the Bank reserves the right to debit the depositor’s account, the amount of the item including any charges. Interest or out of pocket expenses on receipt of notice of dishonour and/or after a pre-determined period to be decided by the bank, 
        5. The bank acts only as the account holders collecting agent and assumes no responsibility for the realisation of the items or the genuineness, validity and correctness of any signature and endorsement appearing thereon. Payment of items returned unpaid for any reason whatsoever will be charged back to the account irrespective of whether such items are returned to the account holder, 
        6. PAN Number must be mentioned in the space provided for all Cash deposits greater than Rs. 49,999/-.  
        7. For NRO Accounts: Please provide proof of eligibility of funds for cash/cheque being deposited in the NRO Account.  
        8. <b>Collection of Foreign Currency Cheques/DD/Postal Order:</b> These instruments are governed by clearing rules / of respective Payee country and they reserve the right to return the instruments anytime. On account of such returns, Bank reserves right to debit Depositors account even after crediting of proceeds (after realization) of such instrument, at prevailing exchange rate, charges and interest.
      </div>

      <div
        className="absolute font-bold text-black"
        style={{ left: '65px', top: '361px', font: '700 14px Arial' }}
      >
        Instruction :
      </div>

      <div
        className="absolute text-black"
        style={{
          left: '65px',
          top: '389px',
          width: '862px',
          transform: 'translateY(-50%)',
          font: '14px/18px Arial',
        }}
      >
        • Please Quote your Account Number/Credit Card Number on reverse of the cheque • Please use separate slips for cash/transfer cheques / local cheques &amp; outstation cheques • Please ensure that name mentioned on the cheques matches with the account title maintained with us
      </div>

      {/* Ka Daw Box */}
      <div
        className="absolute border-2 border-black"
        style={{
          left: '65px',
          top: '420px',
          width: '862px',
          height: '150px',
        }}
      />
      <div
        className="absolute font-serif text-black"
        style={{ left: '84px', top: '449px', fontSize: '12px' }}
      >
        Ka daw:
      </div>
      <div
        className="absolute border-t border-black"
        style={{ left: '142px', top: '453px', width: '770px' }}
      />
      <div
        className="absolute font-serif text-black whitespace-nowrap"
        style={{ left: '84px', top: '481px', width: '830px', fontSize: '9.8px' }}
      >
        Nga pynskhem ka ka pisa nokot ba thep kam long ka jingsiew ba iadei bad ka jingtyrwa kam, ban kam ia ka jingioh na ka khalai nusip/ki khusnam/ki jingai-sngewbha/ka jingioh ka hiar pateng
      </div>
      <div
        className="absolute font-serif text-black whitespace-nowrap"
        style={{ left: '84px', top: '520px', fontSize: '11.5px' }}
      >
        Ka jingsoi I Nongthep:__________________________________ &nbsp;Ka kyrteng I Nongthep: ____________________________ &nbsp;Ka jingiadei bad I trai ka account: ______________
      </div>
      <div
        className="absolute font-serif text-black"
        style={{ left: '84px', top: '558px', fontSize: '12px' }}
      >
        Ka nombar phone:
      </div>

      {/* Vertical Dashed Center Line */}
      <div
        className="absolute"
        style={{
          left: '975px',
          top: 0,
          height: '610px',
          borderLeft: '1px dashed #000',
        }}
      />

      {/* Vertical Reference Text */}
      <div
        className="absolute text-black"
        style={{
          left: '948px',
          top: '270px',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          fontSize: '15px',
          letterSpacing: '1px',
        }}
      >
        RMTL
      </div>
      <div
        className="absolute text-black"
        style={{
          left: '948px',
          top: '455px',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          fontSize: '15px',
        }}
      >
        9328/11.12.2019
      </div>

      {/* ========================================================= */}
      {/* RIGHT SECTION: KI KYNDON (KHASI)                          */}
      {/* ========================================================= */}
      <div
        className="absolute font-serif whitespace-nowrap text-center text-black"
        style={{
          left: '1275px',
          top: '36px',
          transform: 'translate(-50%, -50%)',
          fontSize: '15px',
          letterSpacing: '1px',
        }}
      >
        KI KYNDON
      </div>

      <div
        className="absolute text-black leading-snug"
        style={{
          left: '1005px',
          top: '55px',
          width: '540px',
          font: '11.4px/14.2px Arial',
        }}
      >
        1. Ki jingthep ki lah ban shah peit thuh bad peit bniah na ka bynta kano kano ka jingbym-biang ia kiba yn sa pyntip sha I trai ka account.<br />
        2. Kane ka ‘pay-in-slip’ ka long tang ka dulir ia ki jingthep lyngba ka counter bad ym lah ban kam ia kane kum kata ka ‘credit advice’. Ia ki Credit yn sa pynpaw ha ka ‘statement of account’.<br />
        3. Ia ki jingthep ba dei na kiwei ki bank/ki bnah na ka bynta ka clearing kat kum ki rul/ki jingpynbeit jong ka bank.<br />
        4. Ia ki jingthep ba na shabar kane ka nongbah yn sa phah ban lum bad ia ka jingioh yn sa pynpaw haba lah ioh ia kita. Ia kiei kiei kiba lah theid lane kiba lah pynduna dor kat kum ka jingpan jong I nongthep, yn sa phah ban lum ban ioh ia kita. Lada ym ioh ia kita, ka Bank ka bat ia ka hok ban khate na ka account jong I nongthep kynthup ruh kino kino ki ‘charges’. Ka sut lane kiwei kiwei ki jinglut haba ioh ia ka notis ba ym shym pdiang bad/lane ha ka por ba lah iakut lypa ia kaba kan rai ka bank.<br />
        5. Ka bank ka long tang ka ‘nongleitlum’ na ka bynta ki nongthep bad kam shim kano kano ka jingbahkhlieh na ka bynta ka jingbiang jong kiei kiei ba la lum lane na ka bynta ka, jingshisha, ka ‘validity’ bad ka jingbiang jong ka jingsoi bad ka ‘endorsement’ kaba don ha kita. Ia ka jingpynphai ia kiei kiei khlem ka jingsiew na kano kano ruh ka daw yn khate na ka ‘account’ khlem da kheiñ ba kita ki dei kiba lah pynphai sha I trai ka ‘account’.<br />
        6. Ia ka PAN Nombar yn hap ban thoh ha ka jaka ba la buh na ka bynta ka pisa nokot ba thep ba palat T. 49,999/-.<br />
        7. Na ka bynta ki NRO Account: Sngewbha ai ka sabut ban pynshisha ia ka jingdonhok ban ioh thep ia ki pisa nokot/ki shek ha ka NRO Account.<br />
        8. <b>Ka jinglum ia ki Foreign Currency Shek/ki DD/ki Postal Order:</b> Ia kine la kynthup hapoh ki ‘clearing rules’ / jong ki ‘Payee Country’ bad kine ki bat ia ka hok ban pynphai ia kine ha kano kano ka por. Na ka daw jong kine ki jingpynphai, ka Bank ka bat ia ka hok ban khate na ka ‘account’ I Nongthep wat hadien ba lah kyntiew ia kine ki jingioh ha ka khata jong i(hadien ba ioh ia kine) jong kita ki ‘instrument’, kat kum ka dor ia-bujli pisa ba kheiñ ba kato ka por, ki ‘charges’ bad ka sut.
      </div>

      <div
        className="absolute font-bold font-serif text-black"
        style={{ left: '1005px', top: '475px', font: '700 12px serif' }}
      >
        Ka Jingbthah :
      </div>

      <div
        className="absolute text-black"
        style={{
          left: '1005px',
          top: '490px',
          width: '540px',
          font: '11.4px/14.2px Arial',
        }}
      >
        1. Sngewbha thoh ka Account Nombar/Credit Card Nombar jong phi sha lyndet jong ka shek.<br />
        2. Sngewbha pyndonkam ki slip la ki jong-ki jong na ka bynta ka pisa nokot/ki transfer shek/ki shek na kane ka shnong bad ki shek na ka shabar shnong.<br />
        3. Sngewbha pynthikna ba ka kyrteng ba thoh ha ki shek ka iadei bad ka kyrteng ha ka account ba don bad ngi.
      </div>
    </div>
  );
};
