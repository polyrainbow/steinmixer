import { html, svg, render } from "../lit.js";
import {
  EQ_BANDS,
  EQ_GAIN_MAX_DB,
  EQ_GAIN_MIN_DB,
  DEFAULT_SAMPLE_RATE,
  PARAM_RANGES,
  computeEQResponse,
  formatHz,
  formatParam,
  freqToHz,
  gainToDb,
  handleToRaw,
  logFrequencies,
  normalizeParams,
  qToValue,
} from "../devices/channelStripMath.js";

/*
  <eq-curve>

  EQ magnitude response (20 Hz..20 kHz, log axis, +-18 dB) with three
  draggable band handles (LOW shelf, MID peak, HIGH shelf).

  Properties:
    params            object of raw channel strip values. Missing keys fall
                      back to device defaults. Assigning re-renders.
    sampleRate        sample rate used for the filter model (default 48000).
    includeTotalGain  add total gain to the drawn curve (default false, so the
                      handles sit on the curve).

  Attributes:
    disabled          no interaction (handles not focusable).

  Events:
    "eq-change"  CustomEvent, bubbles. detail: { param, value } where param is
                 one of "lowFreq", "lowGain", "midFreq", "midGain", "midQ",
                 "highFreq", "highGain" and value is the RAW device integer.
                 Only dispatched when the raw value actually changes. The
                 element applies the change to its local copy of params
                 immediately; assigning `.params` later overrides it
                 (except for the band currently being dragged).

  Interaction:
    drag handle            frequency (x) and gain (y)
    shift + drag (MID)     Q (vertical)
    wheel on MID handle    Q
    double click handle    reset gain to 0 dB
    keyboard (focused):    Up/Down gain +-0.5 dB (shift: 0.1 dB),
                           Left/Right frequency -+1 step (shift: 6 steps),
                           PageUp/PageDown Q (MID), Home gain 0 dB
*/

const WIDTH = 400;
const HEIGHT = 200;
const PAD_LEFT = 26;
const PAD_RIGHT = 6;
const PAD_TOP = 6;
const PAD_BOTTOM = 16;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;
const F_MIN = 20;
const F_MAX = 20000;
const CURVE_POINTS = 160;
const FREQS = logFrequencies(CURVE_POINTS, F_MIN, F_MAX);

const BAND_LABELS = { low: "Low", mid: "Mid", high: "High" };
const BAND_SHORT = { low: "L", mid: "M", high: "H" };
const FREQ_GRID = [
  20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800,
  900, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000,
];
const FREQ_LABELS = { 100: "100", 1000: "1k", 10000: "10k" };
const GAIN_GRID = [-18, -12, -6, 0, 6, 12, 18];

const freqToX = (hz) => {
  const t = Math.log(hz / F_MIN) / Math.log(F_MAX / F_MIN);
  return PAD_LEFT + t * PLOT_W;
};

const xToFreq = (x) => {
  const t = (x - PAD_LEFT) / PLOT_W;
  return F_MIN * Math.pow(F_MAX / F_MIN, t);
};

const gainToY = (db) => {
  const clamped = Math.min(
    Math.max(db, EQ_GAIN_MIN_DB - 6),
    EQ_GAIN_MAX_DB + 6,
  );
  return PAD_TOP + (EQ_GAIN_MAX_DB - clamped)
    / (EQ_GAIN_MAX_DB - EQ_GAIN_MIN_DB) * PLOT_H;
};

const yToGain = (y) => {
  return EQ_GAIN_MAX_DB
    - (y - PAD_TOP) / PLOT_H * (EQ_GAIN_MAX_DB - EQ_GAIN_MIN_DB);
};

const toPath = (values) => values
  .map((db, i) => {
    const cmd = i === 0 ? "M" : "L";
    return `${cmd}${freqToX(FREQS[i]).toFixed(2)},${gainToY(db).toFixed(2)}`;
  })
  .join(" ");

class EQCurve extends HTMLElement {
  static observedAttributes = ["disabled"];

  #params = normalizeParams({});
  #sampleRate = DEFAULT_SAMPLE_RATE;
  #includeTotalGain = false;
  #drag = null;

  get params() {
    return this.#params;
  }

  set params(value) {
    const next = normalizeParams(value);
    if (this.#drag) {
      // keep the band being dragged at its local value so late device
      // echoes don't make the handle jump back
      for (const key of Object.values(EQ_BANDS[this.#drag.band])) {
        next[key] = this.#params[key];
      }
    }
    this.#params = next;
    this.render();
  }

  get sampleRate() {
    return this.#sampleRate;
  }

  set sampleRate(value) {
    this.#sampleRate = Number.isFinite(value) && value > 0
      ? value
      : DEFAULT_SAMPLE_RATE;
    this.render();
  }

  get includeTotalGain() {
    return this.#includeTotalGain;
  }

  set includeTotalGain(value) {
    this.#includeTotalGain = !!value;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  get #disabled() {
    return this.hasAttribute("disabled");
  }

  /* Applies a raw change locally and dispatches eq-change if it changed. */
  #set(param, raw) {
    const { min, max } = PARAM_RANGES[param];
    const value = Math.min(max, Math.max(min, Math.round(raw)));
    if (this.#params[param] === value) return;
    this.#params = { ...this.#params, [param]: value };
    this.dispatchEvent(new CustomEvent("eq-change", {
      detail: { param, value },
      bubbles: true,
    }));
  }

  #apply(changes) {
    let changed = false;
    for (const [param, value] of Object.entries(changes)) {
      const before = this.#params[param];
      this.#set(param, value);
      changed = changed || before !== this.#params[param];
    }
    if (changed) this.render();
  }

  #svgPoint(event) {
    const svgEl = this.querySelector("svg");
    const rect = svgEl.getBoundingClientRect();
    // viewBox uses xMidYMid meet: compute the uniform scale and offsets
    const scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT) || 1;
    const offsetX = (rect.width - WIDTH * scale) / 2;
    const offsetY = (rect.height - HEIGHT * scale) / 2;
    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    };
  }

  #onPointerDown(event, band) {
    if (this.#disabled || event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.focus();
    handle.setPointerCapture(event.pointerId);
    this.#drag = {
      band,
      pointerId: event.pointerId,
      startY: this.#svgPoint(event).y,
      startQ: this.#params.midQ,
    };
    this.classList.add("dragging");
  }

  #onPointerMove(event, band) {
    const drag = this.#drag;
    if (!drag || drag.band !== band || drag.pointerId !== event.pointerId) {
      return;
    }
    const { x, y } = this.#svgPoint(event);
    if (band === "mid" && event.shiftKey) {
      // every 4 viewBox units upwards = one Q step narrower
      const steps = Math.round((drag.startY - y) / 4);
      this.#apply({ midQ: drag.startQ + steps });
      return;
    }
    drag.startY = y;
    drag.startQ = this.#params.midQ;
    this.#apply(handleToRaw(band, {
      freqHz: xToFreq(x),
      gainDb: Math.round(yToGain(y) * 2) / 2,
    }));
  }

  #onPointerUp(event) {
    if (this.#drag && this.#drag.pointerId === event.pointerId) {
      this.#drag = null;
      this.classList.remove("dragging");
    }
  }

  #onWheel(event, band) {
    if (this.#disabled || band !== "mid") return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    this.#apply({ midQ: this.#params.midQ + direction });
  }

  #onDblClick(band) {
    if (this.#disabled) return;
    this.#apply({ [EQ_BANDS[band].gain]: 180 });
  }

  #onKeyDown(event, band) {
    if (this.#disabled) return;
    const keys = EQ_BANDS[band];
    const p = this.#params;
    const gainStep = event.shiftKey ? 1 : 5;
    const freqStep = event.shiftKey ? 6 : 1;
    let changes = null;
    switch (event.key) {
    case "ArrowUp":
      changes = { [keys.gain]: p[keys.gain] + gainStep };
      break;
    case "ArrowDown":
      changes = { [keys.gain]: p[keys.gain] - gainStep };
      break;
    case "ArrowRight":
      changes = { [keys.freq]: p[keys.freq] + freqStep };
      break;
    case "ArrowLeft":
      changes = { [keys.freq]: p[keys.freq] - freqStep };
      break;
    case "Home":
      changes = { [keys.gain]: 180 };
      break;
    case "PageUp":
      if (keys.q) changes = { [keys.q]: p[keys.q] + 1 };
      break;
    case "PageDown":
      if (keys.q) changes = { [keys.q]: p[keys.q] - 1 };
      break;
    default:
      break;
    }
    if (changes) {
      event.preventDefault();
      this.#apply(changes);
    }
  }

  #handleTemplate(band) {
    const keys = EQ_BANDS[band];
    const p = this.#params;
    const freqHz = freqToHz(p[keys.freq], keys.freq);
    const gainDb = gainToDb(p[keys.gain]);
    const x = freqToX(freqHz);
    const y = gainToY(gainDb);
    const qText = keys.q ? `, Q ${qToValue(p[keys.q]).toFixed(2)}` : "";
    const valueText = `${formatHz(freqHz)}, ${formatParam(keys.gain, p[keys.gain])}${qText}`;
    const disabled = this.#disabled;
    return svg`<g
      class="eq-handle eq-handle-${band}"
      role="slider"
      tabindex=${disabled ? "-1" : "0"}
      aria-disabled=${disabled ? "true" : "false"}
      aria-label="${BAND_LABELS[band]} band gain and frequency"
      aria-valuemin=${EQ_GAIN_MIN_DB}
      aria-valuemax=${EQ_GAIN_MAX_DB}
      aria-valuenow=${gainDb}
      aria-valuetext=${valueText}
      transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"
      @pointerdown=${(e) => this.#onPointerDown(e, band)}
      @pointermove=${(e) => this.#onPointerMove(e, band)}
      @pointerup=${(e) => this.#onPointerUp(e)}
      @pointercancel=${(e) => this.#onPointerUp(e)}
      @wheel=${(e) => this.#onWheel(e, band)}
      @dblclick=${() => this.#onDblClick(band)}
      @keydown=${(e) => this.#onKeyDown(e, band)}
    >
      <title>${BAND_LABELS[band]}: ${valueText}</title>
      <circle class="hit" r="14"></circle>
      <circle class="dot" r="8"></circle>
      <text class="handle-label" text-anchor="middle" dy="3.5"
        >${BAND_SHORT[band]}</text>
    </g>`;
  }

  render() {
    if (!this.isConnected) return;
    const p = this.#params;
    const bypassed = p.eqBypass === 1;
    const options = {
      sampleRate: this.#sampleRate,
      includeTotalGain: this.#includeTotalGain,
    };
    const total = computeEQResponse(p, FREQS, options);
    const bandPaths = bypassed
      ? []
      : ["low", "mid", "high"].map(band => ({
        band,
        d: toPath(computeEQResponse(p, FREQS, {
          ...options,
          includeTotalGain: false,
          bands: [band],
        })),
      }));

    this.classList.toggle("bypassed", bypassed);
    this.classList.toggle("disabled", this.#disabled);

    const left = PAD_LEFT;
    const right = PAD_LEFT + PLOT_W;
    const top = PAD_TOP;
    const bottom = PAD_TOP + PLOT_H;
    const zeroY = gainToY(0);
    const totalPath = toPath(total);
    const fillPath = `${totalPath} L${right},${zeroY} L${left},${zeroY} Z`;

    const template = html`<svg
      class="eq-curve-svg"
      viewBox="0 0 ${WIDTH} ${HEIGHT}"
      aria-label=${bypassed ? "EQ curve (bypassed)" : "EQ curve"}
      role="group"
    >
      <rect class="plot-bg" x=${left} y=${top}
        width=${PLOT_W} height=${PLOT_H}></rect>
      ${FREQ_GRID.map(f => svg`<line
        class="grid ${FREQ_LABELS[f] ? "major" : ""}"
        x1=${freqToX(f)} x2=${freqToX(f)} y1=${top} y2=${bottom}></line>`)}
      ${GAIN_GRID.map(db => svg`<line
        class="grid ${db === 0 ? "major" : ""}"
        x1=${left} x2=${right} y1=${gainToY(db)} y2=${gainToY(db)}></line>
        <text class="axis-label" x=${left - 3} y=${gainToY(db) + 3}
          text-anchor="end">${db > 0 ? `+${db}` : db}</text>`)}
      ${Object.entries(FREQ_LABELS).map(([f, label]) => svg`<text
        class="axis-label" x=${freqToX(Number(f))} y=${bottom + 12}
        text-anchor="middle">${label}</text>`)}
      <svg x=${left} y=${top} width=${PLOT_W} height=${PLOT_H}
        viewBox="${left} ${top} ${PLOT_W} ${PLOT_H}">
        ${bandPaths.map(({ band, d }) => svg`<path
          class="band-curve band-curve-${band}" d=${d}></path>`)}
        <path class="curve-fill" d=${fillPath}></path>
        <path class="curve" d=${totalPath}></path>
      </svg>
      ${["low", "mid", "high"].map(band => this.#handleTemplate(band))}
    </svg>`;

    render(template, this);
  }
}

if (!customElements.get("eq-curve")) {
  customElements.define("eq-curve", EQCurve);
}

export default EQCurve;
