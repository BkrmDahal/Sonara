/**
 * Sonara - Storage Manager
 * Handles Chrome Storage API operations for bookmarks, tags, and settings
 */

class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'sonara_data';
    this.defaultData = {
      bookmarks: [],
      tags: [],
      settings: {
        ttsVoice: 'default',
        ttsSpeed: 1.0,
        autoExtract: true,
        openaiApiKey: '',
        openaiVoice: 'coral'
      }
    };
  }

  // Get all data
  async getAllData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEY], (result) => {
        const data = result[this.STORAGE_KEY] || this.defaultData;
        resolve(data);
      });
    });
  }

  // Save all data
  async saveAllData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: data }, () => {
        resolve();
      });
    });
  }

  // Get bookmarks
  async getBookmarks() {
    const data = await this.getAllData();
    return data.bookmarks || [];
  }

  // Save bookmark
  async saveBookmark(bookmark) {
    const data = await this.getAllData();
    if (!bookmark.id) {
      bookmark.id = this.generateId();
    }
    if (!bookmark.savedAt) {
      bookmark.savedAt = Date.now();
    }
    
    // Check if bookmark already exists (by URL)
    const existingIndex = data.bookmarks.findIndex(b => b.url === bookmark.url);
    if (existingIndex >= 0) {
      data.bookmarks[existingIndex] = { ...data.bookmarks[existingIndex], ...bookmark };
    } else {
      data.bookmarks.push(bookmark);
    }

    // Update tags list
    if (bookmark.tags && bookmark.tags.length > 0) {
      bookmark.tags.forEach(tag => {
        if (!data.tags.includes(tag)) {
          data.tags.push(tag);
        }
      });
    }

    await this.saveAllData(data);
    return bookmark;
  }

  // Delete bookmark
  async deleteBookmark(bookmarkId) {
    const data = await this.getAllData();
    data.bookmarks = data.bookmarks.filter(b => b.id !== bookmarkId);
    await this.saveAllData(data);
  }

  // Get tags
  async getTags() {
    const data = await this.getAllData();
    return data.tags || [];
  }

  // Search bookmarks
  async searchBookmarks(query) {
    const bookmarks = await this.getBookmarks();
    const lowerQuery = query.toLowerCase();
    return bookmarks.filter(bookmark => 
      bookmark.title?.toLowerCase().includes(lowerQuery) ||
      bookmark.url?.toLowerCase().includes(lowerQuery) ||
      bookmark.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // Filter bookmarks by tag
  async filterByTag(tag) {
    const bookmarks = await this.getBookmarks();
    return bookmarks.filter(bookmark => 
      bookmark.tags && bookmark.tags.includes(tag)
    );
  }

  // Archive / unarchive
  async archiveBookmark(bookmarkId) {
    const data = await this.getAllData();
    const b = data.bookmarks.find(x => x.id === bookmarkId);
    if (b) {
      b.archived = true;
      b.archivedAt = Date.now();
      await this.saveAllData(data);
    }
  }

  async unarchiveBookmark(bookmarkId) {
    const data = await this.getAllData();
    const b = data.bookmarks.find(x => x.id === bookmarkId);
    if (b) {
      b.archived = false;
      b.archivedAt = undefined;
      await this.saveAllData(data);
    }
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get settings
  async getSettings() {
    const data = await this.getAllData();
    return data.settings || this.defaultData.settings;
  }

  // Save settings
  async saveSettings(settings) {
    const data = await this.getAllData();
    data.settings = { ...data.settings, ...settings };
    await this.saveAllData(data);
  }
}

// Export singleton instance
const storageManager = new StorageManager();
