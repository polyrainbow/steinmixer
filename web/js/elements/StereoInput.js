import { html, live, render } from "../lit.js";

/*
  A pair of adjacent analog inputs. When linked, the device treats both as
  one stereo channel (it mirrors level, mute, solo, HPF and reverb send), so
  we show a single stereo channel with separate phase and pan for L and R.
*/
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

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const attr = (name) => this.getAttribute(name);
    const activeMix = attr("active-mix");
    const linked = parseInt(attr("link-inputs")) === 1;
    this.classList.toggle("linked", linked);

    const strip = (side) => html`<channel-strip
      .device=${this.device}
      type="analog"
      channel-id=${attr(`channel-id-${side}`)}
      title=${attr(`title-${side}`)}
      phantom-power-available=${attr("phantom-power-available") === "true"}
      phantom-power-enabled=${attr("phantom-power-enabled")}
      active-mix=${activeMix}
      volume=${attr(`volume-${side}`)}
      pan=${attr(`pan-${side}`)}
      mute=${attr(`mute-${side}`)}
      solo=${attr(`solo-${side}`)}
      hpf-available=${attr("hpf-available")}
      hpf-enabled=${attr(`hpf-${side}-enabled`)}
      invert-phase-enabled=${attr(`invert-phase-${side}-enabled`)}
      reverb-send=${attr(`reverb-send-${side}`)}
    ></channel-strip>`;

    const stereoStrip = html`<channel-strip
      .device=${this.device}
      type="stereo"
      channel-id=${attr("channel-id-l")}
      channel-id-r=${attr("channel-id-r")}
      title="${attr("title-l")}/${attr("title-r").replace(/^\D+/, "")}"
      phantom-power-available=${attr("phantom-power-available") === "true"}
      phantom-power-enabled=${attr("phantom-power-enabled")}
      active-mix=${activeMix}
      volume=${attr("volume-l")}
      pan=${attr("pan-l")}
      pan-r=${attr("pan-r")}
      mute=${attr("mute-l")}
      solo=${attr("solo-l")}
      hpf-available=${attr("hpf-available")}
      hpf-enabled=${attr("hpf-l-enabled")}
      invert-phase-enabled=${attr("invert-phase-l-enabled")}
      invert-phase-r-enabled=${attr("invert-phase-r-enabled")}
      reverb-send=${attr("reverb-send-l")}
    ></channel-strip>`;

    const template = html`
    <div class="stereo-toggle">
      <label title="Link channels">
        <input
          name="link-inputs-${attr("channel-id-l")}"
          type="checkbox"
          .checked=${live(linked)}
          @change=${(e) => {
            this.dispatchEvent(new CustomEvent("link-channels", {
              bubbles: true,
              detail: {
                linked: e.target.checked ? 1 : 0,
                channelIdL: attr("channel-id-l"),
              },
            }));
          }}
        >
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true">
          <circle cx="35" cy="50" r="15" stroke="black" stroke-width="5"
            fill="none"></circle>
          <line x1="35" y1="50" x2="65" y2="50" stroke="black"
            stroke-width="10" fill="none"></line>
          <circle cx="65" cy="50" r="15" stroke="black" stroke-width="5"
            fill="none"></circle>
        </svg>
        <span>Link channels</span>
      </label>
    </div>
    <div class="strips-container">
      ${linked ? stereoStrip : html`${strip("l")}${strip("r")}`}
    </div>`;

    render(template, this);
  }
});
