# Obsidian RSS to Note

An Obsidian plugin that converts RSS feeds into notes, enabling seamless capture of newsletters and other RSS content directly into your vault.

## Email Newsletter Integration

This plugin works perfectly with **Kill the Newsletter** to convert email newsletters or emails into RSS feeds:

1. Visit [kill-the-newsletter.com](https://kill-the-newsletter.com) and create a new inbox
2. You'll receive a unique email address (e.g., `example_123@kill-the-newsletter.com`) and RSS feed URL
3. Subscribe to newsletters using this email address or manually forward emails to this adress for processing.
4. Add the RSS feed URL to this plugin settings
5. Newsletter emails or forwarded emails will automatically become notes in your Obsidian vault

## Installation

This plugin is not yet available in the Community Plugin store. To install manually:

1. Download the latest release from  https://github.com/Gjessing1/Obsidian-RSS
2. Create a folder named `rss-to-note` in your vault's plugins directory: `YourVault/.obsidian/plugins/`
3. Extract the downloaded files and copy `main.js` and `manifest.json` into the `rss-to-note` folder
4. Restart Obsidian
5. Go to **Settings → Community Plugins** and enable "RSS to Note"

## How to Use

1. Open **Settings → RSS to Note**
2. Configure your global preferences (folder structure, note template, etc.)
3. Click **Add Feed** to add your first RSS source
4. Enter the feed name and URL
5. Import notes by:
   - Running "Fetch All RSS Feeds Now" from the command palette (Ctrl/Cmd + P)
   - Clicking the "Fetch Now" button for specific feeds
   - Setting an auto-fetch interval for automatic background updates

## Settings

### Global Settings

**Folder Structure**
- **Single shared folder**: All notes save to one folder
- **Separate folders per feed**: Each feed gets its own folder

**Content Format**
- **Cleaned HTML (Recommended)**: Content renders directly in Obsidian's reading mode
- **HTML in Code Block**: Wraps content in ```html blocks for source inspection
- **HTML in Callout**: Places HTML code blocks inside Obsidian callouts

**Auto-fetch Interval**
Set how frequently the plugin checks for new items, or choose "Manual only" to disable automatic fetching.

**Note Template**
Customize the structure of imported notes using these variables:
- `{{title}}`: Feed item title
- `{{author}}`: Item author
- `{{link}}`: Original URL
- `{{pubDate}}`: Publication date
- `{{feedName}}`: Feed name from settings
- `{{content}}`: Main content

### Per-Feed Settings

**Feed Configuration**
- **Feed Name**: Display name for the feed
- **Feed URL**: Direct link to the RSS/Atom feed
- **Target Folder**: Specific folder for this feed (when using separate folders)
- **Start Date Filter**: Only import items published after this date (YYYY-MM-DD format)

**Feed Actions**
- **Test**: Verify the feed URL is valid and accessible
- **Fetch Now**: Import new items from this feed immediately
- **Clear History**: Reset import history (next fetch will re-import all items)
- **Remove**: Delete feed configuration (requires confirmation), does not delete the notes.

---

**Disclaimer**: Use at your own risk.
