'use strict';
import { path_segment_escape } from 'omnia.control';

assert(path_segment_escape('abc-_.~') == 'abc-_.~', 'unreserved characters');
assert(path_segment_escape('a/b?#% +') == 'a%2Fb%3F%23%25%20%2B', 'reserved characters');
assert(path_segment_escape('香港 🇭🇰') == '%E9%A6%99%E6%B8%AF%20%F0%9F%87%AD%F0%9F%87%B0', 'UTF-8 bytes');
assert(path_segment_escape('..') == '%2E%2E', 'dot segment');
print('control encoding OK\n');
