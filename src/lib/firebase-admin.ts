import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDir, '../../firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];

  const configPath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!configPath) {
    throw new Error(
      `Firebase configuration file "firebase-applet-config.json" was not found. Checked: ${candidatePaths.join(', ')}`
    );
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(configPath, 'utf-8');
  } catch (error: any) {
    throw new Error(
      `Failed to read Firebase configuration file at "${configPath}": ${error?.message || String(error)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error: any) {
    throw new Error(
      `Invalid JSON in Firebase configuration file at "${configPath}": ${error?.message || String(error)}`
    );
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).projectId !== 'string' ||
    !(parsed as Record<string, unknown>).projectId
  ) {
    throw new Error(
      `Firebase configuration file at "${configPath}" is missing a valid "projectId" field.`
    );
  }

  const record = parsed as Record<string, any>;
  return {
    ...record,
    projectId: record.projectId,
    firestoreDatabaseId:
      typeof record.firestoreDatabaseId === 'string' && record.firestoreDatabaseId.trim()
        ? record.firestoreDatabaseId
        : '(default)',
  };
}

const firebaseConfig = loadFirebaseAppletConfig();

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();
export const firebaseProjectConfig: FirebaseAppletConfig = firebaseConfig;
