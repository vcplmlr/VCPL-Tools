export type TerritoryType = 'State' | 'Union Territory';

export interface StateUtInfo {
  state: string;
  stateCode: string;
  alternateCodes?: string[];
  territoryType: TerritoryType;
  capitalOrHq: string;
  prefixNote?: string;
}

export const INDIA_STATES_AND_UTS: StateUtInfo[] = [
  // 28 States
  {
    state: 'Andhra Pradesh',
    stateCode: 'AP',
    territoryType: 'State',
    capitalOrHq: 'Amaravati / Vijayawada',
    prefixNote: 'Unified AP-39 / AP-40 state-wide series introduced alongside regional codes.',
  },
  {
    state: 'Arunachal Pradesh',
    stateCode: 'AR',
    territoryType: 'State',
    capitalOrHq: 'Itanagar',
  },
  {
    state: 'Assam',
    stateCode: 'AS',
    territoryType: 'State',
    capitalOrHq: 'Dispur / Guwahati',
  },
  {
    state: 'Bihar',
    stateCode: 'BR',
    territoryType: 'State',
    capitalOrHq: 'Patna',
  },
  {
    state: 'Chhattisgarh',
    stateCode: 'CG',
    territoryType: 'State',
    capitalOrHq: 'Raipur',
  },
  {
    state: 'Goa',
    stateCode: 'GA',
    territoryType: 'State',
    capitalOrHq: 'Panaji',
    prefixNote: 'GA-01 and GA-02 were superseded by GA-07 (Panaji) and GA-08 (Margao) for regular series.',
  },
  {
    state: 'Gujarat',
    stateCode: 'GJ',
    territoryType: 'State',
    capitalOrHq: 'Gandhinagar',
  },
  {
    state: 'Haryana',
    stateCode: 'HR',
    territoryType: 'State',
    capitalOrHq: 'Chandigarh',
  },
  {
    state: 'Himachal Pradesh',
    stateCode: 'HP',
    territoryType: 'State',
    capitalOrHq: 'Shimla',
  },
  {
    state: 'Jharkhand',
    stateCode: 'JH',
    territoryType: 'State',
    capitalOrHq: 'Ranchi',
  },
  {
    state: 'Karnataka',
    stateCode: 'KA',
    territoryType: 'State',
    capitalOrHq: 'Bengaluru',
  },
  {
    state: 'Kerala',
    stateCode: 'KL',
    territoryType: 'State',
    capitalOrHq: 'Thiruvananthapuram',
  },
  {
    state: 'Madhya Pradesh',
    stateCode: 'MP',
    territoryType: 'State',
    capitalOrHq: 'Bhopal',
  },
  {
    state: 'Maharashtra',
    stateCode: 'MH',
    territoryType: 'State',
    capitalOrHq: 'Mumbai',
  },
  {
    state: 'Manipur',
    stateCode: 'MN',
    territoryType: 'State',
    capitalOrHq: 'Imphal',
  },
  {
    state: 'Meghalaya',
    stateCode: 'ML',
    territoryType: 'State',
    capitalOrHq: 'Shillong',
  },
  {
    state: 'Mizoram',
    stateCode: 'MZ',
    territoryType: 'State',
    capitalOrHq: 'Aizawl',
  },
  {
    state: 'Nagaland',
    stateCode: 'NL',
    territoryType: 'State',
    capitalOrHq: 'Kohima',
  },
  {
    state: 'Odisha',
    stateCode: 'OD',
    alternateCodes: ['OR'],
    territoryType: 'State',
    capitalOrHq: 'Bhubaneswar',
    prefixNote: 'Odisha transitioned from OR to OD in 2012; pre-2012 OR plates remain valid.',
  },
  {
    state: 'Punjab',
    stateCode: 'PB',
    territoryType: 'State',
    capitalOrHq: 'Chandigarh',
  },
  {
    state: 'Rajasthan',
    stateCode: 'RJ',
    territoryType: 'State',
    capitalOrHq: 'Jaipur',
  },
  {
    state: 'Sikkim',
    stateCode: 'SK',
    territoryType: 'State',
    capitalOrHq: 'Gangtok',
  },
  {
    state: 'Tamil Nadu',
    stateCode: 'TN',
    territoryType: 'State',
    capitalOrHq: 'Chennai',
  },
  {
    state: 'Telangana',
    stateCode: 'TG',
    alternateCodes: ['TS'],
    territoryType: 'State',
    capitalOrHq: 'Hyderabad',
    prefixNote: 'Telangana changed its prefix from TS to TG in 2024; existing TS plates remain valid.',
  },
  {
    state: 'Tripura',
    stateCode: 'TR',
    territoryType: 'State',
    capitalOrHq: 'Agartala',
  },
  {
    state: 'Uttar Pradesh',
    stateCode: 'UP',
    territoryType: 'State',
    capitalOrHq: 'Lucknow',
  },
  {
    state: 'Uttarakhand',
    stateCode: 'UK',
    alternateCodes: ['UA'],
    territoryType: 'State',
    capitalOrHq: 'Dehradun',
    prefixNote: 'Uttarakhand changed its prefix from UA (Uttaranchal) to UK in 2007.',
  },
  {
    state: 'West Bengal',
    stateCode: 'WB',
    territoryType: 'State',
    capitalOrHq: 'Kolkata',
  },

  // 8 Union Territories
  {
    state: 'Andaman and Nicobar Islands',
    stateCode: 'AN',
    territoryType: 'Union Territory',
    capitalOrHq: 'Sri Vijaya Puram (Port Blair)',
  },
  {
    state: 'Chandigarh',
    stateCode: 'CH',
    territoryType: 'Union Territory',
    capitalOrHq: 'Chandigarh',
  },
  {
    state: 'Dadra and Nagar Haveli and Daman and Diu',
    stateCode: 'DD',
    alternateCodes: ['DN'],
    territoryType: 'Union Territory',
    capitalOrHq: 'Daman',
    prefixNote: 'Includes DD (Daman & Diu) and DN (Dadra & Nagar Haveli) prefixes.',
  },
  {
    state: 'Delhi',
    stateCode: 'DL',
    territoryType: 'Union Territory',
    capitalOrHq: 'New Delhi',
  },
  {
    state: 'Jammu and Kashmir',
    stateCode: 'JK',
    territoryType: 'Union Territory',
    capitalOrHq: 'Srinagar / Jammu',
    prefixNote: 'JK-07 (Kargil) and JK-10 (Leh) were succeeded by LA-02 and LA-01 after Ladakh became a UT in 2019.',
  },
  {
    state: 'Ladakh',
    stateCode: 'LA',
    territoryType: 'Union Territory',
    capitalOrHq: 'Leh',
    prefixNote: 'Formed in 2019; older Leh/Kargil vehicles carry JK-10 and JK-07 plates.',
  },
  {
    state: 'Lakshadweep',
    stateCode: 'LD',
    territoryType: 'Union Territory',
    capitalOrHq: 'Kavaratti',
  },
  {
    state: 'Puducherry',
    stateCode: 'PY',
    territoryType: 'Union Territory',
    capitalOrHq: 'Puducherry',
  },
];

export const STATE_UT_BY_CODE: Record<string, StateUtInfo> = INDIA_STATES_AND_UTS.reduce<
  Record<string, StateUtInfo>
>((acc, item) => {
  acc[item.stateCode] = item;
  item.alternateCodes?.forEach((alt) => {
    acc[alt] = item;
  });
  return acc;
}, {});

export const HISTORICAL_STATE_CODE_REMAP: Record<string, { currentCode: string; label: string }> = {
  OR: { currentCode: 'OD', label: 'Historical Odisha code (renamed to OD in 2012)' },
  UA: { currentCode: 'UK', label: 'Historical Uttaranchal code (renamed to UK in 2007)' },
  TS: { currentCode: 'TG', label: 'Previous Telangana code (replaced by TG in 2024)' },
  DN: { currentCode: 'DD', label: 'Dadra and Nagar Haveli prefix (merged UT with Daman and Diu)' },
};
