import { html, live, render } from "../lit.js";

customElements.define("stereo-input", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = [
    "link-inputs",
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
    "reverb-send-l",
    "reverb-send-r",
  ];

  attributeChangedCallback(name, oldValue, newValue) {
    // Somehow the parent element rendering breaks if we just call this.render()
    // here without check for elements that are really updated during element
    // lifetime
    if ([
      "link-inputs",
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
      "reverb-send-l",
      "reverb-send-r",
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
    <div class="stereo-toggle">
      <label title="Link channels">
        <input
          type="checkbox"
          .checked=${live(parseInt(this.getAttribute("link-inputs")) === 1)}
          @change=${(e) => {
            this.dispatchEvent(new CustomEvent("link-channels", {
              detail: {
                linked: e.target.checked ? 1 : 0,
                channelIdL: this.getAttribute("channel-id-l"),
              },
            }));
          }
        }>
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle
                cx="35" cy="50" r="15" stroke="black"
                stroke-width="5" fill="none"
              >
              </circle>
              <line x1="35" y1="50" x2="65" y2="50" stroke="black"
                stroke-width="10" fill="none"
              ></line>
              <circle
                cx="65" cy="50" r="15" stroke="black"
                stroke-width="5" fill="none"
              >
              </circle>
          </svg>
          <span>Link channels</span>
      </label>
    </div>
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
        reverb-send="${this.getAttribute("reverb-send-l")}"
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
        volume=${
          parseInt(this.getAttribute("link-inputs")) === 1
            ? this.getAttribute("volume-l")
            : this.getAttribute("volume-r")
        }
        pan=${this.getAttribute("pan-r")}
        mute="${this.getAttribute("mute-r")}"
        solo="${this.getAttribute("solo-r")}"
        hpf-available="${this.getAttribute("hpf-available")}"
        hpf-enabled="${this.getAttribute("hpf-r-enabled")}"
        invert-phase-enabled="${this.getAttribute("invert-phase-r-enabled")}"
        reverb-send="${this.getAttribute("reverb-send-r")}"
      ></channel-strip>
    </div>`;

    render(template, this);
  }
});
