import UR44Simulator from "../devices/UR44Simulator.js";
import "./StereoInput.js";
import { html, render, live } from "../lit.js";
import UR44 from "../devices/UR44.js";

customElements.define("stein-mixer", class SteinMixer extends HTMLElement {
  constructor() {
    super();
  }

  status = "loading";
  params;
  connectionName;
  openSidePanel = null;
  activeMix = 0;
  device;

  async connectedCallback() {
    this.render();

    const paramUpdateHandler = () => {
      this.render();
    };

    try {
      this.device = new UR44();
      const { params, connectionName } = await this.device.open(
        paramUpdateHandler,
      );
      this.params = params;
      this.connectionName = connectionName;
      this.status = "ready";
      this.render();

      Array.from(document.querySelectorAll("stereo-input"))
        .forEach(si => {
          si.addEventListener("link-channels", (e) => {
            const channelIndex = this.device.getChannelIndexFromChannelId(
              e.detail.channelIdL,
            );
            const newValue = e.detail.linked;
            this.device.updateParamValue(`Input${channelIndex}Link`, newValue);
          });
        });

      Array.from(document.querySelectorAll("volume-slider"))
        .forEach(vs => {
          vs.addEventListener("volume", (e) => {
            let paramKey;
            const mix = parseInt(e.detail.mix);

            if (e.detail.channelId === "daw") {
              paramKey = `Mix${mix}DAWVolume`;
            } else if (e.detail.channelId === "master") {
              paramKey = `Mix${mix}MainVolume`;
            } else {
              const originalChannelId = e.detail.channelId;
              const originalChannelIndex
                = this.device.getChannelIndexFromChannelId(
                  originalChannelId,
                );
              let actualChannelIndex;

              // when two channels are linked and user moves the right slider,
              // we actually want to change the value of the left slider, so
              // let's adjust the channelIndex if needed.
              if (
                originalChannelIndex === 1
                && this.params.Input0Link === 1
              ) {
                actualChannelIndex = 0;
              } else if (
                originalChannelIndex === 3
                && this.params.Input2Link === 1
              ) {
                actualChannelIndex = 2;
              } else if (
                originalChannelIndex === 5
                && this.params.Input4Link === 1
              ) {
                actualChannelIndex = 4;
              } else {
                actualChannelIndex = originalChannelIndex;
              }

              paramKey = `Mix${mix}Input${actualChannelIndex}Volume`;
            }
            this.device.updateParamValue(paramKey, e.detail.volume);
            this.render();
          });

          vs.addEventListener("mute", (e) => {
            const mix = parseInt(e.detail.mix);
            const channelId = e.detail.channelId;
            const value = e.detail.muted ? 0 : 1;
            let paramKey;

            if (channelId === "daw") {
              paramKey = `Mix${mix}DAWMute`;
            } else if (channelId === "master") {
              paramKey = `Mix${mix}MainMute`;
            } else {
              paramKey = `Mix${mix}Input${
                this.device.getChannelIndexFromChannelId(channelId)
              }Mute`;
            }
            this.device.updateParamValue(paramKey, value);
            this.render();
          });

          vs.addEventListener("solo", (e) => {
            const mix = parseInt(e.detail.mix);
            const value = e.detail.soloed ? 1 : 0;
            let paramKey;

            if (e.detail.channelId === "daw") {
              paramKey = `Mix${mix}DAWSolo`;
            } else if (e.detail.channelId === "master") {
              paramKey = `Mix${mix}MainSolo`;
            } else {
              paramKey = `Mix${mix}Input${
                this.device.getChannelIndexFromChannelId(e.detail.channelId)
              }Solo`;
            }
            this.device.updateParamValue(paramKey, value);
            this.render();
          });
        });

      Array.from(document.querySelectorAll("pan-slider"))
        .forEach(ps => {
          ps.addEventListener("pan", (e) => {
            const { channelId, pan } = e.detail;
            const mix = parseInt(e.detail.mix);
            let paramKey;

            if (channelId === "daw") {
              paramKey = `Mix${mix}DAWPan`;
            } else if (channelId === "master") {
              paramKey = `Mix${mix}MainPan`;
            } else {
              paramKey = `Mix${mix}Input${
                this.device.getChannelIndexFromChannelId(channelId)
              }Pan`;
            }
            this.device.updateParamValue(paramKey, pan);
            this.render();
          });
        });

      Array.from(document.querySelectorAll("send-slider"))
        .forEach(ps => {
          ps.addEventListener("send", (e) => {
            const paramKey
              = `Input${
                this.device.getChannelIndexFromChannelId(e.detail.channelId)
              }ReverbSend`;
            this.device.updateParamValue(paramKey, e.detail.send);
            this.render();
          });
        });

      Array.from(document.querySelectorAll("fx-section"))
        .forEach(fxSection => {
          fxSection.addEventListener("toggle-hpf", (e) => {
            const paramKey
              = `Input${
                this.device.getChannelIndexFromChannelId(e.detail.channelId)
              }HPFEnabled`;
            const newValue = Math.abs(1 - this.params[paramKey]);
            this.device.updateParamValue(paramKey, newValue);
            this.render();
          });

          fxSection.addEventListener("toggle-invert-phase", (e) => {
            const paramKey
              = `Input${
                this.device.getChannelIndexFromChannelId(e.detail.channelId)
              }InvertPhase`;
            const newValue = Math.abs(1 - this.params[paramKey]);
            this.device.updateParamValue(paramKey, newValue);
            this.render();
          });
        });
    } catch (e) {
      if (e.name === "NotAllowedError") {
        this.status = "not-allowed";
        this.render();
      } else if (
        e.message === "DEVICE_NOT_FOUND"
      ) {
        this.status = "no-interface";
        this.render();
      } else {
        this.status = "unknown-error";
        console.error(e);
        this.render();
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
        = html`<app-header></app-header>
        <p>Could not find audio interface. Make sure it is connected.
        <br>
        <button @click=${() => location.reload()}>
          Reload page to check again
        </button>`;
      render(template, this);
      return;
    } else if (this.status === "not-allowed") {
      const template
        = html`<app-header></app-header>
        <p>
          This website is not allowed to access and control MIDI devices.
          Please enable access via the icon in your address bar.
        </p>
        <img src="./img/allow-midi-access.png" width="300">
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

    const mix = this.activeMix;
    const params = this.params;

    const template = html`
    <app-header connection-name=${this.connectionName}></app-header>
    <div class="mixer-container">
      <div class="mix-select">
        <button
          class=${mix === 0 ? "active" : ""}
          @click=${() => {
            this.device.selectActiveMix(0);
            this.activeMix = 0;
            this.render();
          }}
        >Mix 1</button>
        <button
          class=${mix === 1 ? "active" : ""}
          @click=${() => {
            this.device.selectActiveMix(1);
            this.activeMix = 1;
            this.render();
          }}
        >Mix 2</button>
      </div>
      <stereo-input
        .device=${this.device}
        link-inputs=${params.Input0Link}
        title-l="Analog 1"
        title-r="Analog 2"
        channel-id-l="analog1"
        channel-id-r="analog2"
        volume-l=${params[`Mix${mix}Input0Volume`]}
        volume-r=${params[`Mix${mix}Input1Volume`]}
        phantom-power-available="true"
        phantom-power-enabled="${params.PhantomPower01}"
        active-mix=${this.activeMix}
        pan-l=${params[`Mix${mix}Input0Pan`]}
        pan-r=${params[`Mix${mix}Input1Pan`]}
        mute-l=${params[`Mix${mix}Input0Mute`]}
        mute-r=${params[`Mix${mix}Input1Mute`]}
        solo-l=${params[`Mix${mix}Input0Solo`]}
        solo-r=${params[`Mix${mix}Input1Solo`]}
        hpf-available="true"
        hpf-l-enabled=${params.Input0HPFEnabled}
        hpf-r-enabled=${params.Input1HPFEnabled}
        invert-phase-l-enabled=${params.Input0InvertPhase}
        invert-phase-r-enabled=${params.Input1InvertPhase}
        reverb-send-l=${params.Input0ReverbSend}
        reverb-send-r=${params.Input1ReverbSend}
      ></stereo-input>
      <stereo-input
        .device=${this.device}
        link-inputs=${params.Input2Link}
        title-l="Analog 3"
        title-r="Analog 4"
        channel-id-l="analog3"
        channel-id-r="analog4"
        volume-l=${params[`Mix${mix}Input2Volume`]}
        volume-r=${params[`Mix${mix}Input3Volume`]}
        phantom-power-available="true"
        phantom-power-enabled="${params.PhantomPower23}"
        active-mix=${this.activeMix}
        pan-l=${params[`Mix${mix}Input2Pan`]}
        pan-r=${params[`Mix${mix}Input3Pan`]}
        mute-l=${params[`Mix${mix}Input2Mute`]}
        mute-r=${params[`Mix${mix}Input3Mute`]}
        solo-l=${params[`Mix${mix}Input2Solo`]}
        solo-r=${params[`Mix${mix}Input3Solo`]}
        hpf-available="true"
        hpf-l-enabled=${params.Input2HPFEnabled}
        hpf-r-enabled=${params.Input3HPFEnabled}
        invert-phase-l-enabled=${params.Input2InvertPhase}
        invert-phase-r-enabled=${params.Input3InvertPhase}
        reverb-send-l=${params.Input2ReverbSend}
        reverb-send-r=${params.Input3ReverbSend}
      ></stereo-input>
      <stereo-input
        .device=${this.device}
        link-inputs=${params.Input4Link}
        title-l="Analog 5"
        title-r="Analog 6"
        channel-id-l="analog5"
        channel-id-r="analog6"
        volume-l=${params[`Mix${mix}Input4Volume`]}
        volume-r=${params[`Mix${mix}Input5Volume`]}
        active-mix=${this.activeMix}
        pan-l=${params[`Mix${mix}Input4Pan`]}
        pan-r=${params[`Mix${mix}Input5Pan`]}
        mute-l=${params[`Mix${mix}Input4Mute`]}
        mute-r=${params[`Mix${mix}Input5Mute`]}
        solo-l=${params[`Mix${mix}Input4Solo`]}
        solo-r=${params[`Mix${mix}Input5Solo`]}
        invert-phase-l-enabled=${params.Input4InvertPhase}
        invert-phase-r-enabled=${params.Input5InvertPhase}
        reverb-send-l=${params.Input4ReverbSend}
        reverb-send-r=${params.Input5ReverbSend}
      ></stereo-input>
      <channel-strip
        .device=${this.device}
        title="DAW"
        type="daw"
        channel-id="daw"
        subchannel-id-l="dawL"
        subchannel-id-r="dawR"
        active-mix=${this.activeMix}
        volume=${params[`Mix${mix}DAWVolume`]}
        pan=${params[`Mix${mix}DAWPan`]}
        mute=${params[`Mix${mix}DAWMute`]}
        solo=${params[`Mix${mix}DAWSolo`]}
      ></channel-strip>
      <channel-strip
        .device=${this.device}
        type="master"
        title="Master"
        channel-id="master"
        subchannel-id-l="masterL"
        subchannel-id-r="masterR"
        active-mix=${this.activeMix}
        volume=${params[`Mix${mix}MainVolume`]}
        pan=${params[`Mix${mix}MainPan`]}
        mute=${params[`Mix${mix}MainMute`]}
        @open-master-reverb=${() => {
          this.openSidePanel = "reverb";
          this.render();
        }}
      ></channel-strip>
      <master-reverb
        .device=${this.device}
        active-mix=${this.activeMix}
        type=${params.ReverbType}
        time=${params.ReverbTime}
        input-mix=${params.ReverbInputMix}
        diffusion=${params.ReverbDiffusion}
        initial-delay=${params.ReverbInitialDelay}
        hpf=${params.ReverbHPF}
        lpf=${params.ReverbLPF}
        room-size=${params.ReverbRoomSize}
        high-ratio=${params.ReverbHighRatio}
        low-ratio=${params.ReverbLowRatio}
        decay=${params.ReverbDecay}
        low-freq=${params.ReverbLowFreq}
        volume=${params[`Mix${mix}ReverbVolume`]}
      ></master-reverb>
    </div>

    <div class="settings">
      <div class="setting">
        <label class="select-label" for="phones-2-output-select">
          Phones 2 output
        </label>
        <select id="phones-2-output-select"
          @change=${(e) => {
            this.params.Phones2Output = parseInt(e.target.value);
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
          id="hpf-level-select"
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
            .checked=${live(this.params.Loopback === 1)}
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
});
