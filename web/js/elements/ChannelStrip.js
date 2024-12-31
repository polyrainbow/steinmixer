import { html, render } from "../lit.js";

customElements.define("channel-strip", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = [
    "phantom-power-enabled",
    "channel-id",
    "channel-id-l",
    "channel-id-r",
    "active-mix",
    "volume",
    "pan",
    "mute",
    "solo",
    "hpf-enabled",
    "invert-phase-enabled",
  ];

  attributeChangedCallback(name, oldValue, newValue) {
    if ([
      "active-mix",
      "phantom-power-enabled",
      "volume",
      "pan",
      "mute",
      "solo",
      "hpf-enabled",
      "invert-phase-enabled",
    ].includes(name)) {
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const template = html`
    <fx-section
      type=${this.getAttribute("type")}
      channel-id=${this.getAttribute("channel-id")}
      subchannel-id-l=${this.getAttribute("subchannel-id-l")}
      subchannel-id-r=${this.getAttribute("subchannel-id-r")}
      active-mix=${this.getAttribute("active-mix")}
      hpf-available=${this.getAttribute("hpf-available")}
      hpf-enabled=${this.getAttribute("hpf-enabled")}
      invert-phase-enabled=${this.getAttribute("invert-phase-enabled")}
    ></fx-section>
    <pan-slider
      channel-id=${this.getAttribute("channel-id")}
      active-mix=${this.getAttribute("active-mix")}
      pan=${this.getAttribute("pan")}
    ></pan-slider>
    <volume-slider
      type=${this.getAttribute("type")}
      phantom-power-available=${
        this.getAttribute("phantom-power-available") === "true"
      }
      phantom-power-enabled=${this.getAttribute("phantom-power-enabled")}
      channel-id=${this.getAttribute("channel-id")}
      active-mix=${this.getAttribute("active-mix")}
      volume=${this.getAttribute("volume")}
      mute=${this.getAttribute("mute")}
      solo=${this.getAttribute("solo")}
    /></volume-slider>
    <span class="title">${this.getAttribute("title")}</span>`;

    render(template, this);
  }
});
