class VUMeter extends HTMLElement {
  constructor() {
    super();
  }

  channelId;
  momentaryOverlay;
  maxBar;

  refreshValues() {
    try {
      const values = this.device.getVuValues(this.channelId);
      this.momentaryOverlay.style.height = (values.momentary / 1000) + "em";
      this.maxBar.style.bottom = (values.max / 1000) + "em";
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
