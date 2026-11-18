export type BlockCategory = 'all' | 'layouts' | 'interactive';

export interface SampleBlock {
  id: string;
  number: string;
  title: string;
  category: Exclude<BlockCategory, 'all'>;
  categoryLabel: string;
  summary: string;
  span: 'wide' | 'standard';
  image?: {
    src: string;
    alt: string;
    fallbackLabel: string;
  };
  specNotes: string;
  breakpointRule: string;
  sampleCode: string;
}

export interface SampleMetric {
  value: string;
  label: string;
  context: string;
}

export interface CaseStudy {
  id: string;
  client: string;
  sector: string;
  timeframe: string;
  metric: string;
  headline: string;
  summary: string;
}

export const HERO_METRICS: SampleMetric[] = [
  {
    value: '1,152px',
    label: 'Container Measure',
    context: 'Centered desktop frame with 24px gutters',
  },
  {
    value: '0.8s',
    label: 'Median First Paint',
    context: 'Static assets with zero layout shift',
  },
  {
    value: '12-Col',
    label: 'Asymmetric Grid',
    context: 'Adapts cleanly from 1440px down to 375px',
  },
  {
    value: '100%',
    label: 'Keyboard Navigable',
    context: 'Visible focus rings and 44px touch targets',
  },
];

export const SAMPLE_BLOCKS: SampleBlock[] = [
  {
    id: 'editorial-grid',
    number: '01',
    title: 'Editorial Grid & Material System',
    category: 'layouts',
    categoryLabel: 'Grid Layouts',
    summary:
      'A two-column asymmetric bento layout pairing crisp structural surfaces with generous whitespace and clear visual anchors.',
    span: 'wide',
    image: {
      src: '/src/assets/images/bento_design_system_1795007800700.jpg',
      alt: 'Overhead arrangement of architectural paper grids, metal ruler, and ceramic color samples on stone',
      fallbackLabel: 'Architectural grid and material sample composition',
    },
    specNotes:
      'Uses col-span-2 on desktop viewports to anchor primary visual proof while maintaining a single-level hairline border.',
    breakpointRule: '3 columns at ≥768px, single stacked column below 768px.',
    sampleCode: `<section className="grid grid-cols-1 md:grid-cols-3 gap-6">\n  <article className="md:col-span-2 border border-slate-200 rounded-xl p-6 bg-white">...</article>\n</section>`,
  },
  {
    id: 'typographic-scale',
    number: '02',
    title: 'Balanced Type Hierarchy',
    category: 'layouts',
    categoryLabel: 'Grid Layouts',
    summary:
      'Display headings scale smoothly via clamp() while body prose keeps a comfortable 65-character measure for rapid scanning.',
    span: 'standard',
    specNotes:
      'Pairs Bricolage Grotesque for structured headlines with Plus Jakarta Sans for clean multi-line prose.',
    breakpointRule: 'Fluid display sizing from 36px mobile to 60px desktop.',
    sampleCode: `<h1 className="text-[clamp(2.25rem,4vw,3.75rem)] leading-[1.08] tracking-tight text-balance">\n  Clear Sample Headline\n</h1>`,
  },
  {
    id: 'interactive-filtering',
    number: '03',
    title: 'Instant Category Filtering',
    category: 'interactive',
    categoryLabel: 'Interactive UI',
    summary:
      'Segmented filter controls update visible layout blocks in place without page reloads or jarring visual jumps.',
    span: 'standard',
    specNotes:
      'Button controls announce active states clearly using surface elevation and crisp dark ink contrast.',
    breakpointRule: 'Single-line horizontal tabs with whitespace-nowrap.',
    sampleCode: `<button\n  type="button"\n  onClick={() => setFilter('layouts')}\n  aria-pressed={filter === 'layouts'}\n>\n  Grid Layouts\n</button>`,
  },
  {
    id: 'workspace-showcase',
    number: '04',
    title: 'Responsive Media Framing',
    category: 'interactive',
    categoryLabel: 'Interactive UI',
    summary:
      'High-resolution imagery fits fixed aspect ratios with automatic fallback containers if an asset fails to load.',
    span: 'wide',
    image: {
      src: '/src/assets/images/showcase_workspace_desk_1795007801321.jpg',
      alt: 'Modern oak desk with monitor beside courtyard glass windows in soft daylight',
      fallbackLabel: 'Modern workspace desk and courtyard window view',
    },
    specNotes:
      'Every image container pairs object-cover framing with a graceful SVG fallback block so layouts never collapse.',
    breakpointRule: 'Fixed 4:3 aspect container inside the wide bento card.',
    sampleCode: `<ResilientImage\n  src="/src/assets/images/showcase_workspace_desk_1795007801321.jpg"\n  alt="Modern oak desk"\n  fallbackLabel="Workspace preview"\n/>`,
  },
];

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'nordkapp-portal',
    client: 'Nordkapp Systems',
    sector: 'B2B Logistics',
    timeframe: '6 Months Post-Launch',
    metric: '+140% Qualified Inquiries',
    headline: 'Replacing fragmented product sheets with a single structured landing flow',
    summary:
      'Consolidated twelve legacy brochure pages into one scannable overview, cutting average visitor time-to-contact from four minutes to under forty seconds.',
  },
  {
    id: 'atelier-commerce',
    client: 'Vesterbro Goods',
    sector: 'Direct Retail',
    timeframe: '90 Days Post-Launch',
    metric: '-38% Checkout Drop-off',
    headline: 'Simplifying mobile form validation and inline shipping disclosures',
    summary:
      'Replaced multi-step popups with inline field validation and clear upfront delivery windows, lifting completed mobile orders across Nordic markets.',
  },
];
