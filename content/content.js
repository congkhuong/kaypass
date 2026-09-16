/**
 * KayPass Content Script - AutoFill & Login Helper
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'AUTOFILL_CREDENTIALS') {
    const { username, password } = request;
    const success = autofillForm(username, password);
    sendResponse({ success: success });
  } else if (request.action === 'PING') {
    sendResponse({ success: true });
  }
  return true;
});

function autofillForm(username, password) {
  // Find password field
  const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
  
  if (passwordInputs.length === 0) {
    console.warn('[KayPass] Không tìm thấy ô nhập mật khẩu trên trang này.');
    return false;
  }

  // Pick the first visible or main password input
  const targetPasswordInput = passwordInputs.find(el => isVisible(el)) || passwordInputs[0];
  
  // Find associated username/email input
  let targetUserInput = findUsernameInput(targetPasswordInput);

  if (targetUserInput && username) {
    setInputValue(targetUserInput, username);
  }

  if (targetPasswordInput && password) {
    setInputValue(targetPasswordInput, password);
    targetPasswordInput.focus();
  }

  return true;
}

function findUsernameInput(passwordInput) {
  // Look in the same form if available
  const form = passwordInput.closest('form');
  const scope = form || document;

  const candidateInputs = Array.from(scope.querySelectorAll('input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'));

  for (const input of candidateInputs) {
    const type = (input.type || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();

    if (
      type === 'email' || 
      type === 'text' || 
      autocomplete.includes('username') || 
      autocomplete.includes('email') || 
      name.includes('user') || 
      name.includes('login') || 
      name.includes('email') || 
      id.includes('user') || 
      id.includes('login') || 
      id.includes('email') || 
      placeholder.includes('user') || 
      placeholder.includes('email') || 
      placeholder.includes('tài khoản') || 
      placeholder.includes('tên đăng nhập')
    ) {
      if (isVisible(input)) return input;
    }
  }

  // Fallback: return the input right before password input
  const allInputs = Array.from(scope.querySelectorAll('input'));
  const pwdIndex = allInputs.indexOf(passwordInput);
  if (pwdIndex > 0) {
    return allInputs[pwdIndex - 1];
  }

  return null;
}

function setInputValue(element, value) {
  element.focus();
  element.value = value;

  // Dispatch standard DOM events so frontend frameworks (React, Vue, Angular) register changes
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  element.blur();
}

function isVisible(elem) {
  return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
}
