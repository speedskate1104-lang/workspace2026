"use strict";

const ids = [
  "bpm",
  "signature",
  "bars",
  "offset",
  "target"
];

const fields = Object.fromEntries(
  ids.map(id => [id, document.getElementById(id)])
);

const durationOutput = document.getElementById("duration");
const secondsOutput = document.getElementById("seconds");
const endTimeOutput = document.getElementById("endTime");
const requiredBarsOutput = document.getElementById("requiredBars");
const messageOutput = document.getElementById("message");
const copyButton = document.getElementById("copy");

const STORAGE_KEY = "beatgrid-settings-v1";

let currentResult = null;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }

  const centiseconds = Math.round(seconds * 100);
  const minutes = Math.floor(centiseconds / 6000);
  const remainingSeconds = Math.floor((centiseconds % 6000) / 100);
  const hundredths = centiseconds % 100;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainingSeconds).padStart(2, "0") +
    "." +
    String(hundredths).padStart(2, "0")
  );
}

function getBeatsPerBar(signature) {
  const [numerator, denominator] = signature
    .split("/")
    .map(Number);

  if (!numerator || !denominator) {
    return NaN;
  }

  // BPM is interpreted as quarter-note beats per minute.
  return numerator * (4 / denominator);
}

function getValues() {
  return {
    bpm: Number(fields.bpm.value),
    signature: fields.signature.value,
    bars: Number(fields.bars.value),
    offset: Number(fields.offset.value),
    target: Number(fields.target.value)
  };
}

function saveSettings() {
  try {
    const settings = Object.fromEntries(
      ids.map(id => [id, fields[id].value])
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );
  } catch {
    // The calculator still works when storage is unavailable.
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "null"
    );

    if (!saved || typeof saved !== "object") {
      return;
    }

    for (const id of ids) {
      if (
        Object.prototype.hasOwnProperty.call(saved, id) &&
        typeof saved[id] === "string"
      ) {
        if (
          fields[id].tagName === "SELECT" &&
          !Array.from(fields[id].options)
            .some(option => option.value === saved[id])
        ) {
          continue;
        }

        fields[id].value = saved[id];
      }
    }
  } catch {
    // Ignore invalid or inaccessible saved settings.
  }
}

function calculate() {
  const values = getValues();
  const beatsPerBar = getBeatsPerBar(values.signature);

  const valid =
    fields.bpm.value.trim() !== "" &&
    fields.bars.value.trim() !== "" &&
    fields.offset.value.trim() !== "" &&
    fields.target.value.trim() !== "" &&
    Number.isFinite(values.bpm) &&
    Number.isFinite(values.bars) &&
    Number.isFinite(values.offset) &&
    Number.isFinite(values.target) &&
    values.bpm >= 1 &&
    values.bpm <= 999 &&
    values.bars >= 0 &&
    values.bars <= 100000 &&
    values.offset >= 0 &&
    values.offset <= 86400 &&
    values.target >= 0 &&
    values.target <= 86400 &&
    Number.isFinite(beatsPerBar) &&
    beatsPerBar > 0;

  if (!valid) {
    durationOutput.textContent = "—";
    secondsOutput.textContent = "入力値を確認してください";
    endTimeOutput.textContent = "—";
    requiredBarsOutput.textContent = "—";
    currentResult = null;
    return;
  }

  const secondsPerBar = beatsPerBar * 60 / values.bpm;
  const duration = values.bars * secondsPerBar;
  const endTime = duration + values.offset;
  const requiredBars = values.target / secondsPerBar;

  durationOutput.textContent = formatTime(duration);
  secondsOutput.textContent = duration.toFixed(2) + " 秒";
  endTimeOutput.textContent = formatTime(endTime);
  requiredBarsOutput.textContent = requiredBars.toFixed(2);

  currentResult = {
    ...values,
    duration,
    endTime,
    requiredBars
  };
}

async function copyResult() {
  if (!currentResult) {
    messageOutput.textContent = "入力値を確認してください。";
    return;
  }

  const result = currentResult;

  const text = [
    "BEATGRID",
    `BPM: ${result.bpm}`,
    `拍子: ${result.signature}`,
    `小節数: ${result.bars}`,
    `演奏時間: ${formatTime(result.duration)}`,
    `開始オフセット: ${result.offset} 秒`,
    `終了位置: ${formatTime(result.endTime)}`,
    `目標演奏時間: ${result.target} 秒`,
    `必要小節数: ${result.requiredBars.toFixed(2)}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    messageOutput.textContent = "計算結果をコピーしました。";
  } catch {
    messageOutput.textContent =
      "コピーできませんでした。HTTPSで開いて再試行してください。";
  }
}

loadSettings();
calculate();

for (const id of ids) {
  const eventName =
    fields[id].tagName === "SELECT" ? "change" : "input";

  fields[id].addEventListener(eventName, () => {
    messageOutput.textContent = "";
    calculate();
    saveSettings();
  });
}

copyButton.addEventListener("click", copyResult);
