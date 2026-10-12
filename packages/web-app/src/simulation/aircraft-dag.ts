// Airbus A320 Turnaround DAG Metadata & Spatial Anchor Points

export interface DagNodeVisual {
  id: number;
  name: string;
  code: string;
  baseDuration: number;
  zone: string;
  // Spatial offset relative to aircraft center (0, 0) in normalized apron coordinates
  anchor: { x: number; y: number };
  vehicleType: 'tanker' | 'belt' | 'catering' | 'clean_van' | 'stairs' | 'lavatory' | 'water' | 'inspector' | 'tug';
  iconColor: string;
  successors: number[];
}

export const A320_DAG_NODES: DagNodeVisual[] = [
  {
    id: 0,
    name: 'Deplaning',
    code: 'DEPLAN',
    baseDuration: 10.0,
    zone: 'Port Door 1L (Jetbridge)',
    anchor: { x: -35, y: -90 },
    vehicleType: 'stairs',
    iconColor: '#06B6D4',
    successors: [2, 3, 4, 5, 6, 9],
  },
  {
    id: 1,
    name: 'Baggage Offload',
    code: 'BAG_OFF',
    baseDuration: 15.0,
    zone: 'Aft/Fwd Cargo Holds',
    anchor: { x: 38, y: 35 },
    vehicleType: 'belt',
    iconColor: '#F59E0B',
    successors: [7, 10],
  },
  {
    id: 2,
    name: 'Refueling',
    code: 'FUEL',
    baseDuration: 20.0,
    zone: 'Starboard Wing Box',
    anchor: { x: 110, y: 15 },
    vehicleType: 'tanker',
    iconColor: '#EC4899',
    successors: [8],
  },
  {
    id: 3,
    name: 'Catering Replenishment',
    code: 'CATER',
    baseDuration: 15.0,
    zone: 'Forward/Aft Galleys',
    anchor: { x: 38, y: -75 },
    vehicleType: 'catering',
    iconColor: '#8B5CF6',
    successors: [8],
  },
  {
    id: 4,
    name: 'Cabin Cleaning',
    code: 'CLEAN',
    baseDuration: 18.0,
    zone: 'Main Cabin Pax Deck',
    anchor: { x: -38, y: 65 },
    vehicleType: 'clean_van',
    iconColor: '#10B981',
    successors: [8],
  },
  {
    id: 5,
    name: 'Lavatory Service',
    code: 'LAV',
    baseDuration: 8.0,
    zone: 'Aft Waste Service Panel',
    anchor: { x: 32, y: 110 },
    vehicleType: 'lavatory',
    iconColor: '#3B82F6',
    successors: [11],
  },
  {
    id: 6,
    name: 'Water Service',
    code: 'WATER',
    baseDuration: 6.0,
    zone: 'Aft Potable Water Panel',
    anchor: { x: -32, y: 110 },
    vehicleType: 'water',
    iconColor: '#0EA5E9',
    successors: [11],
  },
  {
    id: 7,
    name: 'Baggage Loading',
    code: 'BAG_LOAD',
    baseDuration: 20.0,
    zone: 'Aft/Fwd Cargo Holds',
    anchor: { x: 38, y: -25 },
    vehicleType: 'belt',
    iconColor: '#F59E0B',
    successors: [10],
  },
  {
    id: 8,
    name: 'Passenger Boarding',
    code: 'BOARD',
    baseDuration: 22.0,
    zone: 'Port Door 1L / 2L',
    anchor: { x: -45, y: -80 },
    vehicleType: 'stairs',
    iconColor: '#06B6D4',
    successors: [11],
  },
  {
    id: 9,
    name: 'Pre-Flight Inspection',
    code: 'INSPECT',
    baseDuration: 10.0,
    zone: 'Exterior Airframe Perimeter',
    anchor: { x: -90, y: 0 },
    vehicleType: 'inspector',
    iconColor: '#A855F7',
    successors: [11],
  },
  {
    id: 10,
    name: 'Cargo Doors Closed',
    code: 'CARGO_CLS',
    baseDuration: 5.0,
    zone: 'Cargo Hatches 1 & 2',
    anchor: { x: 42, y: 5 },
    vehicleType: 'belt',
    iconColor: '#EAB308',
    successors: [11],
  },
  {
    id: 11,
    name: 'Pushback Clearance',
    code: 'PUSHBACK',
    baseDuration: 5.0,
    zone: 'Nose Gear Tug Staging',
    anchor: { x: 0, y: -160 },
    vehicleType: 'tug',
    iconColor: '#EF4444',
    successors: [],
  },
];
