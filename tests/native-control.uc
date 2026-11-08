'use strict';
import { dispatch } from 'shinra.native_control';

let list = dispatch('list', {}).selectors;
assert(length(list) == 1 && list[0].name == 'test group', 'native group list');
let mode = dispatch('mode_get', {});
assert(mode.mode == 'rule', 'native mode');
dispatch('select', { selector: 'test group', target: 'direct one' });
assert(dispatch('list', {}).selectors[0].now == 'direct one', 'native selection');
let rejected = false;
try { dispatch('select', { selector: 'test group', target: 'not a member' }); }
catch (e) { rejected = true; }
assert(rejected, 'invalid target rejected');
let test = dispatch('test', { node: 'direct one' });
assert(test.pending == true, 'native URL test starts asynchronously');
rejected = false;
try { dispatch('test', { node: 'missing' }); }
catch (e) { rejected = true; }
assert(rejected, 'invalid test target rejected');
print('native control OK\n');
