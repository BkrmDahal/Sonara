/**
 * Sonara - Settings View
 * Handles settings modal and configuration management
 */

/**
 * Load settings into UI
 */
async function loadSettingsIntoUI() {
  try {
    const settings = await storageManager.getSettings();
    
    // TTS Settings
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
      voiceSelect.value = settings.openaiVoice || 'coral';
    }
    
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    if (speedSlider) {
      speedSlider.value = settings.ttsSpeed || 1.0;
      if (speedValue) {
        speedValue.textContent = `${speedSlider.value}x`;
      }
    }
    
    // API Key (masked)
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput && settings.openaiApiKey) {
      apiKeyInput.value = '••••••••' + settings.openaiApiKey.slice(-4);
      apiKeyInput.dataset.hasKey = 'true';
    }
    
    // Auto-extract setting
    const autoExtractCheckbox = document.getElementById('autoExtract');
    if (autoExtractCheckbox) {
      autoExtractCheckbox.checked = settings.autoExtract !== false;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Open settings modal
 */
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.add('active');
    loadSettingsIntoUI();
  }
}

/**
 * Close settings modal
 */
function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Handle save settings
 */
async function handleSaveSettings() {
  try {
    const settings = {};
    
    // Voice setting
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
      settings.openaiVoice = voiceSelect.value;
    }
    
    // Speed setting
    const speedSlider = document.getElementById('speedSlider');
    if (speedSlider) {
      settings.ttsSpeed = parseFloat(speedSlider.value);
    }
    
    // API Key (only save if changed)
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput && !apiKeyInput.value.startsWith('••••')) {
      settings.openaiApiKey = apiKeyInput.value.trim();
    }
    
    // Auto-extract setting
    const autoExtractCheckbox = document.getElementById('autoExtract');
    if (autoExtractCheckbox) {
      settings.autoExtract = autoExtractCheckbox.checked;
    }
    
    await storageManager.saveSettings(settings);
    closeSettingsModal();
    
    // Show success message
    showToast('Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Failed to save settings: ' + error.message);
  }
}

/**
 * Switch settings tab
 * @param {string} tabName - Tab name to switch to
 */
function switchSettingsTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.settings-tab-content').forEach(content => {
    content.classList.toggle('active', content.dataset.tab === tabName);
  });
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type ('success', 'error', 'info')
 */
function showToast(message, type = 'success') {
  // Check if toast container exists, create if not
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000;';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    background: ${type === 'error' ? '#ef4444' : type === 'info' ? '#3b82f6' : '#10b981'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    margin-top: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

