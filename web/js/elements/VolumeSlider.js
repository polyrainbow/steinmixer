import { html, render, live } from "../lit.js";
import { getDBFSLabel } from "../utils.js";

customElements.define("volume-slider", class extends HTMLElement {
  constructor() {
    super();
  }


  static observedAttributes = [
    "phantom-power-enabled",
    "active-mix",
    "mute",
    "solo",
    "volume",
  ];

  attributeChangedCallback(name, oldValue, newValue) {
    if ([
      "phantom-power-enabled",
      "active-mix",
      "mute",
      "solo",
      "volume",
    ].includes(name)) {
      this.render();
    }

    if (name === "volume") {
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const channelId = this.getAttribute("channel-id");
    const mix = this.getAttribute("active-mix");
    const volume = parseInt(this.getAttribute("volume"));
    const muted = this.getAttribute("mute") === "0";
    const soloed = this.getAttribute("solo") === "1";

    const handleMuteClick = () => {
      this.dispatchEvent(new CustomEvent("mute", {
        detail: {
          muted: !muted,
          channelId,
          mix,
        },
      }));

      this.render();
    };

    const handleSoloClick = () => {
      this.dispatchEvent(new CustomEvent("solo", {
        detail: {
          soloed: !soloed,
          channelId,
          mix,
        },
      }));

      this.render();
    };

    const handleInput = (e) => {
      const newVolume = parseInt(e.target.value);

      this.dispatchEvent(new CustomEvent("volume", {
        detail: {
          volume: newVolume,
          channelId,
          mix,
        },
      }));

      this.render();
    };

    const handleDblClick = (e) => {
      const volume = 103;

      this.dispatchEvent(new CustomEvent("volume", {
        detail: {
          volume,
          channelId,
          mix,
        },
      }));

      this.render();
    };

    const template = html`
    <div class="buttons">
      <button
        class="mute-button ${muted ? "active" : ""}"
        @click=${handleMuteClick}
      >M</button>
      ${
        this.getAttribute("type") !== "master"
          ? html`<button 
            class="solo-button ${soloed ? "active" : ""}"
            @click=${handleSoloClick}
          >S</button>`
          : ""
      }
      ${
        this.getAttribute("phantom-power-available") === "true"
          ? html`<div
            class="phantom-voltage-indicator ${
              this.getAttribute("phantom-power-enabled") === "1"
                ? "enabled"
                : ""
            }"
          ></div>
          <span class="phantom-voltage-indicator-label">+48V</span>`
          : ""
      }
    </div>
    <input
      class="volume-slider"
      type="range"
      max="127"
      min="0"
      .value=${live(volume)}
      @input=${handleInput}
      @dblclick=${handleDblClick}
    >
    <span class="volume-level">${
      getDBFSLabel(volume, val => this.device.getDBFSFromSliderValue(val))
    }</span>`;

    render(template, this);
  }
});
