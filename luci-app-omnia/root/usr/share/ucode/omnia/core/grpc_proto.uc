/** Binary helpers for the subset of sing-box daemon.StartedService used by Omnia. */
'use strict';

function encode_varint(value) {
	value = int(value);
	if (value < 0)
		die('negative protobuf varint');
	let result = '';
	while (true) {
		let byte = value & 0x7f;
		value = value >> 7;
		result += chr(byte | (value ? 0x80 : 0));
		if (!value) break;
	}
	return result;
}

function field_string(field, value) {
	value = '' + value;
	return encode_varint((field << 3) | 2) + encode_varint(length(value)) + value;
}

function read_varint(buffer, state) {
	let result = 0;
	for (let shift = 0; shift < 63; shift += 7) {
		let byte = ord(buffer, state.pos++);
		if (byte == null) die('truncated protobuf varint');
		result |= (byte & 0x7f) << shift;
		if (!(byte & 0x80)) return result;
	}
	die('invalid protobuf varint');
}

function decode_fields(buffer) {
	let state = { pos: 0 }, result = [];
	while (state.pos < length(buffer)) {
		let key = read_varint(buffer, state), number = key >> 3, wire = key & 7, value;
		if (!number) die('invalid protobuf field');
		if (wire == 0) value = read_varint(buffer, state);
		else if (wire == 2) {
			let size = read_varint(buffer, state);
			if (size < 0 || size > length(buffer) - state.pos) die('truncated protobuf field');
			value = substr(buffer, state.pos, size);
			state.pos += size;
		} else if (wire == 1 || wire == 5) {
			let size = wire == 1 ? 8 : 4;
			if (size > length(buffer) - state.pos) die('truncated protobuf field');
			state.pos += size;
			continue;
		} else die('unsupported protobuf wire type');
		push(result, { number: number, wire: wire, value: value });
	}
	return result;
}

function decode_item(buffer) {
	let item = { name: '', type: '', delay: null, alive: null };
	for (let field in decode_fields(buffer)) {
		if (field.number == 1 && field.wire == 2) item.name = field.value;
		else if (field.number == 2 && field.wire == 2) item.type = field.value;
		else if (field.number == 4 && field.wire == 0 && field.value > 0) item.delay = field.value;
	}
	return item;
}

function decode_group(buffer) {
	let group = { name: '', type: '', controllable: false, now: '', all: [], options: [] };
	for (let field in decode_fields(buffer)) {
		if (field.number == 1 && field.wire == 2) group.name = field.value;
		else if (field.number == 2 && field.wire == 2) group.type = field.value;
		else if (field.number == 3 && field.wire == 0) group.controllable = field.value != 0;
		else if (field.number == 4 && field.wire == 2) group.now = field.value;
		else if (field.number == 6 && field.wire == 2) {
			let item = decode_item(field.value);
			push(group.all, item.name);
			push(group.options, item);
		}
	}
	return group;
}

function decode_groups(buffer) {
	let groups = [];
	for (let field in decode_fields(buffer))
		if (field.number == 1 && field.wire == 2) push(groups, decode_group(field.value));
	return groups;
}

function decode_mode(buffer) {
	let result = { modes: [], mode: '' };
	for (let field in decode_fields(buffer)) {
		if (field.number == 1 && field.wire == 2) push(result.modes, field.value);
		else if (field.number == 2 && field.wire == 2) result.mode = field.value;
	}
	return result;
}

function grpc_frame(payload) {
	let size = length(payload);
	return chr(0, (size >> 24) & 255, (size >> 16) & 255, (size >> 8) & 255, size & 255) + payload;
}

/* gRPC-Web text can concatenate independently padded Base64 chunks. */
function grpc_text_decode(text) {
	text = replace(replace(replace(replace('' + text, '\r', ''), '\n', ''), ' ', ''), '\t', '');
	if (length(text) % 4 != 0) die('truncated gRPC-Web base64');
	let result = '';
	for (let i = 0; i < length(text); i += 4) {
		let decoded = b64dec(substr(text, i, 4));
		if (decoded == null) die('invalid gRPC-Web base64');
		result += decoded;
	}
	return result;
}

function grpc_first_message(buffer) {
	if (length(buffer) < 5) die('truncated gRPC frame');
	let flags = ord(buffer, 0);
	let size = (ord(buffer, 1) << 24) | (ord(buffer, 2) << 16) | (ord(buffer, 3) << 8) | ord(buffer, 4);
	if (flags != 0 || size < 0 || size > length(buffer) - 5) die('invalid gRPC message frame');
	return substr(buffer, 5, size);
}

export { encode_varint, field_string, decode_fields, decode_groups, decode_mode, grpc_frame, grpc_text_decode, grpc_first_message };
