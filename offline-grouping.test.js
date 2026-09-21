/**
 * Unit tests for offline tab grouping
 * Run with: node offline-grouping.test.js
 */

const { groupTabsOffline, classifyTab } = require('./offline-grouping.js');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  assert(isEqual, message + (isEqual ? '' : `\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`));
}

function assertGroupExists(groups, groupName, message) {
  const exists = groups.some(g => g.name === groupName);
  assert(exists, message + (exists ? '' : `\n  Group "${groupName}" not found in: ${groups.map(g => g.name).join(', ')}`));
}

function assertGroupHasTabs(groups, groupName, expectedCount, message) {
  const group = groups.find(g => g.name === groupName);
  const actual = group ? group.tabIds.length : 0;
  assert(actual === expectedCount, message + (actual === expectedCount ? '' : `\n  Expected ${expectedCount} tabs, got ${actual}`));
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

const FIXTURE_WORK_MORNING = [
  { id: 1, title: 'Gmail - Inbox', url: 'https://mail.google.com/mail/u/0/#inbox', pinned: false },
  { id: 2, title: 'GitHub - Pull Requests', url: 'https://github.com/pulls', pinned: false },
  { id: 3, title: 'Slack - Engineering', url: 'https://mycompany.slack.com/messages/engineering', pinned: false },
  { id: 4, title: '[ENG-123] JIRA - Sprint Board', url: 'https://mycompany.atlassian.net/browse/ENG-123', pinned: false },
  { id: 5, title: 'Google Docs - Q1 Planning', url: 'https://docs.google.com/document/d/abc123', pinned: false },
  { id: 6, title: 'Google Sheets - Budget', url: 'https://sheets.google.com/spreadsheets/d/xyz789', pinned: false },
  { id: 7, title: 'Notion - Team Wiki', url: 'https://notion.so/workspace/team-wiki', pinned: false },
  { id: 8, title: 'Figma - Design System', url: 'https://figma.com/file/abc123', pinned: false },
  { id: 9, title: 'Linear - Issues', url: 'https://linear.app/workspace/issues', pinned: false },
  { id: 10, title: 'Stack Overflow - Question', url: 'https://stackoverflow.com/questions/12345', pinned: false },
];

const FIXTURE_MULTI_GOOGLE = [
  { id: 1, title: 'Gmail', url: 'https://mail.google.com/', pinned: false },
  { id: 2, title: 'Google Docs', url: 'https://docs.google.com/', pinned: false },
  { id: 3, title: 'Google Sheets', url: 'https://sheets.google.com/', pinned: false },
  { id: 4, title: 'Google Slides', url: 'https://slides.google.com/', pinned: false },
  { id: 5, title: 'Google Drive', url: 'https://drive.google.com/', pinned: false },
  { id: 6, title: 'Google Calendar', url: 'https://calendar.google.com/', pinned: false },
];

const FIXTURE_MIXED_DOMAINS = [
  { id: 1, title: 'Example Site', url: 'https://example.com/', pinned: false },
  { id: 2, title: 'Another Example', url: 'https://another-example.com/', pinned: false },
  { id: 3, title: 'Test Site', url: 'https://test-site.org/', pinned: false },
  { id: 4, title: 'GitHub', url: 'https://github.com/', pinned: false },
  { id: 5, title: 'Random Blog', url: 'https://randomblog.io/', pinned: false },
];

const FIXTURE_WITH_UNGROUPABLE = [
  { id: 1, title: 'Settings', url: 'chrome://settings/', pinned: false },
  { id: 2, title: 'Extensions', url: 'chrome://extensions/', pinned: true },
  { id: 3, title: 'GitHub', url: 'https://github.com/', pinned: false },
  { id: 4, title: 'Gmail', url: 'https://mail.google.com/', pinned: false },
  { id: 5, title: 'Extension Page', url: 'chrome-extension://abcdef/options.html', pinned: false },
];

const FIXTURE_CLOUD_PROVIDERS = [
  { id: 1, title: 'AWS Console', url: 'https://console.aws.amazon.com/', pinned: false },
  { id: 2, title: 'Azure Portal', url: 'https://portal.azure.com/', pinned: false },
  { id: 3, title: 'Google Cloud', url: 'https://console.cloud.google.com/', pinned: false },
  { id: 4, title: 'Vercel Dashboard', url: 'https://vercel.com/dashboard', pinned: false },
  { id: 5, title: 'Netlify Sites', url: 'https://app.netlify.com/', pinned: false },
];

const FIXTURE_AI_SERVICES = [
  { id: 1, title: 'ChatGPT', url: 'https://chat.openai.com/', pinned: false },
  { id: 2, title: 'Claude', url: 'https://claude.ai/', pinned: false },
  { id: 3, title: 'Gemini', url: 'https://gemini.google.com/', pinned: false },
  { id: 4, title: 'Perplexity', url: 'https://perplexity.ai/', pinned: false },
];

const FIXTURE_MANY_SINGLETONS = [
  { id: 1, title: 'Site 1', url: 'https://site1.com/', pinned: false },
  { id: 2, title: 'Site 2', url: 'https://site2.com/', pinned: false },
  { id: 3, title: 'Site 3', url: 'https://site3.com/', pinned: false },
  { id: 4, title: 'Site 4', url: 'https://site4.com/', pinned: false },
  { id: 5, title: 'Site 5', url: 'https://site5.com/', pinned: false },
];

// ============================================================================
// PROJECT EXTRACTION FIXTURES
// ============================================================================

const FIXTURE_MULTI_JIRA_PROJECTS = [
  { id: 1, title: '[PROOF-123] Implement feature', url: 'https://company.atlassian.net/browse/PROOF-123', pinned: false },
  { id: 2, title: '[PROOF-456] Fix bug', url: 'https://company.atlassian.net/browse/PROOF-456', pinned: false },
  { id: 3, title: '[MARKET-789] Update docs', url: 'https://company.atlassian.net/browse/MARKET-789', pinned: false },
  { id: 4, title: '[MARKET-101] New campaign', url: 'https://company.atlassian.net/browse/MARKET-101', pinned: false },
  { id: 5, title: '[ENG-555] Refactor', url: 'https://company.atlassian.net/browse/ENG-555', pinned: false },
];

const FIXTURE_CONFLUENCE_SPACES = [
  { id: 1, title: 'Engineering Space - Home', url: 'https://company.atlassian.net/wiki/spaces/ENG/overview', pinned: false },
  { id: 2, title: 'Engineering Docs', url: 'https://company.atlassian.net/wiki/spaces/ENG/pages/123', pinned: false },
  { id: 3, title: 'Product Specs', url: 'https://company.atlassian.net/wiki/spaces/PROD/overview', pinned: false },
  { id: 4, title: 'Marketing Wiki', url: 'https://company.atlassian.net/wiki/spaces/MKT/pages/456', pinned: false },
];

const FIXTURE_SHAREPOINT_SITES = [
  { id: 1, title: 'Engineering Site - Home', url: 'https://company.sharepoint.com/sites/engineering/SitePages/Home.aspx', pinned: false },
  { id: 2, title: 'Engineering Docs', url: 'https://company.sharepoint.com/sites/engineering/Shared%20Documents/Forms/AllItems.aspx', pinned: false },
  { id: 3, title: 'Marketing Site', url: 'https://company.sharepoint.com/sites/marketing/SitePages/Home.aspx', pinned: false },
  { id: 4, title: 'HR Portal', url: 'https://company.sharepoint.com/sites/hr-portal/Lists/Announcements/AllItems.aspx', pinned: false },
];

const FIXTURE_MIXED_MICROSOFT = [
  { id: 1, title: 'Inbox - Outlook', url: 'https://outlook.office.com/mail/inbox', pinned: false },
  { id: 2, title: 'Engineering Team | Microsoft Teams', url: 'https://teams.microsoft.com/l/team/abc', pinned: false },
  { id: 3, title: 'Marketing Team | Microsoft Teams', url: 'https://teams.microsoft.com/l/team/xyz', pinned: false },
  { id: 4, title: 'Engineering SharePoint', url: 'https://company.sharepoint.com/sites/engineering/SitePages/Home.aspx', pinned: false },
  { id: 5, title: 'OneDrive - Personal', url: 'https://onedrive.live.com/personal', pinned: false },
];

const FIXTURE_GITHUB_REPOS = [
  { id: 1, title: 'tab-sorter: Issues', url: 'https://github.com/andrewslifkin/tab-sorter/issues', pinned: false },
  { id: 2, title: 'tab-sorter: Pull Requests', url: 'https://github.com/andrewslifkin/tab-sorter/pulls', pinned: false },
  { id: 3, title: 'awesome-project: README', url: 'https://github.com/someorg/awesome-project', pinned: false },
  { id: 4, title: 'GitHub Dashboard', url: 'https://github.com/dashboard', pinned: false },
];

const FIXTURE_AZURE_DEVOPS = [
  { id: 1, title: 'Project Alpha - Boards', url: 'https://dev.azure.com/company/project-alpha/_boards', pinned: false },
  { id: 2, title: 'Project Alpha - Repos', url: 'https://dev.azure.com/company/project-alpha/_git', pinned: false },
  { id: 3, title: 'Project Beta - Overview', url: 'https://dev.azure.com/company/project-beta', pinned: false },
];

// ============================================================================
// NEW EXTRACTOR FIXTURES (Figma, X/Twitter, Slack, Linear, Notion)
// ============================================================================

const FIXTURE_FIGMA_FILES = [
  { id: 1, title: 'Design System - Figma', url: 'https://www.figma.com/design/abc123xyz456/Design-System', pinned: false },
  { id: 2, title: 'Design System Components - Figma', url: 'https://www.figma.com/design/abc123xyz456/Design-System?node-id=5-3', pinned: false },
  { id: 3, title: 'Mobile App Mockups - Figma', url: 'https://figma.com/file/def789ghi012/Mobile-App-Mockups', pinned: false },
  { id: 4, title: 'Marketing Landing Page - Figma', url: 'https://www.figma.com/design/jkl345mno678/Marketing-Landing-Page', pinned: false },
  { id: 5, title: 'Brainstorm Board - FigJam', url: 'https://www.figma.com/board/pqr901stu234/Brainstorm-Board', pinned: false },
];

const FIXTURE_X_TWITTER_MIXED = [
  { id: 1, title: 'Elon Musk (@elonmusk) / X', url: 'https://x.com/elonmusk', pinned: false },
  { id: 2, title: 'Elon Musk on X', url: 'https://x.com/elonmusk/status/1234567890', pinned: false },
  { id: 3, title: 'NASA (@NASA) / X', url: 'https://twitter.com/NASA', pinned: false },
  { id: 4, title: 'NASA on X', url: 'https://twitter.com/NASA/status/9876543210', pinned: false },
  { id: 5, title: 'Tech News List / X', url: 'https://x.com/i/lists/123456789', pinned: false },
  { id: 6, title: 'AI News List / X', url: 'https://x.com/i/lists/987654321', pinned: false },
  { id: 7, title: 'Search: ChatGPT - X', url: 'https://x.com/search?q=ChatGPT&f=live', pinned: false },
  { id: 8, title: '#AI / X', url: 'https://x.com/hashtag/AI', pinned: false },
];

const FIXTURE_SLACK_WORKSPACES = [
  { id: 1, title: 'engineering | Acme Corp | Slack', url: 'https://app.slack.com/client/T012ABC345/C067DEF890', pinned: false },
  { id: 2, title: 'engineering | Acme Corp | Slack', url: 'https://app.slack.com/client/T012ABC345/C067DEF890/p1234567890', pinned: false },
  { id: 3, title: 'general | Acme Corp | Slack', url: 'https://app.slack.com/client/T012ABC345/C123GHI456', pinned: false },
  { id: 4, title: 'general | Acme Corp | Slack', url: 'https://app.slack.com/client/T012ABC345/C123GHI456/p9876543210', pinned: false },
  { id: 5, title: 'Product Team | Slack', url: 'https://app.slack.com/client/T456STU789', pinned: false },
];

const FIXTURE_LINEAR_TEAMS = [
  { id: 1, title: '[ENG-123] Implement feature', url: 'https://linear.app/acme/issue/ENG-123/implement-feature', pinned: false },
  { id: 2, title: '[ENG-456] Fix bug', url: 'https://linear.app/acme/issue/ENG-456/fix-bug', pinned: false },
  { id: 3, title: '[DESIGN-789] Update mockups', url: 'https://linear.app/acme/issue/DESIGN-789/update-mockups', pinned: false },
  { id: 4, title: '[DESIGN-101] Review prototypes', url: 'https://linear.app/acme/issue/DESIGN-101/review-prototypes', pinned: false },
  { id: 5, title: 'API Redesign Project', url: 'https://linear.app/acme/project/api-redesign-abc123', pinned: false },
];

const FIXTURE_NOTION_PAGES = [
  { id: 1, title: 'Engineering Wiki - Notion', url: 'https://www.notion.so/acme/Engineering-Wiki-abc123def456789012345678901234ab', pinned: false },
  { id: 2, title: 'Onboarding Guide - Notion', url: 'https://www.notion.so/acme/Onboarding-Guide-def456abc789012345678901234567cd', pinned: false },
  { id: 3, title: 'Product Roadmap - Notion', url: 'https://app.notion.com/p/Product-Roadmap-123456789abcdef0123456789abcdef0', pinned: false },
  { id: 4, title: 'Design System Docs - Notion', url: 'https://app.notion.com/p/Design-System-Docs-fedcba9876543210fedcba9876543210', pinned: false },
  { id: 5, title: 'Marketing Site', url: 'https://marketing.notion.site/Home-page', pinned: false },
];

// ============================================================================
// CLASSIFICATION TESTS
// ============================================================================

console.log('\n=== Classification Tests ===\n');

// Test known sites
const githubTab = { id: 1, title: 'GitHub', url: 'https://github.com/', pinned: false };
const githubClassification = classifyTab(githubTab);
assertEqual(githubClassification.groupName, 'Github', 'GitHub bare domain classified as Github (domain label)');
// Color is based on hash of "Github" which may vary
assert(githubClassification.color, 'GitHub gets a color');

const gmailTab = { id: 2, title: 'Gmail', url: 'https://mail.google.com/', pinned: false };
const gmailClassification = classifyTab(gmailTab);
assertEqual(gmailClassification.groupName, 'Gmail', 'Gmail classified correctly');
assertEqual(gmailClassification.color, 'red', 'Gmail gets correct color');

// Test hostname families
const slackTab = { id: 3, title: 'Slack', url: 'https://mycompany.slack.com/', pinned: false };
const slackClassification = classifyTab(slackTab);
assertEqual(slackClassification.groupName, 'Slack', 'Slack workspace classified correctly');

// Test project extraction - Jira
const jiraTab = { id: 4, title: '[PROOF-123] Test issue', url: 'https://company.atlassian.net/browse/PROOF-123', pinned: false };
const jiraClassification = classifyTab(jiraTab);
assertEqual(jiraClassification.groupName, 'Jira PROOF', 'Jira project extracted correctly');
assertEqual(jiraClassification.color, 'blue', 'Jira project gets correct color');

// Test project extraction - Confluence
const confluenceTab = { id: 5, title: 'Engineering Docs', url: 'https://company.atlassian.net/wiki/spaces/ENG/overview', pinned: false };
const confluenceClassification = classifyTab(confluenceTab);
assertEqual(confluenceClassification.groupName, 'Confluence ENG', 'Confluence space extracted correctly');

// Test project extraction - SharePoint
const sharepointTab = { id: 6, title: 'Engineering Site', url: 'https://company.sharepoint.com/sites/engineering/SitePages/Home.aspx', pinned: false };
const sharepointClassification = classifyTab(sharepointTab);
assertEqual(sharepointClassification.groupName, 'SP Engineering', 'SharePoint site extracted correctly');

// Test project extraction - GitHub repo
const repoTab = { id: 7, title: 'tab-sorter: Issues', url: 'https://github.com/andrewslifkin/tab-sorter/issues', pinned: false };
const repoClassification = classifyTab(repoTab);
assertEqual(repoClassification.groupName, 'andrewslifkin/tab-sorter', 'GitHub repo extracted as org/repo format');

// Test ETLD+1 fallback
const unknownTab = { id: 8, title: 'Example', url: 'https://example.com/', pinned: false };
const unknownClassification = classifyTab(unknownTab);
assertEqual(unknownClassification.groupName, 'Example', 'Unknown domain uses title case domain');

// ============================================================================
// GROUPING TESTS
// ============================================================================

console.log('\n=== Grouping Tests ===\n');

// Test work morning fixture
const workGroups = groupTabsOffline(FIXTURE_WORK_MORNING);
// Only Google Docs group should remain (2 tabs: Docs + Sheets)
// All other services are singletons and should be dropped
assertEqual(workGroups.length, 1, 'Work morning produces only 1 group (others are singletons)');
assertGroupExists(workGroups, 'Google Docs', 'Work morning includes Google Docs group');
assertGroupHasTabs(workGroups, 'Google Docs', 2, 'Google Docs group has 2 tabs (Docs + Sheets)');
// Gmail, Slack, GitHub, Jira ENG, Notion, Figma, Linear, Stack Overflow are all singletons and dropped
const hasGmail = workGroups.some(g => g.name === 'Gmail');
const hasSlack = workGroups.some(g => g.name === 'Slack');
assert(!hasGmail, 'Gmail singleton dropped');
assert(!hasSlack, 'Slack singleton dropped');

// Test multi-Google fixture
const googleGroups = groupTabsOffline(FIXTURE_MULTI_GOOGLE);
// Only Google Docs group should remain (3 tabs: Docs + Sheets + Slides)
// Gmail, Drive, Calendar are singletons and should be dropped
assertEqual(googleGroups.length, 1, 'Multi-Google produces 1 group (others are singletons)');
assertGroupExists(googleGroups, 'Google Docs', 'Multi-Google includes Google Docs');
assertGroupHasTabs(googleGroups, 'Google Docs', 3, 'Google Docs merges Docs/Sheets/Slides');
const hasGmailMulti = googleGroups.some(g => g.name === 'Gmail');
assert(!hasGmailMulti, 'Gmail singleton dropped');

// Test mixed domains
const mixedGroups = groupTabsOffline(FIXTURE_MIXED_DOMAINS);
// All tabs are singletons, so all get filtered out
assertEqual(mixedGroups.length, 0, 'Mixed domains produces 0 groups (all singletons filtered out)');

// Test ungroupable filtering
const ungroupableGroups = groupTabsOffline(FIXTURE_WITH_UNGROUPABLE);
// GitHub and Gmail are both singletons after filtering ungroupable tabs, so they're dropped
assertEqual(ungroupableGroups.length, 0, 'Ungroupable fixture produces 0 groups (singletons dropped)');
const totalTabs = ungroupableGroups.reduce((sum, g) => sum + g.tabIds.length, 0);
assertEqual(totalTabs, 0, 'No tabs grouped (chrome:// excluded, remaining are singletons)');

// Test cloud providers - all singletons, should produce "Other" group or no groups
const cloudGroups = groupTabsOffline(FIXTURE_CLOUD_PROVIDERS);
// All cloud providers are singletons, so they get merged into "Other" or dropped
// Since there are 5 singletons (>= 3), they should be merged into "Other"
const hasOtherCloudGroup = cloudGroups.some(g => g.name === 'Other');
if (hasOtherCloudGroup) {
  assertGroupExists(cloudGroups, 'Other', 'Cloud singletons merged into Other');
  assertGroupHasTabs(cloudGroups, 'Other', 5, 'Other group contains all 5 cloud providers');
} else {
  // Or all dropped if classification creates individual groups
  assertEqual(cloudGroups.length, 0, 'All cloud provider singletons dropped');
}

// Test AI services - all singletons, should be dropped or merged
const aiGroups = groupTabsOffline(FIXTURE_AI_SERVICES);
// All AI services are singletons (1 tab each), should not create groups
// Since there are 4 known services, they stay separate during classification but get filtered
assertEqual(aiGroups.length, 0, 'All AI service singletons dropped (no single-tab groups)');

// Test singleton handling
const singletonGroups = groupTabsOffline(FIXTURE_MANY_SINGLETONS);
assertEqual(singletonGroups.length, 0, 'Many singletons produce no groups (all filtered as singletons)');

// ============================================================================
// PROJECT EXTRACTION TESTS
// ============================================================================

console.log('\n=== Project Extraction Tests ===\n');

// Test multiple Jira projects - should NOT collapse into one group
const jiraProjectGroups = groupTabsOffline(FIXTURE_MULTI_JIRA_PROJECTS);
assertGroupExists(jiraProjectGroups, 'Jira PROOF', 'Multi-Jira includes PROOF project');
assertGroupExists(jiraProjectGroups, 'Jira MARKET', 'Multi-Jira includes MARKET project');
assertGroupHasTabs(jiraProjectGroups, 'Jira PROOF', 2, 'Jira PROOF has 2 issues');
assertGroupHasTabs(jiraProjectGroups, 'Jira MARKET', 2, 'Jira MARKET has 2 issues');
// Jira ENG singleton should be dropped (no single-tab groups)
const hasJiraENG = jiraProjectGroups.some(g => g.name === 'Jira ENG');
assert(!hasJiraENG, 'Jira ENG singleton is dropped (no single-tab groups allowed)');
assert(jiraProjectGroups.length === 2, 'Multi-Jira creates 2 groups (singleton ENG dropped)');

// Test Confluence spaces - only multi-tab groups remain
const confluenceGroups = groupTabsOffline(FIXTURE_CONFLUENCE_SPACES);
// ENG has 2 tabs, PROD and MKT are singletons and dropped
assertGroupExists(confluenceGroups, 'Confluence ENG', 'Confluence includes ENG space');
assertGroupHasTabs(confluenceGroups, 'Confluence ENG', 2, 'Confluence ENG has 2 pages');
assertEqual(confluenceGroups.length, 1, 'Confluence creates 1 group (PROD and MKT singletons dropped)');
const hasPROD = confluenceGroups.some(g => g.name === 'Confluence PROD');
const hasMKT = confluenceGroups.some(g => g.name === 'Confluence MKT');
assert(!hasPROD, 'Confluence PROD singleton dropped');
assert(!hasMKT, 'Confluence MKT singleton dropped');

// Test SharePoint sites - only multi-tab groups remain
const sharepointGroups = groupTabsOffline(FIXTURE_SHAREPOINT_SITES);
// Engineering has 2 tabs, Marketing and HR Portal are singletons and dropped
assertGroupExists(sharepointGroups, 'SP Engineering', 'SharePoint includes Engineering site');
assertGroupHasTabs(sharepointGroups, 'SP Engineering', 2, 'SP Engineering has 2 pages');
assertEqual(sharepointGroups.length, 1, 'SharePoint creates 1 group (Marketing and HR Portal singletons dropped)');
const hasMarketing = sharepointGroups.some(g => g.name === 'SP Marketing');
const hasHR = sharepointGroups.some(g => g.name === 'SP Hr Portal');
assert(!hasMarketing, 'SP Marketing singleton dropped');
assert(!hasHR, 'SP Hr Portal singleton dropped');

// Test mixed Microsoft - all singletons, should produce no groups
const mixedMsGroups = groupTabsOffline(FIXTURE_MIXED_MICROSOFT);
// All services are singletons (Outlook, Teams x2, SharePoint, OneDrive), should be dropped
assertEqual(mixedMsGroups.length, 0, 'Mixed Microsoft produces 0 groups (all singletons dropped)');
const hasMicrosoftMegaGroup = mixedMsGroups.some(g => g.name === 'Microsoft' && g.tabIds.length > 1);
assert(!hasMicrosoftMegaGroup, 'Mixed Microsoft does NOT create a Microsoft mega-group');

// Test GitHub repos - only multi-tab groups remain
const githubRepoGroups = groupTabsOffline(FIXTURE_GITHUB_REPOS);
// tab-sorter has 2 tabs (Issues + PRs), awesome-project and dashboard are singletons
assertGroupExists(githubRepoGroups, 'andrewslifkin/tab-sorter', 'GitHub includes tab-sorter repo with org/repo format');
assertGroupHasTabs(githubRepoGroups, 'andrewslifkin/tab-sorter', 2, 'tab-sorter repo has 2 tabs');
assertEqual(githubRepoGroups.length, 1, 'GitHub creates 1 group (awesome-project and dashboard singletons dropped)');
const hasAwesomeProject = githubRepoGroups.some(g => g.name === 'someorg/awesome-project');
const hasDashboard = githubRepoGroups.some(g => g.name === 'Github' || g.name === 'GitHub');
assert(!hasAwesomeProject, 'awesome-project singleton dropped');
assert(!hasDashboard, 'dashboard singleton dropped');

// Test Azure DevOps projects - only multi-tab groups remain
const adoGroups = groupTabsOffline(FIXTURE_AZURE_DEVOPS);
// Project Alpha has 2 tabs, Project Beta is a singleton
assertGroupExists(adoGroups, 'ADO Project Alpha', 'Azure DevOps includes Project Alpha');
assertGroupHasTabs(adoGroups, 'ADO Project Alpha', 2, 'ADO Project Alpha has 2 tabs');
assertEqual(adoGroups.length, 1, 'Azure DevOps creates 1 group (Project Beta singleton dropped)');
const hasBeta = adoGroups.some(g => g.name === 'ADO Project Beta');
assert(!hasBeta, 'ADO Project Beta singleton dropped');

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

console.log('\n=== Determinism Tests ===\n');

// Same input should produce same output
const groups1 = groupTabsOffline(FIXTURE_WORK_MORNING);
const groups2 = groupTabsOffline(FIXTURE_WORK_MORNING);
assertEqual(
  groups1.map(g => ({ name: g.name, color: g.color, count: g.tabIds.length })),
  groups2.map(g => ({ name: g.name, color: g.color, count: g.tabIds.length })),
  'Same input produces identical groups (deterministic)'
);

// ============================================================================
// EDGE CASES
// ============================================================================

console.log('\n=== Edge Case Tests ===\n');

// Empty input
const emptyGroups = groupTabsOffline([]);
assertEqual(emptyGroups.length, 0, 'Empty input produces no groups');

// Only ungroupable tabs
const onlyUngroupable = [
  { id: 1, title: 'Settings', url: 'chrome://settings/', pinned: false },
  { id: 2, title: 'Extensions', url: 'chrome://extensions/', pinned: true },
];
const ungroupableOnly = groupTabsOffline(onlyUngroupable);
assertEqual(ungroupableOnly.length, 0, 'Only ungroupable tabs produces no groups');

// Single groupable tab - should produce NO groups (singleton dropped)
const singleTab = [
  { id: 1, title: 'GitHub', url: 'https://github.com/', pinned: false },
];
const singleGroups = groupTabsOffline(singleTab);
assertEqual(singleGroups.length, 0, 'Single tab produces no groups (singletons dropped)');

// ============================================================================
// NO MEGA-GROUP REGRESSION TESTS
// ============================================================================

console.log('\n=== No Mega-Group Regression Tests ===\n');

// Test: Jira pages without project keys should NOT create "Jira" mega-group
const jiraNoProject = [
  { id: 1, title: 'Jira Home', url: 'https://company.atlassian.net/jira/your-work', pinned: false },
];
const jiraNoProjectGroups = groupTabsOffline(jiraNoProject);
const hasJiraMegaGroup = jiraNoProjectGroups.some(g => g.name === 'Jira');
assert(!hasJiraMegaGroup, 'Jira page without project does NOT create "Jira" mega-group');

// Test: Confluence pages without space should NOT create "Confluence" mega-group
const confluenceNoSpace = [
  { id: 1, title: 'Confluence Home', url: 'https://company.atlassian.net/wiki/', pinned: false },
];
const confluenceNoSpaceGroups = groupTabsOffline(confluenceNoSpace);
const hasConfluenceMegaGroup = confluenceNoSpaceGroups.some(g => g.name === 'Confluence');
assert(!hasConfluenceMegaGroup, 'Confluence page without space does NOT create "Confluence" mega-group');

// Test: SharePoint without site should use tenant name, not "SharePoint" mega-group
const sharepointNoSite = [
  { id: 1, title: 'SharePoint Home', url: 'https://contoso.sharepoint.com/', pinned: false },
];
const sharepointNoSiteGroups = groupTabsOffline(sharepointNoSite);
const hasSharePointMegaGroup = sharepointNoSiteGroups.some(g => g.name === 'SharePoint');
assert(!hasSharePointMegaGroup, 'SharePoint without site does NOT create "SharePoint" mega-group');
// Singleton is dropped, so no groups created
assertEqual(sharepointNoSiteGroups.length, 0, 'SharePoint singleton dropped (would have used tenant name)');

// Test: Teams without team name should NOT create "Microsoft Teams" mega-group
const teamsNoName = [
  { id: 1, title: 'Microsoft Teams', url: 'https://teams.microsoft.com/', pinned: false },
];
const teamsNoNameGroups = groupTabsOffline(teamsNoName);
const hasTeamsMegaGroup = teamsNoNameGroups.some(g => g.name === 'Microsoft Teams');
assert(!hasTeamsMegaGroup, 'Teams without team name does NOT create "Microsoft Teams" mega-group');

// Test: Azure DevOps without project should use org name, not "Azure DevOps" mega-group
const adoNoProject = [
  { id: 1, title: 'ADO Home', url: 'https://dev.azure.com/myorg/', pinned: false },
];
const adoNoProjectGroups = groupTabsOffline(adoNoProject);
const hasADOMegaGroup = adoNoProjectGroups.some(g => g.name === 'Azure DevOps');
assert(!hasADOMegaGroup, 'Azure DevOps without project does NOT create "Azure DevOps" mega-group');
// Singleton is dropped, so no groups created
assertEqual(adoNoProjectGroups.length, 0, 'Azure DevOps singleton dropped (would have used org name)');

// Test: GitHub dashboard should NOT create "GitHub" mega-group, use domain label
const githubDashboard = [
  { id: 1, title: 'Dashboard', url: 'https://github.com/dashboard', pinned: false },
];
const githubDashboardGroups = groupTabsOffline(githubDashboard);
const hasGitHubMegaGroup = githubDashboardGroups.some(g => g.name === 'GitHub');
// "Github" (domain label) is OK, but not "GitHub" (mega-group from KNOWN_SITES)
const hasGithubDomainLabel = githubDashboardGroups.some(g => g.name === 'Github');
assert(!hasGitHubMegaGroup || hasGithubDomainLabel, 'GitHub dashboard uses domain label, not known-site mega-group');

// ============================================================================
// ENHANCED EXTRACTION TESTS
// ============================================================================

console.log('\n=== Enhanced Extraction Tests ===\n');

// Test: Jira board URLs should extract project
const jiraBoardTab = { id: 1, title: 'PROJ Board', url: 'https://company.atlassian.net/jira/software/c/projects/PROJ/boards/1', pinned: false };
const jiraBoardClass = classifyTab(jiraBoardTab);
assertEqual(jiraBoardClass.groupName, 'Jira PROJ', 'Jira board URL extracts project key');

// Test: Jira project pages should extract project
const jiraProjectTab = { id: 1, title: 'PROJ', url: 'https://company.atlassian.net/projects/MYPROJ', pinned: false };
const jiraProjectClass = classifyTab(jiraProjectTab);
assertEqual(jiraProjectClass.groupName, 'Jira MYPROJ', 'Jira project page extracts project key');

// Test: Confluence with space query param
const confluenceQueryTab = { id: 1, title: 'Space Docs', url: 'https://company.atlassian.net/wiki/display?spaceKey=DOCS', pinned: false };
const confluenceQueryClass = classifyTab(confluenceQueryTab);
assertEqual(confluenceQueryClass.groupName, 'Confluence DOCS', 'Confluence with spaceKey param extracts space');

// Test: GitHub org page (no repo)
const githubOrgTab = { id: 1, title: 'facebook', url: 'https://github.com/facebook', pinned: false };
const githubOrgClass = classifyTab(githubOrgTab);
assertEqual(githubOrgClass.groupName, 'facebook', 'GitHub org page extracts org name');

// Test: GitHub org/repo format for normal length
const githubRepoShort = { id: 1, title: 'react', url: 'https://github.com/facebook/react', pinned: false };
const githubRepoShortClass = classifyTab(githubRepoShort);
assertEqual(githubRepoShortClass.groupName, 'facebook/react', 'GitHub repo uses org/repo format when length is reasonable');

// ============================================================================
// NEW EXTRACTOR CLASSIFICATION TESTS
// ============================================================================

console.log('\n=== New Extractor Classification Tests ===\n');

// Test: Figma file extraction
const figmaTab = { id: 1, title: 'Design System - Figma', url: 'https://www.figma.com/design/abc123xyz456/Design-System', pinned: false };
const figmaClass = classifyTab(figmaTab);
assertEqual(figmaClass.groupName, 'Figma Design System', 'Figma file extracts file name correctly');
assertEqual(figmaClass.color, 'pink', 'Figma gets correct color');

// Test: Figma without file name falls back to type
const figmaNoName = { id: 1, title: 'Figma Board', url: 'https://figma.com/board/abc123xyz456', pinned: false };
const figmaNoNameClass = classifyTab(figmaNoName);
assertEqual(figmaNoNameClass.groupName, 'Figma Board', 'Figma without name uses file type');

// Test: X/Twitter profile extraction
const xProfileTab = { id: 1, title: 'Elon Musk (@elonmusk) / X', url: 'https://x.com/elonmusk', pinned: false };
const xProfileClass = classifyTab(xProfileTab);
assertEqual(xProfileClass.groupName, '@elonmusk', 'X profile extracts handle correctly');
assertEqual(xProfileClass.color, 'grey', 'X gets correct color');

// Test: X/Twitter status with handle
const xStatusTab = { id: 1, title: 'NASA on X', url: 'https://x.com/NASA/status/1234567890', pinned: false };
const xStatusClass = classifyTab(xStatusTab);
assertEqual(xStatusClass.groupName, '@NASA', 'X status with handle extracts handle');

// Test: X/Twitter list
const xListTab = { id: 1, title: 'Tech News / X', url: 'https://x.com/i/lists/123456789', pinned: false };
const xListClass = classifyTab(xListTab);
assert(xListClass.groupName.includes('List'), 'X list creates list group');

// Test: X/Twitter search
const xSearchTab = { id: 1, title: 'Search: AI - X', url: 'https://x.com/search?q=artificial+intelligence', pinned: false };
const xSearchClass = classifyTab(xSearchTab);
assert(xSearchClass.groupName.includes('X'), 'X search creates search group');

// Test: X/Twitter hashtag
const xHashtagTab = { id: 1, title: '#AI / X', url: 'https://x.com/hashtag/AI', pinned: false };
const xHashtagClass = classifyTab(xHashtagTab);
assertEqual(xHashtagClass.groupName, '#AI', 'X hashtag extracts hashtag correctly');

// Test: Slack channel extraction
const slackChannelTab = { id: 1, title: 'engineering | Acme Corp | Slack', url: 'https://app.slack.com/client/T012ABC345/C067DEF890', pinned: false };
const slackChannelClass = classifyTab(slackChannelTab);
assertEqual(slackChannelClass.groupName, 'Slack engineering', 'Slack extracts channel name from title');
assertEqual(slackChannelClass.color, 'purple', 'Slack gets correct color');

// Test: Slack workspace only
const slackWorkspaceTab = { id: 1, title: 'Acme Corp | Slack', url: 'https://app.slack.com/client/T012ABC345', pinned: false };
const slackWorkspaceClass = classifyTab(slackWorkspaceTab);
assertEqual(slackWorkspaceClass.groupName, 'Slack Acme Corp', 'Slack extracts workspace name from title');

// Test: Linear issue extraction
const linearIssueTab = { id: 1, title: '[ENG-123] Implement feature', url: 'https://linear.app/acme/issue/ENG-123/implement-feature', pinned: false };
const linearIssueClass = classifyTab(linearIssueTab);
assertEqual(linearIssueClass.groupName, 'Linear ENG', 'Linear issue extracts team key correctly');
assertEqual(linearIssueClass.color, 'purple', 'Linear gets correct color');

// Test: Linear project extraction
const linearProjectTab = { id: 1, title: 'API Redesign', url: 'https://linear.app/acme/project/api-redesign-abc123', pinned: false };
const linearProjectClass = classifyTab(linearProjectTab);
assertEqual(linearProjectClass.groupName, 'Linear Api Redesign', 'Linear project extracts project name');

// Test: Notion workspace extraction (old format)
const notionOldTab = { id: 1, title: 'Engineering Wiki - Notion', url: 'https://www.notion.so/acme/Engineering-Wiki-abc123def456789012345678901234ab', pinned: false };
const notionOldClass = classifyTab(notionOldTab);
assertEqual(notionOldClass.groupName, 'Notion acme', 'Notion old format extracts workspace name');
assertEqual(notionOldClass.color, 'grey', 'Notion gets correct color');

// Test: Notion page extraction (new format)
const notionNewTab = { id: 1, title: 'Product Roadmap - Notion', url: 'https://app.notion.com/p/Product-Roadmap-123456789abcdef0123456789abcdef0', pinned: false };
const notionNewClass = classifyTab(notionNewTab);
assertEqual(notionNewClass.groupName, 'Notion Product Roadmap', 'Notion new format extracts page title');

// Test: Notion custom site
const notionSiteTab = { id: 1, title: 'Marketing Home', url: 'https://marketing.notion.site/Home-page', pinned: false };
const notionSiteClass = classifyTab(notionSiteTab);
assertEqual(notionSiteClass.groupName, 'Notion marketing', 'Notion custom site extracts subdomain');

// ============================================================================
// SINGLETON FILTERING TESTS (NEW HARD RULE)
// ============================================================================

console.log('\n=== Singleton Filtering Tests ===\n');

// Test: Known service singletons should be dropped
const knownServiceSingleton = [
  { id: 1, title: 'Gmail', url: 'https://mail.google.com/', pinned: false },
  { id: 2, title: 'Slack Channel', url: 'https://mycompany.slack.com/messages/general', pinned: false },
  { id: 3, title: 'Docs 1', url: 'https://docs.google.com/document/d/abc', pinned: false },
  { id: 4, title: 'Docs 2', url: 'https://docs.google.com/document/d/xyz', pinned: false },
];
const knownSingletonGroups = groupTabsOffline(knownServiceSingleton);
// Gmail singleton and Slack singleton should be dropped, Google Docs multi-tab group should remain
const hasGmailSingleton = knownSingletonGroups.some(g => g.name === 'Gmail');
const hasSlackSingleton = knownSingletonGroups.some(g => g.name === 'Slack');
assert(!hasGmailSingleton, 'Known service singleton (Gmail) is dropped');
assert(!hasSlackSingleton, 'Known service singleton (Slack) is dropped');
assertGroupExists(knownSingletonGroups, 'Google Docs', 'Multi-tab Google Docs group remains');
assertGroupHasTabs(knownSingletonGroups, 'Google Docs', 2, 'Google Docs has 2 tabs');
assertEqual(knownSingletonGroups.length, 1, 'Only multi-tab groups remain');

// Test: Project extraction singletons should be dropped
const projectSingletons = [
  { id: 1, title: '[PROJ1-123]', url: 'https://company.atlassian.net/browse/PROJ1-123', pinned: false },
  { id: 2, title: '[PROJ2-456]', url: 'https://company.atlassian.net/browse/PROJ2-456', pinned: false },
  { id: 3, title: '[PROJ2-789]', url: 'https://company.atlassian.net/browse/PROJ2-789', pinned: false },
];
const projectSingletonGroups = groupTabsOffline(projectSingletons);
// PROJ1 singleton should be dropped, PROJ2 with 2 tabs should remain
const hasProj1 = projectSingletonGroups.some(g => g.name === 'Jira PROJ1');
assert(!hasProj1, 'Project extraction singleton (PROJ1) is dropped');
assertGroupExists(projectSingletonGroups, 'Jira PROJ2', 'Multi-tab project group (PROJ2) remains');
assertGroupHasTabs(projectSingletonGroups, 'Jira PROJ2', 2, 'PROJ2 has 2 tabs');
assertEqual(projectSingletonGroups.length, 1, 'Only multi-tab project groups remain');

// Test: Unknown domain singletons should be dropped
const unknownSingletons = [
  { id: 1, title: 'Site 1', url: 'https://site1.example/', pinned: false },
  { id: 2, title: 'Site 2', url: 'https://site2.example/', pinned: false },
  { id: 3, title: 'Site 3a', url: 'https://site3.example/page1', pinned: false },
  { id: 4, title: 'Site 3b', url: 'https://site3.example/page2', pinned: false },
];
const unknownSingletonGroups = groupTabsOffline(unknownSingletons);
// Site1 and Site2 singletons should be dropped, Site3 with 2 tabs should remain
const hasSite1 = unknownSingletonGroups.some(g => g.name === 'Site1');
const hasSite2 = unknownSingletonGroups.some(g => g.name === 'Site2');
assert(!hasSite1, 'Unknown domain singleton (Site1) is dropped');
assert(!hasSite2, 'Unknown domain singleton (Site2) is dropped');
assertGroupExists(unknownSingletonGroups, 'Site3', 'Multi-tab unknown domain group (Site3) remains');
assertGroupHasTabs(unknownSingletonGroups, 'Site3', 2, 'Site3 has 2 tabs');
assertEqual(unknownSingletonGroups.length, 1, 'Only multi-tab unknown groups remain');

// Test: All singletons result in empty groups array
const allSingletons = [
  { id: 1, title: 'Gmail', url: 'https://mail.google.com/', pinned: false },
  { id: 2, title: 'GitHub', url: 'https://github.com/', pinned: false },
  { id: 3, title: 'LinkedIn', url: 'https://linkedin.com/', pinned: false },
];
const allSingletonsGroups = groupTabsOffline(allSingletons);
assertEqual(allSingletonsGroups.length, 0, 'All singletons result in no groups');

// Test: Regression - multi-tab groups still work correctly
const multiTabGroups = [
  { id: 1, title: 'Gmail 1', url: 'https://mail.google.com/mail/u/0/', pinned: false },
  { id: 2, title: 'Gmail 2', url: 'https://mail.google.com/mail/u/1/', pinned: false },
  { id: 3, title: 'Docs 1', url: 'https://docs.google.com/document/d/abc', pinned: false },
  { id: 4, title: 'Docs 2', url: 'https://docs.google.com/document/d/xyz', pinned: false },
  { id: 5, title: 'Sheets 1', url: 'https://sheets.google.com/spreadsheets/d/123', pinned: false },
];
const multiGroups = groupTabsOffline(multiTabGroups);
assertGroupExists(multiGroups, 'Gmail', 'Multi-tab Gmail group created');
assertGroupExists(multiGroups, 'Google Docs', 'Multi-tab Google Docs group created');
assertGroupHasTabs(multiGroups, 'Gmail', 2, 'Gmail has 2 tabs');
assertGroupHasTabs(multiGroups, 'Google Docs', 3, 'Google Docs has 3 tabs (Docs + Sheets)');
assert(multiGroups.length >= 2, 'Multi-tab groups work correctly');

// ============================================================================
// NEW EXTRACTOR GROUPING TESTS
// ============================================================================

console.log('\n=== New Extractor Grouping Tests ===\n');

// Test: Figma files - group by file, not one mega "Figma"
const figmaGroups = groupTabsOffline(FIXTURE_FIGMA_FILES);
assertGroupExists(figmaGroups, 'Figma Design System', 'Figma includes Design System file group');
assertGroupHasTabs(figmaGroups, 'Figma Design System', 2, 'Figma Design System has 2 tabs');
// Mobile App, Marketing Landing, and Brainstorm are singletons and should be dropped
assertEqual(figmaGroups.length, 1, 'Figma creates 1 group (other files are singletons)');
const hasFigmaMegaGroup = figmaGroups.some(g => g.name === 'Figma' && g.tabIds.length > 2);
assert(!hasFigmaMegaGroup, 'Figma does NOT create a mega-group');

// Test: X/Twitter mixed - group by profile/list/search, not one mega "Twitter"/"X"
const xGroups = groupTabsOffline(FIXTURE_X_TWITTER_MIXED);
assertGroupExists(xGroups, '@elonmusk', 'X includes @elonmusk profile group');
assertGroupExists(xGroups, '@NASA', 'X includes @NASA profile group');
assertGroupHasTabs(xGroups, '@elonmusk', 2, '@elonmusk has 2 tabs (profile + status)');
assertGroupHasTabs(xGroups, '@NASA', 2, '@NASA has 2 tabs (profile + status)');
// Lists, search, and hashtag are singletons and should be dropped
const hasXMegaGroup = xGroups.some(g => (g.name === 'Twitter' || g.name === 'X') && g.tabIds.length > 2);
assert(!hasXMegaGroup, 'X does NOT create a "Twitter" or "X" mega-group');
// Check that lists group exists if there are 2+ list tabs
const listGroup = xGroups.find(g => g.name.includes('List'));
if (listGroup) {
  assertGroupHasTabs(xGroups, listGroup.name, 2, 'X Lists group has 2 tabs');
}

// Test: Slack workspaces - group by channel/workspace, not one mega "Slack"
const slackGroups = groupTabsOffline(FIXTURE_SLACK_WORKSPACES);
// engineering and general are from Acme Corp, design and random from Design Co
assertGroupExists(slackGroups, 'Slack engineering', 'Slack includes engineering channel');
assertGroupExists(slackGroups, 'Slack general', 'Slack includes general channel');
// Product Team workspace is a singleton and should be dropped
const hasSlackMegaGroup = slackGroups.some(g => g.name === 'Slack' && g.tabIds.length > 2);
assert(!hasSlackMegaGroup, 'Slack does NOT create a mega-group');
assertEqual(slackGroups.length, 2, 'Slack creates 2 groups (engineering and general, others dropped)');

// Test: Linear teams - group by team/project, not one mega "Linear"
const linearGroups = groupTabsOffline(FIXTURE_LINEAR_TEAMS);
assertGroupExists(linearGroups, 'Linear ENG', 'Linear includes ENG team');
assertGroupExists(linearGroups, 'Linear DESIGN', 'Linear includes DESIGN team');
assertGroupHasTabs(linearGroups, 'Linear ENG', 2, 'Linear ENG has 2 issues');
assertGroupHasTabs(linearGroups, 'Linear DESIGN', 2, 'Linear DESIGN has 2 issues');
// API Redesign project is a singleton and should be dropped
const hasLinearMegaGroup = linearGroups.some(g => g.name === 'Linear' && g.tabIds.length > 2);
assert(!hasLinearMegaGroup, 'Linear does NOT create a mega-group');
assertEqual(linearGroups.length, 2, 'Linear creates 2 groups (ENG and DESIGN teams)');

// Test: Notion pages - group by workspace/page, not one mega "Notion"
const notionGroups = groupTabsOffline(FIXTURE_NOTION_PAGES);
assertGroupExists(notionGroups, 'Notion acme', 'Notion includes acme workspace');
assertGroupHasTabs(notionGroups, 'Notion acme', 2, 'Notion acme workspace has 2 pages');
// Product Roadmap, Design System, and Marketing site are singletons and should be dropped
const hasNotionMegaGroup = notionGroups.some(g => g.name === 'Notion' && g.tabIds.length > 2);
assert(!hasNotionMegaGroup, 'Notion does NOT create a mega-group');
assertEqual(notionGroups.length, 1, 'Notion creates 1 group (acme workspace)');

// ============================================================================
// NO MEGA-GROUP REGRESSION TESTS FOR NEW EXTRACTORS
// ============================================================================

console.log('\n=== New Extractor No Mega-Group Regression Tests ===\n');

// Test: Figma home page without file should NOT create "Figma" mega-group
const figmaNoFile = [
  { id: 1, title: 'Figma - Recent files', url: 'https://www.figma.com/files/recent', pinned: false },
];
const figmaNoFileGroups = groupTabsOffline(figmaNoFile);
const hasFigmaNoFileMegaGroup = figmaNoFileGroups.some(g => g.name === 'Figma');
assert(!hasFigmaNoFileMegaGroup, 'Figma page without file does NOT create "Figma" mega-group');

// Test: X home timeline should NOT create "Twitter"/"X" mega-group
const xHome = [
  { id: 1, title: 'Home / X', url: 'https://x.com/home', pinned: false },
];
const xHomeGroups = groupTabsOffline(xHome);
const hasXHomeMegaGroup = xHomeGroups.some(g => g.name === 'Twitter' || g.name === 'X');
assert(!hasXHomeMegaGroup, 'X home page does NOT create "Twitter" or "X" mega-group');

// Test: Slack without workspace/channel should NOT create "Slack" mega-group
const slackNoWorkspace = [
  { id: 1, title: 'Slack', url: 'https://slack.com/', pinned: false },
];
const slackNoWorkspaceGroups = groupTabsOffline(slackNoWorkspace);
const hasSlackNoWorkspaceMegaGroup = slackNoWorkspaceGroups.some(g => g.name === 'Slack');
assert(!hasSlackNoWorkspaceMegaGroup, 'Slack page without workspace does NOT create "Slack" mega-group');

// Test: Linear without team/project should NOT create "Linear" mega-group
const linearNoTeam = [
  { id: 1, title: 'Linear - Issues', url: 'https://linear.app/acme', pinned: false },
];
const linearNoTeamGroups = groupTabsOffline(linearNoTeam);
const hasLinearNoTeamMegaGroup = linearNoTeamGroups.some(g => g.name === 'Linear');
assert(!hasLinearNoTeamMegaGroup, 'Linear page without team does NOT create "Linear" mega-group');

// Test: Notion without workspace/page should NOT create "Notion" mega-group
const notionNoWorkspace = [
  { id: 1, title: 'Notion - Home', url: 'https://www.notion.so/', pinned: false },
];
const notionNoWorkspaceGroups = groupTabsOffline(notionNoWorkspace);
const hasNotionNoWorkspaceMegaGroup = notionNoWorkspaceGroups.some(g => g.name === 'Notion');
assert(!hasNotionNoWorkspaceMegaGroup, 'Notion page without workspace does NOT create "Notion" mega-group');

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('='.repeat(50) + '\n');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('✓ All tests passed!\n');
  process.exit(0);
}
