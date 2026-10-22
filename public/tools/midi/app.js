'use strict';
(() => {
  const el = id => document.getElementById(id);
  const fileInput = el('file'), dropzone = el('dropzone'), download = el('download');
  let result = null, filename = '', request = 0;
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
  function status(message, error = false) { el('status').textContent = message; el('status').classList.toggle('error', error); }
  function render(data) {
    const { source, output, summary: s } = data;
    el('filename').textContent = filename;
    el('summary').replaceChildren();
    const division = source.division & 0x8000 ? `SMPTE ${256 - (source.division >> 8)} / ${source.division & 255} ticks/frame` : `${source.division} PPQ`;
    for (const [key, value] of [['形式', `Format ${source.format} → 1`], ['トラック', `${s.tracks} → ${output.tracks.length}（先頭に管理トラック追加）`], ['時間分解能（変更なし）', division], ['ノート', s.notes], ['テンポ / 拍子', `${s.tempo} / ${s.meter}`], ['マーカー / キュー', s.markers], ['SysEx', s.sysex], ['その他メタイベント', s.other]]) {
      const item = document.createElement('div'); item.append(text('dt', key), text('dd', String(value))); el('summary').append(item);
    }
    el('warnings').replaceChildren();
    for (const warning of [...new Set(s.warnings)].slice(0, 100)) el('warnings').append(text('li', warning));
    if (s.warnings.length > 100) el('warnings').append(text('li', '確認事項が多いため先頭100件のみ表示しています。'));
    if (!s.warnings.length) el('warnings').append(text('li', '構造上の問題は検出されませんでした。Pro Toolsでの最終確認を行ってください。'));
    el('events').replaceChildren();
    const decoder = new TextDecoder('utf-8');
    let count = 0;
    source.tracks.forEach((track, i) => {
      for (const e of track.events) {
        if (e.status !== 0xff || ![0x51, 0x58, 0x06, 0x07].includes(e.type) || count >= 200) continue;
        count++;
        let type, value;
        if (e.type === 0x51) { type = 'テンポ'; value = `${(60000000 / (e.data[0] * 65536 + e.data[1] * 256 + e.data[2])).toFixed(3)} BPM`; }
        else if (e.type === 0x58) { type = '拍子'; value = `${e.data[0]}/${2 ** e.data[1]}`; }
        else { type = e.type === 0x06 ? 'マーカー' : 'キュー'; value = decoder.decode(e.data.subarray(0, 2048)) + (e.data.length > 2048 ? '…' : ''); }
        const row = document.createElement('tr');
        for (const v of [i + 1, e.tick, type, value]) row.append(text('td', String(v)));
        el('events').append(row);
      }
    });
    el('results').hidden = false;
  }
  async function load(file) {
    const id = ++request;
    result = null; download.disabled = true; el('results').hidden = true;
    if (!file) { status('ファイルを待っています。'); return; }
    if (file.size > GoatMidi.MAX_BYTES) { status('ファイル上限は16 MiBです。', true); return; }
    status('読み込み・変換・保持検証中…');
    try {
      const buffer = await file.arrayBuffer();
      if (id !== request) return;
      result = GoatMidi.convert(buffer);
      filename = file.name;
      render(result); download.disabled = false;
      status('変換・保持検証が完了しました。ダウンロードできます。');
    } catch (error) {
      if (id !== request) return;
      result = null; download.disabled = true; el('results').hidden = true;
      status(`変換できませんでした: ${error.message}`, true);
    }
  }
  fileInput.addEventListener('change', () => load(fileInput.files[0]));
  for (const name of ['dragenter', 'dragover']) dropzone.addEventListener(name, e => { e.preventDefault(); dropzone.classList.add('drag'); });
  for (const name of ['dragleave', 'drop']) dropzone.addEventListener(name, e => { e.preventDefault(); dropzone.classList.remove('drag'); });
  dropzone.addEventListener('drop', e => {
    if (e.dataTransfer.files.length !== 1) { ++request; result = null; download.disabled = true; el('results').hidden = true; status('MIDIファイルを1つずつ選んでください。', true); return; }
    fileInput.value = ''; load(e.dataTransfer.files[0]);
  });
  download.addEventListener('click', () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.bytes], { type: 'audio/midi' }));
    const link = document.createElement('a');
    link.href = url; link.download = filename.replace(/\.(mid|midi)$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_') + '_protools.mid';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
})();
