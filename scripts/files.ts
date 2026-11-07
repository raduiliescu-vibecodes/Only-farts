import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { CharactersFile, HistoryFile, SyncStatusFile } from "../src/lib/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PATHS = {
  characters: path.join(root, "data/characters.json"),
  history: path.join(root, "data/history.json"),
  syncStatus: path.join(root, "data/sync-status.json"),
  aotcStatus: path.join(root, "data/aotc-status.json"),
  sources: path.join(root, "data/sources.json"),
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

/** Write pretty JSON, only when the content actually changed. Returns true if written. */
export async function writeJsonIfChanged(file: string, data: unknown): Promise<boolean> {
  const next = `${JSON.stringify(data, null, 2)}\n`;
  const prev = await readFile(file, "utf8").catch(() => "");
  if (prev === next) return false;
  await writeFile(file, next);
  return true;
}

export const readCharacters = () => readJson<CharactersFile>(PATHS.characters);
export const readHistory = () => readJson<HistoryFile>(PATHS.history);
export const readSyncStatus = () => readJson<SyncStatusFile>(PATHS.syncStatus);
export const readAotcStatus = () => readJson<SyncStatusFile>(PATHS.aotcStatus);

/** ISO timestamp at whole-second precision. */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
