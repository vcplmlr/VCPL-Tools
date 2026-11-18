export interface BankMergerInfo {
  legacyCode: string;
  legacyBankName: string;
  successorBankName: string;
  successorPrefix: string;
  effectiveNote: string;
}

export const RBI_BANK_SECTOR_LABELS: Record<string, string> = {
  PSB: 'Public Sector Bank',
  PVB: 'Private Sector Bank',
  RRB: 'Regional Rural Bank',
  SFB: 'Small Finance Bank',
  PB: 'Payments Bank',
  'O-UCB': 'Urban Co-operative Bank',
  'S-UCB': 'Scheduled Co-operative Bank',
  'Co-op': 'Co-operative Bank',
  SCB: 'State Co-operative Bank',
  DCCB: 'District Central Co-operative Bank',
  Foreign: 'Foreign Bank',
  LAB: 'Local Area Bank',
};

export const RBI_AMALGAMATED_BANKS: Record<string, BankMergerInfo> = {
  SBMY: {
    legacyCode: 'SBMY',
    legacyBankName: 'State Bank of Mysore',
    successorBankName: 'State Bank of India',
    successorPrefix: 'SBIN',
    effectiveNote: 'Merged into State Bank of India (effective April 1, 2017; old IFSCs discontinued).',
  },
  SBHY: {
    legacyCode: 'SBHY',
    legacyBankName: 'State Bank of Hyderabad',
    successorBankName: 'State Bank of India',
    successorPrefix: 'SBIN',
    effectiveNote: 'Merged into State Bank of India (effective April 1, 2017; old IFSCs discontinued).',
  },
  STBP: {
    legacyCode: 'STBP',
    legacyBankName: 'State Bank of Patiala',
    successorBankName: 'State Bank of India',
    successorPrefix: 'SBIN',
    effectiveNote: 'Merged into State Bank of India (effective April 1, 2017; old IFSCs discontinued).',
  },
  SBBJ: {
    legacyCode: 'SBBJ',
    legacyBankName: 'State Bank of Bikaner and Jaipur',
    successorBankName: 'State Bank of India',
    successorPrefix: 'SBIN',
    effectiveNote: 'Merged into State Bank of India (effective April 1, 2017; old IFSCs discontinued).',
  },
  SBTR: {
    legacyCode: 'SBTR',
    legacyBankName: 'State Bank of Travancore',
    successorBankName: 'State Bank of India',
    successorPrefix: 'SBIN',
    effectiveNote: 'Merged into State Bank of India (effective April 1, 2017; old IFSCs discontinued).',
  },
  BMBL: {
    legacyCode: 'BMBL',
    legacyBankName: 'Bharatiya Mahila Bank',
    successorBankName: 'State Bank of India',
    successorPrefix: 'SBIN',
    effectiveNote: 'Merged into State Bank of India (effective April 1, 2017).',
  },
  VIJB: {
    legacyCode: 'VIJB',
    legacyBankName: 'Vijaya Bank',
    successorBankName: 'Bank of Baroda',
    successorPrefix: 'BARB',
    effectiveNote: 'Amalgamated into Bank of Baroda (effective April 1, 2019; new BARB0VJ* IFSCs issued).',
  },
  BKDN: {
    legacyCode: 'BKDN',
    legacyBankName: 'Dena Bank',
    successorBankName: 'Bank of Baroda',
    successorPrefix: 'BARB',
    effectiveNote: 'Amalgamated into Bank of Baroda (effective April 1, 2019; new BARB0DN* IFSCs issued).',
  },
  SYNB: {
    legacyCode: 'SYNB',
    legacyBankName: 'Syndicate Bank',
    successorBankName: 'Canara Bank',
    successorPrefix: 'CNRB',
    effectiveNote: 'Amalgamated into Canara Bank (effective April 1, 2020; legacy SYNB codes replaced by CNRB001* in 2021).',
  },
  ALLA: {
    legacyCode: 'ALLA',
    legacyBankName: 'Allahabad Bank',
    successorBankName: 'Indian Bank',
    successorPrefix: 'IDIB',
    effectiveNote: 'Amalgamated into Indian Bank (effective April 1, 2020; legacy ALLA codes migrated to IDIB).',
  },
  ORBC: {
    legacyCode: 'ORBC',
    legacyBankName: 'Oriental Bank of Commerce',
    successorBankName: 'Punjab National Bank',
    successorPrefix: 'PUNB',
    effectiveNote: 'Amalgamated into Punjab National Bank (effective April 1, 2020; legacy ORBC codes migrated to PUNB).',
  },
  UTBI: {
    legacyCode: 'UTBI',
    legacyBankName: 'United Bank of India',
    successorBankName: 'Punjab National Bank',
    successorPrefix: 'PUNB',
    effectiveNote: 'Amalgamated into Punjab National Bank (effective April 1, 2020; legacy UTBI codes migrated to PUNB).',
  },
  ANDB: {
    legacyCode: 'ANDB',
    legacyBankName: 'Andhra Bank',
    successorBankName: 'Union Bank of India',
    successorPrefix: 'UBIN',
    effectiveNote: 'Amalgamated into Union Bank of India (effective April 1, 2020; legacy ANDB codes migrated to UBIN08*).',
  },
  CORP: {
    legacyCode: 'CORP',
    legacyBankName: 'Corporation Bank',
    successorBankName: 'Union Bank of India',
    successorPrefix: 'UBIN',
    effectiveNote: 'Amalgamated into Union Bank of India (effective April 1, 2020; legacy CORP codes migrated to UBIN09*).',
  },
  VYSA: {
    legacyCode: 'VYSA',
    legacyBankName: 'ING Vysya Bank',
    successorBankName: 'Kotak Mahindra Bank',
    successorPrefix: 'KKBK',
    effectiveNote: 'Merged into Kotak Mahindra Bank (effective April 1, 2015).',
  },
  LAVB: {
    legacyCode: 'LAVB',
    legacyBankName: 'Lakshmi Vilas Bank',
    successorBankName: 'DBS Bank India Limited',
    successorPrefix: 'DBSS',
    effectiveNote: 'Amalgamated into DBS Bank India Limited (effective November 27, 2020).',
  },
};

export function inferBankCategory(bankCode: string, bankName: string, banksJsonType?: string): string {
  if (banksJsonType && RBI_BANK_SECTOR_LABELS[banksJsonType]) {
    return RBI_BANK_SECTOR_LABELS[banksJsonType];
  }
  const upperName = bankName.toUpperCase();
  const upperCode = bankCode.toUpperCase();

  if (
    ['SBIN', 'BARB', 'PUNB', 'CNRB', 'UBIN', 'BKID', 'IDIB', 'CBIN', 'IOBA', 'UCBA', 'MAHB', 'PSIB'].includes(
      upperCode
    )
  ) {
    return 'Public Sector Bank';
  }
  if (upperName.includes('PAYMENTS BANK') || ['AIRP', 'JIOP', 'FINO', 'IPOS', 'NSDL', 'PYTM'].includes(upperCode)) {
    return 'Payments Bank';
  }
  if (upperName.includes('SMALL FINANCE')) {
    return 'Small Finance Bank';
  }
  if (upperName.includes('GRAMIN') || upperName.includes('RURAL BANK') || upperName.includes('KSHETRIYA')) {
    return 'Regional Rural Bank';
  }
  if (
    upperName.includes('CO-OP') ||
    upperName.includes('COOP') ||
    upperName.includes('SAHAKARI') ||
    upperName.includes('NAGRIK') ||
    upperName.includes('URBAN BANK') ||
    upperName.includes('APEX BANK')
  ) {
    return 'Co-operative Bank';
  }
  if (
    [
      'HDFC', 'ICIC', 'UTIB', 'KKBK', 'INDB', 'YESB', 'IDFB', 'FDRL', 'RATN', 'BDBL',
      'IBKL', 'SIBL', 'KVBL', 'CIUB', 'TMBL', 'KARB', 'JAKA', 'DCBL', 'CSBK', 'DLXB', 'NTBL',
    ].includes(upperCode)
  ) {
    return 'Private Sector Bank';
  }
  if (
    ['CITI', 'HSBC', 'SCBL', 'DEUT', 'DBSS', 'BARC', 'BNPA', 'SOGE', 'MHCB', 'BOTM', 'CHAS', 'ABNA', 'BBKM'].includes(
      upperCode
    )
  ) {
    return 'Foreign Bank';
  }
  if (banksJsonType) return banksJsonType;
  return 'RBI-Regulated Bank';
}
