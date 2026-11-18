import { INDIA_RTO_RECORDS, RTO_BY_CODE, RtoRecord } from '../data/rtoDatabase';
import { HISTORICAL_STATE_CODE_REMAP, STATE_UT_BY_CODE } from '../data/statesAndUts';

export interface ParsedRegistrationResult {
  isFullPlate: boolean;
  isBhSeries: boolean;
  bhYear?: string;
  normalizedRtoCode: string | null;
  stateCode: string | null;
  rtoNumber: string | null;
  seriesLetters: string | null;
  vehicleNumber: string | null;
  remappedNote?: string;
}

/**
 * Normalizes any RTO code input like "ka19", "KA 19", "ka-19", "DL1" -> "KA-19", "DL-01".
 */
export function normalizeRtoCodeInput(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[\s_.-]+/g, '');
  const match = cleaned.match(/^([A-Z]{2})0*([1-9][0-9]?|0)$/);
  if (!match) return null;
  const statePrefix = match[1];
  const numPart = match[2].padStart(2, '0');
  return `${statePrefix}-${numPart}`;
}

/**
 * Extracts RTO code and registration breakdown from a full Indian vehicle number plate
 * (e.g. KA19AB1234, KA-19-AB-1234, MH12DE1433, DL01CA1234, 22BH1234AA).
 * Only parses structure locally—does NOT query Vahan or retrieve owner/RC records.
 */
export function parseVehicleRegistrationInput(raw: string): ParsedRegistrationResult {
  const compact = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Check Bharat (BH) Series format: YY BH #### XX
  const bhMatch = compact.match(/^(\d{2})BH(\d{4})([A-Z]{1,2})$/);
  if (bhMatch) {
    return {
      isFullPlate: true,
      isBhSeries: true,
      bhYear: `20${bhMatch[1]}`,
      normalizedRtoCode: null,
      stateCode: 'BH',
      rtoNumber: null,
      seriesLetters: bhMatch[3],
      vehicleNumber: bhMatch[2],
    };
  }

  // Standard Indian plate: SS NN [L..LLL] NNNN
  const fullPlateMatch = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/);
  if (fullPlateMatch) {
    const stateCode = fullPlateMatch[1];
    const rtoNumber = fullPlateMatch[2].padStart(2, '0');
    const normalizedRtoCode = `${stateCode}-${rtoNumber}`;
    const remap = HISTORICAL_STATE_CODE_REMAP[stateCode];
    return {
      isFullPlate: true,
      isBhSeries: false,
      normalizedRtoCode,
      stateCode,
      rtoNumber,
      seriesLetters: fullPlateMatch[3],
      vehicleNumber: fullPlateMatch[4],
      ...(remap ? { remappedNote: remap.label } : {}),
    };
  }

  // Older/short Delhi/special prefix like DL1C1234 or DL-01-C-1234 already covered above,
  // Now check plain RTO code input (KA19, KA-19, KA 19, DL1)
  const normalizedCode = normalizeRtoCodeInput(raw);
  if (normalizedCode) {
    const [stateCode, rtoNumber] = normalizedCode.split('-');
    const remap = HISTORICAL_STATE_CODE_REMAP[stateCode];
    return {
      isFullPlate: false,
      isBhSeries: false,
      normalizedRtoCode: normalizedCode,
      stateCode,
      rtoNumber,
      seriesLetters: null,
      vehicleNumber: null,
      ...(remap ? { remappedNote: remap.label } : {}),
    };
  }

  return {
    isFullPlate: false,
    isBhSeries: false,
    normalizedRtoCode: null,
    stateCode: null,
    rtoNumber: null,
    seriesLetters: null,
    vehicleNumber: null,
  };
}

export interface SearchEvaluation {
  parsed: ParsedRegistrationResult;
  exactMatch: RtoRecord | null;
  unverifiedCodeInfo: {
    code: string;
    stateName: string;
    stateCode: string;
    reason: string;
  } | null;
  isInvalidCodePattern: boolean;
  matches: RtoRecord[];
  suggestions: RtoRecord[];
}

export function evaluateRtoSearch(
  rawQuery: string,
  pool: RtoRecord[] = INDIA_RTO_RECORDS,
  byCodeMap: Map<string, RtoRecord> = RTO_BY_CODE
): SearchEvaluation {
  const trimmed = rawQuery.trim();
  const parsed = parseVehicleRegistrationInput(trimmed);

  if (!trimmed) {
    return {
      parsed,
      exactMatch: null,
      unverifiedCodeInfo: null,
      isInvalidCodePattern: false,
      matches: pool,
      suggestions: [],
    };
  }

  // BH series special handling
  if (parsed.isBhSeries) {
    return {
      parsed,
      exactMatch: null,
      unverifiedCodeInfo: null,
      isInvalidCodePattern: false,
      matches: [],
      suggestions: [],
    };
  }

  // Exact RTO code match (from direct code OR full vehicle number plate)
  if (parsed.normalizedRtoCode) {
    const direct = byCodeMap.get(parsed.normalizedRtoCode) ?? null;

    // If user typed historical prefix like OR-02 or UA-07 that might also map to OD-02 / UK-07
    let resolvedRecord = direct;
    if (!resolvedRecord && parsed.stateCode && HISTORICAL_STATE_CODE_REMAP[parsed.stateCode]) {
      const remappedCode = `${HISTORICAL_STATE_CODE_REMAP[parsed.stateCode].currentCode}-${parsed.rtoNumber}`;
      resolvedRecord = byCodeMap.get(remappedCode) ?? null;
    }

    if (resolvedRecord) {
      const inPool = pool.some((r) => r.code === resolvedRecord.code);
      return {
        parsed,
        exactMatch: inPool ? resolvedRecord : null,
        unverifiedCodeInfo: null,
        isInvalidCodePattern: false,
        matches: inPool ? [resolvedRecord] : [],
        suggestions: [],
      };
    }

    // Looks like a valid SS-NN format, check if state prefix exists
    const stateCode = parsed.stateCode ?? '';
    const stateInfo = STATE_UT_BY_CODE[stateCode];
    if (stateInfo) {
      const sameStateSuggestions = pool
        .filter((r) => r.state === stateInfo.state)
        .slice(0, 6);
      return {
        parsed,
        exactMatch: null,
        unverifiedCodeInfo: {
          code: parsed.normalizedRtoCode,
          stateName: stateInfo.state,
          stateCode: stateInfo.stateCode,
          reason: `No verified RTO office in ${stateInfo.state} (${stateInfo.stateCode}) matches ${parsed.normalizedRtoCode} in our current local registry. Sequential numbers are not assumed to be active RTOs.`,
        },
        isInvalidCodePattern: false,
        matches: [],
        suggestions: sameStateSuggestions,
      };
    }

    return {
      parsed,
      exactMatch: null,
      unverifiedCodeInfo: null,
      isInvalidCodePattern: true,
      matches: [],
      suggestions: pool.slice(0, 6),
    };
  }

  // General text search across code, city, district, state, stateCode, officeName
  const qLower = trimmed.toLowerCase();
  const qCompact = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const scored: Array<{ record: RtoRecord; score: number }> = [];
  for (const rec of pool) {
    const codeCompact = rec.code.replace('-', '');
    const cityLower = rec.city.toLowerCase();
    const districtLower = rec.district.toLowerCase();
    const stateLower = rec.state.toLowerCase();
    const officeLower = rec.officeName.toLowerCase();
    const stateCodeUpper = rec.stateCode.toUpperCase();

    let score = 0;
    if (codeCompact === qCompact || rec.code === trimmed.toUpperCase()) score += 120;
    else if (codeCompact.startsWith(qCompact) && qCompact.length >= 2) score += 90;
    else if (cityLower === qLower) score += 85;
    else if (cityLower.startsWith(qLower)) score += 70;
    else if (districtLower === qLower) score += 65;
    else if (stateLower === qLower || stateCodeUpper === trimmed.toUpperCase()) score += 60;
    else if (cityLower.includes(qLower)) score += 45;
    else if (districtLower.includes(qLower)) score += 40;
    else if (officeLower.includes(qLower)) score += 35;
    else if (stateLower.includes(qLower)) score += 30;
    else if (codeCompact.includes(qCompact) && qCompact.length >= 2) score += 25;

    if (score > 0) {
      scored.push({ record: rec, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.record.code.localeCompare(b.record.code));
  const matches = scored.map((s) => s.record);

  // If no direct matches, check if query looks like an invalid code pattern (e.g. XX99, 12345)
  const looksLikeInvalidCode = /^[A-Z]{2}[- ]?\d{1,2}$/i.test(trimmed) || /^\d{3,}$/.test(trimmed);

  // Build helpful suggestions when empty
  let suggestions: RtoRecord[] = [];
  if (matches.length === 0) {
    const prefix2 = trimmed.slice(0, 2).toUpperCase();
    if (STATE_UT_BY_CODE[prefix2]) {
      suggestions = pool
        .filter((r) => r.state === STATE_UT_BY_CODE[prefix2].state)
        .slice(0, 6);
    } else if (qLower.length >= 3) {
      const sub = qLower.slice(0, 3);
      suggestions = pool
        .filter(
          (r) =>
            r.city.toLowerCase().includes(sub) ||
            r.district.toLowerCase().includes(sub) ||
            r.state.toLowerCase().includes(sub)
        )
        .slice(0, 6);
    }
    if (suggestions.length === 0) {
      suggestions = pool
        .filter((r) => ['KA-19', 'MH-12', 'DL-01', 'TN-09', 'KL-07', 'KA-01'].includes(r.code))
        .slice(0, 6);
    }
  }

  return {
    parsed,
    exactMatch: null,
    unverifiedCodeInfo: null,
    isInvalidCodePattern: matches.length === 0 && looksLikeInvalidCode,
    matches,
    suggestions,
  };
}
