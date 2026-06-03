/**
 * Database Module — IndexedDB Wrapper
 * Menyediakan API sederhana berbasis Promise untuk operasi CRUD catatan.
 */

class NotesDB {
  constructor(dbName = 'NotesAppDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.storeName = 'notes';
    this.db = null;
  }

  /**
   * Inisialisasi database dan buat object store jika belum ada
   * @returns {Promise<void>}
   */
  init() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: false
          });
          // Index untuk sorting & filtering
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(new Error('Gagal membuka database: ' + event.target.error));
      };
    });
  }

  /**
   * Helper: buat transaction dan object store
   * @param {string} mode - 'readonly' atau 'readwrite'
   * @returns {IDBObjectStore}
   */
  _getStore(mode) {
    const tx = this.db.transaction(this.storeName, mode);
    return tx.objectStore(this.storeName);
  }

  /**
   * Helper: bungkus IDBRequest menjadi Promise
   * @param {IDBRequest} request
   * @returns {Promise<any>}
   */
  _promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generate unique ID
   * @returns {string}
   */
  _generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  /**
   * Tambah catatan baru
   * @param {{ title: string, content: string, category: string }} noteData
   * @returns {Promise<object>} Catatan yang sudah disimpan
   */
  async add(noteData) {
    const now = new Date().toISOString();
    const note = {
      id: this._generateId(),
      title: noteData.title || '',
      content: noteData.content || '',
      category: noteData.category || 'umum',
      createdAt: now,
      updatedAt: now
    };

    const store = this._getStore('readwrite');
    await this._promisify(store.add(note));
    return note;
  }

  /**
   * Ambil satu catatan berdasarkan ID
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async get(id) {
    const store = this._getStore('readonly');
    return this._promisify(store.get(id));
  }

  /**
   * Ambil semua catatan, diurutkan dari terbaru
   * @returns {Promise<object[]>}
   */
  async getAll() {
    const store = this._getStore('readonly');
    const notes = await this._promisify(store.getAll());
    // Sort terbaru di atas
    return notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Update catatan
   * @param {string} id - ID catatan
   * @param {{ title?: string, content?: string, category?: string }} updates
   * @returns {Promise<object>} Catatan yang sudah diupdate
   */
  async update(id, updates) {
    const note = await this.get(id);
    if (!note) {
      throw new Error('Catatan tidak ditemukan.');
    }

    const updatedNote = {
      ...note,
      ...updates,
      id: note.id, // ID tidak boleh berubah
      createdAt: note.createdAt, // Waktu pembuatan tidak berubah
      updatedAt: new Date().toISOString()
    };

    const store = this._getStore('readwrite');
    await this._promisify(store.put(updatedNote));
    return updatedNote;
  }

  /**
   * Hapus catatan
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const store = this._getStore('readwrite');
    return this._promisify(store.delete(id));
  }

  /**
   * Cari catatan berdasarkan keyword di judul atau isi
   * @param {string} query - Kata kunci pencarian
   * @returns {Promise<object[]>}
   */
  async search(query) {
    const all = await this.getAll();
    if (!query || query.trim() === '') return all;

    const q = query.toLowerCase().trim();
    return all.filter(note =>
      note.title.toLowerCase().includes(q) ||
      note.content.toLowerCase().includes(q)
    );
  }

  /**
   * Filter catatan berdasarkan kategori
   * @param {string} category
   * @returns {Promise<object[]>}
   */
  async filterByCategory(category) {
    const all = await this.getAll();
    if (!category || category === 'semua') return all;
    return all.filter(note => note.category === category);
  }

  /**
   * Hitung total catatan
   * @returns {Promise<number>}
   */
  async count() {
    const store = this._getStore('readonly');
    return this._promisify(store.count());
  }
}
