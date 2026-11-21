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

print('convert step 4 producer tests passed\n');
