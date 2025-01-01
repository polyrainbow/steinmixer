import {
  init as initUR44,
  selectActiveMix,
  updateParamValue,
} from "../UR44/index.js";
import "./StereoInput.js";
import { html, render, live } from "../lit.js";
import { getChannelIndexFromChannelId } from "../UR44/utils.js";

const DEBUG_MODE = false;

customElements.define("stein-mixer", class SteinMixer extends HTMLElement {
  constructor() {
    super();
  }

  status = "loading";
  params;
  activeMix = 0;

  async connectedCallback() {
    this.render();

    const messageHandler = (message) => {
      if (message.type === "change-parameter") {
        if (message.param === 40) {
          if (message.channel === 0) {
            this.params.phantomPower0 = message.value;
          } else if (message.channel === 1) {
            this.params.phantomPower1 = message.value;
          }
        }
        this.render();
      }
    };

    if (DEBUG_MODE) {
      this.status = "ready";
      this.params = {};
      this.render();
      return;
    }

    try {
      this.params = await initUR44(messageHandler);
      this.status = "ready";
      this.render();

      Array.from(document.querySelectorAll("stereo-input"))
        .forEach(si => {
          si.addEventListener("link-channels", (e) => {
            const paramKey = `input${
              getChannelIndexFromChannelId(e.detail.channelIdL)
            }Linked`;
            const newValue = e.detail.linked;
            this.params[paramKey] = newValue;
            updateParamValue("InputLink", newValue, e.detail.channelIdL);
          });
        });

      Array.from(document.querySelectorAll("volume-slider"))
        .forEach(vs => {
          vs.addEventListener("volume", (e) => {
            if (e.detail.channelId === "daw") {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }DawVolume`;
              this.params[paramKey] = e.detail.volume;
              updateParamValue(
                `DAWMix${parseInt(e.detail.mix) + 1}Volume`,
                e.detail.volume,
              );
            } else if (e.detail.channelId === "master") {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }MainVolume`;
              this.params[paramKey] = e.detail.volume;
              updateParamValue(
                `MainMix${parseInt(e.detail.mix) + 1}Volume`,
                e.detail.volume,
              );
            } else {
              // TODO: handle linked volume slider r
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }Input${getChannelIndexFromChannelId(e.detail.channelId)}Volume`;
              this.params[paramKey] = e.detail.volume;
              updateParamValue(
                `InputMix${parseInt(e.detail.mix) + 1}Volume`,
                e.detail.volume,
                e.detail.channelId,
              );
            }
            this.render();
          });

          vs.addEventListener("mute", (e) => {
            if (e.detail.channelId === "daw") {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }DawMute`;
              this.params[paramKey] = e.detail.muted ? 0 : 1;
              updateParamValue(
                `DAWMix${parseInt(e.detail.mix) + 1}Mute`,
                e.detail.muted ? 0 : 1,
              );
            } else if (e.detail.channelId === "master") {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }MainMute`;
              this.params[paramKey] = e.detail.muted ? 0 : 1;
              updateParamValue(
                `MainMix${parseInt(e.detail.mix) + 1}Mute`,
                e.detail.muted ? 0 : 1,
              );
            } else {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }Input${getChannelIndexFromChannelId(e.detail.channelId)}Mute`;
              this.params[paramKey] = e.detail.muted ? 0 : 1;
              updateParamValue(
                `InputMix${parseInt(e.detail.mix) + 1}Mute`,
                e.detail.muted ? 0 : 1,
                e.detail.channelId,
              );
            }
            this.render();
          });

          vs.addEventListener("solo", (e) => {
            if (e.detail.channelId === "daw") {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }DawSolo`;
              this.params[paramKey] = e.detail.soloed ? 1 : 0;
              updateParamValue(
                `DAWMix${parseInt(e.detail.mix) + 1}Solo`,
                e.detail.soloed ? 1 : 0,
              );
            } else if (e.detail.channelId === "master") {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }MasterSolo`;
              this.params[paramKey] = e.detail.soloed ? 1 : 0;
              updateParamValue(
                `MainMix${parseInt(e.detail.mix) + 1}Solo`,
                e.detail.soloed ? 1 : 0,
              );
            } else {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }Input${getChannelIndexFromChannelId(e.detail.channelId)}Solo`;
              this.params[paramKey] = e.detail.soloed ? 1 : 0;
              updateParamValue(
                `InputMix${parseInt(e.detail.mix) + 1}Solo`,
                e.detail.soloed ? 1 : 0,
                e.detail.channelId,
              );
            }
            this.render();
          });
        });

      Array.from(document.querySelectorAll("pan-slider"))
        .forEach(ps => {
          ps.addEventListener("pan", (e) => {
            if (e.detail.channelId === "daw") {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }DawPan`;
              this.params[paramKey] = e.detail.pan;
              console.log(paramKey, this.params[paramKey], e.detail.pan);
              updateParamValue(
                `DAWMix${parseInt(e.detail.mix) + 1}Pan`,
                e.detail.pan,
              );
            } else if (e.detail.channelId === "master") {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }MainPan`;
              this.params[paramKey] = e.detail.pan;
              updateParamValue(
                `MainMix${parseInt(e.detail.mix) + 1}Pan`,
                e.detail.pan,
              );
            } else {
              const paramKey = `mix${
                parseInt(e.detail.mix) + 1
              }Input${getChannelIndexFromChannelId(e.detail.channelId)}Pan`;
              this.params[paramKey] = e.detail.pan;
              updateParamValue(
                `InputMix${parseInt(e.detail.mix) + 1}Pan`,
                e.detail.pan,
                e.detail.channelId,
              );
            }
            this.render();
          });
        });

      Array.from(document.querySelectorAll("fx-section"))
        .forEach(fxSection => {
          fxSection.addEventListener("toggle-hpf", (e) => {
            const paramKey
              = `input${
                getChannelIndexFromChannelId(e.detail.channelId)
              }HpfEnabled`;
            this.params[paramKey] = Math.abs(1 - this.params[paramKey]);

            if (isNaN(this.params[paramKey])) {
              this.params[paramKey] = 1;
            }

            updateParamValue(
              "InputHPF",
              this.params[paramKey],
              e.detail.channelId,
            );
            this.render();
          });

          fxSection.addEventListener("toggle-invert-phase", (e) => {
            const paramKey
              = `input${
                getChannelIndexFromChannelId(e.detail.channelId)
              }InvertPhaseEnabled`;
            this.params[paramKey] = Math.abs(1 - this.params[paramKey]);

            if (isNaN(this.params[paramKey])) {
              this.params[paramKey] = 1;
            }

            updateParamValue(
              "InputInvertPhase",
              this.params[paramKey],
              e.detail.channelId,
            );
            this.render();
          });
        });
    } catch (e) {
      if (
        e.message === "Could not find MIDI input interface of audio interface"
      ) {
        this.status = "no-interface";
        this.render();
      } else {
        this.status = "unknown-error";
        console.error(e);
      }
    }
  }

  render() {
    if (this.status === "unknown-error") {
      const template
        = "An unknown error occurred. Please check the console for more info.";
      render(template, this);
      return;
    } else if (this.status === "no-interface") {
      const template
        = html`<h1>Steinmixer</h1>
        <p>Could not find audio interface. Make sure it is connected.
        <br>
        <button @click=${() => location.reload()}>
          Reload page to check again
        </button>`;
      render(template, this);
      return;
    } else if (this.status === "loading") {
      const template = "Loading...";
      render(template, this);
      return;
    }

    const template = html`
    <h1>Steinmixer</h1>
    <div class="mixer-container">
      <div class="mix-select">
        <button
          class=${this.activeMix === 0 ? "active" : ""}
          @click=${() => {
      selectActiveMix(0);
      this.activeMix = 0;
      this.render();
    }}
        >Mix 1</button>
        <button
          class=${this.activeMix === 1 ? "active" : ""}
          @click=${() => {
      selectActiveMix(1);
      this.activeMix = 1;
      this.render();
    }}
        >Mix 2</button>
      </div>
      <stereo-input
        link-inputs=${this.params.input0Linked}
        title-l="Analog 1"
        title-r="Analog 2"
        channel-id-l="analog1"
        channel-id-r="analog2"
        volume-l=${
          this.activeMix === 0
            ? this.params.mix1Input0Volume
            : this.params.mix2Input0Volume
        }
        volume-r=${
          this.activeMix === 0
            ? this.params.mix1Input1Volume
            : this.params.mix2Input1Volume
        }
        phantom-power-available="true"
        phantom-power-enabled="${this.params.phantomPower0}"
        active-mix=${this.activeMix}
        pan-l=${
          this.activeMix === 0
            ? this.params.mix1Input0Pan
            : this.params.mix2Input0Pan
        }
        pan-r=${
          this.activeMix === 0
            ? this.params.mix1Input1Pan
            : this.params.mix2Input1Pan
          }
        mute-l=${
          this.activeMix === 0
            ? this.params.mix1Input0Mute
            : this.params.mix2Input0Mute
          }
        mute-r=${
          this.activeMix === 0
            ? this.params.mix1Input1Mute
            : this.params.mix2Input1Mute
          }
        solo-l=${
          this.activeMix === 0
            ? this.params.mix1Input0Solo
            : this.params.mix2Input0Solo
          }
        solo-r=${
          this.activeMix === 0
            ? this.params.mix1Input1Solo
            : this.params.mix2Input1Solo
          }
        hpf-available="true"
        hpf-l-enabled=${this.params.input0HpfEnabled}
        hpf-r-enabled=${this.params.input1HpfEnabled}
        invert-phase-l-enabled=${this.params.input0InvertPhaseEnabled}
        invert-phase-r-enabled=${this.params.input1InvertPhaseEnabled}
      ></stereo-input>
      <stereo-input
        link-inputs=${this.params.input2Linked}
        title-l="Analog 3"
        title-r="Analog 4"
        channel-id-l="analog3"
        channel-id-r="analog4"
        volume-l=${
          this.activeMix === 0
            ? this.params.mix1Input2Volume
            : this.params.mix2Input2Volume
          }
        volume-r=${
          this.activeMix === 0
            ? this.params.mix1Input3Volume
            : this.params.mix2Input3Volume
          }
        phantom-power-available="true"
        phantom-power-enabled="${this.params.phantomPower1}"
        active-mix=${this.activeMix}
        pan-l=${
          this.activeMix === 0
            ? this.params.mix1Input2Pan
            : this.params.mix2Input2Pan
          }
        pan-r=${
          this.activeMix === 0
            ? this.params.mix1Input3Pan
            : this.params.mix2Input3Pan
          }
        mute-l=${
          this.activeMix === 0
            ? this.params.mix1Input2Mute
            : this.params.mix2Input2Mute
          }
        mute-r=${
          this.activeMix === 0
            ? this.params.mix1Input3Mute
            : this.params.mix2Input3Mute
          }
        solo-l=${
          this.activeMix === 0
            ? this.params.mix1Input2Solo
            : this.params.mix2Input2Solo
          }
        solo-r=${
          this.activeMix === 0
            ? this.params.mix1Input3Solo
            : this.params.mix2Input3Solo
          }
        hpf-available="true"
        hpf-l-enabled=${this.params.input2HpfEnabled}
        hpf-r-enabled=${this.params.input3HpfEnabled}
        invert-phase-l-enabled=${this.params.input2InvertPhaseEnabled}
        invert-phase-r-enabled=${this.params.input3InvertPhaseEnabled}
      ></stereo-input>
      <stereo-input
        link-inputs=${this.params.input4Linked}
        title-l="Analog 5"
        title-r="Analog 6"
        channel-id-l="analog5"
        channel-id-r="analog6"
        volume-l=${
          this.activeMix === 0
            ? this.params.mix1Input4Volume
            : this.params.mix2Input4Volume
        }
        volume-r=${
          this.activeMix === 0
            ? this.params.mix1Input5Volume
            : this.params.mix2Input5Volume
        }
        active-mix=${this.activeMix}
        pan-l=${
          this.activeMix === 0
            ? this.params.mix1Input4Pan
            : this.params.mix2Input4Pan
        }
        pan-r=${
          this.activeMix === 0
            ? this.params.mix1Input5Pan
            : this.params.mix2Input5Pan
        }
        mute-l=${
          this.activeMix === 0
            ? this.params.mix1Input4Mute
            : this.params.mix2Input4Mute
        }
        mute-r=${
          this.activeMix === 0
            ? this.params.mix1Input5Mute
            : this.params.mix2Input5Mute
        }
        solo-l=${
          this.activeMix === 0
            ? this.params.mix1Input4Solo
            : this.params.mix2Input4Solo
        }
        solo-r=${
          this.activeMix === 0
            ? this.params.mix1Input5Solo
            : this.params.mix2Input5Solo
        }
        invert-phase-l-enabled=${this.params.input4InvertPhaseEnabled}
        invert-phase-r-enabled=${this.params.input5InvertPhaseEnabled}
      ></stereo-input>
      <channel-strip
        title="DAW"
        type="daw"
        channel-id="daw"
        subchannel-id-l="dawL"
        subchannel-id-r="dawR"
        active-mix=${this.activeMix}
        volume=${this.params.mix1DawVolume}
        pan=${
          this.activeMix === 0
            ? this.params.mix1DawPan
            : this.params.mix2DawPan
        }
        mute=${
          this.activeMix === 0
            ? this.params.mix1DawMute
            : this.params.mix2DawMute
        }
        solo=${
          this.activeMix === 0
            ? this.params.mix1DawSolo
            : this.params.mix2DawSolo
        }
      ></channel-strip>
      <channel-strip
        type="master"
        title="Master"
        channel-id="master"
        subchannel-id-l="masterL"
        subchannel-id-r="masterR"
        active-mix=${this.activeMix}
        volume=${
          this.activeMix === 0
            ? this.params.mix1MainVolume
            : this.params.mix2MainVolume
        }
        pan=${
          this.activeMix === 0
            ? this.params.mix1MainPan
            : this.params.mix2MainPan
        }
        mute=${
          this.activeMix === 0
            ? this.params.mix1MainMute
            : this.params.mix2MainMute
        }
      ></channel-strip>
    </div>

    <div class="settings">
      <div class="setting">
        <label class="select-label" for="phones-2-output-select">
          Phones 2 output
        </label>
        <select id="phones-2-output-select"
          @change=${(e) => {
          this.params.phones2Output = parseInt(e.target.value);
          updateParamValue("Phones2Output", parseInt(e.target.value), 0);
        }}
          .value=${live(this.params.phones2Output)}
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
          updateParamValue("Input56Level", parseInt(e.target.value), 0);
        }}
          .value=${live(this.params.input45Level)}
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
          id="hpf-level-select"
          @change=${(e) => {
          updateParamValue("HPFSetting", parseInt(e.target.value), 0);
          updateParamValue("HPFSetting", parseInt(e.target.value), 1);
          updateParamValue("HPFSetting", parseInt(e.target.value), 2);
          updateParamValue("HPFSetting", parseInt(e.target.value), 3);
          updateParamValue("HPFSetting", parseInt(e.target.value), 4);
          updateParamValue("HPFSetting", parseInt(e.target.value), 5);
        }}
          .value=${live(this.params.hpfSetting)}
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
            .checked=${live(this.params.loopback === 1)}
            @change=${(e) => {
          updateParamValue("Loopback", e.target.checked ? 1 : 0, 0);
        }}
          >
          Loopback of DAW signal to Inputs 1/2
      </div>
    </div>
    `;

    render(template, this);
  }
});
