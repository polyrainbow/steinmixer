import { html, render, live } from "../lit.js";
import { getDBFSLabel } from "../utils.js";


/*
  Reverb time range depends on room size and reverb type.
  There are always 70 possible values which depend on the maximum value for the
  combination of reverb type (hall, room, plate) and room size (1-10).
  There are 5 key indexes where the values is given: 0, 47, 57, 67, 69
  See also the graph in docs/reverb-time-range-example.png for a visualization.
  Between the key indexes, the values are linearly interpolated.
*/
const getReverbTime = (MAX, x) => {
  if (x < 0 || x > 69) {
      throw new Error("x is out of range: " + x);
  }

  const MIN = MAX / 100;
  const RANGE = MAX - MIN;
  // between special indexes, we linearly interpolate
  const KEY_INDEXES = [
    [0, MIN],
    [47, MIN + RANGE * 0.15832],
    [57, MIN + RANGE * 0.325952],
    [67, MIN + RANGE * 0.66395],
    [69, MAX],
  ];

  if (x === 0) {
    return KEY_INDEXES[0][1];
  }

  for (let i = 1; i < KEY_INDEXES.length; i++) {
    const previousKeyIndex = KEY_INDEXES[i - 1][0];
    const previousKeyValue = KEY_INDEXES[i - 1][1];

    const keyIndexEntry = KEY_INDEXES[i];
    const keyIndex = keyIndexEntry[0];
    const keyIndexValue = keyIndexEntry[1];
    if (x === keyIndex) {
      return keyIndexValue;
    } else if (x < keyIndex) {
      // linear interpolation between last and current key index
      const indexRange = keyIndex - previousKeyIndex;
      const xInRange = x - previousKeyIndex;
      const interpolationNormalized = xInRange / indexRange;
      const valueRange = keyIndexValue - previousKeyValue;
      const value = interpolationNormalized * valueRange + previousKeyValue;
      return value;
    } else {
      continue;
    }
  }
}


const REVERB_INITIAL_DELAY_VALUES = [

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
        <span>${
          REVERB_INITIAL_DELAY_VALUES[
            this.device.settings[`ReverbInitialDelay`]
          ]
        }s</span>
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
