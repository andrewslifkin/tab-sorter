/**
 * Offline Tab Grouping Rules Engine
 * 
 * Provides deterministic, rules-based tab grouping without AI API calls.
 * Useful for corporate networks that block external AI APIs.
 * 
 * CLASSIFICATION PRIORITY (highest to lowest):
 * 1. Skip ungroupable: pinned, chrome://, chrome-extension://
 * 2. Project/subject extraction: Jira projects, Confluence spaces, SharePoint sites, GitHub repos, etc.
 * 3. Known site map: curated hostname suffix → group label + color
 * 4. Hostname family merge: related subdomains → single group (fallback only)
 * 5. Title keywords: weak domain hints from tab titles
 * 6. ETLD+1 fallback: cluster by registrable domain
 * 7. Group size policy: merge small groups, cap at 12, handle singletons
 * 8. Stable naming: consistent short labels and colors
 */

// ============================================================================
// PROJECT / SUBJECT EXTRACTION
// Extract project context from URLs and titles to avoid vendor mega-groups
// ============================================================================

/**
 * Extract project/subject context from tab
 * Priority over vendor grouping to avoid mega-groups
 * @param {Object} tab - Tab object with {id, title, url}
 * @param {URL} url - Parsed URL object
 * @returns {Object|null} {groupName, color} or null if no project found
 */
function extractProjectContext(tab, url) {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const title = tab.title || '';
  const searchParams = url.searchParams;
  
  // Atlassian (Jira, Confluence, etc.)
  if (hostname.includes('atlassian.net') || hostname.includes('jira.com')) {
    // Extract Jira project key from URL or title
    // Patterns: /browse/PROJ-123, /selectedIssue=PROJ-123, [PROJ-123] in title
    
    // Check URL pathname for /browse/PROJECTKEY-number
    const browseMatch = pathname.match(/\/browse\/([A-Z][A-Z0-9]+)-\d+/);
    if (browseMatch) {
      return { groupName: `Jira ${browseMatch[1]}`, color: 'blue' };
    }
    
    // Check URL search params for selectedIssue
    const selectedIssue = searchParams.get('selectedIssue');
    if (selectedIssue) {
      const issueMatch = selectedIssue.match(/^([A-Z][A-Z0-9]+)-\d+$/);
      if (issueMatch) {
        return { groupName: `Jira ${issueMatch[1]}`, color: 'blue' };
      }
    }
    
    // Check title for [PROJECTKEY-123] or PROJECTKEY-123
    const titleMatch = title.match(/\b([A-Z][A-Z0-9]+)-\d+\b/);
    if (titleMatch) {
      return { groupName: `Jira ${titleMatch[1]}`, color: 'blue' };
    }
    
    // Confluence space detection
    if (pathname.includes('/wiki/spaces/')) {
      const spaceMatch = pathname.match(/\/wiki\/spaces\/([^\/]+)/);
      if (spaceMatch) {
        const spaceKey = spaceMatch[1].toUpperCase();
        return { groupName: `Confluence ${spaceKey}`, color: 'blue' };
      }
    }
    
    // Fallback: check if it's clearly Jira or Confluence from path
    if (pathname.includes('/browse/') || pathname.includes('/jira/')) {
      return { groupName: 'Jira', color: 'blue' };
    }
    if (pathname.includes('/wiki/') || pathname.includes('/confluence/')) {
      return { groupName: 'Confluence', color: 'blue' };
    }
    
    // No project signal, return null to fall through to vendor family
    return null;
  }
  
  // Microsoft SharePoint
  if (hostname.includes('sharepoint.com')) {
    // Extract site name from URL: https://company.sharepoint.com/sites/sitename/
    const siteMatch = pathname.match(/\/sites\/([^\/]+)/);
    if (siteMatch) {
      const siteName = siteMatch[1].replace(/-/g, ' ');
      const titleCase = siteName.split(' ').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      return { groupName: `SP ${titleCase}`, color: 'blue' };
    }
    
    // No site path, fall through to generic SharePoint
    return null;
  }
  
  // Microsoft Teams
  if (hostname.includes('teams.microsoft.com')) {
    // Try to extract team/channel from title
    // Title format often: "Channel Name | Team Name | Microsoft Teams"
    const titleParts = title.split('|').map(p => p.trim());
    if (titleParts.length >= 2 && titleParts[titleParts.length - 1].includes('Teams')) {
      const teamName = titleParts[titleParts.length - 2];
      if (teamName && teamName.length > 0 && teamName.length < 30) {
        return { groupName: `Teams ${teamName}`, color: 'purple' };
      }
    }
    
    // Fallback to generic Teams
    return { groupName: 'Microsoft Teams', color: 'purple' };
  }
  
  // Azure DevOps
  if (hostname.includes('dev.azure.com') || hostname.includes('visualstudio.com')) {
    // Extract project from URL: dev.azure.com/org/project/
    const projectMatch = pathname.match(/\/[^\/]+\/([^\/]+)/);
    if (projectMatch) {
      const projectName = projectMatch[1].replace(/-|_/g, ' ');
      const titleCase = projectName.split(' ').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      return { groupName: `ADO ${titleCase}`, color: 'blue' };
    }
    
    // Fallback to generic Azure DevOps
    return { groupName: 'Azure DevOps', color: 'blue' };
  }
  
  // GitHub org/repo
  if (hostname === 'github.com') {
    // Extract org/repo from URL: github.com/org/repo
    const repoMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)/);
    if (repoMatch && repoMatch[1] && repoMatch[2]) {
      const org = repoMatch[1];
      const repo = repoMatch[2];
      
      // Skip user pages, settings, etc.
      if (['settings', 'notifications', 'pulls', 'issues', 'explore', 'dashboard'].includes(org)) {
        return { groupName: 'GitHub', color: 'grey' };
      }
      
      // Use repo name as group (shorter than org/repo)
      return { groupName: repo, color: 'grey' };
    }
    
    // Fallback to generic GitHub for dashboard/pulls/etc.
    return { groupName: 'GitHub', color: 'grey' };
  }
  
  // No project context found
  return null;
}

// ============================================================================
// CURATED SITE MAP
// Maps hostname suffixes to [groupName, color, priority]
// Priority: lower number = higher priority (for subdomain conflicts)
// Note: Atlassian and some Microsoft entries removed/reduced to let project extraction take priority
// ============================================================================

const KNOWN_SITES = {
  // Google Workspace
  'mail.google.com': ['Gmail', 'red', 1],
  'docs.google.com': ['Google Docs', 'blue', 1],
  'sheets.google.com': ['Google Docs', 'blue', 1],
  'slides.google.com': ['Google Docs', 'blue', 1],
  'drive.google.com': ['Google Drive', 'yellow', 1],
  'calendar.google.com': ['Google Calendar', 'blue', 1],
  'meet.google.com': ['Google Meet', 'green', 1],
  'chat.google.com': ['Google Chat', 'green', 1],
  'keep.google.com': ['Google Keep', 'yellow', 1],
  
  // Microsoft 365 (reduced - most handled by project extraction)
  'outlook.office.com': ['Outlook', 'blue', 1],
  'outlook.live.com': ['Outlook', 'blue', 1],
  'office.com': ['Microsoft Office', 'blue', 1],
  'onedrive.live.com': ['OneDrive', 'blue', 1],
  'microsoft365.com': ['Microsoft 365', 'blue', 1],
  
  // Development & Code (GitHub handled by project extraction)
  'gist.github.com': ['GitHub', 'grey', 1],
  'gitlab.com': ['GitLab', 'orange', 1],
  'bitbucket.org': ['Bitbucket', 'blue', 1],
  'stackoverflow.com': ['Stack Overflow', 'orange', 1],
  'stackexchange.com': ['Stack Overflow', 'orange', 2],
  'serverfault.com': ['Stack Overflow', 'orange', 2],
  'superuser.com': ['Stack Overflow', 'orange', 2],
  
  // Project Management (Atlassian handled by project extraction)
  'trello.com': ['Trello', 'blue', 1],
  'asana.com': ['Asana', 'pink', 1],
  'monday.com': ['Monday', 'red', 1],
  'clickup.com': ['ClickUp', 'purple', 1],
  'linear.app': ['Linear', 'purple', 1],
  'notion.so': ['Notion', 'grey', 1],
  'notion.site': ['Notion', 'grey', 2],
  'coda.io': ['Coda', 'orange', 1],
  'airtable.com': ['Airtable', 'yellow', 1],
  
  // Communication
  'slack.com': ['Slack', 'purple', 1],
  'discord.com': ['Discord', 'purple', 1],
  'zoom.us': ['Zoom', 'blue', 1],
  'whereby.com': ['Whereby', 'blue', 1],
  'miro.com': ['Miro', 'yellow', 1],
  
  // Design
  'figma.com': ['Figma', 'pink', 1],
  'figjam.com': ['Figma', 'pink', 1],
  'sketch.com': ['Sketch', 'yellow', 1],
  'framer.com': ['Framer', 'blue', 1],
  'canva.com': ['Canva', 'cyan', 1],
  'adobe.com': ['Adobe', 'red', 2],
  'invisionapp.com': ['InVision', 'pink', 1],
  
  // Cloud & DevOps
  'vercel.com': ['Vercel', 'grey', 1],
  'vercel.app': ['Vercel', 'grey', 2],
  'netlify.com': ['Netlify', 'cyan', 1],
  'netlify.app': ['Netlify', 'cyan', 2],
  'heroku.com': ['Heroku', 'purple', 1],
  'railway.app': ['Railway', 'purple', 1],
  'render.com': ['Render', 'blue', 1],
  'aws.amazon.com': ['AWS', 'orange', 1],
  'console.aws.amazon.com': ['AWS', 'orange', 1],
  'azure.microsoft.com': ['Azure', 'blue', 1],
  'portal.azure.com': ['Azure', 'blue', 1],
  'console.cloud.google.com': ['Google Cloud', 'blue', 1],
  'digitalocean.com': ['DigitalOcean', 'blue', 1],
  
  // AI / LLM
  'chat.openai.com': ['ChatGPT', 'green', 1],
  'openai.com': ['ChatGPT', 'green', 2],
  'claude.ai': ['Claude', 'orange', 1],
  'anthropic.com': ['Claude', 'orange', 2],
  'gemini.google.com': ['Gemini', 'blue', 1],
  'bard.google.com': ['Gemini', 'blue', 1],
  'poe.com': ['Poe', 'purple', 1],
  'perplexity.ai': ['Perplexity', 'blue', 1],
  
  // Storage & Files
  'dropbox.com': ['Dropbox', 'blue', 1],
  'box.com': ['Box', 'blue', 1],
  'wetransfer.com': ['WeTransfer', 'blue', 1],
  
  // Social Media
  'twitter.com': ['Twitter', 'blue', 1],
  'x.com': ['Twitter', 'grey', 1],
  'linkedin.com': ['LinkedIn', 'blue', 1],
  'facebook.com': ['Facebook', 'blue', 1],
  'instagram.com': ['Instagram', 'pink', 1],
  'reddit.com': ['Reddit', 'orange', 1],
  'threads.net': ['Threads', 'grey', 1],
  'mastodon.social': ['Mastodon', 'purple', 2],
  'bsky.app': ['Bluesky', 'blue', 1],
  
  // Content & Media
  'youtube.com': ['YouTube', 'red', 1],
  'youtu.be': ['YouTube', 'red', 1],
  'vimeo.com': ['Vimeo', 'blue', 1],
  'twitch.tv': ['Twitch', 'purple', 1],
  'spotify.com': ['Spotify', 'green', 1],
  'soundcloud.com': ['SoundCloud', 'orange', 1],
  'medium.com': ['Medium', 'grey', 1],
  'dev.to': ['Dev.to', 'grey', 1],
  'hashnode.com': ['Hashnode', 'blue', 1],
  'substack.com': ['Substack', 'orange', 2],
  
  // E-commerce
  'amazon.com': ['Amazon', 'orange', 1],
  'amazon.co.uk': ['Amazon', 'orange', 1],
  'ebay.com': ['eBay', 'blue', 1],
  'etsy.com': ['Etsy', 'orange', 1],
  'shopify.com': ['Shopify', 'green', 1],
  
  // Entertainment
  'netflix.com': ['Netflix', 'red', 1],
  'hulu.com': ['Hulu', 'green', 1],
  'disneyplus.com': ['Disney+', 'blue', 1],
  'primevideo.com': ['Prime Video', 'blue', 1],
  'hbomax.com': ['HBO Max', 'purple', 1],
  
  // News & Reference
  'wikipedia.org': ['Wikipedia', 'grey', 1],
  'nytimes.com': ['News', 'grey', 2],
  'theguardian.com': ['News', 'grey', 2],
  'wsj.com': ['News', 'grey', 2],
  'bbc.com': ['News', 'grey', 2],
  'cnn.com': ['News', 'grey', 2],
  'reuters.com': ['News', 'grey', 2],
  
  // Productivity
  'todoist.com': ['Todoist', 'red', 1],
  'evernote.com': ['Evernote', 'green', 1],
  'onenote.com': ['OneNote', 'purple', 1],
  'obsidian.md': ['Obsidian', 'purple', 1],
  'roamresearch.com': ['Roam', 'blue', 1],
  
  // Analytics & Marketing
  'analytics.google.com': ['Analytics', 'orange', 1],
  'amplitude.com': ['Analytics', 'blue', 2],
  'mixpanel.com': ['Analytics', 'blue', 2],
  'segment.com': ['Segment', 'green', 1],
  'mailchimp.com': ['Mailchimp', 'yellow', 1],
  'hubspot.com': ['HubSpot', 'orange', 1],
  'salesforce.com': ['Salesforce', 'blue', 1],
};

// ============================================================================
// HOSTNAME FAMILY PATTERNS
// Regex patterns that should be merged into a single group
// Used as FALLBACK only when project extraction finds nothing
// Atlassian and Microsoft patterns reduced to serve only as last resort
// ============================================================================

const HOSTNAME_FAMILIES = [
  // Google services (catch-all for unlisted subdomains)
  { pattern: /^[^.]+\.google\.com$/, group: 'Google', color: 'blue' },
  
  // Microsoft domains (fallback only - project extraction should catch most)
  { pattern: /^[^.]+\.microsoft\.com$/, group: 'Microsoft', color: 'blue' },
  { pattern: /^[^.]+\.live\.com$/, group: 'Microsoft', color: 'blue' },
  
  // Atlassian (fallback only - project extraction should catch most)
  { pattern: /^[^.]+\.atlassian\.net$/, group: 'Atlassian', color: 'blue' },
  
  // Slack workspaces
  { pattern: /^[^.]+\.slack\.com$/, group: 'Slack', color: 'purple' },
  
  // Notion
  { pattern: /^[^.]+\.notion\.so$/, group: 'Notion', color: 'grey' },
  { pattern: /^[^.]+\.notion\.site$/, group: 'Notion', color: 'grey' },
  
  // Vercel deployments
  { pattern: /^[^.]+\.vercel\.app$/, group: 'Vercel', color: 'grey' },
  
  // Netlify deployments
  { pattern: /^[^.]+\.netlify\.app$/, group: 'Netlify', color: 'cyan' },
  
  // Heroku
  { pattern: /^[^.]+\.herokuapp\.com$/, group: 'Heroku', color: 'purple' },
  
  // GitHub Pages
  { pattern: /^[^.]+\.github\.io$/, group: 'GitHub Pages', color: 'grey' },
  
  // GitLab Pages
  { pattern: /^[^.]+\.gitlab\.io$/, group: 'GitLab Pages', color: 'orange' },
];

// ============================================================================
// TITLE KEYWORD HINTS
// Map keywords in titles to potential group names (only when domain is weak)
// ============================================================================

const TITLE_KEYWORDS = {
  'pull request': 'Code Review',
  'merge request': 'Code Review',
  'RFC': 'Documents',
  'proposal': 'Documents',
  'invoice': 'Finance',
  'receipt': 'Finance',
  'standup': 'Meetings',
  'retrospective': 'Meetings',
  'sprint': 'Planning',
  'roadmap': 'Planning',
  'dashboard': 'Analytics',
  'metrics': 'Analytics',
};

// ============================================================================
// COLOR PALETTE
// Consistent color assignments for group stability
// ============================================================================

const AVAILABLE_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

// Default colors for common group categories
const DEFAULT_COLORS = {
  'Other': 'grey',
  'News': 'grey',
  'Social': 'blue',
  'Shopping': 'orange',
  'Entertainment': 'red',
  'Documents': 'yellow',
  'Code Review': 'purple',
  'Finance': 'green',
  'Meetings': 'blue',
  'Planning': 'purple',
  'Analytics': 'orange',
};

// ============================================================================
// MAIN GROUPING FUNCTION
// ============================================================================

/**
 * Group tabs using offline heuristics
 * @param {Array} tabs - Array of tab objects with {id, title, url, pinned}
 * @returns {Array} Array of group objects with {name, color, tabIds}
 */
function groupTabsOffline(tabs) {
  // Filter out ungroupable tabs
  const groupableTabs = tabs.filter(tab => {
    if (!tab || !tab.url) return false;
    const url = tab.url;
    return !url.startsWith('chrome://') && 
           !url.startsWith('chrome-extension://') &&
           !tab.pinned;
  });
  
  if (groupableTabs.length === 0) {
    return [];
  }
  
  // Step 1: Classify each tab into a group
  const tabClassifications = groupableTabs.map(tab => {
    const classification = classifyTab(tab);
    return {
      tab,
      ...classification
    };
  });
  
  // Step 2: Aggregate into groups
  const groupMap = new Map();
  
  tabClassifications.forEach(({ tab, groupName, color }) => {
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        name: groupName,
        color: color,
        tabIds: []
      });
    }
    groupMap.get(groupName).tabIds.push(tab.id);
  });
  
  let groups = Array.from(groupMap.values());
  
  // Step 3: Apply group size policy
  groups = applyGroupSizePolicy(groups, groupableTabs.length);
  
  // Step 4: Sort groups by size (largest first) for consistent ordering
  groups.sort((a, b) => b.tabIds.length - a.tabIds.length);
  
  return groups;
}

/**
 * Classify a single tab into a group
 * @param {Object} tab - Tab object with {id, title, url}
 * @returns {Object} {groupName, color}
 */
function classifyTab(tab) {
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname.toLowerCase();
    const title = (tab.title || '').toLowerCase();
    
    // Priority 1: Project/subject extraction (Jira projects, SharePoint sites, etc.)
    const projectContext = extractProjectContext(tab, url);
    if (projectContext) {
      return projectContext;
    }
    
    // Priority 2: Check known sites (exact suffix match)
    const knownSite = findKnownSite(hostname);
    if (knownSite) {
      return { groupName: knownSite.name, color: knownSite.color };
    }
    
    // Priority 3: Check hostname families (pattern match fallback)
    const family = findHostnameFamily(hostname);
    if (family) {
      return { groupName: family.group, color: family.color };
    }
    
    // Priority 4: Title keyword hints (only for generic domains)
    if (isGenericDomain(hostname)) {
      const keywordGroup = findTitleKeyword(title);
      if (keywordGroup) {
        return { 
          groupName: keywordGroup, 
          color: DEFAULT_COLORS[keywordGroup] || 'grey' 
        };
      }
    }
    
    // Priority 5: ETLD+1 fallback - use registrable domain
    const domainLabel = extractDomainLabel(hostname);
    return { 
      groupName: domainLabel, 
      color: assignColorForDomain(domainLabel) 
    };
    
  } catch (e) {
    // Fallback for invalid URLs
    return { groupName: 'Other', color: 'grey' };
  }
}

/**
 * Find known site by hostname suffix (longest match wins)
 * @param {string} hostname
 * @returns {Object|null} {name, color}
 */
function findKnownSite(hostname) {
  let bestMatch = null;
  let bestLength = 0;
  
  for (const [suffix, [name, color, priority]] of Object.entries(KNOWN_SITES)) {
    if (hostname === suffix || hostname.endsWith('.' + suffix)) {
      if (suffix.length > bestLength) {
        bestMatch = { name, color, priority };
        bestLength = suffix.length;
      } else if (suffix.length === bestLength && priority < bestMatch.priority) {
        bestMatch = { name, color, priority };
      }
    }
  }
  
  return bestMatch;
}

/**
 * Find hostname family by pattern
 * @param {string} hostname
 * @returns {Object|null} {group, color}
 */
function findHostnameFamily(hostname) {
  for (const family of HOSTNAME_FAMILIES) {
    if (family.pattern.test(hostname)) {
      return { group: family.group, color: family.color };
    }
  }
  return null;
}

/**
 * Check if domain is generic (localhost, IP, common non-specific domains)
 * @param {string} hostname
 * @returns {boolean}
 */
function isGenericDomain(hostname) {
  return hostname === 'localhost' || 
         /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
         hostname.endsWith('.local') ||
         hostname.endsWith('.test') ||
         hostname.endsWith('.dev') ||
         hostname.endsWith('.localhost');
}

/**
 * Find group name from title keywords
 * @param {string} title
 * @returns {string|null}
 */
function findTitleKeyword(title) {
  for (const [keyword, group] of Object.entries(TITLE_KEYWORDS)) {
    if (title.includes(keyword.toLowerCase())) {
      return group;
    }
  }
  return null;
}

/**
 * Extract clean domain label from hostname
 * @param {string} hostname
 * @returns {string}
 */
function extractDomainLabel(hostname) {
  // Remove www prefix
  let domain = hostname.replace(/^www\./, '');
  
  // Extract registrable domain (simple heuristic)
  const parts = domain.split('.');
  
  // Handle common TLDs
  if (parts.length >= 2) {
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    
    // Two-part TLDs (co.uk, com.au, etc.)
    if (parts.length >= 3 && ['co', 'com', 'org', 'net', 'ac', 'gov'].includes(sld)) {
      domain = parts.slice(-3).join('.');
    } else {
      domain = parts.slice(-2).join('.');
    }
  }
  
  // Convert to Title Case
  const mainName = domain.split('.')[0];
  return mainName.charAt(0).toUpperCase() + mainName.slice(1);
}

/**
 * Assign a deterministic color for a domain label
 * @param {string} label
 * @returns {string}
 */
function assignColorForDomain(label) {
  // Check default colors first
  if (DEFAULT_COLORS[label]) {
    return DEFAULT_COLORS[label];
  }
  
  // Hash the label to a color index (deterministic)
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash) + label.charCodeAt(i);
    hash = hash & hash;
  }
  
  return AVAILABLE_COLORS[Math.abs(hash) % AVAILABLE_COLORS.length];
}

/**
 * Apply group size policy: merge small groups, cap at 12, handle singletons
 * @param {Array} groups
 * @param {number} totalTabs
 * @returns {Array}
 */
function applyGroupSizePolicy(groups, totalTabs) {
  // Separate known services from unknown domains
  const knownGroups = groups.filter(g => isKnownGroupName(g.name));
  const unknownGroups = groups.filter(g => !isKnownGroupName(g.name));
  
  // Always keep all known services separate (even singletons)
  // These are recognized services the user likely cares about
  
  // For unknown domains, apply merging rules
  const unknownSingletons = unknownGroups.filter(g => g.tabIds.length === 1);
  const unknownMulti = unknownGroups.filter(g => g.tabIds.length > 1);
  
  // If we have too many groups total, merge smallest unknowns
  const totalGroupCount = knownGroups.length + unknownGroups.length;
  
  if (totalGroupCount > 12) {
    // Sort unknown by size
    unknownGroups.sort((a, b) => a.tabIds.length - b.tabIds.length);
    
    // Calculate how many unknowns to merge
    const maxUnknowns = 12 - knownGroups.length - 1; // -1 for "Other" group
    const toMerge = unknownGroups.slice(0, Math.max(0, unknownGroups.length - maxUnknowns));
    const toKeep = unknownGroups.slice(toMerge.length);
    
    if (toMerge.length > 0) {
      const otherGroup = {
        name: 'Other',
        color: 'grey',
        tabIds: toMerge.flatMap(g => g.tabIds)
      };
      return [...knownGroups, ...toKeep, otherGroup];
    }
  }
  
  // Handle unknown singletons: if 3+ unknown orphans, create "Other" group
  // But keep known service singletons separate
  if (unknownSingletons.length >= 3) {
    const otherGroup = {
      name: 'Other',
      color: 'grey',
      tabIds: unknownSingletons.flatMap(g => g.tabIds)
    };
    return [...knownGroups, ...unknownMulti, otherGroup];
  }
  
  // Otherwise keep everything separate
  return groups;
}

/**
 * Check if a group name is from our known sites/families
 * @param {string} name
 * @returns {boolean}
 */
function isKnownGroupName(name) {
  // Check if name appears in KNOWN_SITES values
  const knownNames = new Set(
    Object.values(KNOWN_SITES).map(([n]) => n)
  );
  
  // Check if name appears in HOSTNAME_FAMILIES
  const familyNames = new Set(
    HOSTNAME_FAMILIES.map(f => f.group)
  );
  
  // Check if it's a project-based group (starts with known prefixes)
  const isProjectGroup = 
    name.startsWith('Jira ') ||
    name.startsWith('Confluence ') ||
    name.startsWith('SP ') ||
    name.startsWith('Teams ') ||
    name.startsWith('ADO ');
  
  return knownNames.has(name) || familyNames.has(name) || Object.keys(DEFAULT_COLORS).includes(name) || isProjectGroup;
}

// ============================================================================
// EXPORTS (for both browser and Node.js)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = {
    groupTabsOffline,
    classifyTab,
    extractProjectContext,
    KNOWN_SITES,
    HOSTNAME_FAMILIES,
  };
} else {
  // Browser - expose to global scope
  window.OfflineGrouping = {
    groupTabsOffline,
    classifyTab,
    extractProjectContext,
    KNOWN_SITES,
    HOSTNAME_FAMILIES,
  };
}
