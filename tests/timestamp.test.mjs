import test from 'node:test';import assert from 'node:assert/strict';
import {parseTimestamp} from '../public/timestamp.js';
test('Taiwan timestamps preserve AM/PM and explicit timezone ordering',()=>{
 assert.equal(parseTimestamp('2026/11/2 12:30 AM'),Date.parse('2026-11-01T16:30:00Z'));
 assert.equal(parseTimestamp('2026/11/2 12:30 PM'),Date.parse('2026-11-02T04:30:00Z'));
 assert.equal(parseTimestamp('2026/11/2 上午12:30'),parseTimestamp('2026/11/2 12:30 AM'));
 assert.equal(parseTimestamp('2026-11-02T00:30:00+08:00'),parseTimestamp('2026/11/2 12:30 AM'));
 assert.equal(parseTimestamp('2026/02/30'),null);assert.equal(parseTimestamp('bad'),null);
});
