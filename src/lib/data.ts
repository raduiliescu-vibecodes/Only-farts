import charactersJson from "../../data/characters.json";
import historyJson from "../../data/history.json";
import syncJson from "../../data/sync-status.json";
import type {
  CharacterConfig,
  CharactersFile,
  HistoryFile,
  SyncStatusFile,
} from "./types";

// JSON is read at build time; every commit to data/ triggers a fresh deploy.
export const charactersFile = charactersJson as CharactersFile;
export const history = historyJson as HistoryFile;
export const syncStatus = syncJson as SyncStatusFile;

export const characters: CharacterConfig[] = charactersFile.characters;
export const MAX_LEVEL = charactersFile.maxLevel;

export function getCharacter(slug: string): CharacterConfig | undefined {
  return characters.find((c) => c.slug === slug);
}
