import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  Edit3,
  History,
  KeyRound,
  Layers,
  Lock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  type EnterpriseUserProfile,
  useEnterpriseAuth,
} from '../../context/EnterpriseAuthContext.tsx';
import {
  ALL_ENTERPRISE_MODULES,
  ENTERPRISE_ACCOUNT_STATUSES,
  ENTERPRISE_PERMISSION_ACTIONS,
  ENTERPRISE_ROLE_PRESETS,
  type EnterpriseAccountStatus,
  type PermissionActionKey,
  type UserPermissionMatrix,
  createEmptyPermissionSet,
} from '../../data/enterpriseModules.ts';
import {
  isFirebaseSuperAdminSignedIn,
  loadEnterpriseSnapshotFromFirestore,
  syncEnterpriseSnapshotToFirestore,
  testFirestoreConnection,
} from '../../lib/firebase.ts';
import { googleSignIn } from '../../services/googleWorkspaceAuth.ts';
import { CentralWorkspaceModules } from './CentralWorkspaceModules.tsx';

interface SuperAdminDashboardProps {
  onBackPortal: () => void;
  onBackHome: () => void;
}

type AdminTabId =
  | 'overview'
  | 'users'
  | 'permissions'
  | 'resets'
  | 'logs'
  | 'vault';

interface ResetRequestRow {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  note: string;
  resolved_by: string;
  resolved_at: string;
  created_at: string;
}

interface LoginHistoryRow {
  id: string;
  user_id: string;
  username: string;
  display_username: string;
  outcome: string;
  detail: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface ActivityLogRow {
  id: string;
  actor_user_id: string;
  actor_username: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  created_at: string;
}

const STATUS_BADGE_CLASSES: Record<EnterpriseAccountStatus, string> = {
  Approved:
    'bg-[#CEE5DC]/85 dark:bg-emerald-950/70 text-[#12805C] dark:text-emerald-300 border-[#12805C]/35',
  'Pending Approval':
    'bg-[#FEF2C8] dark:bg-amber-950/70 text-[#B45309] dark:text-amber-300 border-[#B45309]/35',
  Rejected:
    'bg-[#FEE2E2] dark:bg-rose-950/70 text-[#7D0B0B] dark:text-rose-300 border-[#9E2A2B]/35',
  Suspended:
    'bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-300 border-orange-400/40',
  Inactive:
    'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-400/40',
};

function generateClientRandomTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const sym = '@#$%&*!';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const raw = [
    pick(upper),
    pick(lower),
    pick(nums),
    pick(sym),
    ...Array.from({ length: 8 }, () => pick(upper + lower + nums + sym)),
  ];
  return raw.sort(() => Math.random() - 0.5).join('');
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onBackPortal,
  onBackHome,
}) => {
  const { user: currentUser, isSuperAdmin, apiFetch } = useEnterpriseAuth();

  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [users, setUsers] = useState<EnterpriseUserProfile[]>([]);
  const [resetRequests, setResetRequests] = useState<ResetRequestRow[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRow[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const [bannerSuccess, setBannerSuccess] = useState('');

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showArchivedUsers, setShowArchivedUsers] = useState(false);
  const [logUserFilter, setLogUserFilter] = useState<string>('');

  // Create New User Modal/Drawer state
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newTempPwd, setNewTempPwd] = useState(() => generateClientRandomTempPassword());
  const [newFullName, setNewFullName] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newDepartment, setNewDepartment] = useState('Accounts');
  const [newDesignation, setNewDesignation] = useState('Executive');
  const [newContact, setNewContact] = useState('');
  const [newStatus, setNewStatus] = useState<EnterpriseAccountStatus>('Approved');
  const [newPresetId, setNewPresetId] = useState<string>('');
  const [issuedTempCreds, setIssuedTempCreds] = useState<{
    username: string;
    tempPassword: string;
    label: string;
  } | null>(null);

  // Edit User & Designation Modal state
  const [editingUser, setEditingUser] = useState<EnterpriseUserProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editUsername, setEditUsername] = useState('');

  // Reset Password Modal state
  const [resetTargetUser, setResetTargetUser] = useState<{
    userId: string;
    username: string;
    requestId?: string;
  } | null>(null);
  const [resetCustomPwd, setResetCustomPwd] = useState('');

  // Inline Delete Confirmation state (no window.confirm)
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  // Permission Matrix Editor state
  const [permTargetUserId, setPermTargetUserId] = useState<string>('');
  const [permMatrixDraft, setPermMatrixDraft] = useState<UserPermissionMatrix>({});
  const [permGroupFilter, setPermGroupFilter] = useState<string>('ALL');
  const [permSearch, setPermSearch] = useState('');
  const [permSaving, setPermSaving] = useState(false);

  // Firebase Firestore Cloud Sync state
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudEmail, setCloudEmail] = useState<string>(() =>
    isFirebaseSuperAdminSignedIn() ? 'vcpl.mlr@gmail.com' : ''
  );

  const loadAllAdminData = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setBannerError('');
    try {
      const [uRes, rRes, lRes, aRes] = await Promise.all([
        apiFetch(`/api/enterprise/admin/users?includeArchived=${showArchivedUsers ? '1' : '0'}`),
        apiFetch('/api/enterprise/admin/reset-requests'),
        apiFetch(
          logUserFilter
            ? `/api/enterprise/admin/login-history?userId=${encodeURIComponent(logUserFilter)}`
            : '/api/enterprise/admin/login-history'
        ),
        apiFetch(
          logUserFilter
            ? `/api/enterprise/admin/activity-logs?userId=${encodeURIComponent(logUserFilter)}`
            : '/api/enterprise/admin/activity-logs'
        ),
      ]);

      if (uRes.ok) {
        const d = (await uRes.json()) as { users?: EnterpriseUserProfile[] };
        const loadedUsers = d.users || [];
        setUsers(loadedUsers);
        if (!permTargetUserId) {
          const firstEmp = loadedUsers.find((u) => u.role !== 'super_admin') || loadedUsers[0];
          if (firstEmp) {
            setPermTargetUserId(firstEmp.id);
            setPermMatrixDraft(firstEmp.permissions || {});
          }
        }
      }
      if (rRes.ok) {
        const d = (await rRes.json()) as { requests?: ResetRequestRow[] };
        setResetRequests(d.requests || []);
      }
      if (lRes.ok) {
        const d = (await lRes.json()) as { history?: LoginHistoryRow[] };
        setLoginHistory(d.history || []);
      }
      if (aRes.ok) {
        const d = (await aRes.json()) as { logs?: ActivityLogRow[] };
        setActivityLogs(d.logs || []);
      }
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to load admin console data.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isSuperAdmin, logUserFilter, permTargetUserId, showArchivedUsers]);

  useEffect(() => {
    void loadAllAdminData();
  }, [loadAllAdminData]);

  const handleSelectPermUser = (uid: string) => {
    setPermTargetUserId(uid);
    const found = users.find((u) => u.id === uid);
    setPermMatrixDraft(found?.permissions ? JSON.parse(JSON.stringify(found.permissions)) : {});
  };

  const handleTogglePerm = (moduleId: string, action: PermissionActionKey) => {
    setPermMatrixDraft((prev) => {
      const current = prev[moduleId] || createEmptyPermissionSet(false);
      return {
        ...prev,
        [moduleId]: {
          ...current,
          [action]: !current[action],
        },
      };
    });
  };

  const handleToggleModuleRow = (moduleId: string) => {
    setPermMatrixDraft((prev) => {
      const current = prev[moduleId] || createEmptyPermissionSet(false);
      const allOn = ENTERPRISE_PERMISSION_ACTIONS.every((a) => current[a.key]);
      return {
        ...prev,
        [moduleId]: createEmptyPermissionSet(!allOn),
      };
    });
  };

  const handleSavePermissions = async () => {
    if (!permTargetUserId) return;
    setPermSaving(true);
    setBannerError('');
    setBannerSuccess('');
    try {
      const res = await apiFetch(
        `/api/enterprise/admin/users/${encodeURIComponent(permTargetUserId)}/permissions`,
        {
          method: 'PUT',
          body: JSON.stringify({ permissions: permMatrixDraft }),
        }
      );
      const data = (await res.json().catch(() => null)) as {
        user?: EnterpriseUserProfile;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || 'Unable to save permissions.');
      setBannerSuccess(`Updated granular tool permissions for @${data?.user?.displayUsername || 'employee'}.`);
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Permission save failed.');
    } finally {
      setPermSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError('');
    setBannerSuccess('');
    const preset = ENTERPRISE_ROLE_PRESETS.find((p) => p.id === newPresetId);
    const permissions = preset ? preset.buildMatrix() : {};

    try {
      const res = await apiFetch('/api/enterprise/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          temporaryPassword: newTempPwd.trim(),
          fullName: newFullName.trim(),
          employeeId: newEmployeeId.trim(),
          department: newDepartment.trim(),
          designation: newDesignation.trim(),
          contactNumber: newContact.trim(),
          status: newStatus,
          permissions,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        user?: EnterpriseUserProfile;
        temporaryPassword?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.user) {
        throw new Error(data?.error || 'Unable to create user.');
      }

      setIssuedTempCreds({
        username: data.user.displayUsername,
        tempPassword: data.temporaryPassword || newTempPwd,
        label: 'New User Temporary Password (Mandatory Change on First Login)',
      });
      setCreateOpen(false);
      setNewUsername('');
      setNewFullName('');
      setNewEmployeeId('');
      setNewContact('');
      setNewTempPwd(generateClientRandomTempPassword());
      setNewPresetId('');
      setBannerSuccess(`Created user @${data.user.displayUsername}.`);
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'User creation failed.');
    }
  };

  const handleStatusChange = async (userId: string, nextStatus: EnterpriseAccountStatus) => {
    setBannerError('');
    setBannerSuccess('');
    try {
      const res = await apiFetch(`/api/enterprise/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json().catch(() => null)) as {
        user?: EnterpriseUserProfile;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || 'Unable to change account status.');
      setBannerSuccess(
        `Account @${data?.user?.displayUsername || userId} updated to "${nextStatus}".`
      );
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleArchiveToggle = async (userId: string, archived: boolean) => {
    setBannerError('');
    setBannerSuccess('');
    try {
      const res = await apiFetch(`/api/enterprise/admin/users/${encodeURIComponent(userId)}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Unable to update archive status.');
      setBannerSuccess(archived ? 'User account archived.' : 'User account restored.');
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Archive operation failed.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setBannerError('');
    setBannerSuccess('');
    try {
      const res = await apiFetch(`/api/enterprise/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Unable to permanently delete user.');
      setConfirmDeleteUserId(null);
      setBannerSuccess('User account permanently deleted.');
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setBannerError('');
    setBannerSuccess('');
    try {
      const res = await apiFetch(`/api/enterprise/admin/users/${encodeURIComponent(editingUser.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayUsername: editUsername.trim(),
          fullName: editFullName.trim(),
          employeeId: editEmployeeId.trim(),
          department: editDepartment.trim(),
          designation: editDesignation.trim(),
          contactNumber: editContact.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Unable to update user details.');
      setEditingUser(null);
      setBannerSuccess('Employee details & designation updated.');
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Edit user failed.');
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setBannerError('');
    setBannerSuccess('');
    try {
      const res = await apiFetch(
        `/api/enterprise/admin/users/${encodeURIComponent(resetTargetUser.userId)}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({
            temporaryPassword: resetCustomPwd.trim() || undefined,
            requestId: resetTargetUser.requestId,
          }),
        }
      );
      const data = (await res.json().catch(() => null)) as {
        temporaryPassword?: string;
        user?: EnterpriseUserProfile;
        error?: string;
      } | null;
      if (!res.ok || !data?.temporaryPassword) {
        throw new Error(data?.error || 'Unable to reset user password.');
      }

      setIssuedTempCreds({
        username: data.user?.displayUsername || resetTargetUser.username,
        tempPassword: data.temporaryPassword,
        label: 'One-Time Temporary Password (Share Directly — Forced Change on Next Login)',
      });
      setResetTargetUser(null);
      setResetCustomPwd('');
      setBannerSuccess(`Temporary password issued for @${resetTargetUser.username}.`);
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Reset password failed.');
    }
  };

  const handleRejectResetRequest = async (reqId: string) => {
    setBannerError('');
    try {
      const res = await apiFetch(
        `/api/enterprise/admin/reset-requests/${encodeURIComponent(reqId)}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ note: 'Rejected by Super Admin.' }),
        }
      );
      if (!res.ok) throw new Error('Unable to reject reset request.');
      setBannerSuccess('Password reset request marked Rejected.');
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Reject failed.');
    }
  };

  const handleConnectFirebaseAdmin = async () => {
    setCloudBusy(true);
    setBannerError('');
    setBannerSuccess('');
    try {
      const { user } = await googleSignIn();
      const email = (user.email || '').toLowerCase();
      setCloudEmail(email);
      const conn = await testFirestoreConnection();
      if (!conn.ok) {
        throw new Error(conn.error || 'Firestore connection test failed.');
      }
      setBannerSuccess(`Connected Google Super Admin (${email}) to Firebase Firestore.`);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Firebase Google sign-in failed.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleSyncToFirestore = async () => {
    setCloudBusy(true);
    setBannerError('');
    setBannerSuccess('');
    try {
      if (!isFirebaseSuperAdminSignedIn()) {
        await googleSignIn();
        setCloudEmail('vcpl.mlr@gmail.com');
      }
      const res = await apiFetch('/api/enterprise/admin/cloud-snapshot');
      const snap = (await res.json()) as {
        users: EnterpriseUserProfile[];
        resetRequests: Array<Record<string, unknown>>;
        activityLogs: Array<Record<string, unknown>>;
        documents: Array<Record<string, unknown>>;
        records: Array<Record<string, unknown>>;
      };

      const { syncedCount } = await syncEnterpriseSnapshotToFirestore({
        users: snap.users.map((u) => ({
          id: u.id,
          username: u.username,
          displayUsername: u.displayUsername,
          internalAuthId: u.internalAuthId || `${u.username}@auth.vcpl.internal`,
          fullName: u.fullName,
          employeeId: u.employeeId,
          department: u.department,
          designation: u.designation,
          contactNumber: u.contactNumber,
          role: u.role,
          status: u.status,
          isArchived: u.isArchived,
          mustChangePassword: u.mustChangePassword,
          lastLoginAt: u.lastLoginAt,
          lastActiveAt: u.lastActiveAt,
          permissions: u.permissions,
        })),
        resetRequests: snap.resetRequests.map((r) => ({
          id: String(r.id || ''),
          userId: String(r.user_id || r.userId || ''),
          username: String(r.username || ''),
          fullName: String(r.full_name || r.fullName || ''),
          status: (r.status as 'Pending' | 'Approved' | 'Rejected') || 'Pending',
          note: String(r.note || ''),
          resolvedBy: String(r.resolved_by || r.resolvedBy || ''),
          resolvedAt: String(r.resolved_at || r.resolvedAt || ''),
        })),
        activityLogs: snap.activityLogs.map((l) => ({
          id: String(l.id || ''),
          actorUserId: String(l.actor_user_id || l.actorUserId || ''),
          actorUsername: String(l.actor_username || l.actorUsername || ''),
          action: String(l.action || ''),
          targetType: String(l.target_type || l.targetType || ''),
          targetId: String(l.target_id || l.targetId || ''),
          summary: String(l.summary || ''),
        })),
        documents: snap.documents.map((d) => ({
          id: String(d.id || ''),
          moduleId: String(d.module_id || d.moduleId || 'document-vault'),
          title: String(d.title || 'Document'),
          fileName: String(d.file_name || d.fileName || 'file'),
          mimeType: String(d.mime_type || d.mimeType || 'application/octet-stream'),
          sizeBytes: Number(d.size_bytes ?? d.sizeBytes ?? 0),
          approvalStatus:
            (d.approval_status as 'Draft' | 'Pending Review' | 'Approved' | 'Rejected') ||
            'Pending Review',
          driveFileId: String(d.drive_file_id || d.driveFileId || ''),
          driveWebViewLink: String(d.drive_web_view_link || d.driveWebViewLink || ''),
          uploadedBy: String(d.uploaded_by || d.uploadedBy || 'admin'),
          uploadedByUsername: String(d.uploaded_by_username || d.uploadedByUsername || 'admin'),
        })),
        records: snap.records.map((rec) => ({
          id: String(rec.id || ''),
          moduleId: String(rec.module_id || rec.moduleId || 'auto-ledger'),
          recordTitle: String(rec.record_title || rec.recordTitle || 'Record'),
          referenceCode: String(rec.reference_code || rec.referenceCode || ''),
          status: String(rec.status || 'Active'),
          payloadJson: String(rec.payload_json || rec.payloadJson || '{}'),
          createdBy: String(rec.created_by || rec.createdBy || 'admin'),
          createdByUsername: String(rec.created_by_username || rec.createdByUsername || 'admin'),
        })),
      });
      setBannerSuccess(`Synced ${syncedCount} enterprise records & permission profiles to Firebase Cloud.`);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Firebase sync failed.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleRestoreFromFirestore = async () => {
    setCloudBusy(true);
    setBannerError('');
    setBannerSuccess('');
    try {
      if (!isFirebaseSuperAdminSignedIn()) {
        await googleSignIn();
        setCloudEmail('vcpl.mlr@gmail.com');
      }
      const cloud = await loadEnterpriseSnapshotFromFirestore();
      const res = await apiFetch('/api/enterprise/admin/hydrate-from-cloud', {
        method: 'POST',
        body: JSON.stringify({
          permissionsByUser: cloud.permissionsByUser,
          records: cloud.records,
        }),
      });
      const data = (await res.json()) as {
        restoredPermissions?: number;
        restoredRecords?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Hydration failed.');
      setBannerSuccess(
        `Restored ${data.restoredPermissions || 0} permission profiles and ${data.restoredRecords || 0} workspace records from Firebase Firestore.`
      );
      await loadAllAdminData();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Firebase restore failed.');
    } finally {
      setCloudBusy(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.username.includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.designation.toLowerCase().includes(q) ||
        u.employeeId.toLowerCase().includes(q)
      );
    });
  }, [statusFilter, userSearch, users]);

  const filteredModules = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    return ALL_ENTERPRISE_MODULES.filter((mod) => {
      if (permGroupFilter !== 'ALL' && mod.group !== permGroupFilter) return false;
      if (!q) return true;
      return (
        mod.title.toLowerCase().includes(q) ||
        mod.code.toLowerCase().includes(q) ||
        mod.id.toLowerCase().includes(q)
      );
    });
  }, [permGroupFilter, permSearch]);

  const pendingResetsCount = useMemo(
    () => resetRequests.filter((r) => r.status === 'Pending').length,
    [resetRequests]
  );
  const pendingApprovalCount = useMemo(
    () => users.filter((u) => u.status === 'Pending Approval' && !u.isArchived).length,
    [users]
  );

  if (!isSuperAdmin) {
    return (
      <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-12 min-h-[calc(100dvh-140px)] flex items-center">
        <div className="max-w-md mx-auto px-4 w-full">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#7D0B0B] rounded-2xl p-6 text-center space-y-4">
            <ShieldAlert className="w-10 h-10 mx-auto text-[#9E2A2B]" />
            <h1 className="font-display font-extrabold text-xl text-[#2F3E4E] dark:text-slate-50">
              Super Admin Access Required
            </h1>
            <p className="text-xs text-[#475569] dark:text-slate-300">
              This control panel is strictly restricted to authorized Super Admin credentials.
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={onBackPortal}
                className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-[#F9C80E] text-xs font-display font-extrabold cursor-pointer"
              >
                Go to Portal Sign In
              </button>
              <button
                type="button"
                onClick={onBackHome}
                className="px-4 py-2 rounded-xl border border-[#2F3E4E]/30 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-6 sm:py-8 min-h-[calc(100dvh-140px)]">
      <div className="max-w-[1440px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-5">
        {/* Top Header */}
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold">
              <span className="px-2 py-0.5 rounded-md bg-[#2F3E4E] text-[#F9C80E]">
                SUPER ADMIN CONTROL PANEL
              </span>
              <span className="text-[#475569] dark:text-slate-300">
                Signed in as @{currentUser?.displayUsername}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50">
              VCPL Pro Centralized Governance &amp; RBAC Suite
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAllAdminData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onBackPortal}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg border border-[#2F3E4E] bg-[#FEF2C8] dark:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Employee Portal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateOpen(true);
                setActiveTab('users');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg bg-[#12805C] hover:bg-[#0E6A4B] text-white text-xs font-display font-extrabold cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create User</span>
            </button>
          </div>
        </div>

        {/* One-Time Issued Temp Password Banner */}
        {issuedTempCreds && (
          <div className="bg-[#CEE5DC] dark:bg-emerald-950/75 border-[1.5px] border-[#12805C] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-display font-extrabold text-[#12805C] dark:text-emerald-300">
                {issuedTempCreds.label}
              </p>
              <p className="text-xs font-mono text-[#2F3E4E] dark:text-slate-100">
                Username: <strong>{issuedTempCreds.username}</strong> · Temporary Password:{' '}
                <strong className="px-2 py-0.5 rounded bg-white dark:bg-[#0B1120] border border-[#12805C]/40 select-all">
                  {issuedTempCreds.tempPassword}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `Username: ${issuedTempCreds.username}\nTemporary Password: ${issuedTempCreds.tempPassword}`
                  );
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#12805C] text-white text-xs font-bold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Credentials</span>
              </button>
              <button
                type="button"
                onClick={() => setIssuedTempCreds(null)}
                aria-label="Dismiss credentials banner"
                className="p-1.5 rounded-lg text-[#2F3E4E] dark:text-slate-300 hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {bannerError && (
          <div className="rounded-xl border border-[#9E2A2B]/40 bg-[#FEE2E2] dark:bg-rose-950/70 px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-[#7D0B0B] dark:text-rose-200">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {bannerError}
            </span>
            <button type="button" onClick={() => setBannerError('')} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {bannerSuccess && (
          <div className="rounded-xl border border-[#12805C]/40 bg-[#CEE5DC]/80 dark:bg-emerald-950/60 px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-[#12805C] dark:text-emerald-200">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {bannerSuccess}
            </span>
            <button type="button" onClick={() => setBannerSuccess('')} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'overview', label: 'Overview & Cloud Sync', icon: Cloud },
              {
                id: 'users',
                label: `User Management (${users.length})${pendingApprovalCount ? ` · ${pendingApprovalCount} Pending` : ''}`,
                icon: Users,
              },
              { id: 'permissions', label: 'Tool Permissions Matrix', icon: Shield },
              {
                id: 'resets',
                label: `Password Resets${pendingResetsCount ? ` (${pendingResetsCount})` : ''}`,
                icon: KeyRound,
              },
              { id: 'logs', label: 'Login & Activity Logs', icon: History },
              { id: 'vault', label: 'Central Vault & Records', icon: Database },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] text-xs font-display font-extrabold cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] dark:bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E]'
                    : 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* =============================================================== */}
        {/* TAB 1: OVERVIEW & FIREBASE FIRESTORE CLOUD SYNC                 */}
        {/* =============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              {[
                { label: 'Total Accounts', value: users.length, tone: 'text-[#2F3E4E] dark:text-slate-100' },
                {
                  label: 'Approved Active',
                  value: users.filter((u) => u.status === 'Approved' && !u.isArchived).length,
                  tone: 'text-[#12805C] dark:text-emerald-300',
                },
                {
                  label: 'Pending Approval',
                  value: pendingApprovalCount,
                  tone: 'text-[#B45309] dark:text-amber-300',
                },
                {
                  label: 'Pending Password Resets',
                  value: pendingResetsCount,
                  tone: 'text-[#9E2A2B] dark:text-rose-300',
                },
                {
                  label: 'Audit Events Logged',
                  value: activityLogs.length,
                  tone: 'text-[#2F3E4E] dark:text-[#F9C80E]',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl p-4"
                >
                  <p className={`text-2xl font-mono font-extrabold tabular-nums ${stat.tone}`}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] font-display font-bold uppercase text-[#64748B] dark:text-slate-400 mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Firebase Cloud Sync & Google Drive Backup Card */}
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-50 flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-[#12805C] dark:text-[#F9C80E]" />
                    <span>Firebase Cloud Database Sync &amp; Cross-Browser Backup</span>
                  </h2>
                  <p className="text-xs text-[#475569] dark:text-slate-300">
                    Synchronize centralized employee directory, 9-action tool permission matrices,
                    password reset logs, and workspace records with Firebase Firestore using the
                    authorized Super Admin Google account (<code>vcpl.mlr@gmail.com</code>).
                  </p>
                </div>
                {cloudEmail && (
                  <span className="px-2.5 py-1 rounded-md bg-[#CEE5DC] dark:bg-emerald-950/60 text-[#12805C] dark:text-emerald-300 font-mono text-xs font-bold shrink-0">
                    Google Linked: {cloudEmail}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={() => void handleConnectFirebaseAdmin()}
                  className="px-4 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer disabled:opacity-60"
                >
                  Connect Google Super Admin &amp; Test Firestore
                </button>
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={() => void handleSyncToFirestore()}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-xs font-display font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {cloudBusy ? 'Syncing...' : 'Sync Snapshot to Firebase Cloud'}
                </button>
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={() => void handleRestoreFromFirestore()}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-[#12805C] hover:bg-[#0E6A4B] text-white text-xs font-display font-extrabold cursor-pointer disabled:opacity-60"
                >
                  Restore Permissions &amp; Records from Firestore
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 2: COMPLETE USER MANAGEMENT (ALL 15 FEATURES)               */}
        {/* =============================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Create User Drawer */}
            {createOpen && (
              <form
                onSubmit={(e) => void handleCreateUser(e)}
                className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#12805C] rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-50">
                    Create New Employee Account (No Email Compulsory)
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="p-1 rounded hover:bg-black/10 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. Kaushik or Kaushik123"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                    />
                    {newUsername.trim() && (
                      <p className="text-[10px] font-mono text-[#64748B] mt-0.5">
                        Canonical login: @{newUsername.trim().toLowerCase()}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300">
                        Temporary Password *
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewTempPwd(generateClientRandomTempPassword())}
                        className="text-[10px] font-bold text-[#12805C] dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        Generate
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={newTempPwd}
                      onChange={(e) => setNewTempPwd(e.target.value)}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="Employee full name"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                      Employee ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={newEmployeeId}
                      onChange={(e) => setNewEmployeeId(e.target.value)}
                      placeholder="e.g. VCPL-104"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                      Department *
                    </label>
                    <input
                      type="text"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      placeholder="Accounts / Sales / Service"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                      Designation *
                    </label>
                    <input
                      type="text"
                      value={newDesignation}
                      onChange={(e) => setNewDesignation(e.target.value)}
                      placeholder="Accounts Executive / Auditor"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                      Contact Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={newContact}
                      onChange={(e) => setNewContact(e.target.value)}
                      placeholder="+91..."
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                      Account Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as EnterpriseAccountStatus)}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                    >
                      {ENTERPRISE_ACCOUNT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#2F3E4E]/10 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[#2F3E4E] dark:text-slate-200">
                      Initial Tool &amp; Permission Preset:
                    </label>
                    <select
                      value={newPresetId}
                      onChange={(e) => setNewPresetId(e.target.value)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                    >
                      <option value="">None (Assign manually in Matrix)</option>
                      {ENTERPRISE_ROLE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2 min-h-[38px] rounded-xl bg-[#12805C] hover:bg-[#0E6A4B] text-white text-xs font-display font-extrabold cursor-pointer"
                  >
                    Create User Account
                  </button>
                </div>
              </form>
            )}

            {/* Edit User Modal / Inline Card */}
            {editingUser && (
              <form
                onSubmit={(e) => void handleSaveEditUser(e)}
                className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#F9C80E] rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-50">
                    Edit User Details &amp; Designation — @{editingUser.displayUsername}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Username"
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                  />
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Full Name"
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                  />
                  <input
                    type="text"
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    placeholder="Employee ID"
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                  />
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="Department"
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                  />
                  <input
                    type="text"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="Designation"
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                  />
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    placeholder="Contact Number"
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E]/30 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-xs font-display font-extrabold cursor-pointer"
                  >
                    Save User Details
                  </button>
                </div>
              </form>
            )}

            {/* Reset User Password Drawer */}
            {resetTargetUser && (
              <form
                onSubmit={(e) => void handleConfirmResetPassword(e)}
                className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#9E2A2B] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-display font-extrabold text-[#7D0B0B] dark:text-rose-300">
                    Reset Password for @{resetTargetUser.username}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    Leave blank to auto-generate a secure one-time temporary password (forced change on next login).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={resetCustomPwd}
                    onChange={(e) => setResetCustomPwd(e.target.value)}
                    placeholder="Optional custom temp password"
                    className="min-h-[36px] px-3 py-1 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#9E2A2B] text-white text-xs font-display font-extrabold cursor-pointer whitespace-nowrap"
                  >
                    Issue Temp Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetTargetUser(null)}
                    className="p-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* Directory Search & Filter Bar */}
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search username, full name, department, designation..."
                    className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold"
                  >
                    <option value="ALL">All Statuses</option>
                    {ENTERPRISE_ACCOUNT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showArchivedUsers}
                      onChange={(e) => setShowArchivedUsers(e.target.checked)}
                    />
                    <span>Show Archived</span>
                  </label>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2F3E4E]/20 dark:border-slate-700 text-[10px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      <th className="py-2.5 pr-3">Employee &amp; Username</th>
                      <th className="py-2.5 pr-3">Dept &amp; Designation</th>
                      <th className="py-2.5 pr-3">Status</th>
                      <th className="py-2.5 pr-3">Last Login / Active</th>
                      <th className="py-2.5 pr-3">Assigned Tools</th>
                      <th className="py-2.5 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    {filteredUsers.map((u) => {
                      const assignedCount = Object.values(u.permissions || {}).filter(
                        (p) => p && Object.values(p).some(Boolean)
                      ).length;

                      return (
                        <tr key={u.id} className="align-top hover:bg-[#FEF2C8]/40 dark:hover:bg-slate-900/40">
                          <td className="py-3 pr-3">
                            <div className="font-bold text-[#2F3E4E] dark:text-slate-100">
                              {u.fullName}{' '}
                              {u.role === 'super_admin' && (
                                <span className="ml-1 px-1.5 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] text-[9px] font-mono">
                                  SUPER ADMIN
                                </span>
                              )}
                              {u.isArchived && (
                                <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-300 dark:bg-slate-700 text-[9px] font-mono">
                                  ARCHIVED
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                              @{u.displayUsername}
                              {u.employeeId ? ` · ${u.employeeId}` : ''}
                              {u.mustChangePassword ? ' · Temp Pwd Active' : ''}
                            </div>
                          </td>

                          <td className="py-3 pr-3">
                            <div className="font-semibold text-[#2F3E4E] dark:text-slate-200">
                              {u.designation}
                            </div>
                            <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                              {u.department}
                              {u.contactNumber ? ` · ${u.contactNumber}` : ''}
                            </div>
                          </td>

                          <td className="py-3 pr-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold whitespace-nowrap ${STATUS_BADGE_CLASSES[u.status]}`}
                            >
                              {u.status}
                            </span>
                          </td>

                          <td className="py-3 pr-3 font-mono tabular-nums text-[11px] text-[#475569] dark:text-slate-300">
                            <div>
                              Login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                            </div>
                            <div className="text-[#64748B] dark:text-slate-400">
                              Active: {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : '—'}
                            </div>
                          </td>

                          <td className="py-3 pr-3">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectPermUser(u.id);
                                setActiveTab('permissions');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-[#F9C80E] hover:bg-[#FEF2C8] cursor-pointer"
                            >
                              <Shield className="w-3 h-3" />
                              <span>{u.role === 'super_admin' ? 'All' : assignedCount} Modules</span>
                            </button>
                          </td>

                          <td className="py-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1">
                              {u.status !== 'Approved' && (
                                <button
                                  type="button"
                                  title="Approve / Activate User"
                                  onClick={() => void handleStatusChange(u.id, 'Approved')}
                                  className="px-2 py-1 rounded bg-[#12805C] text-white text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>{u.status === 'Pending Approval' ? 'Approve' : 'Activate'}</span>
                                </button>
                              )}

                              {u.status === 'Pending Approval' && (
                                <button
                                  type="button"
                                  title="Reject User"
                                  onClick={() => void handleStatusChange(u.id, 'Rejected')}
                                  className="px-2 py-1 rounded bg-[#9E2A2B] text-white text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              )}

                              {u.role !== 'super_admin' && u.status === 'Approved' && (
                                <>
                                  <button
                                    type="button"
                                    title="Suspend User"
                                    onClick={() => void handleStatusChange(u.id, 'Suspended')}
                                    className="px-2 py-1 rounded border border-orange-400 text-orange-700 dark:text-orange-300 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <PauseCircle className="w-3 h-3" />
                                    <span>Suspend</span>
                                  </button>
                                  <button
                                    type="button"
                                    title="Deactivate User"
                                    onClick={() => void handleStatusChange(u.id, 'Inactive')}
                                    className="px-2 py-1 rounded border border-slate-400 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <PlayCircle className="w-3 h-3" />
                                    <span>Deactivate</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                title="Edit Details & Designation"
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditUsername(u.displayUsername);
                                  setEditFullName(u.fullName);
                                  setEditEmployeeId(u.employeeId);
                                  setEditDepartment(u.department);
                                  setEditDesignation(u.designation);
                                  setEditContact(u.contactNumber);
                                }}
                                className="px-2 py-1 rounded border border-[#2F3E4E]/30 dark:border-slate-600 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                title="Reset Password"
                                onClick={() => {
                                  setResetTargetUser({
                                    userId: u.id,
                                    username: u.displayUsername,
                                  });
                                  setResetCustomPwd('');
                                }}
                                className="px-2 py-1 rounded border border-[#9E2A2B]/40 text-[#9E2A2B] dark:text-rose-300 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Reset Pwd</span>
                              </button>

                              <button
                                type="button"
                                title="View Login & Activity Logs"
                                onClick={() => {
                                  setLogUserFilter(u.id);
                                  setActiveTab('logs');
                                }}
                                className="px-2 py-1 rounded border border-[#2F3E4E]/30 dark:border-slate-600 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <Activity className="w-3 h-3" />
                                <span>Logs</span>
                              </button>

                              {u.role !== 'super_admin' && (
                                <>
                                  <button
                                    type="button"
                                    title={u.isArchived ? 'Restore Account' : 'Archive Account'}
                                    onClick={() => void handleArchiveToggle(u.id, !u.isArchived)}
                                    className="px-2 py-1 rounded border border-[#2F3E4E]/30 dark:border-slate-600 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                  >
                                    {u.isArchived ? (
                                      <RotateCcw className="w-3 h-3" />
                                    ) : (
                                      <Archive className="w-3 h-3" />
                                    )}
                                    <span>{u.isArchived ? 'Restore' : 'Archive'}</span>
                                  </button>

                                  {confirmDeleteUserId === u.id ? (
                                    <span className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteUser(u.id)}
                                        className="px-2 py-1 rounded bg-[#7D0B0B] text-white text-[10px] font-bold cursor-pointer"
                                      >
                                        Confirm Delete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteUserId(null)}
                                        className="px-1.5 py-1 rounded border text-[10px] cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      title="Permanently Delete Account"
                                      onClick={() => setConfirmDeleteUserId(u.id)}
                                      className="px-2 py-1 rounded border border-rose-500/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 3: TOOL-WISE 9-ACTION PERMISSION MATRIX EDITOR              */}
        {/* =============================================================== */}
        {activeTab === 'permissions' && (
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-50 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#12805C] dark:text-[#F9C80E]" />
                  <span>Tool-Wise Permission Matrix (9 Granular Actions)</span>
                </h2>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Assign View, Create, Edit, Upload, Download, Delete, Approve, Export &amp; Admin
                  privileges per module and tool.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={permTargetUserId}
                  onChange={(e) => handleSelectPermUser(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      @{u.displayUsername} — {u.fullName} ({u.designation})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={permSaving || !permTargetUserId}
                  onClick={() => void handleSavePermissions()}
                  className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#12805C] hover:bg-[#0E6A4B] text-white text-xs font-display font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {permSaving ? 'Saving...' : 'Save Permission Matrix'}
                </button>
              </div>
            </div>

            {/* Quick Role Presets & Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-display font-bold uppercase text-[#64748B] mr-1">
                  Apply Preset:
                </span>
                {ENTERPRISE_ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.description}
                    onClick={() => setPermMatrixDraft(preset.buildMatrix())}
                    className="px-2.5 py-1 rounded-md border border-[#2F3E4E]/25 dark:border-slate-600 bg-[#FEF2C8]/70 dark:bg-slate-800 hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPermMatrixDraft({})}
                  className="px-2.5 py-1 rounded-md border border-rose-400/40 text-[11px] font-bold text-rose-700 dark:text-rose-300 cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={permGroupFilter}
                  onChange={(e) => setPermGroupFilter(e.target.value)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                >
                  <option value="ALL">All Module Groups ({ALL_ENTERPRISE_MODULES.length})</option>
                  <option value="Core Modules">Core Modules</option>
                  <option value="VCPL & Reconcilers">VCPL &amp; Reconcilers</option>
                  <option value="Tax & Banking">Tax &amp; Banking</option>
                  <option value="Documents, PDF & Workspace">Documents, PDF &amp; Workspace</option>
                </select>
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Filter tools..."
                  className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[540px] border border-[#2F3E4E]/15 dark:border-slate-700 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#FEF2C8] dark:bg-[#0B1120] z-10 border-b border-[#2F3E4E]/20 dark:border-slate-700">
                  <tr className="text-[10px] font-display font-extrabold uppercase text-[#2F3E4E] dark:text-slate-200">
                    <th className="py-2.5 px-3">Module / Tool</th>
                    {ENTERPRISE_PERMISSION_ACTIONS.map((act) => (
                      <th key={act.key} className="py-2.5 px-2 text-center">
                        {act.shortLabel}
                      </th>
                    ))}
                    <th className="py-2.5 px-2 text-center">Row</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800 bg-white dark:bg-[#131C2E]">
                  {filteredModules.map((mod) => {
                    const rowSet = permMatrixDraft[mod.id] || createEmptyPermissionSet(false);
                    return (
                      <tr key={mod.id} className="hover:bg-[#FEF2C8]/35 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3">
                          <div className="font-bold text-[#2F3E4E] dark:text-slate-100">
                            <span className="font-mono text-[10px] text-[#12805C] dark:text-emerald-400 mr-1.5">
                              {mod.code}
                            </span>
                            {mod.title}
                          </div>
                          <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                            {mod.group}
                          </div>
                        </td>
                        {ENTERPRISE_PERMISSION_ACTIONS.map((act) => (
                          <td key={act.key} className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${mod.title} ${act.label}`}
                              checked={Boolean(rowSet[act.key])}
                              onChange={() => handleTogglePerm(mod.id, act.key)}
                              className="w-4 h-4 accent-[#12805C] cursor-pointer"
                            />
                          </td>
                        ))}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleModuleRow(mod.id)}
                            className="px-2 py-0.5 rounded border border-[#2F3E4E]/25 dark:border-slate-600 text-[10px] font-bold hover:bg-[#F9C80E] cursor-pointer"
                          >
                            All
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 4: MANUAL PASSWORD RESET REQUESTS QUEUE                     */}
        {/* =============================================================== */}
        {activeTab === 'resets' && (
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-50">
                Manual Password Reset Queue (Zero Automatic Emails)
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Approve a request to generate a one-time temporary password to share directly with
                the employee. Temporary passwords require immediate replacement upon login.
              </p>
            </div>

            {resetRequests.length === 0 ? (
              <p className="text-xs text-[#64748B] py-6 text-center">
                No password reset requests recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2F3E4E]/20 dark:border-slate-700 text-[10px] font-display font-extrabold uppercase text-[#64748B]">
                      <th className="py-2 pr-3">Employee</th>
                      <th className="py-2 pr-3">Note</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Requested At</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    {resetRequests.map((req) => (
                      <tr key={req.id}>
                        <td className="py-2.5 pr-3">
                          <div className="font-bold text-[#2F3E4E] dark:text-slate-100">
                            {req.full_name}
                          </div>
                          <div className="font-mono text-[11px] text-[#64748B]">@{req.username}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-[#475569] dark:text-slate-300">
                          {req.note || '—'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold ${
                              req.status === 'Approved'
                                ? 'bg-[#CEE5DC] text-[#12805C] border-[#12805C]/30'
                                : req.status === 'Rejected'
                                  ? 'bg-[#FEE2E2] text-[#7D0B0B] border-[#9E2A2B]/30'
                                  : 'bg-[#FEF2C8] text-[#B45309] border-[#B45309]/30'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-[11px] text-[#64748B]">
                          {new Date(req.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right">
                          {req.status === 'Pending' ? (
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setResetTargetUser({
                                    userId: req.user_id,
                                    username: req.username,
                                    requestId: req.id,
                                  });
                                  setResetCustomPwd('');
                                  setActiveTab('users');
                                }}
                                className="px-2.5 py-1 rounded bg-[#12805C] text-white text-[11px] font-bold cursor-pointer"
                              >
                                Approve &amp; Generate Password
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRejectResetRequest(req.id)}
                                className="px-2.5 py-1 rounded bg-[#9E2A2B] text-white text-[11px] font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-[#64748B]">
                              By {req.resolved_by || 'Admin'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 5: LOGIN HISTORY & ACTIVITY LOGS                            */}
        {/* =============================================================== */}
        {activeTab === 'logs' && (
          <div className="space-y-5">
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#12805C]" />
                <span className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                  Filter Audit &amp; Login Trails by User:
                </span>
              </div>
              <select
                value={logUserFilter}
                onChange={(e) => setLogUserFilter(e.target.value)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold"
              >
                <option value="">All Users (Latest Events)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    @{u.displayUsername} — {u.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Login History */}
              <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 space-y-3">
                <h3 className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E]" />
                  <span>User Login History ({loginHistory.length})</span>
                </h3>
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-[#2F3E4E]/20 dark:border-slate-700 text-[10px] font-display font-extrabold uppercase text-[#64748B]">
                        <th className="py-2 pr-2">User</th>
                        <th className="py-2 pr-2">Outcome</th>
                        <th className="py-2 pr-2">Detail / IP</th>
                        <th className="py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {loginHistory.map((h) => (
                        <tr key={h.id}>
                          <td className="py-2 pr-2 font-mono font-bold">@{h.display_username}</td>
                          <td className="py-2 pr-2 font-mono">
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] ${
                                h.outcome === 'success' || h.outcome === 'password_changed'
                                  ? 'bg-[#CEE5DC] text-[#12805C] border-[#12805C]/30'
                                  : 'bg-[#FEE2E2] text-[#7D0B0B] border-[#9E2A2B]/30'
                              }`}
                            >
                              {h.outcome}
                            </span>
                          </td>
                          <td className="py-2 pr-2 text-[#475569] dark:text-slate-300">
                            <div>{h.detail}</div>
                            <div className="font-mono text-[10px] text-[#94A3B8]">{h.ip_address}</div>
                          </td>
                          <td className="py-2 font-mono tabular-nums text-[#64748B]">
                            {new Date(h.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Activity Logs */}
              <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 space-y-3">
                <h3 className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#12805C]" />
                  <span>User Activity Audit Logs ({activityLogs.length})</span>
                </h3>
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-[#2F3E4E]/20 dark:border-slate-700 text-[10px] font-display font-extrabold uppercase text-[#64748B]">
                        <th className="py-2 pr-2">Actor</th>
                        <th className="py-2 pr-2">Action</th>
                        <th className="py-2 pr-2">Summary</th>
                        <th className="py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {activityLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="py-2 pr-2 font-mono font-bold">@{log.actor_username}</td>
                          <td className="py-2 pr-2 font-mono text-[10px] font-bold text-[#2F3E4E] dark:text-[#F9C80E]">
                            {log.action}
                          </td>
                          <td className="py-2 pr-2 text-[#475569] dark:text-slate-300">
                            {log.summary}
                          </td>
                          <td className="py-2 font-mono tabular-nums text-[#64748B]">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 6: CENTRAL DOCUMENT VAULT & WORKSPACE RECORDS               */}
        {/* =============================================================== */}
        {activeTab === 'vault' && <CentralWorkspaceModules />}
      </div>
    </section>
  );
};
