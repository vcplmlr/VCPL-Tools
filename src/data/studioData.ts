export type ProjectDiscipline = 'all' | 'hardware' | 'spatial' | 'instruments';

export interface CapabilityItem {
  id: string;
  index: string;
  title: string;
  summary: string;
  deliverables: string[];
  spanClass: string;
}

export interface MaterialSpec {
  id: string;
  name: string;
  code: string;
  finish: string;
  tolerance: string;
  application: string;
  swatchColor: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  client: string;
  discipline: Exclude<ProjectDiscipline, 'all'>;
  disciplineLabel: string;
  year: string;
  location: string;
  image: string;
  imageAlt: string;
  headlineMetric: string;
  metricContext: string;
  summary: string;
  challenge: string;
  solution: string;
  outcomes: { label: string; value: string }[];
  testimonial: {
    quote: string;
    author: string;
    role: string;
    organization: string;
  };
}

export const HERO_IMAGE = {
  src: '/src/assets/images/hero_design_studio_1794734793307.jpg',
  alt: 'Monolith Atelier design studio in Zurich with natural oak drafting table and machined aluminum prototypes',
};

export const BENCHMARKS = [
  { value: '142', label: 'Hardware & Spatial Releases' },
  { value: '99.4%', label: 'First-Pass Tooling Yield' },
  { value: '18', label: 'International Design Citations' },
  { value: '14 wk', label: 'Median Prototype-to-Tooling' },
];

export const CAPABILITIES: CapabilityItem[] = [
  {
    id: 'industrial-hardware',
    index: '01.',
    title: 'Industrial Hardware & Enclosure Engineering',
    summary:
      'From initial ergonomic study to 5-axis CNC aluminum and injection-molded production tooling, we engineer physical instruments built for decades of tactile daily use.',
    deliverables: [
      'Ergonomic form studies & clay/foam mockups',
      'DFM CAD assemblies & thermal enclosure simulation',
      'Supplier tooling sign-off across Europe and Japan',
    ],
    spanClass: 'lg:col-span-2',
  },
  {
    id: 'spatial-architecture',
    index: '02.',
    title: 'Spatial Environments & Pavilions',
    summary:
      'Exhibition galleries, acoustic listening rooms, and architectural flagships shaped through natural daylight, cast concrete, and untreated timber.',
    deliverables: [
      'Architectural lighting & acoustic modeling',
      'Custom millwork & modular exhibition fixtures',
      'Wayfinding typography & material curation',
    ],
    spanClass: 'lg:col-span-1',
  },
  {
    id: 'embedded-interfaces',
    index: '03.',
    title: 'Embedded Device Interfaces',
    summary:
      'Deterministic rotary controls, high-contrast OLED instrument readouts, and tactile hardware-software couplings designed without visual clutter.',
    deliverables: [
      'OLED & e-ink micro-UI architecture',
      'Haptic detent & rotary encoder tuning',
      'Real-time telemetry & calibration workflows',
    ],
    spanClass: 'lg:col-span-1',
  },
  {
    id: 'production-systems',
    index: '04.',
    title: 'Material Research & Design Systems',
    summary:
      'Unified CMF specifications, packaging architecture, and digital product systems that keep every physical and screen touchpoint coherent at global scale.',
    deliverables: [
      'Anodized aluminum & ceramic finish libraries',
      'Molded pulp & zero-plastic transit packaging',
      'Multi-platform component & token documentation',
    ],
    spanClass: 'lg:col-span-2',
  },
];

export const MATERIAL_SPECS: MaterialSpec[] = [
  {
    id: 'aluminum',
    name: 'Bead-Blasted 6061-T6 Aluminum',
    code: 'AL-6061-AN2',
    finish: 'Clear sulfuric anodize, 18 µm matte oxide layer',
    tolerance: '±0.025 mm CNC datum flatness',
    application: 'Desktop audio enclosures, precision rotary dials, optical mounts',
    swatchColor: '#D4D6D9',
  },
  {
    id: 'ceramic',
    name: 'Sintered Alumina Ceramic Composite',
    code: 'CR-960-MT',
    finish: 'Micro-honed satin mineral coat, zero-glare 8 GU',
    tolerance: '±0.040 mm post-sinter diamond grind',
    application: 'Clinical diagnostic housings, handheld field spectrometers',
    swatchColor: '#E8E6DF',
  },
  {
    id: 'hinoki',
    name: 'Kiln-Dried Kiso Hinoki Cypress',
    code: 'WD-HN-04',
    finish: 'Unsealed raw planed grain, acoustic micro-slat profile',
    tolerance: '±0.500 mm architectural joinery seam',
    application: 'Museum pavilion baffles, listening room acoustic walls',
    swatchColor: '#C9A77C',
  },
];

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'helios-m1',
    title: 'Helios M1 Reference Audio Interface',
    client: 'Helios Acoustics AG',
    discipline: 'hardware',
    disciplineLabel: 'Hardware',
    year: '2026',
    location: 'Zurich',
    image: '/src/assets/images/project_audio_hardware_1794734794283.jpg',
    imageAlt: 'Helios M1 brushed aluminum desktop audio interface with matte black knurled rotary dial on travertine',
    headlineMetric: '-38% Assembly Time',
    metricContext: 'Single-billet unibody chassis replaced 14 stamped sub-parts',
    summary:
      'A reference-grade desktop DAC and headphone amplifier machined from a single block of 6061 aluminum with a custom optical-detent rotary attenuator.',
    challenge:
      'Previous generation units suffered from audible chassis resonance and a 22-minute manual assembly sequence across fourteen separate fasteners.',
    solution:
      'We consolidated the internal shielding and external housing into one 5-axis milled monocoque shell paired with a magnetically damped brass-core volume dial.',
    outcomes: [
      { label: 'Chassis Assembly Time', value: '-38%' },
      { label: 'Unit Production Cost', value: '-21%' },
      { label: 'First-Year Shipments', value: '18,400 units' },
    ],
    testimonial: {
      quote:
        'Before Monolith redesigned the housing, our Zurich line stalled at 40 units per shift. Consolidating to their single-billet chassis cut assembly time by 38% and cleared every acoustic resonance test on the first run.',
      author: 'Lukas Meier',
      role: 'VP of Hardware Engineering',
      organization: 'Helios Acoustics AG',
    },
  },
  {
    id: 'kamo-pavilion',
    title: 'Kamo River Acoustic & Ceramic Pavilion',
    client: 'Kyoto Craft Foundation',
    discipline: 'spatial',
    disciplineLabel: 'Spatial',
    year: '2025',
    location: 'Kyoto',
    image: '/src/assets/images/project_spatial_pavilion_1794734794569.jpg',
    imageAlt: 'Minimalist concrete and hinoki cypress timber gallery corridor illuminated by natural museum skylight',
    headlineMetric: '42,000 Annual Visitors',
    metricContext: 'Maintains 34 dBA ambient noise floor in central Kyoto',
    summary:
      'A permanent 640-square-meter exhibition corridor uniting cast architectural concrete with dry-joined Kiso hinoki baffles beneath diffused north-facing skylights.',
    challenge:
      'The foundation needed a serene contemplative gallery directly adjacent to an active urban thoroughfare without heavy mechanical soundproofing.',
    solution:
      'Our Kyoto studio tuned vertical hinoki louver spacing to absorb mid-frequency street reflection while bouncing natural daylight evenly across ceramic plinths.',
    outcomes: [
      { label: 'Interior Noise Floor', value: '34 dBA' },
      { label: 'Daylight Autonomy', value: '86% hrs/yr' },
      { label: 'Annual Attendance', value: '42,000 guests' },
    ],
    testimonial: {
      quote:
        'Visitors immediately drop their voices the moment they cross the threshold. Monolith turned a noisy street-front warehouse into our quietest permanent gallery without sacrificing natural daylight.',
      author: 'Haruka Takahashi',
      role: 'Curatorial Director',
      organization: 'Kyoto Craft Foundation',
    },
  },
  {
    id: 'optica-c10',
    title: 'Optica C-10 Portable Field Spectrometer',
    client: 'Verve Photonics GmbH',
    discipline: 'instruments',
    disciplineLabel: 'Instruments',
    year: '2026',
    location: 'Basel',
    image: '/src/assets/images/project_medical_instrument_1794734794582.jpg',
    imageAlt: 'Optica C-10 compact matte ceramic optical diagnostic instrument with titanium lens barrel',
    headlineMetric: '+64% Field Durability',
    metricContext: 'IP65 sealed ceramic-titanium housing with 1.8s cold boot',
    summary:
      'A handheld optical water and soil spectrometer pairing a shock-isolated titanium lens bayonet with a sunlit-readable top-deck OLED calibration interface.',
    challenge:
      'Field technicians struggled to operate multi-level touchscreen menus while wearing chemical gloves in bright outdoor glare.',
    solution:
      'We relocated the primary workflow to three knurled physical encoders directly beneath a recessed high-contrast monochrome OLED readout, eliminating accidental touches.',
    outcomes: [
      { label: 'Calibration Speed', value: '2.4x faster' },
      { label: 'Drop-Test Survival', value: '+64% pass rate' },
      { label: 'Field Units Active', value: '6,200 devices' },
    ],
    testimonial: {
      quote:
        'Moving technicians off fragile touchscreens onto Monolith’s three-dial OLED deck eliminated field support tickets for gloved operation and cut per-sample calibration time more than in half.',
      author: 'Dr. Elena Fischer',
      role: 'Head of Product Systems',
      organization: 'Verve Photonics GmbH',
    },
  },
];
