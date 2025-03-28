import { html, render, live } from "../lit.js";

customElements.define(
  "interface-settings",
  class InterfaceSettings extends HTMLElement {
    constructor() {
      super();
    }

    async connectedCallback() {
      this.render();
    }

    render() {
      const params = this.device.settings;

      const template = html`
      <h2>Interface settings</h2>

      <div class="settings horizontal">
        <div class="setting">
          <label class="select-label" for="phones-2-output-select">
            Phones 2 output
          </label>
          <select id="phones-2-output-select"
            @change=${(e) => {
              params.Phones2Output = parseInt(e.target.value);
              this.device.updateParamValue(
                "Phones2Output",
                parseInt(e.target.value),
              );
            }}
            .value=${live(params.Phones2Output)}
          >
            <option value="0">Mix 1</option>
            <option value="1">Mix 2</option>
          </select>
        </div>
        <div class="setting">
          <label class="select-label" for="input-56-level-select">
            Input 5/6 level
          </label>
          <select id="input-56-level-select"
            @change=${(e) => {
              this.device.updateParamValue(
                "Input45Level",
                parseInt(e.target.value),
              );
            }}
            .value=${live(params.Input45Level)}
          >
            <option value="1">-10dBV</option>
            <option value="0">+4dBu</option>
          </select>
        </div>
        <div class="setting">
          <label class="select-label" for="hpf-select">
            HPF
          </label>
          <select
            id="hpf-select"
            @change=${(e) => {
              const value = parseInt(e.target.value);
              this.device.updateParamValue("InputHPFSetting", value);
            }}
            .value=${live(params.InputHPFSetting)}
          >
            <option value="0">40 Hz</option>
            <option value="1">60 Hz</option>
            <option value="2">80 Hz</option>
            <option value="3">100 Hz</option>
            <option value="4">120 Hz</option>
          </select>
        </div>
        <div class="setting">
          <label>
            <input
              type="checkbox"
              .checked=${live(params.Loopback === 1)}
              @change=${(e) => {
                this.device.updateParamValue(
                  "Loopback",
                  e.target.checked ? 1 : 0,
                );
              }}
            >
            Loopback of DAW signal to Inputs 1/2
        </div>
      </div>
      `;

      render(template, this);
    }
  },
);
