/**
 * Omnia | tests/profile-selectors.uc
 * Comprehensive tests for Selector Outbounds Dynamic Allocation
 */

'use strict';

import { resolve_selector_members, sync_template_selectors, get_main_selector_tag, get_direct_outbound_tag, region_flag_str, region_name_str, get_selector_candidate_pool } from 'omnia.profile_selectors';
import { inject_selectors } from 'omnia.generator_selectors';
import { restore_manual_selector_references, MANUAL_SELECTOR_TAG } from 'omnia.generator_manual_selector';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

function assert_deep_equal(a, b, message) {
	let sa = sprintf("%J", a);
	let sb = sprintf("%J", b);
	if (sa != sb)
		die('Assertion failed (' + message + '): ' + sa + ' != ' + sb);
}

// Mock groups
let mock_groups = [
	{ tag: "HK-Group", x_omnia_region: "HK" },
	{ tag: "SG-Group", x_omnia_region: "SG" },
	{ tag: "US-Group", x_omnia_region: "US" },
	{ tag: "JP-Group", x_omnia_region: "JP" },
	{ tag: "TW-Group", x_omnia_region: "TW" }
];

let main_tag = "🗽 节点选择";
let direct_tag = "🎯 全球直连";
let manual_tag = MANUAL_SELECTOR_TAG;

// -----------------------------------------------------------------------------
// 1. resolve_selector_members
// -----------------------------------------------------------------------------
print("Testing resolve_selector_members...\n");

// Test normal resolution of region tags + system tags
let resolved = resolve_selector_members([ "SG", "HK", "main", "direct" ], mock_groups, main_tag, direct_tag, manual_tag);
assert_deep_equal(resolved, [ "SG-Group", "HK-Group", "🗽 节点选择", "🎯 全球直连" ], "Resolved items match ordered groups and system tags");

// Test manual selector resolution
let resolved_manual = resolve_selector_members([ "manual", "US" ], mock_groups, main_tag, direct_tag, manual_tag);
assert_deep_equal(resolved_manual, [ manual_tag, "US-Group" ], "Manual selector and US group resolved in order");

// Test automatic fallback: when selected region has no matching nodes/groups
let empty_resolved = resolve_selector_members([ "FR" ], mock_groups, main_tag, direct_tag, manual_tag);
assert_deep_equal(empty_resolved, [ "🗽 节点选择" ], "Empty resolution automatically falls back to main selector");

// Test duplicate removal
let dup_resolved = resolve_selector_members([ "HK", "HK", "main", "main" ], mock_groups, main_tag, direct_tag, manual_tag);
assert_deep_equal(dup_resolved, [ "HK-Group", "🗽 节点选择" ], "Duplicates are removed preserving order");

// -----------------------------------------------------------------------------
// 2. inject_selectors Priority 1 (Omnia Override) vs Fallback
// -----------------------------------------------------------------------------
print("Testing inject_selectors priorities...\n");

let mock_nodes = [
	{ tag: "node-1" },
	{ tag: "node-2" }
];

let test_profile = {
	outbounds: [
		{ type: "direct", tag: "🎯 全球直连" },
		{ type: "selector", tag: "🗽 节点选择", x_rule: "main", outbounds: [] },
		{ type: "selector", tag: "📺️ Netflix", x_rule: "region:SG,HK,TW", outbounds: [ "template-default-1" ] },
		{ type: "selector", tag: "🅾️ OpenAI", x_rule: "region:US", outbounds: [] },
		{ type: "selector", tag: "🍎 Apple", x_rule: "keep", outbounds: [ "🎯 全球直连" ] },
		{ type: "selector", tag: "🎥 YouTube", x_rule: "all_regions", outbounds: [] }
	]
};

// Scenario: Netflix has custom Omnia config ['SG', 'main']; others are empty or not configured
let selector_configs = {
	"📺️ Netflix": [ "SG", "main" ],
	"🅾️ OpenAI": [] // empty list -> fallback to x_rule
};

let injected_count = inject_selectors(test_profile, mock_nodes, mock_groups, selector_configs);
assert(injected_count > 0, "Selectors injected count > 0");

// Verify Netflix used Omnia config (Priority 1)
let netflix = test_profile.outbounds[2];
assert_deep_equal(netflix.outbounds, [ "SG-Group", "🗽 节点选择" ], "Netflix used Omnia custom configuration");

// Verify OpenAI used x_rule (Priority 2 fallback)
let openai = test_profile.outbounds[3];
assert_deep_equal(openai.outbounds, [ "🗽 节点选择", "US-Group" ], "OpenAI fell back to x_rule region:US");

// Verify YouTube used x_rule (Priority 2 fallback for all_regions)
let youtube = test_profile.outbounds[5];
assert(youtube.outbounds[0] == "🗽 节点选择", "YouTube first outbound is main");
assert(length(youtube.outbounds) == 6, "YouTube contains main + 5 region groups");

// Verify Apple kept its original outbound
let apple = test_profile.outbounds[4];
assert_deep_equal(apple.outbounds, [ "🎯 全球直连" ], "Apple kept original outbound");

// Verify main selector was populated with all groups and unmatched nodes
let main_sel = test_profile.outbounds[1];
assert(main_sel.tag == "🗽 节点选择", "Main selector tag preserved");
assert(length(main_sel.outbounds) > 0, "Main selector populated");

// -----------------------------------------------------------------------------
// 3. restore_manual_selector_references Isolation
// -----------------------------------------------------------------------------
print("Testing restore_manual_selector_references...\n");

let consumers = {
	"📺️ Netflix": true,
	"🎥 YouTube": true
};

restore_manual_selector_references(test_profile, consumers, selector_configs);

// Netflix has custom Omnia config without manual -> should NOT have manual selector injected
assert(index(netflix.outbounds, MANUAL_SELECTOR_TAG) == -1, "Customized Netflix does not receive auto manual selector");

// YouTube has no custom Omnia config -> SHOULD have manual selector appended
assert(index(youtube.outbounds, MANUAL_SELECTOR_TAG) != -1, "Uncustomized YouTube receives auto manual selector");

// -----------------------------------------------------------------------------
// 4. get_main_selector_tag & get_direct_outbound_tag
// -----------------------------------------------------------------------------
print("Testing tag helpers...\n");
assert(get_main_selector_tag(test_profile) == "🗽 节点选择", "Main selector tag correctly identified");
assert(get_direct_outbound_tag(test_profile) == "🎯 全球直连", "Direct outbound tag correctly identified");

// -----------------------------------------------------------------------------
// 5. region_flag_str, region_name_str & expanded country flags dictionary
// -----------------------------------------------------------------------------
print("Testing expanded national flags & candidate pool...\n");
assert(region_flag_str("NG") == "🇳🇬", "Nigeria flag matches");
assert(region_name_str("NG") == "尼日利亚", "Nigeria name matches");
assert(region_flag_str("UA") == "🇺🇦", "Ukraine flag matches");
assert(region_name_str("UA") == "乌克兰", "Ukraine name matches");
assert(region_flag_str("EG") == "🇪🇬", "Egypt flag matches");
assert(region_name_str("EG") == "埃及", "Egypt name matches");
assert(region_flag_str("PK") == "🇵🇰", "Pakistan flag matches");
assert(region_name_str("PK") == "巴基斯坦", "Pakistan name matches");
assert(region_flag_str("TR") == "🇹🇷", "Turkey flag matches");
assert(region_name_str("TR") == "土耳其", "Turkey name matches");
assert(region_flag_str("AR") == "🇦🇷", "Argentina flag matches");
assert(region_name_str("AR") == "阿根廷", "Argentina name matches");

// ISO 2-letter algorithmic fallback
assert(length(region_flag_str("ZZ")) > 0, "Algorithmic flag generated for ZZ");
assert(region_name_str("ZZ") == "ZZ", "Name falls back to code for ZZ");

// Candidate pool resolution with dynamic regions
let mock_subscriptions = {
	region_keywords: {
		NG: [ "Nigeria" ],
		UA: [ "Ukraine" ],
		US: [ "USA" ]
	}
};
let pool = get_selector_candidate_pool(test_profile, mock_groups, mock_subscriptions, "main");
assert(length(pool.regions) == 3, "Candidate pool extracted 3 custom regions");
assert(pool.regions[0].id == "NG", "Pool region 0 is NG");
assert(index(pool.regions[0].label, "🇳🇬") >= 0, "Pool region 0 contains NG flag");
assert(index(pool.regions[0].label, "尼日利亚") >= 0, "Pool region 0 contains Chinese name");
assert(pool.regions[1].id == "UA", "Pool region 1 is UA");
assert(index(pool.regions[1].label, "🇺🇦") >= 0, "Pool region 1 contains UA flag");

print("ALL profile_selectors unit tests passed successfully!\n");
