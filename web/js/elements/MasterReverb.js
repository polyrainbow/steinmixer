import { html, render, live } from "../lit.js";
import { updateParamValue } from "../UR44/index.js";
import { getDBFSLabel } from "../utils.js";

customElements.define("master-reverb", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = [
    "active-mix",
    "volume",
    "output-mix",
  ];

  attributeChangedCallback(name, oldValue, newValue) {
    if (["active-mix", "volume", "output-mix"].includes(name)) {
      this.render();
    }
  }

  connectedCallback() {
    this.classList.add("side-panel");
    this.render();
  }

  render() {
    const template = html`
      <h2>Reverb</h2>
      <section class="settings">
      <label>
        Output Mix
        <select
          @change=${(e) => {
            const value = e.target.value;
            updateParamValue("ReverbOutputMix", parseInt(value));
          }}
          .value=${live(this.getAttribute("output-mix"))}
        >
          <option value="0">Mix 1</option>
          <option value="1">Mix 2</option>
        </select>
      </label>
      <label>
        Return level (Mix ${parseInt(this.getAttribute("active-mix")) + 1})
        <input
          type="range"
          min="0"
          max="127"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            updateParamValue(
              `ReverbMix${
                parseInt(this.getAttribute("active-mix")) + 1}Volume`,
              parseInt(value),
            );
          }}
          .value=${live(this.getAttribute("volume"))}
        >
      </label>
      <label>
        Type
        <select
          @change=${(e) => {
            const value = e.target.value;
            updateParamValue("ReverbType", parseInt(value));
          }}
          .value=${live(this.getAttribute("type"))}
        >
          <option value="0">Hall</option>
          <option value="1">Room</option>
          <option value="2">Plate</option>
        </select>
      </label>
      <label>
        Time
        <input
          type="range"
          min="0"
          max="69"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            updateParamValue("ReverbTime", parseInt(value));
          }}
          .value=${live(this.getAttribute("time"))}
        >
      </label>
      <label>
        Initial Delay
        <input
          type="range"
          min="0"
          max="127"
          step="1"
          @input=${(e) => {
            const value = e.target.value;
            updateParamValue("ReverbInitialDelay", parseInt(value));
          }}
          .value=${live(this.getAttribute("initial-delay"))}
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
            updateParamValue("ReverbDecay", parseInt(value));
          }}
          .value=${live(this.getAttribute("decay"))}
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
            updateParamValue("ReverbRoomSize", parseInt(value));
          }}
          .value=${live(this.getAttribute("room-size"))}
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
            updateParamValue("ReverbDiffusion", parseInt(value));
          }}
          .value=${live(this.getAttribute("diffusion"))}
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
            updateParamValue("ReverbHPF", parseInt(value));
          }}
          .value=${live(this.getAttribute("hpf"))}
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
            updateParamValue("ReverbLPF", parseInt(value));
          }}
          .value=${live(this.getAttribute("lpf"))}
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
            updateParamValue("ReverbHiRatio", parseInt(value));
          }}
          .value=${live(this.getAttribute("high-ratio"))}
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
            updateParamValue("ReverbLowRatio", parseInt(value));
          }}
          .value=${live(this.getAttribute("low-ratio"))}
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
            updateParamValue("ReverbLowFreq", parseInt(value));
          }}
          .value=${live(this.getAttribute("low-freq"))}
        >
      </label>
    </section>
    `;

    render(template, this);
  }
});
