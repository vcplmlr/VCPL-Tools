export type TrailerStatus = 'At Dock' | 'Inbound' | 'Alert';

export type DemoMode = 'dispatch' | 'thermal' | 'gate';

export interface TrailerRecord {
  id: string;
  carrier: string;
  cargo: string;
  dockBay: string | null;
  etaOrTime: string;
  currentTempC: number;
  targetTempC: number;
  humidityPct: number;
  status: TrailerStatus;
  gateLane: string;
  sealNumber: string;
}

export interface BenchmarkMetric {
  value: string;
  label: string;
  context: string;
}

export interface CaseStudy {
  id: string;
  client: string;
  region: string;
  headlineMetric: string;
  title: string;
  summary: string;
  quote: string;
  personName: string;
  personRole: string;
  imageSrc?: string;
  imageAlt?: string;
}

export const HERO_IMAGE = '/src/assets/images/hero_logistics_hub_1794811049343.jpg';
export const DOCK_BAY_IMAGE = '/src/assets/images/capability_dock_bay_1794811051411.jpg';
export const THERMAL_SENSOR_IMAGE = '/src/assets/images/capability_thermal_sensor_1794811050985.jpg';
export const PORT_CASE_IMAGE = '/src/assets/images/case_study_port_1794811051166.jpg';

export const BENCHMARK_METRICS: BenchmarkMetric[] = [
  {
    value: '38%',
    label: 'Faster Trailer Turnaround',
    context: 'Measured across 14 distribution yards over 90 days',
  },
  {
    value: '99.94%',
    label: 'Thermal Audit Compliance',
    context: 'Continuous 15-second telemetry logs per shipment',
  },
  {
    value: '4.2 min',
    label: 'Average Gate-to-Bay Time',
    context: 'Automated ANPR gate verification and bay routing',
  },
  {
    value: '18,400',
    label: 'Reefer Loads Dispatched Monthly',
    context: 'Active cold-chain volume across North America and EU',
  },
];

export const AVAILABLE_DOCK_BAYS: string[] = [
  'Bay 04',
  'Bay 07',
  'Bay 09',
  'Bay 12',
  'Bay 15',
  'Bay 18',
];

export const INITIAL_TRAILERS: TrailerRecord[] = [
  {
    id: 'TRL-4812',
    carrier: 'Nordic Cold Line',
    cargo: 'Biologics & Chilled Reagents',
    dockBay: 'Bay 04',
    etaOrTime: 'Docked 06:15',
    currentTempC: 2.1,
    targetTempC: 2.0,
    humidityPct: 54,
    status: 'At Dock',
    gateLane: 'Lane A2',
    sealNumber: 'KST-99410',
  },
  {
    id: 'TRL-5190',
    carrier: 'Midwest Freightways',
    cargo: 'Frozen Seafood Pallets',
    dockBay: 'Bay 09',
    etaOrTime: 'Docked 06:40',
    currentTempC: -17.2,
    targetTempC: -20.0,
    humidityPct: 61,
    status: 'Alert',
    gateLane: 'Lane A1',
    sealNumber: 'KST-99418',
  },
  {
    id: 'TRL-6034',
    carrier: 'Maasland Carriers',
    cargo: 'Fresh Dairy & Produce',
    dockBay: null,
    etaOrTime: 'ETA 07:10',
    currentTempC: 3.4,
    targetTempC: 3.5,
    humidityPct: 68,
    status: 'Inbound',
    gateLane: 'Lane B1',
    sealNumber: 'KST-99425',
  },
  {
    id: 'TRL-6207',
    carrier: 'Great Lakes Reefer',
    cargo: 'Deep-Frozen Poultry',
    dockBay: 'Bay 15',
    etaOrTime: 'Docked 05:50',
    currentTempC: -19.8,
    targetTempC: -20.0,
    humidityPct: 59,
    status: 'At Dock',
    gateLane: 'Lane A3',
    sealNumber: 'KST-99392',
  },
  {
    id: 'TRL-6491',
    carrier: 'Vanguard Cold Transport',
    cargo: 'Specialty Confectionery',
    dockBay: null,
    etaOrTime: 'ETA 07:25',
    currentTempC: 11.8,
    targetTempC: 12.0,
    humidityPct: 48,
    status: 'Inbound',
    gateLane: 'Lane B2',
    sealNumber: 'KST-99431',
  },
];

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'rotterdam-cold',
    client: 'Maasvlakte Cold Terminal',
    region: 'Rotterdam, Netherlands · 42 Refrigerated Bays',
    headlineMetric: '-38% Trailer Turnaround Time in 90 Days',
    title: 'Replacing radio dispatch sheets across a 42-bay port terminal',
    summary:
      'Prior to deployment, yard spotters relied on UHF radio calls and clipboards, creating 26-minute idle queues outside Gate B. By linking license-plate capture directly to live bay availability and reefer pre-cooling alerts, dwell time dropped from 64 minutes to 39.6 minutes per turn.',
    quote:
      'Before Kestrel, two delayed vessels backed up our entire morning shift. After connecting gate check-in to automated bay routing, our dispatchers handle 30% more turns without adding yard spotters.',
    personName: 'Hendrik van der Berg',
    personRole: 'Director of Terminal Operations, Maasvlakte Cold Terminal',
    imageSrc: PORT_CASE_IMAGE,
    imageAlt: 'Refrigerated cargo containers lined across the Maasvlakte cold-storage port terminal at dawn',
  },
  {
    id: 'illinois-pharma',
    client: 'Prairie MedDistribution',
    region: 'Joliet, Illinois · 28 Temperature-Controlled Docks',
    headlineMetric: '99.94% Cold-Chain Audit Pass Rate',
    title: 'Continuous 15-second compliance logs for 2°C–8°C biologics',
    summary:
      'Auditors previously waited four hours after unloading for drivers to hand over paper thermograph strips. Kestrel ingests wireless wall sensors and reefer controller telemetry into an immutable batch record before the dock plate even retracts.',
    quote:
      'We eliminated manual temperature strip scanning completely. Quality assurance now signs off on incoming pharma pallets in under three minutes with zero missing intervals.',
    personName: 'Claire Okafor',
    personRole: 'VP of Quality & Cold-Chain Compliance, Prairie MedDistribution',
  },
];
