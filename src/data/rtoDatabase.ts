import { RTO_RECORDS_PART_1 } from './rtoRecordsPart1';
import { RTO_RECORDS_PART_2 } from './rtoRecordsPart2';
import { INDIA_STATES_AND_UTS, STATE_UT_BY_CODE, StateUtInfo } from './statesAndUts';

export type RtoRecordStatus = 'active' | 'historical';
export type RtoVerificationStatus = 'verified' | 'unverified';

export interface RtoRecord {
  code: string;
  state: string;
  stateCode: string;
  officeName: string;
  district: string;
  city: string;
  address: string;
  source: string;
  lastVerified: string;
  status: RtoRecordStatus;
  verificationStatus: RtoVerificationStatus;
  note?: string;
}

const rawCombined: RtoRecord[] = [...RTO_RECORDS_PART_1, ...RTO_RECORDS_PART_2];

// Deduplicate strictly by normalized uppercase RTO code to ensure zero duplicate entries
const seenCodes = new Set<string>();
export const INDIA_RTO_RECORDS: RtoRecord[] = rawCombined
  .filter((record) => {
    const key = record.code.toUpperCase();
    if (seenCodes.has(key)) return false;
    seenCodes.add(key);
    return true;
  })
  .sort((a, b) => a.code.localeCompare(b.code));

export const RTO_BY_CODE: Map<string, RtoRecord> = new Map(
  INDIA_RTO_RECORDS.map((rec) => [rec.code.toUpperCase(), rec])
);

export interface StateDirectorySummary extends StateUtInfo {
  totalVerifiedCount: number;
  activeCount: number;
  historicalCount: number;
  records: RtoRecord[];
}

export const STATE_DIRECTORY_SUMMARIES: StateDirectorySummary[] = INDIA_STATES_AND_UTS.map(
  (info) => {
    const codesForState = new Set<string>([
      info.stateCode,
      ...(info.alternateCodes ?? []),
    ]);
    const records = INDIA_RTO_RECORDS.filter(
      (rec) => codesForState.has(rec.stateCode) || rec.state === info.state
    );
    const activeCount = records.filter((r) => r.status === 'active').length;
    const historicalCount = records.filter((r) => r.status === 'historical').length;
    return {
      ...info,
      totalVerifiedCount: records.length,
      activeCount,
      historicalCount,
      records,
    };
  }
);

export function getTerritoryTypeForRecord(record: RtoRecord) {
  return STATE_UT_BY_CODE[record.stateCode]?.territoryType ?? 'State';
}

export const DATASET_METADATA = {
  totalRecords: INDIA_RTO_RECORDS.length,
  activeRecords: INDIA_RTO_RECORDS.filter((r) => r.status === 'active').length,
  historicalRecords: INDIA_RTO_RECORDS.filter((r) => r.status === 'historical').length,
  statesAndUtsCovered: STATE_DIRECTORY_SUMMARIES.filter((s) => s.totalVerifiedCount > 0).length,
  totalStatesAndUts: INDIA_STATES_AND_UTS.length,
  lastVerified: '2026-11-17',
};
