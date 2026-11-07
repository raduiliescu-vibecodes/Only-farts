import charactersJson from "../../data/characters.json";
import historyJson from "../../data/history.json";
import syncJson from "../../data/sync-status.json";
import type { CharacterConfig, SyncStatusFile } from "./types";
import { validateCharacters, validateHistory } from "./validate";

// JSON is read at build time; every commit to data/ triggers a fresh deploy.
// The files are treated as unknown and checked, rather than cast: TypeScript's
// inferred JSON types change shape as snapshots with different stats are added.
export const charactersFile = validateCharacters(charactersJson as unknown);
export const history = validateHistory(historyJson as unknown, charactersFile);
export const syncStatus = syncJson as unknown as SyncStatusFile;

export const characters: CharacterConfig[] = charactersFile.characters;
export const MAX_LEVEL = charactersFile.maxLevel;

export function getCharacter(slug: string): CharacterConfig | undefined {
  return characters.find((c) => c.slug === slug);
}
