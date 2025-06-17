# Obsidian-RSS (RSS to Note)
Obsidian plugin to create a seamless workflow for easy capture of emails inside Obsidian. 


## The Solution:
Go to kill-the-newsletter.com.
Create a new inbox. The service will give you a unique email address (e.g., example_123@kill-the-newsletter.com) and an RSS feed URL.
Subscribe to your favorite newsletters using the new email address.
Copy the RSS feed URL.
In Obsidian, go to Settings -> RSS to Note.
Click + Add Feed and paste the RSS feed URL into the Feed URL field. Give it a name like "Newsletter Inbox".
Configure the rest of the settings to your liking.
Now, whenever a new newsletter or email is sent to that email address, it will appear in the RSS feed. The next time the plugin fetches, it will be saved as a new, clean note in your vault!

## Installation
This plugin is not yet in the community plugin store. To install it manually:
Download the latest release from the Releases page.
Create a folder named rss-to-note in your Obsidian vault's plugins folder (YourVault/.obsidian/plugins/).
Unzip the release and copy the main.js and manifest.json files into the rss-to-note folder.
Reload Obsidian (or open and close the app).
Go to Settings -> Community Plugins.
Find "RSS to Note" and enable it.

## How to Use
Install the plugin (see Installation instructions below).
Open Obsidian's settings and navigate to the "RSS to Note" tab.
Configure the Global Settings like your preferred folder structure and note template.
Click the + Add Feed button to create your first feed entry.
Fill in the Feed Name and the Feed URL.
To import notes, you can:
Use the Fetch All RSS Feeds Now command from the command palette (Ctrl/Cmd + P).
Click the 📥 Fetch Now button for a specific feed in the settings.
Set an Auto-fetch Interval to have it run automatically in the background.

## Settings Explained

**🌐 Global Settings**
Folder Structure:
Single shared folder: All notes from all feeds will be saved into one folder.
Separate folders per feed: Each feed will save notes into its own dedicated folder.
Shared Folder Name: (Visible if Folder Structure is shared) The name of the folder where all notes will be saved.
Content Format:
Cleaned HTML (Recommended): Saves the content as-is, which renders directly in Obsidian's reading mode. Best for most feeds.
HTML in Code Block: Wraps the entire content in a ```html code block. Useful for inspecting the source.
HTML in Callout: Places the HTML code block inside an Obsidian callout (> [!note]).
Auto-fetch Interval: How often the plugin should automatically check for new items. Manual only disables this.
Custom Interval (Minutes): (Visible if Auto-fetch Interval is custom) Specify the number of minutes between fetches.
Note Template: Define the structure for every new note. The following variables are available:
{{title}}: The title of the feed item.
{{author}}: The author of the item.
{{link}}: The original URL of the item.
{{pubDate}}: The publication date.
{{feedName}}: The name you gave the feed in the settings.
{{content}}: The main content of the feed item.

**📡 Per-Feed Settings**
Feed Name: A friendly name for the feed (e.g., "Hacker News", "My Newsletters").
Feed URL: The direct link to the RSS/Atom feed (e.g., https://example.com/feed.xml).
Target Folder: (Visible if Folder Structure is separate) The folder where notes from this specific feed will be saved.
Start Date Filter: (Optional) Enter a date in YYYY-MM-DD format. The plugin will only import items published on or after this date.
Actions:
🔍 Test: Checks if the URL is a valid and reachable feed.
📥 Fetch Now: Immediately fetches and imports new items from this feed only.
🗑️ Clear History: Deletes the record of which links have been imported from this feed. The next fetch will re-import all items (respecting the start date filter).
❌ Remove: Deletes the feed configuration. This requires a second confirmation click to prevent accidents.

Disclaimer: Use at your own risk.

