import { canSetFx } from "../devices/UR44.js";
import { html, render } from "../lit.js";

customElements.define("fx-section", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = [
    "type",
    "channel-id",
    "subchannel-id-l",
    "subchannel-id-r",
    "hpf-available",
    "hpf-enabled",
    "invert-phase-enabled",
  ];

  attributeChangedCallback() {
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const type = this.getAttribute("type");

    const channelId = type !== "analog"
      ? this.getAttribute("subchannel-id-l")
      : this.getAttribute("channel-id");

    let fxType;
    let fxMode;

    const channelIndex = this.device.getChannelIndexFromChannelId(channelId);

    if (channelIndex !== -1) {
      const fxState = this.device.fxState[channelIndex];
      fxType = fxState.type;
      fxMode = fxState.mode ?? null;
    }

    const ampOptionsDisabled = !canSetFx(
      "amp",
      channelIndex,
      this.device.fxState.map((fx) => fx.type),
    );

    const template = html`
    <vu-meter
      .device=${this.device}
      channel-id=${channelId}
    ></vu-meter>
    ${
      type !== "analog"
        ? html`<vu-meter
          .device=${this.device}
          channel-id=${this.getAttribute("subchannel-id-r")}
        ></vu-meter>`
        : ""
    }
    ${
      type === "analog"
        ? html`<div class="controls">
          <button
            class="invert-phase-button ${
              parseInt(this.getAttribute("invert-phase-enabled")) === 1
                ? "enabled"
                : ""
            }"
            @click=${() => {
              this.dispatchEvent(new CustomEvent("toggle-invert-phase", {
                detail: {
                  "channelId": channelId,
                },
              }));
            }}
            title="Invert Phase"
          >
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle
                cx="50" cy="50" r="35" stroke="black"
                stroke-width="10" fill="none"
              >
              </circle>
              <path d="M 10 90 L 90 10"
                stroke="black"
                stroke-width="10"
                fill="none"></path>
            </svg>
          </button>
          ${
            this.getAttribute("hpf-available") === "true"
              ? html`<button
                class="hpf-button ${
                  parseInt(this.getAttribute("hpf-enabled")) === 1
                    ? "enabled"
                    : ""
                }"
                @click=${() => {
                  this.dispatchEvent(new CustomEvent("toggle-hpf", {
                    detail: {
                      channelId,
                    },
                  }));
                }}
                title="High Pass Filter"
              >
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 10 70 L 35 30 L 90 30"
                    stroke="black"
                    stroke-width="10"
                    fill="none"></path>
                </svg>
              </button>`
              : ""
          }
          <select
            class="fx-select"
            name="fx-select-${channelId}"
            @change=${(e) => {
              const value = e.target.value;
              switch (value) {
                case "off":
                  this.device.setFX(channelIndex, "off");
                  break;
                case "channel-strip":
                  this.device.setFX(channelIndex, "channel-strip", fxMode);
                  break;
                case "clean":
                case "crunch":
                case "lead":
                case "drive":
                  this.device.setFX(channelIndex, "amp", fxMode);
                  this.device.updateParamValue(
                    "AmpType",
                    {
                      "clean": 0,
                      "crunch": 1,
                      "lead": 2,
                      "drive": 3,
                    }[value],
                  );
                  break;
                default:
                  console.error("Unknown FX type: " + value);
              }
              this.closest("stein-mixer").render();
              document.querySelectorAll("fx-section,channel-fx")
                .forEach((fxSection) => {
                  fxSection.render();
                });

            }}
          >
            <option
              value="off"
              .selected=${fxType === "off"}
            >
              Off
            </option>
            <option
              value="channel-strip"
              .disabled=${
                !canSetFx(
                  "channel-strip",
                  channelIndex,
                  this.device.fxState.map((fx) => fx.type),
                )
              }
              .selected=${fxType === "channel-strip"}
            >
              Channel Strip
            </option>
            <option
              value="clean"
              .disabled=${ampOptionsDisabled}
              .selected=${
                fxType === "amp"
                && this.device.settings["AmpType"] === 0
              }
            >
              Clean
            </option>
            <option
              value="crunch"
              .disabled=${ampOptionsDisabled}
              .selected=${
                fxType === "amp"
                && this.device.settings["AmpType"] === 1
              }
            >
              Crunch
            </option>
            <option
              value="lead"
              .disabled=${ampOptionsDisabled}
              .selected=${
                fxType === "amp"
                && this.device.settings["AmpType"] === 2
              }
            >
              Lead
            </option>
            <option
              value="drive"
              .disabled=${ampOptionsDisabled}
              .selected=${
                fxType === "amp"
                && this.device.settings["AmpType"] === 3
              }
            >
              Drive
            </option>
          </select>
          <select
            class="fx-mode-select"
            name="fx-mode-select-${channelId}"
            @change=${(e) => {
              const fxMode = e.target.value;
              this.device.setFX(channelIndex, fxType, fxMode);
              this.closest("stein-mixer").render();
            }}
          >
            <option
              value="insert"
              .selected=${fxMode === "insert"}
            >Insert</option>
            <option
              value="monitor"
              .selected=${fxMode === "monitor"}
            >Monitor</option>
          </select>
        </div>`
      : ""
    }
    `;

    render(template, this);
  }
});
