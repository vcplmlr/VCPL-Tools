export type HttpErrorCode =
  | 400
  | 401
  | 403
  | 404
  | 408
  | 410
  | 429
  | 500
  | 502
  | 503
  | 504;

export type HttpErrorCategory = 'client' | 'server';

export interface HttpErrorMeta {
  code: HttpErrorCode;
  category: HttpErrorCategory;
  shortTitle: string;
  badgeLabel: string;
  headline: string;
  description: string;
  troubleshootingTitle: string;
  reasons: [string, string, string];
  supportsRetry: boolean;
  retryLabel?: string;
  statusNote: string;
}

export const ALL_HTTP_ERROR_CODES: HttpErrorCode[] = [
  400,
  401,
  403,
  404,
  408,
  410,
  429,
  500,
  502,
  503,
  504,
];

export const ERROR_PAGES_CONFIG: Record<HttpErrorCode, HttpErrorMeta> = {
  400: {
    code: 400,
    category: 'client',
    shortTitle: 'Bad Request',
    badgeLabel: 'ERROR 400 · BAD REQUEST',
    headline: 'The request URL or parameter format could not be processed.',
    description:
      'Your browser sent a malformed address, invalid query parameter, or unreadable payload to this route.',
    troubleshootingTitle: 'Common Causes & Quick Fixes',
    reasons: [
      'Check for accidental spaces, broken query strings (?code= or ?tool=), or truncated links.',
      'If you opened an older bookmark with custom parameters, return to Home and relaunch the tool cleanly.',
      'Clear stale browser site cache if a previously saved route fails validation.',
    ],
    supportsRetry: false,
    statusNote: 'Client syntax validation check failed',
  },
  401: {
    code: 401,
    category: 'client',
    shortTitle: 'Unauthorized',
    badgeLabel: 'ERROR 401 · UNAUTHORIZED',
    headline: 'Authentication or a valid session token is required to continue.',
    description:
      'This protected endpoint cannot be opened without verified credentials or an active authorization session.',
    troubleshootingTitle: 'How to Regain Access',
    reasons: [
      'All public VCPL Banking, GST, PDF, Image, and Calculator tools never require sign-in—launch them from All Tools.',
      'If you accessed an administrative or API sync route, verify your active credentials and try again.',
      'Contact the VCPL engineering team if you believe an access link expired prematurely.',
    ],
    supportsRetry: false,
    statusNote: 'Authorization credentials missing or expired',
  },
  403: {
    code: 403,
    category: 'client',
    shortTitle: 'Access Forbidden',
    badgeLabel: 'ERROR 403 · ACCESS FORBIDDEN',
    headline: 'Permission to view this directory or protected path is restricted.',
    description:
      'The server understood your request, but security policies block direct access to this folder, configuration, or private route.',
    troubleshootingTitle: 'Why Access Was Restricted',
    reasons: [
      'Direct directory browsing or protected internal API paths are intentionally locked for user safety.',
      'Your network proxy, VPN, or corporate firewall may be filtering access to this specific route.',
      'Navigate via the main VCPL Tools directory to open approved client-side tools normally.',
    ],
    supportsRetry: false,
    statusNote: 'Protected route · Policy enforcement active',
  },
  404: {
    code: 404,
    category: 'client',
    shortTitle: 'Page Not Found',
    badgeLabel: 'ERROR 404 · PAGE NOT FOUND',
    headline: "We couldn't find the tool or page you were looking for.",
    description:
      'The requested address does not match an active VCPL utility, guide, or information page.',
    troubleshootingTitle: 'Find What You Need Quickly',
    reasons: [
      'Double-check the URL spelling—some tools live under /tools/, /bank-slips/, /tax-gst/, or /pdf-tools/.',
      'Press Ctrl + K (or click Search Tools) to jump immediately to any tool by keyword or tool code.',
      'Explore the Popular Tool Suites or HTML Sitemap to browse every active browser utility.',
    ],
    supportsRetry: false,
    statusNote: 'Route unmatched in VCPL directory',
  },
  408: {
    code: 408,
    category: 'client',
    shortTitle: 'Request Timeout',
    badgeLabel: 'ERROR 408 · REQUEST TIMEOUT',
    headline: 'The connection took too long to finish sending your request.',
    description:
      'The server closed the idle connection before the full request completed, usually due to a brief network interruption.',
    troubleshootingTitle: 'Recommended Recovery Steps',
    reasons: [
      'Click Retry Connection below once your Wi-Fi or mobile data signal stabilizes.',
      'Large lookup batches should be split into smaller steps when network bandwidth is low.',
      'Local VCPL utilities (Deposit Slips, Calculators, PDF Suite) run offline in your browser once loaded.',
    ],
    supportsRetry: true,
    retryLabel: 'Retry Connection',
    statusNote: 'Client upload or handshake window elapsed',
  },
  410: {
    code: 410,
    category: 'client',
    shortTitle: 'Resource Gone',
    badgeLabel: 'ERROR 410 · PERMANENTLY REMOVED',
    headline: 'This legacy page or retired tool link has been permanently removed.',
    description:
      'The requested URL was intentionally retired or superseded by a newer VCPL Tools module and is no longer hosted here.',
    troubleshootingTitle: 'Where to Go Next',
    reasons: [
      'Search the current VCPL catalog for the upgraded version of this banking, GST, or PDF utility.',
      'Update any saved browser bookmarks to the current category URL from the HTML Sitemap.',
      'Visit All Tools to see all currently maintained utilities and Special modules.',
    ],
    supportsRetry: false,
    statusNote: 'Retired endpoint · No forwarding alias configured',
  },
  429: {
    code: 429,
    category: 'client',
    shortTitle: 'Too Many Requests',
    badgeLabel: 'ERROR 429 · RATE LIMIT EXCEEDED',
    headline: 'Whoa there—too many rapid requests were sent in a short window.',
    description:
      'Temporary rate protection paused repeated directory or API lookups to keep VCPL Tools fast and responsive for everyone.',
    troubleshootingTitle: 'How to Clear Rate Limiting',
    reasons: [
      'Wait 15–30 seconds before clicking Retry Request so your request window resets cleanly.',
      'Avoid rapid automated refreshing or parallel tab polling against PIN/IFSC/RTO lookup APIs.',
      'Client-side utilities (Calculators, Bank Slips, PDF, Image tools) have zero rate limits and run locally.',
    ],
    supportsRetry: true,
    retryLabel: 'Retry After Pause',
    statusNote: 'Burst protection throttle active',
  },
  500: {
    code: 500,
    category: 'server',
    shortTitle: 'Internal Server Error',
    badgeLabel: 'ERROR 500 · INTERNAL SERVER ERROR',
    headline: 'Something went wrong unexpectedly while preparing this workspace.',
    description:
      'An unexpected runtime or server exception interrupted the current view. Your local browser files and saved preferences remain safe.',
    troubleshootingTitle: 'How to Recover Immediately',
    reasons: [
      'Click Reload Workspace to reset the active view cleanly without losing saved favorites.',
      'If a specific file upload triggered this state in a local tool, refresh and test with a smaller file.',
      'Report persistent issues with the route path via Contact Us so our engineers can patch it rapidly.',
    ],
    supportsRetry: true,
    retryLabel: 'Reload Workspace',
    statusNote: 'Unhandled execution fault caught cleanly',
  },
  502: {
    code: 502,
    category: 'server',
    shortTitle: 'Bad Gateway',
    badgeLabel: 'ERROR 502 · BAD GATEWAY',
    headline: 'An upstream gateway returned an invalid response to our server.',
    description:
      'A temporary edge routing or upstream API hiccup prevented this page from completing cleanly.',
    troubleshootingTitle: 'What You Can Do',
    reasons: [
      'Click Retry Request—upstream gateway blips typically clear automatically within seconds.',
      'Check whether an active deployment or CDN propagation is completing.',
      'Switch to any client-side VCPL tool via Browse All Tools; browser tools do not depend on upstream APIs.',
    ],
    supportsRetry: true,
    retryLabel: 'Retry Gateway',
    statusNote: 'Upstream edge relay returned invalid payload',
  },
  503: {
    code: 503,
    category: 'server',
    shortTitle: 'Service Unavailable',
    badgeLabel: 'ERROR 503 · SERVICE UNAVAILABLE',
    headline: 'This service is temporarily paused for maintenance or high load.',
    description:
      'The backend endpoint is momentarily unavailable while updates deploy or traffic stabilizes. Normal service resumes shortly.',
    troubleshootingTitle: 'Maintenance & Offline Options',
    reasons: [
      'Wait 30–60 seconds and click Check Status / Retry to reconnect cleanly.',
      'Scheduled database refreshes or deployments are brief and preserve all existing routes.',
      'All browser-local VCPL suites (Bank Slips, Tax Calculators, PDF Suite, Tulusiri Pro) continue working offline.',
    ],
    supportsRetry: true,
    retryLabel: 'Check Status & Retry',
    statusNote: 'Temporary maintenance or capacity pause',
  },
  504: {
    code: 504,
    category: 'server',
    shortTitle: 'Gateway Timeout',
    badgeLabel: 'ERROR 504 · GATEWAY TIMEOUT',
    headline: 'The upstream server took too long to respond in time.',
    description:
      'Our edge proxy waited for a response from an upstream service, but the deadline expired before data arrived.',
    troubleshootingTitle: 'Troubleshooting Steps',
    reasons: [
      'Click Retry Request to open a fresh connection to the server.',
      'If running a large lookup or export, try narrowing your search query first.',
      'Offline-ready VCPL browser utilities execute directly on your device with instant zero-timeout speed.',
    ],
    supportsRetry: true,
    retryLabel: 'Retry Request',
    statusNote: 'Upstream response deadline exceeded',
  },
};

export function isHttpErrorCode(code: number): code is HttpErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_PAGES_CONFIG, code);
}

export function parseHttpErrorCode(
  value: string | number | null | undefined
): HttpErrorCode | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed)) return null;
  return isHttpErrorCode(parsed) ? parsed : null;
}
