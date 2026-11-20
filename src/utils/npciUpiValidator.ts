/**
 * NPCI UPI Deep Linking & BharatQR / UPI Intent URL Specification Validator
 * Validates generated `upi://pay?...` URIs before QR matrix rendering to ensure
 * compatibility with Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay & Bank Apps.
 */

export interface NpciUpiCheckItem {
  id:
    | 'scheme'
    | 'params'
    | 'pa'
    | 'pn'
    | 'cu'
    | 'am'
    | 'tr-tn'
    | 'mc'
    | 'tpap-compat';
  label: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'pass';
  statusText: string;
  detail: string;
}

export interface NpciUpiValidationResult {
  isValid: boolean;
  tpapCompatible: boolean;
  normalizedUri: string;
  parsedParams: Record<string, string>;
  errors: string[];
  warnings: string[];
  checks: NpciUpiCheckItem[];
}

export interface BuildNpciUpiIntentInput {
  pa: string;
  pn: string;
  am?: number | string;
  cu?: string;
  tr?: string;
  tn?: string;
  mc?: string;
  mode?: string;
  purpose?: string;
}

const KNOWN_EMAIL_ONLY_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.in',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'live.com',
  'rediffmail.com',
]);

const KNOWN_VPA_HANDLES = new Set([
  'okhdfcbank',
  'okaxis',
  'okicici',
  'oksbi',
  'ybl',
  'ibl',
  'axl',
  'paytm',
  'pthdfc',
  'ptaxis',
  'ptsbi',
  'ptyes',
  'hdfcbank',
  'icici',
  'sbi',
  'axisbank',
  'kotak',
  'upi',
  'apl',
  'rapl',
  'waaxis',
  'wahdfcbank',
  'waicici',
  'wasbi',
  'ikwik',
  'barodampay',
  'cnrb',
  'pnb',
  'unionbank',
  'boi',
  'indianbank',
  'indus',
  'idfcbank',
  'federal',
  'aubank',
  'jupiteraxis',
  'sliceaxis',
  'naviaxis',
  'fkaxis',
  'freecharge',
  'pingpay',
  'payzapp',
  'kbl',
  'sib',
  'tmb',
  'cub',
  'rbl',
  'bandhan',
  'airtel',
  'jio',
  'ippb',
  'postbank',
  'hsbc',
  'sc',
  'citi',
  'dbs',
]);

export function sanitizeNpciPayeeName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9 ._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

export function sanitizeNpciNote(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9 ._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

export function sanitizeNpciRef(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9._-]/g, '')
    .trim()
    .slice(0, 35);
}

/**
 * Builds an NPCI-compliant `upi://pay?...` URI using strict RFC 3986 `%20`
 * encoding (never `+`) and preserving literal `@` in `pa` so Google Pay,
 * PhonePe, Paytm, and BHIM parse every field reliably.
 */
export function buildNpciUpiIntentUrl(input: BuildNpciUpiIntentInput): string {
  const pa = input.pa.replace(/\s+/g, '').trim().toLowerCase();
  const pn = sanitizeNpciPayeeName(input.pn);
  if (!pa || !pn) return '';

  const parts: string[] = [
    `pa=${pa}`,
    `pn=${encodeURIComponent(pn)}`,
  ];

  const numericAmount =
    typeof input.am === 'number'
      ? input.am
      : typeof input.am === 'string' && input.am.trim()
      ? Number.parseFloat(input.am)
      : 0;

  if (Number.isFinite(numericAmount) && numericAmount > 0) {
    parts.push(`am=${(Math.round(numericAmount * 100) / 100).toFixed(2)}`);
  }

  parts.push(`cu=${(input.cu || 'INR').trim().toUpperCase()}`);

  const cleanTr = input.tr ? sanitizeNpciRef(input.tr) : '';
  if (cleanTr) {
    parts.push(`tr=${encodeURIComponent(cleanTr)}`);
  }

  const cleanTn = input.tn ? sanitizeNpciNote(input.tn) : '';
  if (cleanTn) {
    parts.push(`tn=${encodeURIComponent(cleanTn)}`);
  }

  const cleanMc = (input.mc || '').trim();
  if (cleanMc && /^\d{4}$/.test(cleanMc) && !pa.endsWith('.ifsc.npci')) {
    parts.push(`mc=${cleanMc}`);
    if (input.mode) parts.push(`mode=${input.mode}`);
    if (input.purpose) parts.push(`purpose=${input.purpose}`);
  }

  return `upi://pay?${parts.join('&')}`;
}

function safeDecode(segment: string): { ok: boolean; value: string } {
  if (/%(?![0-9A-Fa-f]{2})/.test(segment)) {
    return { ok: false, value: segment };
  }
  try {
    return { ok: true, value: decodeURIComponent(segment) };
  } catch {
    return { ok: false, value: segment };
  }
}

/**
 * Validates an assembled `upi://pay?...` URI against NPCI UPI Linking & QR rules
 * before rendering the QR code matrix.
 */
export function validateNpciUpiIntentUrl(rawUri: string): NpciUpiValidationResult {
  const uri = rawUri.trim();
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedParams: Record<string, string> = {};
  const checks: NpciUpiCheckItem[] = [];

  if (!uri) {
    return {
      isValid: false,
      tpapCompatible: false,
      normalizedUri: '',
      parsedParams: {},
      errors: ['Empty UPI intent URI.'],
      warnings: [],
      checks: [
        {
          id: 'scheme',
          label: 'NPCI Intent Scheme (upi://pay)',
          passed: false,
          severity: 'error',
          statusText: 'Pending',
          detail: 'Waiting for complete payee details to construct upi://pay URI.',
        },
      ],
    };
  }

  // 1. Scheme & overall URI structure
  const hasValidPrefix = uri.startsWith('upi://pay?');
  const hasWhitespaceOrFragment = /\s|#/.test(uri);
  const lengthOk = uri.length <= 500;
  const schemePassed = hasValidPrefix && !hasWhitespaceOrFragment && lengthOk;

  if (!hasValidPrefix) {
    errors.push('URI must begin strictly with lowercase "upi://pay?".');
  } else if (hasWhitespaceOrFragment) {
    errors.push('UPI intent URL must not contain raw spaces, newlines, or "#" fragments.');
  } else if (!lengthOk) {
    errors.push(`UPI intent URL exceeds 500 chars (${uri.length}), risking QR scan failures.`);
  }

  checks.push({
    id: 'scheme',
    label: 'NPCI Intent Scheme (upi://pay?)',
    passed: schemePassed,
    severity: schemePassed ? 'pass' : 'error',
    statusText: schemePassed ? `Valid (${uri.length}B)` : 'Invalid',
    detail: schemePassed
      ? `Clean upi://pay intent structure (${uri.length}/500 chars).`
      : 'Must start with upi://pay? without unencoded spaces or fragments.',
  });

  // 2. Query Parameter Parsing & RFC 3986 Encoding Check
  const queryPart = hasValidPrefix ? uri.slice('upi://pay?'.length) : '';
  const rawPairs = queryPart ? queryPart.split('&') : [];
  const duplicateKeys: string[] = [];
  const badEncodingKeys: string[] = [];
  const plusEncodedKeys: string[] = [];
  const seenKeys = new Set<string>();

  for (const pair of rawPairs) {
    if (!pair) {
      badEncodingKeys.push('empty-param');
      continue;
    }
    const eqIdx = pair.indexOf('=');
    if (eqIdx <= 0) {
      badEncodingKeys.push(pair);
      continue;
    }
    const key = pair.slice(0, eqIdx);
    const rawVal = pair.slice(eqIdx + 1);
    if (seenKeys.has(key)) {
      duplicateKeys.push(key);
    }
    seenKeys.add(key);

    if (rawVal.includes('+')) {
      plusEncodedKeys.push(key);
    }
    const decoded = safeDecode(rawVal);
    if (!decoded.ok) {
      badEncodingKeys.push(key);
    }
    parsedParams[key] = decoded.value;
  }

  const paramsPassed =
    Boolean(queryPart) &&
    duplicateKeys.length === 0 &&
    badEncodingKeys.length === 0 &&
    plusEncodedKeys.length === 0;

  if (duplicateKeys.length > 0) {
    errors.push(`Duplicate NPCI parameters detected: ${duplicateKeys.join(', ')}.`);
  }
  if (badEncodingKeys.length > 0) {
    errors.push(`Malformed query parameters or percent-encoding: ${badEncodingKeys.join(', ')}.`);
  }
  if (plusEncodedKeys.length > 0) {
    errors.push(
      `Parameters (${plusEncodedKeys.join(', ')}) use "+" instead of RFC 3986 "%20", which breaks GPay/PhonePe parsing.`
    );
  }

  checks.push({
    id: 'params',
    label: 'RFC 3986 Query Integrity & %20 Encoding',
    passed: paramsPassed,
    severity: paramsPassed ? 'pass' : 'error',
    statusText: paramsPassed ? 'Clean' : 'Syntax Error',
    detail: paramsPassed
      ? `${rawPairs.length} unique parameters verified with strict %20 encoding.`
      : 'Ensure unique parameters and RFC 3986 %20 space encoding (never "+").',
  });

  // 3. Payee VPA (`pa`) Validation
  const rawPaPair = rawPairs.find((p) => p.startsWith('pa='));
  const rawPaVal = rawPaPair ? rawPaPair.slice(3) : '';
  const pa = (parsedParams.pa || '').trim();
  const paHasPercent40 = /%40/i.test(rawPaVal);
  const paRegexOk = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(pa);
  const atIndex = pa.indexOf('@');
  const paHandle = atIndex >= 0 ? pa.slice(atIndex + 1).toLowerCase() : '';
  const isIfscNpci = paHandle.endsWith('.ifsc.npci');
  const isEmailDomainMistake = KNOWN_EMAIL_ONLY_DOMAINS.has(paHandle);
  const isIfscNpciFormatOk = isIfscNpci
    ? /^\d{9,18}@[a-z]{4}0[a-z0-9]{6}\.ifsc\.npci$/.test(rawPaVal)
    : false;

  let paPassed = Boolean(pa) && !paHasPercent40 && paRegexOk && !isEmailDomainMistake;
  if (isIfscNpci && !isIfscNpciFormatOk) {
    paPassed = false;
  }

  if (!pa) {
    errors.push('Missing mandatory "pa" (Payee VPA) parameter in UPI intent URL.');
  } else if (paHasPercent40) {
    errors.push('Parameter "pa" encodes "@" as "%40"; GPay/PhonePe require literal "@".');
  } else if (!paRegexOk) {
    errors.push(`Invalid "pa" address "${pa}": expected username@bankhandle.`);
  } else if (isEmailDomainMistake) {
    errors.push(`"${pa}" uses an email domain (@${paHandle}) instead of a UPI PSP handle.`);
  } else if (isIfscNpci && !isIfscNpciFormatOk) {
    errors.push('Direct bank VPA must match lowercase <9-18 digit account>@<11-char ifsc>.ifsc.npci.');
  } else if (!isIfscNpci && !KNOWN_VPA_HANDLES.has(paHandle) && !paHandle.includes('.')) {
    warnings.push(`Unrecognized PSP handle "@${paHandle}" — confirm this handle is active on your bank.`);
  }

  checks.push({
    id: 'pa',
    label: 'Mandatory "pa" (Payee Address & Literal @)',
    passed: paPassed,
    severity: paPassed ? 'pass' : 'error',
    statusText: paPassed ? (isIfscNpci ? '.ifsc.npci Valid' : 'Verified') : 'Failed',
    detail: paPassed
      ? `${pa}${KNOWN_VPA_HANDLES.has(paHandle) ? ' · Known PSP Handle' : ''}`
      : 'Requires valid username@bankhandle with literal "@".',
  });

  // 4. Payee Name (`pn`) Validation
  const pn = (parsedParams.pn || '').trim();
  const pnPassed = pn.length >= 2 && pn.length <= 99;
  if (!pn) {
    errors.push('Missing mandatory "pn" (Payee / Beneficiary Name) parameter.');
  } else if (pn.length < 2 || pn.length > 99) {
    errors.push('Parameter "pn" must be 2 to 99 characters per NPCI specification.');
  }

  checks.push({
    id: 'pn',
    label: 'Mandatory "pn" (Payee Name ≤ 99 chars)',
    passed: pnPassed,
    severity: pnPassed ? 'pass' : 'error',
    statusText: pnPassed ? 'Verified' : 'Failed',
    detail: pnPassed ? `"${pn}" (${pn.length} chars)` : 'Missing or invalid payee name length.',
  });

  // 5. Currency (`cu`) Validation
  const cu = (parsedParams.cu || '').trim();
  const cuPassed = cu === 'INR';
  if (!cu) {
    errors.push('Missing mandatory "cu=INR" currency parameter.');
  } else if (cu !== 'INR') {
    errors.push(`Unsupported UPI currency "${cu}": NPCI requires strictly "cu=INR".`);
  }

  checks.push({
    id: 'cu',
    label: 'Mandatory "cu=INR" Currency Lock',
    passed: cuPassed,
    severity: cuPassed ? 'pass' : 'error',
    statusText: cuPassed ? 'INR' : 'Invalid',
    detail: cuPassed ? 'Strictly locked to INR.' : 'NPCI requires cu=INR.',
  });

  // 6. Optional Amount (`am`) Validation
  const hasAm = Object.prototype.hasOwnProperty.call(parsedParams, 'am');
  const amRaw = hasAm ? parsedParams.am.trim() : '';
  let amPassed = true;
  let amNumeric = 0;

  if (hasAm) {
    if (!/^\d+(\.\d{1,2})?$/.test(amRaw)) {
      amPassed = false;
      errors.push(`Invalid "am" value "${amRaw}": must be numeric with at most 2 decimals (e.g. 500.00).`);
    } else {
      amNumeric = Number.parseFloat(amRaw);
      if (!Number.isFinite(amNumeric) || amNumeric <= 0) {
        amPassed = false;
        errors.push('Parameter "am" must be greater than 0.00 when specified.');
      } else if (amNumeric > 100000) {
        warnings.push('Amount exceeds standard ₹1,00,000 P2P UPI bank cap.');
      }
    }
  }

  checks.push({
    id: 'am',
    label: 'Amount Format ("am" 2-Decimal Check)',
    passed: amPassed,
    severity: amPassed ? 'pass' : 'error',
    statusText: !hasAm ? 'Open Pay' : amPassed ? `₹${amNumeric.toFixed(2)}` : 'Invalid',
    detail: !hasAm
      ? 'No "am" lock emitted — payer enters amount inside app.'
      : amPassed
      ? `Strictly formatted am=${amRaw}`
      : 'Must be positive decimal with max 2 fraction digits.',
  });

  // 7. Reference (`tr`) & Remarks (`tn`) Validation
  const tr = parsedParams.tr;
  const tn = parsedParams.tn;
  let trTnPassed = true;
  if (tr !== undefined && (tr.length === 0 || tr.length > 35 || !/^[A-Za-z0-9._-]+$/.test(tr))) {
    trTnPassed = false;
    errors.push('Parameter "tr" must be 1–35 alphanumeric/._- characters.');
  }
  if (tn !== undefined && tn.length > 80) {
    trTnPassed = false;
    errors.push('Parameter "tn" (note) must not exceed 80 characters.');
  }

  checks.push({
    id: 'tr-tn',
    label: 'Reference ("tr") & Note ("tn") Bounds',
    passed: trTnPassed,
    severity: trTnPassed ? 'pass' : 'error',
    statusText: trTnPassed ? 'Valid' : 'Invalid',
    detail:
      tr || tn
        ? [tr ? `tr=${tr}` : '', tn ? `tn=${tn}` : ''].filter(Boolean).join(' · ')
        : 'Optional metadata omitted cleanly.',
  });

  // 8. Merchant Code (`mc`) Validation
  const mc = parsedParams.mc;
  let mcPassed = true;
  if (mc !== undefined) {
    if (!/^\d{4}$/.test(mc) || mc === '0000') {
      mcPassed = false;
      errors.push(`Invalid "mc" (${mc}): NPCI requires a valid 4-digit non-zero MCC.`);
    } else if (isIfscNpci) {
      mcPassed = false;
      errors.push('Do not include commercial "mc" on raw @ifsc.npci addresses.');
    }
  }

  if (mc !== undefined) {
    checks.push({
      id: 'mc',
      label: 'Merchant Category Code ("mc")',
      passed: mcPassed,
      severity: mcPassed ? 'pass' : 'error',
      statusText: mcPassed ? `MCC ${mc}` : 'Invalid',
      detail: mcPassed ? `Valid 4-digit MCC ${mc}` : 'Invalid MCC combination.',
    });
  }

  // 9. Major TPAP Compatibility Gate (Google Pay, PhonePe, Paytm, BHIM)
  const coreValid = errors.length === 0;
  const tpapCompatible = coreValid && !isIfscNpci;
  if (coreValid && isIfscNpci) {
    warnings.push(
      'Consumer TPAP apps (Google Pay, PhonePe, Paytm) block raw .ifsc.npci QRs under NPCI ReqValAdd rules; supported on BHIM / select bank apps.'
    );
  }

  checks.push({
    id: 'tpap-compat',
    label: 'GPay · PhonePe · Paytm · BHIM Compatibility',
    passed: tpapCompatible,
    severity: !coreValid ? 'error' : tpapCompatible ? 'pass' : 'warning',
    statusText: !coreValid ? 'Blocked' : tpapCompatible ? '100% Compatible' : 'BHIM Only',
    detail: !coreValid
      ? 'Fix NPCI intent URL errors above before rendering QR.'
      : tpapCompatible
      ? 'Passes strict Google Pay, PhonePe, Paytm & BHIM intent parsers.'
      : 'Valid NPCI .ifsc.npci URI, but GPay/PhonePe block A/C+IFSC QR scans — switch to UPI VPA for all apps.',
  });

  return {
    isValid: coreValid,
    tpapCompatible,
    normalizedUri: uri,
    parsedParams,
    errors,
    warnings,
    checks,
  };
}
