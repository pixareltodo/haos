import { pathExists, readJson, writeJsonAtomic } from '../utils/fileUtils.js';
import {
  DEFAULTS,
  normalizeAddonOptions,
  resolveAddonOptionsSource
} from './loadAddonOptions.js';

export class AddonConfigStore {
  constructor() {
    this.source = resolveAddonOptionsSource();
  }

  get optionsFile() {
    return this.source.optionsFile;
  }

  async readRawOptions() {
    if (await pathExists(this.optionsFile)) {
      return await readJson(this.optionsFile, {}) || {};
    }

    return {};
  }

  async readNormalizedOptions() {
    return normalizeAddonOptions(await this.readRawOptions(), this.source);
  }

  async writeRawOptions(rawOptions) {
    const nextRaw = {
      ...DEFAULTS,
      ...rawOptions
    };

    delete nextRaw.addon_version;
    delete nextRaw.addon_build_signature;
    delete nextRaw.projectRoot;
    delete nextRaw.cacheDir;
    delete nextRaw.shareDir;

    await writeJsonAtomic(this.optionsFile, nextRaw);
    return this.readNormalizedOptions();
  }
}
