'use strict';

import { readfile, writefile } from 'fs';
import { subscription_refresh_source, subscriptions_refresh } from 'omnia.subscription';

/* Run in an isolated OpenWrt environment with a local fixture at port 18080. */
let base = json(readfile('/work/luci-app-omnia/root/usr/share/omnia/defaults/subscriptions.json'));
base.sources = [
	{ id: 'one', name: 'One', url: 'http://127.0.0.1:18080/one', enabled: true },
	{ id: 'two', name: 'Two', url: 'http://127.0.0.1:18080/two', enabled: true }
];
writefile('/etc/omnia/subscriptions.json', sprintf('%J', base));
let snapshot = {
	schema_version: 1, source: 'sub-store',
	sources: [
		{ id: 'one', name: 'One', status: 'updated', ok: true },
		{ id: 'two', name: 'Two', status: 'failed_no_previous', ok: false, error: 'prior error' }
	],
	outbounds: [ { type: 'socks', tag: 'old', x_omnia_source_id: 'one', x_omnia_source_name: 'One' } ]
};
writefile('/etc/omnia/node-snapshot.json', sprintf('%J', snapshot));
let result = subscription_refresh_source('test', { source_id: 'one' });
assert(result.ok, 'single-source refresh succeeds despite another empty source');
let saved = json(readfile('/etc/omnia/node-snapshot.json'));
assert(saved.outbounds[0].tag == 'new', 'new node saved');
assert(saved.sources[1].ok == false && saved.sources[1].error == 'prior error', 'prior failure preserved');
writefile('/etc/omnia/node-snapshot.json', 'invalid');
result = subscription_refresh_source('test', { source_id: 'one' });
assert(!result.ok && readfile('/etc/omnia/node-snapshot.json') == 'invalid', 'invalid snapshot is not overwritten');

let renamed_snapshot = { ...snapshot, sources: [ snapshot.sources[0], { id: 'old-two', name: 'Two', status: 'updated', ok: true } ], outbounds: [ ...snapshot.outbounds, { type: 'socks', tag: 'old-two-node', x_omnia_source_id: 'old-two', x_omnia_source_name: 'Two' } ] };
writefile('/etc/omnia/node-snapshot.json', sprintf('%J', renamed_snapshot));
let previous_snapshot = readfile('/etc/omnia/node-snapshot.json');
result = subscription_refresh_source('test', { source_id: 'one' });
assert(!result.ok && readfile('/etc/omnia/node-snapshot.json') == previous_snapshot, 'changed unselected source id cannot silently remove its old nodes');

snapshot.sources[1] = { id: 'two', name: 'Two', status: 'updated', ok: true };
push(snapshot.outbounds, { type: 'socks', tag: 'previous-two', x_omnia_source_id: 'two', x_omnia_source_name: 'Two' });
writefile('/etc/omnia/node-snapshot.json', sprintf('%J', snapshot));
result = subscriptions_refresh('test', {});
assert(result.ok && result.data.status == 'partial', 'partial multi-source refresh');
saved = json(readfile('/etc/omnia/node-snapshot.json'));
assert(saved.outbounds[0].tag == 'new' && saved.outbounds[1].tag == 'previous-two', 'updated and preserved nodes saved');
assert(saved.sources[1].ok == false, 'failed source is reported');

base.sources[1].url = 'http://127.0.0.1:18080/three';
writefile('/etc/omnia/subscriptions.json', sprintf('%J', base));
result = subscriptions_refresh('test', {});
assert(result.ok && result.data.status == 'success', 'both sources refresh successfully');
saved = json(readfile('/etc/omnia/node-snapshot.json'));
assert(saved.outbounds[0].tag == 'new' && saved.outbounds[1].tag == 'second', 'both sources saved');

base.sources[1].url = 'http://127.0.0.1:18080/duplicate';
writefile('/etc/omnia/subscriptions.json', sprintf('%J', base));
let before = readfile('/etc/omnia/node-snapshot.json');
result = subscriptions_refresh('test', {});
assert(!result.ok && readfile('/etc/omnia/node-snapshot.json') == before, 'duplicate tags reject whole snapshot without overwriting it');
print('subscription refresh integration OK\n');
