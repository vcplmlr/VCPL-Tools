import { BlogCoverTheme, BlogPostItem } from '../types/blog.ts';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function wrapHeadlineLines(title: string, maxCharsPerLine = 26, maxLines = 4): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines) {
    const consumedWords = lines.join(' ').split(/\s+/).length;
    if (consumedWords < words.length) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] =
        last.length > maxCharsPerLine - 3 ? `${last.slice(0, maxCharsPerLine - 3)}...` : `${last}...`;
    }
  }
  return lines;
}

export function getThemePalette(theme: BlogCoverTheme): {
  canvasBg: string;
  accentBg: string;
  accentText: string;
  stripColor: string;
  badgeBg: string;
} {
  switch (theme) {
    case 'tax':
      return {
        canvasBg: '#FEF2C8',
        accentBg: '#12805C',
        accentText: '#FFFDF5',
        stripColor: '#12805C',
        badgeBg: '#CEE5DC',
      };
    case 'gst':
      return {
        canvasBg: '#E4F2EC',
        accentBg: '#0F766E',
        accentText: '#FFFDF5',
        stripColor: '#0F766E',
        badgeBg: '#FEF2C8',
      };
    case 'banking':
      return {
        canvasBg: '#FEF2C8',
        accentBg: '#1E3A8A',
        accentText: '#FFFDF5',
        stripColor: '#1E3A8A',
        badgeBg: '#DBEAFE',
      };
    case 'upi':
      return {
        canvasBg: '#EEF6F1',
        accentBg: '#B45309',
        accentText: '#FFFDF5',
        stripColor: '#F9C80E',
        badgeBg: '#FEF2C8',
      };
    case 'pdf':
      return {
        canvasBg: '#F1EFEA',
        accentBg: '#2F3E4E',
        accentText: '#F9C80E',
        stripColor: '#2F3E4E',
        badgeBg: '#CEE5DC',
      };
    case 'tulu':
      return {
        canvasBg: '#FDF3DF',
        accentBg: '#7D0B0B',
        accentText: '#F9C80E',
        stripColor: '#7D0B0B',
        badgeBg: '#F9C80E',
      };
    case 'calendar':
      return {
        canvasBg: '#FEF2C8',
        accentBg: '#2F3E4E',
        accentText: '#F9C80E',
        stripColor: '#12805C',
        badgeBg: '#F9C80E',
      };
    case 'payroll':
      return {
        canvasBg: '#E6F4EF',
        accentBg: '#12805C',
        accentText: '#FFFDF5',
        stripColor: '#2F3E4E',
        badgeBg: '#FEF2C8',
      };
  }
}

export function renderThemeIllustration(theme: BlogCoverTheme): string {
  switch (theme) {
    case 'tax':
      return `
  <!-- Tax / Form 26AS Excel Ledger Artwork -->
  <g transform="translate(736, 98)">
    <rect x="0" y="0" width="380" height="390" rx="22" fill="#FEF2C8" stroke="#2F3E4E" stroke-width="3.5" />
    <rect x="0" y="0" width="380" height="58" rx="22" fill="#12805C" />
    <rect x="0" y="34" width="380" height="24" fill="#12805C" />
    <text x="26" y="38" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18">FORM 26AS · 4-TAB XLSX</text>

    <rect x="24" y="80" width="158" height="92" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="40" y="108" fill="#12805C" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">PART A · TDS</text>
    <rect x="40" y="122" width="122" height="10" rx="5" fill="#CEE5DC" />
    <rect x="40" y="142" width="94" height="10" rx="5" fill="#F9C80E" />

    <rect x="198" y="80" width="158" height="92" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="214" y="108" fill="#B45309" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">PART B · TCS</text>
    <rect x="214" y="122" width="122" height="10" rx="5" fill="#FDE68A" />
    <rect x="214" y="142" width="84" height="10" rx="5" fill="#12805C" />

    <rect x="24" y="192" width="332" height="114" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="40" y="218" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">Q1 – Q4 TALLY MATRIX</text>
    <rect x="44" y="256" width="48" height="32" rx="6" fill="#CEE5DC" stroke="#2F3E4E" stroke-width="1.5" />
    <rect x="112" y="238" width="48" height="50" rx="6" fill="#12805C" stroke="#2F3E4E" stroke-width="1.5" />
    <rect x="180" y="246" width="48" height="42" rx="6" fill="#F9C80E" stroke="#2F3E4E" stroke-width="1.5" />
    <rect x="248" y="228" width="48" height="60" rx="6" fill="#2F3E4E" />

    <rect x="24" y="324" width="332" height="44" rx="12" fill="#2F3E4E" />
    <text x="190" y="352" text-anchor="middle" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15">TAN &amp; SECTION BIFURCATION · OFFLINE</text>
  </g>`;

    case 'gst':
      return `
  <!-- GST Return & GSTR-2B ITC Matching Artwork -->
  <g transform="translate(736, 98)">
    <rect x="0" y="0" width="380" height="390" rx="22" fill="#CEE5DC" stroke="#2F3E4E" stroke-width="3.5" />
    <rect x="0" y="0" width="380" height="58" rx="22" fill="#0F766E" />
    <rect x="0" y="34" width="380" height="24" fill="#0F766E" />
    <text x="26" y="38" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18">GSTN JSON &amp; ITC AUDIT</text>

    <rect x="24" y="80" width="332" height="86" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="42" y="110" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="16">GSTR-1 OUTWARD TABLES</text>
    <rect x="42" y="124" width="76" height="24" rx="7" fill="#F9C80E" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="80" y="141" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">B2B / B2CS</text>
    <rect x="128" y="124" width="96" height="24" rx="7" fill="#CEE5DC" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="176" y="141" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">HSN TABLE 12</text>
    <rect x="234" y="124" width="102" height="24" rx="7" fill="#2F3E4E" />
    <text x="285" y="141" text-anchor="middle" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">GSTIN CHECK</text>

    <rect x="24" y="186" width="332" height="122" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="42" y="216" fill="#0F766E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15">GSTR-2B ⇄ TALLY PURCHASE</text>
    <circle cx="56" cy="248" r="10" fill="#12805C" />
    <rect x="78" y="241" width="186" height="13" rx="6" fill="#CEE5DC" />
    <text x="328" y="252" text-anchor="end" fill="#12805C" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13">EXACT</text>
    <circle cx="56" cy="282" r="10" fill="#F9C80E" stroke="#2F3E4E" stroke-width="1.5" />
    <rect x="78" y="275" width="150" height="13" rx="6" fill="#FEF2C8" />
    <text x="328" y="286" text-anchor="end" fill="#B45309" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13">NORMALIZED</text>

    <rect x="24" y="326" width="332" height="44" rx="12" fill="#2F3E4E" />
    <text x="190" y="354" text-anchor="middle" fill="#CEE5DC" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15">ZERO SERVER UPLOAD · ITC READY</text>
  </g>`;

    case 'banking':
      return `
  <!-- Bank Deposit Slip & IFSC Blueprint Artwork -->
  <g transform="translate(736, 98)">
    <rect x="0" y="0" width="380" height="390" rx="22" fill="#DBEAFE" stroke="#2F3E4E" stroke-width="3.5" />
    <rect x="0" y="0" width="380" height="58" rx="22" fill="#1E3A8A" />
    <rect x="0" y="34" width="380" height="24" fill="#1E3A8A" />
    <text x="26" y="38" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18">A4 DEPOSIT &amp; RTGS FORM</text>

    <rect x="24" y="80" width="332" height="176" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <line x1="126" y1="88" x2="126" y2="248" stroke="#2F3E4E" stroke-width="2" stroke-dasharray="6 5" />
    <text x="40" y="108" fill="#1E3A8A" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">COUNTERFOIL</text>
    <rect x="40" y="122" width="70" height="10" rx="4" fill="#CBD5E1" />
    <rect x="40" y="142" width="58" height="10" rx="4" fill="#CBD5E1" />
    <rect x="40" y="170" width="70" height="28" rx="6" fill="#FEF2C8" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="75" y="189" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11">₹ TOTAL</text>

    <text x="146" y="108" fill="#1E3A8A" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13">BANK PAY-IN / CHEQUE COPY</text>
    <rect x="146" y="122" width="190" height="14" rx="5" fill="#E2E8F0" />
    <rect x="146" y="146" width="150" height="14" rx="5" fill="#E2E8F0" />
    <rect x="146" y="176" width="88" height="24" rx="6" fill="#F9C80E" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="190" y="193" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11">SBI · HDFC</text>
    <rect x="242" y="176" width="94" height="24" rx="6" fill="#CEE5DC" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="289" y="193" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11">IN WORDS</text>
    <rect x="146" y="212" width="190" height="26" rx="6" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.2" />
    <text x="241" y="230" text-anchor="middle" fill="#475569" font-family="monospace" font-weight="700" font-size="12">₹500 × 20 · ₹200 × 10</text>

    <rect x="24" y="272" width="332" height="44" rx="12" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2" />
    <text x="190" y="299" text-anchor="middle" fill="#1E3A8A" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">182,000+ RBI IFSC &amp; MICR CHECKED</text>

    <rect x="24" y="328" width="332" height="40" rx="12" fill="#2F3E4E" />
    <text x="190" y="353" text-anchor="middle" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">FULL A4 &amp; PRE-PRINTED MODES</text>
  </g>`;

    case 'upi':
      return `
  <!-- NPCI UPI QR Matrix Artwork -->
  <g transform="translate(736, 98)">
    <rect x="0" y="0" width="380" height="390" rx="22" fill="#FEF2C8" stroke="#2F3E4E" stroke-width="3.5" />
    <rect x="0" y="0" width="380" height="58" rx="22" fill="#2F3E4E" />
    <rect x="0" y="34" width="380" height="24" fill="#2F3E4E" />
    <text x="26" y="38" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18">NPCI UPI INTENT · QR STANDEE</text>

    <rect x="92" y="80" width="196" height="196" rx="18" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="3" />
    <rect x="114" y="102" width="48" height="48" rx="8" fill="none" stroke="#2F3E4E" stroke-width="7" />
    <rect x="129" y="117" width="18" height="18" rx="3" fill="#12805C" />
    <rect x="218" y="102" width="48" height="48" rx="8" fill="none" stroke="#2F3E4E" stroke-width="7" />
    <rect x="233" y="117" width="18" height="18" rx="3" fill="#F9C80E" />
    <rect x="114" y="206" width="48" height="48" rx="8" fill="none" stroke="#2F3E4E" stroke-width="7" />
    <rect x="129" y="221" width="18" height="18" rx="3" fill="#2F3E4E" />
    <rect x="176" y="108" width="14" height="14" rx="2" fill="#2F3E4E" />
    <rect x="196" y="128" width="14" height="14" rx="2" fill="#2F3E4E" />
    <rect x="176" y="156" width="28" height="28" rx="5" fill="#12805C" />
    <rect x="122" y="172" width="18" height="14" rx="2" fill="#2F3E4E" />
    <rect x="220" y="168" width="24" height="16" rx="2" fill="#2F3E4E" />
    <rect x="180" y="206" width="20" height="20" rx="3" fill="#2F3E4E" />
    <rect x="222" y="206" width="34" height="16" rx="3" fill="#2F3E4E" />
    <rect x="216" y="234" width="22" height="18" rx="3" fill="#12805C" />

    <rect x="24" y="292" width="332" height="36" rx="10" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2" />
    <text x="190" y="315" text-anchor="middle" fill="#12805C" font-family="monospace" font-weight="700" font-size="13">upi://pay?pa=shop@upi&amp;cu=INR</text>

    <rect x="24" y="338" width="332" height="34" rx="10" fill="#12805C" />
    <text x="190" y="360" text-anchor="middle" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13">GPAY · PHONEPE · PAYTM · BHIM READY</text>
  </g>`;

    case 'pdf':
      return `
  <!-- Offline PDF Security & Redaction Shield Artwork -->
  <g transform="translate(736, 98)">
    <rect x="0" y="0" width="380" height="390" rx="22" fill="#CEE5DC" stroke="#2F3E4E" stroke-width="3.5" />
    <rect x="0" y="0" width="380" height="58" rx="22" fill="#2F3E4E" />
    <rect x="0" y="34" width="380" height="24" fill="#2F3E4E" />
    <text x="26" y="38" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18">CLIENT RAM · PDF PRIVACY</text>

    <rect x="38" y="82" width="236" height="232" rx="16" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="3" />
    <rect x="60" y="108" width="110" height="14" rx="5" fill="#12805C" />
    <rect x="60" y="136" width="186" height="12" rx="4" fill="#CBD5E1" />
    <rect x="60" y="164" width="186" height="24" rx="4" fill="#0F172A" />
    <text x="153" y="180" text-anchor="middle" fill="#F9C80E" font-family="monospace" font-weight="700" font-size="11">REDACTED PERMANENTLY</text>
    <rect x="60" y="204" width="150" height="12" rx="4" fill="#CBD5E1" />
    <rect x="60" y="228" width="176" height="22" rx="4" fill="#0F172A" />
    <rect x="60" y="266" width="128" height="18" rx="6" fill="#F9C80E" />
    <text x="124" y="279" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11">OCR SEARCHABLE</text>

    <path d="M294 132 L346 154 V206 C346 244 316 268 294 278 C272 268 242 244 242 206 V154 Z" fill="#12805C" stroke="#2F3E4E" stroke-width="3" />
    <path d="M276 204 L290 218 L316 188" fill="none" stroke="#F9C80E" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />

    <rect x="24" y="330" width="332" height="40" rx="12" fill="#2F3E4E" />
    <text x="190" y="355" text-anchor="middle" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">DECRYPT · REDACT · OCR 100% OFFLINE</text>
  </g>`;

    case 'tulu':
      return `
  <!-- Tulunadu Tulusiri Pro Heritage Cover Artwork -->
  <g transform="translate(736, 98)">
    <rect x="0" y="0" width="380" height="390" rx="22" fill="#FEF2C8" stroke="#7D0B0B" stroke-width="3.5" />
    <rect x="0" y="0" width="380" height="58" rx="22" fill="#7D0B0B" />
    <rect x="0" y="34" width="380" height="24" fill="#7D0B0B" />
    <text x="26" y="38" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18">TULUSIRI PRO · BARAVU</text>

    <rect x="24" y="80" width="332" height="72" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="42" y="106" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">ENGLISH / PHONETIC INPUT</text>
    <text x="42" y="134" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22">Tulunadu · Namaskara</text>

    <rect x="24" y="168" width="332" height="78" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="42" y="194" fill="#12805C" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">CONFIRM KANNADA SPELLING</text>
    <rect x="42" y="206" width="136" height="28" rx="8" fill="#F9C80E" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="110" y="225" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">sounds like ✓</text>
    <rect x="188" y="206" width="146" height="28" rx="8" fill="#CEE5DC" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="261" y="225" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="13">alternate chips</text>

    <rect x="24" y="262" width="332" height="58" rx="14" fill="#7D0B0B" />
    <text x="190" y="298" text-anchor="middle" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="20">TIGALARI BARAVU STUDIO</text>

    <rect x="24" y="332" width="332" height="38" rx="12" fill="#2F3E4E" />
    <text x="190" y="356" text-anchor="middle" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">LIPI CHART · QUIZ · POSTER PNG</text>
  </g>`;

    case 'calendar':
      return `
  <!-- FY 2026-27 GST / ITR / TDS Tax Compliance Calendar Artwork -->
  <g transform="translate(736, 98)">
    <rect x="0" y="0" width="380" height="390" rx="22" fill="#CEE5DC" stroke="#2F3E4E" stroke-width="3.5" />
    <rect x="0" y="0" width="380" height="58" rx="22" fill="#2F3E4E" />
    <rect x="0" y="34" width="380" height="24" fill="#2F3E4E" />
    <text x="26" y="38" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18">COMPLIANCE CALENDAR 2026–27</text>

    <rect x="24" y="78" width="158" height="96" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="40" y="106" fill="#12805C" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13">GSTR-1 &amp; 3B</text>
    <text x="40" y="138" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22">11th / 20th</text>
    <text x="40" y="160" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="12">QRMP · 13 / 22 / 24</text>

    <rect x="198" y="78" width="158" height="96" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="214" y="106" fill="#B45309" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13">TDS / TCS DUE</text>
    <text x="214" y="138" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22">7th Monthly</text>
    <text x="214" y="160" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="12">FORMS 138 · 140 · 143</text>

    <rect x="24" y="192" width="332" height="122" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="40" y="220" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">KEY DEADLINES · AY 2026–27</text>
    <rect x="40" y="234" width="142" height="28" rx="7" fill="#F9C80E" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="111" y="253" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">15 DEC · ADV TAX 75%</text>
    <rect x="194" y="234" width="146" height="28" rx="7" fill="#12805C" />
    <text x="267" y="253" text-anchor="middle" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">31 DEC · GSTR-9 / 9C</text>
    <rect x="40" y="272" width="300" height="28" rx="7" fill="#FEF2C8" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="190" y="291" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">31 DEC · BELATED ITR | 31 MAR · REVISED</text>

    <rect x="24" y="330" width="332" height="40" rx="12" fill="#2F3E4E" />
    <text x="190" y="355" text-anchor="middle" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">INCOME-TAX ACT, 2025 &amp; GST READY</text>
  </g>`;

    case 'payroll':
      return `
  <!-- EPF 12%, ESIC 3.25% & Karnataka PT Payroll Compliance Artwork -->
  <g transform="translate(736, 98)">
    <rect x="0" y="0" width="380" height="390" rx="22" fill="#FEF2C8" stroke="#2F3E4E" stroke-width="3.5" />
    <rect x="0" y="0" width="380" height="58" rx="22" fill="#12805C" />
    <rect x="0" y="34" width="380" height="24" fill="#12805C" />
    <text x="26" y="38" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18">PF · ESIC · KARNATAKA PT</text>

    <rect x="24" y="78" width="158" height="104" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="40" y="106" fill="#12805C" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13">EPF + EPS SPLIT</text>
    <text x="40" y="140" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="24">12% + 12%</text>
    <text x="40" y="164" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="12">ECR DUE 15TH</text>

    <rect x="198" y="78" width="158" height="104" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="214" y="106" fill="#B45309" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13">ESIC (≤ ₹21K)</text>
    <text x="214" y="140" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22">0.75% / 3.25%</text>
    <text x="214" y="164" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="12">CHALLAN DUE 15TH</text>

    <rect x="24" y="198" width="332" height="114" rx="14" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="2.5" />
    <text x="40" y="226" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">KARNATAKA PT &amp; CTC BREAKUP</text>
    <rect x="40" y="240" width="144" height="28" rx="7" fill="#F9C80E" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="112" y="259" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">PT ₹200 · DUE 20TH</text>
    <rect x="196" y="240" width="144" height="28" rx="7" fill="#CEE5DC" stroke="#2F3E4E" stroke-width="1.5" />
    <text x="268" y="259" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12">GROSS VS NET PAY</text>
    <rect x="40" y="276" width="300" height="24" rx="6" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.2" />
    <text x="190" y="293" text-anchor="middle" fill="#475569" font-family="monospace" font-weight="700" font-size="12">TDS SEC 393 · CHALLAN 7TH</text>

    <rect x="24" y="330" width="332" height="40" rx="12" fill="#2F3E4E" />
    <text x="190" y="355" text-anchor="middle" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14">HR &amp; ACCOUNTANT PAYROLL HANDBOOK</text>
  </g>`;
  }
}

export function buildBlogCoverSvg(
  post: Pick<
    BlogPostItem,
    'title' | 'author' | 'readTime' | 'updatedLabel' | 'category' | 'coverTheme' | 'coverBadge'
  >
): string {
  const palette = getThemePalette(post.coverTheme);
  const isLongTitle = post.title.length > 75;
  const headlineFontSize = isLongTitle ? 36 : 40;
  const titleLines = wrapHeadlineLines(post.title, isLongTitle ? 31 : 27, 4);
  const titleStartY = titleLines.length >= 4 ? 218 : titleLines.length === 3 ? 236 : 254;
  const lineSpacing = isLongTitle ? 48 : 52;

  const titleSvg = titleLines
    .map(
      (line, idx) =>
        `  <text x="96" y="${titleStartY + idx * lineSpacing}" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="${headlineFontSize}" letter-spacing="-0.8">${escapeXml(
          line
        )}</text>`
    )
    .join('\n');

  const metaY = titleStartY + titleLines.length * lineSpacing + 22;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <pattern id="vcpl-blog-dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1.4" fill="#2F3E4E" fill-opacity="0.11" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="${palette.canvasBg}" />
  <rect width="1200" height="630" fill="url(#vcpl-blog-dots)" />

  <rect x="0" y="0" width="1200" height="14" fill="#2F3E4E" />
  <rect x="0" y="14" width="1200" height="6" fill="${palette.stripColor}" />

  <rect x="44" y="48" width="1112" height="534" rx="28" fill="#FFFDF5" stroke="#2F3E4E" stroke-width="4" />

  <rect x="96" y="96" width="174" height="40" rx="10" fill="#2F3E4E" />
  <rect x="108" y="106" width="10" height="10" rx="2" fill="#F9C80E" />
  <rect x="120" y="106" width="10" height="10" rx="2" fill="#CEE5DC" />
  <rect x="108" y="118" width="10" height="10" rx="2" fill="#CEE5DC" />
  <rect x="120" y="118" width="10" height="10" rx="2" fill="#F9C80E" />
  <text x="142" y="122" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="16" letter-spacing="0.8">VCPL BLOG</text>

  <rect x="284" y="96" width="256" height="40" rx="10" fill="${palette.badgeBg}" stroke="#2F3E4E" stroke-width="2" />
  <text x="412" y="121" text-anchor="middle" fill="#2F3E4E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15">${escapeXml(
    post.coverBadge
  )}</text>

${titleSvg}

  <text x="96" y="${metaY}" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18">By ${escapeXml(
    post.author
  )} · ${escapeXml(post.readTime)} · ${escapeXml(post.updatedLabel)}</text>

${renderThemeIllustration(post.coverTheme)}

  <rect x="96" y="512" width="1008" height="44" rx="12" fill="#2F3E4E" />
  <text x="122" y="540" fill="#F9C80E" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="17">vcpltools.vercel.app/blog</text>
  <text x="1078" y="540" text-anchor="end" fill="#FFFDF5" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="16">${escapeXml(
    post.category
  )} Guide · 100% Browser-Private Utilities</text>
</svg>
`;
}
