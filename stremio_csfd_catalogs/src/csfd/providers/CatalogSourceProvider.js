export class CatalogSourceProvider {
  constructor(options = {}) {
    this.options = options;
  }

  async loadItems() {
    throw new Error('loadItems() must be implemented by derived providers.');
  }
}
