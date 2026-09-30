import { PV001, SPEC_BY_VERSION, type CaseVersion } from "./case";
import type { Session } from "./engine";
import type { Evaluation, Review } from "./evaluator";

export type RecordEnvelope = { session: Session; evaluation: Evaluation | null; reviews: Review[] };
export const STORAGE_PREFIX = "capi.pv001.session.";
type StoragePort = Pick<Storage, "getItem" | "setItem" | "length" | "key">;
export function saveRecord(storage: StoragePort, record: RecordEnvelope) {
  const key = STORAGE_PREFIX + record.session.sessionId;
  const previous = storage.getItem(key);
  if (previous) {
    const old = JSON.parse(previous) as RecordEnvelope;
    if (
      old.session.case_id !== record.session.case_id ||
      old.session.case_version !== record.session.case_version ||
      old.session.startedAt !== record.session.startedAt ||
      JSON.stringify(old.session.caseSnapshot) !== JSON.stringify(record.session.caseSnapshot)
    ) {
      throw new Error("A identidade, versão e especificação desta sessão são imutáveis.");
    }
  }
  storage.setItem(key, JSON.stringify(record));
}
export function loadRecord(storage: StoragePort, id: string): RecordEnvelope | null {
  const raw = storage.getItem(STORAGE_PREFIX + id);
  if (!raw) return null;
  const data = JSON.parse(raw) as RecordEnvelope;
  if (
    data.session?.case_id !== PV001.id ||
    data.session.case_version !== PV001.version ||
    JSON.stringify(data.session.caseSnapshot) !== JSON.stringify(PV001) ||
    !Array.isArray(data.session.transcript) ||
    !["patient_mode", "reflection_mode", "debriefing_mode"].includes(data.session.mode)
  ) {
    throw new Error(
      "Versão incompatível: sessão preservada para exportação; não pode ser retomada por este motor.",
    );
  }
  return data;
}
/**
 * Opens any known version without migrating it. The current version is resumable; a session
 * recorded under an earlier known specification (v1.1) opens read-only for export and review,
 * only if its stored snapshot matches that specification exactly. Unknown versions throw.
 */
export function openRecord(
  storage: StoragePort,
  id: string,
): { record: RecordEnvelope; resumable: boolean } | null {
  const raw = storage.getItem(STORAGE_PREFIX + id);
  if (!raw) return null;
  const data = JSON.parse(raw) as RecordEnvelope;
  const version = data.session?.case_version;
  if (version === PV001.version) {
    const record = loadRecord(storage, id);
    return record ? { record, resumable: true } : null;
  }
  const spec = Object.hasOwn(SPEC_BY_VERSION, version)
    ? SPEC_BY_VERSION[version as CaseVersion]
    : null;
  if (
    !spec ||
    data.session.case_id !== PV001.id ||
    JSON.stringify(data.session.caseSnapshot) !== JSON.stringify(spec) ||
    !Array.isArray(data.session.transcript)
  ) {
    throw new Error(
      "Versão incompatível: sessão preservada para exportação; não pode ser retomada por este motor.",
    );
  }
  return { record: data, resumable: false };
}
export function sessionIndex(storage: StoragePort) {
  const entries: { id: string; version: string; at: string; student: string }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    try {
      const record = JSON.parse(storage.getItem(key)!) as RecordEnvelope;
      entries.push({
        id: record.session.sessionId,
        version: record.session.case_version,
        at: record.session.startedAt,
        student: record.session.student,
      });
    } catch {
      /* Corrupt records remain untouched. */
    }
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
