/**
 * localStorage autosave (PRD §4.4) — debounced ~1s, restored on startup,
 * and NEVER fatal: quota exceeded / private-mode / disabled storage
 * degrades to a visible non-blocking notice instead of throwing.
 */
import { hydrateTransientClean, parseProjectJson, serializeProject } from './serialize';
import type { Project } from './types';

export const AUTOSAVE_KEY = 'pid-drafter.project.autosave.v2';
export const AUTOSAVE_DEBOUNCE_MS = 1000;

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'unavailable';

export interface AutosaveFailure {
  message: string;
}

/**
 * Whether localStorage is usable at all. Reading/writing a probe key is the
 * only reliable test — merely accessing `window.localStorage` can throw in
 * hardened privacy modes, and Safari private mode allows access but throws
 * on write.
 */
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__pid_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Human-readable reason storage is unusable, for the non-blocking notice. */
export function storageUnavailableNotice(): string {
  return 'Autosave off — this browser is blocking local storage (private mode, storage disabled, or quota full). Your drawing still works; save to JSON to keep it.';
}

/** Write the project to localStorage. Returns an error message on failure. */
export function writeAutosave(project: Project): AutosaveFailure | null {
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProject(project)));
    return null;
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === 'QuotaExceededError' || /quota/i.test(e?.message ?? '')) {
      return { message: 'Autosave off — browser storage quota exceeded. Save to JSON to keep your work.' };
    }
    return { message: storageUnavailableNotice() };
  }
}

/**
 * Read + strictly validate the autosaved project. Returns null when there
 * is nothing stored, or when the stored payload no longer parses (e.g. an
 * older app version wrote it) — a corrupt autosave must never block the
 * app from starting.
 */
export function readAutosave(): Project | null {
  try {
    const text = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!text) return null;
    const result = parseProjectJson(text);
    return result.ok && result.project ? hydrateTransientClean(result.project) : null;
  } catch {
    return null;
  }
}

/** Remove the autosave payload (used after a manual JSON load replaces state). */
export function clearAutosave(): void {
  try {
    window.localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* non-fatal by design */
  }
}
