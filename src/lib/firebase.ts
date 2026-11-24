import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';
import {
  type Firestore,
  Timestamp,
  collection,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  initializeFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp());
  }
  return cachedAuth;
}

export function getFirestoreDb(): Firestore {
  if (cachedDb) return cachedDb;
  const app = getFirebaseApp();
  const dbId = firebaseConfig.firestoreDatabaseId;
  try {
    cachedDb = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch {
    cachedDb = dbId
      ? initializeFirestore(app, { ignoreUndefinedProperties: true }, dbId)
      : initializeFirestore(app, { ignoreUndefinedProperties: true });
  }
  return cachedDb;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  let user = null;
  try {
    user = getFirebaseAuth().currentUser;
  } catch {
    user = null;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo:
        user?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}

export async function testFirestoreConnection(): Promise<{
  ok: boolean;
  offline?: boolean;
  error?: string;
}> {
  let auth: Auth;
  try {
    auth = getFirebaseAuth();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Firebase Auth is unavailable.',
    };
  }
  if (!auth.currentUser) {
    return { ok: false, error: 'Not signed into Google Workspace / Firebase Auth.' };
  }
  const path = 'test/connection';
  try {
    const db = getFirestoreDb();
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return { ok: false, offline: true, error: error.message };
    }
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch (wrapped) {
      return {
        ok: false,
        error: wrapped instanceof Error ? wrapped.message : String(wrapped),
      };
    }
  }
}

export function isFirebaseSuperAdminSignedIn(): boolean {
  try {
    const user = getFirebaseAuth().currentUser;
    return Boolean(
      user &&
        user.emailVerified &&
        user.email?.toLowerCase() === 'vcpl.mlr@gmail.com'
    );
  } catch {
    return false;
  }
}

export interface CloudSyncEnterpriseUser {
  id: string;
  username: string;
  displayUsername: string;
  internalAuthId: string;
  fullName: string;
  employeeId?: string;
  department: string;
  designation: string;
  contactNumber?: string;
  role: 'super_admin' | 'employee';
  status: string;
  isArchived: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  lastActiveAt?: string;
  permissions?: Record<string, Record<string, boolean>>;
}

export interface CloudSyncResetRequest {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  note?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface CloudSyncActivityLog {
  id: string;
  actorUserId: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
}

export interface CloudSyncDocumentMeta {
  id: string;
  moduleId: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  approvalStatus: 'Draft' | 'Pending Review' | 'Approved' | 'Rejected';
  driveFileId?: string;
  driveWebViewLink?: string;
  uploadedBy: string;
  uploadedByUsername: string;
}

export interface CloudSyncWorkspaceRecord {
  id: string;
  moduleId: string;
  recordTitle: string;
  referenceCode: string;
  status: string;
  payloadJson: string;
  createdBy: string;
  createdByUsername: string;
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 128) || 'item';
}

export async function syncEnterpriseSnapshotToFirestore(payload: {
  users: CloudSyncEnterpriseUser[];
  resetRequests: CloudSyncResetRequest[];
  activityLogs: CloudSyncActivityLog[];
  documents: CloudSyncDocumentMeta[];
  records: CloudSyncWorkspaceRecord[];
}): Promise<{ syncedCount: number }> {
  if (!isFirebaseSuperAdminSignedIn()) {
    throw new Error('Sign in with authorized Google Super Admin (vcpl.mlr@gmail.com) to sync with Firebase Firestore.');
  }

  let syncedCount = 0;

  for (const user of payload.users) {
    const id = sanitizeId(user.id);
    const userPath = `enterpriseUsers/${id}`;
    try {
      const ref = doc(getFirestoreDb(), 'enterpriseUsers', id);
      const existing = await getDocFromServer(ref);
      const baseData = {
        id,
        username: user.username.slice(0, 64),
        displayUsername: user.displayUsername.slice(0, 64),
        internalAuthId: user.internalAuthId.slice(0, 128),
        fullName: user.fullName.slice(0, 120),
        employeeId: (user.employeeId || '').slice(0, 64),
        department: (user.department || 'Operations').slice(0, 100),
        designation: (user.designation || 'Staff').slice(0, 100),
        contactNumber: (user.contactNumber || '').slice(0, 40),
        role: user.role,
        status: user.status,
        isArchived: Boolean(user.isArchived),
        mustChangePassword: Boolean(user.mustChangePassword),
        lastLoginAt: (user.lastLoginAt || '').slice(0, 64),
        lastActiveAt: (user.lastActiveAt || '').slice(0, 64),
        createdAt: existing.exists()
          ? (existing.data().createdAt as Timestamp)
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, baseData);
      syncedCount += 1;

      if (user.permissions) {
        const permRef = doc(getFirestoreDb(), 'permissionProfiles', id);
        const existingPerm = await getDocFromServer(permRef);
        await setDoc(permRef, {
          userId: id,
          permissionsJson: JSON.stringify(user.permissions).slice(0, 32768),
          createdAt: existingPerm.exists()
            ? (existingPerm.data().createdAt as Timestamp)
            : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        syncedCount += 1;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }
  }

  for (const req of payload.resetRequests.slice(0, 100)) {
    const id = sanitizeId(req.id);
    const path = `resetRequests/${id}`;
    try {
      const ref = doc(getFirestoreDb(), 'resetRequests', id);
      const existing = await getDocFromServer(ref);
      await setDoc(ref, {
        id,
        userId: sanitizeId(req.userId),
        username: req.username.slice(0, 64),
        fullName: req.fullName.slice(0, 120),
        status: req.status,
        note: (req.note || '').slice(0, 500),
        resolvedBy: (req.resolvedBy || '').slice(0, 120),
        resolvedAt: (req.resolvedAt || '').slice(0, 64),
        createdAt: existing.exists()
          ? (existing.data().createdAt as Timestamp)
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      syncedCount += 1;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  for (const log of payload.activityLogs.slice(0, 100)) {
    const id = sanitizeId(log.id);
    const path = `activityLogs/${id}`;
    try {
      const ref = doc(getFirestoreDb(), 'activityLogs', id);
      const existing = await getDocFromServer(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          id,
          actorUserId: sanitizeId(log.actorUserId || 'system'),
          actorUsername: (log.actorUsername || 'system').slice(0, 64),
          action: log.action.slice(0, 80),
          targetType: (log.targetType || 'system').slice(0, 64),
          targetId: sanitizeId(log.targetId || 'na'),
          summary: (log.summary || '').slice(0, 500),
          createdAt: serverTimestamp(),
        });
        syncedCount += 1;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  for (const docMeta of payload.documents.slice(0, 100)) {
    const id = sanitizeId(docMeta.id);
    const path = `enterpriseDocuments/${id}`;
    try {
      const ref = doc(getFirestoreDb(), 'enterpriseDocuments', id);
      const existing = await getDocFromServer(ref);
      await setDoc(ref, {
        id,
        moduleId: docMeta.moduleId.slice(0, 80),
        title: docMeta.title.slice(0, 180),
        fileName: docMeta.fileName.slice(0, 255),
        mimeType: (docMeta.mimeType || 'application/octet-stream').slice(0, 160),
        sizeBytes: Math.max(0, Math.min(52428800, Number(docMeta.sizeBytes || 0))),
        approvalStatus: docMeta.approvalStatus,
        driveFileId: (docMeta.driveFileId || '').slice(0, 256),
        driveWebViewLink: (docMeta.driveWebViewLink || '').slice(0, 512),
        uploadedBy: sanitizeId(docMeta.uploadedBy || 'admin'),
        uploadedByUsername: (docMeta.uploadedByUsername || 'admin').slice(0, 64),
        createdAt: existing.exists()
          ? (existing.data().createdAt as Timestamp)
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      syncedCount += 1;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  for (const rec of payload.records.slice(0, 100)) {
    const id = sanitizeId(rec.id);
    const path = `workspaceRecords/${id}`;
    try {
      const ref = doc(getFirestoreDb(), 'workspaceRecords', id);
      const existing = await getDocFromServer(ref);
      await setDoc(ref, {
        id,
        moduleId: rec.moduleId.slice(0, 80),
        recordTitle: rec.recordTitle.slice(0, 200),
        referenceCode: (rec.referenceCode || '').slice(0, 100),
        status: (rec.status || 'Active').slice(0, 64),
        payloadJson: (rec.payloadJson || '{}').slice(0, 65536),
        createdBy: sanitizeId(rec.createdBy || 'admin'),
        createdByUsername: (rec.createdByUsername || 'admin').slice(0, 64),
        createdAt: existing.exists()
          ? (existing.data().createdAt as Timestamp)
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      syncedCount += 1;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  return { syncedCount };
}

export async function loadEnterpriseSnapshotFromFirestore(): Promise<{
  users: CloudSyncEnterpriseUser[];
  permissionsByUser: Record<string, Record<string, Record<string, boolean>>>;
  documents: CloudSyncDocumentMeta[];
  records: CloudSyncWorkspaceRecord[];
}> {
  if (!isFirebaseSuperAdminSignedIn()) {
    throw new Error('Sign in with authorized Google Super Admin (vcpl.mlr@gmail.com) to restore from Firestore.');
  }

  const users: CloudSyncEnterpriseUser[] = [];
  const permissionsByUser: Record<string, Record<string, Record<string, boolean>>> = {};
  const documents: CloudSyncDocumentMeta[] = [];
  const records: CloudSyncWorkspaceRecord[] = [];

  try {
    const snap = await getDocs(
      query(collection(getFirestoreDb(), 'enterpriseUsers'), orderBy('username'))
    );
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      users.push({
        id: String(d.id || docSnap.id),
        username: String(d.username || ''),
        displayUsername: String(d.displayUsername || d.username || ''),
        internalAuthId: String(d.internalAuthId || ''),
        fullName: String(d.fullName || ''),
        employeeId: d.employeeId ? String(d.employeeId) : '',
        department: String(d.department || 'Operations'),
        designation: String(d.designation || 'Staff'),
        contactNumber: d.contactNumber ? String(d.contactNumber) : '',
        role: d.role === 'super_admin' ? 'super_admin' : 'employee',
        status: String(d.status || 'Pending Approval'),
        isArchived: Boolean(d.isArchived),
        mustChangePassword: Boolean(d.mustChangePassword),
        lastLoginAt: d.lastLoginAt ? String(d.lastLoginAt) : '',
        lastActiveAt: d.lastActiveAt ? String(d.lastActiveAt) : '',
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'enterpriseUsers');
  }

  try {
    const permSnap = await getDocs(collection(getFirestoreDb(), 'permissionProfiles'));
    permSnap.forEach((docSnap) => {
      const d = docSnap.data();
      try {
        permissionsByUser[String(d.userId || docSnap.id)] = JSON.parse(
          String(d.permissionsJson || '{}')
        ) as Record<string, Record<string, boolean>>;
      } catch {
        // Ignore malformed json
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'permissionProfiles');
  }

  try {
    const docsSnap = await getDocs(collection(getFirestoreDb(), 'enterpriseDocuments'));
    docsSnap.forEach((docSnap) => {
      const d = docSnap.data();
      documents.push({
        id: String(d.id || docSnap.id),
        moduleId: String(d.moduleId || 'document-vault'),
        title: String(d.title || 'Untitled'),
        fileName: String(d.fileName || 'file'),
        mimeType: String(d.mimeType || 'application/octet-stream'),
        sizeBytes: Number(d.sizeBytes || 0),
        approvalStatus: (d.approvalStatus as CloudSyncDocumentMeta['approvalStatus']) || 'Draft',
        driveFileId: d.driveFileId ? String(d.driveFileId) : undefined,
        driveWebViewLink: d.driveWebViewLink ? String(d.driveWebViewLink) : undefined,
        uploadedBy: String(d.uploadedBy || 'admin'),
        uploadedByUsername: String(d.uploadedByUsername || 'admin'),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'enterpriseDocuments');
  }

  try {
    const recSnap = await getDocs(collection(getFirestoreDb(), 'workspaceRecords'));
    recSnap.forEach((docSnap) => {
      const d = docSnap.data();
      records.push({
        id: String(d.id || docSnap.id),
        moduleId: String(d.moduleId || 'auto-ledger'),
        recordTitle: String(d.recordTitle || 'Record'),
        referenceCode: String(d.referenceCode || ''),
        status: String(d.status || 'Active'),
        payloadJson: String(d.payloadJson || '{}'),
        createdBy: String(d.createdBy || 'admin'),
        createdByUsername: String(d.createdByUsername || 'admin'),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'workspaceRecords');
  }

  return { users, permissionsByUser, documents, records };
}
