import { PUBLIC_TOOLS_CATALOG } from '../data/toolsCatalog.ts';

export const ENTERPRISE_PERMISSION_ACTIONS = [
  { key: 'view', label: 'View Access', shortLabel: 'View' },
  { key: 'create', label: 'Create Access', shortLabel: 'Create' },
  { key: 'edit', label: 'Edit Access', shortLabel: 'Edit' },
  { key: 'upload', label: 'Upload Access', shortLabel: 'Upload' },
  { key: 'download', label: 'Download Access', shortLabel: 'Download' },
  { key: 'delete', label: 'Delete Access', shortLabel: 'Delete' },
  { key: 'approve', label: 'Approve Access', shortLabel: 'Approve' },
  { key: 'export', label: 'Export Access', shortLabel: 'Export' },
  { key: 'admin', label: 'Administrative Access', shortLabel: 'Admin' },
] as const;

export type PermissionActionKey = (typeof ENTERPRISE_PERMISSION_ACTIONS)[number]['key'];

export type ModulePermissionSet = Record<PermissionActionKey, boolean>;

export type UserPermissionMatrix = Record<string, ModulePermissionSet>;

export type EnterpriseAccountStatus =
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Suspended'
  | 'Inactive';

export const ENTERPRISE_ACCOUNT_STATUSES: EnterpriseAccountStatus[] = [
  'Pending Approval',
  'Approved',
  'Rejected',
  'Suspended',
  'Inactive',
];

export interface EnterpriseModuleDefinition {
  id: string;
  code: string;
  title: string;
  group: 'Core Modules' | 'VCPL & Reconcilers' | 'Tax & Banking' | 'Documents, PDF & Workspace';
  description: string;
  toolId?: string;
}

export const CORE_ENTERPRISE_MODULES: EnterpriseModuleDefinition[] = [
  {
    id: 'document-studio',
    code: 'MOD-01',
    title: 'Document Studio',
    group: 'Core Modules',
    description: 'Centralized business letters, letterhead templates, rent & covering memo drafts.',
  },
  {
    id: 'bmw-claims-reconciler',
    code: 'VC-12',
    title: 'BMW Claims Reconciler',
    group: 'Core Modules',
    description: 'Reconcile DMS BMW Service Invoices against Credit/Debit Memos & Warranty Claims.',
    toolId: 'bmw-claims-reconciler',
  },
  {
    id: 'auto-ledger',
    code: 'MOD-02',
    title: 'AutoLedger',
    group: 'Core Modules',
    description: 'Centralized dealership voucher, TDS/TCS, and statement reconciliation ledger.',
  },
  {
    id: 'vehicle-master',
    code: 'MOD-03',
    title: 'Vehicle Master',
    group: 'Core Modules',
    description: 'Central VIN, chassis, model variant, customer & RTO registration master records.',
  },
  {
    id: 'registers',
    code: 'MOD-04',
    title: 'Registers',
    group: 'Core Modules',
    description: 'Centralized Sales, Purchase, Incentive, and Fuel compliance registers.',
  },
  {
    id: 'reports',
    code: 'MOD-05',
    title: 'Reports',
    group: 'Core Modules',
    description: 'Departmental P&L, TDS summary, claim aging, and audited Excel/CSV reporting.',
  },
  {
    id: 'document-vault',
    code: 'MOD-06',
    title: 'Document Vault',
    group: 'Core Modules',
    description: 'Centralized file storage, approvals, downloads & Google Drive cloud backup.',
  },
];

const CORE_TOOL_IDS_ALREADY_LISTED = new Set(['bmw-claims-reconciler']);

function mapToolGroup(category: string): EnterpriseModuleDefinition['group'] {
  if (category === 'VCPL') return 'VCPL & Reconcilers';
  if (category === 'Banking' || category === 'Tax & GST') return 'Tax & Banking';
  return 'Documents, PDF & Workspace';
}

const CATALOG_MODULES: EnterpriseModuleDefinition[] = PUBLIC_TOOLS_CATALOG.filter(
  (tool) => !CORE_TOOL_IDS_ALREADY_LISTED.has(tool.id)
).map((tool) => ({
  id: tool.id,
  code: tool.code,
  title: tool.title,
  group: mapToolGroup(tool.category),
  description: tool.description,
  toolId: tool.id,
}));

export const ALL_ENTERPRISE_MODULES: EnterpriseModuleDefinition[] = [
  ...CORE_ENTERPRISE_MODULES,
  ...CATALOG_MODULES,
];

export const RESTRICTED_ENTERPRISE_TOOL_IDS = new Set([
  'incentive-report-tool',
  'dbs-pnl-reports',
  'bmw-statement-reconciler',
  'bmw-vendor-ledger-reconciler',
  'bmw-claims-reconciler',
  'vcpl-rtgs-neft-form',
  'tds-26as-tally-reco',
  'bajaj-reconciliation-desk',
  'fuel-report-generator',
  'covering-letter-generator',
  'rto-code-finder',
]);

export function createEmptyPermissionSet(fill = false): ModulePermissionSet {
  return {
    view: fill,
    create: fill,
    edit: fill,
    upload: fill,
    download: fill,
    delete: fill,
    approve: fill,
    export: fill,
    admin: fill,
  };
}

export function buildFullAdminPermissionMatrix(): UserPermissionMatrix {
  const matrix: UserPermissionMatrix = {};
  for (const mod of ALL_ENTERPRISE_MODULES) {
    matrix[mod.id] = createEmptyPermissionSet(true);
  }
  return matrix;
}

export interface RolePresetDefinition {
  id: string;
  label: string;
  description: string;
  buildMatrix: () => UserPermissionMatrix;
}

function buildPresetMatrix(
  moduleIds: string[],
  actions: Partial<ModulePermissionSet>
): UserPermissionMatrix {
  const matrix: UserPermissionMatrix = {};
  const template = { ...createEmptyPermissionSet(false), ...actions };
  for (const id of moduleIds) {
    matrix[id] = { ...template };
  }
  return matrix;
}

export const ENTERPRISE_ROLE_PRESETS: RolePresetDefinition[] = [
  {
    id: 'accounts-manager',
    label: 'Accounts Manager',
    description: 'Full accounting, AutoLedger, Tax/GST, Banking slips & Reports (approve/export enabled).',
    buildMatrix: () =>
      buildPresetMatrix(
        [
          'auto-ledger',
          'registers',
          'reports',
          'document-vault',
          'bank-slip-generator',
          'bulk-excel-slips',
          'bank-ifsc-finder',
          'bank-statement-analyzer',
          'form-26as-to-excel',
          'gstr2b-tally-reconciler',
          'gstr1-return-prep',
          'tds-tcs-toolkit',
          'tds-26as-tally-reco',
          'vcpl-rtgs-neft-form',
          'dbs-pnl-reports',
          'dms-tally-reconciler',
          'parts-billing-reconciler',
        ],
        {
          view: true,
          create: true,
          edit: true,
          upload: true,
          download: true,
          approve: true,
          export: true,
        }
      ),
  },
  {
    id: 'bmw-claims-auditor',
    label: 'BMW & Claims Auditor',
    description: 'Claims reconciler, Vendor Ledger, SOA, Bajaj Desk, Incentive & Vehicle Master.',
    buildMatrix: () =>
      buildPresetMatrix(
        [
          'bmw-claims-reconciler',
          'bmw-vendor-ledger-reconciler',
          'bmw-statement-reconciler',
          'bajaj-reconciliation-desk',
          'incentive-report-tool',
          'vehicle-master',
          'registers',
          'reports',
          'document-vault',
          'rto-code-finder',
        ],
        {
          view: true,
          create: true,
          edit: true,
          upload: true,
          download: true,
          export: true,
        }
      ),
  },
  {
    id: 'front-desk-docs',
    label: 'Document Studio & Front Desk',
    description: 'Document Studio, Covering Letters, Rent Letters, PDF Suite & Document Vault.',
    buildMatrix: () =>
      buildPresetMatrix(
        [
          'document-studio',
          'document-vault',
          'covering-letter-generator',
          'rent-payment-letter-maker',
          'letterhead-invoice-maker',
          'textlift-ocr-pro',
          'pdf-editor-advanced',
          'pdf-form-filler',
          'pdf-merger',
          'pdf-compressor',
          'google-drive-manager',
        ],
        {
          view: true,
          create: true,
          edit: true,
          upload: true,
          download: true,
          export: true,
        }
      ),
  },
  {
    id: 'read-only-auditor',
    label: 'Read-Only Auditor',
    description: 'View, download & export access across Core Modules and Reports with zero write/delete.',
    buildMatrix: () =>
      buildPresetMatrix(
        CORE_ENTERPRISE_MODULES.map((m) => m.id),
        {
          view: true,
          download: true,
          export: true,
        }
      ),
  },
  {
    id: 'full-enterprise',
    label: 'Full Operational Access',
    description: 'View, Create, Edit, Upload, Download & Export across all modules (without admin delete).',
    buildMatrix: () =>
      buildPresetMatrix(
        ALL_ENTERPRISE_MODULES.map((m) => m.id),
        {
          view: true,
          create: true,
          edit: true,
          upload: true,
          download: true,
          export: true,
        }
      ),
  },
];
