import { html, render, live } from "../lit.js";

const AMP_OPTIONS = ["clean", "crunch", "lead", "drive"];

const phaseIcon = html`
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" stroke="black" stroke-width="10" fill="none">
    </circle>
    <path d="M 10 90 L 90 10" stroke="black" stroke-width="10" fill="none">
    </path>
  </svg>`;

const hpfIcon = html`
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M 10 70 L 35 30 L 90 30" stroke="black" stroke-width="10"
      fill="none"></path>
  </svg>`;

/*
  Meters and input controls (phase, HPF, effect) of a channel.
  type: "analog" (mono input), "stereo" (linked input pair), "daw", "master"
*/
customElements.define("fx-section", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = [
    "type",
    "channel-id",
    "channel-id-r",
    "subchannel-id-l",
    "subchannel-id-r",
    "hpf-available",
    "hpf-enabled",
    "invert-phase-enabled",
    "invert-phase-r-enabled",
  ];

  busy = false;
  error = "";

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  connectedCallback() {
    this.render();
  }

  #dispatch(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  async #changeFx(channelIndex, value, mode) {
    const device = this.device;
    this.busy = true;
    this.error = "";
    this.render();
    try {
      if (value === "off") {
        await device.setFX(channelIndex, "off");
      } else if (value === "channel-strip") {
        await device.setFX(channelIndex, "channel-strip", mode);
      } else {
        await device.setFX(
          channelIndex, "amp", mode, AMP_OPTIONS.indexOf(value),
        );
      }
    } catch (e) {
      console.error(e);
      this.error = e.message;
    } finally {
      this.busy = false;
      this.#dispatch("fx-changed", { channelIndex });
    }
  }

  #phaseButton(channelId, enabled, label) {
    return html`<button
      class="invert-phase-button ${enabled ? "enabled" : ""}"
      aria-pressed=${enabled ? "true" : "false"}
      @click=${() => this.#dispatch("toggle-invert-phase", { channelId })}
      title=${label}
      aria-label=${label}
    >${phaseIcon}</button>`;
  }

  #fxControls(channelId) {
    const device = this.device;
    const channelIndex = device.getChannelIndexFromChannelId(channelId);
    const fxState = device.fxState[channelIndex];
    if (!fxState) return "";
    const fxType = fxState.type;
    const fxMode = fxState.mode ?? "insert";
    const fxAvailable = device.fxAvailable;
    const ampDisabled = !device.canSetFx("amp", channelIndex);
    const ampType = device.settings.AmpType;
    const title = fxAvailable
      ? (fxState.stereo ? "Stereo effect" : "Effect")
      : "Effects are not available at 176.4/192 kHz";

    const option = (value, label, disabled, selected) => html`<option
      value=${value}
      .disabled=${disabled}
      .selected=${live(selected)}
    >${label}</option>`;

    return html`
      <select
        class="fx-select"
        name="fx-select-${channelId}"
        title=${title}
        aria-label=${title}
        .disabled=${this.busy || (!fxAvailable && fxType === "off")}
        @change=${(e) => this.#changeFx(channelIndex, e.target.value, fxMode)}
      >
        ${option("off", "Off", false, fxType === "off")}
        ${option(
          "channel-strip",
          fxState.stereo ? "Ch. Strip (ST)" : "Channel Strip",
          !device.canSetFx("channel-strip", channelIndex),
          fxType === "channel-strip",
        )}
        ${AMP_OPTIONS.map((value, i) => option(
          value,
          value[0].toUpperCase() + value.slice(1),
          ampDisabled,
          fxType === "amp" && ampType === i,
        ))}
      </select>
      <select
        class="fx-mode-select"
        name="fx-mode-select-${channelId}"
        aria-label="Effect insertion point"
        title="INS.FX: monitor and recording, MON.FX: monitor only"
        .disabled=${this.busy || fxType === "off"}
        @change=${(e) => {
          const value = fxType === "amp"
            ? AMP_OPTIONS[ampType]
            : fxType;
          this.#changeFx(channelIndex, value, e.target.value);
        }}
      >
        <option value="insert" .selected=${live(fxMode === "insert")}>Ins.</option>
        <option value="monitor" .selected=${live(fxMode === "monitor")}>Mon.</option>
      </select>
      ${this.error
        ? html`<span class="fx-error" role="alert" title=${this.error}>
          Not applied</span>`
        : ""}`;
  }

  render() {
    if (!this.device) return;
    const type = this.getAttribute("type");
    const isInput = type === "analog" || type === "stereo";
    const meterIds = type === "analog"
      ? [this.getAttribute("channel-id")]
      : type === "stereo"
        ? [this.getAttribute("channel-id"), this.getAttribute("channel-id-r")]
        : [
          this.getAttribute("subchannel-id-l"),
          this.getAttribute("subchannel-id-r"),
        ];
    const channelId = this.getAttribute("channel-id");
    const isEnabled = (name) => parseInt(this.getAttribute(name)) === 1;

    const template = html`
    ${meterIds.map((id) => html`<vu-meter
      .device=${this.device}
      channel-id=${id}
    ></vu-meter>`)}
    ${isInput
      ? html`<div class="controls">
        ${type === "stereo"
          ? html`<div class="phase-pair">
            ${this.#phaseButton(
              channelId, isEnabled("invert-phase-enabled"), "Invert phase L",
            )}
            ${this.#phaseButton(
              this.getAttribute("channel-id-r"),
              isEnabled("invert-phase-r-enabled"),
              "Invert phase R",
            )}
          </div>`
          : this.#phaseButton(
            channelId, isEnabled("invert-phase-enabled"), "Invert phase",
          )}
        ${this.getAttribute("hpf-available") === "true"
          ? html`<button
            class="hpf-button ${isEnabled("hpf-enabled") ? "enabled" : ""}"
            aria-pressed=${isEnabled("hpf-enabled") ? "true" : "false"}
            @click=${() => this.#dispatch("toggle-hpf", { channelId })}
            title="High Pass Filter"
            aria-label="High Pass Filter"
          >${hpfIcon}</button>`
          : ""}
        ${this.#fxControls(channelId)}
      </div>`
      : ""}
    `;

    render(template, this);
  }
});
