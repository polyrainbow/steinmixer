import { html, svg, render } from "../lit.js";
import {
  computeCompressorCurve,
  getEffectiveThresholdDb,
  normalizeParams,
} from "../devices/channelStripMath.js";

/*
  <compressor-curve>

  Static compressor transfer curve (input dBFS -> output dBFS).

  Properties:
    params        object of raw channel strip values (see
                  channelStripMath.js PARAM_RANGES). Missing keys fall back
                  to device defaults. Assigning re-renders.
    inputLevelDb  current input level in dBFS (number) or null to hide the
                  level dot. Cheap to update at 60 fps (no re-render).

  Attributes:
    min-db        lower end of both axes (default -60).
    curve-only    when present, makeup and total gain are not added to the
                  curve (matches dspMixFx's own graph).
*/

const SIZE = 200;
const PAD = 22;
const PLOT = SIZE - PAD - 6;

class CompressorCurve extends HTMLElement {
  static observedAttributes = ["min-db", "curve-only"];

  #params = {};
  #inputLevelDb = null;
  #points = [];
  #dot = null;

  get params() {
    return this.#params;
  }

  set params(value) {
    this.#params = value || {};
    this.render();
  }

  get inputLevelDb() {
    return this.#inputLevelDb;
  }

  set inputLevelDb(value) {
    this.#inputLevelDb = Number.isFinite(value) ? value : null;
    this.#updateDot();
  }

  get minDb() {
    const value = parseFloat(this.getAttribute("min-db"));
    return Number.isFinite(value) && value < 0 ? value : -60;
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  #x(db) {
    const minDb = this.minDb;
    return PAD + (Math.min(Math.max(db, minDb), 0) - minDb) / -minDb * PLOT;
  }

  #y(db) {
    const minDb = this.minDb;
    // values outside the plot are clipped by the inner <svg>
    const clamped = Math.min(Math.max(db, minDb - 20), 40);
    return 6 + (0 - clamped) / -minDb * PLOT;
  }

  #outAt(inDb) {
    const points = this.#points;
    if (points.length === 0) return inDb;
    if (inDb <= points[0].inDb) return points[0].outDb;
    for (let i = 1; i < points.length; i++) {
      if (inDb <= points[i].inDb) {
        const a = points[i - 1];
        const b = points[i];
        const t = (inDb - a.inDb) / (b.inDb - a.inDb);
        return a.outDb + (b.outDb - a.outDb) * t;
      }
    }
    return points[points.length - 1].outDb;
  }

  #updateDot() {
    const dot = this.#dot;
    if (!dot) return;
    const level = this.#inputLevelDb;
    if (level === null || level < this.minDb) {
      dot.setAttribute("visibility", "hidden");
      return;
    }
    const inDb = Math.min(level, 0);
    dot.setAttribute("visibility", "visible");
    dot.setAttribute("cx", this.#x(inDb).toFixed(2));
    const outDb = Math.min(Math.max(this.#outAt(inDb), this.minDb), 0);
    dot.setAttribute("cy", this.#y(outDb).toFixed(2));
  }

  render() {
    if (!this.isConnected) return;
    const params = normalizeParams(this.#params);
    const minDb = this.minDb;
    const curveOnly = this.hasAttribute("curve-only");
    const bypassed = params.compBypass === 1;
    this.#points = computeCompressorCurve(params, {
      minDb,
      maxDb: 0,
      step: 0.5,
      includeMakeup: !curveOnly,
      includeTotalGain: !curveOnly,
    });
    const threshold = getEffectiveThresholdDb(params);

    const gridLines = [];
    for (let db = minDb; db <= 0; db += 10) {
      gridLines.push(db);
    }
    const labelEvery = minDb <= -60 ? 20 : 10;
    const labels = gridLines.filter(db => db % labelEvery === 0);

    const path = this.#points
      .map(({ inDb, outDb }, i) => {
        const cmd = i === 0 ? "M" : "L";
        return `${cmd}${this.#x(inDb).toFixed(2)},${this.#y(outDb).toFixed(2)}`;
      })
      .join(" ");

    const left = this.#x(minDb);
    const right = this.#x(0);
    const top = this.#y(0);
    const bottom = this.#y(minDb);

    this.classList.toggle("bypassed", bypassed);

    const template = html`<svg
      class="compressor-curve-svg"
      viewBox="0 0 ${SIZE} ${SIZE}"
      role="img"
      aria-label=${bypassed
        ? "Compressor transfer curve (bypassed)"
        : `Compressor transfer curve, threshold ${threshold.toFixed(1)} dB`}
    >
      <rect class="plot-bg" x=${left} y=${top}
        width=${right - left} height=${bottom - top}></rect>
      ${gridLines.map(db => svg`
        <line class="grid" x1=${this.#x(db)} x2=${this.#x(db)}
          y1=${top} y2=${bottom}></line>
        <line class="grid" x1=${left} x2=${right}
          y1=${this.#y(db)} y2=${this.#y(db)}></line>
      `)}
      ${labels.map(db => svg`
        <text class="axis-label" x=${this.#x(db)} y=${bottom + 12}
          text-anchor="middle">${db}</text>
        <text class="axis-label" x=${left - 3} y=${this.#y(db) + 3}
          text-anchor="end">${db}</text>
      `)}
      <line class="unity" x1=${left} y1=${bottom} x2=${right} y2=${top}></line>
      ${!bypassed && threshold < 0 && threshold > minDb
        ? svg`<line class="threshold" x1=${this.#x(threshold)}
            x2=${this.#x(threshold)} y1=${top} y2=${bottom}></line>`
        : ""}
      <svg x=${left} y=${top} width=${right - left} height=${bottom - top}
        viewBox="${left} ${top} ${right - left} ${bottom - top}">
        <path class="curve" d=${path}></path>
      </svg>
      <circle class="level-dot" r="3.5" visibility="hidden"></circle>
    </svg>`;

    render(template, this);
    this.#dot = this.querySelector(".level-dot");
    this.#updateDot();
  }
}

if (!customElements.get("compressor-curve")) {
  customElements.define("compressor-curve", CompressorCurve);
}

export default CompressorCurve;
