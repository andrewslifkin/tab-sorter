// Options page script

const form = document.getElementById('options-form');
const providerSelect = document.getElementById('provider');
const statusDiv = document.getElementById('status');

// Show/hide API key sections based on selected provider
function updateProviderSections() {
  const provider = providerSelect.value;
  
  document.querySelectorAll('.api-key-section').forEach(section => {
    section.classList.remove('active');
  });
  
  document.getElementById(`${provider}-section`).classList.add('active');
}

// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.sync.get(['provider', 'openaiKey', 'anthropicKey', 'geminiKey']);
  
  if (settings.provider) {
    providerSelect.value = settings.provider;
  }
  
  if (settings.openaiKey) {
    document.getElementById('openai-key').value = settings.openaiKey;
  }
  
  if (settings.anthropicKey) {
    document.getElementById('anthropic-key').value = settings.anthropicKey;
  }
  
  if (settings.geminiKey) {
    document.getElementById('gemini-key').value = settings.geminiKey;
  }
  
  updateProviderSections();
}

// Save settings
async function saveSettings(e) {
  e.preventDefault();
  
  const provider = providerSelect.value;
  const openaiKey = document.getElementById('openai-key').value.trim();
  const anthropicKey = document.getElementById('anthropic-key').value.trim();
  const geminiKey = document.getElementById('gemini-key').value.trim();
  
  // Validate that the selected provider has an API key
  let hasKey = false;
  switch (provider) {
    case 'openai':
      hasKey = openaiKey.length > 0;
      break;
    case 'anthropic':
      hasKey = anthropicKey.length > 0;
      break;
    case 'gemini':
      hasKey = geminiKey.length > 0;
      break;
  }
  
  if (!hasKey) {
    showStatus('Please enter an API key for the selected provider', 'error');
    return;
  }
  
  try {
    await chrome.storage.sync.set({
      provider,
      openaiKey,
      anthropicKey,
      geminiKey
    });
    
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
}

function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }
}

// Event listeners
providerSelect.addEventListener('change', updateProviderSections);
form.addEventListener('submit', saveSettings);

// Initialize
loadSettings();
