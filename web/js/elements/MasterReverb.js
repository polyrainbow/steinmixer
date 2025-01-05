import { html, render, live } from "../lit.js";

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
            this.device.updateParamValue("ReverbOutputMix", parseInt(value));
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
            this.device.updateParamValue(
              `Mix${
                parseInt(this.getAttribute("active-mix"))
              }ReverbVolume`,
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
            this.device.updateParamValue("ReverbType", parseInt(value));
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
            this.device.updateParamValue("ReverbTime", parseInt(value));
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
            this.device.updateParamValue(
              "ReverbInitialDelay",
              parseInt(value),
            );
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
            this.device.updateParamValue("ReverbDecay", parseInt(value));
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
            this.device.updateParamValue("ReverbRoomSize", parseInt(value));
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
            this.device.updateParamValue("ReverbDiffusion", parseInt(value));
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
            this.device.updateParamValue("ReverbHPF", parseInt(value));
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
            this.device.updateParamValue("ReverbLPF", parseInt(value));
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
            this.device.updateParamValue("ReverbHighRatio", parseInt(value));
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
            this.device.updateParamValue("ReverbLowRatio", parseInt(value));
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
            this.device.updateParamValue("ReverbLowFreq", parseInt(value));
          }}
          .value=${live(this.getAttribute("low-freq"))}
        >
      </label>
    </section>
    `;

    render(template, this);
  }
});
