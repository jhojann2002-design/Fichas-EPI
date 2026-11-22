// tests/e2e_suite.js
// Master Test Runner for E2E Test Suite (Tiers 1 to 4)
// Executed via: node tests/e2e_suite.js

const { runR1Tests } = require('./test_r1_cie10_offline.js');
const { runR2Tests } = require('./test_r2_covid_catalog.js');
const { runR3Tests } = require('./test_r3_form_state.js');
const { runTier3Tests } = require('./test_tier3_pairwise.js');
const { runTier4Tests } = require('./test_tier4_clinical_scenarios.js');

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function runMasterSuite() {
  const startTime = Date.now();
  console.log(`${BOLD}${CYAN}========================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  E2E TEST SUITE: OFFLINE CIE-10 SEARCH & FORM STATE MANAGEMENT  ${RESET}`);
  console.log(`${BOLD}${CYAN}========================================================================${RESET}`);
  console.log(`Execution Mode: Requirement-Driven Opaque-Box (Tiers 1-4)`);
  console.log(`Node Runtime:   ${process.version}`);
  console.log(`Timestamp:      ${new Date().toISOString()}`);
  console.log('------------------------------------------------------------------------\n');

  const suiteGroups = [
    {
      tier: 'Tier 1 & Tier 2: Requirement R1 (Local Bundled CIE-10 Search)',
      runner: runR1Tests
    },
    {
      tier: 'Tier 1 & Tier 2: Requirement R2 (EPI COVID-19 CIE-10 Corrections)',
      runner: runR2Tests
    },
    {
      tier: 'Tier 1 & Tier 2: Requirement R3 (Epicrisis Clean State Initialization)',
      runner: runR3Tests
    },
    {
      tier: 'Tier 3: Cross-Feature Combinations (Pairwise Coverage)',
      runner: runTier3Tests
    },
    {
      tier: 'Tier 4: Real-World Clinical Application Scenarios',
      runner: runTier4Tests
    }
  ];

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const failureList = [];

  suiteGroups.forEach(group => {
    console.log(`${BOLD}${BLUE}▶ ${group.tier}${RESET}`);
    const results = group.runner();

    results.forEach(res => {
      totalTests++;
      if (res.passed) {
        totalPassed++;
        console.log(`  ${GREEN}✓ PASS${RESET} ${res.name}`);
      } else {
        totalFailed++;
        failureList.push({ tier: group.tier, ...res });
        console.log(`  ${RED}✗ FAIL${RESET} ${res.name}`);
        if (res.error) {
          console.log(`         ${YELLOW}Error: ${res.error}${RESET}`);
        }
      }
    });
    console.log('');
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`${BOLD}========================================================================${RESET}`);
  console.log(`${BOLD}                       TEST SUITE EXECUTION SUMMARY                    ${RESET}`);
  console.log(`${BOLD}========================================================================${RESET}`);
  console.log(`Total Tests Run: ${totalTests}`);
  console.log(`Passed:          ${GREEN}${totalPassed}${RESET}`);
  console.log(`Failed:          ${totalFailed > 0 ? RED : GREEN}${totalFailed}${RESET}`);
  console.log(`Duration:        ${duration}s`);

  if (totalFailed > 0) {
    console.log(`\n${BOLD}${RED}Pending Implementation Failures (${totalFailed}):${RESET}`);
    failureList.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.tier}] ${f.name}`);
      console.log(`     ${f.error}`);
    });
    console.log(`\n${YELLOW}Note: Pending items correspond to in-progress Worker implementation files.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${BOLD}${GREEN}✔ ALL TESTS PASSED SUCCESSFULLY (100% PASS RATE)${RESET}\n`);
    process.exit(0);
  }
}

if (require.main === module) {
  runMasterSuite();
}

module.exports = { runMasterSuite };
