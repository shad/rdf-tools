/**
 * Mock implementation of Obsidian API for testing
 * This replaces the 'obsidian' package in tests
 */

import { vi } from 'vitest';

export class MockTFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: { mtime: number; ctime: number; size: number };

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = this.name.includes('.')
      ? this.name.split('.').pop() || ''
      : '';
    this.basename = this.name.replace(`.${this.extension}`, '');
    this.stat = {
      mtime: Date.now(),
      ctime: Date.now(),
      size: 0,
    };
  }
}

export class MockPlugin {
  app: any = {};
  manifest: any = {};

  addCommand = vi.fn();
  addRibbonIcon = vi.fn();
  addSettingTab = vi.fn();
  loadData = vi.fn().mockResolvedValue({});
  saveData = vi.fn().mockResolvedValue(undefined);
  registerEvent = vi.fn();
  registerDomEvent = vi.fn();
  registerInterval = vi.fn();
}

export class MockSetting {
  setName = vi.fn().mockReturnThis();
  setDesc = vi.fn().mockReturnThis();
  addText = vi.fn().mockReturnThis();
  addToggle = vi.fn().mockReturnThis();
  addButton = vi.fn().mockReturnThis();
}

export class MockPluginSettingTab {
  containerEl: HTMLElement = document.createElement('div');
  display = vi.fn();
  hide = vi.fn();
}

export class MockModal {
  contentEl: HTMLElement = document.createElement('div');
  open = vi.fn();
  close = vi.fn();
  display = vi.fn();
}

// Export the mocks as the expected Obsidian API
export const TFile = MockTFile;
export const Plugin = MockPlugin;
export const Setting = MockSetting;
export const PluginSettingTab = MockPluginSettingTab;
export const Modal = MockModal;
