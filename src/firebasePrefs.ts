import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { isValidCloudDocId, verifyStudentHash } from './studentAllowlist.ts';

export interface StudentCloudPrefs {
  myMbuGroup: '' | 'I' | 'II' | 'III' | 'IV' | 'V';
  myLabGroup: '' | '1' | '2';
  otherGroupMode: 'dim' | 'hide';
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const VALID_MBU_GROUPS = new Set(['', 'I', 'II', 'III', 'IV', 'V']);
const VALID_LAB_GROUPS = new Set(['', '1', '2']);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

function normalizeMbuGroupPref(raw: unknown): '' | 'I' | 'II' | 'III' | 'IV' | 'V' {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return VALID_MBU_GROUPS.has(s) ? (s as '' | 'I' | 'II' | 'III' | 'IV' | 'V') : '';
}

function normalizeLabGroupPref(raw: unknown): '' | '1' | '2' {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return VALID_LAB_GROUPS.has(s) ? (s as '' | '1' | '2') : '';
}

function normalizeOtherGroupModePref(raw: unknown): 'dim' | 'hide' {
  return raw === 'hide' ? 'hide' : 'dim';
}

export async function loadCloudStudentPrefs(authHash: string, cloudDocId: string): Promise<StudentCloudPrefs | null> {
  if (!verifyStudentHash(authHash) || !isValidCloudDocId(cloudDocId)) return null;
  const path = `student_prefs/${cloudDocId}`;
  try {
    const snap = await getDoc(doc(db, 'student_prefs', cloudDocId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      myMbuGroup: normalizeMbuGroupPref(data?.myMbuGroup),
      myLabGroup: normalizeLabGroupPref(data?.myLabGroup),
      otherGroupMode: normalizeOtherGroupModePref(data?.otherGroupMode),
    };
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return null;
  }
}

export async function saveCloudStudentPrefs(
  authHash: string,
  cloudDocId: string,
  prefs: { myMbuGroup?: unknown; myLabGroup?: unknown; otherGroupMode?: unknown },
): Promise<boolean> {
  if (!verifyStudentHash(authHash) || !isValidCloudDocId(cloudDocId)) return false;
  const path = `student_prefs/${cloudDocId}`;
  const payload = {
    myMbuGroup: normalizeMbuGroupPref(prefs.myMbuGroup),
    myLabGroup: normalizeLabGroupPref(prefs.myLabGroup),
    otherGroupMode: normalizeOtherGroupModePref(prefs.otherGroupMode),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'student_prefs', cloudDocId), payload);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    return false;
  }
}
