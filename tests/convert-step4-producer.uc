/**
 * Test suite for convert/producer.uc.
 * Covers:
 * 1. Base template preservation (_raw_outbound baseline + field override).
 * 2. Protocol synthesizers (ss, vmess, vless, trojan, hysteria2, tuic, anytls, socks, http).
 * 3. Type checking (server_port is int, arrays, objects).
 */

'use strict';

import { create_ir_node } from 'omnia.convert.ir';
import { produce_singbox_outbound, produce_singbox_outbounds } from 'omnia.convert.producer';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// 1. Test raw outbound fidelity & merging
let raw_node = create_ir_node({
	name: 'Renamed Tag',
	type: 'vless',
	server: 'hk.example.com',
	port: 443,
	_raw_outbound: {
		type: 'vless',
		tag: 'Old Tag',
		server: 'hk.example.com',
		server_port: 443,
		uuid: 'abcd',
		tls: {
			enabled: true,
			reality: {
				enabled: true,
				public_key: 'pk123',
				short_id: '01'
			}
		},
		multiplex: {
			enabled: true,
			protocol: 'smux'
		},
		bind_interface: 'eth0',
		domain_resolver: 'bad-dns'
	}
});

let out_raw = produce_singbox_outbound(raw_node);
assert(out_raw != null, 'out_raw is null');
assert(out_raw.tag == 'Renamed Tag', 'Tag should be overridden by IR name');
assert(out_raw.tls.reality.public_key == 'pk123', 'Reality public_key must be preserved');
assert(out_raw.multiplex.protocol == 'smux', 'Multiplex must be preserved');
assert(out_raw.bind_interface == null, 'bind_interface must be stripped');
assert(out_raw.domain_resolver == null, 'domain_resolver must be stripped');

// 2. Test VLESS Reality synthesis from IR (e.g. from URI)
let vless_ir = create_ir_node({
	name: 'VLESS-Node',
	type: 'vless',
	server: 'vless.com',
	port: 443,
	uuid: 'my-uuid',
	flow: 'xtls-rprx-vision',
	tls: true,
	sni: 'vless.com',
	reality: {
		public_key: 'pbk-val',
		short_id: 'sid-val'
	}
});
let out_vless = produce_singbox_outbound(vless_ir);
assert(out_vless.type == 'vless', 'vless type mismatch');
assert(out_vless.server_port == 443 && type(out_vless.server_port) == 'int', 'server_port must be int');
assert(out_vless.tls.reality.public_key == 'pbk-val', 'reality public_key mismatch');

// 2.1 Test VLESS xhttp synthesis with packet_encoding and uTLS
let vless_xhttp_ir = create_ir_node({
	name: 'VLESS-XHTTP-Node',
	type: 'vless',
	server: 'vless-xhttp.com',
	port: 443,
	uuid: 'my-uuid-xhttp',
	tls: true,
	fingerprint: 'chrome',
	network: 'xhttp',
	httpupgrade_opts: { path: '/xhttp-path', host: 'vless-xhttp.com' },
	packet_encoding: 'packetaddr'
});
let out_vless_xhttp = produce_singbox_outbound(vless_xhttp_ir);
assert(out_vless_xhttp.type == 'vless', 'vless xhttp type mismatch');
assert(out_vless_xhttp.packet_encoding == 'packetaddr', 'vless packet_encoding mismatch');
assert(out_vless_xhttp.transport.type == 'httpupgrade', 'vless transport type mismatch');
assert(out_vless_xhttp.transport.path == '/xhttp-path', 'vless transport path mismatch');
assert(out_vless_xhttp.transport.host == 'vless-xhttp.com', 'vless transport host mismatch');
assert(out_vless_xhttp.tls.utls.enabled == true, 'vless utls enabled mismatch');
assert(out_vless_xhttp.tls.utls.fingerprint == 'chrome', 'vless utls fingerprint mismatch');

// 3. Test Hysteria2 synthesis from IR
let hy2_ir = create_ir_node({
	name: 'Hy2-Node',
	type: 'hysteria2',
	server: 'hy2.com',
	port: 8443,
	password: 'pass',
	obfs: 'salamander',
	obfs_password: 'mask',
	up_mbps: 50,
	down_mbps: 100
});
let out_hy2 = produce_singbox_outbound(hy2_ir);
assert(out_hy2.type == 'hysteria2', 'hy2 type mismatch');
assert(out_hy2.obfs.type == 'salamander', 'hy2 obfs type mismatch');
assert(out_hy2.obfs.password == 'mask', 'hy2 obfs password mismatch');
assert(out_hy2.up_mbps == 50, 'up_mbps mismatch');

// 3.1 Test Hysteria2 gecko obfs synthesis from IR
let hy2_gecko_ir = create_ir_node({
	name: 'Hy2-Gecko-Node',
	type: 'hysteria2',
	server: 'hy2.com',
	port: 8443,
	password: 'pass',
	obfs: 'gecko',
	obfs_password: 'geckopassword',
	obfs_min_packet_size: 64,
	obfs_max_packet_size: 1350,
	fingerprint: 'chrome'
});
let out_hy2_gecko = produce_singbox_outbound(hy2_gecko_ir);
assert(out_hy2_gecko.type == 'hysteria2', 'hy2 gecko type mismatch');
assert(out_hy2_gecko.obfs.type == 'gecko', 'hy2 gecko obfs type mismatch');
assert(out_hy2_gecko.obfs.password == 'geckopassword', 'hy2 gecko password mismatch');
assert(out_hy2_gecko.obfs.min_packet_size == 64 && type(out_hy2_gecko.obfs.min_packet_size) == 'int', 'min_packet_size must be int 64');
assert(out_hy2_gecko.obfs.max_packet_size == 1350 && type(out_hy2_gecko.obfs.max_packet_size) == 'int', 'max_packet_size must be int 1350');
assert(out_hy2_gecko.tls.utls.enabled == true && out_hy2_gecko.tls.utls.fingerprint == 'chrome', 'tls.utls mismatch');

// 4. Test AnyTLS synthesis from IR
let anytls_ir = create_ir_node({
	name: 'AnyTLS-Node',
	type: 'anytls',
	server: 'any.com',
	port: 443,
	password: 'sec',
	sni: 'any.com',
	tls: true
});
let out_anytls = produce_singbox_outbound(anytls_ir);
assert(out_anytls.type == 'anytls', 'anytls type mismatch');
assert(out_anytls.tls.server_name == 'any.com', 'anytls server_name mismatch');

// 5. Test clean_singbox_outbound: Hysteria2 obfs "none" purging (Exact bug reproduction & guard)
let hy2_none_ir = create_ir_node({
	name: 'Hy2-None',
	type: 'hysteria2',
	server: '14.224.40.140',
	port: 21634,
	password: 'pass',
	obfs: 'none',
	obfs_password: '',
	_raw_outbound: {
		type: 'hysteria2',
		tag: 'Hy2-Raw-None',
		server: '14.224.40.140',
		server_port: 21634,
		password: 'pass',
		tls: { enabled: true, server_name: 'addons.mozilla.org', insecure: true },
		obfs: { type: 'none', password: '' },
		up_mbps: 200,
		down_mbps: 1000
	}
});
let out_hy2_none = produce_singbox_outbound(hy2_none_ir);
assert(out_hy2_none != null, 'out_hy2_none is null');
assert(out_hy2_none.type == 'hysteria2', 'type should be hysteria2');
assert(out_hy2_none.obfs == null, 'obfs type: "none" MUST be purged from hysteria2 outbound');
assert(out_hy2_none.up_mbps == 200, 'up_mbps preserved');

// 6. Test clean_singbox_outbound: Non-hysteria2 rogue obfs purging
let ss_rogue_obfs = create_ir_node({
	name: 'SS-Rogue',
	type: 'ss',
	server: '1.2.3.4',
	port: 8388,
	password: 'pass',
	cipher: 'aes-128-gcm',
	_raw_outbound: {
		type: 'shadowsocks',
		tag: 'SS-Raw-Rogue',
		server: '1.2.3.4',
		server_port: 8388,
		method: 'aes-128-gcm',
		password: 'pass',
		obfs: { type: 'websocket' },
		plugin: 'none'
	}
});
let out_ss_rogue = produce_singbox_outbound(ss_rogue_obfs);
assert(out_ss_rogue != null, 'out_ss_rogue is null');
assert(out_ss_rogue.type == 'shadowsocks', 'type should be shadowsocks');
assert(out_ss_rogue.obfs == null, 'rogue obfs MUST be purged from shadowsocks outbound');
assert(out_ss_rogue.plugin == null, 'plugin: "none" MUST be purged from shadowsocks outbound');

// 7. Test clean_singbox_outbound: VMess packet_encoding and disabled multiplex
let vmess_clean_test = create_ir_node({
	name: 'VMess-Test',
	type: 'vmess',
	server: 'vmess.example.com',
	port: 443,
	uuid: '1111-2222',
	packet_encoding: 'packetaddr',
	_raw_outbound: {
		type: 'vmess',
		tag: 'VMess-Raw',
		server: 'vmess.example.com',
		server_port: 443,
		uuid: '1111-2222',
		packet_encoding: 'packetaddr',
		multiplex: { enabled: false },
		tls: {
			enabled: true,
			reality: { enabled: true, public_key: '', short_id: '' }
		}
	}
});
let out_vmess_clean = produce_singbox_outbound(vmess_clean_test);
assert(out_vmess_clean.packet_encoding == 'packetaddr', 'packet_encoding must be preserved');
assert(out_vmess_clean.multiplex == null, 'disabled multiplex must be purged');
assert(out_vmess_clean.tls.reality == null, 'reality with empty public key must be purged');

// 7.1 Test clean_singbox_outbound preserving gecko obfs, utls, and httpupgrade transport
let preserved_clean_test = create_ir_node({
	name: 'Preserved-Test',
	type: 'vless',
	server: 'vless-preserved.com',
	port: 443,
	_raw_outbound: {
		type: 'vless',
		tag: 'VLESS-Preserved',
		server: 'vless-preserved.com',
		server_port: 443,
		uuid: '2222-3333',
		packet_encoding: 'packetaddr',
		transport: {
			type: 'httpupgrade',
			path: '/my-up',
			host: 'vless-preserved.com'
		},
		tls: {
			enabled: true,
			server_name: 'vless-preserved.com',
			utls: {
				enabled: true,
				fingerprint: 'chrome'
			}
		}
	}
});
let out_preserved_clean = produce_singbox_outbound(preserved_clean_test);
assert(out_preserved_clean.transport != null, 'transport should be preserved');
assert(out_preserved_clean.transport.type == 'httpupgrade', 'httpupgrade transport preserved');
assert(out_preserved_clean.tls.utls != null, 'tls.utls should be preserved');
assert(out_preserved_clean.tls.utls.fingerprint == 'chrome', 'tls.utls.fingerprint preserved');

// 8. Test dropped_stats tracking and x_omnia_dropped_fields
let dropped_stats = {};
let out_tracked = produce_singbox_outbound(ss_rogue_obfs, dropped_stats);
assert(out_tracked != null, 'out_tracked is null');
assert(dropped_stats.obfs == 1, 'dropped_stats should record purged obfs');
assert(dropped_stats.plugin == 1, 'dropped_stats should record purged plugin');
assert(type(out_tracked.x_omnia_dropped_fields) == 'array', 'x_omnia_dropped_fields should be array');
assert(length(out_tracked.x_omnia_dropped_fields) == 2, 'x_omnia_dropped_fields should have 2 items');

print('convert step 4 producer tests passed\n');
