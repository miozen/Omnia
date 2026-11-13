/**
 * Omnia | convert/ir.uc
 * Unified Intermediate Representation (IR) node definition and utilities.
 */

'use strict';

/**
 * Protocol support matrix in Omnia:
 * - Full support: ss, vmess, vless, trojan, hysteria2, tuic, socks, http
 * - Architecture reserved: anytls (Native sing-box JSON pass-through preserved; URI parser reserved)
 * - Explicitly rejected: hysteria (deprecated v1), wireguard (endpoint), shadowtls/detour chain
 */
const SUPPORTED_PROTOCOLS = {
	'ss': 'full',
	'vmess': 'full',
	'vless': 'full',
	'trojan': 'full',
	'hysteria2': 'full',
	'tuic': 'full',
	'socks': 'full',
	'http': 'full',
	'anytls': 'full'
};

function is_protocol_supported(proto) {
	if (type(proto) != 'string')
		return false;
	let status = SUPPORTED_PROTOCOLS[proto];
	return status == 'full' || status == 'partial';
}

function protocol_support_status(proto) {
	if (type(proto) != 'string')
		return 'unsupported';
	return SUPPORTED_PROTOCOLS[proto] || 'unsupported';
}

/**
 * Creates a normalized Intermediate Representation (IR) node.
 */
function create_ir_node(data) {
	if (type(data) != 'object' || data == null)
		return null;

	let proto = type(data.type) == 'string' ? data.type : '';
	let port = int(data.port || 0);

	return {
		name: type(data.name) == 'string' ? data.name : (type(data.tag) == 'string' ? data.tag : ''),
		type: proto,
		server: type(data.server) == 'string' ? data.server : '',
		port: port,
		uuid: type(data.uuid) == 'string' ? data.uuid : '',
		password: type(data.password) == 'string' ? data.password : '',
		security: type(data.security) == 'string' ? data.security : '',
		cipher: type(data.cipher) == 'string' ? data.cipher : (type(data.method) == 'string' ? data.method : ''),
		alterId: int(data.alterId || 0),
		network: type(data.network) == 'string' ? data.network : 'tcp',
		tls: data.tls == true || data.tls == 1 || data.tls == 'tls',
		sni: type(data.sni) == 'string' ? data.sni : (type(data.server_name) == 'string' ? data.server_name : ''),
		alpn: type(data.alpn) == 'array' ? data.alpn : [],
		skip_cert_verify: data.skip_cert_verify == true || data['skip-cert-verify'] == true || data.insecure == true,
		flow: type(data.flow) == 'string' ? data.flow : '',
		reality: type(data.reality) == 'object' && data.reality != null ? data.reality : null,
		ws_opts: type(data.ws_opts) == 'object' && data.ws_opts != null ? data.ws_opts : (type(data['ws-opts']) == 'object' ? data['ws-opts'] : null),
		grpc_opts: type(data.grpc_opts) == 'object' && data.grpc_opts != null ? data.grpc_opts : (type(data['grpc-opts']) == 'object' ? data['grpc-opts'] : null),
		http_opts: type(data.http_opts) == 'object' && data.http_opts != null ? data.http_opts : (type(data['http-opts']) == 'object' ? data['http-opts'] : null),
		up_mbps: int(data.up_mbps || data.up || 0),
		down_mbps: int(data.down_mbps || data.down || 0),
		congestion_control: type(data.congestion_control) == 'string' ? data.congestion_control : '',
		obfs: type(data.obfs) == 'string' ? data.obfs : '',
		obfs_password: type(data.obfs_password) == 'string' ? data.obfs_password : '',
		udp: data.udp == true || data.udp == 1,
		packet_encoding: type(data.packet_encoding) == 'string' ? data.packet_encoding : '',
		_raw_outbound: type(data._raw_outbound) == 'object' && data._raw_outbound != null ? data._raw_outbound : null
	};
}

/**
 * Validates basic required fields of an IR node before processing.
 */
function validate_ir_node(node) {
	if (type(node) != 'object' || node == null)
		return { ok: false, error: 'Node must be an object' };
	if (type(node.name) != 'string' || node.name == '')
		return { ok: false, error: 'Node name is empty' };
	if (type(node.type) != 'string' || node.type == '')
		return { ok: false, error: 'Node type is empty' };
	if (!is_protocol_supported(node.type))
		return { ok: false, error: 'Protocol ' + node.type + ' is not supported' };
	if (type(node.server) != 'string' || node.server == '')
		return { ok: false, error: 'Node server host is empty' };
	if (type(node.port) != 'int' || node.port <= 0 || node.port > 65535)
		return { ok: false, error: 'Node port out of range: ' + node.port };
	return { ok: true };
}

export {
	SUPPORTED_PROTOCOLS,
	is_protocol_supported,
	protocol_support_status,
	create_ir_node,
	validate_ir_node
};
