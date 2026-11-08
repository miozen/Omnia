'use strict';
import { field_string, decode_groups, decode_mode, grpc_frame, grpc_text_decode, grpc_first_message } from 'omnia.core.grpc_proto';

let item = field_string(1, '🇭🇰 香港 / 01') + field_string(2, 'vless') + chr(0x20, 42);
let group = field_string(1, '节点 选择') + field_string(2, 'selector') + chr(0x18, 1) + field_string(4, '🇭🇰 香港 / 01') + field_string(6, item);
let groups = decode_groups(grpc_first_message(grpc_frame(field_string(1, group))));
assert(length(groups) == 1 && groups[0].controllable, 'group decode');
assert(groups[0].options[0].name == '🇭🇰 香港 / 01' && groups[0].options[0].delay == 42, 'node decode');
let modes = decode_mode(field_string(1, 'rule') + field_string(1, 'direct') + field_string(2, 'rule'));
assert(modes.mode == 'rule' && length(modes.modes) == 2, 'mode decode');
let actual = grpc_text_decode('AAAAAAwKBHJ1bGUSBHJ1bGU=gAAAABBncnBjLXN0YXR1czogMA0K');
assert(decode_mode(grpc_first_message(actual)).mode == 'rule', 'sing-box 1.14.4 concatenated gRPC-Web text chunks');
let stream = grpc_text_decode('AAAAAFIKUAoKdGVzdCBncm91cBIIc2VsZWN0b3IYASIKZGlyZWN0IG9uZTIUCgpkaXJlY3Qgb25lEgZkaXJlY3QyFAoKZGlyZWN0IHR3bxIGZGlyZWN0');
let actual_groups = decode_groups(grpc_first_message(stream));
assert(actual_groups[0].name == 'test group' && actual_groups[0].now == 'direct one' && length(actual_groups[0].options) == 2, 'sing-box 1.14.4 group stream');
let rejected = false;
try { grpc_first_message(chr(0, 0, 0, 0, 5, 1)); } catch (e) { rejected = true; }
assert(rejected, 'truncated frame rejected');
print('grpc protobuf OK\n');
