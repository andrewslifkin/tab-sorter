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
    
    // Check for Jira board or project list pages
    const boardMatch = pathname.match(/\/jira\/software\/(?:c\/)?projects\/([A-Z][A-Z0-9]+)\/boards/);
    if (boardMatch) {
      return { groupName: `Jira ${boardMatch[1]}`, color: 'blue' };
    }
    
    const projectMatch = pathname.match(/\/projects\/([A-Z][A-Z0-9]+)/);
    if (projectMatch) {
      return { groupName: `Jira ${projectMatch[1]}`, color: 'blue' };
    }
    
    // Confluence space detection
    if (pathname.includes('/wiki/spaces/')) {
      const spaceMatch = pathname.match(/\/wiki\/spaces\/([^\/]+)/);
      if (spaceMatch) {
        const spaceKey = spaceMatch[1].toUpperCase();
        return { groupName: `Confluence ${spaceKey}`, color: 'blue' };
      }
    }
    
    // Check URL query params for space
    const spaceParam = searchParams.get('spaceKey') || searchParams.get('space');
    if (spaceParam) {
      return { groupName: `Confluence ${spaceParam.toUpperCase()}`, color: 'blue' };
    }
    
    // No project signal found - return null instead of mega-group
    // This lets domain/org extraction take over
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
    
    // Extract tenant/org name as fallback (better than "SharePoint")
    const tenantMatch = hostname.match(/^([^.]+)\.sharepoint\.com$/);
    if (tenantMatch) {
      const tenant = tenantMatch[1];
      if (tenant && tenant !== 'sharepoint') {
        return { groupName: `${tenant} SharePoint`, color: 'blue' };
      }
    }
    
    // No site path, return null to use domain label
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
    
    // Try to extract from URL groupId or threadId
    const groupId = searchParams.get('groupId');
    if (groupId) {
      // If we have a groupId, try to get a readable name from title
      const cleanTitle = title.replace(/\s*\|\s*Microsoft Teams\s*$/i, '').trim();
      if (cleanTitle && cleanTitle.length > 0 && cleanTitle.length < 50) {
        return { groupName: `Teams ${cleanTitle}`, color: 'purple' };
      }
    }
    
    // No specific team extracted - return null instead of mega-group
    return null;
  }
  
  // Azure DevOps
  if (hostname.includes('dev.azure.com') || hostname.includes('visualstudio.com')) {
    // Extract project from URL: dev.azure.com/org/project/
    const projectMatch = pathname.match(/\/[^\/]+\/([^\/]+)/);
    if (projectMatch) {
      const projectName = projectMatch[1].replace(/-|_/g, ' ');
      // Skip if it's just a settings or admin page
      if (!['_settings', '_admin', '_apis'].includes(projectMatch[1])) {
        const titleCase = projectName.split(' ').map(w => 
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
        return { groupName: `ADO ${titleCase}`, color: 'blue' };
      }
    }
    
    // Extract org name as fallback
    const orgMatch = pathname.match(/^\/([^\/]+)/);
    if (orgMatch && orgMatch[1]) {
      const org = orgMatch[1];
      return { groupName: `ADO ${org}`, color: 'blue' };
    }
    
    // No project signal - return null instead of mega-group
    return null;
  }
  
  // GitHub org/repo
  if (hostname === 'github.com') {
    // Extract org/repo from URL: github.com/org/repo
    const repoMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)/);
    if (repoMatch && repoMatch[1] && repoMatch[2]) {
      const org = repoMatch[1];
      const repo = repoMatch[2];
      
      // Skip user pages, settings, etc. and return null to use domain label
      if (['settings', 'notifications', 'pulls', 'issues', 'explore', 'dashboard', 'codespaces', 'organizations'].includes(org)) {
        return null;
      }
      
      // Use org/repo format if combined length is reasonable
      const combined = `${org}/${repo}`;
      if (combined.length <= 30) {
        return { groupName: combined, color: 'grey' };
      }
      
      // Otherwise just use repo name (with collision risk, but cleaner)
      return { groupName: repo, color: 'grey' };
    }
    
    // For org pages without repo
    const orgMatch = pathname.match(/^\/([^\/]+)\/?$/);
    if (orgMatch && orgMatch[1]) {
      const org = orgMatch[1];
      // Skip special pages
      if (!['settings', 'notifications', 'pulls', 'issues', 'explore', 'dashboard', 'codespaces', 'organizations'].includes(org)) {
        return { groupName: org, color: 'grey' };
      }
    }
    
    // No org/repo context - return null instead of "GitHub" mega-group
    return null;
  }
  
  // Figma - group by file to avoid one mega "Figma" dump
  if (hostname === 'figma.com' || hostname === 'www.figma.com') {
    // Patterns: /design/:filekey/:filename, /board/:filekey, /proto/:filekey, /file/:filekey
    // File keys are typically 22+ chars but be lenient for shorter ones too
    const fileMatch = pathname.match(/^\/(design|board|proto|file|slides|deck)\/([0-9a-zA-Z]{10,128})(?:\/([^\/\?]+))?/);
    if (fileMatch) {
      const fileType = fileMatch[1];
      const fileName = fileMatch[3];
      
      // Use file name if present, otherwise use file type
      if (fileName) {
        // Clean up the file name - decode URI, replace dashes/underscores with spaces, limit length
        const cleanName = decodeURIComponent(fileName)
          .replace(/[-_]/g, ' ')
          .substring(0, 25);
        return { groupName: `Figma ${cleanName}`, color: 'pink' };
      }
      
      // Fallback to file type if no name (less useful but better than mega-group)
      const typeLabel = fileType === 'design' ? 'Design' : fileType === 'board' ? 'Board' : fileType === 'proto' ? 'Proto' : 'File';
      return { groupName: `Figma ${typeLabel}`, color: 'pink' };
    }
    
    // No file context - return null instead of "Figma" mega-group
    return null;
  }
  
  // X / Twitter - split by profile, list, search, status to avoid mega-pile
  if (hostname === 'x.com' || hostname === 'twitter.com') {
    // Pattern 1: Profile - /username (not starting with i/)
    const profileMatch = pathname.match(/^\/([a-zA-Z0-9_]{1,15})(?:\/(?:with_replies|media|likes)?)?$/);
    if (profileMatch && !pathname.startsWith('/i/')) {
      const handle = profileMatch[1];
      // Skip special paths
      if (!['search', 'home', 'explore', 'notifications', 'messages', 'settings', 'compose'].includes(handle)) {
        return { groupName: `@${handle}`, color: 'grey' };
      }
    }
    
    // Pattern 2: Status/tweet - /username/status/id or /i/status/id
    const statusMatch = pathname.match(/^\/(?:([a-zA-Z0-9_]+)\/)?status\/(\d+)/);
    if (statusMatch) {
      const handle = statusMatch[1];
      if (handle) {
        return { groupName: `@${handle}`, color: 'grey' };
      }
      // Generic status without handle
      return { groupName: 'X Posts', color: 'grey' };
    }
    
    // Pattern 3: Lists - /i/lists/id
    if (pathname.startsWith('/i/lists/')) {
      const listMatch = pathname.match(/^\/i\/lists\/(\d+)/);
      if (listMatch) {
        // Try to get list name from title if available
        const listName = title.split('|')[0].trim();
        if (listName && listName.length > 0 && listName.length < 30 && !listName.toLowerCase().includes('twitter') && !listName.toLowerCase().includes(' / x')) {
          return { groupName: `X List ${listName}`, color: 'grey' };
        }
        return { groupName: 'X Lists', color: 'grey' };
      }
    }
    
    // Pattern 4: Search - /search?q=...
    if (pathname === '/search') {
      const query = searchParams.get('q');
      if (query) {
        // Clean and shorten the query
        const cleanQuery = decodeURIComponent(query)
          .replace(/[+%20]/g, ' ')
          .substring(0, 20);
        return { groupName: `X "${cleanQuery}"`, color: 'grey' };
      }
      return { groupName: 'X Search', color: 'grey' };
    }
    
    // Pattern 5: Hashtag - /hashtag/word
    const hashtagMatch = pathname.match(/^\/hashtag\/([^\/\?]+)/);
    if (hashtagMatch) {
      const hashtag = hashtagMatch[1];
      return { groupName: `#${hashtag}`, color: 'grey' };
    }
    
    // No specific context - return null instead of "Twitter"/"X" mega-group
    return null;
  }
  
  // Slack - group by workspace and/or channel to avoid mega "Slack"
  if (hostname === 'app.slack.com') {
    // Pattern: /client/TWORKSPACE_ID/CHANNEL_ID or /client/TWORKSPACE_ID
    const clientMatch = pathname.match(/^\/client\/([TE][A-Z0-9]+)(?:\/([C][A-Z0-9]+))?/);
    if (clientMatch) {
      const workspaceId = clientMatch[1];
      const channelId = clientMatch[2];
      
      // Try to extract workspace name from title
      // Title format often: "Channel Name | Workspace Name | Slack" or "Workspace Name | Slack"
      const titleParts = title.split('|').map(p => p.trim());
      
      if (titleParts.length >= 2) {
        // Remove "Slack" suffix
        const filtered = titleParts.filter(p => !p.toLowerCase().includes('slack'));
        
        if (filtered.length === 2) {
          // Channel | Workspace
          const channelName = filtered[0];
          const workspaceName = filtered[1];
          if (channelName.length > 0 && channelName.length < 25) {
            return { groupName: `Slack ${channelName}`, color: 'purple' };
          }
        } else if (filtered.length === 1) {
          // Just workspace name
          const workspaceName = filtered[0];
          if (workspaceName.length > 0 && workspaceName.length < 25) {
            return { groupName: `Slack ${workspaceName}`, color: 'purple' };
          }
        }
      }
      
      // Fallback: use channel ID suffix if available
      if (channelId) {
        return { groupName: `Slack Ch-${channelId.substring(1, 6)}`, color: 'purple' };
      }
      
      // Fallback: use workspace ID suffix
      return { groupName: `Slack WS-${workspaceId.substring(1, 6)}`, color: 'purple' };
    }
    
    // No workspace/channel context - return null
    return null;
  }
  
  // Linear - group by team/project, not one mega "Linear"
  if (hostname === 'linear.app') {
    // Pattern 1: Issue - /workspace/issue/TEAMKEY-NUMBER/slug
    const issueMatch = pathname.match(/^\/[^\/]+\/issue\/([A-Z][A-Z0-9]*)-\d+/);
    if (issueMatch) {
      const teamKey = issueMatch[1];
      return { groupName: `Linear ${teamKey}`, color: 'purple' };
    }
    
    // Pattern 2: Team view - /workspace/team/TEAMKEY or /workspace/TEAMKEY
    const teamMatch = pathname.match(/^\/[^\/]+\/(?:team\/)?([A-Z][A-Z0-9]{1,10})(?:\/|$)/);
    if (teamMatch) {
      const teamKey = teamMatch[1];
      // Make sure it's uppercase and looks like a team key
      if (teamKey === teamKey.toUpperCase() && teamKey.length <= 10) {
        return { groupName: `Linear ${teamKey}`, color: 'purple' };
      }
    }
    
    // Pattern 3: Project - /workspace/project/slug
    const projectMatch = pathname.match(/^\/[^\/]+\/project\/([^\/\?]+)/);
    if (projectMatch) {
      let projectSlug = projectMatch[1];
      // Remove trailing ID-like suffix (e.g., -abc123)
      projectSlug = projectSlug.replace(/-[0-9a-z]{6,}$/i, '');
      // Clean up slug - replace dashes with spaces, title case, limit length
      const projectName = projectSlug
        .replace(/-/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .substring(0, 20);
      return { groupName: `Linear ${projectName}`, color: 'purple' };
    }
    
    // No team/project signal - return null instead of "Linear" mega-group
    return null;
  }
  
  // Notion - group by workspace or page context, not one mega "Notion"
  if (hostname === 'notion.so' || hostname === 'www.notion.so' || hostname === 'app.notion.com' || hostname.endsWith('.notion.site')) {
    // Pattern 1: New format - app.notion.com/p/Page-Title-{32-hex-id}
    if (hostname === 'app.notion.com' && pathname.startsWith('/p/')) {
      const pageMatch = pathname.match(/^\/p\/([^\/\?]+)-([0-9a-f]{32})/);
      if (pageMatch) {
        const pageTitle = pageMatch[1];
        // Clean up page title - decode URI, replace dashes with spaces, limit length
        const cleanTitle = decodeURIComponent(pageTitle)
          .replace(/-/g, ' ')
          .substring(0, 20);
        return { groupName: `Notion ${cleanTitle}`, color: 'grey' };
      }
    }
    
    // Pattern 2: Old format - notion.so/workspace/Page-Title-{32-hex-id}
    if ((hostname === 'notion.so' || hostname === 'www.notion.so') && pathname.length > 1) {
      const oldMatch = pathname.match(/^\/([^\/]+)\/([^\/\?]+)-([0-9a-f]{32})/);
      if (oldMatch) {
        const workspace = oldMatch[1];
        const pageTitle = oldMatch[2];
        
        // Use workspace name if it looks reasonable (not a UUID)
        if (workspace && workspace.length > 0 && workspace.length < 25 && !workspace.match(/^[0-9a-f]{32}$/)) {
          return { groupName: `Notion ${workspace}`, color: 'grey' };
        }
        
        // Fallback to page title
        const cleanTitle = decodeURIComponent(pageTitle)
          .replace(/-/g, ' ')
          .substring(0, 20);
        return { groupName: `Notion ${cleanTitle}`, color: 'grey' };
      }
      
      // Simple workspace path - /workspace
      const workspaceMatch = pathname.match(/^\/([^\/]+)\/?$/);
      if (workspaceMatch && workspaceMatch[1]) {
        const workspace = workspaceMatch[1];
        if (workspace.length > 0 && workspace.length < 25 && !workspace.match(/^[0-9a-f]{32}$/)) {
          return { groupName: `Notion ${workspace}`, color: 'grey' };
        }
      }
    }
    
    // Pattern 3: notion.site - custom domain, use subdomain if available
    if (hostname.endsWith('.notion.site')) {
      const subdomain = hostname.replace('.notion.site', '');
      if (subdomain && subdomain.length > 0 && subdomain.length < 25) {
        return { groupName: `Notion ${subdomain}`, color: 'grey' };
      }
    }
    
    // No workspace/page signal - return null instead of "Notion" mega-group
    return null;
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
  // 'github.com' entry removed - use project extraction instead
  'gist.github.com': ['GitHub Gist', 'grey', 1],
  'gitlab.com': ['GitLab', 'orange', 1],
  'bitbucket.org': ['Bitbucket', 'blue', 1],
  'stackoverflow.com': ['Stack Overflow', 'orange', 1],
  'stackexchange.com': ['Stack Overflow', 'orange', 2],
  'serverfault.com': ['Stack Overflow', 'orange', 2],
  'superuser.com': ['Stack Overflow', 'orange', 2],
  
  // Project Management (Atlassian, Linear, Notion handled by project extraction)
  'trello.com': ['Trello', 'blue', 1],
  'asana.com': ['Asana', 'pink', 1],
  'monday.com': ['Monday', 'red', 1],
  'clickup.com': ['ClickUp', 'purple', 1],
  // 'linear.app' removed - use project extraction instead
  // 'notion.so' removed - use project extraction instead
  // 'notion.site' removed - use project extraction instead
  'coda.io': ['Coda', 'orange', 1],
  'airtable.com': ['Airtable', 'yellow', 1],
  
  // Communication (Slack handled by project extraction)
  // 'slack.com' removed - use project extraction instead
  'discord.com': ['Discord', 'purple', 1],
  'zoom.us': ['Zoom', 'blue', 1],
  'whereby.com': ['Whereby', 'blue', 1],
  'miro.com': ['Miro', 'yellow', 1],
  
  // Design (Figma handled by project extraction)
  // 'figma.com' removed - use project extraction instead
  // 'figjam.com' removed - use project extraction instead
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
  
  // Social Media (X/Twitter handled by project extraction)
  // 'twitter.com' removed - use project extraction instead
  // 'x.com' removed - use project extraction instead
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
  
  // Slack workspaces (removed - project extraction handles workspace/channel grouping)
  // { pattern: /^[^.]+\.slack\.com$/, group: 'Slack', color: 'purple' },
  
  // Notion (removed - project extraction handles workspace/page grouping)
  // { pattern: /^[^.]+\.notion\.so$/, group: 'Notion', color: 'grey' },
  // { pattern: /^[^.]+\.notion\.site$/, group: 'Notion', color: 'grey' },
  
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
    // Fallback for invalid URLs - use domain label instead of "Other"
    const domainLabel = 'Unknown';
    return { groupName: domainLabel, color: 'grey' };
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
 * Apply group size policy: enforce minimum 2 tabs per group, cap large groups
 * Never create an "Other" catch-all group - unknown singletons stay ungrouped
 * @param {Array} groups
 * @param {number} totalTabs
 * @returns {Array}
 */
function applyGroupSizePolicy(groups, totalTabs) {
  // Filter out any groups with fewer than 2 tabs
  // Chrome requires at least 2 tabs to form a group
  const validGroups = groups.filter(g => g.tabIds.length >= 2);
  
  // Cap individual groups at 12 tabs max
  const cappedGroups = validGroups.map(g => {
    if (g.tabIds.length > 12) {
      return {
        ...g,
        tabIds: g.tabIds.slice(0, 12)
      };
    }
    return g;
  });
  
  return cappedGroups;
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
  // Browser - expose to global scope (service worker compatible)
  globalThis.OfflineGrouping = {
    groupTabsOffline,
    classifyTab,
    extractProjectContext,
    KNOWN_SITES,
    HOSTNAME_FAMILIES,
  };
}
