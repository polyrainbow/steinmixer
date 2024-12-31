import { html, render } from "../lit.js";

customElements.define("stereo-input", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = [
    "phantom-power-enabled",
    "channel-id-l",
    "channel-id-r",
    "pan-l",
    "pan-r",
    "active-mix",
    "mute-l",
    "mute-r",
    "solo-l",
    "solo-r",
    "volume-l",
    "volume-r",
    "hpf-l-enabled",
    "hpf-r-enabled",
    "invert-phase-l-enabled",
    "invert-phase-r-enabled",
  ];

  attributeChangedCallback(name, oldValue, newValue) {
    // Somehow the parent element rendering breaks if we just call this.render()
    // here without check for elements that are really updated during element
    // lifetime
    if ([
      "phantom-power-enabled",
      "active-mix",
      "pan-l",
      "pan-r",
      "mute-l",
      "mute-r",
      "solo-l",
      "solo-r",
      "volume-l",
      "volume-r",
      "hpf-l-enabled",
      "hpf-r-enabled",
      "invert-phase-l-enabled",
      "invert-phase-r-enabled",
    ].includes(name)) {
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const activeMix = this.getAttribute("active-mix");

    const template = html`
    <!-- <div class="stereo-toggle">
      <label>
        <input
          type="checkbox"
          @change=${(e) => {
            this.dispatchEvent(new CustomEvent("link-channels", {
              detail: {
                linked: e.target.checked,
                channelIdL: this.getAttribute("channel-id-l"),
              },
            }));
          }
        }>
        Link channels
      </label>
    </div> -->
    <div class="strips-container">
      <channel-strip
        type="analog"
        channel-id=${this.getAttribute("channel-id-l")}
        title="${this.getAttribute("title-l")}"
        phantom-power-available=${
          this.getAttribute("phantom-power-available") === "true"
        }
        phantom-power-enabled=${this.getAttribute("phantom-power-enabled")}
        active-mix=${activeMix}
        volume=${this.getAttribute("volume-l")}
        pan=${this.getAttribute("pan-l")}
        mute="${this.getAttribute("mute-l")}"
        solo="${this.getAttribute("solo-l")}"
        hpf-available="${this.getAttribute("hpf-available")}"
        hpf-enabled="${this.getAttribute("hpf-l-enabled")}"
        invert-phase-enabled="${this.getAttribute("invert-phase-l-enabled")}"
      ></channel-strip>
      <channel-strip
        type="analog"
        channel-id=${this.getAttribute("channel-id-r")}
        title="${this.getAttribute("title-r")}"
        phantom-power-available=${
          this.getAttribute("phantom-power-available") === "true"
        }
        phantom-power-enabled=${this.getAttribute("phantom-power-enabled")}
        active-mix=${activeMix}
        volume=${this.getAttribute("volume-r")}
        pan=${this.getAttribute("pan-r")}
        mute="${this.getAttribute("mute-r")}"
        solo="${this.getAttribute("solo-r")}"
        hpf-available="${this.getAttribute("hpf-available")}"
        hpf-enabled="${this.getAttribute("hpf-r-enabled")}"
        invert-phase-enabled="${this.getAttribute("invert-phase-r-enabled")}"
      ></channel-strip>
    </div>`;

    render(template, this);
  }
});
