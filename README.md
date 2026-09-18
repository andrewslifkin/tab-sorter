# AI Tab Organizer

Chrome Manifest V3 extension that organizes open tabs into native Chrome tab groups using AI — Arc Browser style.

## Features

- 🎯 **One-click organization**: Click the toolbar icon to instantly organize all tabs in the current window
- 🤖 **AI-powered grouping**: Uses LLMs to intelligently categorize tabs by content
- 🌐 **Offline mode**: Rules-based grouping works without AI APIs (perfect for corporate networks)
- 🎨 **Native Chrome tab groups**: Creates colored, titled tab groups directly in Chrome's tab bar
- 🔌 **Multiple AI providers**: Supports OpenAI, Anthropic Claude, Google Gemini, and Offline
- 🔄 **Automatic fallback**: Falls back to offline mode if AI APIs are blocked
- 🔒 **Privacy-focused**: API keys stored locally, only tab titles and hostnames are sent to AI

## Installation

### Load as Unpacked Extension

1. **Download or clone this repository**
   ```bash
   git clone <repository-url>
   cd tab-sorter
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Or: Menu → Extensions → Manage Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `tab-sorter` directory (the folder containing `manifest.json`)

5. **Verify installation**
   - You should see "AI Tab Organizer" in your extensions list
   - The extension icon should appear in your Chrome toolbar

## Setup

### Configure Provider

1. **Click the extension icon** or go to `chrome://extensions/` and click "Details" → "Extension options"

2. **Choose your provider**:
   - **OpenAI** (default): Fast and reliable with GPT-4o Mini
   - **Anthropic**: Uses Claude 3 Haiku
   - **Google Gemini**: Uses Gemini 1.5 Flash
   - **Offline**: Rules-based grouping without AI APIs (no internet required)

3. **For AI providers, get an API key**:
   - **OpenAI**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Anthropic**: Visit [Anthropic Console](https://console.anthropic.com/settings/keys)
   - **Google Gemini**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey)

4. **Enter your API key** (if using AI provider) and click "Save Settings"

⚠️ **Security Note**: API keys are stored in Chrome's sync storage. Never share your extension data or API keys.

### Offline Mode (No API Required)

**Perfect for corporate/MDM-managed machines that block AI APIs!**

Offline mode uses a comprehensive rules-based engine that:
- ✅ Recognizes 100+ popular services (Google Workspace, GitHub, Slack, Jira, Figma, AWS, etc.)
- ✅ Groups related subdomains (all Google Docs tabs together, all Atlassian tools, etc.)
- ✅ Uses smart heuristics for unknown sites
- ✅ Creates 3-12 logical groups with stable names and colors
- ✅ Works instantly without network calls
- ✅ Deterministic results (same tabs → same groups)

**To use offline mode**: Select "Offline" in the options page. No API key needed.

**Auto-fallback**: If you use an AI provider and it fails (network error, blocked by firewall, etc.), the extension automatically falls back to offline grouping and shows a notification: "Offline grouping (API unavailable)".

## Usage

1. **Open multiple tabs** in a Chrome window with various content (e.g., news, social media, documentation, shopping)

2. **Click the extension icon** in the toolbar

3. **Wait a moment** while the AI analyzes and organizes your tabs
   - The badge shows "..." while processing
   - The badge shows "✓" when complete
   - The badge shows "!" if there's an error

4. **Your tabs are now organized!** They'll be grouped into native Chrome tab groups with:
   - Descriptive category names (2-4 words)
   - Color-coded groups
   - Logical organization by content type

## Behavior Details

### What Gets Organized
- ✅ All regular tabs in the current window
- ✅ Tabs are grouped by content similarity
- ❌ Chrome internal pages (`chrome://`, `chrome-extension://`) are skipped
- ❌ Pinned tabs are left unchanged

### Grouping Logic

**AI Mode (OpenAI/Anthropic/Gemini)**:
- The AI analyzes tab titles and hostnames (not full page content)
- Generates logical category names and assigns colors
- Groups are typically 2-8 categories depending on tab diversity

**Offline Mode**:
- Uses layered classification (see offline-grouping.js for details):
  1. Known site map: 100+ curated services with preset group names
  2. Hostname family merging: related subdomains grouped together
  3. Title keyword hints: PR, standup, invoice keywords inform grouping
  4. ETLD+1 fallback: unknown sites clustered by domain
  5. Smart sizing: merges tiny groups, caps at 12, handles singletons intelligently
- Stable, deterministic results
- No network required

**Both modes**:
- Existing tab groups in the window are ungrouped before reorganizing
- Groups are assigned colors from Chrome's available palette
- Each group gets a short, descriptive name

### Error Handling
- Missing API key (AI mode): Shows notification with instructions
- Network errors or blocked APIs: Automatically falls back to offline grouping
- No groupable tabs: Shows error message
- Offline mode: Never fails due to network issues

## API Costs

**Offline mode: $0** (completely free, no API calls)

AI providers may incur small costs:

- **OpenAI GPT-4o Mini**: ~$0.0001-0.0003 per organization (very cheap)
- **Anthropic Claude Haiku**: ~$0.0001-0.0005 per organization
- **Google Gemini Flash**: Free tier available, then ~$0.0001-0.0003

Typical AI usage: organizing 20-50 tabs costs less than $0.001 (fraction of a cent).

## Development

### File Structure
```
tab-sorter/
├── manifest.json              # Extension configuration
├── background.js             # Service worker with main logic
├── offline-grouping.js       # Rules-based grouping engine
├── offline-grouping.test.js  # Unit tests for offline grouping
├── options.html             # Settings page UI
├── options.js               # Settings page logic
├── icons/                   # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── generate_icons.py        # Icon generation script
└── README.md
```

### How It Works

**AI Mode**:
1. **User clicks icon** → `chrome.action.onClicked` listener fires
2. **Collect tabs** → Query all tabs in current window, filter non-groupable
3. **Call AI** → Send tab titles + hostnames to selected LLM provider
4. **Fallback if needed** → If API call fails, automatically use offline grouping
5. **Parse response** → Extract JSON with group names, colors, and tab IDs
6. **Ungroup existing** → Remove existing tab groups in the window
7. **Create groups** → Use `chrome.tabs.group` and `chrome.tabGroups.update` APIs
8. **Show result** → Update badge to indicate success/failure

**Offline Mode**:
1. **User clicks icon** → `chrome.action.onClicked` listener fires
2. **Collect tabs** → Query all tabs in current window, filter non-groupable
3. **Classify tabs** → Apply rules engine (known sites → families → keywords → domain fallback)
4. **Apply policies** → Smart group sizing, merge unknowns, handle singletons
5. **Ungroup existing** → Remove existing tab groups in the window
6. **Create groups** → Use `chrome.tabs.group` and `chrome.tabGroups.update` APIs
7. **Show result** → Update badge to indicate success

### Running Tests

The offline grouping engine includes comprehensive unit tests:

```bash
node offline-grouping.test.js
```

Tests cover:
- Classification of known sites and families
- Grouping logic with real-world fixtures (work morning, multi-service, etc.)
- Edge cases (empty input, only ungroupable tabs, singletons)
- Determinism (same input always produces same output)

### Customization

**AI Mode**: Edit `background.js`:
- Change the prompt in the `getAIGroupings()` function
- Adjust models in the API call functions
- Modify ungrouping behavior in `organizeTabs()`

**Offline Mode**: Edit `offline-grouping.js`:
- Add sites to `KNOWN_SITES` map (hostname suffix → [name, color, priority])
- Add patterns to `HOSTNAME_FAMILIES` for subdomain merging
- Adjust title keywords in `TITLE_KEYWORDS`
- Tune group size policy in `applyGroupSizePolicy()`

## Limitations

- Only organizes tabs in the current window (not across windows)
- AI modes require a valid API key and internet connection (but auto-fallback to offline)
- Chrome internal pages cannot be grouped
- Tab groups are not synced across devices (Chrome limitation)
- Offline mode uses heuristics, not semantic understanding (may not match AI quality for ambiguous cases)

## Privacy

This extension:
- ✅ Stores API keys locally in Chrome storage
- ✅ Only sends tab titles and hostnames to AI providers
- ✅ Does NOT send full page content or personal data
- ✅ Does NOT track usage or send telemetry
- ✅ Open source for transparency

## Troubleshooting

### Extension icon shows "!" badge
- Check that your API key is correctly entered in the options page (if using AI mode)
- Verify you have an active internet connection (AI mode only)
- Try switching to Offline mode if on a locked-down network
- Check the browser console for detailed error messages (`Ctrl+Shift+J`)

### Tabs aren't being grouped
- Make sure you have groupable tabs (not just `chrome://` pages)
- Verify your API key is valid and has available credits (AI mode)
- Check that you're clicking the icon in a window with tabs

### "Missing API key" error
- Go to the options page and enter your API key for the selected provider
- Or switch to Offline mode (no API key required)
- Make sure you've clicked "Save Settings"

### "Offline grouping (API unavailable)" notification
- Your AI provider failed (network blocked, rate limit, etc.)
- The extension automatically used offline mode as fallback
- Your tabs were still organized successfully!
- To avoid this, select Offline as your primary provider

## License

MIT License - feel free to modify and distribute.

## Credits

Inspired by Arc Browser's tab organization features, built for Chrome with native tab groups.
