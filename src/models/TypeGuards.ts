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
 * Type guard to check if an abstract file exists and is valid
 *
 * @param file - The abstract file to check
 * @returns true if the file is not null/undefined
 */
export function isValidAbstractFile(
  file: TAbstractFile | null | undefined
): file is TAbstractFile {
  return file !== null && file !== undefined;
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

/**
 * Utility function to safely get a TFolder from a path
 *
 * @param vault - The Obsidian vault
 * @param path - The folder path
 * @returns TFolder if valid, null otherwise
 */
export function safeTFolderFromPath(
  vault: { getAbstractFileByPath: (path: string) => TAbstractFile | null },
  path: string
): TFolder | null {
  const abstractFile = vault.getAbstractFileByPath(path);
  return isTFolder(abstractFile) ? abstractFile : null;
}

/**
 * Type guard with error message generation
 *
 * @param file - The abstract file to check
 * @param expectedType - The expected type ('file' or 'folder')
 * @returns object with isValid boolean and error message if invalid
 */
export function validateFileType(
  file: TAbstractFile | null | undefined,
  expectedType: 'file' | 'folder'
): { isValid: boolean; error?: string; file?: TFile | TFolder } {
  if (!isValidAbstractFile(file)) {
    return {
      isValid: false,
      error: 'File not found or is null/undefined',
    };
  }

  if (expectedType === 'file') {
    if (isTFile(file)) {
      return { isValid: true, file };
    }
    return {
      isValid: false,
      error: `Expected file but found ${isTFolder(file) ? 'folder' : 'unknown type'}: ${file.path}`,
    };
  }

  if (expectedType === 'folder') {
    if (isTFolder(file)) {
      return { isValid: true, file };
    }
    return {
      isValid: false,
      error: `Expected folder but found ${isTFile(file) ? 'file' : 'unknown type'}: ${file.path}`,
    };
  }

  return {
    isValid: false,
    error: `Invalid expectedType: ${expectedType}`,
  };
}
