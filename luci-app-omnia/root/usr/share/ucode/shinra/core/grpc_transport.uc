/** gRPC-Web client. Run in an isolated ucode process, never inside rpcd's event loop. */
'use strict';
import * as uclient from 'uclient';
import * as uloop from 'uloop';
import { grpc_frame } from 'shinra.core.grpc_proto';

const MAX_RESPONSE = 4194304;

function frame_length(data, pos) {
	if (length(data) - pos < 5) return null;
	let size = (ord(data, pos + 1) << 24) | (ord(data, pos + 2) << 16) |
		(ord(data, pos + 3) << 8) | ord(data, pos + 4);
	if (size < 0 || size > MAX_RESPONSE) die('invalid gRPC frame length');
	return size;
}

function response_decode(data, stream) {
	let pos = 0, message = null, trailer = null;
	while (pos < length(data)) {
		let size = frame_length(data, pos);
		if (size == null || size > length(data) - pos - 5) die('truncated gRPC frame');
		let flags = ord(data, pos), body = substr(data, pos + 5, size);
		if (flags == 0 && message == null) message = body;
		else if (flags == 0x80) trailer = body;
		else die('unsupported gRPC frame');
		pos += size + 5;
		if (stream && message != null) return message;
	}
	if (stream) die('missing gRPC message');
	if (trailer == null || !match(trailer, /(^|\r\n)grpc-status: ?0(\r\n|$)/i))
		die('gRPC request failed or missing status');
	return message || '';
}

function request(url, secret, method, payload, stream) {
	let body = '', http_status = 0, failure = '', finished = false;
	uloop.init();
	let client = uclient.new(url + '/daemon.StartedService/' + method, null, {
		header_done: function() { http_status = this.status().status; },
		data_read: function() {
			let data;
			while ((data = this.read()) != null) body += data;
			if (length(body) > MAX_RESPONSE) { failure = 'gRPC response too large'; this.disconnect(); uloop.end(); return; }
			if (stream && length(body) >= 5) {
				let size = frame_length(body, 0);
				if (size != null && length(body) >= size + 5) { finished = true; this.disconnect(); uloop.end(); }
			}
		},
		data_eof: function() { finished = true; this.disconnect(); uloop.end(); },
		error: function(cb, code) { failure = 'HTTP client error ' + code; this.disconnect(); uloop.end(); }
	});
	if (!client) die('cannot create HTTP client');
	let headers = { 'content-type': 'application/grpc-web+proto', 'x-grpc-web': '1' };
	if (secret != '') headers.authorization = 'Bearer ' + secret;
	let timer = uloop.timer(5000, function() { failure = 'gRPC request timed out'; client.disconnect(); uloop.end(); });
	if (!client.connect() || !client.request('POST', { headers: headers, post_data: grpc_frame(payload) })) {
		timer.cancel(); client.free(); uloop.done(); die('cannot start gRPC request');
	}
	uloop.run();
	timer.cancel();
	client.free();
	uloop.done();
	if (failure != '') die(failure);
	if (!finished || http_status != 200) die('gRPC HTTP status ' + http_status);
	return response_decode(body, stream);
}

export { request, response_decode };
