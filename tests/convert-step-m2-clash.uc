/**
 * Test suite for convert/parsers/clash.uc.
 * Tests:
 * 1. Flow style parsing (inline JSON-like YAML objects).
 * 2. Block style parsing (indented multi-line mapping with nested options).
 * 3. Comment stripping (full line & trailing).
 * 4. Multi-protocol mapping (ss, vmess, vless, trojan, hysteria2, tuic).
 * 5. Rejection of dialer-proxy / detour (chaining) and wireguard.
 * 6. Dropping invalid items (port out of range, missing server).
 */

'use strict';

import { parse_clash_yaml, extract_clash_proxy_dicts } from 'omnia.convert.parsers.clash';
import { convert_subscription } from 'omnia.convert.pipeline';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// 1. Flow style mapping test
let flow_yaml = `
proxies:
  - { name: "HK SS", type: ss, server: 1.1.1.1, port: 8388, cipher: aes-128-gcm, password: "pwd", udp: true }
  - { name: 'JP Trojan', type: trojan, server: 2.2.2.2, port: 443, password: pwd2, sni: jp.example.com, skip-cert-verify: true }
`;

let res_flow = parse_clash_yaml(flow_yaml);
assert(res_flow.stats.accepted == 2, "Flow style should accept 2 proxies, got: " + res_flow.stats.accepted);
assert(res_flow.nodes[0].name == "HK SS", "Flow node 0 name mismatch");
assert(res_flow.nodes[0].type == "ss", "Flow node 0 type mismatch");
assert(res_flow.nodes[0].port == 8388, "Flow node 0 port mismatch");
assert(res_flow.nodes[0].udp == true, "Flow node 0 udp mismatch");
assert(res_flow.nodes[1].name == "JP Trojan", "Flow node 1 name mismatch");
assert(res_flow.nodes[1].sni == "jp.example.com", "Flow node 1 sni mismatch");
assert(res_flow.nodes[1].skip_cert_verify == true, "Flow node 1 skip_cert_verify mismatch");

// 2. Block style with comments, reality-opts, and ws-opts
let block_yaml = `
# Top-level comment
port: 7890
socks-port: 7891
proxies:
  # First proxy: VLESS Reality
  - name: "US VLESS"
    type: vless
    server: us.example.com
    port: 443
    uuid: 00000000-0000-0000-0000-000000000001
    tls: true
    flow: xtls-rprx-vision
    servername: us.sni.com
    reality-opts:
      public-key: my_public_key=
      short-id: abcd
    packet-encoding: xudp

  # Second proxy: VMess WS
  - name: "SG VMess" # inline comment
    type: vmess
    server: sg.example.com
    port: 8080
    uuid: 00000000-0000-0000-0000-000000000002
    alterId: 0
    cipher: auto
    network: ws
    ws-opts:
      path: /graphql
      headers:
        Host: sg.example.com

  # Third proxy: Hysteria2
  - name: "KR Hy2"
    type: hysteria2
    server: kr.example.com
    port: 8443
    password: hy2password
    obfs: salamander
    obfs-password: obfspassword
    up: 100
    down: 500

  # Invalid 1: wireguard (unsupported proxy outbound)
  - name: "WG Node"
    type: wireguard
    server: wg.example.com
    port: 51820

  # Invalid 2: dialer-proxy / chained detour (must be rejected)
  - name: "Chained Node"
    type: ss
    server: 3.3.3.3
    port: 8388
    cipher: aes-128-gcm
    password: pass
    dialer-proxy: "SG VMess"

  # Invalid 3: bad port
  - name: "Bad Port"
    type: ss
    server: 4.4.4.4
    port: 90000
    cipher: aes-128-gcm
    password: pass

proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - "US VLESS"
`;

let res_block = parse_clash_yaml(block_yaml);
assert(res_block.stats.accepted == 3, "Expected 3 accepted proxies from block yaml, got: " + res_block.stats.accepted);
assert(res_block.stats.skipped_unsupported == 1, "Expected 1 skipped unsupported (wireguard)");
assert(res_block.stats.skipped_chained == 1, "Expected 1 skipped chained (dialer-proxy)");
assert(res_block.stats.skipped_invalid == 1, "Expected 1 skipped invalid (port 90000)");

// Verify VLESS reality-opts mapping
let vless_node = res_block.nodes[0];
assert(vless_node.name == "US VLESS", "VLESS name mismatch");
assert(vless_node.reality != null, "VLESS reality should not be null");
assert(vless_node.reality.public_key == "my_public_key=", "VLESS reality public_key mismatch");
assert(vless_node.reality.short_id == "abcd", "VLESS reality short_id mismatch");
assert(vless_node.flow == "xtls-rprx-vision", "VLESS flow mismatch");

// Verify VMess ws-opts mapping
let vmess_node = res_block.nodes[1];
assert(vmess_node.name == "SG VMess", "VMess name mismatch");
assert(vmess_node.network == "ws", "VMess network mismatch");
assert(vmess_node.ws_opts != null, "VMess ws_opts should not be null");
assert(vmess_node.ws_opts.path == "/graphql", "VMess ws_opts path mismatch");

// Verify Hysteria2 mapping
let hy2_node = res_block.nodes[2];
assert(hy2_node.name == "KR Hy2", "Hy2 name mismatch");
assert(hy2_node.obfs == "salamander", "Hy2 obfs mismatch");
assert(hy2_node.obfs_password == "obfspassword", "Hy2 obfs_password mismatch");
assert(hy2_node.up_mbps == 100, "Hy2 up_mbps mismatch");
assert(hy2_node.down_mbps == 500, "Hy2 down_mbps mismatch");

// 3. End-to-End pipeline conversion of Clash YAML
let res_pipe = convert_subscription("trace-m2-pipe", block_yaml);
assert(res_pipe.ok == true, "convert_subscription failed on Clash YAML: " + res_pipe.error);
assert(res_pipe.format == "clash_yaml", "Format should be clash_yaml");
assert(length(res_pipe.outbounds) == 3, "Expected 3 outbounds from pipeline");
assert(res_pipe.outbounds[0].tag == "US VLESS", "First outbound tag mismatch");
assert(res_pipe.outbounds[1].type == "vmess", "Second outbound type mismatch");
assert(res_pipe.outbounds[2].type == "hysteria2", "Third outbound type mismatch");

// 4. End-to-End Base64 Clash YAML test
let b64_clash = b64enc(flow_yaml);
let res_b64 = convert_subscription("trace-m2-b64", b64_clash);
assert(res_b64.ok == true, "convert_subscription failed on Base64 Clash YAML");
assert(res_b64.format == "base64_clash_yaml", "Format should be base64_clash_yaml");
assert(length(res_b64.outbounds) == 2, "Expected 2 outbounds from Base64 Clash");

print("convert step m2 clash parser tests passed\n");
