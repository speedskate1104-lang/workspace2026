'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const midi = require('../public/tools/midi/midi.js');
const u32 = n => [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255];
const eot = [0, 255, 47, 0];
const meta = (type, data, delta = 0) => [delta, 255, type, data.length, ...data];
function smf(tracks, format = 1, division = 480) {
  return Uint8Array.from([77,84,104,100,0,0,0,6,0,format,tracks.length >> 8,tracks.length & 255,division >> 8,division & 255,
    ...tracks.flatMap(t => [77,84,114,107,...u32(t.length),...t])]);
}
test('Format 0: expands running status, retains notes/CC/program/bend/SysEx and timing', () => {
  const track = [0,0x90,60,100, 120,64,90, 0,0xb0,64,127, 0,0xc0,7, 0,0xe0,0,64,
    0,0xf0,3,1,2,0xf7, 0,0xf7,2,3,4, 120,0x80,60,0, 0,64,0,...eot];
  const r = midi.convert(smf([track], 0));
  assert.equal(r.summary.notes, 2); assert.equal(r.summary.sysex, 2);
  assert.equal(r.output.format, 1); assert.equal(r.output.tracks.length, 2);
  assert.equal(r.output.tracks[1].endTick, 240);
  assert.equal(r.output.tracks[1].events[1].status, 0x90);
});
test('Format 1: gathers maps with stable ordering, preserves marker raw bytes and original track metadata', () => {
  const t1 = [...meta(3, [80,105,97,110,111]), ...meta(0x51,[7,161,32]), ...meta(0x58,[4,2,24,8]),
    ...meta(0x20,[0]), 0,0x90,60,100,120,0x80,60,0,...eot];
  const t2 = [...meta(0x51,[6,26,128],60), ...meta(6,[0xe6,0x97,0xa5]), ...meta(7,[65]),
    ...meta(0x59,[0,0]), ...meta(0x54,[0,0,0,0,0]), ...meta(0x7f,[1,2,3]),120,255,47,0];
  const r = midi.convert(smf([t1,t2]));
  assert.equal(r.output.tracks.length,3); assert.equal(r.summary.tempo,2); assert.equal(r.summary.markers,2);
  assert.deepEqual(r.output.tracks[0].events.filter(e=>e.type===6)[0].data,Uint8Array.from([0xe6,0x97,0xa5]));
  assert.equal(r.output.tracks[1].events[0].type,3);
  assert.equal(r.output.tracks[2].events[0].type,0x7f);
  assert.equal(r.output.tracks[0].endTick,180);
});
test('missing EOT repaired; missing notes and conflicting tempos reported without deletion', () => {
  const r = midi.convert(smf([[...meta(0x51,[7,161,32]),...meta(0x51,[6,26,128]),0,0x90,60,100]],0));
  assert.ok(r.summary.warnings.some(w=>w.includes('End of Track')));
  assert.ok(r.summary.warnings.some(w=>w.includes('Note Off')));
  assert.ok(r.summary.warnings.some(w=>w.includes('同時刻')));
  assert.equal(r.summary.tempo,2);
});
test('SMPTE and multi-byte delta retain exact division and ticks', () => {
  const r = midi.convert(smf([[0x81,0x80,0x00,0x90,60,100,0,0x80,60,0,...eot]],0,0xe728));
  assert.equal(r.output.division,0xe728); assert.equal(r.output.tracks[1].events[0].tick,16384);
});
test('reject unsupported formats, corrupt chunks/events and invalid lengths', () => {
  const invalid = [new Uint8Array(),smf([eot],2),smf([eot,eot],0),smf([eot],1,0),smf([[0,60,100,...eot]],0),
    smf([[0,0x90,60,0xff,...eot]],0),smf([[0,0xff,0x51,2,1,2,...eot]],0),
    smf([[0,0xff,0x51,3,0,0,0,...eot]],0),smf([[0,0xf1,...eot]],0),
    smf([[...eot,0]],0),smf([[0x81,0x81,0x81,0x81,0,0x90,60,100]],0),
    smf([[0,0xf0,127,1]],0),smf([[0,0x90,60,1,0,0xff,1,0,0,60,0,...eot]],0)];
  for (const bytes of invalid) assert.throws(()=>midi.convert(bytes));
  const truncated=smf([eot],0).slice(0,-1); assert.throws(()=>midi.convert(truncated));
  const mismatch=smf([eot]); mismatch[11]=2; assert.throws(()=>midi.convert(mismatch));
});
test('verification detects modified notes and timing', () => {
  const source=midi.parse(smf([[0,0x90,60,100,120,0x80,60,0,...eot]],0));
  const output=midi.parse(midi.encode(midi.normalize(source)));
  output.tracks[1].events[0].data[0]=61;
  assert.throws(()=>midi.verify(source,output));
});
test('large track does not exceed JavaScript argument limits', () => {
  const events=Array.from({length:50000},(_,i)=>({tick:i,status:0xb0,data:Uint8Array.of(1,i%128)}));
  const bytes=midi.encode({division:480,tracks:[{events,endTick:50000}]});
  assert.equal(midi.parse(bytes).tracks[0].events.length,50001);
});
