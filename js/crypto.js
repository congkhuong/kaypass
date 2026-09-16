/**
 * KayPass Crypto Utility (Web Crypto API)
 * Zero-Knowledge Client-Side Encryption using PBKDF2 & AES-256-GCM
 */

const KayCrypto = {
  // Convert ArrayBuffer / Uint8Array to Base64
  bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  // Convert Base64 to Uint8Array
  base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  // Generate random bytes (Salt/IV)
  getRandomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  },

  // Derive AES-GCM CryptoKey using PBKDF2
  async deriveKey(masterPassword, saltBytes) {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(masterPassword);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /**
   * Encrypt javascript object into encrypted payload format
   * @param {Object|Array} data 
   * @param {string} masterPassword 
   * @returns {Promise<{salt: string, iv: string, ciphertext: string, v: number}>}
   */
  async encrypt(data, masterPassword) {
    const salt = this.getRandomBytes(16);
    const iv = this.getRandomBytes(12);
    const key = await this.deriveKey(masterPassword, salt);

    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(jsonString);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );

    return {
      v: 1,
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      ciphertext: this.bufferToBase64(ciphertextBuffer)
    };
  },

  /**
   * Decrypt encrypted payload back into javascript object
   * @param {Object} encryptedPayload 
   * @param {string} masterPassword 
   * @returns {Promise<Object|Array>}
   */
  async decrypt(encryptedPayload, masterPassword) {
    if (!encryptedPayload || !encryptedPayload.salt || !encryptedPayload.iv || !encryptedPayload.ciphertext) {
      throw new Error("Invalid encrypted payload structure");
    }

    const salt = this.base64ToBuffer(encryptedPayload.salt);
    const iv = this.base64ToBuffer(encryptedPayload.iv);
    const ciphertext = this.base64ToBuffer(encryptedPayload.ciphertext);

    const key = await this.deriveKey(masterPassword, salt);

    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedBuffer);
      return JSON.parse(jsonString);
    } catch (err) {
      throw new Error("Mật khẩu Master không chính xác hoặc dữ liệu bị lỗi!");
    }
  },

  /**
   * Normalize URL to hostname/domain for standard comparison
   * e.g. "https://sub.example.com/login?ref=1" -> "sub.example.com"
   */
  normalizeUrl(rawUrl) {
    if (!rawUrl) return '';
    let url = rawUrl.trim().toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
      return url.replace(/^www\./, '');
    }
  },

  /**
   * Check if pair (url, username) already exists in entries array
   * @param {Array} entries 
   * @param {string} url 
   * @param {string} username 
   * @param {string} [excludeId] - ID of current entry if updating
   * @returns {boolean}
   */
  isDuplicateEntry(entries, url, username, excludeId = null) {
    const targetDomain = this.normalizeUrl(url);
    const targetUser = (username || '').trim().toLowerCase();

    return entries.some(item => {
      if (excludeId && item.id === excludeId) return false;
      const itemDomain = this.normalizeUrl(item.url);
      const itemUser = (item.username || '').trim().toLowerCase();
      return itemDomain === targetDomain && itemUser === targetUser;
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = KayCrypto;
}
