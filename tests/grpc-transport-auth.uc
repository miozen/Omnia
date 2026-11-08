'use strict';
import { request } from 'shinra.core.grpc_transport';
import { decode_mode } from 'shinra.core.grpc_proto';

let url = 'http://127.0.0.1:20123';
assert(decode_mode(request(url, 'synthetic-test-secret', 'GetClashModeStatus', '', false)).mode == 'rule', 'configured secret accepted');
let rejected = false;
try { request(url, 'incorrect-test-secret', 'GetClashModeStatus', '', false); }
catch (e) { rejected = true; }
assert(rejected, 'incorrect secret rejected');
print('grpc authentication OK\n');
