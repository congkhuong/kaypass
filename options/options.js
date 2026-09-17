/**
 * KayPass Options & Backup Manager Logic
 * Includes Dynamic Client ID Google OAuth & Drive REST Sync Handlers
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Google Drive Elements
  const gdriveClientIdInput = document.getElementById('gdrive-client-id');
  const gdriveLoggedOut = document.getElementById('gdrive-logged-out');
  const gdriveLoggedIn = document.getElementById('gdrive-logged-in');
  const btnGdriveLogin = document.getElementById('btn-gdrive-login');
  const btnGdriveLogout = document.getElementById('btn-gdrive-logout');
  const gdriveAvatar = document.getElementById('gdrive-avatar');
  const gdriveName = document.getElementById('gdrive-name');
  const gdriveEmail = document.getElementById('gdrive-email');
  const btnGdriveUpload = document.getElementById('btn-gdrive-upload');
  const btnGdriveDownload = document.getElementById('btn-gdrive-download');
  const gdriveStatus = document.getElementById('gdrive-status');

  // Third Party Webhook Elements
  const syncEndpointInput = document.getElementById('sync-endpoint');
  const syncHeadersInput = document.getElementById('sync-headers');
  const btnTriggerSync = document.getElementById('btn-trigger-sync');
  const syncStatus = document.getElementById('sync-status');

  // File Backup Elements
  const btnExportFile = document.getElementById('btn-export-file');
  const importFileInput = document.getElementById('import-file-input');
  const btnTriggerImport = document.getElementById('btn-trigger-import');
  const importStatus = document.getElementById('import-status');

  const redirectUriText = document.getElementById('redirect-uri-text');
  const btnCopyRedirectUri = document.getElementById('btn-copy-redirect-uri');

  // Compute and display Chrome Extension Redirect URI
  const actualRedirectUri = chrome.identity.getRedirectURL();
  if (redirectUriText) redirectUriText.textContent = actualRedirectUri;

  if (btnCopyRedirectUri) {
    btnCopyRedirectUri.addEventListener('click', () => {
      navigator.clipboard.writeText(actualRedirectUri);
      const orig = btnCopyRedirectUri.textContent;
      btnCopyRedirectUri.textContent = 'Đã Copy!';
      setTimeout(() => btnCopyRedirectUri.textContent = orig, 1500);
    });
  }

  const btnSaveClientId = document.getElementById('btn-save-client-id');
  if (btnSaveClientId) {
    btnSaveClientId.addEventListener('click', async () => {
      const clientId = gdriveClientIdInput.value.trim();
      if (!clientId) {
        showStatus(gdriveStatus, 'error', 'Vui lòng nhập Google Client ID!');
        return;
      }
      try {
        const res = await chrome.runtime.sendMessage({ action: 'SAVE_GOOGLE_CLIENT_ID', clientId });
        if (res.success) {
          showStatus(gdriveStatus, 'success', '✅ Đã lưu Google Client ID thành công!');
        } else {
          showStatus(gdriveStatus, 'error', res.error);
        }
      } catch (e) {
        showStatus(gdriveStatus, 'error', e.message);
      }
    });
  }

  // Load saved Client ID and Google Status
  await checkGoogleDriveStatus();

  // Load saved Webhook sync config
  const saved = await chrome.storage.local.get(['kaypass_sync_endpoint', 'kaypass_sync_headers']);
  if (saved.kaypass_sync_endpoint) syncEndpointInput.value = saved.kaypass_sync_endpoint;
  if (saved.kaypass_sync_headers) syncHeadersInput.value = saved.kaypass_sync_headers;

  // --- 1. GOOGLE DRIVE HANDLERS ---
  async function checkGoogleDriveStatus() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'GET_GOOGLE_DRIVE_STATUS' });
      if (res.clientId) {
        gdriveClientIdInput.value = res.clientId;
      }
      if (res.success && res.userInfo) {
        renderGoogleUser(res.userInfo);
      } else {
        renderGoogleLoggedOut();
      }
    } catch (e) {
      renderGoogleLoggedOut();
    }
  }

  function renderGoogleUser(userInfo) {
    gdriveAvatar.src = userInfo.picture || 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    gdriveName.textContent = userInfo.name || 'Tài khoản Google';
    gdriveEmail.textContent = userInfo.email || '';
    gdriveLoggedOut.classList.add('hidden');
    gdriveLoggedIn.classList.remove('hidden');
  }

  function renderGoogleLoggedOut() {
    gdriveLoggedOut.classList.remove('hidden');
    gdriveLoggedIn.classList.add('hidden');
  }

  btnGdriveLogin.addEventListener('click', async () => {
    hideStatus(gdriveStatus);

    const clientId = gdriveClientIdInput.value.trim();

    btnGdriveLogin.disabled = true;
    btnGdriveLogin.textContent = '⏳ Đang đăng nhập Google...';

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'GOOGLE_DRIVE_LOGIN',
        clientId: clientId
      });

      if (res.success) {
        renderGoogleUser(res.userInfo);
        showStatus(gdriveStatus, 'success', `✅ Đăng nhập Google thành công: ${res.userInfo.email}`);
      } else {
        showStatus(gdriveStatus, 'error', `❌ Đăng nhập thất bại: ${res.error}`);
      }
    } catch (e) {
      showStatus(gdriveStatus, 'error', `❌ Lỗi xác thực Google: ${e.message}`);
    } finally {
      btnGdriveLogin.disabled = false;
      btnGdriveLogin.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg> Kết nối Tài khoản Google`;
    }
  });

  btnGdriveLogout.addEventListener('click', async () => {
    hideStatus(gdriveStatus);
    await chrome.runtime.sendMessage({ action: 'GOOGLE_DRIVE_LOGOUT' });
    renderGoogleLoggedOut();
    showStatus(gdriveStatus, 'info', 'Đã đăng xuất Google.');
  });

  btnGdriveUpload.addEventListener('click', async () => {
    hideStatus(gdriveStatus);
    btnGdriveUpload.disabled = true;
    btnGdriveUpload.textContent = '⏳ Đang sao lưu lên Google Drive...';

    try {
      const res = await chrome.runtime.sendMessage({ action: 'GOOGLE_DRIVE_UPLOAD' });
      if (res.success) {
        const timeStr = new Date(res.uploadedAt).toLocaleTimeString('vi-VN');
        showStatus(gdriveStatus, 'success', `✅ Đã sao lưu thành công lúc ${timeStr}! Tệp mã hóa "KayPass_Encrypted_Backup.json" đã xuất hiện ngay tại trang chính Drive của tôi (https://drive.google.com/).`);
      } else {
        showStatus(gdriveStatus, 'error', `❌ Sao lưu thất bại: ${res.error}`);
      }
    } catch (e) {
      showStatus(gdriveStatus, 'error', `❌ Lỗi: ${e.message}`);
    } finally {
      btnGdriveUpload.disabled = false;
      btnGdriveUpload.textContent = '☁️ Sao lưu ngay lên Google Drive';
    }
  });

  btnGdriveDownload.addEventListener('click', async () => {
    hideStatus(gdriveStatus);
    btnGdriveDownload.disabled = true;
    btnGdriveDownload.textContent = '⏳ Đang tải bản sao lưu...';

    try {
      const res = await chrome.runtime.sendMessage({ action: 'GOOGLE_DRIVE_DOWNLOAD' });
      if (res.success) {
        showStatus(gdriveStatus, 'success', `✅ Đã khôi phục thành công ${res.addedCount} tài khoản từ Google Drive! (Bỏ qua ${res.skippedCount} tài khoản đã tồn tại).`);
      } else {
        showStatus(gdriveStatus, 'error', `❌ Khôi phục thất bại: ${res.error}`);
      }
    } catch (e) {
      showStatus(gdriveStatus, 'error', `❌ Lỗi: ${e.message}`);
    } finally {
      btnGdriveDownload.disabled = false;
      btnGdriveDownload.textContent = '📥 Tải bản sao lưu từ Google Drive';
    }
  });

  // --- 2. THIRD PARTY WEBHOOK HANDLERS ---
  btnTriggerSync.addEventListener('click', async () => {
    hideStatus(syncStatus);
    const endpoint = syncEndpointInput.value.trim();
    const headersStr = syncHeadersInput.value.trim();

    if (!endpoint) {
      showStatus(syncStatus, 'error', 'Vui lòng nhập URL Endpoint!');
      return;
    }

    let headers = {};
    if (headersStr) {
      try {
        headers = JSON.parse(headersStr);
      } catch (e) {
        showStatus(syncStatus, 'error', 'Custom Headers phải đúng định dạng JSON!');
        return;
      }
    }

    await chrome.storage.local.set({
      kaypass_sync_endpoint: endpoint,
      kaypass_sync_headers: headersStr
    });

    btnTriggerSync.disabled = true;
    btnTriggerSync.textContent = '⏳ Đang gửi dữ liệu...';

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'SYNC_THIRD_PARTY',
        endpointUrl: endpoint,
        customHeaders: headers
      });

      if (res.success) {
        showStatus(syncStatus, 'success', `✅ Đã gửi thành công tệp mã hóa AES-256 sang Webhook! (Status: ${res.status})`);
      } else {
        showStatus(syncStatus, 'error', `❌ Gửi thất bại: ${res.error}`);
      }
    } catch (e) {
      showStatus(syncStatus, 'error', `❌ Lỗi kết nối: ${e.message}`);
    } finally {
      btnTriggerSync.disabled = false;
      btnTriggerSync.textContent = '🚀 Mã hóa & Gửi dữ liệu tới Webhook';
    }
  });

  // --- 3. EXPORT & IMPORT FILE HANDLERS ---
  btnExportFile.addEventListener('click', async () => {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'EXPORT_VAULT' });
      if (res.success) {
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `KayPass_Encrypted_Backup_${dateStr}.json`;
        downloadBlob(res.exportJson, filename, 'application/json');
      } else {
        alert('Không thể xuất dữ liệu: ' + res.error);
      }
    } catch (e) {
      alert('Đã xảy ra lỗi khi xuất file: ' + e.message);
    }
  });

  importFileInput.addEventListener('change', async (e) => {
    hideStatus(importStatus);
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const fileContent = evt.target.result;
      
      btnTriggerImport.disabled = true;
      btnTriggerImport.textContent = '⏳ Đang xử lý tệp...';

      try {
        const res = await chrome.runtime.sendMessage({
          action: 'IMPORT_VAULT',
          importJson: fileContent
        });

        if (res.success) {
          showStatus(importStatus, 'success', `✅ Đã nhập thành công ${res.addedCount} tài khoản mới! (Bỏ qua ${res.skippedCount} tài khoản bị trùng).`);
        } else {
          showStatus(importStatus, 'error', `❌ Nhập thất bại: ${res.error}`);
        }
      } catch (err) {
        showStatus(importStatus, 'error', `❌ Lỗi: ${err.message}`);
      } finally {
        btnTriggerImport.disabled = false;
        btnTriggerImport.textContent = '📤 Chọn tệp JSON để nhập';
        importFileInput.value = '';
      }
    };

    reader.readAsText(file);
  });

  // Helpers
  function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showStatus(el, type, msg) {
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideStatus(el) {
    el.classList.add('hidden');
  }
});
