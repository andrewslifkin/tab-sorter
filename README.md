# AI Tab Organizer

Chrome Manifest V3 extension that organizes open tabs into native Chrome tab groups using AI — Arc Browser style.

## Features

- 🎯 **One-click organization**: Click the toolbar icon to instantly organize all tabs in the current window
- 🤖 **AI-powered grouping**: Uses LLMs to intelligently categorize tabs by content
- 🎨 **Native Chrome tab groups**: Creates colored, titled tab groups directly in Chrome's tab bar
- 🔌 **Multiple AI providers**: Supports OpenAI, Anthropic Claude, and Google Gemini
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

### Configure API Key

1. **Click the extension icon** or go to `chrome://extensions/` and click "Details" → "Extension options"

2. **Choose your AI provider**:
   - **OpenAI** (default): Fast and reliable with GPT-4o Mini
   - **Anthropic**: Uses Claude 3 Haiku
   - **Google Gemini**: Uses Gemini 1.5 Flash

3. **Get an API key**:
   - **OpenAI**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Anthropic**: Visit [Anthropic Console](https://console.anthropic.com/settings/keys)
   - **Google Gemini**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey)

4. **Enter your API key** in the options page and click "Save Settings"

⚠️ **Security Note**: API keys are stored in Chrome's sync storage. Never share your extension data or API keys.

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
- Existing tab groups in the window are ungrouped before reorganizing
- The AI analyzes tab titles and hostnames (not full page content)
- Groups are assigned colors from Chrome's available palette
- Each group gets a short, descriptive name

### Error Handling
- Missing API key: Shows notification with instructions
- Network errors: Shows error badge and notification
- No groupable tabs: Shows error message

## API Costs

This extension uses AI APIs that may incur costs:

- **OpenAI GPT-4o Mini**: ~$0.0001-0.0003 per organization (very cheap)
- **Anthropic Claude Haiku**: ~$0.0001-0.0005 per organization
- **Google Gemini Flash**: Free tier available, then ~$0.0001-0.0003

Typical usage: organizing 20-50 tabs costs less than $0.001 (fraction of a cent).

## Development

### File Structure
```
tab-sorter/
├── manifest.json           # Extension configuration
├── background.js          # Service worker with main logic
├── options.html          # Settings page UI
├── options.js            # Settings page logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── generate_icons.py     # Icon generation script
└── README.md
```

### How It Works

1. **User clicks icon** → `chrome.action.onClicked` listener fires
2. **Collect tabs** → Query all tabs in current window, filter non-groupable
3. **Call AI** → Send tab titles + hostnames to selected LLM provider
4. **Parse response** → Extract JSON with group names, colors, and tab IDs
5. **Ungroup existing** → Remove existing tab groups in the window
6. **Create groups** → Use `chrome.tabs.group` and `chrome.tabGroups.update` APIs
7. **Show result** → Update badge to indicate success/failure

### Customization

To modify the grouping prompt or behavior, edit `background.js`:
- Change the prompt in the `getAIGroupings()` function
- Adjust models in the API call functions
- Modify ungrouping behavior in `organizeTabs()`

## Limitations

- Only organizes tabs in the current window (not across windows)
- Requires a valid API key and internet connection
- Chrome internal pages cannot be grouped
- Tab groups are not synced across devices (Chrome limitation)

## Privacy

This extension:
- ✅ Stores API keys locally in Chrome storage
- ✅ Only sends tab titles and hostnames to AI providers
- ✅ Does NOT send full page content or personal data
- ✅ Does NOT track usage or send telemetry
- ✅ Open source for transparency

## Troubleshooting

### Extension icon shows "!" badge
- Check that your API key is correctly entered in the options page
- Verify you have an active internet connection
- Check the browser console for detailed error messages (`Ctrl+Shift+J`)

### Tabs aren't being grouped
- Make sure you have groupable tabs (not just `chrome://` pages)
- Verify your API key is valid and has available credits
- Check that you're clicking the icon in a window with tabs

### "Missing API key" error
- Go to the options page and enter your API key for the selected provider
- Make sure you've clicked "Save Settings"

## License

MIT License - feel free to modify and distribute.

## Credits

Inspired by Arc Browser's tab organization features, built for Chrome with native tab groups.
