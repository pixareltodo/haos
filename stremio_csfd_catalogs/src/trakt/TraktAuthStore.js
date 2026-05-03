import path from 'node:path';
import { readJson, writeJsonAtomic } from '../utils/fileUtils.js';

function emptyState() {
  return {
    device: null,
    token: null,
    updatedAt: null
  };
}

export class TraktAuthStore {
  constructor(cacheDir) {
    this.filePath = path.join(cacheDir, 'trakt-auth.json');
  }

  async read() {
    return await readJson(this.filePath, emptyState()) || emptyState();
  }

  async write(state) {
    await writeJsonAtomic(this.filePath, {
      ...emptyState(),
      ...state,
      updatedAt: new Date().toISOString()
    });
  }

  async saveDevice(device) {
    const state = await this.read();
    await this.write({
      ...state,
      device
    });
  }

  async saveToken(token) {
    const state = await this.read();
    await this.write({
      ...state,
      token,
      device: null
    });
  }
}
