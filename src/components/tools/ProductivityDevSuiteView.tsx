import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Clock,
  Code2,
  Copy,
  Download,
  FileText,
  Globe2,
  Hash,
  Mail,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportElementToPdf,
  exportStructuredReportPdf,
  printHtmlDocument,
  printTargetElement,
} from '../../utils/printReport';
import {
  buildNpciUpiIntentUrl,
  validateNpciUpiIntentUrl,
} from '../../utils/npciUpiValidator';
import { ToolExportBar } from './ToolExportBar';

interface ProductivityDevSuiteViewProps {
  tool: ToolCatalogItem;
}

interface CountryRecord {
  name: string;
  iso2: string;
  iso3: string;
  isd: string;
  currency: string;
  symbol: string;
  capital: string;
  region: string;
}

const WORLD_COUNTRIES: CountryRecord[] = [
  { name: 'India', iso2: 'IN', iso3: 'IND', isd: '+91', currency: 'INR', symbol: '₹', capital: 'New Delhi', region: 'Asia' },
  { name: 'United States', iso2: 'US', iso3: 'USA', isd: '+1', currency: 'USD', symbol: '$', capital: 'Washington, D.C.', region: 'North America' },
  { name: 'United Arab Emirates', iso2: 'AE', iso3: 'ARE', isd: '+971', currency: 'AED', symbol: 'د.إ', capital: 'Abu Dhabi', region: 'Middle East' },
  { name: 'United Kingdom', iso2: 'GB', iso3: 'GBR', isd: '+44', currency: 'GBP', symbol: '£', capital: 'London', region: 'Europe' },
  { name: 'Singapore', iso2: 'SG', iso3: 'SGP', isd: '+65', currency: 'SGD', symbol: 'S$', capital: 'Singapore', region: 'Asia' },
  { name: 'Germany', iso2: 'DE', iso3: 'DEU', isd: '+49', currency: 'EUR', symbol: '€', capital: 'Berlin', region: 'Europe' },
  { name: 'Australia', iso2: 'AU', iso3: 'AUS', isd: '+61', currency: 'AUD', symbol: 'A$', capital: 'Canberra', region: 'Oceania' },
  { name: 'Canada', iso2: 'CA', iso3: 'CAN', isd: '+1', currency: 'CAD', symbol: 'C$', capital: 'Ottawa', region: 'North America' },
  { name: 'Japan', iso2: 'JP', iso3: 'JPN', isd: '+81', currency: 'JPY', symbol: '¥', capital: 'Tokyo', region: 'Asia' },
  { name: 'Saudi Arabia', iso2: 'SA', iso3: 'SAU', isd: '+966', currency: 'SAR', symbol: '﷼', capital: 'Riyadh', region: 'Middle East' },
  { name: 'Qatar', iso2: 'QA', iso3: 'QAT', isd: '+974', currency: 'QAR', symbol: 'ر.ق', capital: 'Doha', region: 'Middle East' },
  { name: 'Oman', iso2: 'OM', iso3: 'OMN', isd: '+968', currency: 'OMR', symbol: 'ر.ع.', capital: 'Muscat', region: 'Middle East' },
  { name: 'Kuwait', iso2: 'KW', iso3: 'KWT', isd: '+965', currency: 'KWD', symbol: 'د.ك', capital: 'Kuwait City', region: 'Middle East' },
  { name: 'Bahrain', iso2: 'BH', iso3: 'BHR', isd: '+973', currency: 'BHD', symbol: 'BD', capital: 'Manama', region: 'Middle East' },
  { name: 'France', iso2: 'FR', iso3: 'FRA', isd: '+33', currency: 'EUR', symbol: '€', capital: 'Paris', region: 'Europe' },
  { name: 'Italy', iso2: 'IT', iso3: 'ITA', isd: '+39', currency: 'EUR', symbol: '€', capital: 'Rome', region: 'Europe' },
  { name: 'Switzerland', iso2: 'CH', iso3: 'CHE', isd: '+41', currency: 'CHF', symbol: 'CHF', capital: 'Bern', region: 'Europe' },
  { name: 'Netherlands', iso2: 'NL', iso3: 'NLD', isd: '+31', currency: 'EUR', symbol: '€', capital: 'Amsterdam', region: 'Europe' },
  { name: 'China', iso2: 'CN', iso3: 'CHN', isd: '+86', currency: 'CNY', symbol: '¥', capital: 'Beijing', region: 'Asia' },
  { name: 'South Korea', iso2: 'KR', iso3: 'KOR', isd: '+82', currency: 'KRW', symbol: '₩', capital: 'Seoul', region: 'Asia' },
  { name: 'Malaysia', iso2: 'MY', iso3: 'MYS', isd: '+60', currency: 'MYR', symbol: 'RM', capital: 'Kuala Lumpur', region: 'Asia' },
  { name: 'Thailand', iso2: 'TH', iso3: 'THA', isd: '+66', currency: 'THB', symbol: '฿', capital: 'Bangkok', region: 'Asia' },
  { name: 'Indonesia', iso2: 'ID', iso3: 'IDN', isd: '+62', currency: 'IDR', symbol: 'Rp', capital: 'Jakarta', region: 'Asia' },
  { name: 'Sri Lanka', iso2: 'LK', iso3: 'LKA', isd: '+94', currency: 'LKR', symbol: 'Rs', capital: 'Colombo', region: 'Asia' },
  { name: 'Nepal', iso2: 'NP', iso3: 'NPL', isd: '+977', currency: 'NPR', symbol: 'रू', capital: 'Kathmandu', region: 'Asia' },
  { name: 'Bangladesh', iso2: 'BD', iso3: 'BGD', isd: '+880', currency: 'BDT', symbol: '৳', capital: 'Dhaka', region: 'Asia' },
  { name: 'New Zealand', iso2: 'NZ', iso3: 'NZL', isd: '+64', currency: 'NZD', symbol: 'NZ$', capital: 'Wellington', region: 'Oceania' },
  { name: 'South Africa', iso2: 'ZA', iso3: 'ZAF', isd: '+27', currency: 'ZAR', symbol: 'R', capital: 'Pretoria', region: 'Africa' },
  { name: 'Brazil', iso2: 'BR', iso3: 'BRA', isd: '+55', currency: 'BRL', symbol: 'R$', capital: 'Brasília', region: 'South America' },
  { name: 'Russia', iso2: 'RU', iso3: 'RUS', isd: '+7', currency: 'RUB', symbol: '₽', capital: 'Moscow', region: 'Europe / Asia' },
  { name: 'Spain', iso2: 'ES', iso3: 'ESP', isd: '+34', currency: 'EUR', symbol: '€', capital: 'Madrid', region: 'Europe' },
  { name: 'Sweden', iso2: 'SE', iso3: 'SWE', isd: '+46', currency: 'SEK', symbol: 'kr', capital: 'Stockholm', region: 'Europe' },
  { name: 'Vietnam', iso2: 'VN', iso3: 'VNM', isd: '+84', currency: 'VND', symbol: '₫', capital: 'Hanoi', region: 'Asia' },
  { name: 'Philippines', iso2: 'PH', iso3: 'PHL', isd: '+63', currency: 'PHP', symbol: '₱', capital: 'Manila', region: 'Asia' },
  { name: 'Israel', iso2: 'IL', iso3: 'ISR', isd: '+972', currency: 'ILS', symbol: '₪', capital: 'Jerusalem', region: 'Middle East' },
  { name: 'Turkey', iso2: 'TR', iso3: 'TUR', isd: '+90', currency: 'TRY', symbol: '₺', capital: 'Ankara', region: 'Europe / Asia' },
  { name: 'Mexico', iso2: 'MX', iso3: 'MEX', isd: '+52', currency: 'MXN', symbol: '$', capital: 'Mexico City', region: 'North America' },
];

interface ClockZoneItem {
  id: string;
  city: string;
  zone: string;
  country: string;
  isDefault?: boolean;
}

const WORLD_CLOCK_STORAGE_KEY = 'vcpl_world_clock_zones_v1';

const DEFAULT_CLOCK_ZONES: ClockZoneItem[] = [
  { id: 'in-ist', city: 'Mumbai / Mangalore (IST)', zone: 'Asia/Kolkata', country: 'India', isDefault: true },
  { id: 'ae-dxb', city: 'Dubai (GST)', zone: 'Asia/Dubai', country: 'UAE', isDefault: true },
  { id: 'sg-sin', city: 'Singapore (SGT)', zone: 'Asia/Singapore', country: 'Singapore', isDefault: true },
  { id: 'jp-tyo', city: 'Tokyo (JST)', zone: 'Asia/Tokyo', country: 'Japan', isDefault: true },
  { id: 'gb-lon', city: 'London (GMT/BST)', zone: 'Europe/London', country: 'UK', isDefault: true },
  { id: 'de-ber', city: 'Berlin / Munich (CET)', zone: 'Europe/Berlin', country: 'Germany', isDefault: true },
  { id: 'us-nyc', city: 'New York (EST/EDT)', zone: 'America/New_York', country: 'USA', isDefault: true },
  { id: 'us-sfo', city: 'San Francisco (PST/PDT)', zone: 'America/Los_Angeles', country: 'USA', isDefault: true },
  { id: 'au-syd', city: 'Sydney (AEST/AEDT)', zone: 'Australia/Sydney', country: 'Australia', isDefault: true },
];

const EXTRA_WORLD_CLOCK_CATALOG: ClockZoneItem[] = [
  { id: 'sa-ruh', city: 'Riyadh (AST)', zone: 'Asia/Riyadh', country: 'Saudi Arabia' },
  { id: 'qa-doh', city: 'Doha (AST)', zone: 'Asia/Qatar', country: 'Qatar' },
  { id: 'om-mct', city: 'Muscat (GST)', zone: 'Asia/Muscat', country: 'Oman' },
  { id: 'kw-kwi', city: 'Kuwait City (AST)', zone: 'Asia/Kuwait', country: 'Kuwait' },
  { id: 'bh-bah', city: 'Manama (AST)', zone: 'Asia/Bahrain', country: 'Bahrain' },
  { id: 'ca-yyz', city: 'Toronto (EST/EDT)', zone: 'America/Toronto', country: 'Canada' },
  { id: 'ca-yvr', city: 'Vancouver (PST/PDT)', zone: 'America/Vancouver', country: 'Canada' },
  { id: 'fr-par', city: 'Paris (CET/CEST)', zone: 'Europe/Paris', country: 'France' },
  { id: 'ch-zrh', city: 'Zurich (CET/CEST)', zone: 'Europe/Zurich', country: 'Switzerland' },
  { id: 'nl-ams', city: 'Amsterdam (CET/CEST)', zone: 'Europe/Amsterdam', country: 'Netherlands' },
  { id: 'it-rom', city: 'Rome / Milan (CET/CEST)', zone: 'Europe/Rome', country: 'Italy' },
  { id: 'es-mad', city: 'Madrid (CET/CEST)', zone: 'Europe/Madrid', country: 'Spain' },
  { id: 'pt-lis', city: 'Lisbon (WET/WEST)', zone: 'Europe/Lisbon', country: 'Portugal' },
  { id: 'ie-dub', city: 'Dublin (GMT/IST)', zone: 'Europe/Dublin', country: 'Ireland' },
  { id: 'se-sto', city: 'Stockholm (CET/CEST)', zone: 'Europe/Stockholm', country: 'Sweden' },
  { id: 'no-osl', city: 'Oslo (CET/CEST)', zone: 'Europe/Oslo', country: 'Norway' },
  { id: 'pl-waw', city: 'Warsaw (CET/CEST)', zone: 'Europe/Warsaw', country: 'Poland' },
  { id: 'ru-mow', city: 'Moscow (MSK)', zone: 'Europe/Moscow', country: 'Russia' },
  { id: 'tr-ist', city: 'Istanbul (TRT)', zone: 'Europe/Istanbul', country: 'Turkey' },
  { id: 'il-tlv', city: 'Tel Aviv / Jerusalem (IST)', zone: 'Asia/Jerusalem', country: 'Israel' },
  { id: 'cn-sha', city: 'Shanghai / Beijing (CST)', zone: 'Asia/Shanghai', country: 'China' },
  { id: 'hk-hkg', city: 'Hong Kong (HKT)', zone: 'Asia/Hong_Kong', country: 'Hong Kong' },
  { id: 'tw-tpe', city: 'Taipei (CST)', zone: 'Asia/Taipei', country: 'Taiwan' },
  { id: 'kr-sel', city: 'Seoul (KST)', zone: 'Asia/Seoul', country: 'South Korea' },
  { id: 'my-kul', city: 'Kuala Lumpur (MYT)', zone: 'Asia/Kuala_Lumpur', country: 'Malaysia' },
  { id: 'th-bkk', city: 'Bangkok (ICT)', zone: 'Asia/Bangkok', country: 'Thailand' },
  { id: 'id-jkt', city: 'Jakarta (WIB)', zone: 'Asia/Jakarta', country: 'Indonesia' },
  { id: 'vn-sgn', city: 'Ho Chi Minh / Hanoi (ICT)', zone: 'Asia/Ho_Chi_Minh', country: 'Vietnam' },
  { id: 'ph-mnl', city: 'Manila (PHT)', zone: 'Asia/Manila', country: 'Philippines' },
  { id: 'lk-cmb', city: 'Colombo (SLST)', zone: 'Asia/Colombo', country: 'Sri Lanka' },
  { id: 'np-ktm', city: 'Kathmandu (NPT)', zone: 'Asia/Kathmandu', country: 'Nepal' },
  { id: 'bd-dac', city: 'Dhaka (BST)', zone: 'Asia/Dhaka', country: 'Bangladesh' },
  { id: 'pk-khi', city: 'Karachi (PKT)', zone: 'Asia/Karachi', country: 'Pakistan' },
  { id: 'mv-mle', city: 'Malé (MVT)', zone: 'Indian/Maldives', country: 'Maldives' },
  { id: 'nz-akl', city: 'Auckland (NZST/NZDT)', zone: 'Pacific/Auckland', country: 'New Zealand' },
  { id: 'au-per', city: 'Perth (AWST)', zone: 'Australia/Perth', country: 'Australia' },
  { id: 'us-chi', city: 'Chicago / Dallas (CST/CDT)', zone: 'America/Chicago', country: 'USA' },
  { id: 'us-hnl', city: 'Honolulu (HST)', zone: 'Pacific/Honolulu', country: 'USA' },
  { id: 'br-gru', city: 'São Paulo (BRT)', zone: 'America/Sao_Paulo', country: 'Brazil' },
  { id: 'mx-mex', city: 'Mexico City (CST)', zone: 'America/Mexico_City', country: 'Mexico' },
  { id: 'ar-bue', city: 'Buenos Aires (ART)', zone: 'America/Argentina/Buenos_Aires', country: 'Argentina' },
  { id: 'cl-scl', city: 'Santiago (CLT)', zone: 'America/Santiago', country: 'Chile' },
  { id: 'za-jnb', city: 'Johannesburg (SAST)', zone: 'Africa/Johannesburg', country: 'South Africa' },
  { id: 'ng-los', city: 'Lagos (WAT)', zone: 'Africa/Lagos', country: 'Nigeria' },
  { id: 'ke-nbo', city: 'Nairobi (EAT)', zone: 'Africa/Nairobi', country: 'Kenya' },
  { id: 'eg-cai', city: 'Cairo (EET)', zone: 'Africa/Cairo', country: 'Egypt' },
  { id: 'mu-mru', city: 'Port Louis (MUT)', zone: 'Indian/Mauritius', country: 'Mauritius' },
  { id: 'utc', city: 'Coordinated Universal Time (UTC)', zone: 'UTC', country: 'Global' },
];

const QUICK_ADD_ZONE_IDS = [
  'ca-yyz',
  'sa-ruh',
  'qa-doh',
  'fr-par',
  'ch-zrh',
  'kr-sel',
  'my-kul',
  'cn-sha',
  'nz-akl',
  'za-jnb',
  'br-gru',
  'utc',
];

function formatCurrentLocalDatetimeInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function loadSavedClockZones(): ClockZoneItem[] {
  try {
    const raw = window.localStorage.getItem(WORLD_CLOCK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (item): item is ClockZoneItem =>
            Boolean(item && typeof item.zone === 'string' && typeof item.city === 'string' && typeof item.country === 'string')
        );
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_CLOCK_ZONES;
}

function getZoneOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0');
    const utcEquivalent = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((utcEquivalent - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function formatOffsetLabel(offsetMin: number): string {
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${h}:${m}`;
}

function formatIstDiffLabel(zoneOffsetMin: number, istOffsetMin: number): string {
  const diff = zoneOffsetMin - istOffsetMin;
  if (diff === 0) return 'Same as IST';
  const sign = diff > 0 ? '+' : '-';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `${sign}${h}h vs IST`;
  return `${sign}${h}h ${m}m vs IST`;
}

const PSP_HANDLES: Record<string, string> = {
  oksbi: 'Google Pay · State Bank of India',
  okicici: 'Google Pay · ICICI Bank',
  okaxis: 'Google Pay · Axis Bank',
  okhdfcbank: 'Google Pay · HDFC Bank',
  ybl: 'PhonePe · Yes Bank',
  ibl: 'PhonePe · ICICI Bank',
  axl: 'PhonePe · Axis Bank',
  paytm: 'Paytm Payments / Partner Bank',
  ptyes: 'Paytm · Yes Bank',
  ptaxis: 'Paytm · Axis Bank',
  ptsbi: 'Paytm · State Bank of India',
  upi: 'NPCI BHIM App',
  sbi: 'SBI YONO / BHIM SBI Pay',
  hdfcbank: 'HDFC PayZapp',
  icici: 'ICICI iMobile Pay',
  axisbank: 'Axis Mobile',
  kotak: 'Kotak Mahindra Bank',
  apl: 'Amazon Pay · Axis Bank',
  fampay: 'FamPay',
};

const LOREM_SENTENCES = [
  'Precision accounting workflows minimize reconciliation discrepancies across regional dealership ledgers.',
  'Browser-local computation empowers finance teams to verify confidential PDFs and tax statements safely.',
  'Structured invoicing ensures effortless compliance with CGST, SGST, IGST, and HSN reporting standards.',
  'High-resolution vector document generation delivers crisp A4 banking challans on any office printer.',
  'Unified digital utilities streamline repetitive everyday administrative operations without third-party servers.',
  'Consistent verification safeguards cash deposits, demand drafts, and statutory return filings every quarter.',
];

function simpleMarkdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${esc(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${esc(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h1>${esc(line.slice(2))}</h1>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${esc(line.slice(2))}</li>`);
    } else if (line.startsWith('> ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<blockquote>${esc(line.slice(2))}</blockquote>`);
    } else if (!line.trim()) {
      if (inList) { out.push('</ul>'); inList = false; }
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      const formatted = esc(line)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      out.push(`<p>${formatted}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

export const ProductivityDevSuiteView: React.FC<ProductivityDevSuiteViewProps> = ({ tool }) => {
  const [copied, setCopied] = useState(false);

  const copyText = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  // Minifier
  const [codeLang, setCodeLang] = useState<'css' | 'js'>('css');
  const [codeInput, setCodeInput] = useState<string>('');

  // Markdown
  const [mdInput, setMdInput] = useState<string>('');

  // UUID
  const [uuidCount, setUuidCount] = useState<number>(10);
  const [uuidUpper, setUuidUpper] = useState<boolean>(false);
  const [uuidNoHyphens, setUuidNoHyphens] = useState<boolean>(false);
  const [uuids, setUuids] = useState<string[]>(() =>
    Array.from({ length: 10 }, () => crypto.randomUUID())
  );

  // Unix Timestamp
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  const [epochInput, setEpochInput] = useState<string>(() => String(Math.floor(Date.now() / 1000)));
  const [dateTimeInput, setDateTimeInput] = useState<string>(() => new Date().toISOString().slice(0, 16));

  useEffect(() => {
    if (tool.id !== 'unix-timestamp-converter') return;
    const t = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [tool.id]);

  // Lorem Ipsum
  const [loremMode, setLoremMode] = useState<'paragraphs' | 'sentences' | 'words'>('paragraphs');
  const [loremQty, setLoremQty] = useState<number>(3);
  const [loremFormat, setLoremFormat] = useState<'plain' | 'html' | 'markdown' | 'json'>('plain');

  // Hash Checksum
  const [hashInput, setHashInput] = useState<string>('');
  const [hashFileName, setHashFileName] = useState<string>('');
  const [hashes, setHashes] = useState<{ sha1: string; sha256: string; sha384: string; sha512: string }>({
    sha1: '',
    sha256: '',
    sha384: '',
    sha512: '',
  });

  const computeBufferHashes = async (buf: BufferSource) => {
    const algos = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
    const results: string[] = [];
    for (const algo of algos) {
      const digest = await crypto.subtle.digest(algo, buf);
      results.push(
        Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      );
    }
    setHashes({ sha1: results[0], sha256: results[1], sha384: results[2], sha512: results[3] });
  };

  useEffect(() => {
    if (tool.id !== 'hash-checksum-generator' || hashFileName) return;
    if (!hashInput) {
      setHashes({ sha1: '', sha256: '', sha384: '', sha512: '' });
      return;
    }
    const enc = new TextEncoder().encode(hashInput);
    void computeBufferHashes(enc);
  }, [tool.id, hashInput, hashFileName]);

  // Slug & Filename Cleaner
  const [slugRaw, setSlugRaw] = useState<string>('');
  const [slugMode, setSlugMode] = useState<'url-slug' | 'safe-filename' | 'snake'>('url-slug');

  // World Clock
  const [clockBaseIso, setClockBaseIso] = useState<string>(formatCurrentLocalDatetimeInput);
  const [activeClockZones, setActiveClockZones] = useState<ClockZoneItem[]>(loadSavedClockZones);
  const [showAddCountryPanel, setShowAddCountryPanel] = useState<boolean>(false);
  const [zoneSearchQuery, setZoneSearchQuery] = useState<string>('');
  const [customCountryInput, setCustomCountryInput] = useState<string>('');
  const [customCityInput, setCustomCityInput] = useState<string>('');
  const [copiedClockSummary, setCopiedClockSummary] = useState<boolean>(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORLD_CLOCK_STORAGE_KEY, JSON.stringify(activeClockZones));
    } catch {
      // Ignore storage write errors
    }
  }, [activeClockZones]);

  const allSearchableTimezones = useMemo<ClockZoneItem[]>(() => {
    const curated = [...DEFAULT_CLOCK_ZONES, ...EXTRA_WORLD_CLOCK_CATALOG];
    const seenZones = new Set(curated.map((z) => z.zone));
    const extraIana: ClockZoneItem[] = [];
    try {
      const supportedFn = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
      const supported = typeof supportedFn === 'function' ? supportedFn('timeZone') : [];
      for (const tz of supported) {
        if (seenZones.has(tz)) continue;
        seenZones.add(tz);
        const parts = tz.split('/');
        const region = parts[0]?.replace(/_/g, ' ') || 'Global';
        const rawCity = parts[parts.length - 1]?.replace(/_/g, ' ') || tz;
        extraIana.push({
          id: `iana-${tz.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          city: rawCity,
          country: region,
          zone: tz,
        });
      }
    } catch {
      // Ignore if supportedValuesOf is unavailable
    }
    return [...curated, ...extraIana];
  }, []);

  // World Country Atlas
  const [countrySearch, setCountrySearch] = useState<string>('');

  // Email Signature
  const [sigName, setSigName] = useState('');
  const [sigRole, setSigRole] = useState('');
  const [sigCompany, setSigCompany] = useState('');
  const [sigPhone, setSigPhone] = useState('');
  const [sigEmail, setSigEmail] = useState('');
  const [sigWeb, setSigWeb] = useState('');
  const [sigLayout, setSigLayout] = useState<'classic' | 'modern' | 'compact'>('modern');
  const [sigAccent, setSigAccent] = useState('#2F3E4E');

  // Visiting Card / Review Poster / Shop Poster / UPI Validator
  const [cardName, setCardName] = useState('');
  const [cardRole, setCardRole] = useState('');
  const [cardOrg, setCardOrg] = useState('');
  const [cardPhone, setCardPhone] = useState('');
  const [cardEmail, setCardEmail] = useState('');
  const [cardCity, setCardCity] = useState('');
  const [posterTitle, setPosterTitle] = useState('');
  const [posterBusiness, setPosterBusiness] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [upiName, setUpiName] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [upiNote, setUpiNote] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const posterRef = useRef<HTMLDivElement | null>(null);

  const upiUri = useMemo(() => {
    if (!upiVpa.trim()) return '';
    return buildNpciUpiIntentUrl({
      pa: upiVpa,
      pn: upiName.trim() || 'Merchant',
      am: upiAmount && Number(upiAmount) > 0 ? Number(upiAmount) : undefined,
      cu: 'INR',
      tn: upiNote.trim() || undefined,
    });
  }, [upiVpa, upiName, upiAmount, upiNote]);

  const upiValidation = useMemo(() => validateNpciUpiIntentUrl(upiUri), [upiUri]);

  const hasVcardInput = Boolean(
    [cardName, cardRole, cardOrg, cardPhone, cardEmail, cardCity].some((v) => v.trim().length > 0)
  );

  const vcardString = useMemo(
    () =>
      `BEGIN:VCARD\nVERSION:3.0\nFN:${cardName}\nORG:${cardOrg}\nTITLE:${cardRole}\nTEL;TYPE=WORK,VOICE:${cardPhone}\nEMAIL:${cardEmail}\nADR:;;${cardCity}\nEND:VCARD`,
    [cardName, cardOrg, cardRole, cardPhone, cardEmail, cardCity]
  );

  useEffect(() => {
    let payload = '';
    if (tool.id === 'vcard-visiting-card-qr') payload = hasVcardInput ? vcardString : '';
    else if (tool.id === 'review-qr-poster') payload = posterUrl.trim();
    else if (tool.id === 'shop-payment-poster' || tool.id === 'upi-merchant-validator') {
      payload = upiValidation.isValid ? upiUri : '';
    }
    if (!payload) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(payload, {
      width: 320,
      margin: 4,
      errorCorrectionLevel: 'Q',
      color: { dark: '#2F3E4E', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [tool.id, hasVcardInput, vcardString, posterUrl, upiUri, upiValidation.isValid]);

  const headerBanner = (
    <div className="pb-5 border-b border-[#2F3E4E]/15 dark:border-slate-700 no-print">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
        <Wrench className="w-3.5 h-3.5 text-[#2F3E4E] dark:text-[#F9C80E]" />
        {tool.categoryName} · {tool.code}
      </span>
      <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100 mt-1">
        {tool.title}
      </h1>
      <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 mt-0.5">{tool.description}</p>
    </div>
  );

  // 1. CSS & JS MINIFIER
  if (tool.id === 'css-js-minifier') {
    const minified = (() => {
      let s = codeInput;
      if (codeLang === 'css') {
        s = s
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\s+/g, ' ')
          .replace(/\s*([{}:;,>+~])\s*/g, '$1')
          .replace(/;}/g, '}')
          .trim();
      } else {
        s = s
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1')
          .replace(/\s+/g, ' ')
          .replace(/\s*([{}();,=+\-*/<>!&|?:])\s*/g, '$1')
          .trim();
      }
      return s;
    })();
    const savingsPct = codeInput.length > 0 ? Math.max(0, Math.round((1 - minified.length / codeInput.length) * 100)) : 0;

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(['css', 'js'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setCodeLang(lang)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border-[1.5px] border-[#2F3E4E] dark:border-slate-600 uppercase cursor-pointer ${
                  codeLang === lang
                    ? 'bg-[#2F3E4E] text-white dark:bg-[#F9C80E] dark:text-[#0F172A]'
                    : 'bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-200'
                }`}
              >
                {lang} Minifier
              </button>
            ))}
          </div>
          <span className="font-mono text-xs font-bold text-[#12805C] dark:text-emerald-300 bg-[#CEE5DC]/65 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/25 dark:border-emerald-500/35">
            {codeInput.length} B → {minified.length} B ({savingsPct}% smaller)
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <textarea
            rows={10}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder={`Paste your ${codeLang.toUpperCase()} source code here to minify...`}
            className="w-full p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono text-xs"
          />
          <textarea
            readOnly
            rows={10}
            value={minified}
            placeholder="Minified output appears here..."
            className="w-full p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8]/45 dark:bg-[#0F172A]/80 text-[#2F3E4E] dark:text-slate-100 font-mono text-xs"
          />
        </div>
        <ToolExportBar
          onClear={() => setCodeInput('')}
          onCopy={() => void copyText(minified)}
          copied={copied}
          copyLabel="Copy Output"
          onWord={() => void downloadWordDocument(`${codeLang.toUpperCase()} Minifier Output`, [{ title: 'Minified Code', lines: [minified || '(empty)'] }], `minified-${codeLang}.docx`)}
          onJson={() => downloadJsonFile({ language: codeLang, originalBytes: codeInput.length, minifiedBytes: minified.length, savingsPct, output: minified }, `minified-${codeLang}.json`)}
          disabled={!minified}
        />
      </div>
    );
  }

  // 2. MARKDOWN STUDIO
  if (tool.id === 'markdown-studio') {
    const renderedHtml = simpleMarkdownToHtml(mdInput);
    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div>
            <label className="block text-xs font-bold text-[#2F3E4E] dark:text-slate-200 mb-1.5">Markdown Source</label>
            <textarea
              rows={12}
              value={mdInput}
              onChange={(e) => setMdInput(e.target.value)}
              placeholder="# Document Heading&#10;&#10;Write **Markdown** text, lists (`- item`), quotes (`> note`), and `inline code`..."
              className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono text-xs leading-relaxed"
            />
          </div>
          <div className="lg:sticky lg:top-20">
            <label className="block text-xs font-bold text-[#2F3E4E] dark:text-slate-200 mb-1.5">Live HTML Preview</label>
            <div
              className="p-5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] min-h-[260px] prose prose-sm max-w-none overflow-hidden break-words text-[#2F3E4E] dark:text-slate-100 [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-extrabold [&_h1]:mb-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-[#F9C80E] [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:bg-[#FEF2C8] dark:[&_code]:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
        <ToolExportBar
          onClear={() => setMdInput('')}
          onCopy={() => void copyText(renderedHtml)}
          copied={copied}
          copyLabel="Copy HTML"
          onWord={() => void downloadWordDocument('Markdown Export', [{ title: 'Markdown Document', lines: mdInput.split('\n') }], 'markdown_document.docx')}
          onJson={() => downloadJsonFile({ markdown: mdInput, html: renderedHtml }, 'markdown_export.json')}
          onPdf={() => void exportStructuredReportPdf({ title: 'Markdown Document', sections: [{ title: 'Document Content', paragraphs: mdInput.split('\n').filter(Boolean) }], filename: 'markdown_document.pdf' })}
          onPrint={() => void printHtmlDocument({ title: 'Markdown Document', bodyHtml: renderedHtml })}
          disabled={!mdInput.trim()}
          extraActions={
            <button
              type="button"
              disabled={!mdInput.trim()}
              onClick={() => {
                const blob = new Blob([renderedHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'markdown_export.html';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> .HTML
            </button>
          }
        />
      </div>
    );
  }

  // 3. UUID GENERATOR
  if (tool.id === 'uuid-generator') {
    const regen = (cnt = uuidCount, up = uuidUpper, noDash = uuidNoHyphens) => {
      const list = Array.from({ length: Math.min(100, Math.max(1, cnt)) }, () => {
        let u: string = crypto.randomUUID();
        if (noDash) u = u.replace(/-/g, '');
        return up ? u.toUpperCase() : u;
      });
      setUuids(list);
    };

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[#FEF2C8]/65 dark:bg-[#0F172A] border border-[#2F3E4E]/30 dark:border-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-200">
          <label className="flex items-center gap-2">
            <span>Count:</span>
            <input
              type="number"
              min={1}
              max={100}
              value={uuidCount}
              onChange={(e) => {
                const v = Number(e.target.value) || 1;
                setUuidCount(v);
                regen(v, uuidUpper, uuidNoHyphens);
              }}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100 font-mono"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={uuidUpper}
              onChange={(e) => {
                setUuidUpper(e.target.checked);
                regen(uuidCount, e.target.checked, uuidNoHyphens);
              }}
            />
            <span>UPPERCASE</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={uuidNoHyphens}
              onChange={(e) => {
                setUuidNoHyphens(e.target.checked);
                regen(uuidCount, uuidUpper, e.target.checked);
              }}
            />
            <span>Strip Hyphens</span>
          </label>
          <button
            type="button"
            onClick={() => regen()}
            className="ml-auto px-4 py-2 rounded-xl bg-[#2F3E4E] dark:bg-slate-800 dark:border dark:border-slate-600 text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Generate New
          </button>
        </div>
        <textarea
          readOnly
          rows={10}
          value={uuids.join('\n')}
          className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono text-xs leading-relaxed"
        />
        <ToolExportBar
          onClear={() => setUuids([])}
          onCopy={() => void copyText(uuids.join('\n'))}
          copied={copied}
          copyLabel="Copy UUIDs"
          onExcel={() => downloadExcelWorkbook('UUID_List.xlsx', [{ name: 'UUIDs', rows: [['#', 'UUID'], ...uuids.map((u, i) => [i + 1, u])] }])}
          onCsv={() => downloadBomCsv(['Index', 'UUID'], uuids.map((u, i) => [i + 1, u]), 'UUID_List.csv')}
          onJson={() => downloadJsonFile({ count: uuids.length, uppercase: uuidUpper, stripHyphens: uuidNoHyphens, uuids }, 'UUID_List.json')}
          disabled={uuids.length === 0}
        />
      </div>
    );
  }

  // 4. UNIX TIMESTAMP CONVERTER
  if (tool.id === 'unix-timestamp-converter') {
    const parsedEpoch = Number(epochInput);
    const msVal = Math.abs(parsedEpoch) > 1e11 ? parsedEpoch : parsedEpoch * 1000;
    const epochDate = Number.isFinite(msVal) ? new Date(msVal) : null;
    const isValidEpoch = Boolean(epochDate && !isNaN(epochDate.getTime()));
    const dtDate = new Date(dateTimeInput);
    const dtEpochSec = !isNaN(dtDate.getTime()) ? Math.floor(dtDate.getTime() / 1000) : 0;

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="p-5 rounded-2xl bg-[#2F3E4E] dark:bg-[#0F172A] dark:border dark:border-slate-700 text-[#FFFDF5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#F9C80E]">Current Live Unix Epoch</span>
            <p className="font-mono font-extrabold text-3xl mt-1 tabular-nums">{nowSec}</p>
          </div>
          <button
            type="button"
            onClick={() => setEpochInput(String(nowSec))}
            className="px-4 py-2 rounded-xl bg-[#F9C80E] text-[#2F3E4E] text-xs font-bold cursor-pointer self-start"
          >
            Use Current Timestamp
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 space-y-3">
            <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">Epoch → Human Date (Auto s/ms)</h3>
            <input
              type="text"
              value={epochInput}
              onChange={(e) => setEpochInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100 font-mono text-sm font-bold"
            />
            {isValidEpoch && epochDate && (
              <div className="space-y-1.5 text-xs pt-2 text-[#2F3E4E] dark:text-slate-200">
                <p><strong>IST (India):</strong> <span className="font-mono">{epochDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></p>
                <p><strong>UTC ISO:</strong> <span className="font-mono">{epochDate.toISOString()}</span></p>
                <p><strong>Local:</strong> <span className="font-mono">{epochDate.toString()}</span></p>
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 space-y-3">
            <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">Human Date → Unix Timestamp</h3>
            <input
              type="datetime-local"
              value={dateTimeInput}
              onChange={(e) => setDateTimeInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100 dark:[color-scheme:dark] font-mono text-xs font-bold"
            />
            <div className="p-3 rounded-xl bg-[#FEF2C8]/65 dark:bg-slate-800/80 space-y-1 text-xs font-mono text-[#2F3E4E] dark:text-slate-100">
              <p>Seconds: <strong>{dtEpochSec}</strong></p>
              <p>Milliseconds: <strong>{dtEpochSec * 1000}</strong></p>
            </div>
          </div>
        </div>
        <ToolExportBar
          onClear={() => {
            setEpochInput('');
            setDateTimeInput('');
          }}
          onCopy={() => void copyText(`Epoch: ${epochInput}\nUTC: ${isValidEpoch && epochDate ? epochDate.toISOString() : '—'}\nSelected Date Sec: ${dtEpochSec}`)}
          copied={copied}
          onExcel={() =>
            downloadExcelWorkbook('Unix_Timestamp_Report.xlsx', [
              {
                name: 'Timestamps',
                rows: [
                  ['Metric', 'Value'],
                  ['Live Epoch (s)', nowSec],
                  ['Epoch Input', epochInput],
                  ['IST Time', isValidEpoch && epochDate ? epochDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''],
                  ['UTC ISO', isValidEpoch && epochDate ? epochDate.toISOString() : ''],
                  ['Date Input', dateTimeInput],
                  ['Date Epoch (s)', dtEpochSec],
                ],
              },
            ])
          }
          onJson={() =>
            downloadJsonFile(
              {
                liveEpochSec: nowSec,
                epochInput,
                utcIso: isValidEpoch && epochDate ? epochDate.toISOString() : null,
                dateTimeInput,
                dateEpochSec: dtEpochSec,
              },
              'Unix_Timestamp.json'
            )
          }
        />
      </div>
    );
  }

  // 5. LOREM IPSUM GENERATOR
  if (tool.id === 'lorem-ipsum-generator') {
    const qty = Math.min(25, Math.max(1, loremQty));
    const baseChunks = (() => {
      if (loremMode === 'words') {
        const pool = LOREM_SENTENCES.join(' ').split(/\s+/);
        return [Array.from({ length: qty }, (_, i) => pool[i % pool.length]).join(' ')];
      }
      if (loremMode === 'sentences') {
        return [Array.from({ length: qty }, (_, i) => LOREM_SENTENCES[i % LOREM_SENTENCES.length]).join(' ')];
      }
      return Array.from({ length: qty }, (_, p) =>
        [0, 1, 2].map((s) => LOREM_SENTENCES[(p + s) % LOREM_SENTENCES.length]).join(' ')
      );
    })();

    const generatedLorem = (() => {
      if (loremFormat === 'html') {
        return baseChunks.map((p) => `<p>${p}</p>`).join('\n');
      }
      if (loremFormat === 'markdown') {
        return baseChunks.map((p, idx) => (loremMode === 'paragraphs' ? `### Section ${idx + 1}\n\n${p}` : `- ${p}`)).join('\n\n');
      }
      if (loremFormat === 'json') {
        return JSON.stringify({ mode: loremMode, quantity: qty, blocks: baseChunks }, null, 2);
      }
      return baseChunks.join('\n\n');
    })();

    const wordCountLorem = baseChunks.join(' ').trim().split(/\s+/).filter(Boolean).length;

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
          {(['paragraphs', 'sentences', 'words'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setLoremMode(m)}
              className={`px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 capitalize cursor-pointer ${
                loremMode === m
                  ? 'bg-[#2F3E4E] text-white dark:bg-[#F9C80E] dark:text-[#0F172A]'
                  : 'bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={25}
            value={loremQty}
            onChange={(e) => setLoremQty(Number(e.target.value) || 1)}
            className="w-20 px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono"
          />
          <div className="flex items-center gap-1 border-l border-[#2F3E4E]/20 dark:border-slate-700 pl-2.5">
            {(['plain', 'html', 'markdown', 'json'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setLoremFormat(fmt)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold uppercase cursor-pointer ${
                  loremFormat === fmt
                    ? 'bg-[#F9C80E] border-[#2F3E4E] text-[#2F3E4E]'
                    : 'bg-white dark:bg-[#0F172A] border-[#2F3E4E]/30 dark:border-slate-600 text-[#475569] dark:text-slate-300'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-[11px] font-bold text-[#12805C] dark:text-emerald-300 bg-[#CEE5DC]/65 dark:bg-emerald-950/60 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/25">
            {wordCountLorem} words · {generatedLorem.length} chars
          </span>
          <button
            type="button"
            onClick={() => {
              setLoremMode('paragraphs');
              setLoremQty(3);
              setLoremFormat('plain');
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-[#2F3E4E] dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
        <textarea
          readOnly
          rows={10}
          value={generatedLorem}
          className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 text-sm leading-relaxed font-mono"
        />
        <ToolExportBar
          clearLabel="Reset Defaults"
          onClear={() => {
            setLoremMode('paragraphs');
            setLoremQty(3);
            setLoremFormat('plain');
          }}
          onCopy={() => void copyText(generatedLorem)}
          copied={copied}
          onWord={() => void downloadWordDocument('Placeholder Text', [{ title: `${loremQty} ${loremMode} (${loremFormat})`, lines: generatedLorem.split('\n') }], 'lorem_text.docx')}
          onJson={() => downloadJsonFile({ mode: loremMode, format: loremFormat, quantity: qty, text: generatedLorem }, 'lorem_text.json')}
        />
      </div>
    );
  }

  // 6. HASH & FILE CHECKSUM GENERATOR
  if (tool.id === 'hash-checksum-generator') {
    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="flex flex-wrap items-center gap-3">
          <label className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] text-xs font-bold cursor-pointer">
            Upload File to Checksum
            <input
              type="file"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setHashFileName(f.name);
                  await computeBufferHashes(await f.arrayBuffer());
                }
              }}
            />
          </label>
          {hashFileName && (
            <button
              type="button"
              onClick={() => setHashFileName('')}
              className="px-3 py-2 rounded-xl border border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-200 text-xs font-bold cursor-pointer"
            >
              Switch Back to Text Input
            </button>
          )}
        </div>

        {!hashFileName ? (
          <textarea
            rows={4}
            value={hashInput}
            onChange={(e) => setHashInput(e.target.value)}
            placeholder="Type text to compute SHA-1, SHA-256, SHA-384 & SHA-512 hashes..."
            className="w-full p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono text-xs"
          />
        ) : (
          <div className="p-4 rounded-xl bg-[#CEE5DC]/55 dark:bg-emerald-950/60 border border-[#2F3E4E] dark:border-emerald-600/40 text-xs font-bold text-[#2F3E4E] dark:text-emerald-200">
            Checksums computed locally for binary file: <span className="font-mono">{hashFileName}</span>
          </div>
        )}

        <div className="space-y-3">
          {(
            [
              { label: 'SHA-256 (Recommended)', val: hashes.sha256 },
              { label: 'SHA-512', val: hashes.sha512 },
              { label: 'SHA-384', val: hashes.sha384 },
              { label: 'SHA-1 (Legacy)', val: hashes.sha1 },
            ] as const
          ).map((row) => (
            <div key={row.label} className="p-3.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#2F3E4E]/35 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> {row.label}
                </span>
                <p className="font-mono text-xs text-[#2F3E4E] dark:text-slate-100 break-all mt-0.5">{row.val || '—'}</p>
              </div>
              <button
                type="button"
                disabled={!row.val}
                onClick={() => void copyText(row.val)}
                className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] dark:hover:text-[#0F172A] text-xs font-bold shrink-0 cursor-pointer disabled:opacity-45"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
        <ToolExportBar
          onClear={() => {
            setHashInput('');
            setHashFileName('');
            setHashes({ sha1: '', sha256: '', sha384: '', sha512: '' });
          }}
          onCopy={() => void copyText(`SHA-256: ${hashes.sha256}\nSHA-512: ${hashes.sha512}\nSHA-384: ${hashes.sha384}\nSHA-1: ${hashes.sha1}`)}
          copied={copied}
          onExcel={() =>
            downloadExcelWorkbook('Hash_Checksums.xlsx', [
              {
                name: 'Checksums',
                rows: [
                  ['Source', hashFileName || 'Text Input'],
                  ['Algorithm', 'Digest'],
                  ['SHA-256', hashes.sha256],
                  ['SHA-512', hashes.sha512],
                  ['SHA-384', hashes.sha384],
                  ['SHA-1', hashes.sha1],
                ],
              },
            ])
          }
          onCsv={() =>
            downloadBomCsv(
              ['Algorithm', 'Digest'],
              [
                ['SHA-256', hashes.sha256],
                ['SHA-512', hashes.sha512],
                ['SHA-384', hashes.sha384],
                ['SHA-1', hashes.sha1],
              ],
              'Hash_Checksums.csv'
            )
          }
          onJson={() => downloadJsonFile({ source: hashFileName || 'text', ...hashes }, 'Hash_Checksums.json')}
          onPdf={() =>
            void exportStructuredReportPdf({
              title: 'Cryptographic Hash Report',
              subtitle: hashFileName ? `Binary File: ${hashFileName}` : 'Text Input Checksum',
              sections: [
                {
                  title: 'Digests',
                  rows: [
                    { label: 'SHA-256', value: hashes.sha256 },
                    { label: 'SHA-512', value: hashes.sha512 },
                    { label: 'SHA-384', value: hashes.sha384 },
                    { label: 'SHA-1', value: hashes.sha1 },
                  ],
                },
              ],
              filename: 'Hash_Checksums.pdf',
            })
          }
          disabled={!hashes.sha256}
        />
      </div>
    );
  }

  // 7. SEO SLUG & FILENAME CLEANER
  if (tool.id === 'slug-filename-cleaner') {
    const cleaned = slugRaw
      .split(/\r?\n/)
      .map((line) => {
        const ascii = line
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s-]/g, ' ')
          .trim();
        if (slugMode === 'url-slug') return ascii.toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
        if (slugMode === 'snake') return ascii.toLowerCase().replace(/[\s-]+/g, '_').replace(/_+/g, '_');
        return ascii.replace(/[\s-]+/g, '_').replace(/_+/g, '_');
      })
      .join('\n');

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {[
            { id: 'url-slug' as const, label: 'SEO URL Slug (kebab-case)' },
            { id: 'safe-filename' as const, label: 'OS Safe Filename' },
            { id: 'snake' as const, label: 'snake_case Identifier' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSlugMode(opt.id)}
              className={`px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 cursor-pointer ${
                slugMode === opt.id
                  ? 'bg-[#2F3E4E] text-white dark:bg-[#F9C80E] dark:text-[#0F172A]'
                  : 'bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <textarea
            rows={8}
            value={slugRaw}
            onChange={(e) => setSlugRaw(e.target.value)}
            placeholder="Paste titles or filenames (one per line) to sanitize..."
            className="w-full p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 text-xs"
          />
          <textarea
            readOnly
            rows={8}
            value={cleaned}
            placeholder="Sanitized slugs or filenames will appear here..."
            className="w-full p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8]/45 dark:bg-[#0F172A]/80 text-[#2F3E4E] dark:text-slate-100 font-mono text-xs font-bold"
          />
        </div>
        <ToolExportBar
          onClear={() => setSlugRaw('')}
          onCopy={() => void copyText(cleaned)}
          copied={copied}
          onExcel={() =>
            downloadExcelWorkbook('Cleaned_Slugs.xlsx', [
              {
                name: 'Slugs',
                rows: [
                  ['Original', 'Cleaned'],
                  ...slugRaw.split(/\r?\n/).map((raw, i) => [raw, cleaned.split(/\r?\n/)[i] || '']),
                ],
              },
            ])
          }
          onCsv={() =>
            downloadBomCsv(
              ['Original', 'Cleaned'],
              slugRaw.split(/\r?\n/).map((raw, i) => [raw, cleaned.split(/\r?\n/)[i] || '']),
              'Cleaned_Slugs.csv'
            )
          }
          onJson={() => downloadJsonFile({ mode: slugMode, input: slugRaw.split(/\r?\n/), output: cleaned.split(/\r?\n/) }, 'Cleaned_Slugs.json')}
          disabled={!cleaned.trim()}
        />
      </div>
    );
  }

  // 9. WORLD CLOCK CONVERTER
  if (tool.id === 'world-clock-converter') {
    const baseDate = new Date(clockBaseIso);
    const valid = !isNaN(baseDate.getTime());
    const istOffsetMin = valid ? getZoneOffsetMinutes(baseDate, 'Asia/Kolkata') : 330;

    const searchQ = zoneSearchQuery.trim().toLowerCase();
    const filteredAddCandidates = allSearchableTimezones
      .filter((item) => {
        if (!searchQ) return true;
        return (
          item.country.toLowerCase().includes(searchQ) ||
          item.city.toLowerCase().includes(searchQ) ||
          item.zone.toLowerCase().includes(searchQ)
        );
      })
      .slice(0, 36);

    const activeZoneSet = new Set(activeClockZones.map((z) => z.zone));

    const addCountryZone = (candidate: ClockZoneItem) => {
      const countryOverride = customCountryInput.trim();
      const cityOverride = customCityInput.trim();
      const nextItem: ClockZoneItem = {
        id: `${candidate.id}-${Date.now()}`,
        country: countryOverride || candidate.country,
        city: cityOverride || candidate.city,
        zone: candidate.zone,
      };
      setActiveClockZones((prev) => {
        if (prev.some((p) => p.zone === nextItem.zone && !countryOverride && !cityOverride)) {
          return prev;
        }
        return [...prev, nextItem];
      });
      setCustomCountryInput('');
      setCustomCityInput('');
    };

    const removeCountryZone = (id: string) => {
      setActiveClockZones((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
    };

    const copyMeetingSummary = async () => {
      if (!valid) return;
      const lines = activeClockZones.map((z) => {
        const formatted = baseDate.toLocaleString('en-IN', {
          timeZone: z.zone,
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        return `• ${z.country} (${z.city}): ${formatted}`;
      });
      await copyText(`Global Meeting Time Comparison:\n${lines.join('\n')}`);
      setCopiedClockSummary(true);
      setTimeout(() => setCopiedClockSummary(false), 1800);
    };

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}

        {/* Reference Time & Primary Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl bg-[#FEF2C8]/65 dark:bg-[#0F172A] border border-[#2F3E4E]/30 dark:border-slate-700 text-xs">
          <label className="font-bold text-[#2F3E4E] dark:text-slate-100 flex flex-wrap items-center gap-2">
            <Clock className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E] shrink-0" />
            <span>Reference Date &amp; Local Time:</span>
            <input
              type="datetime-local"
              value={clockBaseIso}
              onChange={(e) => setClockBaseIso(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100 dark:[color-scheme:dark] font-mono font-bold"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setClockBaseIso(formatCurrentLocalDatetimeInput())}
              className="px-3 py-1.5 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Live Now
            </button>
            <button
              type="button"
              onClick={() => void copyMeetingSummary()}
              className="px-3 py-1.5 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100 hover:bg-[#CEE5DC]/60 dark:hover:bg-slate-700 font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedClockSummary ? <Check className="w-3.5 h-3.5 text-[#12805C] dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedClockSummary ? 'Copied Summary' : 'Copy All Times'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddCountryPanel((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg border-[1.5px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                showAddCountryPanel
                  ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] dark:bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E]'
                  : 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E] hover:brightness-95'
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> Add Country / Timezone
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveClockZones(DEFAULT_CLOCK_ZONES);
                setClockBaseIso(formatCurrentLocalDatetimeInput());
                setZoneSearchQuery('');
                setCustomCountryInput('');
                setCustomCityInput('');
              }}
              title="Reset to 9 default cities and live local time"
              className="px-3 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#1E293B] text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset ({DEFAULT_CLOCK_ZONES.length})
            </button>
          </div>
        </div>

        {/* Add Country / Global Timezone Drawer */}
        {showAddCountryPanel && (
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-[#12805C] dark:text-emerald-400" />
                  Add More Countries &amp; Global Timezones
                </h3>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                  Pick from quick countries or search all global cities &amp; IANA timezones. You can also set an optional custom client/branch label.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCountryPanel(false)}
                className="p-1.5 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-700 text-[#475569] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Close Add Country panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick-Add Popular Countries */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                Popular Countries Quick-Add
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ADD_ZONE_IDS.map((qid) => {
                  const item = EXTRA_WORLD_CLOCK_CATALOG.find((c) => c.id === qid);
                  if (!item) return null;
                  const alreadyAdded = activeZoneSet.has(item.zone);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addCountryZone(item)}
                      disabled={alreadyAdded}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                        alreadyAdded
                          ? 'bg-[#CEE5DC]/55 dark:bg-emerald-950/50 border-[#12805C]/30 dark:border-emerald-500/35 text-[#12805C] dark:text-emerald-300 cursor-default'
                          : 'bg-[#FEF2C8]/65 dark:bg-slate-800 border-[#2F3E4E]/30 dark:border-slate-600 text-[#2F3E4E] dark:text-slate-200 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] dark:hover:text-[#0F172A] cursor-pointer'
                      }`}
                    >
                      {alreadyAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {item.country} · {item.city.split(' (')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search + Optional Custom Label */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-6 relative">
                <Search className="w-4 h-4 text-[#64748B] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={zoneSearchQuery}
                  onChange={(e) => setZoneSearchQuery(e.target.value)}
                  placeholder="Search country, city, or timezone (e.g. Canada, Riyadh, Zurich, Seoul, Paris)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100 font-medium"
                />
              </div>
              <div className="md:col-span-3">
                <input
                  type="text"
                  value={customCountryInput}
                  onChange={(e) => setCustomCountryInput(e.target.value)}
                  placeholder="Custom Country (optional)"
                  className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100"
                />
              </div>
              <div className="md:col-span-3">
                <input
                  type="text"
                  value={customCityInput}
                  onChange={(e) => setCustomCityInput(e.target.value)}
                  placeholder="Custom City / Branch (optional)"
                  className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#1E293B] text-[#2F3E4E] dark:text-slate-100"
                />
              </div>
            </div>

            {/* Search Results Grid */}
            <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pr-1">
              {filteredAddCandidates.map((candidate) => {
                const alreadyAdded = activeZoneSet.has(candidate.zone) && !customCountryInput.trim() && !customCityInput.trim();
                const previewTime = valid
                  ? baseDate.toLocaleString('en-IN', {
                      timeZone: candidate.zone,
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : '--:--';
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => addCountryZone(candidate)}
                    disabled={alreadyAdded}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                      alreadyAdded
                        ? 'bg-[#CEE5DC]/45 dark:bg-emerald-950/40 border-[#12805C]/35 dark:border-emerald-500/35 opacity-80 cursor-default'
                        : 'bg-[#FFFDF5] dark:bg-[#131C2E] border-[#2F3E4E]/25 dark:border-slate-700 hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] cursor-pointer'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#64748B] dark:text-slate-400 truncate">
                        {candidate.country}
                      </p>
                      <p className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                        {candidate.city}
                      </p>
                      <p className="text-[10px] font-mono text-[#64748B] dark:text-slate-400 truncate">
                        {candidate.zone}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block font-mono text-[11px] font-bold text-[#12805C] dark:text-emerald-400">
                        {previewTime}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#2F3E4E] dark:text-[#F9C80E]">
                        {alreadyAdded ? (
                          <>
                            <Check className="w-3 h-3" /> Added
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> Add
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredAddCandidates.length === 0 && (
                <p className="col-span-full text-center py-6 text-xs text-[#64748B] dark:text-slate-400">
                  No matching country or IANA timezone found for &ldquo;{zoneSearchQuery}&rdquo;. Try a major city name like Tokyo, Paris, Toronto, or Nairobi.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active Countries / Timezones Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeClockZones.map((z) => {
            let formatted = 'Invalid time';
            let localHour = 12;
            let utcOffsetText = '';
            let istDiffText = '';

            if (valid) {
              try {
                formatted = baseDate.toLocaleString('en-IN', {
                  timeZone: z.zone,
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });
                const hourPart = new Intl.DateTimeFormat('en-US', {
                  timeZone: z.zone,
                  hour: '2-digit',
                  hourCycle: 'h23',
                }).formatToParts(baseDate).find((p) => p.type === 'hour')?.value;
                localHour = Number(hourPart || '12');
                const offsetMin = getZoneOffsetMinutes(baseDate, z.zone);
                utcOffsetText = formatOffsetLabel(offsetMin);
                istDiffText = formatIstDiffLabel(offsetMin, istOffsetMin);
              } catch {
                formatted = 'Unsupported timezone';
              }
            }

            const isWorkHours = localHour >= 9 && localHour < 18;
            const isShoulderHours = (localHour >= 7 && localHour < 9) || (localHour >= 18 && localHour < 22);
            const hourBadgeClass = isWorkHours
              ? 'bg-[#CEE5DC]/75 dark:bg-emerald-950/70 text-[#12805C] dark:text-emerald-300 border-[#12805C]/30 dark:border-emerald-500/35'
              : isShoulderHours
              ? 'bg-[#FFE1B3]/70 dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 border-[#B45309]/30 dark:border-amber-500/35'
              : 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300 border-slate-300 dark:border-slate-600';
            const hourBadgeLabel = isWorkHours ? 'Work Hours' : isShoulderHours ? 'Flex Hours' : 'Night Hours';

            return (
              <div
                key={z.id}
                className="relative p-4 rounded-xl bg-white dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 hover:border-[#2F3E4E] dark:hover:border-slate-500 transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-slate-400 block truncate">
                      {z.country}
                    </span>
                    <p className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 truncate">
                      {z.city}
                    </p>
                  </div>
                  {activeClockZones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCountryZone(z.id)}
                      title={`Remove ${z.city}`}
                      aria-label={`Remove ${z.city}`}
                      className="p-1 rounded-md text-[#64748B] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="font-mono font-extrabold text-base text-[#12805C] dark:text-emerald-400 pt-0.5 tabular-nums">
                  {formatted}
                </p>

                {valid && utcOffsetText && (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[#2F3E4E]/10 dark:border-slate-800 text-[10px] font-mono">
                    <span className="text-[#475569] dark:text-slate-400 font-semibold">
                      {utcOffsetText} · {istDiffText}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border font-sans font-bold ${hourBadgeClass}`}>
                      {hourBadgeLabel}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ToolExportBar
          title="Export World Clock Schedule"
          clearLabel="Reset Clocks"
          onClear={() => {
            setActiveClockZones(DEFAULT_CLOCK_ZONES);
            setClockBaseIso(formatCurrentLocalDatetimeInput());
            setZoneSearchQuery('');
            setCustomCountryInput('');
            setCustomCityInput('');
          }}
          onCopy={() => void copyMeetingSummary()}
          copied={copiedClockSummary}
          onExcel={() =>
            downloadExcelWorkbook('World_Clock_Meeting_Schedule.xlsx', [
              {
                name: 'World_Clocks',
                rows: [
                  ['Country', 'City / Zone', 'Local Time', 'UTC Offset', 'IST Diff'],
                  ...activeClockZones.map((z) => {
                    const formatted = valid
                      ? baseDate.toLocaleString('en-IN', { timeZone: z.zone, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                      : 'Invalid';
                    const offsetMin = valid ? getZoneOffsetMinutes(baseDate, z.zone) : 0;
                    return [z.country, z.city, formatted, formatOffsetLabel(offsetMin), formatIstDiffLabel(offsetMin, istOffsetMin)];
                  }),
                ],
              },
            ])
          }
          onCsv={() =>
            downloadBomCsv(
              ['Country', 'City', 'Local Time', 'UTC Offset'],
              activeClockZones.map((z) => [
                z.country,
                z.city,
                valid ? baseDate.toLocaleString('en-IN', { timeZone: z.zone, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Invalid',
                valid ? formatOffsetLabel(getZoneOffsetMinutes(baseDate, z.zone)) : '',
              ]),
              'World_Clock_Schedule.csv'
            )
          }
          onWord={() =>
            void downloadWordDocument(
              'Global Meeting Schedule',
              [
                {
                  title: `Reference Time: ${clockBaseIso}`,
                  lines: activeClockZones.map(
                    (z) =>
                      `${z.country} (${z.city}): ${
                        valid
                          ? baseDate.toLocaleString('en-IN', { timeZone: z.zone, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                          : 'Invalid'
                      }`
                  ),
                },
              ],
              'World_Clock_Schedule.docx'
            )
          }
          onJson={() =>
            downloadJsonFile(
              {
                referenceLocalIso: clockBaseIso,
                zones: activeClockZones.map((z) => ({
                  ...z,
                  formatted: valid
                    ? baseDate.toLocaleString('en-IN', { timeZone: z.zone, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                    : 'Invalid',
                })),
              },
              'World_Clock_Schedule.json'
            )
          }
          onPdf={() =>
            void exportStructuredReportPdf({
              title: 'World Clock & Meeting Planner',
              subtitle: `Reference Time: ${clockBaseIso}`,
              sections: [
                {
                  title: 'Global Timezones',
                  table: {
                    headers: ['Country', 'City', 'Local Time', 'Offset'],
                    rows: activeClockZones.map((z) => [
                      z.country,
                      z.city,
                      valid
                        ? baseDate.toLocaleString('en-IN', { timeZone: z.zone, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                        : 'Invalid',
                      valid ? formatOffsetLabel(getZoneOffsetMinutes(baseDate, z.zone)) : '',
                    ]),
                  },
                },
              ],
              filename: 'World_Clock_Schedule.pdf',
            })
          }
        />
      </div>
    );
  }

  // 10. WORLD COUNTRY, CURRENCY & ISD ATLAS
  if (tool.id === 'world-country-atlas') {
    const q = countrySearch.trim().toLowerCase();
    const list = WORLD_COUNTRIES.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.iso3.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.isd.includes(q) ||
        c.capital.toLowerCase().includes(q)
    );

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="flex flex-wrap items-center gap-3">
          <Globe2 className="w-5 h-5 text-[#2F3E4E] dark:text-[#F9C80E]" />
          <input
            type="text"
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            placeholder="Search country, ISO code (IND/USA/ARE), currency (INR/AED), or dialing code (+91)..."
            className="flex-1 min-w-[240px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 text-xs font-medium"
          />
        </div>
        <div className="rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-700 overflow-x-auto max-h-[480px] bg-white dark:bg-[#0F172A]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#2F3E4E] dark:bg-slate-800 text-white sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Country</th>
                <th className="py-2.5 px-3">ISO-2 / ISO-3</th>
                <th className="py-2.5 px-3">ISD Code</th>
                <th className="py-2.5 px-3">Currency</th>
                <th className="py-2.5 px-3">Capital</th>
                <th className="py-2.5 px-3">Region</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
              {list.map((c) => (
                <tr key={c.iso3} className="hover:bg-[#FEF2C8]/40 dark:hover:bg-slate-800/60">
                  <td className="py-2 px-3 font-bold text-[#2F3E4E] dark:text-slate-100">{c.name}</td>
                  <td className="py-2 px-3 font-mono text-[#2F3E4E] dark:text-slate-300">{c.iso2} / {c.iso3}</td>
                  <td className="py-2 px-3 font-mono font-bold text-[#12805C] dark:text-emerald-400">{c.isd}</td>
                  <td className="py-2 px-3 font-mono text-[#2F3E4E] dark:text-slate-300">{c.currency} ({c.symbol})</td>
                  <td className="py-2 px-3 text-[#2F3E4E] dark:text-slate-300">{c.capital}</td>
                  <td className="py-2 px-3 text-[#64748B] dark:text-slate-400">{c.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ToolExportBar
          onClear={() => setCountrySearch('')}
          clearLabel="Clear Search"
          onExcel={() =>
            downloadExcelWorkbook('World_Country_Atlas.xlsx', [
              {
                name: 'Countries',
                rows: [
                  ['Country', 'ISO-2', 'ISO-3', 'ISD Code', 'Currency', 'Symbol', 'Capital', 'Region'],
                  ...list.map((c) => [c.name, c.iso2, c.iso3, c.isd, c.currency, c.symbol, c.capital, c.region]),
                ],
              },
            ])
          }
          onCsv={() =>
            downloadBomCsv(
              ['Country', 'ISO-2', 'ISO-3', 'ISD', 'Currency', 'Capital', 'Region'],
              list.map((c) => [c.name, c.iso2, c.iso3, c.isd, c.currency, c.capital, c.region]),
              'World_Country_Atlas.csv'
            )
          }
          onJson={() => downloadJsonFile(list, 'World_Country_Atlas.json')}
          onPdf={() =>
            void exportStructuredReportPdf({
              title: 'World Country, Currency & ISD Atlas',
              sections: [
                {
                  title: `Matched Countries (${list.length})`,
                  table: {
                    headers: ['Country', 'ISO', 'ISD', 'Currency', 'Capital'],
                    rows: list.map((c) => [c.name, `${c.iso2}/${c.iso3}`, c.isd, c.currency, c.capital]),
                  },
                },
              ],
              filename: 'World_Country_Atlas.pdf',
            })
          }
        />
      </div>
    );
  }

  // 11. EMAIL SIGNATURE GENERATOR
  if (tool.id === 'email-signature-generator') {
    const htmlSig =
      sigLayout === 'compact'
        ? `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#2F3E4E;"><tr><td><strong style="font-size:15px;color:${sigAccent};">${sigName}</strong> · ${sigRole}<br/><span style="color:#475569;">${sigCompany} | ${sigPhone} | <a href="mailto:${sigEmail}" style="color:${sigAccent};">${sigEmail}</a></span></td></tr></table>`
        : `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#2F3E4E;border-left:4px solid ${sigAccent};padding-left:14px;"><tr><td><div style="font-size:16px;font-weight:bold;color:${sigAccent};">${sigName}</div><div style="font-size:12px;color:#475569;margin-bottom:6px;">${sigRole} · <strong>${sigCompany}</strong></div><div style="font-size:12px;line-height:1.6;">Tel: ${sigPhone}<br/>Email: <a href="mailto:${sigEmail}" style="color:${sigAccent};text-decoration:none;">${sigEmail}</a><br/>Web: <a href="${sigWeb}" style="color:${sigAccent};text-decoration:none;">${sigWeb}</a></div></td></tr></table>`;

    const copyRichSignature = async () => {
      try {
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([htmlSig], { type: 'text/html' }),
              'text/plain': new Blob([`${sigName}\n${sigRole} | ${sigCompany}\n${sigPhone} | ${sigEmail}`], {
                type: 'text/plain',
              }),
            }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
          return;
        }
      } catch {
        // Fallback to raw HTML
      }
      await copyText(htmlSig);
    };

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1">
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Full Name</label>
              <input value={sigName} onChange={(e) => setSigName(e.target.value)} placeholder="e.g. Arjun Bangera" className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
            </div>
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Role / Designation</label>
              <input value={sigRole} onChange={(e) => setSigRole(e.target.value)} placeholder="e.g. Finance & Operations Manager" className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
            </div>
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Company</label>
              <input value={sigCompany} onChange={(e) => setSigCompany(e.target.value)} placeholder="e.g. Your Company Pvt Ltd" className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
            </div>
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Phone</label>
              <input value={sigPhone} onChange={(e) => setSigPhone(e.target.value)} placeholder="+91 98XXXXXXXX" className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
            </div>
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Email</label>
              <input value={sigEmail} onChange={(e) => setSigEmail(e.target.value)} placeholder="name@company.com" className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
            </div>
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Website</label>
              <input value={sigWeb} onChange={(e) => setSigWeb(e.target.value)} placeholder="https://example.com" className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
            </div>
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Layout</label>
              <select value={sigLayout} onChange={(e) => setSigLayout(e.target.value as typeof sigLayout)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100">
                <option value="modern">Modern Left Accent</option>
                <option value="compact">Compact Single-Row</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Accent Color</label>
              <input type="color" value={sigAccent} onChange={(e) => setSigAccent(e.target.value)} className="w-full h-9 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] cursor-pointer" />
            </div>
          </div>

          <div className="lg:col-span-6 lg:sticky lg:top-20 space-y-4">
            <div className="p-6 rounded-2xl bg-white dark:bg-white border-[1.5px] border-[#2F3E4E] dark:border-slate-600 overflow-hidden vcpl-qr-box">
              <p className="text-[11px] font-bold uppercase text-[#64748B] mb-3 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Gmail / Outlook Live Preview
              </p>
              {sigName || sigRole || sigCompany || sigPhone || sigEmail || sigWeb ? (
                <div dangerouslySetInnerHTML={{ __html: htmlSig }} />
              ) : (
                <p className="text-xs text-[#64748B] italic">Enter your details on the left to preview your email signature.</p>
              )}
            </div>
            <ToolExportBar
              onClear={() => {
                setSigName('');
                setSigRole('');
                setSigCompany('');
                setSigPhone('');
                setSigEmail('');
                setSigWeb('');
              }}
              onCopy={() => void copyRichSignature()}
              copied={copied}
              copyLabel="Copy Rich Signature"
              onWord={() => void downloadWordDocument('Email Signature', [{ title: sigName || 'Signature', lines: [sigName, `${sigRole} · ${sigCompany}`, sigPhone, sigEmail, sigWeb].filter(Boolean) }], 'email_signature.docx')}
              onJson={() => downloadJsonFile({ sigName, sigRole, sigCompany, sigPhone, sigEmail, sigWeb, sigLayout, htmlSig }, 'email_signature.json')}
              extraActions={
                <button
                  type="button"
                  onClick={() => void copyText(htmlSig)}
                  className="px-3 py-1.5 rounded-lg bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Code2 className="w-3.5 h-3.5" /> Raw HTML
                </button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // 12. UPI MERCHANT VALIDATOR
  if (tool.id === 'upi-merchant-validator') {
    const trimmed = upiVpa.trim();
    const match = /^([a-zA-Z0-9._-]{2,256})@([a-zA-Z]{2,64})$/.exec(trimmed);
    const pspInfo = match ? PSP_HANDLES[match[2].toLowerCase()] || `Registered Handle (@${match[2].toLowerCase()})` : '';

    return (
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-7 space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">UPI Virtual Payment Address (VPA)</label>
              <input value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="shopname@oksbi" className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono text-sm font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Payee / Shop Name</label>
                <input value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="Business / Merchant Name" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
              </div>
              <div>
                <label className="block font-bold text-[#2F3E4E] dark:text-slate-200 mb-1">Fixed Amount ₹ (Optional)</label>
                <input type="number" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} placeholder="500" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono" />
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${!trimmed ? 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700' : upiValidation.isValid ? 'bg-[#CEE5DC]/65 dark:bg-emerald-950/60 border-emerald-700/30 dark:border-emerald-500/35' : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700/50'}`}>
              <p className="font-bold text-sm text-[#2F3E4E] dark:text-slate-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#12805C] dark:text-emerald-400" />
                {!trimmed
                  ? 'Enter a UPI VPA (e.g. merchant@oksbi) to validate & build QR'
                  : upiValidation.isValid
                  ? `NPCI Intent Verified (${pspInfo || 'Valid UPI URI'})`
                  : upiValidation.errors[0] || 'Invalid UPI VPA / NPCI intent URL'}
              </p>
              {upiUri && <p className="font-mono text-[11px] text-[#475569] dark:text-slate-300 mt-2 break-all">{upiUri}</p>}
              {trimmed && upiValidation.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-rose-700 dark:text-rose-300 font-semibold">
                  {upiValidation.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
            <ToolExportBar
              onClear={() => {
                setUpiVpa('');
                setUpiName('');
                setUpiAmount('');
                setUpiNote('');
              }}
              onCopy={() => void copyText(upiUri)}
              copied={copied}
              copyLabel="Copy UPI URI"
              onJson={() => downloadJsonFile({ vpa: upiVpa, name: upiName, amount: upiAmount, psp: pspInfo, valid: upiValidation.isValid, tpapCompatible: upiValidation.tpapCompatible, errors: upiValidation.errors, upiUri }, 'upi_validation.json')}
              disabled={!upiValidation.isValid}
            />
          </div>
          <div className="md:col-span-5 md:sticky md:top-20 flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-white border-[1.5px] border-[#2F3E4E] dark:border-slate-600 overflow-hidden vcpl-qr-box">
            {qrDataUrl && upiValidation.isValid ? (
              <>
                <img src={qrDataUrl} alt="UPI Verification QR" className="w-44 h-44" />
                <span className="text-[11px] font-mono font-bold text-[#475569] mt-2">
                  {upiValidation.tpapCompatible ? 'NPCI Verified · GPay / PhonePe / Paytm Ready' : 'NPCI Valid · BHIM / Bank Apps'}
                </span>
              </>
            ) : (
              <span className="text-xs text-[#64748B] font-semibold py-12 text-center">
                {trimmed && !upiValidation.isValid ? upiValidation.errors[0] : 'Enter UPI ID to preview payment QR'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 13. VCARD VISITING CARD, 5-STAR REVIEW POSTER & SHOP PAYMENT POSTER
  const isVcard = tool.id === 'vcard-visiting-card-qr';
  const isReview = tool.id === 'review-qr-poster';

  return (
    <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 print:border-0 print:bg-white print:p-0">
      {headerBanner}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block">
        <div className="lg:col-span-5 space-y-3 text-xs lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1 no-print print:max-h-none print:overflow-visible">
          {isVcard ? (
            <>
              <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Full Name" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-bold" />
              <input value={cardRole} onChange={(e) => setCardRole(e.target.value)} placeholder="Designation" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
              <input value={cardOrg} onChange={(e) => setCardOrg(e.target.value)} placeholder="Organization" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
              <input value={cardPhone} onChange={(e) => setCardPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono" />
              <input value={cardEmail} onChange={(e) => setCardEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
              <input value={cardCity} onChange={(e) => setCardCity(e.target.value)} placeholder="Address" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([vcardString], { type: 'text/vcard' });
                  const u = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = u;
                  a.download = `${cardName.replace(/\s+/g, '_')}.vcf`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(u), 1000);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] font-bold inline-flex items-center gap-1.5 cursor-pointer mr-2"
              >
                <Download className="w-3.5 h-3.5" /> Download .VCF Contact
              </button>
            </>
          ) : isReview ? (
            <>
              <input value={posterBusiness} onChange={(e) => setPosterBusiness(e.target.value)} placeholder="Business / Shop Name" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-bold" />
              <input value={posterTitle} onChange={(e) => setPosterTitle(e.target.value)} placeholder="Headline" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
              <input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="Google Review Link" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono" />
            </>
          ) : (
            <>
              <input value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="Shop / Business Name" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-bold" />
              <input value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="UPI ID (merchant@oksbi)" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono" />
              <input type="number" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} placeholder="Fixed Amount ₹ (Optional)" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100 font-mono" />
              <input value={upiNote} onChange={(e) => setUpiNote(e.target.value)} placeholder="Payment Note" className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0F172A] text-[#2F3E4E] dark:text-slate-100" />
              {upiVpa.trim() && (
                <div className={`p-2.5 rounded-xl border text-[11px] font-semibold ${upiValidation.isValid ? 'bg-[#CEE5DC]/60 border-emerald-700/30 text-[#12805C] dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'}`}>
                  {upiValidation.isValid
                    ? upiValidation.tpapCompatible
                      ? 'NPCI Intent Verified · Ready for GPay, PhonePe, Paytm & BHIM'
                      : 'NPCI Intent Valid · BHIM / Bank Apps Only'
                    : upiValidation.errors[0]}
                </div>
              )}
            </>
          )}

          <ToolExportBar
            onClear={() => {
              if (isVcard) {
                setCardName(''); setCardRole(''); setCardOrg(''); setCardPhone(''); setCardEmail(''); setCardCity('');
              } else if (isReview) {
                setPosterBusiness(''); setPosterTitle(''); setPosterUrl('');
              } else {
                setUpiName(''); setUpiVpa(''); setUpiAmount(''); setUpiNote('');
              }
            }}
            onJson={() =>
              downloadJsonFile(
                isVcard
                  ? { cardName, cardRole, cardOrg, cardPhone, cardEmail, cardCity, vcard: vcardString }
                  : isReview
                  ? { posterBusiness, posterTitle, posterUrl }
                  : { upiName, upiVpa, upiAmount, upiNote, upiUri },
                `${isVcard ? 'vcard' : isReview ? 'review_poster' : 'shop_upi'}.json`
              )
            }
            onPdf={() => {
              const nameSlug = (isVcard ? cardName : isReview ? posterBusiness : upiName)
                .replace(/[^\w-]+/g, '_') || 'Standee';
              void exportElementToPdf({
                element: posterRef.current,
                filename: `${nameSlug}.pdf`,
              });
            }}
            onPrint={() => {
              void printTargetElement({
                element: posterRef.current,
                title: isVcard
                  ? `Business_Card_${cardName || 'Contact'}`
                  : isReview
                  ? `Review_Standee_${posterBusiness || 'Shop'}`
                  : `UPI_Standee_${upiName || 'Shop'}`,
                prepareClone: (clone) => {
                  clone.style.boxShadow = 'none';
                  clone.style.margin = '12mm auto';
                },
              });
            }}
            disabled={!qrDataUrl}
          />
        </div>

        <div className="lg:col-span-7 lg:sticky lg:top-20 print:static flex justify-center print:w-full">
          <div
            ref={posterRef}
            className="vcpl-qr-box w-full max-w-md p-6 rounded-2xl bg-white dark:bg-white border-2 border-[#2F3E4E] dark:border-slate-400 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] print:shadow-none print:mx-auto text-center space-y-4 overflow-hidden"
          >
            {isVcard ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                <div className="space-y-1">
                  <span className="px-2 py-0.5 rounded bg-[#F9C80E] border border-[#2F3E4E] text-[10px] font-bold uppercase text-[#2F3E4E]">
                    {cardOrg || 'Organization'}
                  </span>
                  <h3 className="font-display font-extrabold text-xl text-[#2F3E4E] pt-1">{cardName || 'Full Name'}</h3>
                  <p className="text-xs font-bold text-[#12805C]">{cardRole || 'Designation'}</p>
                  <p className="text-xs font-mono text-[#475569] pt-2">{cardPhone || '+91 —'}</p>
                  <p className="text-xs text-[#475569]">{cardEmail || 'email@example.com'}</p>
                  <p className="text-[11px] text-[#64748B]">{cardCity || 'Address / City'}</p>
                </div>
                {qrDataUrl && (
                  <div className="p-2 rounded-xl border border-[#2F3E4E]/30 bg-[#FEF2C8]/40 shrink-0 text-center">
                    <img src={qrDataUrl} alt="vCard QR" className="w-28 h-28" />
                    <span className="text-[9px] font-mono font-bold text-[#2F3E4E]">Scan to Save Contact</span>
                  </div>
                )}
              </div>
            ) : isReview ? (
              <>
                <div className="flex justify-center gap-1 text-[#F9C80E]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="w-6 h-6 fill-[#F9C80E] stroke-[#2F3E4E]" />
                  ))}
                </div>
                <h3 className="font-display font-extrabold text-2xl text-[#2F3E4E]">{posterBusiness || 'Your Business Name'}</h3>
                <p className="text-sm font-bold text-[#12805C]">{posterTitle || 'We Value Your Feedback!'}</p>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Review QR" className="w-48 h-48 mx-auto rounded-xl border border-[#2F3E4E]/20" />
                ) : (
                  <p className="text-xs text-[#64748B] py-10">Paste your Google Review link to generate QR standee</p>
                )}
                <p className="text-xs text-[#475569] font-semibold">Scan with Phone Camera to Leave a 5-Star Google Review</p>
              </>
            ) : (
              <>
                <div className="px-3 py-1 rounded-full bg-[#FEF2C8] border border-[#2F3E4E] inline-flex items-center gap-1.5 text-xs font-bold text-[#2F3E4E]">
                  <QrCode className="w-3.5 h-3.5" /> Accepted Everywhere · BHIM UPI
                </div>
                <h3 className="font-display font-extrabold text-2xl text-[#2F3E4E]">{upiName || 'Your Shop Name'}</h3>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Shop UPI QR" className="w-52 h-52 mx-auto rounded-xl border-[1.5px] border-[#2F3E4E]" />
                ) : (
                  <p className="text-xs text-[#64748B] py-10">Enter UPI ID to generate BHIM UPI payment standee</p>
                )}
                <p className="font-mono text-xs font-bold text-[#2F3E4E] bg-[#CEE5DC]/60 py-1.5 px-3 rounded-lg inline-block">
                  {upiVpa || 'merchant@upi'} {upiAmount ? `· ₹${upiAmount}` : ''}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
