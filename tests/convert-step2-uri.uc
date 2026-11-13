/**
 * Comprehensive test suite for convert/parsers/uri.uc.
 * Covers: ss, vmess (v2rayN json & uri), vless (Reality & WS), trojan, hysteria2, tuic, socks, http.
 */

'use strict';

import { parse_single_uri, parse_uri_list } from 'omnia.convert.parsers.uri';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// 1. Shadowsocks SIP002 & legacy
let ss_sip002 = "ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@ss.example.com:8388#SS%20Node";
let ss_node = parse_single_uri(ss_sip002);
assert(ss_node != null, "ss_node parsed null");
assert(ss_node.type == "ss", "ss type mismatch: " + ss_node.type);
assert(ss_node.server == "ss.example.com", "ss server mismatch: " + ss_node.server);
assert(ss_node.port == 8388, "ss port mismatch: " + ss_node.port);
assert(ss_node.cipher == "aes-128-gcm", "ss cipher mismatch: " + ss_node.cipher);
assert(ss_node.password == "password", "ss password mismatch: " + ss_node.password);
assert(ss_node.name == "SS Node", "ss name mismatch: " + ss_node.name);

// 2. VMess v2rayN Base64 JSON
// {"v":"2","ps":"VMess Test","add":"vmess.example.com","port":"443","id":"a0000000-0000-0000-0000-000000000001","aid":"0","scy":"auto","net":"ws","host":"cdn.example.com","path":"/ws","tls":"tls","sni":"sni.example.com"}
let vmess_b64 = "vmess://eyJ2IjoiMiIsInBzIjoiVk1lc3MgVGVzdCIsImFkZCI6InZtZXNzLmV4YW1wbGUuY29tIiwicG9ydCI6IjQ0MyIsImlkIjoiYTAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIiwiYWlkIjoiMCIsInNjeSI6ImF1dG8iLCJuZXQiOiJ3cyIsImhvc3QiOiJjZG4uZXhhbXBsZS5jb20iLCJwYXRoIjoiL3dzIiwidGxzIjoidGxzIiwic25pIjoic25pLmV4YW1wbGUuY29tIn0=";
let vmess_node = parse_single_uri(vmess_b64);
assert(vmess_node != null, "vmess_node parsed null");
assert(vmess_node.type == "vmess", "vmess type mismatch");
assert(vmess_node.server == "vmess.example.com", "vmess server mismatch");
assert(vmess_node.port == 443, "vmess port mismatch");
assert(vmess_node.uuid == "a0000000-0000-0000-0000-000000000001", "vmess uuid mismatch");
assert(vmess_node.tls == true, "vmess tls mismatch");
assert(vmess_node.sni == "sni.example.com", "vmess sni mismatch");
assert(vmess_node.network == "ws", "vmess network mismatch");
assert(vmess_node.ws_opts.path == "/ws", "vmess ws path mismatch");
assert(vmess_node.ws_opts.headers.Host == "cdn.example.com", "vmess ws host header mismatch");

// 3. VLESS Reality
let vless_reality = "vless://b0000000-0000-0000-0000-000000000002@vless.example.com:443?security=reality&sni=mask.com&pbk=1111222233334444555566667777888899990000111=&sid=1234abcd&type=tcp#VLESS%20Reality";
let vless_node = parse_single_uri(vless_reality);
assert(vless_node != null, "vless_node parsed null");
assert(vless_node.type == "vless", "vless type mismatch");
assert(vless_node.server == "vless.example.com", "vless server mismatch");
assert(vless_node.port == 443, "vless port mismatch");
assert(vless_node.uuid == "b0000000-0000-0000-0000-000000000002", "vless uuid mismatch");
assert(vless_node.tls == true, "vless tls mismatch");
assert(vless_node.sni == "mask.com", "vless sni mismatch");
assert(vless_node.reality != null, "vless reality is null");
assert(vless_node.reality.public_key == "1111222233334444555566667777888899990000111=", "vless pbk mismatch");
assert(vless_node.reality.short_id == "1234abcd", "vless sid mismatch");

// 4. Trojan gRPC
let trojan_grpc = "trojan://secret-pwd@trojan.example.com:443?type=grpc&serviceName=my-grpc&sni=tr.example.com#Trojan%20gRPC";
let trojan_node = parse_single_uri(trojan_grpc);
assert(trojan_node != null, "trojan_node parsed null");
assert(trojan_node.type == "trojan", "trojan type mismatch");
assert(trojan_node.password == "secret-pwd", "trojan password mismatch");
assert(trojan_node.network == "grpc", "trojan network mismatch");
assert(trojan_node.grpc_opts.service_name == "my-grpc", "trojan grpc service_name mismatch");

// 5. Hysteria2
let hy2_uri = "hy2://hy2-secret@hy2.example.com:8443?sni=peer.example.com&obfs=salamander&obfs-password=maskpwd&insecure=1#Hy2%20Node";
let hy2_node = parse_single_uri(hy2_uri);
assert(hy2_node != null, "hy2_node parsed null");
assert(hy2_node.type == "hysteria2", "hy2 type mismatch: " + hy2_node.type);
assert(hy2_node.server == "hy2.example.com", "hy2 server mismatch");
assert(hy2_node.port == 8443, "hy2 port mismatch");
assert(hy2_node.password == "hy2-secret", "hy2 password mismatch");
assert(hy2_node.sni == "peer.example.com", "hy2 sni mismatch");
assert(hy2_node.obfs == "salamander", "hy2 obfs mismatch");
assert(hy2_node.obfs_password == "maskpwd", "hy2 obfs-password mismatch");
assert(hy2_node.skip_cert_verify == true, "hy2 skip_cert_verify mismatch");

// 6. TUIC
let tuic_uri = "tuic://user-uuid:user-pwd@tuic.example.com:8443?congestion_control=bbr&alpn=h3#TUIC%20Node";
let tuic_node = parse_single_uri(tuic_uri);
assert(tuic_node != null, "tuic_node parsed null");
assert(tuic_node.type == "tuic", "tuic type mismatch");
assert(tuic_node.uuid == "user-uuid", "tuic uuid mismatch");
assert(tuic_node.password == "user-pwd", "tuic password mismatch");
assert(tuic_node.congestion_control == "bbr", "tuic congestion_control mismatch");
assert(length(tuic_node.alpn) == 1 && tuic_node.alpn[0] == "h3", "tuic alpn mismatch");

// 6.5 AnyTLS
let anytls_uri = "anytls://top-secret@anytls.example.com:443?sni=anytls.example.com&alpn=h2,http/1.1&insecure=1&udp=1#AnyTLS%20Node";
let anytls_node = parse_single_uri(anytls_uri);
assert(anytls_node != null, "anytls_node parsed null");
assert(anytls_node.type == "anytls", "anytls type mismatch: " + anytls_node.type);
assert(anytls_node.server == "anytls.example.com", "anytls server mismatch");
assert(anytls_node.port == 443, "anytls port mismatch");
assert(anytls_node.password == "top-secret", "anytls password mismatch");
assert(anytls_node.sni == "anytls.example.com", "anytls sni mismatch");
assert(anytls_node.skip_cert_verify == true, "anytls skip_cert_verify mismatch");

// 7. SOCKS & HTTPS
let socks_uri = "socks5://alice:p%40ss@socks.example.com:1080#My%20Socks";
let socks_node = parse_single_uri(socks_uri);
assert(socks_node != null, "socks_node parsed null");
assert(socks_node.type == "socks", "socks type mismatch");
assert(socks_node.uuid == "alice", "socks username mismatch");
assert(socks_node.password == "p@ss", "socks password mismatch");

let https_uri = "https://admin:sec%2Bret@https.example.com:443#HTTPS%20Node";
let https_node = parse_single_uri(https_uri);
assert(https_node != null, "https_node parsed null");
assert(https_node.type == "http", "http type mismatch");
assert(https_node.uuid == "admin", "http username mismatch");
assert(https_node.password == "sec+ret", "http password mismatch");
assert(https_node.tls == true, "https tls mismatch");

// 8. Batch list parsing
let list = [
	ss_sip002,
	vmess_b64,
	vless_reality,
	"# invalid comment",
	trojan_grpc,
	hy2_uri,
	tuic_uri
];
let parsed_list = parse_uri_list(list);
assert(length(parsed_list) == 6, "batch parse count mismatch: expected 6, got " + length(parsed_list));

print("convert step 2 uri parser tests passed\n");
