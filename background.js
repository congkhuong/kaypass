/**
 * KayPass Background Service Worker (Manifest V3)
 * Includes Client-Side AES-256-GCM Crypto & Native Chrome Identity Google Drive Sync
 */

importScripts('js/crypto.js');

// Transient session memory (cleared when SW restarts or locked)
let masterPasswordSession = null;
let lockTimer = null;
const AUTO_LOCK_MINUTES = 15;

function resetLockTimer() {
  if (lockTimer) clearTimeout(lockTimer);
  if (masterPasswordSession) {
    lockTimer = setTimeout(() => {
      masterPasswordSession = null;
    }, AUTO_LOCK_MINUTES * 60 * 1000);
  }
}

// Storage keys
const STORAGE_KEY_ENCRYPTED_VAULT = 'kaypass_encrypted_vault';
const STORAGE_KEY_GOOGLE_USER = 'kaypass_google_user';
const STORAGE_KEY_GOOGLE_CLIENT_ID = 'kaypass_google_client_id';

async function getStoredVault() {
  const result = await chrome.storage.local.get(STORAGE_KEY_ENCRYPTED_VAULT);
  return result[STORAGE_KEY_ENCRYPTED_VAULT] || null;
}

async function saveStoredVault(encryptedPayload) {
  await chrome.storage.local.set({ [STORAGE_KEY_ENCRYPTED_VAULT]: encryptedPayload });
}

// Handle Messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse).catch(err => {
    sendResponse({ success: false, error: err.message });
  });
  return true;
});

async function handleMessage(request, sender) {
  resetLockTimer();

  switch (request.action) {
    case 'GET_STATUS': {
      const stored = await getStoredVault();
      return {
        success: true,
        isInitialized: !!stored,
        isUnlocked: !!masterPasswordSession
      };
    }

    case 'INITIALIZE': {
      const { masterPassword } = request;
      if (!masterPassword || masterPassword.length < 6) {
        throw new Error("Mật khẩu Master phải từ 6 ký tự trở lên!");
      }
      const existing = await getStoredVault();
      if (existing) {
        throw new Error("KayPass đã được khởi tạo từ trước!");
      }
      const initialVault = [];
      const encrypted = await KayCrypto.encrypt(initialVault, masterPassword);
      await saveStoredVault(encrypted);
      masterPasswordSession = masterPassword;
      return { success: true };
    }

    case 'UNLOCK': {
      const { masterPassword } = request;
      const stored = await getStoredVault();
      if (!stored) {
        throw new Error("KayPass chưa được khởi tạo!");
      }
      const vault = await KayCrypto.decrypt(stored, masterPassword);
      masterPasswordSession = masterPassword;
      return { success: true, count: vault.length };
    }

    case 'LOCK': {
      masterPasswordSession = null;
      if (lockTimer) clearTimeout(lockTimer);
      return { success: true };
    }

    case 'GET_ENTRIES': {
      if (!masterPasswordSession) throw new Error("Chưa đăng nhập KayPass!");
      const stored = await getStoredVault();
      const vault = await KayCrypto.decrypt(stored, masterPasswordSession);
      return { success: true, entries: vault };
    }

    case 'GET_ENTRIES_FOR_URL': {
      if (!masterPasswordSession) throw new Error("Chưa đăng nhập KayPass!");
      const stored = await getStoredVault();
      const vault = await KayCrypto.decrypt(stored, masterPasswordSession);
      const domain = KayCrypto.normalizeUrl(request.url);
      
      const matched = vault.filter(item => {
        const itemDomain = KayCrypto.normalizeUrl(item.url);
        return itemDomain.includes(domain) || domain.includes(itemDomain);
      });
      return { success: true, entries: matched };
    }

    case 'SAVE_ENTRY': {
      if (!masterPasswordSession) throw new Error("Chưa đăng nhập KayPass!");
      const { entry } = request;
      
      if (!entry.url || !entry.username || !entry.password) {
        throw new Error("URL, Tên đăng nhập và Mật khẩu không được để trống!");
      }

      const stored = await getStoredVault();
      const vault = await KayCrypto.decrypt(stored, masterPasswordSession);

      // Check URL/User uniqueness constraint
      const isDuplicate = KayCrypto.isDuplicateEntry(vault, entry.url, entry.username, entry.id);
      if (isDuplicate) {
        throw new Error(`Cặp URL/Tên đăng nhập ("${KayCrypto.normalizeUrl(entry.url)}" / "${entry.username}") đã tồn tại trong KayPass!`);
      }

      if (entry.id) {
        const index = vault.findIndex(e => e.id === entry.id);
        if (index !== -1) {
          vault[index] = { ...vault[index], ...entry, updatedAt: new Date().toISOString() };
        } else {
          vault.push({ ...entry, createdAt: new Date().toISOString() });
        }
      } else {
        const newEntry = {
          id: 'kp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          ...entry,
          createdAt: new Date().toISOString()
        };
        vault.push(newEntry);
      }

      const encrypted = await KayCrypto.encrypt(vault, masterPasswordSession);
      await saveStoredVault(encrypted);
      return { success: true };
    }

    case 'DELETE_ENTRY': {
      if (!masterPasswordSession) throw new Error("Chưa đăng nhập KayPass!");
      const { id } = request;
      const stored = await getStoredVault();
      const vault = await KayCrypto.decrypt(stored, masterPasswordSession);
      const updatedVault = vault.filter(e => e.id !== id);

      const encrypted = await KayCrypto.encrypt(updatedVault, masterPasswordSession);
      await saveStoredVault(encrypted);
      return { success: true };
    }

    case 'EXPORT_VAULT': {
      const stored = await getStoredVault();
      if (!stored) throw new Error("Chưa có dữ liệu để export!");
      
      const exportPackage = {
        app: "KayPass",
        version: "1.1.0",
        exportedAt: new Date().toISOString(),
        encryptedData: stored
      };

      return { success: true, exportJson: JSON.stringify(exportPackage, null, 2) };
    }

    case 'IMPORT_VAULT': {
      if (!masterPasswordSession) throw new Error("Chưa đăng nhập KayPass!");
      const { importJson } = request;
      let parsed;
      try {
        parsed = JSON.parse(importJson);
      } catch (e) {
        throw new Error("Tệp sao lưu không đúng định dạng JSON!");
      }

      const encryptedPayload = parsed.encryptedData || parsed;
      let importedVault;
      try {
        importedVault = await KayCrypto.decrypt(encryptedPayload, masterPasswordSession);
      } catch (e) {
        throw new Error("Không thể giải mã dữ liệu nhập vào! Mật khẩu Master không trùng khớp.");
      }

      const stored = await getStoredVault();
      const currentVault = await KayCrypto.decrypt(stored, masterPasswordSession);

      let addedCount = 0;
      let skippedCount = 0;

      for (const item of importedVault) {
        const isDup = KayCrypto.isDuplicateEntry(currentVault, item.url, item.username);
        if (!isDup) {
          currentVault.push({
            ...item,
            id: 'kp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      const encrypted = await KayCrypto.encrypt(currentVault, masterPasswordSession);
      await saveStoredVault(encrypted);

      return { success: true, addedCount, skippedCount };
    }

    case 'SYNC_THIRD_PARTY': {
      const { endpointUrl, customHeaders } = request;
      if (!endpointUrl) throw new Error("Vui lòng cung cấp URL bên thứ ba!");

      const stored = await getStoredVault();
      if (!stored) throw new Error("Chưa có dữ liệu để đồng bộ!");

      const payload = {
        app: "KayPass",
        timestamp: new Date().toISOString(),
        encryptedVault: stored
      };

      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(customHeaders || {}) },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Đã gửi dữ liệu mã hóa nhưng server báo lỗi: HTTP ${res.status}`);
      }

      return { success: true, status: res.status };
    }

    // --- GOOGLE DRIVE INTEGRATION ---
    case 'GOOGLE_DRIVE_LOGIN': {
      const { clientId } = request;
      if (clientId) {
        await chrome.storage.local.set({ [STORAGE_KEY_GOOGLE_CLIENT_ID]: clientId.trim() });
      }
      
      const token = await acquireGoogleToken(true);
      const userInfo = await getGoogleUserInfo(token);
      await chrome.storage.local.set({ 
        [STORAGE_KEY_GOOGLE_USER]: { ...userInfo, token } 
      });
      return { success: true, userInfo };
    }

    case 'GOOGLE_DRIVE_LOGOUT': {
      const result = await chrome.storage.local.get(STORAGE_KEY_GOOGLE_USER);
      if (result[STORAGE_KEY_GOOGLE_USER] && result[STORAGE_KEY_GOOGLE_USER].token) {
        try {
          await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token: result[STORAGE_KEY_GOOGLE_USER].token }, resolve));
        } catch (e) {}
      }
      await chrome.storage.local.remove(STORAGE_KEY_GOOGLE_USER);
      return { success: true };
    }

    case 'GET_GOOGLE_DRIVE_STATUS': {
      const result = await chrome.storage.local.get([STORAGE_KEY_GOOGLE_USER, STORAGE_KEY_GOOGLE_CLIENT_ID]);
      return { 
        success: true, 
        userInfo: result[STORAGE_KEY_GOOGLE_USER] || null,
        clientId: result[STORAGE_KEY_GOOGLE_CLIENT_ID] || '861545305575-1sgdbc7tl28dp417kglh29nqt9svsfgk.apps.googleusercontent.com'
      };
    }

    case 'GOOGLE_DRIVE_UPLOAD': {
      const stored = await getStoredVault();
      if (!stored) throw new Error("Chưa có dữ liệu để sao lưu!");

      const token = await acquireGoogleToken(true);
      const uploadPackage = {
        app: "KayPass",
        version: "1.1.0",
        uploadedAt: new Date().toISOString(),
        encryptedData: stored
      };

      const fileId = await findDriveVaultFile(token);
      const content = JSON.stringify(uploadPackage, null, 2);

      if (fileId) {
        const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: content
        });

        if (!updateRes.ok) {
          throw new Error(`Cập nhật file trên Google Drive thất bại: HTTP ${updateRes.status}`);
        }
      } else {
        const metadata = {
          name: 'kaypass_encrypted_vault.json',
          parents: ['appDataFolder']
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'application/json' }));

        const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: form
        });

        if (!createRes.ok) {
          throw new Error(`Tạo file trên Google Drive thất bại: HTTP ${createRes.status}`);
        }
      }

      return { success: true, uploadedAt: uploadPackage.uploadedAt };
    }

    case 'GOOGLE_DRIVE_DOWNLOAD': {
      if (!masterPasswordSession) throw new Error("Vui lòng mở khóa KayPass trước khi tải sao lưu từ Google Drive!");

      const token = await acquireGoogleToken(true);
      const fileId = await findDriveVaultFile(token);

      if (!fileId) {
        throw new Error("Không tìm thấy bản sao lưu nào trên Google Drive của bạn!");
      }

      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!downloadRes.ok) {
        throw new Error(`Tải tệp từ Google Drive thất bại: HTTP ${downloadRes.status}`);
      }

      const fileText = await downloadRes.text();
      return await handleMessage({ action: 'IMPORT_VAULT', importJson: fileText }, sender);
    }

    default:
      throw new Error(`Hành động không xác định: ${request.action}`);
  }
}

// Google Auth Helpers
async function acquireGoogleToken(interactive = true) {
  // First check if token is cached in chrome.storage.local
  const userResult = await chrome.storage.local.get(STORAGE_KEY_GOOGLE_USER);
  if (userResult[STORAGE_KEY_GOOGLE_USER] && userResult[STORAGE_KEY_GOOGLE_USER].token) {
    return userResult[STORAGE_KEY_GOOGLE_USER].token;
  }

  // Primary: Native getAuthToken (Works directly when manifest.json oauth2.client_id matches Extension ID)
  try {
    return await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!token) {
          reject(new Error("Không lấy được Auth Token từ Google."));
        } else {
          resolve(token);
        }
      });
    });
  } catch (err) {
    // Secondary fallback: WebAuthFlow if user supplied custom Client ID
    const clientIdResult = await chrome.storage.local.get(STORAGE_KEY_GOOGLE_CLIENT_ID);
    const customClientId = clientIdResult[STORAGE_KEY_GOOGLE_CLIENT_ID];
    if (customClientId) {
      return await acquireTokenViaWebAuthFlow(customClientId, interactive);
    }
    throw err;
  }
}

function acquireTokenViaWebAuthFlow(clientId, interactive) {
  return new Promise((resolve, reject) => {
    const redirectUri = chrome.identity.getRedirectURL();
    const scopes = [
      'https://www.googleapis.com/auth/drive.appdata',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}`;

    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: interactive
    }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(`OAuth WebAuthFlow lỗi: ${chrome.runtime.lastError.message}`));
      }
      if (!redirectUrl) {
        return reject(new Error("Người dùng đã hủy đăng nhập Google."));
      }
      const hash = new URL(redirectUrl).hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      if (token) {
        resolve(token);
      } else {
        const error = params.get('error') || 'Không tìm thấy access token';
        reject(new Error(`Đăng nhập Google thất bại: ${error}`));
      }
    });
  });
}

async function getGoogleUserInfo(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Không thể lấy thông tin tài khoản Google.");
  return await res.json();
}

async function findDriveVaultFile(token) {
  const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='kaypass_encrypted_vault.json' and trashed=false`;
  const res = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Lỗi tìm tệp trên Google Drive: HTTP ${res.status}`);
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}
