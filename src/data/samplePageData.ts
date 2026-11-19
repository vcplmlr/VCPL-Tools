export type DisciplineCategory = 'all' | 'architecture' | 'product' | 'wayfinding';

export interface CapabilityItem {
  id: string;
  number: string;
  title: string;
  category: Exclude<DisciplineCategory, 'all'>;
  categoryLabel: string;
  summary: string;
  deliverables: string;
  timeline: string;
  featured?: boolean;
}

export interface CaseStudy {
  id: string;
  title: string;
  discipline: string;
  location: string;
  year: string;
  metric: string;
  summary: string;
  challenge: string;
  outcome: string;
  imageSrc: string;
  imageAlt: string;
}

export interface ProcessStep {
  number: string;
  title: string;
  description: string;
  duration: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const STUDIO_METRICS = [
  { value: '42', label: 'Completed Commissions', context: '2019–2026' },
  { value: '14 yrs', label: 'Practice Tenure', context: 'Zurich & Portland' },
  { value: '+38%', label: 'Measured Visitor Flow', context: 'Transit & Civic Sites' },
  { value: '6–12 wks', label: 'Concept to Specification', context: 'Standard Retainer' },
];

export const CAPABILITIES: CapabilityItem[] = [
  {
    id: 'spatial-architecture',
    number: '01',
    title: 'Spatial Architecture & Civic Pavilions',
    category: 'architecture',
    categoryLabel: 'Architecture',
    summary:
      'Timber, glass, and cast-concrete structures engineered for coastal durability, natural daylighting, and low-carbon assembly.',
    deliverables: 'Feasibility study · Mass-timber detailing · Site supervision',
    timeline: '12–24 weeks',
    featured: true,
  },
  {
    id: 'industrial-hardware',
    number: '02',
    title: 'Industrial Product & Enclosure Design',
    category: 'product',
    categoryLabel: 'Product',
    summary:
      'CNC-machined aluminum housings, tactile controls, and DFM documentation ready for tooling handoff.',
    deliverables: 'CAD surfacing · Tolerance stackups · Tooling prototypes',
    timeline: '8–14 weeks',
  },
  {
    id: 'environmental-wayfinding',
    number: '03',
    title: 'Environmental Graphics & Wayfinding',
    category: 'wayfinding',
    categoryLabel: 'Wayfinding',
    summary:
      'Legible signage programs in anodized bronze and etched stone designed to guide high-volume pedestrian concourses.',
    deliverables: 'Circulation mapping · Type system · Fabrication drawings',
    timeline: '6–10 weeks',
  },
  {
    id: 'material-prototyping',
    number: '04',
    title: 'Material Research & Mockup Fabrication',
    category: 'architecture',
    categoryLabel: 'Architecture',
    summary:
      'Full-scale joinery assemblies, acoustic testing, and finish boards produced inside our workshop before general tender.',
    deliverables: '1:1 joinery mockups · Acoustic test logs · Finish schedule',
    timeline: '4–8 weeks',
    featured: true,
  },
];

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'oslo-timber-pavilion',
    title: 'Fjordside Cultural Pavilion',
    discipline: 'Architecture',
    location: 'Oslo',
    year: '2025',
    metric: '42% lower embodied carbon vs. concrete baseline',
    summary:
      'A charred-pine lakeside gathering hall built on minimal stone footings with full-height triple glazing.',
    challenge:
      'The municipal site sat along a granite shoreline with strict seasonal wind loads and zero tolerance for deep excavation.',
    outcome:
      'Delivered a prefabricated cross-laminated timber frame erected in 19 days, welcoming 64,000 visitors in its opening year.',
    imageSrc: '/src/assets/images/case_timber_pavilion_1795092850450.jpg',
    imageAlt: 'Minimalist Nordic timber and glass cultural pavilion beside calm water at dusk',
  },
  {
    id: 'kora-acoustic-monitor',
    title: 'Kora Reference Studio Monitor',
    discipline: 'Product Design',
    location: 'Zurich',
    year: '2026',
    metric: '18% tooling cost reduction across 5,000 units',
    summary:
      'A compact brushed-aluminum desktop monitor featuring a weighted rotary attenuator and zero visible fasteners.',
    challenge:
      'Acoustic resonance inside small milled enclosures frequently muddies midrange clarity and complicates assembly.',
    outcome:
      'Consolidated six internal brackets into a single extruded chassis, cutting unit assembly time from 24 minutes to 9 minutes.',
    imageSrc: '/src/assets/images/case_industrial_device_1795092849663.jpg',
    imageAlt: 'Precision brushed-aluminum acoustic speaker with tactile rotary dial on travertine plinth',
  },
  {
    id: 'nordbahnhof-wayfinding',
    title: 'Nordbahnhof Transit Wayfinding',
    discipline: 'Wayfinding',
    location: 'Basel',
    year: '2025',
    metric: '+38% faster platform transfer times',
    summary:
      'A modular dark-bronze directional signage family anchored directly to board-formed concrete piers.',
    challenge:
      'Commuters navigating three underground rail levels faced competing commercial banners and inconsistent arrow hierarchies.',
    outcome:
      'Installed 114 high-contrast directional blades with replaceable rail-line inserts, reducing concierge directional inquiries by half.',
    imageSrc: '/src/assets/images/case_wayfinding_system_1795092849770.jpg',
    imageAlt: 'Matte anodized dark bronze architectural wayfinding signage mounted on raw concrete in transit hall',
  },
];

export const PROCESS_STEPS: ProcessStep[] = [
  {
    number: '01',
    title: 'Site & Systems Audit',
    description:
      'Every commission opens with physical site measurements, manufacturing constraints, and pedestrian or user flow baselines.',
    duration: 'Weeks 1–2',
  },
  {
    number: '02',
    title: 'Material & Scale Prototyping',
    description:
      'Rather than relying solely on screen renders, we machine physical test sections and daylight models to validate ergonomics and finish durability.',
    duration: 'Weeks 3–6',
  },
  {
    number: '03',
    title: 'Production Specification',
    description:
      'We issue tender-ready drawings, tolerance schedules, and supplier bill-of-materials so contractors build without ambiguity.',
    duration: 'Weeks 7–12',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-scope',
    question: 'What project budgets and scales do you typically take on?',
    answer:
      'Architecture and wayfinding commissions usually range from CHF 180k to CHF 4.5M in construction value. Industrial product retainers start at six weeks for concept-to-DFM handoff.',
  },
  {
    id: 'faq-regions',
    question: 'Do you work with fabricators outside Switzerland and the Pacific Northwest?',
    answer:
      'Yes. Our teams in Zurich and Portland coordinate directly with timber mills, CNC workshops, and signage fabricators across Europe, North America, and Japan.',
  },
  {
    id: 'faq-timeline',
    question: 'How soon can a new commission begin after an initial consultation?',
    answer:
      'Discovery workshops are scheduled within ten business days of an inquiry, with full studio allocation available at the start of the following month.',
  },
];
