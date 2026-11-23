import { BlogPostItem } from '../types/blog';

export const PASSWORD_SECURITY_TECH_POST: BlogPostItem = {
  slug: 'advanced-password-handling-and-browser-cryptography',
  title:
    'Advanced Password Handling & Browser Cryptography: Argon2id, Peppering & Zero-Upload Decryption',
  seoTitle:
    'Advanced Password Handling: Argon2id, Peppering, Timing-Safe Verification & Browser Crypto | VCPL Tools',
  excerpt:
    'Technical deep dive by Arjun Bangera covering memory-hard Argon2id hashing, HMAC server-side peppering, Unicode NFKC normalization, constant-time verification, and client-side Web Crypto decryption.',
  seoDescription:
    'Production architecture guide for password storage and client-side document decryption: Argon2id parameters, HMAC peppering, timingSafeEqual, k-anonymity breach checks, and Web Crypto API.',
  category: 'PDF & Privacy',
  topicTags: ['Banking & UPI'],
  articleType: 'technical',
  difficulty: 'Advanced',
  hasPasswordLab: true,
  coverImage: '/blog/advanced-password-handling-and-browser-cryptography.svg',
  coverImageAlt:
    'Precision machined cryptographic steel cylinders and matte dark hardware illustrating Argon2id password security and zero-upload decryption',
  coverTheme: 'pdf',
  coverBadge: 'TECHNICAL · PASSWORD SECURITY',
  publishedIso: '2026-11-23',
  publishedLabel: '23 Nov 2026',
  updatedIso: '2026-11-23',
  updatedLabel: '23 Nov 2026',
  readTime: '10 min read',
  authorId: 'arjun-bangera',
  author: 'Arjun Bangera',
  authorRole: 'Web Developer, AI Integrator & UI/UX Designer',
  keywords: [
    'Argon2id password hashing TypeScript',
    'HMAC pepper password storage',
    'timingSafeEqual authentication',
    'zero-upload PDF password decryption',
    'Web Crypto API SHA-256',
  ],
  relatedToolIds: ['pdf-unlocker', 'pdf-redact', 'form-26as-to-excel'],
  relatedSlugs: [
    'offline-pdf-security-and-ocr-workflows',
    'form-26as-tds-tcs-excel-reconciliation-guide',
  ],
  keyTakeaways: [
    'Use Argon2id (RFC 9106) with at least 64 MiB memoryCost, 3 iterations, and per-user CSPRNG salts—never fast SHA-256 or legacy 72-byte-truncated bcrypt for new systems.',
    'Wrap NFKC-normalized passwords with an isolated HMAC-SHA256 server-side pepper before hashing so raw database leaks remain cryptographically useless.',
    'Eliminate login timing side channels by verifying against a dummy Argon2id hash on email misses and bound concurrent verifications to prevent RAM exhaustion.',
    'For sensitive financial documents like bank statements and Form 26AS PDFs, decrypt strictly in local browser memory via [PDF Unlocker](#tool:pdf-unlocker) rather than uploading passwords to remote servers.',
  ],
  sections: [
    {
      id: 'threat-model-fast-hashes',
      heading: '1. Threat Model: Why General-Purpose Hashes & Unbounded Concurrency Fail',
      paragraphs: [
        'Credential compromises rarely happen because an attacker breaks SHA-256 mathematically. They happen when an adversary extracts a database snapshot through a misconfigured backup, SQL injection, or leaked log archive and runs offline GPU/ASIC cracking rigs against static digests.',
        'Fast cryptographic digests such as SHA-256 and SHA-512 are built for speed—modern GPU clusters evaluate tens of billions of guesses per second. Even bcrypt, long treated as the default baseline, allocates only a tiny 4 KiB state array and silently drops every character after byte 72.',
        'Argon2id solves this by binding each password verification to real RAM bandwidth (memory-hardness) alongside configurable CPU passes, driving up the hardware cost of parallelized cracking by orders of magnitude.',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Key Derivation Function Comparison for Production Authentication',
          headers: ['Algorithm', 'Memory Hardness', 'Input Length Limit', 'GPU / ASIC Resistance', 'Engineering Verdict'],
          rows: [
            ['Argon2id (RFC 9106)', 'Configurable (64+ MiB)', 'Arbitrary (with pre-hash)', 'High (Hybrid access pattern)', 'Primary Standard'],
            ['scrypt', 'Configurable', 'Arbitrary', 'High', 'Acceptable Legacy'],
            ['bcrypt', 'Fixed 4 KiB', '72 bytes (silent truncation)', 'Moderate', 'Migrate on Login'],
            ['PBKDF2-HMAC-SHA256', 'None (CPU-only)', 'Arbitrary', 'Low vs GPU clusters', 'FIPS-Mandated Only'],
          ],
        },
      ],
    },
    {
      id: 'nfkc-and-hmac-peppering',
      heading: '2. Pre-Hashing Pipeline: NFKC Normalization & Server-Side Peppering',
      paragraphs: [
        'Before hashing any credential, normalize UTF-8 text using Unicode NFKC. Cross-platform keyboards and password managers can represent accented characters or full-width punctuation with different underlying byte sequences; NFKC canonicalization ensures identical visual input produces identical digests everywhere.',
        'Second, apply an HMAC-SHA256 server-side pepper kept inside KMS or an isolated runtime secret—never inside the SQL database. Wrapping the password in HMAC produces a fixed 32-byte input for Argon2id, preventing length-truncation issues while ensuring a stolen database dump cannot be cracked without also compromising your secret manager.',
      ],
      blocks: [
        {
          type: 'code',
          filename: 'src/security/passwordService.ts',
          language: 'TypeScript',
          code: `import crypto from 'node:crypto';
import argon2 from 'argon2';

const PEPPER_KEY = process.env.AUTH_PEPPER_SECRET;
if (!PEPPER_KEY || PEPPER_KEY.length < 32) {
  throw new Error('AUTH_PEPPER_SECRET must be >= 32 bytes');
}

function prehashWithPepper(rawPassword: string): Buffer {
  const normalized = rawPassword.normalize('NFKC');
  return crypto
    .createHmac('sha256', PEPPER_KEY)
    .update(normalized, 'utf8')
    .digest();
}

export async function hashUserPassword(rawPassword: string): Promise<string> {
  if (rawPassword.length < 12 || rawPassword.length > 128) {
    throw new RangeError('Password length must be between 12 and 128 characters.');
  }

  const pepperedInput = prehashWithPepper(rawPassword);

  return argon2.hash(pepperedInput, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB per verification
    timeCost: 3,       // 3 iterations
    parallelism: 1,    // Predictable concurrency per request
    hashLength: 32,
  });
}`,
        },
        {
          type: 'callout',
          tone: 'info',
          label: 'Zero-Downtime Pepper Rotation',
          text: 'Store a key version prefix (for example, v2$argon2id$...) alongside each hash. When rotating AUTH_PEPPER_SECRET, verify incoming logins against the active key first, fall back to the retired key if needed, and re-hash transparently on success.',
        },
      ],
    },
    {
      id: 'timing-safe-and-dos-guard',
      heading: '3. Timing-Safe Verification, Dummy Hashes & Memory-DoS Protection',
      paragraphs: [
        'Returning in 2 ms when an email is unknown versus 160 ms when Argon2id runs for an existing account leaks user existence via response-time side channels. Always execute an equivalent Argon2id verification against a precomputed dummy hash when no account matches.',
        'At the same time, memory-hard hashing introduces a denial-of-service vector: 500 simultaneous login requests each allocating 64 MiB require 32 GiB of RAM. Gate password verification behind an explicit concurrency semaphore and per-IP/account sliding-window rate limiter.',
      ],
      blocks: [
        {
          type: 'code',
          filename: 'src/security/verifyLogin.ts',
          language: 'TypeScript',
          code: `import argon2 from 'argon2';

const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHR2YWx1ZQ$9xK3...';

export async function verifyCredentials(
  storedHash: string | null,
  rawPassword: string
): Promise<boolean> {
  const targetHash = storedHash ?? DUMMY_HASH;
  const pepperedInput = prehashWithPepper(rawPassword);

  try {
    const isMatch = await argon2.verify(targetHash, pepperedInput);
    return Boolean(storedHash) && isMatch;
  } catch {
    return false;
  }
}`,
        },
      ],
    },
    {
      id: 'client-side-pdf-decryption',
      heading: '4. Client-Side Document Password Handling (Zero-Upload Architecture)',
      paragraphs: [
        'Password hygiene extends beyond user login screens. Indian bank e-statements, TRACES Form 26AS PDFs, and CDSL CAS reports are routinely encrypted using predictable personal identifiers like PAN + Date of Birth. Uploading those files together with their open passwords to cloud PDF converters exposes both the document and the credential.',
        'Inside [PDF Unlocker](#tool:pdf-unlocker) and [Permanent PDF Redactor](#tool:pdf-redact), decryption and stream flattening execute purely inside local browser RAM via WebAssembly and JavaScript buffers—meaning neither the file bytes nor the password ever traverse a network socket. Pair this with our walkthrough on [handling password-protected bank statements locally](#blog:offline-pdf-security-and-ocr-workflows).',
      ],
      proTip:
        'Test passphrase length, NFKC normalization, Argon2id memory-cost resistance, and local Web Crypto SHA-256 pre-hashing interactively in the lab below.',
    },
  ],
  faqs: [
    {
      question: 'Why does Arjun recommend Argon2id over bcrypt for modern web authentication?',
      answer:
        'Argon2id enforces configurable RAM allocation (64+ MiB) that severely penalizes GPU and ASIC cracking hardware, whereas bcrypt is limited to 4 KiB of memory and silently truncates passwords beyond 72 bytes.',
    },
    {
      question: 'What is the difference between a salt and a pepper in password handling?',
      answer:
        'A salt is a unique random public value stored alongside each hash in the database to defeat rainbow tables. A pepper is a secret cryptographic key stored outside the database (e.g., KMS or environment secret) applied via HMAC before hashing.',
    },
    {
      question: 'Does the interactive Password Security Lab below send test passphrases to any server?',
      answer:
        'No. It runs 100% locally in your browser using JavaScript and the native window.crypto.subtle Web Crypto API.',
    },
    {
      question: 'How does VCPL Tools handle passwords for bank statement or Form 26AS PDFs?',
      answer:
        'All PDF decryption inside PDF Unlocker and PDF to Excel Convertor Form 26AS executes strictly in local browser memory with zero file or password uploads.',
    },
  ],
  conclusion: [
    'Modern password handling combines three layers: Unicode NFKC normalization with HMAC peppering, memory-hard Argon2id derivation guarded by concurrency caps, and zero-upload client-side cryptography wherever users work with sensitive encrypted documents.',
  ],
};
