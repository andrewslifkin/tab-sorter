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
  { id: 4, title: 'JIRA - Sprint Board', url: 'https://mycompany.atlassian.net/jira/software/projects/ENG/boards/1', pinned: false },
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
// CLASSIFICATION TESTS
// ============================================================================

console.log('\n=== Classification Tests ===\n');

// Test known sites
const githubTab = { id: 1, title: 'GitHub', url: 'https://github.com/', pinned: false };
const githubClassification = classifyTab(githubTab);
assertEqual(githubClassification.groupName, 'GitHub', 'GitHub classified correctly');
assertEqual(githubClassification.color, 'grey', 'GitHub gets correct color');

const gmailTab = { id: 2, title: 'Gmail', url: 'https://mail.google.com/', pinned: false };
const gmailClassification = classifyTab(gmailTab);
assertEqual(gmailClassification.groupName, 'Gmail', 'Gmail classified correctly');
assertEqual(gmailClassification.color, 'red', 'Gmail gets correct color');

// Test hostname families
const slackTab = { id: 3, title: 'Slack', url: 'https://mycompany.slack.com/', pinned: false };
const slackClassification = classifyTab(slackTab);
assertEqual(slackClassification.groupName, 'Slack', 'Slack workspace classified correctly');

const atlassianTab = { id: 4, title: 'Jira', url: 'https://company.atlassian.net/browse/PROJ-123', pinned: false };
const atlassianClassification = classifyTab(atlassianTab);
assertEqual(atlassianClassification.groupName, 'Atlassian', 'Atlassian site classified correctly');

// Test ETLD+1 fallback
const unknownTab = { id: 5, title: 'Example', url: 'https://example.com/', pinned: false };
const unknownClassification = classifyTab(unknownTab);
assertEqual(unknownClassification.groupName, 'Example', 'Unknown domain uses title case domain');

// ============================================================================
// GROUPING TESTS
// ============================================================================

console.log('\n=== Grouping Tests ===\n');

// Test work morning fixture
const workGroups = groupTabsOffline(FIXTURE_WORK_MORNING);
assert(workGroups.length > 0, 'Work morning produces groups');
assert(workGroups.length <= 12, 'Work morning produces ≤12 groups');
assertGroupExists(workGroups, 'Gmail', 'Work morning includes Gmail group');
assertGroupExists(workGroups, 'GitHub', 'Work morning includes GitHub group');
assertGroupExists(workGroups, 'Slack', 'Work morning includes Slack group');
assertGroupExists(workGroups, 'Atlassian', 'Work morning includes Atlassian group');
assertGroupExists(workGroups, 'Google Docs', 'Work morning includes Google Docs group');
assertGroupHasTabs(workGroups, 'Google Docs', 2, 'Google Docs group has 2 tabs (Docs + Sheets)');

// Test multi-Google fixture
const googleGroups = groupTabsOffline(FIXTURE_MULTI_GOOGLE);
assert(googleGroups.length >= 2 && googleGroups.length <= 4, 'Multi-Google produces 2-4 groups');
assertGroupExists(googleGroups, 'Gmail', 'Multi-Google includes Gmail');
assertGroupExists(googleGroups, 'Google Docs', 'Multi-Google includes Google Docs');
assertGroupHasTabs(googleGroups, 'Google Docs', 3, 'Google Docs merges Docs/Sheets/Slides');

// Test mixed domains
const mixedGroups = groupTabsOffline(FIXTURE_MIXED_DOMAINS);
assert(mixedGroups.length >= 1, 'Mixed domains produces at least 1 group');
assertGroupExists(mixedGroups, 'GitHub', 'Mixed domains includes GitHub');

// Test ungroupable filtering
const ungroupableGroups = groupTabsOffline(FIXTURE_WITH_UNGROUPABLE);
assert(ungroupableGroups.length === 2, 'Ungroupable fixture produces 2 groups (GitHub + Gmail)');
const totalTabs = ungroupableGroups.reduce((sum, g) => sum + g.tabIds.length, 0);
assertEqual(totalTabs, 2, 'Ungroupable fixture groups only 2 tabs (excludes chrome:// and pinned)');

// Test cloud providers
const cloudGroups = groupTabsOffline(FIXTURE_CLOUD_PROVIDERS);
assertGroupExists(cloudGroups, 'AWS', 'Cloud fixture includes AWS');
assertGroupExists(cloudGroups, 'Azure', 'Cloud fixture includes Azure');
assertGroupExists(cloudGroups, 'Google Cloud', 'Cloud fixture includes Google Cloud');
assertGroupExists(cloudGroups, 'Vercel', 'Cloud fixture includes Vercel');
assertGroupExists(cloudGroups, 'Netlify', 'Cloud fixture includes Netlify');

// Test AI services
const aiGroups = groupTabsOffline(FIXTURE_AI_SERVICES);
assertGroupExists(aiGroups, 'ChatGPT', 'AI fixture includes ChatGPT');
assertGroupExists(aiGroups, 'Claude', 'AI fixture includes Claude');
assertGroupExists(aiGroups, 'Gemini', 'AI fixture includes Gemini');
assertGroupExists(aiGroups, 'Perplexity', 'AI fixture includes Perplexity');

// Test singleton handling
const singletonGroups = groupTabsOffline(FIXTURE_MANY_SINGLETONS);
assert(singletonGroups.length <= 2, 'Many singletons merged into 1-2 groups');
const hasOtherGroup = singletonGroups.some(g => g.name === 'Other');
assert(hasOtherGroup, 'Many singletons create an "Other" group');
if (hasOtherGroup) {
  assertGroupHasTabs(singletonGroups, 'Other', 5, 'Other group contains all 5 singletons');
}

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

// Single groupable tab
const singleTab = [
  { id: 1, title: 'GitHub', url: 'https://github.com/', pinned: false },
];
const singleGroups = groupTabsOffline(singleTab);
assertEqual(singleGroups.length, 1, 'Single tab produces one group');
assertEqual(singleGroups[0].tabIds.length, 1, 'Single group contains one tab');

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
