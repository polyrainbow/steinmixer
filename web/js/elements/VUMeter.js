const getHeightPercentage = (val) => {
  // 8190 is the max absolute value for a 0dBFS square wave
  return val / 8190 * 100;
};

class VUMeter extends HTMLElement {
  constructor() {
    super();
  }

  channelId;
  momentaryOverlay;
  maxBar;

  refreshValues() {
    try {
      const { momentary, max } = this.device.getVuValues(this.channelId);
      this.momentaryOverlay.style.height = `${getHeightPercentage(momentary)}%`;
      this.maxBar.style.bottom = `${getHeightPercentage(max)}%`;
    } catch (e) {
      /* In case we haven´t received values yet, do nothing. */
    } finally {
      requestAnimationFrame(this.refreshValues.bind(this));
    }
  }

  connectedCallback() {
    this.channelId = this.getAttribute("channel-id");

    this.momentaryOverlay = document.createElement("div");
    this.momentaryOverlay.className = "momentary-overlay";
    this.appendChild(this.momentaryOverlay);

    this.maxBar = document.createElement("div");
    this.maxBar.className = "max-bar";
    this.appendChild(this.maxBar);

    requestAnimationFrame(this.refreshValues.bind(this));
  }
}

customElements.define("vu-meter", VUMeter);
