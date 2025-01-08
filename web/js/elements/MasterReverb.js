import { html, render, live } from "../lit.js";
import { getDBFSLabel } from "../utils.js";

const REVERB_TIME_VALUES = [
  0.520,
  0.694,
  0.867,
  1.04,
  1.21,
  1.39,
  1.56,
  1.73,
  1.91,
  2.08,
  2.25,
  2.43,
  2.60,
  2.77,
  2.95,
  3.12,
  3.30,
  3.47,
  3.64,
  3.82,
  3.99,
  4.16,
  4.34,
  4.51,
  4.68,
  4.86,
  5.03,
  5.20,
  5.38,
  5.55,
  5.72,
  5.90,
  6.07,
  6.24,
  6.42,
  6.59,
  6.76,
  6.94,
  7.11,
  7.28,
  7.46,
  7.63,
  7.80,
  7.98,
  8.15,
  8.32,
  8.50,
  8.67,
  9.54,
  10.4,
  11.3,
  12.1,
  13.0,
  13.9,
  14.7,
  15.6,
  16.5,
  17.3,
  19.1,
  20.8,
  22.5,
  24.3,
  26.0,
  27.7,
  29.5,
  31.2,
  32.9,
  34.7,
  43.3,
  52.0,
];

customElements.define("master-reverb", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = [
    "active-mix",
  ];

  attributeChangedCallback(name, oldValue, newValue) {
    this.render();
  }

  connectedCallback() {
    this.classList.add("side-panel");
    this.render();
  }

  render() {
    const mix = this.getAttribute("active-mix");
    const settings = this.device.settings;

    const template = html`
      <h2>Reverb</h2>
      <section class="settings">
      <label>
        Input Mix
        <span class="description">
          The sends of the selected mix will be fed into the reverb
        </span>
        <select
          @change=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbInputMix", parseInt(value));
          }}
          .value=${live(settings.ReverbInputMix)}
        >
          <option value="0">Mix 1</option>
          <option value="1">Mix 2</option>
        </select>
      </label>
      <div>
        <label>
          Return level (Mix ${parseInt(mix) + 1})
          <input
            type="range"
            min="0"
            max="127"
            step="1"
            @input=${(e) => {
              const value = e.target.value;
              this.device.updateParamValue(
                `Mix${
                  parseInt(mix)
                }ReverbVolume`,
                parseInt(value),
              );
              this.render();
            }}
            .value=${live(this.device.settings[`Mix${mix}ReverbVolume`])}
          >
        </label>
        <span>${
          getDBFSLabel(
            this.device.settings[`Mix${mix}ReverbVolume`],
            val => this.device.getDBFSFromSliderValue(val),
          )
        }</span>
      </div>
      <label>
        Type
        <select
          @change=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbType", parseInt(value));
          }}
          .value=${live(settings.ReverbType)}
        >
          <option value="0">Hall</option>
          <option value="1">Room</option>
          <option value="2">Plate</option>
        </select>
      </label>
      <div>
        <label>
          Time
          <input
            type="range"
            min="0"
            max="69"
            step="1"
            @input=${(e) => {
              const value = e.target.value;
              this.device.updateParamValue("ReverbTime", parseInt(value));
              this.render();
            }}
            .value=${live(this.device.settings.ReverbTime)}
          >
          <span>${
            REVERB_TIME_VALUES[this.device.settings[`ReverbTime`]]
          }s</span>
        </label>
      </div>
      <label>
        Initial Delay
        <input
          type="range"
          min="0"
          max="127"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue(
              "ReverbInitialDelay",
              parseInt(value),
            );
          }}
          .value=${live(settings.ReverbInitialDelay)}
        >
      </label>
      <label>
        Decay
        <input
          type="range"
          min="0"
          max="63"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbDecay", parseInt(value));
          }}
          .value=${live(settings.ReverbDecay)}
        >
      </label>
      <label>
        Room Size
        <input
          type="range"
          min="0"
          max="31"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbRoomSize", parseInt(value));
          }}
          .value=${live(settings.ReverbRoomSize)}
        >
      </label>
      <label>
        Diffusion
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbDiffusion", parseInt(value));
          }}
          .value=${live(settings.ReverbDiffusion)}
        >
      </label>
      <label>
        HPF
        <input
          type="range"
          min="0"
          max="52"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbHPF", parseInt(value));
          }}
          .value=${live(settings.ReverbHPF)}
        >
      </label>
      <label>
        LPF
        <input
          type="range"
          min="34"
          max="60"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbLPF", parseInt(value));
          }}
          .value=${live(settings.ReverbLPF)}
        >
      </label>
      <label>
        Hi Ratio
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbHighRatio", parseInt(value));
          }}
          .value=${live(settings.ReverbHighRatio)}
        >
      </label>
      <label>
        Low Ratio
        <input
          type="range"
          min="1"
          max="14"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbLowRatio", parseInt(value));
          }}
          .value=${live(settings.ReverbLowRatio)}
        >
      </label>
      <label>
        Low Freq
        <input
          type="range"
          min="1"
          max="59"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            this.device.updateParamValue("ReverbLowFreq", parseInt(value));
          }}
          .value=${live(settings.ReverbLowFreq)}
        >
      </label>
    </section>
    `;

    render(template, this);
  }
});
