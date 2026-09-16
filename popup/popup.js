/**
 * KayPass Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const headerActions = document.getElementById('header-actions');
  const btnLock = document.getElementById('btn-lock');
  const btnOpenOptions = document.getElementById('btn-open-options');

  // Views
  const viewAuth = document.getElementById('view-auth');
  const viewVault = document.getElementById('view-vault');
  const modalForm = document.getElementById('modal-form');

  // Auth Subforms
  const authSetupForm = document.getElementById('auth-setup-form');
  const authUnlockForm = document.getElementById('auth-unlock-form');
  const authError = document.getElementById('auth-error');

  const setupPassword = document.getElementById('setup-password');
  const setupConfirm = document.getElementById('setup-confirm');
  const btnSubmitSetup = document.getElementById('btn-submit-setup');

  const unlockPassword = document.getElementById('unlock-password');
  const btnSubmitUnlock = document.getElementById('btn-submit-unlock');

  // Vault Elements
  const currentDomainText = document.getElementById('current-domain-text');
  const btnAutofillCurrent = document.getElementById('btn-autofill-current');
  const searchInput = document.getElementById('search-input');
  const btnShowAddForm = document.getElementById('btn-show-add-form');
  const tabCurrent = document.getElementById('tab-current');
  const tabAll = document.getElementById('tab-all');
  const allCount = document.getElementById('all-count');
  const credentialsList = document.getElementById('credentials-list');
  const emptyState = document.getElementById('empty-state');
  const emptyMsg = document.getElementById('empty-msg');
  const btnAddForSite = document.getElementById('btn-add-for-site');

  // Form Modal Elements
  const modalTitle = document.getElementById('modal-title');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const entryForm = document.getElementById('entry-form');
  const entryId = document.getElementById('entry-id');
  const formTitle = document.getElementById('form-title');
  const formUrl = document.getElementById('form-url');
  const formUsername = document.getElementById('form-username');
  const formPassword = document.getElementById('form-password');
  const formNotes = document.getElementById('form-notes');
  const formError = document.getElementById('form-error');
  const btnTogglePwdVis = document.getElementById('btn-toggle-pwd-vis');
  const btnToggleGenerator = document.getElementById('btn-toggle-generator');

  // Generator Controls
  const generatorPanel = document.getElementById('generator-panel');
  const genPreview = document.getElementById('gen-preview');
  const genLength = document.getElementById('gen-length');
  const lenVal = document.getElementById('len-val');
  const genUpper = document.getElementById('gen-upper');
  const genLower = document.getElementById('gen-lower');
  const genDigits = document.getElementById('gen-digits');
  const genSymbols = document.getElementById('gen-symbols');
  const btnApplyGenerated = document.getElementById('btn-apply-generated');

  // State
  let currentTabUrl = '';
  let currentDomain = '';
  let activeTabFilter = 'current'; // 'current' | 'all'
  let cachedVault = [];

  // Initialize
  await checkStatus();
  await getCurrentTabInfo();

  // Event Listeners
  btnSubmitSetup.addEventListener('click', handleSetup);
  btnSubmitUnlock.addEventListener('click', handleUnlock);

  unlockPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUnlock();
  });
  setupConfirm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSetup();
  });

  btnLock.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'LOCK' });
    showAuthView(true, false);
  });

  btnOpenOptions.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  tabCurrent.addEventListener('click', () => {
    activeTabFilter = 'current';
    tabCurrent.classList.add('active');
    tabAll.classList.remove('active');
    renderCredentials();
  });

  tabAll.addEventListener('click', () => {
    activeTabFilter = 'all';
    tabAll.classList.add('active');
    tabCurrent.classList.remove('active');
    renderCredentials();
  });

  searchInput.addEventListener('input', () => renderCredentials());

  btnShowAddForm.addEventListener('click', () => openAddModal());
  btnAddForSite.addEventListener('click', () => openAddModal(currentTabUrl));
  btnCloseModal.addEventListener('click', () => modalForm.classList.add('hidden'));
  btnCancelModal.addEventListener('click', () => modalForm.classList.add('hidden'));

  btnAutofillCurrent.addEventListener('click', () => {
    const siteMatches = getSiteEntries();
    if (siteMatches.length > 0) {
      triggerAutofill(siteMatches[0]);
    }
  });

  // Password Visibility Toggle
  btnTogglePwdVis.addEventListener('click', () => {
    formPassword.type = formPassword.type === 'password' ? 'text' : 'password';
  });

  // Generator Panel Toggle
  btnToggleGenerator.addEventListener('click', () => {
    generatorPanel.classList.toggle('hidden');
    if (!generatorPanel.classList.contains('hidden')) {
      updateGeneratorPreview();
    }
  });

  genLength.addEventListener('input', () => {
    lenVal.textContent = genLength.value;
    updateGeneratorPreview();
  });
  genUpper.addEventListener('change', updateGeneratorPreview);
  genLower.addEventListener('change', updateGeneratorPreview);
  genDigits.addEventListener('change', updateGeneratorPreview);
  genSymbols.addEventListener('change', updateGeneratorPreview);

  btnApplyGenerated.addEventListener('click', () => {
    formPassword.value = genPreview.textContent;
    formPassword.type = 'text';
    generatorPanel.classList.add('hidden');
  });

  entryForm.addEventListener('submit', handleSaveEntry);

  // Functions
  async function checkStatus() {
    const res = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
    if (!res.isInitialized) {
      showAuthView(false, true); // Setup mode
    } else if (!res.isUnlocked) {
      showAuthView(true, false); // Unlock mode
    } else {
      showVaultView();
    }
  }

  function showAuthView(isInitialized, isSetup) {
    viewAuth.classList.remove('hidden');
    viewVault.classList.add('hidden');
    headerActions.classList.add('hidden');
    authError.classList.add('hidden');

    if (isSetup) {
      authSetupForm.classList.remove('hidden');
      authUnlockForm.classList.add('hidden');
      setupPassword.focus();
    } else {
      authSetupForm.classList.add('hidden');
      authUnlockForm.classList.remove('hidden');
      unlockPassword.value = '';
      unlockPassword.focus();
    }
  }

  async function showVaultView() {
    viewAuth.classList.add('hidden');
    viewVault.classList.remove('hidden');
    headerActions.classList.remove('hidden');

    await loadVault();
  }

  async function getCurrentTabInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0] && tabs[0].url) {
        currentTabUrl = tabs[0].url;
        currentDomain = KayCrypto.normalizeUrl(currentTabUrl);
        currentDomainText.textContent = currentDomain || 'Trang local / Khác';
      }
    } catch (e) {
      currentDomainText.textContent = 'Trang web';
    }
  }

  async function loadVault() {
    const res = await chrome.runtime.sendMessage({ action: 'GET_ENTRIES' });
    if (res.success) {
      cachedVault = res.entries;
      allCount.textContent = cachedVault.length;
      renderCredentials();
    } else {
      showAuthView(true, false);
    }
  }

  function getSiteEntries() {
    if (!currentDomain) return [];
    return cachedVault.filter(e => {
      const dom = KayCrypto.normalizeUrl(e.url);
      return dom.includes(currentDomain) || currentDomain.includes(dom);
    });
  }

  function renderCredentials() {
    const query = searchInput.value.trim().toLowerCase();

    let items = activeTabFilter === 'current' ? getSiteEntries() : cachedVault;

    if (query) {
      items = items.filter(e => 
        (e.title || '').toLowerCase().includes(query) ||
        (e.url || '').toLowerCase().includes(query) ||
        (e.username || '').toLowerCase().includes(query)
      );
    }

    // Toggle Autofill Header Button
    const siteMatches = getSiteEntries();
    if (siteMatches.length > 0 && activeTabFilter === 'current') {
      btnAutofillCurrent.classList.remove('hidden');
    } else {
      btnAutofillCurrent.classList.add('hidden');
    }

    credentialsList.innerHTML = '';

    if (items.length === 0) {
      emptyState.classList.remove('hidden');
      emptyMsg.textContent = activeTabFilter === 'current'
        ? `Chưa có tài khoản nào được lưu cho ${currentDomain || 'trang này'}.`
        : 'Chưa có tài khoản nào trong KayPass.';
      return;
    }

    emptyState.classList.add('hidden');

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'cred-card';

      const domain = KayCrypto.normalizeUrl(item.url);

      card.innerHTML = `
        <div class="cred-header">
          <div class="cred-title-area">
            <span class="cred-title">${escapeHtml(item.title || domain)}</span>
            <span class="cred-domain">${escapeHtml(domain)}</span>
          </div>
          <div class="cred-actions">
            <button class="btn btn-xs btn-accent btn-autofill-single" title="Điền vào trang">⚡ Điền</button>
            <button class="icon-btn btn-edit-single" title="Chỉnh sửa">✏️</button>
            <button class="icon-btn danger btn-delete-single" title="Xóa">🗑️</button>
          </div>
        </div>
        <div class="cred-body">
          <div class="cred-row">
            <span class="cred-val">${escapeHtml(item.username)}</span>
            <button class="copy-btn copy-user">Copy User</button>
          </div>
          <div class="cred-row">
            <span class="cred-val pwd-masked">••••••••••••</span>
            <button class="copy-btn copy-pass">Copy Pass</button>
          </div>
        </div>
      `;

      // Handlers
      card.querySelector('.btn-autofill-single').addEventListener('click', () => triggerAutofill(item));
      card.querySelector('.btn-edit-single').addEventListener('click', () => openEditModal(item));
      card.querySelector('.btn-delete-single').addEventListener('click', () => handleDelete(item.id, item.username));

      card.querySelector('.copy-user').addEventListener('click', (e) => {
        navigator.clipboard.writeText(item.username);
        showToast(e.target, 'Đã copy!');
      });

      card.querySelector('.copy-pass').addEventListener('click', (e) => {
        navigator.clipboard.writeText(item.password);
        showToast(e.target, 'Đã copy!');
      });

      credentialsList.appendChild(card);
    });
  }

  async function triggerAutofill(item) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0]) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'AUTOFILL_CREDENTIALS',
          username: item.username,
          password: item.password
        });
        if (response && response.success) {
          showToast(btnAutofillCurrent, 'Đã điền thành công!');
        } else {
          alert('Không tìm thấy form đăng nhập thích hợp trên trang này!');
        }
      }
    } catch (e) {
      alert('Không thể kết nối với trang hiện tại. Vui lòng làm mới trang (F5)!');
    }
  }

  async function handleSetup() {
    const pass = setupPassword.value;
    const confirm = setupConfirm.value;

    if (!pass || pass.length < 6) {
      showError(authError, 'Mật khẩu phải từ 6 ký tự trở lên!');
      return;
    }
    if (pass !== confirm) {
      showError(authError, 'Xác nhận mật khẩu không trùng khớp!');
      return;
    }

    const res = await chrome.runtime.sendMessage({
      action: 'INITIALIZE',
      masterPassword: pass
    });

    if (res.success) {
      showVaultView();
    } else {
      showError(authError, res.error);
    }
  }

  async function handleUnlock() {
    const pass = unlockPassword.value;
    if (!pass) return;

    const res = await chrome.runtime.sendMessage({
      action: 'UNLOCK',
      masterPassword: pass
    });

    if (res.success) {
      showVaultView();
    } else {
      showError(authError, res.error);
    }
  }

  function openAddModal(defaultUrl = '') {
    modalTitle.textContent = 'Thêm tài khoản mới';
    entryId.value = '';
    formTitle.value = currentDomain ? `Tài khoản ${currentDomain}` : '';
    formUrl.value = defaultUrl || currentTabUrl || '';
    formUsername.value = '';
    formPassword.value = '';
    formNotes.value = '';
    formError.classList.add('hidden');
    generatorPanel.classList.add('hidden');
    modalForm.classList.remove('hidden');
    formUsername.focus();
  }

  function openEditModal(item) {
    modalTitle.textContent = 'Chỉnh sửa tài khoản';
    entryId.value = item.id;
    formTitle.value = item.title || '';
    formUrl.value = item.url || '';
    formUsername.value = item.username || '';
    formPassword.value = item.password || '';
    formNotes.value = item.notes || '';
    formError.classList.add('hidden');
    generatorPanel.classList.add('hidden');
    modalForm.classList.remove('hidden');
  }

  async function handleSaveEntry(e) {
    e.preventDefault();
    formError.classList.add('hidden');

    const entry = {
      id: entryId.value || null,
      title: formTitle.value.trim(),
      url: formUrl.value.trim(),
      username: formUsername.value.trim(),
      password: formPassword.value,
      notes: formNotes.value.trim()
    };

    // Check unique pair constraint (URL + Username)
    const isDup = KayCrypto.isDuplicateEntry(cachedVault, entry.url, entry.username, entry.id);
    if (isDup) {
      showError(formError, `Cặp URL "${KayCrypto.normalizeUrl(entry.url)}" và Username "${entry.username}" đã tồn tại! Mỗi tài khoản theo URL phải duy nhất.`);
      return;
    }

    const res = await chrome.runtime.sendMessage({
      action: 'SAVE_ENTRY',
      entry: entry
    });

    if (res.success) {
      modalForm.classList.add('hidden');
      await loadVault();
    } else {
      showError(formError, res.error);
    }
  }

  async function handleDelete(id, username) {
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}" không?`)) {
      const res = await chrome.runtime.sendMessage({
        action: 'DELETE_ENTRY',
        id: id
      });
      if (res.success) {
        await loadVault();
      } else {
        alert(res.error);
      }
    }
  }

  // Password Generator Logic
  function updateGeneratorPreview() {
    const charsUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const charsLower = 'abcdefghijklmnopqrstuvwxyz';
    const charsDigits = '0123456789';
    const charsSymbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let validChars = '';
    if (genUpper.checked) validChars += charsUpper;
    if (genLower.checked) validChars += charsLower;
    if (genDigits.checked) validChars += charsDigits;
    if (genSymbols.checked) validChars += charsSymbols;

    if (!validChars) validChars = charsLower;

    const length = parseInt(genLength.value, 10);
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);

    let password = '';
    for (let i = 0; i < length; i++) {
      password += validChars[array[i] % validChars.length];
    }

    genPreview.textContent = password;
  }

  // Helpers
  function showError(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function showToast(buttonEl, text) {
    const orig = buttonEl.textContent;
    buttonEl.textContent = text;
    setTimeout(() => {
      buttonEl.textContent = orig;
    }, 1500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }
});
