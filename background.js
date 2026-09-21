// Service worker for AI Tab Organizer

// Import offline grouping module
importScripts('offline-grouping.js');
// Listen for extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Show working status
    await chrome.action.setBadgeText({ text: '...' });
    await chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });

    await organizeTabs();

    // Show success
    await chrome.action.setBadgeText({ text: '✓' });
    await chrome.action.setBadgeBackgroundColor({ color: '#0f9d58' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
  } catch (error) {
    console.error('Error organizing tabs:', error);
    
    // Show error
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#db4437' });
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'AI Tab Organizer',
      message: error.message || 'Failed to organize tabs'
    });
    
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
});

// Request notification permission on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

async function organizeTabs() {
  // Get current window
  const currentWindow = await chrome.windows.getCurrent();
  
  // Get all tabs in current window
  const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
  
  // Filter out chrome:// and chrome-extension:// URLs as they can't be grouped
  const groupableTabs = tabs.filter(tab => {
    const url = tab.url || '';
    return !url.startsWith('chrome://') && 
           !url.startsWith('chrome-extension://') &&
           !tab.pinned; // Skip pinned tabs
  });
  
  if (groupableTabs.length === 0) {
    throw new Error('No tabs to organize');
  }
  
  // Get API configuration
  const config = await chrome.storage.sync.get(['provider', 'openaiKey', 'anthropicKey', 'geminiKey']);
  const provider = config.provider || 'openai';
  
  let groups;
  
  // Handle offline provider
  if (provider === 'offline') {
    // Use offline grouping (rules-based)
    groups = globalThis.OfflineGrouping.groupTabsOffline(tabs);
  } else {
    // Try AI provider with auto-fallback to offline
    let apiKey;
    switch (provider) {
      case 'openai':
        apiKey = config.openaiKey;
        break;
      case 'anthropic':
        apiKey = config.anthropicKey;
        break;
      case 'gemini':
        apiKey = config.geminiKey;
        break;
    }
    
    if (!apiKey) {
      throw new Error(`Missing API key for ${provider}. Please set it in the options page or switch to Offline mode.`);
    }
    
    // Prepare tab data for AI
    const tabData = groupableTabs.map(tab => ({
      id: tab.id,
      title: tab.title || 'Untitled',
      hostname: new URL(tab.url).hostname
    }));
    
    try {
      // Try AI grouping
      groups = await getAIGroupings(provider, apiKey, tabData);
    } catch (error) {
      // Auto-fallback to offline grouping
      console.warn(`AI provider failed (${error.message}), falling back to offline grouping`);
      
      groups = globalThis.OfflineGrouping.groupTabsOffline(tabs);
      
      // Show notification about fallback
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'AI Tab Organizer',
        message: 'Offline grouping (API unavailable)'
      });
    }
  }
  
  // Get the list of group IDs created by this extension
  const storage = await chrome.storage.session.get(['createdGroupIds']);
  const createdGroupIds = new Set(storage.createdGroupIds || []);
  
  // Get existing tab groups in this window
  const existingGroups = await chrome.tabGroups.query({ windowId: currentWindow.id });
  
  // Only ungroup tabs from groups created by this extension, plus currently ungrouped tabs
  for (const group of existingGroups) {
    if (createdGroupIds.has(group.id)) {
      const groupTabs = await chrome.tabs.query({ groupId: group.id });
      for (const tab of groupTabs) {
        await chrome.tabs.ungroup(tab.id);
      }
    }
  }
  
  // Chrome's available tab group colors
  const availableColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  
  // Track new group IDs we create
  const newCreatedGroupIds = [];
  
  // Create new groups
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    
    if (!group.tabIds || group.tabIds.length === 0) continue;
    
    // Filter to only valid tab IDs
    const validTabIds = group.tabIds.filter(id => 
      groupableTabs.some(tab => tab.id === id)
    );
    
    if (validTabIds.length === 0) continue;
    
    // Create group
    const groupId = await chrome.tabs.group({
      tabIds: validTabIds,
      createProperties: { windowId: currentWindow.id }
    });
    
    // Track this group ID
    newCreatedGroupIds.push(groupId);
    
    // Update group with title and color
    const color = group.color && availableColors.includes(group.color) 
      ? group.color 
      : availableColors[i % availableColors.length];
    
    await chrome.tabGroups.update(groupId, {
      title: group.name || `Group ${i + 1}`,
      color: color,
      collapsed: false
    });
  }
  
  // Store the new list of created group IDs
  await chrome.storage.session.set({ createdGroupIds: newCreatedGroupIds });
}

async function getAIGroupings(provider, apiKey, tabData) {
  const prompt = `Analyze these browser tabs and organize them into logical groups. Return a JSON array of groups with: name (2-4 word category), color (optional, from: grey/blue/red/yellow/green/pink/purple/cyan/orange), and tabIds (array of tab IDs).

Tabs:
${tabData.map(t => `ID ${t.id}: ${t.title} (${t.hostname})`).join('\n')}

Return only valid JSON array in this format:
[{"name": "Category Name", "color": "blue", "tabIds": [1, 2, 3]}]`;

  let response;
  
  switch (provider) {
    case 'openai':
      response = await callOpenAI(apiKey, prompt);
      break;
    case 'anthropic':
      response = await callAnthropic(apiKey, prompt);
      break;
    case 'gemini':
      response = await callGemini(apiKey, prompt);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
  
  return response;
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that organizes browser tabs into logical groups. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Parse the JSON response
  let parsed = JSON.parse(content);
  
  // Handle if wrapped in an object
  if (parsed.groups && Array.isArray(parsed.groups)) {
    return parsed.groups;
  }
  
  // Handle if it's directly an array
  if (Array.isArray(parsed)) {
    return parsed;
  }
  
  throw new Error('Unexpected response format from OpenAI');
}

async function callAnthropic(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }
  
  const data = await response.json();
  const content = data.content[0].text;
  
  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || 
                    content.match(/(\[[\s\S]*\])/);
  
  if (!jsonMatch) {
    throw new Error('Could not extract JSON from Anthropic response');
  }
  
  const parsed = JSON.parse(jsonMatch[1]);
  
  if (Array.isArray(parsed)) {
    return parsed;
  }
  
  throw new Error('Unexpected response format from Anthropic');
}

async function callGemini(apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }
  
  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text;
  
  const parsed = JSON.parse(content);
  
  // Handle if wrapped in an object
  if (parsed.groups && Array.isArray(parsed.groups)) {
    return parsed.groups;
  }
  
  // Handle if it's directly an array
  if (Array.isArray(parsed)) {
    return parsed;
  }
  
  throw new Error('Unexpected response format from Gemini');
}
