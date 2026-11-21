export interface PavilionModel {
  id: string;
  name: string;
  capacity: string;
  footprintMm: string;
  footprintFt: string;
  basePriceUsd: number;
  airflowLs: number;
  assemblyHours: number;
  summary: string;
}

export interface TimberFinish {
  id: string;
  name: string;
  origin: string;
  swatchHex: string;
  grainNote: string;
  priceDeltaUsd: number;
}

export interface GlazingOption {
  id: string;
  name: string;
  ratingDb: number;
  specDetail: string;
  priceDeltaUsd: number;
}

export interface CaseStudy {
  id: string;
  title: string;
  client: string;
  location: string;
  category: 'Corporate HQ' | 'Audio & Media' | 'Research Labs';
  year: string;
  image: string;
  imageAlt: string;
  primaryMetric: string;
  secondaryMetric: string;
  summary: string;
  challenge: string;
  outcome: string;
  specsUsed: string;
  testimonial: {
    quote: string;
    author: string;
    role: string;
    company: string;
  };
}

export const HERO_MEDIA = {
  pavilionImage: '/src/assets/images/hero_acoustic_pavilion_1795256118471.jpg',
  pavilionAlt:
    'Haldor Systems modular white oak and matte charcoal acoustic workspace pavilion inside a sunlit concrete atrium',
  timberDetailImage: '/src/assets/images/material_timber_detail_1795256118648.jpg',
  timberDetailAlt:
    'Quarter-sawn white oak acoustic slats backed with dark recycled felt and brushed anodized aluminum joinery',
};

export const HERO_METRICS = [
  {
    value: '-38 dB',
    label: 'ISO 23351-1 Speech Attenuation',
  },
  {
    value: '4.5 hrs',
    label: 'Dry-Joint On-Site Assembly',
  },
  {
    value: '100%',
    label: 'FSC-Certified Timber Core',
  },
  {
    value: 'Portland & Zurich',
    label: 'Regional Fabrication Workshops',
  },
];

export const PAVILION_MODELS: PavilionModel[] = [
  {
    id: 'solo',
    name: 'H-01 Solo Booth',
    capacity: '1 Person',
    footprintMm: '1,100 × 1,050 × 2,260 mm',
    footprintFt: '3.6 × 3.4 × 7.4 ft',
    basePriceUsd: 8400,
    airflowLs: 24,
    assemblyHours: 2.5,
    summary: 'Compact call and focus enclosure engineered for high-density open floors.',
  },
  {
    id: 'duo',
    name: 'H-02 Duo Studio',
    capacity: '2 People',
    footprintMm: '2,200 × 1,400 × 2,260 mm',
    footprintFt: '7.2 × 4.6 × 7.4 ft',
    basePriceUsd: 14900,
    airflowLs: 42,
    assemblyHours: 4.0,
    summary: 'Two-seat collaboration room with integrated oak worktable and dual-circuit power.',
  },
  {
    id: 'four',
    name: 'H-04 Meeting Room',
    capacity: '4 People',
    footprintMm: '2,400 × 2,200 × 2,280 mm',
    footprintFt: '7.9 × 7.2 × 7.5 ft',
    basePriceUsd: 21800,
    airflowLs: 68,
    assemblyHours: 4.5,
    summary: 'Freestanding four-person project enclosure with zero floor-anchoring required.',
  },
  {
    id: 'boardroom',
    name: 'H-08 Pavilion Suite',
    capacity: '8 People',
    footprintMm: '4,200 × 2,800 × 2,340 mm',
    footprintFt: '13.8 × 9.2 × 7.7 ft',
    basePriceUsd: 38500,
    airflowLs: 120,
    assemblyHours: 7.5,
    summary: 'Full architectural room-within-a-room supporting video conferencing and hybrid sprints.',
  },
];

export const TIMBER_FINISHES: TimberFinish[] = [
  {
    id: 'white-oak',
    name: 'Quarter-Sawn White Oak',
    origin: 'Oregon Timber Mill',
    swatchHex: '#C5A075',
    grainNote: 'Straight medullary ray grain with clear matte waterborne oil.',
    priceDeltaUsd: 0,
  },
  {
    id: 'nordic-ash',
    name: 'Kiln-Bleached Nordic Ash',
    origin: 'Finnish Forestry Cooperative',
    swatchHex: '#DCD2C0',
    grainNote: 'Pale uniform grain tailored for bright daylight-flooded atriums.',
    priceDeltaUsd: 650,
  },
  {
    id: 'smoked-walnut',
    name: 'Thermal Smoked Walnut',
    origin: 'Swiss Alpine Joinery',
    swatchHex: '#564134',
    grainNote: 'Deep kiln-darkened heartwood with muted satin finish.',
    priceDeltaUsd: 1450,
  },
];

export const GLAZING_OPTIONS: GlazingOption[] = [
  {
    id: 'single-acoustic',
    name: '10.8 mm Laminated Acoustic Glass',
    ratingDb: 34,
    specDetail: 'PVB acoustic interlayer · Class B speech privacy',
    priceDeltaUsd: 0,
  },
  {
    id: 'double-acoustic',
    name: '21.5 mm Double-Cavity Acoustic Glazing',
    ratingDb: 38,
    specDetail: 'Argon-damped twin panes · Class A+ executive privacy',
    priceDeltaUsd: 2400,
  },
];

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'krono-nordic-hq',
    title: 'Curved Ash Meeting Enclosures for an Open Terrazzo Atrium',
    client: 'Krono Architecture & Engineering',
    location: 'Zurich, Switzerland',
    category: 'Corporate HQ',
    year: '2026',
    image: '/src/assets/images/case_study_nordic_hq_1795256118715.jpg',
    imageAlt:
      'Open-plan Zurich engineering studio featuring curved Nordic ash acoustic meeting pods on terrazzo floors',
    primaryMetric: '-36 dB Speech Transmission Drop',
    secondaryMetric: '42% Fewer Noise Complaints in 90 Days',
    summary:
      'Deployed 14 modular H-04 and H-02 units across a converted concrete warehouse without piercing structural terrazzo floors.',
    challenge:
      'High ceilings and exposed concrete slabs caused a 1.8-second reverberation time, making confidential client calls impossible at open desks.',
    outcome:
      'Installed 14 dry-joint timber enclosures over a single weekend. Post-occupancy acoustic surveys recorded a 42% drop in noise complaints within 90 days.',
    specsUsed: 'H-04 Meeting Room · Kiln-Bleached Nordic Ash · 10.8 mm Acoustic Glass',
    testimonial: {
      quote:
        'Before Haldor, our project leads left the building for every client review. Installing fourteen pods over one weekend cut floor-level speech bleed by 36 decibels without touching our landlord ceiling.',
      author: 'Henrik Lindholm',
      role: 'VP of Workplace Operations',
      company: 'Krono Architecture & Engineering',
    },
  },
  {
    id: 'tonmeister-lab',
    title: 'Precision Walnut Diffuser Suite for Spatial Audio Mastering',
    client: 'Tonmeister Sound Laboratories',
    location: 'Portland, Oregon',
    category: 'Audio & Media',
    year: '2026',
    image: '/src/assets/images/case_study_audio_lab_1795256118967.jpg',
    imageAlt:
      'Sound engineering studio lined with sculpted dark walnut acoustic diffuser panels and matte anodized aluminum frames',
    primaryMetric: '0.28s Target RT60 Reverberation',
    secondaryMetric: '100% Relocatable Leasehold Fit-Out',
    summary:
      'Engineered an isolated listening and dialogue editing room using quadratic-residue walnut diffusers and twin-pane acoustic glazing.',
    challenge:
      'The studio needed broadcast-grade low-frequency isolation inside a leased historic brick building where permanent drywall partitions were prohibited.',
    outcome:
      'Achieved a measured 0.28s RT60 decay profile and -38 dB exterior street attenuation while preserving full asset portability at lease end.',
    specsUsed: 'H-08 Pavilion Suite · Thermal Smoked Walnut · 21.5 mm Double-Cavity Glazing',
    testimonial: {
      quote:
        'Traditional studio framing would have cost double and stayed behind when our lease expires. Haldor delivered a flat 0.28-second room decay in five days of clean assembly.',
      author: 'Miriam Vance',
      role: 'Lead Mastering Engineer',
      company: 'Tonmeister Sound Laboratories',
    },
  },
  {
    id: 'vortex-biomed-labs',
    title: 'Zero-Vibration Focus Bays Adjacent to Cleanroom Corridors',
    client: 'Helvetia Diagnostics Lab',
    location: 'Basel, Switzerland',
    category: 'Research Labs',
    year: '2025',
    image: '/src/assets/images/hero_acoustic_pavilion_1795256118471.jpg',
    imageAlt:
      'White oak and matte charcoal acoustic focus pavilion installed in a modern concrete research corridor',
    primaryMetric: '31 dBA Interior Ambient Floor',
    secondaryMetric: '18-Day Fabrication to Commissioning',
    summary:
      'Delivered six enclosed data-review bays adjacent to high-airflow HVAC mechanical corridors with silent laminar ventilation.',
    challenge:
      'Mechanical corridor hum (64 dBA) prevented clinical researchers from reviewing sensitive diagnostic recordings near wet lab benches.',
    outcome:
      'Reduced interior ambient noise inside the bays to 31 dBA while maintaining 68 L/s silent positive-pressure fresh air exchange.',
    specsUsed: 'H-02 Duo Studio · Quarter-Sawn White Oak · 21.5 mm Double-Cavity Glazing',
    testimonial: {
      quote:
        'Eighteen days from PO to commissioned bays—no dust, no wet trades, and our clinical staff now complete audio reviews steps from the lab.',
      author: 'Dr. Lukas Weber',
      role: 'Director of Laboratory Infrastructure',
      company: 'Helvetia Diagnostics Lab',
    },
  },
];
