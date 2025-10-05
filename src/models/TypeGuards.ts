import { TAbstractFile, TFile, TFolder } from 'obsidian';

/**
 * Type guards for safe Obsidian file system object validation
 *
 * These functions provide runtime type checking to ensure safe casting
 * without relying on instanceof checks which can fail with mocked objects in tests.
 *
 * Uses duck typing to validate object structure based on Obsidian's API contracts.
 */

/**
 * Type guard to check if an abstract file is a TFile
 *
 * @param file - The abstract file to check
 * @returns true if the file has TFile characteristics
 */
export function isTFile(file: TAbstractFile | null | undefined): file is TFile {
  return (
    file !== null &&
    file !== undefined &&
    'extension' in file &&
    'stat' in file &&
    !('children' in file)
  );
}

/**
 * Type guard to check if an abstract file is a TFolder
 *
 * @param file - The abstract file to check
 * @returns true if the file has TFolder characteristics
 */
export function isTFolder(
  file: TAbstractFile | null | undefined
): file is TFolder {
  return (
    file !== null &&
    file !== undefined &&
    'children' in file &&
    !('extension' in file) &&
    !('stat' in file)
  );
}

/**
 * Utility function to safely get a TFile from a path
 *
 * @param vault - The Obsidian vault
 * @param path - The file path
 * @returns TFile if valid, null otherwise
 */
export function safeTFileFromPath(
  vault: { getAbstractFileByPath: (path: string) => TAbstractFile | null },
  path: string
): TFile | null {
  const abstractFile = vault.getAbstractFileByPath(path);
  return isTFile(abstractFile) ? abstractFile : null;
}
