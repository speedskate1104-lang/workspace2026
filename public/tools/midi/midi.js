/* SMF parser/writer. No network, timing rescale, text transcoding or event filtering. */
(function (root) {
  'use strict';
  const MAX_BYTES = 16 * 1024 * 1024;
  const MAX_EVENTS = 500000;
  const GLOBAL = new Set([0x51, 0x58, 0x59, 0x54, 0x06, 0x07]);
  const fail = message => { throw new Error(message); };
  const ascii = bytes => String.fromCharCode(...bytes);
  function parse(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length > MAX_BYTES) fail('ファイル上限は16 MiBです。');
    let pos = 0, count = 0;
    const warnings = [];
    function need(n, end = bytes.length) {
      if (n < 0 || pos + n > end) fail(`データが途中で切れています（byte ${pos}）。`);
    }
    function uint(n) { need(n); let v = 0; while (n--) v = v * 256 + bytes[pos++]; return v; }
    function tag() { need(4); const s = ascii(bytes.subarray(pos, pos + 4)); pos += 4; return s; }
    function vlq(end) {
      let value = 0;
      for (let i = 0; i < 4; i++) {
        need(1, end); const b = bytes[pos++]; value = value * 128 + (b & 127);
        if (!(b & 128)) return value;
      }
      fail('4 byteを超える可変長数値です。');
    }
    if (tag() !== 'MThd') fail('SMF MIDI（MThd）ではありません。.songや音声ファイルは変換できません。');
    const headerLength = uint(4);
    if (headerLength !== 6) fail('標準の6 byte SMFヘッダーのみ対応しています。');
    const format = uint(2), trackCount = uint(2), division = uint(2);
    if (format === 2) fail('Format 2は独立したシーケンスのため対応していません。Studio OneからFormat 0/1で再書き出ししてください。');
    if (format > 1 || !trackCount || (format === 0 && trackCount !== 1)) fail('MIDI形式またはトラック数が不正です。');
    if (!division) fail('時間分解能が0です。');
    if (division & 0x8000) {
      const fps = 256 - (division >> 8);
      if (![24, 25, 29, 30].includes(fps) || !(division & 255)) fail('SMPTE時間分解能が不正です。');
      warnings.push('SMPTE時間分解能をそのまま保持しました。Pro Toolsで位置を確認してください。');
    }
    const tracks = [];
    while (pos < bytes.length) {
      const id = tag(), length = uint(4); need(length);
      const end = pos + length;
      if (id !== 'MTrk') fail(`未対応チャンク「${id}」があります。情報を失わないため変換を停止しました。`);
      const events = [];
      let tick = 0, running = 0, ended = false;
      while (pos < end) {
        tick += vlq(end);
        if (!Number.isSafeInteger(tick)) fail('イベント位置が大きすぎます。');
        need(1, end);
        let status = bytes[pos];
        if (status >= 128) pos++;
        else if (running) status = running;
        else fail(`Running Statusの参照先がありません（byte ${pos}）。`);
        let event;
        if (status >= 0x80 && status <= 0xef) {
          running = status;
          const n = (status & 0xe0) === 0xc0 ? 1 : 2;
          need(n, end); const data = bytes.slice(pos, pos + n); pos += n;
          if (data.some(v => v >= 128)) fail('MIDIチャンネルデータが7 bitの範囲外です。');
          event = { tick, status, data };
        } else {
          running = 0;
          if (status === 0xff) {
            need(1, end); const type = bytes[pos++];
            if (type > 127) fail('メタイベント種別が不正です。');
            const n = vlq(end); need(n, end);
            const data = bytes.slice(pos, pos + n); pos += n;
            const lengths = { 0: 2, 0x20: 1, 0x21: 1, 0x2f: 0, 0x51: 3, 0x54: 5, 0x58: 4, 0x59: 2 };
            if (type in lengths && n !== lengths[type]) fail(`メタイベント0x${type.toString(16)}の長さが不正です。`);
            if (type === 0x51 && data.every(v => v === 0)) fail('テンポ値が0です。');
            if (type === 0x58 && (!data[0] || data[1] > 7)) fail('拍子の値が不正です。');
            event = { tick, status, type, data };
            if (type === 0x2f) {
              ended = true;
              if (pos !== end) fail('End of Trackの後にデータがあります。');
            }
          } else if (status === 0xf0 || status === 0xf7) {
            const n = vlq(end); need(n, end);
            event = { tick, status, data: bytes.slice(pos, pos + n) }; pos += n;
          } else fail(`SMFでは扱えないステータス0x${status.toString(16)}です。`);
        }
        if (++count > MAX_EVENTS) fail('イベント上限（500,000件）を超えています。');
        events.push(event);
      }
      if (!ended) warnings.push(`トラック${tracks.length + 1}: End of Trackを補完します。`);
      tracks.push({ events, endTick: tick });
    }
    if (tracks.length !== trackCount) fail('ヘッダーと実際のトラック数が一致しません。');
    return { format, division, tracks, warnings };
  }
  function vlq(value) {
    if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) fail('書き出すデルタタイムがSMFの上限を超えています。');
    const out = [value & 127];
    while ((value = Math.floor(value / 128))) out.unshift((value & 127) | 128);
    return out;
  }
  const uint = (value, n) => Array.from({ length: n }, (_, i) => Math.floor(value / 256 ** (n - i - 1)) & 255);
  function encode(midi) {
    if (midi.tracks.length > 65535) fail('出力トラック数が上限を超えます。');
    const chunks = [Uint8Array.from([77, 84, 104, 100, 0, 0, 0, 6, 0, 1, ...uint(midi.tracks.length, 2), ...uint(midi.division, 2)])];
    for (const track of midi.tracks) {
      const parts = []; let last = 0, size = 0;
      function push(a) { const b = Uint8Array.from(a); parts.push(b); size += b.length; }
      for (const e of track.events) {
        if (e.status === 0xff && e.type === 0x2f) continue;
        push(vlq(e.tick - last)); last = e.tick;
        push(e.status === 0xff ? [0xff, e.type, ...vlq(e.data.length)] :
          e.status >= 0xf0 ? [e.status, ...vlq(e.data.length)] : [e.status]);
        // Avoid argument spreading large SysEx/text payloads.
        parts.push(e.data); size += e.data.length;
      }
      push([...vlq(track.endTick - last), 0xff, 0x2f, 0]);
      chunks.push(Uint8Array.from([77, 84, 114, 107, ...uint(size, 4)]));
      for (const part of parts) chunks.push(part);
    }
    const size = chunks.reduce((n, c) => n + c.length, 0);
    if (size > MAX_BYTES) fail('変換結果が16 MiBを超えます。ファイルを分割してください。');
    const result = new Uint8Array(size); let p = 0;
    for (const chunk of chunks) { result.set(chunk, p); p += chunk.length; }
    return result;
  }
  const isGlobal = e => e.status === 0xff && GLOBAL.has(e.type);
  const isEnd = e => e.status === 0xff && e.type === 0x2f;
  function normalize(source) {
    const global = [], tracks = [];
    let endTick = 0;
    for (const track of source.tracks) {
      const events = [];
      endTick = Math.max(endTick, track.endTick);
      for (const e of track.events) {
        if (isGlobal(e)) global.push(e);
        else if (!isEnd(e)) events.push(e);
      }
      // Keep even empty original tracks, names and channel/port metadata intact.
      tracks.push({ events, endTick: track.endTick });
    }
    global.sort((a, b) => a.tick - b.tick); // Stable: preserve source order at identical ticks.
    return { format: 1, division: source.division, tracks: [{ events: global, endTick }, ...tracks] };
  }
  function fingerprint(e) {
    return `${e.tick}:${e.status}:${e.type ?? ''}:${Array.from(e.data).join(',')}`;
  }
  function verify(source, output) {
    if (output.format !== 1 || source.division !== output.division || output.tracks.length !== source.tracks.length + 1) fail('出力構造の再検証に失敗しました。');
    const equal = (a, b) => a.length === b.length && a.every((e, i) => fingerprint(e) === fingerprint(b[i]));
    const globals = source.tracks.flatMap(t => t.events.filter(isGlobal)).sort((a, b) => a.tick - b.tick);
    if (!equal(globals, output.tracks[0].events.filter(e => !isEnd(e)))) fail('テンポ・拍子・マーカー等の保持検証に失敗しました。');
    source.tracks.forEach((t, i) => {
      if (t.endTick !== output.tracks[i + 1].endTick || !equal(t.events.filter(e => !isGlobal(e) && !isEnd(e)), output.tracks[i + 1].events.filter(e => !isEnd(e)))) fail('トラックイベントの保持検証に失敗しました。');
    });
    return true;
  }
  function inspect(midi) {
    const result = { tracks: midi.tracks.length, notes: 0, tempo: 0, meter: 0, markers: 0, sysex: 0, other: 0, warnings: [...(midi.warnings || [])] };
    const seen = new Map();
    midi.tracks.forEach((track, index) => {
      const active = new Map();
      for (const e of track.events) {
        const kind = e.status & 0xf0;
        if (e.status < 0xf0 && (kind === 0x90 || kind === 0x80)) {
          const key = `${e.status & 15}:${e.data[0]}`;
          const n = active.get(key) || 0;
          if (kind === 0x90 && e.data[1]) { result.notes++; active.set(key, n + 1); }
          else if (n) active.set(key, n - 1);
          else if (!result.warnings.includes('対応するNote OnのないNote Offがあります。')) result.warnings.push('対応するNote OnのないNote Offがあります。');
        }
        if (e.status === 0xff) {
          if (e.type === 0x51) result.tempo++;
          else if (e.type === 0x58) result.meter++;
          else if (e.type === 0x06 || e.type === 0x07) result.markers++;
          else if (!isEnd(e)) result.other++;
          if ([0x51, 0x58, 0x59, 0x54].includes(e.type)) {
            const key = `${e.type}:${e.tick}`;
            if (seen.has(key) && seen.get(key) !== fingerprint(e)) result.warnings.push(`tick ${e.tick}: 同時刻に異なるテンポ・拍子・調号・SMPTE情報があります。原文を保持するため統合・削除していません。`);
            seen.set(key, fingerprint(e));
          }
        } else if (e.status >= 0xf0) result.sysex++;
      }
      if ([...active.values()].some(n => n > 0)) result.warnings.push(`トラック${index + 1}: Note Offのないノートがあります（自動修正なし）。`);
    });
    if (!result.tempo) result.warnings.push('テンポ情報なし。SMF既定値120 BPMとして解釈されます。テンポは追加していません。');
    if (!result.meter) result.warnings.push('拍子情報なし。SMF既定値4/4として解釈されます。拍子は追加していません。');
    return result;
  }
  function convert(input) {
    const source = parse(input), summary = inspect(source);
    const bytes = encode(normalize(source));
    const output = parse(bytes);
    verify(source, output);
    return { bytes, source, output, summary };
  }
  const api = { parse, normalize, encode, verify, inspect, convert, MAX_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GoatMidi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
