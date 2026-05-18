#!/usr/bin/env node
/*
 * KIS device compatibility smoke check.
 * This is intentionally static and dependency-free: it verifies that the shared
 * responsive foundation covers the target device classes and that each launch
 * surface touched by the roadmap imports the responsive layout helper.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const responsivePath = path.join(root, 'src/theme/responsive.ts');
const responsiveSource = fs.readFileSync(responsivePath, 'utf8');

const deviceMatrix = [
  { name: 'watch/very small', width: 240, height: 320, expected: 'watch' },
  { name: 'compact phone', width: 320, height: 568, expected: 'compactPhone' },
  { name: 'normal phone', width: 390, height: 844, expected: 'phone' },
  { name: 'tablet portrait', width: 768, height: 1024, expected: 'tablet' },
  { name: 'tablet landscape', width: 1024, height: 768, expected: 'tablet' },
  { name: 'large tablet', width: 1112, height: 1366, expected: 'largeTablet' },
  { name: 'split/foldable pane', width: 540, height: 720, expected: 'phone' },
];

const requiredSnippets = [
  "if (shortestSide <= 260) return 'watch'",
  "if (shortestSide < 360) return 'compactPhone'",
  "if (shortestSide < 600) return 'phone'",
  "if (shortestSide < 900) return 'tablet'",
  "return 'largeTablet'",
  'pageGutter',
  'contentMaxWidth',
  'minTouchTarget',
  'columns',
];

const phaseCoverage = [
  ['Messaging', 'src/screens/tabs/MessagesScreen.tsx'],
  ['Add contacts', 'src/Module/AddContacts/AddContactsPage.tsx'],
  ['Chat room bubbles', 'src/Module/ChatRoom/componets/MessageBubble.tsx'],
  ['Chat room composer', 'src/Module/ChatRoom/componets/main/MessageComposer.tsx'],
  ['Chat room info', 'src/Module/ChatRoom/ChatInfoPage.tsx'],
  ['Broadcast tabs', 'src/screens/tabs/BroadcastScreen.tsx'],
  ['Broadcast header', 'src/components/broadcast/BroadcastHeaderBar.tsx'],
  ['Channel discovery', 'src/screens/broadcast/channels/ChannelsDiscoverPage.tsx'],
  ['Channel home', 'src/screens/broadcast/channels/ChannelHomePage.tsx'],
  ['Channel studio', 'src/screens/broadcast/channels/studio/ChannelStudioScreen.tsx'],
  ['Bible main', 'src/screens/tabs/BibleScreen.tsx'],
  ['Bible reader', 'src/components/Bible/BibleReaderPanel.tsx'],
  ['Profile main', 'src/screens/tabs/ProfileScreen.tsx'],
  ['Profile dashboard', 'src/screens/tabs/profile/components/dashboard/ProfileDashboardBlocks.tsx'],
  ['Partners left rail', 'src/components/partners/PartnersLeftRail.tsx'],
  ['Partners sheet', 'src/components/partners/PartnerSheet.tsx'],
  ['Partners center', 'src/components/partners/PartnersCenterPane.tsx'],
  ['Commerce product drawer', 'src/screens/market/ProductEditorDrawer.tsx'],
  ['Commerce service drawer', 'src/screens/market/ServiceEditorDrawer.tsx'],
  ['Education card', 'src/screens/broadcast/education/components/EducationContentCard.tsx'],
  ['Education detail sheet', 'src/screens/broadcast/education/components/EducationDetailSheet.tsx'],
  ['Health dashboard', 'src/features/health-dashboard/ui/InstitutionDashboardShell.tsx'],
  ['Health management', 'src/screens/health/HealthInstitutionManagementScreen.tsx'],
];

let failed = false;
const fail = (message) => {
  failed = true;
  console.error(`FAIL ${message}`);
};
const pass = (message) => console.log(`PASS ${message}`);

for (const snippet of requiredSnippets) {
  if (!responsiveSource.includes(snippet)) fail(`responsive.ts missing ${snippet}`);
}
if (!failed) pass('responsive foundation contains expected device classes and layout tokens');

for (const device of deviceMatrix) {
  const shortest = Math.min(device.width, device.height);
  let actual = 'largeTablet';
  if (shortest <= 260) actual = 'watch';
  else if (shortest < 360) actual = 'compactPhone';
  else if (shortest < 600) actual = 'phone';
  else if (shortest < 900) actual = 'tablet';
  if (actual !== device.expected) {
    fail(`${device.name} classified as ${actual}; expected ${device.expected}`);
  } else {
    pass(`${device.name} ${device.width}x${device.height} -> ${actual}`);
  }
}

for (const [label, rel] of phaseCoverage) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`${label} missing file ${rel}`);
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('useResponsiveLayout')) {
    fail(`${label} does not import/use useResponsiveLayout (${rel})`);
  } else {
    pass(`${label} uses responsive layout`);
  }
}

if (failed) {
  console.error('\nDevice compatibility smoke check failed. Review the FAIL lines above.');
  process.exit(1);
}
console.log('\nDevice compatibility smoke check passed. Continue with manual device-lab QA.');
