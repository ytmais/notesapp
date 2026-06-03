/**
 * Security Module — Proteksi XSS & Input Validation
 * Semua input pengguna WAJIB melewati modul ini sebelum ditampilkan atau disimpan.
 */

const Security = (() => {
  'use strict';

  // Map karakter berbahaya ke HTML entities
  const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;'
  };

  const ESCAPE_REGEX = /[&<>"'`/]/g;

  /**
   * Escape HTML special characters untuk mencegah XSS
   * @param {string} str - String yang akan di-sanitize
   * @returns {string} String yang sudah aman untuk ditampilkan di HTML
   */
  function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(ESCAPE_REGEX, (char) => ESCAPE_MAP[char] || char);
  }

  /**
   * Validasi panjang input
   * @param {string} str - String yang akan divalidasi
   * @param {number} maxLength - Panjang maksimum yang diizinkan
   * @returns {{ valid: boolean, message: string }}
   */
  function validateLength(str, maxLength = 10000) {
    if (typeof str !== 'string') {
      return { valid: false, message: 'Input harus berupa teks.' };
    }
    if (str.trim().length === 0) {
      return { valid: false, message: 'Input tidak boleh kosong.' };
    }
    if (str.length > maxLength) {
      return { valid: false, message: `Input terlalu panjang (maks ${maxLength} karakter).` };
    }
    return { valid: true, message: '' };
  }

  /**
   * Sanitize string lalu potong jika terlalu panjang
   * @param {string} str - String input
   * @param {number} maxLength - Panjang maksimum
   * @returns {string} String yang sudah aman dan dipotong
   */
  function cleanInput(str, maxLength = 10000) {
    if (typeof str !== 'string') return '';
    return sanitize(str.trim().slice(0, maxLength));
  }

  /**
   * Buat teks preview dari konten (potong + sanitize)
   * @param {string} content - Konten asli
   * @param {number} length - Panjang preview
   * @returns {string}
   */
  function preview(content, length = 120) {
    if (typeof content !== 'string') return '';
    const clean = content.trim();
    if (clean.length <= length) return sanitize(clean);
    return sanitize(clean.slice(0, length)) + '…';
  }

  return Object.freeze({
    sanitize,
    validateLength,
    cleanInput,
    preview
  });
})();
