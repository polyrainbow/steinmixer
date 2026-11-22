/*
  Lightweight vertical meters for the channel strip. Both build their DOM
  once and afterwards only touch `style.transform` / a class when `.value`
  changes, so they can be updated every animation frame.

  <gr-meter>
    value      gain reduction in dB. Either sign is accepted; the magnitude
               is used (-6 and 6 both mean "6 dB of gain reduction").
               Non-finite values show no reduction.
    range      attribute, full scale in dB (default 24 -> 0..-24 dB).
    The bar grows from the top downwards.

  <level-meter>
    value      level in dBFS (<= 0). Non-finite values (e.g. -Infinity)
               show an empty meter.
    min-db     attribute, bottom of the scale (default -80).
    The bar grows from the bottom upwards. A peak-hold line holds the
    highest value for ~1 s. Values >= 0 dBFS or setting `over` (the device's
    clip detection, set it before `value`) light the OVER indicator, which
    stays lit for 2 s after the last over (click it to reset).
    The host also gets the class "over" while lit.
*/

const GR_TICKS = [0, 6, 12, 18, 24];
const LEVEL_TICKS = [0, -10, -20, -40, -60, -80];
const PEAK_HOLD_MS = 1000;
const PEAK_FALL_DB_PER_S = 20;
const OVER_HOLD_MS = 2000;

const createScale = (ticks, toPercent, fromTop, format) => {
  const scale = document.createElement("div");
  scale.className = "meter-scale";
  scale.setAttribute("aria-hidden", "true");
  for (const tick of ticks) {
    const percent = toPercent(tick);
    if (percent < 0 || percent > 100) continue;
    const label = document.createElement("span");
    label.className = "meter-tick";
    label.style[fromTop ? "top" : "bottom"] = `${percent}%`;
    label.textContent = format(tick);
    scale.appendChild(label);
  }
  return scale;
};

class GainReductionMeter extends HTMLElement {
  static observedAttributes = ["range"];

  #value = 0;
  #bar = null;
  #scale = null;

  get range() {
    const range = parseFloat(this.getAttribute("range"));
    return Number.isFinite(range) && range > 0 ? range : 24;
  }

  get value() {
    return this.#value;
  }

  set value(db) {
    const magnitude = Number.isFinite(db) ? Math.abs(db) : 0;
    if (magnitude === this.#value) return;
    this.#value = magnitude;
    this.#update();
  }

  connectedCallback() {
    if (!this.#bar) {
      this.setAttribute("role", "meter");
      if (!this.hasAttribute("aria-label")) {
        this.setAttribute("aria-label", "Gain reduction");
      }
      this.setAttribute("aria-valuemax", "0");
      const track = document.createElement("div");
      track.className = "meter-track";
      this.#bar = document.createElement("div");
      this.#bar.className = "meter-bar";
      track.appendChild(this.#bar);
      this.appendChild(track);
    }
    this.#renderScale();
    this.#update();
  }

  attributeChangedCallback() {
    if (this.#bar) {
      this.#renderScale();
      this.#update();
    }
  }

  #renderScale() {
    this.#scale?.remove();
    const range = this.range;
    this.setAttribute("aria-valuemin", String(-range));
    this.#scale = createScale(
      GR_TICKS.filter(tick => tick <= range),
      tick => tick / range * 100,
      true,
      tick => (tick === 0 ? "0" : `-${tick}`),
    );
    this.appendChild(this.#scale);
  }

  #update() {
    if (!this.#bar) return;
    const fraction = Math.min(this.#value / this.range, 1);
    this.#bar.style.transform = `scaleY(${fraction})`;
    this.setAttribute("aria-valuenow", (-this.#value).toFixed(1));
  }
}

class LevelMeter extends HTMLElement {
  static observedAttributes = ["min-db"];

  #value = -Infinity;
  over = false;
  #bar = null;
  #peak = null;
  #overLed = null;
  #scale = null;
  #peakDb = -Infinity;
  #peakTime = 0;
  #overUntil = 0;
  #lastUpdate = 0;

  get minDb() {
    const min = parseFloat(this.getAttribute("min-db"));
    return Number.isFinite(min) && min < 0 ? min : -80;
  }

  get value() {
    return this.#value;
  }

  set value(db) {
    this.#value = Number.isFinite(db) ? db : -Infinity;
    this.#update();
  }

  resetOver() {
    this.#overUntil = 0;
    this.#update();
  }

  connectedCallback() {
    if (!this.#bar) {
      this.setAttribute("role", "meter");
      if (!this.hasAttribute("aria-label")) {
        this.setAttribute("aria-label", "Output level");
      }
      this.#overLed = document.createElement("div");
      this.#overLed.className = "meter-over";
      this.#overLed.textContent = "OVER";
      this.#overLed.title = "Click to reset";
      this.#overLed.addEventListener("click", () => this.resetOver());
      this.appendChild(this.#overLed);

      const track = document.createElement("div");
      track.className = "meter-track";
      // full height gradient + a mask that hides the unlit top part,
      // so the colours stay fixed to their dB positions
      const fill = document.createElement("div");
      fill.className = "meter-fill";
      this.#bar = document.createElement("div");
      this.#bar.className = "meter-mask";
      track.appendChild(fill);
      this.#peak = document.createElement("div");
      this.#peak.className = "meter-peak";
      track.appendChild(this.#bar);
      track.appendChild(this.#peak);
      this.appendChild(track);
    }
    this.#renderScale();
    this.#update();
  }

  attributeChangedCallback() {
    if (this.#bar) {
      this.#renderScale();
      this.#update();
    }
  }

  #renderScale() {
    this.#scale?.remove();
    const min = this.minDb;
    this.setAttribute("aria-valuemin", String(min));
    this.setAttribute("aria-valuemax", "0");
    this.#scale = createScale(
      LEVEL_TICKS.filter(tick => tick >= min),
      tick => this.#fraction(tick) * 100,
      false,
      tick => String(tick),
    );
    this.appendChild(this.#scale);
  }

  #fraction(db) {
    const min = this.minDb;
    if (!(db > min)) return 0;
    return Math.min((db - min) / -min, 1);
  }

  #update() {
    if (!this.#bar) return;
    const now = performance.now();
    const db = this.#value;

    if (db >= this.#peakDb) {
      this.#peakDb = db;
      this.#peakTime = now;
    } else if (now - this.#peakTime > PEAK_HOLD_MS) {
      // after the hold time the peak line falls towards the current level
      const dt = (now - this.#lastUpdate) / 1000;
      this.#peakDb = Math.max(db, this.#peakDb - dt * PEAK_FALL_DB_PER_S);
    }
    this.#lastUpdate = now;

    if (db >= 0 || this.over) {
      this.#overUntil = now + OVER_HOLD_MS;
    }
    const over = now < this.#overUntil;

    this.#bar.style.transform = `scaleY(${1 - this.#fraction(db)})`;
    const peakFraction = this.#fraction(this.#peakDb);
    this.#peak.style.bottom = `${peakFraction * 100}%`;
    this.#peak.style.visibility = peakFraction > 0 ? "visible" : "hidden";
    this.#overLed.classList.toggle("active", over);
    this.classList.toggle("over", over);
    this.setAttribute(
      "aria-valuenow",
      Number.isFinite(db) ? db.toFixed(1) : String(this.minDb),
    );
  }
}

if (!customElements.get("gr-meter")) {
  customElements.define("gr-meter", GainReductionMeter);
}
if (!customElements.get("level-meter")) {
  customElements.define("level-meter", LevelMeter);
}

export { GainReductionMeter, LevelMeter };
