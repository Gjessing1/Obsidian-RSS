// --- START OF PART 1: Core Plugin Logic ---

const { Plugin, PluginSettingTab, Setting, requestUrl, Notice, normalizePath } = require('obsidian');

const DEFAULT_SETTINGS = {
  feeds: [
    {
      id: Date.now().toString(),
      url: '',
      name: 'Feed 1',
      folder: 'RSS Notes',
      startDate: '',
      fetchedLinks: [],
      lastSync: null,
      templateOverride: '' // Per-feed template override
    }
  ],
  folderStructure: 'shared', // 'shared' or 'separate'
  sharedFolder: 'RSS Notes',
  fetchInterval: 'manual',
  customIntervalMinutes: 30,
  contentFormat: 'html',
  template: `---\ntitle: "{{title}}"\nauthor: "{{author}}"\nsource: "{{link}}"\ndate: "{{pubDate}}"\nfeed: "{{feedName}}"\n---\n\n{{content}}`,
  usePerFeedTemplates: false, // Global setting for template behavior
  feedCache: {} // Cache for feed metadata
};

const FETCH_INTERVALS = {
  manual: null,
  '10min': 10 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  'hour': 60 * 60 * 1000,
  'custom': 'custom'
};

class RssToNotePlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.intervalId = null;
    this.settings = {};
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new RssToNoteSettingTab(this.app, this));

    this.addCommand({
      id: 'fetch-rss-now',
      name: 'Fetch All RSS Feeds Now',
      callback: () => this.fetchAllFeeds(),
    });

    this.setupInterval();
  }

  onunload() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  setupInterval() {
    if (this.intervalId) clearInterval(this.intervalId);
    let interval = FETCH_INTERVALS[this.settings.fetchInterval];
    
    if (this.settings.fetchInterval === 'custom') {
      const minutes = parseInt(this.settings.customIntervalMinutes) || 30;
      interval = minutes * 60 * 1000;
    }
    
    if (interval && interval !== 'custom') {
      this.intervalId = setInterval(() => this.fetchAllFeeds(), interval);
    }
  }

  cleanHtmlContent(html) {
    if (!html) return '';
    
    return html
      // Remove Gmail containers and direction attributes
      .replace(/<div[^>]*class="gmail_quote[^"]*"[^>]*>.*?<\/div>/gis, '')
      .replace(/<div[^>]*class="gmail_quote_container[^"]*"[^>]*>.*?<\/div>/gis, '')
      .replace(/\s*dir="auto"/gi, '')
      
      // Remove empty tags
      .replace(/<u><\/u>/gi, '')
      .replace(/<div><\/div>/gi, '')
      .replace(/<p><\/p>/gi, '')
      .replace(/<span><\/span>/gi, '')
      
      // Remove Kill the Newsletter footers
      .replace(/<hr\s*\/?>\s*<p>\s*<small>.*?Kill the Newsletter.*?<\/small>\s*<\/p>/gis, '')
      .replace(/<p>\s*<small>.*?Kill the Newsletter.*?<\/small>\s*<\/p>/gis, '')
      
      // Clean up multiple consecutive line breaks and whitespace
      .replace(/(<br\s*\/?>){3,}/gi, '<br><br>')
      .replace(/\s{3,}/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  formatContent(htmlContent) {
    if (!htmlContent) return '';
    
    switch (this.settings.contentFormat) {
      case 'htmlBlock':
        return '```html\n' + this.cleanHtmlContent(htmlContent) + '\n```';
      case 'htmlCallout':
        return '> [!note] Original HTML\n> ```html\n> ' + this.cleanHtmlContent(htmlContent).replace(/\n/g, '\n> ') + '\n> ```';
      case 'html':
      default:
        return this.cleanHtmlContent(htmlContent);
    }
  }

  shouldFetchItem(pubDate, startDate) {
    if (!startDate) return true;
    
    try {
      const itemDate = new Date(pubDate);
      const filterDate = new Date(startDate);
      return itemDate >= filterDate;
    } catch (e) {
      console.warn('Date parsing error:', e);
      return true;
    }
  }

  async testFeedHealth(feedUrl) {
    if (!feedUrl) {
      return { success: false, error: 'No feed URL provided' };
    }

    try {
      const res = await requestUrl({ url: feedUrl });
      const parser = new DOMParser();
      const xml = parser.parseFromString(res.text, 'text/xml');
      
      const parseError = xml.querySelector('parsererror');
      if (parseError) {
        return { success: false, error: 'Invalid XML format' };
      }
      
      const items = xml.querySelectorAll('item, entry');
      const feedTitle = xml.querySelector('title')?.textContent || 'Unknown';
      const lastBuildDate = xml.querySelector('lastBuildDate, updated')?.textContent;
      
      const feedMetadata = {
        title: feedTitle.trim(),
        itemCount: items.length,
        lastBuildDate: lastBuildDate,
        lastChecked: Date.now()
      };
      
      this.settings.feedCache[feedUrl] = feedMetadata;
      await this.saveSettings();
      
      return {
        success: true,
        itemCount: items.length,
        feedTitle: feedTitle.trim(),
        lastBuildDate: lastBuildDate
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async fetchAllFeeds() {
    new Notice('Starting to fetch all RSS feeds...');
    const feeds = this.settings.feeds.filter(feed => feed.url);
    if (feeds.length === 0) {
      new Notice('No feeds configured');
      return;
    }

    let totalImported = 0;
    for (const feed of feeds) {
      const imported = await this.fetchSingleFeed(feed, false);
      totalImported += imported;
    }

    new Notice(`RSS import complete: ${totalImported} new items across ${feeds.length} feeds.`);
  }

  async fetchSingleFeed(feedConfig, showNotice = true) {
    if (!feedConfig.url) {
      if (showNotice) new Notice('Feed URL not configured');
      return 0;
    }

    try {
      feedConfig.lastSync = Date.now();
      await this.saveSettings();
      
      const res = await requestUrl({ url: feedConfig.url });
      const parser = new DOMParser();
      const xml = parser.parseFromString(res.text, 'text/xml');
      const items = xml.querySelectorAll('item, entry');

      const feedTitle = xml.querySelector('title')?.textContent || feedConfig.name;
      const lastBuildDate = xml.querySelector('lastBuildDate, updated')?.textContent;
      
      this.settings.feedCache[feedConfig.url] = {
        title: feedTitle.trim(),
        itemCount: items.length,
        lastBuildDate: lastBuildDate,
        lastChecked: Date.now()
      };

      let imported = 0;
      for (let item of items) {
        let link = item.querySelector('link')?.textContent?.trim();
        if (!link) {
          link = item.querySelector('link')?.getAttribute('href');
        }
        if (!link || feedConfig.fetchedLinks.includes(link)) continue;

        const title = item.querySelector('title')?.textContent?.trim() || 'Untitled';
        const author = item.querySelector('author')?.textContent?.trim() || 
                     item.querySelector('dc\\:creator')?.textContent?.trim() || 'Unknown';
        const pubDate = item.querySelector('pubDate, updated, published')?.textContent || new Date().toISOString();
        
        if (!this.shouldFetchItem(pubDate, feedConfig.startDate)) continue;

        let htmlContent = '';
        const contentSelectors = ['description', 'content', 'summary', 'content\\:encoded'];
        for (const selector of contentSelectors) {
          const element = item.querySelector(selector);
          if (element) {
            htmlContent = element.textContent || element.innerHTML || '';
            if (htmlContent) break;
          }
        }

        const formattedContent = this.formatContent(htmlContent);

        let templateToUse = this.settings.template;
        if (this.settings.usePerFeedTemplates && feedConfig.templateOverride) {
          templateToUse = feedConfig.templateOverride;
        }

        const noteContent = templateToUse
          .replace(/{{title}}/g, title)
          .replace(/{{author}}/g, author)
          .replace(/{{link}}/g, link)
          .replace(/{{pubDate}}/g, pubDate)
          .replace(/{{feedName}}/g, feedConfig.name)
          .replace(/{{content}}/g, formattedContent);

        let targetFolder;
        if (this.settings.folderStructure === 'separate') {
          targetFolder = feedConfig.folder || feedConfig.name;
        } else {
          targetFolder = this.settings.sharedFolder;
        }

        const fileName = `${title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')}.md`;
        const filePath = normalizePath(`${targetFolder}/${fileName}`);

        const folderPath = normalizePath(targetFolder);
        if (!await this.app.vault.adapter.exists(folderPath)) {
          await this.app.vault.createFolder(folderPath);
        }

        let finalPath = filePath;
        let counter = 1;
        while (await this.app.vault.adapter.exists(finalPath)) {
          const baseName = fileName.replace('.md', '');
          finalPath = normalizePath(`${targetFolder}/${baseName}-${counter}.md`);
          counter++;
        }

        await this.app.vault.create(finalPath, noteContent);
        feedConfig.fetchedLinks.push(link);
        imported++;
      }
      
      await this.saveSettings();

      if (showNotice) {
        new Notice(`${feedConfig.name}: ${imported} new items imported.`);
      }
      return imported;
    } catch (e) {
      console.error('RSS Fetch Error:', e);
      if (showNotice) {
        new Notice(`Failed to fetch ${feedConfig.name}: ${e.message}`);
      }
      return 0;
    }
  }

  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    
    // Migration: Add missing properties to existing feeds
    this.settings.feeds = this.settings.feeds.map(feed => ({
      ...{
          id: Date.now().toString() + Math.random(),
          lastSync: null,
          templateOverride: '',
      },
      ...feed
    }));
    
    // Migration: Set default values for new settings
    if (!this.settings.hasOwnProperty('usePerFeedTemplates')) {
      this.settings.usePerFeedTemplates = false;
    }
    if (!this.settings.hasOwnProperty('feedCache')) {
      this.settings.feedCache = {};
    }
    if (this.settings.contentFormat === 'markdown') {
        this.settings.contentFormat = 'html';
    }

    //Cleanup obsolete settings to remove them from data.json on next save.
    delete this.settings.downloadImages;
    delete this.settings.imageFolder;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// --- END OF PART 1 --- //
// --- START OF PART 2: Settings UI ---

class RssToNoteSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'RSS to Note Settings' });

    const globalSection = containerEl.createDiv();
    globalSection.style.cssText = 'margin-bottom: 30px; padding: 20px; border: 1px solid var(--background-modifier-border); border-radius: 8px;';
    globalSection.createEl('h3', { text: '🌐 Global Settings' });

    new Setting(globalSection)
      .setName('Folder Structure')
      .setDesc('Choose how to organize your imported RSS notes')
      .addDropdown(drop => drop
        .addOptions({
          shared: 'Single shared folder',
          separate: 'Separate folders per feed'
        })
        .setValue(this.plugin.settings.folderStructure)
        .onChange(async (value) => {
          this.plugin.settings.folderStructure = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.folderStructure === 'shared') {
      new Setting(globalSection)
        .setName('Shared Folder Name')
        .setDesc('The folder where all RSS notes will be saved')
        .addText(text => text
          .setPlaceholder('RSS Notes')
          .setValue(this.plugin.settings.sharedFolder)
          .onChange(async (value) => {
            this.plugin.settings.sharedFolder = value;
            await this.plugin.saveSettings();
          }));
    }

    new Setting(globalSection)
      .setName('Content Format')
      .setDesc('How should the RSS content be processed and stored?')
      .addDropdown(drop => drop
        .addOptions({
          html: 'Cleaned HTML (Recommended)',
          htmlBlock: 'HTML in Code Block',
          htmlCallout: 'HTML in Callout'
        })
        .setValue(this.plugin.settings.contentFormat)
        .onChange(async (value) => {
          this.plugin.settings.contentFormat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(globalSection)
      .setName('Auto-fetch Interval')
      .setDesc('Automatically check for new RSS items at regular intervals')
      .addDropdown(drop => drop
        .addOptions({
          manual: 'Manual only',
          '10min': 'Every 10 minutes',
          '30min': 'Every 30 minutes',
          'hour': 'Every hour',
          'custom': 'Custom interval'
        })
        .setValue(this.plugin.settings.fetchInterval)
        .onChange(async (value) => {
          this.plugin.settings.fetchInterval = value;
          await this.plugin.saveSettings();
          this.plugin.setupInterval();
          this.display();
        }));

    if (this.plugin.settings.fetchInterval === 'custom') {
      new Setting(globalSection)
        .setName('Custom Interval (Minutes)')
        .setDesc('Specify minutes between fetches (minimum: 5)')
        .addText(text => text
          .setPlaceholder('30')
          .setValue(this.plugin.settings.customIntervalMinutes?.toString() || '30')
          .onChange(async (value) => {
            const minutes = parseInt(value);
            if (minutes >= 5) {
              this.plugin.settings.customIntervalMinutes = minutes;
              await this.plugin.saveSettings();
              this.plugin.setupInterval();
            } else {
              new Notice('Custom interval must be at least 5 minutes');
            }
          }));
    }

    new Setting(globalSection)
      .setName('Note Template')
      .setDesc('Variables: {{title}}, {{author}}, {{link}}, {{pubDate}}, {{feedName}}, {{content}}')
      .addTextArea(text => {
        text.setValue(this.plugin.settings.template)
          .setPlaceholder('---\ntitle: "{{title}}"\n---\n\n{{content}}')
          .onChange(async (value) => {
            this.plugin.settings.template = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.style.height = '150px';
        text.inputEl.style.width = '100%';
        return text;
      });

    const feedsSection = containerEl.createDiv();
    feedsSection.style.cssText = 'margin-top: 30px;';
    feedsSection.createEl('h3', { text: '📡 RSS Feeds' });

    new Setting(feedsSection)
      .setName('Add New Feed')
      .addButton(button => button
        .setButtonText('+ Add Feed')
        .setCta()
        .onClick(async () => {
          this.plugin.settings.feeds.push({
            id: Date.now().toString(),
            url: '',
            name: `Feed ${this.plugin.settings.feeds.length + 1}`,
            folder: 'RSS Notes',
            startDate: '',
            fetchedLinks: [],
            lastSync: null,
            templateOverride: ''
          });
          await this.plugin.saveSettings();
          this.display();
        }));

    this.plugin.settings.feeds.forEach((feed, index) => {
      const feedContainer = containerEl.createDiv();
      feedContainer.style.cssText = 'border: 1px solid var(--background-modifier-border); padding: 20px; margin: 15px 0; border-radius: 8px; background: var(--background-secondary);';
      
      const feedHeader = feedContainer.createEl('div', { attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;' } });
      const feedTitleEl = feedHeader.createEl('h4', { text: `📰 ${feed.name || `Feed ${index + 1}`}` });
      
      new Setting(feedContainer)
        .setName('Feed Name')
        .addText(text => text
          .setPlaceholder(`Feed ${index + 1}`)
          .setValue(feed.name)
          .onChange(async (value) => {
            feed.name = value;
            feedTitleEl.textContent = `📰 ${feed.name || `Feed ${index + 1}`}`;
            await this.plugin.saveSettings();
          }));
          
      new Setting(feedContainer)
        .setName('Feed URL')
        .addText(text => text
          .setPlaceholder('https://example.com/feed.xml')
          .setValue(feed.url)
          .onChange(async (value) => {
            feed.url = value;
            await this.plugin.saveSettings();
          }));

      if (this.plugin.settings.folderStructure === 'separate') {
        new Setting(feedContainer)
          .setName('Target Folder')
          .addText(text => text
            .setPlaceholder(feed.name || 'RSS Notes')
            .setValue(feed.folder)
            .onChange(async (value) => {
              feed.folder = value;
              await this.plugin.saveSettings();
            }));
      }

      new Setting(feedContainer)
        .setName('Start Date Filter (Optional)')
        .setDesc('Import items published after this date (YYYY-MM-DD)')
        .addText(text => text
          .setPlaceholder('2024-01-01')
          .setValue(feed.startDate)
          .onChange(async (value) => {
            feed.startDate = value;
            await this.plugin.saveSettings();
          }));

      let statusString = `Status: ${feed.fetchedLinks.length} items imported.`;
      if (feed.lastSync) {
        statusString += ` Last synced: ${new Date(feed.lastSync).toLocaleString()}.`;
      } else {
        statusString += ' Never synced.';
      }
      const statusText = feedContainer.createEl('div', {
        text: statusString,
        attr: { style: 'margin: 10px 0; color: var(--text-muted); font-size: 0.9em;' }
      });

      const feedActions = new Setting(feedContainer)
        .setName('Actions')
        .addButton(button => button
          .setButtonText('🔍 Test')
          .setTooltip('Test feed connection and parsing')
          .onClick(async () => {
            button.setButtonText('Testing...');
            button.setDisabled(true);
            const health = await this.plugin.testFeedHealth(feed.url);
            if (health.success) {
              new Notice(`✅ Feed healthy: "${health.feedTitle}" (${health.itemCount} items)`);
              statusText.textContent = `Status: Feed healthy - ${health.itemCount} items found. ${feed.fetchedLinks.length} already imported.`;
            } else {
              new Notice(`❌ Feed error: ${health.error}`);
              statusText.textContent = `Status: Feed error - ${health.error}`;
            }
            button.setButtonText('🔍 Test');
            button.setDisabled(false);
          }))
        .addButton(button => button
          .setButtonText('📥 Fetch Now')
          .setTooltip('Fetch new items from this feed')
          .onClick(async () => {
            await this.plugin.fetchSingleFeed(feed);
            this.display();
          }))
        .addButton(button => button
          .setButtonText('🗑️ Clear History')
          .setTooltip('Clear the list of imported items to re-import everything')
          .setWarning()
          .onClick(async () => {
            feed.fetchedLinks = [];
            await this.plugin.saveSettings();
            new Notice(`History cleared for ${feed.name}`);
            this.display();
          }))
        .addButton(button => button
          .setButtonText('❌ Remove')
          .setTooltip('Remove this feed')
          .setWarning()
          .onClick(async () => {
            // Confirmation logic to prevent accidental deletion.
            if (button.buttonEl.dataset.confirming) {
              // If confirming, proceed with deletion
              this.plugin.settings.feeds.splice(index, 1);
              await this.plugin.saveSettings();
              new Notice(`${feed.name} removed`);
              this.display();
            } else {
              // If not confirming, enter confirmation state
              button.buttonEl.dataset.confirming = 'true';
              button.setButtonText('Confirm Remove?');
              
              // Reset after 3 seconds if not clicked again
              setTimeout(() => {
                if (button.buttonEl.isConnected && button.buttonEl.dataset.confirming) {
                  delete button.buttonEl.dataset.confirming;
                  button.setButtonText('❌ Remove');
                }
              }, 3000);
            }
          }));
    });
  }
}

module.exports = RssToNotePlugin;
// --- END OF PART 2 --- //