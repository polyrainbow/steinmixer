import { html, svg, render } from "../lit.js";
import {
  getReverbDecay,
  getTimeAxis,
  formatSeconds,
  formatSecondsShort,
  reverbFreqToHz,
} from "../devices/reverbMath.js";

/*
  <reverb-graph>

  Top: how the reverb decays over time. The dry sound at 0 s, the pre-delay
  gap, then the time it takes lows, mids and highs to decay by 60 dB.
  Bottom: the frequencies which are fed into the reverb (between high-pass and
  low-pass) and the range which decays with the low ratio.

  Decay (envelope shape) and diffusion are not shown, as we don't know how the
  device applies them.

  Properties:
    settings   the device settings (raw param values). Assigning re-renders.
*/

const WIDTH = 300;
const LEFT = 28;
const RIGHT = WIDTH - 6;
const ENV_TOP = 8;
const ENV_BOTTOM = 112;
const MIN_DB = -60;
const FREQ_TOP = 140;
const FREQ_BOTTOM = 162;
const HEIGHT = 176;
const F_MIN = 20;
const F_MAX = 20000;

const BANDS = [
  { key: "low", label: "Low" },
  { key: "mid", label: "Mid" },
  { key: "high", label: "High" },
];

const freqX = (hz) => {
  const t = Math.log(hz / F_MIN) / Math.log(F_MAX / F_MIN);
  return LEFT + Math.min(Math.max(t, 0), 1) * (RIGHT - LEFT);
};

const dbY = (db) => ENV_TOP + db / MIN_DB * (ENV_BOTTOM - ENV_TOP);

class ReverbGraph extends HTMLElement {
  #settings = null;

  get settings() {
    return this.#settings;
  }

  set settings(value) {
    this.#settings = value;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (!this.isConnected || !this.#settings) return;
    const s = this.#settings;
    const decay = getReverbDecay(s);
    const longest = decay.preDelay + Math.max(decay.low, decay.mid);
    const axis = getTimeAxis(longest * 1.05);
    const timeX = (sec) => LEFT + sec / axis.max * (RIGHT - LEFT);

    const ticks = [];
    for (let i = 0; i * axis.tick <= axis.max + 1e-9; i++) {
      ticks.push(i * axis.tick);
    }

    const start = timeX(decay.preDelay);
    const bandPath = (key) => `M${start.toFixed(2)},${dbY(0)} L${
      timeX(decay.preDelay + decay[key]).toFixed(2)},${dbY(MIN_DB)}`;

    const hpf = reverbFreqToHz(s.ReverbHPF);
    const lpf = reverbFreqToHz(s.ReverbLPF);
    const lowFreq = reverbFreqToHz(s.ReverbLowFreq);
    const passStart = freqX(hpf);
    const passEnd = Math.max(passStart, freqX(lpf));
    const lowEnd = Math.min(Math.max(freqX(lowFreq), passStart), passEnd);

    const template = html`<svg
      class="reverb-graph-svg"
      viewBox="0 0 ${WIDTH} ${HEIGHT}"
      role="img"
      aria-label=${`Reverb decay: pre-delay ${formatSeconds(decay.preDelay)}, `
        + `lows ${formatSeconds(decay.low)}, mids ${formatSeconds(decay.mid)}, `
        + `highs ${formatSeconds(decay.high)}`}
    >
      <rect class="plot-bg" x=${LEFT} y=${ENV_TOP}
        width=${RIGHT - LEFT} height=${ENV_BOTTOM - ENV_TOP}></rect>
      ${ticks.map((sec) => svg`
        <line class="grid" x1=${timeX(sec)} x2=${timeX(sec)}
          y1=${ENV_TOP} y2=${ENV_BOTTOM}></line>
        <text class="axis-label" x=${timeX(sec)} y=${ENV_BOTTOM + 10}
          text-anchor=${sec === ticks.at(-1) ? "end" : "middle"}
        >${formatSecondsShort(sec)}</text>
      `)}
      ${[0, -20, -40, -60].map((db) => svg`
        <line class="grid" x1=${LEFT} x2=${RIGHT}
          y1=${dbY(db)} y2=${dbY(db)}></line>
        <text class="axis-label" x=${LEFT - 3} y=${dbY(db) + 3}
          text-anchor="end">${db}</text>
      `)}
      <path class="decay-fill" d="${bandPath("mid")} L${start},${dbY(MIN_DB)} Z">
      </path>
      <line class="dry" x1=${LEFT} x2=${LEFT}
        y1=${dbY(0)} y2=${dbY(MIN_DB)}></line>
      ${BANDS.map(({ key }) => svg`
        <path class="decay decay-${key}" d=${bandPath(key)}></path>
      `)}
      ${BANDS.map(({ key, label }, i) => svg`
        <text class="legend legend-${key}" x=${RIGHT - 4}
          y=${ENV_TOP + 11 + i * 10} text-anchor="end"
        >${label} ${formatSeconds(decay[key])}</text>
      `)}
      <text class="legend" x=${RIGHT - 4} y=${ENV_TOP + 41}
        text-anchor="end">Pre-delay ${formatSeconds(decay.preDelay)}</text>

      <text class="axis-label" x=${LEFT} y=${FREQ_TOP - 4}
      >Frequencies fed into the reverb</text>
      <rect class="plot-bg" x=${LEFT} y=${FREQ_TOP}
        width=${RIGHT - LEFT} height=${FREQ_BOTTOM - FREQ_TOP}></rect>
      ${[100, 1000, 10000].map((hz) => svg`
        <line class="grid" x1=${freqX(hz)} x2=${freqX(hz)}
          y1=${FREQ_TOP} y2=${FREQ_BOTTOM}></line>
        <text class="axis-label" x=${freqX(hz)} y=${FREQ_BOTTOM + 10}
          text-anchor="middle">${hz < 1000 ? hz : `${hz / 1000}k`}</text>
      `)}
      <rect class="pass-band" x=${passStart} y=${FREQ_TOP}
        width=${passEnd - passStart} height=${FREQ_BOTTOM - FREQ_TOP}></rect>
      <rect class="low-band" x=${passStart} y=${FREQ_TOP}
        width=${lowEnd - passStart} height=${FREQ_BOTTOM - FREQ_TOP}></rect>
      <line class="low-freq" x1=${freqX(lowFreq)} x2=${freqX(lowFreq)}
        y1=${FREQ_TOP} y2=${FREQ_BOTTOM}></line>
      ${hpf >= lpf
        ? svg`<text class="legend" x=${(LEFT + RIGHT) / 2}
            y=${(FREQ_TOP + FREQ_BOTTOM) / 2 + 3} text-anchor="middle"
          >Nothing: high-pass is above low-pass</text>`
        : ""}
    </svg>`;

    render(template, this);
  }
}

if (!customElements.get("reverb-graph")) {
  customElements.define("reverb-graph", ReverbGraph);
}

export default ReverbGraph;
