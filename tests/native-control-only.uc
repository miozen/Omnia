'use strict';
import { dispatch } from 'shinra.native_control';

let list = dispatch('list', {}).selectors;
assert(length(list) == 1 && list[0].name == 'test group', 'native-only group list');
let mode = dispatch('mode_get', {});
assert(lc(mode.mode) == 'rule' && length(mode.modes) == 1, 'native-only rule mode');
dispatch('select', { selector: 'test group', target: 'direct one' });
assert(dispatch('list', {}).selectors[0].now == 'direct one', 'native-only selection');
print('native-only control OK\n');
