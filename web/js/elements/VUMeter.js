/*
  <vu-meter channel-id="analog1" .device=${device}>
    Level meter of one meter channel of the device, on a dBFS scale from
    -80 to 0 dB. A white line shows the device's peak value. The bar turns
    red while the device reports clipping and stays red for OVER_HOLD_MS
    after the last over, so short overs are visible too.

    show-scale  attribute, renders the dB labels to the left of the meter
                (tick lines are always drawn on the meter itself).
*/

const MIN_DB = -80;
const TICKS = [0, -10, -20, -40, -60];
const OVER_HOLD_MS = 1500;

const toPercent = (db) => {
  return Math.min(Math.max((db - MIN_DB) / -MIN_DB, 0), 1) * 100;
};

class VUMeter extends HTMLElement {
  channelId;
  momentaryOverlay;
  maxBar;
  #overUntil = 0;
  #frame = null;

  refreshValues() {
    const levels = this.device?.getMeterLevels(this.channelId);
    // In case we haven´t received values yet, do nothing.
    if (levels) {
      const now = performance.now();
      if (levels.over) this.#overUntil = now + OVER_HOLD_MS;
      this.momentaryOverlay.style.height = `${toPercent(levels.level)}%`;
      // keep the peak line inside the meter at 0 dB
      this.maxBar.style.bottom = `min(${toPercent(levels.peak)}%, 100% - 0.2em)`;
      this.classList.toggle("over", now < this.#overUntil);
    }
    this.#frame = requestAnimationFrame(() => this.refreshValues());
  }

  connectedCallback() {
    this.channelId = this.getAttribute("channel-id");

    if (!this.momentaryOverlay) {
      const track = document.createElement("div");
      track.className = "vu-track";

      this.momentaryOverlay = document.createElement("div");
      this.momentaryOverlay.className = "momentary-overlay";
      track.appendChild(this.momentaryOverlay);

      // tick lines on top of the bar
      for (const tick of TICKS) {
        const line = document.createElement("div");
        line.className = "vu-tick";
        line.style.bottom = `${toPercent(tick)}%`;
        track.appendChild(line);
      }

      this.maxBar = document.createElement("div");
      this.maxBar.className = "max-bar";
      track.appendChild(this.maxBar);

      if (this.hasAttribute("show-scale")) {
        const scale = document.createElement("div");
        scale.className = "vu-scale";
        scale.setAttribute("aria-hidden", "true");
        for (const tick of TICKS) {
          const label = document.createElement("span");
          label.style.bottom = `${toPercent(tick)}%`;
          label.textContent = String(tick);
          scale.appendChild(label);
        }
        this.appendChild(scale);
      }
      this.appendChild(track);
    }

    this.#frame = requestAnimationFrame(() => this.refreshValues());
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#frame);
  }
}

customElements.define("vu-meter", VUMeter);
