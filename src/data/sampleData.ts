export type WorkCategory = 'all' | 'architecture' | 'industrial';

export interface CapabilityItem {
  id: string;
  number: string;
  title: string;
  summary: string;
  deliverables: string[];
  leadTime: string;
  spanWide?: boolean;
}

export interface ProjectItem {
  id: string;
  category: Exclude<WorkCategory, 'all'>;
  categoryLabel: string;
  year: string;
  location: string;
  title: string;
  summary: string;
  outcomeMetric: string;
  imageSrc: string;
  imageAlt: string;
  specs: {
    label: string;
    value: string;
  }[];
  narrative: string;
}

export interface OutcomeMetric {
  value: string;
  label: string;
  context: string;
}

export const STUDIO_METRICS: OutcomeMetric[] = [
  {
    value: '18 yrs',
    label: 'Practice tenure',
    context: 'Founded in Zurich, expanded to Kyoto in 2016',
  },
  {
    value: '42',
    label: 'Built commissions',
    context: 'Public pavilions, workspaces, and consumer hardware',
  },
  {
    value: '94%',
    label: 'Repeat partnerships',
    context: 'Multi-year client retainers across 3+ project phases',
  },
  {
    value: '6–14 wks',
    label: 'Prototype cycle',
    context: 'From initial CAD architecture to physical sign-off',
  },
];

export const CAPABILITIES: CapabilityItem[] = [
  {
    id: 'spatial-architecture',
    number: '01.',
    title: 'Architectural Environments & Pavilions',
    summary:
      'Site-responsive timber and concrete structures designed around daylight modeling, passive thermal mass, and modular joinery.',
    deliverables: [
      'Schematic site & solar massing',
      'Full structural joinery schedules',
      'On-site contractor coordination',
    ],
    leadTime: '12–24 weeks',
    spanWide: true,
  },
  {
    id: 'industrial-hardware',
    number: '02.',
    title: 'Industrial Hardware & Enclosures',
    summary:
      'Precision CNC-machined aluminum and acoustic textile products engineered for serviceability and low-waste assembly.',
    deliverables: [
      'CMYK & surface finish specifications',
      'DFM / DFA tolerance verification',
      'Tooling vendor handoff package',
    ],
    leadTime: '8–14 weeks',
  },
  {
    id: 'material-prototyping',
    number: '03.',
    title: 'Physical Scale & Material Prototyping',
    summary:
      'In-house 1:20 architectural timber models and functional 1:1 hardware prototypes validated prior to tooling commitments.',
    deliverables: [
      'CNC & resin appearance models',
      'Acoustic & tactile stress testing',
      'Material swatch sample library',
    ],
    leadTime: '3–6 weeks',
  },
  {
    id: 'production-engineering',
    number: '04.',
    title: 'Production Engineering & Quality Audits',
    summary:
      'Direct collaboration with European and Japanese fabrication partners to stabilize yield rates and preserve design intent at volume.',
    deliverables: [
      'First-article inspection checklists',
      'Packaging & drop-test engineering',
      'Batch tolerance audit reporting',
    ],
    leadTime: '6–10 weeks',
    spanWide: true,
  },
];

export const PROJECTS: ProjectItem[] = [
  {
    id: 'kamo-courtyard-pavilion',
    category: 'architecture',
    categoryLabel: 'Architecture',
    year: '2025',
    location: 'Kyoto',
    title: 'Kamo Courtyard Pavilion',
    summary:
      'A 420m² Japanese cedar and low-iron glass reading sanctuary cantilevered over a quiet basalt reflection basin.',
    outcomeMetric: '+38% Daylight Autonomy Across 420m²',
    imageSrc: '/src/assets/images/work_timber_pavilion_1794800014760.jpg',
    imageAlt:
      'Minimalist timber and glass courtyard pavilion beside a dark stone reflection pool at golden hour',
    specs: [
      { label: 'Footprint', value: '420 m²' },
      { label: 'Primary Timber', value: 'Kiln-dried Hinoki cypress' },
      { label: 'Glazing Spec', value: 'Triple-pane low-iron, U-0.68' },
      { label: 'Completion', value: '11 months from brief' },
    ],
    narrative:
      'Engineered with concealed steel flitch plates inside traditional mortise-and-tenon cypress posts, the pavilion eliminates interior columns while reducing daytime artificial lighting demand by 38% across seasonal solar angles.',
  },
  {
    id: 'monolith-nearfield-monitor',
    category: 'industrial',
    categoryLabel: 'Industrial',
    year: '2026',
    location: 'Zurich',
    title: 'Aora Series-1 Reference Monitor',
    summary:
      'An anodized 6061 aluminum nearfield desktop monitor wrapped in undyed Scottish acoustic wool with tool-free rear servicing.',
    outcomeMetric: '-24% Enclosure Machining Cost at 5,000-Unit Scale',
    imageSrc: '/src/assets/images/work_acoustic_speaker_1794800015145.jpg',
    imageAlt:
      'Brushed anodized aluminum and charcoal woven wool desktop monitor speaker on travertine stone',
    specs: [
      { label: 'Dimensions', value: '142 × 218 × 168 mm' },
      { label: 'Chassis', value: 'Bead-blasted 6061-T6 aluminum' },
      { label: 'Acoustic Grille', value: 'Magnetic Kvadrat wool frame' },
      { label: 'Unit Mass', value: '3.45 kg per monitor' },
    ],
    narrative:
      'By unifying the rear heatsink and structural baffle into a single extruded profile, we cut CNC milling time by 24% per unit and allowed every internal driver and amplifier board to be replaced in under four minutes.',
  },
];

export const CLIENT_TESTIMONIAL = {
  quote:
    'Kanso Studio brought rare discipline to our Kyoto campus build. Every structural joint and lighting fixture arrived with clear fabrication tolerances—cutting on-site change orders by 62% compared to our previous two builds.',
  author: 'Hanna Lindqvist',
  role: 'Director of Facilities',
  organization: 'Nordvik Cultural Trust',
};
