'use strict';
import { request } from 'shinra.core.grpc_transport';
import { decode_mode, decode_groups, field_string } from 'shinra.core.grpc_proto';

let url = 'http://127.0.0.1:20123';
let mode = decode_mode(request(url, '', 'GetClashModeStatus', '', false));
assert(mode.mode == 'rule', 'mode request');
let groups = decode_groups(request(url, '', 'SubscribeGroups', '', true));
assert(length(groups) == 1 && groups[0].name == 'test group', 'group subscription');
request(url, '', 'SelectOutbound', field_string(1, 'test group') + field_string(2, 'direct two'), false);
groups = decode_groups(request(url, '', 'SubscribeGroups', '', true));
assert(groups[0].now == 'direct two', 'selection verified');
let failed = false;
try { request(url, '', 'SelectOutbound', field_string(1, 'missing') + field_string(2, 'missing'), false); }
catch (e) { failed = true; }
assert(failed, 'gRPC errors rejected');
print('grpc transport OK\n');
