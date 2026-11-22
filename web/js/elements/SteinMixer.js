import "./StereoInput.js";
import "./SceneManager.js";
import { html, render, live } from "../lit.js";
import UR44 from "../devices/UR44.js";
import UR44VirtualDevice from "../devices/UR44VirtualDevice.js";

/* Open the app with ?simulator to use a virtual device. */
const USE_SIMULATOR = new URLSearchParams(location.search).has("simulator");

/*
  The device mirrors these params between the channels of a linked pair, so
  for linked channels we always address the left channel.
*/
const LINKED_LEFT_PARAMS = ["Volume", "Mute", "Solo", "ReverbSend", "HPF"];

customElements.define("stein-mixer", class SteinMixer extends HTMLElement {
  constructor() {
    super();
  }

  status = "loading";
  params;
  connectionName;
  activeMix = 0;
  device;

  async connectedCallback() {
    this.render();

    const messageHandler = (message) => {
      if (message.type === "local-change") {
        // every change made by this app, for the scene "modified" marker
        this.#paramChanged();
      } else if (message.type === "state-refresh") {
        this.renderAll();
      } else {
        this.render();
      }
    };

    try {
      this.device = USE_SIMULATOR
        ? new UR44(new UR44VirtualDevice().portProvider)
        : new UR44();
      const { params, connectionName } = await this.device.open(
        messageHandler,
      );
      this.params = params;
      this.connectionName = connectionName;
      this.status = "ready";
      this.#addEventListeners();
      this.render();
    } catch (e) {
      if (e.name === "NotAllowedError") {
        this.status = "not-allowed";
      } else if (e.message === "DEVICE_NOT_FOUND") {
        this.status = "no-interface";
      } else {
        this.status = "unknown-error";
        console.error(e);
      }
      this.render();
    }
  }

  /* re-render everything incl. the panels which render themselves */
  renderAll() {
    this.render();
    this.querySelectorAll("fx-section, channel-fx, master-reverb")
      .forEach((el) => el.render());
    this.querySelector("interface-settings")?.render();
  }

  #paramChanged() {
    this.querySelector("scene-manager")?.markModified?.();
  }

  #update(paramKey, value) {
    this.device.updateParamValue(paramKey, value);
    this.render();
  }

  #inputParamKey(prefix, channelId, suffix) {
    let channelIndex = this.device.getChannelIndexFromChannelId(channelId);
    if (
      LINKED_LEFT_PARAMS.some((p) => suffix.startsWith(p))
      && this.device.isLinked(channelIndex)
    ) {
      channelIndex -= channelIndex % 2;
    }
    return `${prefix}Input${channelIndex}${suffix}`;
  }

  #addEventListeners() {
    this.addEventListener("close-session-request", () => {
      this.device.closeSession();
      this.status = "session-closed";
      this.render();
    });

    this.addEventListener("link-channels", async (e) => {
      const channelIndex = this.device.getChannelIndexFromChannelId(
        e.detail.channelIdL,
      );
      await this.device.updateParamValue(
        `Input${channelIndex}Link`, e.detail.linked,
      );
      this.renderAll();
    });

    this.addEventListener("volume", (e) => {
      const mix = parseInt(e.detail.mix);
      const { channelId } = e.detail;
      let paramKey;
      if (channelId === "daw") {
        paramKey = `Mix${mix}DAWVolume`;
      } else if (channelId === "master") {
        paramKey = `Mix${mix}MainVolume`;
      } else {
        paramKey = this.#inputParamKey(`Mix${mix}`, channelId, "Volume");
      }
      this.#update(paramKey, e.detail.volume);
    });

    this.addEventListener("mute", (e) => {
      const mix = parseInt(e.detail.mix);
      const { channelId } = e.detail;
      const value = e.detail.muted ? 0 : 1;
      let paramKey;
      if (channelId === "daw") {
        paramKey = `Mix${mix}DAWMute`;
      } else if (channelId === "master") {
        paramKey = `Mix${mix}MainMute`;
      } else {
        paramKey = this.#inputParamKey(`Mix${mix}`, channelId, "Mute");
      }
      this.#update(paramKey, value);
    });

    this.addEventListener("solo", (e) => {
      const mix = parseInt(e.detail.mix);
      const { channelId } = e.detail;
      const value = e.detail.soloed ? 1 : 0;
      const paramKey = channelId === "daw"
        ? `Mix${mix}DAWSolo`
        : this.#inputParamKey(`Mix${mix}`, channelId, "Solo");
      this.#update(paramKey, value);
    });

    this.addEventListener("pan", (e) => {
      const { channelId, pan } = e.detail;
      const mix = parseInt(e.detail.mix);
      let paramKey;
      if (channelId === "daw") {
        paramKey = `Mix${mix}DAWPan`;
      } else if (channelId === "master") {
        paramKey = `Mix${mix}MainPan`;
      } else {
        paramKey = this.#inputParamKey(`Mix${mix}`, channelId, "Pan");
      }
      this.#update(paramKey, pan);
    });

    this.addEventListener("send", (e) => {
      if (e.detail.channelId === "daw") {
        // the DAW send has a separate on/off switch, keep it in sync
        const enabled = e.detail.send > 0 ? 1 : 0;
        if (this.params.DAWReverbSendEnabled !== enabled) {
          this.device.updateParamValue("DAWReverbSendEnabled", enabled);
        }
        this.#update("DAWReverbSend", e.detail.send);
        return;
      }
      this.#update(
        this.#inputParamKey("", e.detail.channelId, "ReverbSend"),
        e.detail.send,
      );
    });

    this.addEventListener("toggle-hpf", (e) => {
      const paramKey = this.#inputParamKey(
        "", e.detail.channelId, "HPFEnabled",
      );
      this.#update(paramKey, 1 - this.params[paramKey]);
    });

    this.addEventListener("toggle-invert-phase", (e) => {
      const index = this.device.getChannelIndexFromChannelId(
        e.detail.channelId,
      );
      const paramKey = `Input${index}InvertPhase`;
      this.#update(paramKey, 1 - this.params[paramKey]);
    });

    this.addEventListener("fx-changed", () => this.renderAll());

    this.addEventListener("scene-recalled", () => this.renderAll());
  }

  #renderStatus(message, { reload = true, image = false } = {}) {
    render(html`<app-header></app-header>
      <p>${message}</p>
      ${image
        ? html`<img src="./img/allow-midi-access.png" width="300"
          alt="Browser prompt allowing MIDI access"><br>`
        : ""}
      ${reload
        ? html`<button @click=${() => location.reload()}>
          Reload page to check again
        </button>`
        : ""}`, this);
  }

  render() {
    if (this.status === "unknown-error") {
      this.#renderStatus(
        "An unknown error occurred. Please check the console for more info.",
        { reload: false },
      );
      return;
    } else if (this.status === "no-interface") {
      this.#renderStatus(html`Could not find audio interface. Make sure it is
        connected. You can also <a href="?simulator">try the simulator</a>.`);
      return;
    } else if (this.status === "session-closed") {
      this.#renderStatus(
        "The session has been closed. To connect again, please reload the "
          + "page.",
      );
      return;
    } else if (this.status === "not-allowed") {
      this.#renderStatus(html`This website is not allowed to access and
        control MIDI devices. Please enable access via the icon in your
        address bar.`, { image: true });
      return;
    } else if (this.status === "loading") {
      render("Loading...", this);
      return;
    }

    const mix = this.activeMix;
    const params = this.params;

    const stereoInput = (left, extra = {}) => {
      const right = left + 1;
      return html`<stereo-input
        .device=${this.device}
        link-inputs=${params[`Input${left}Link`]}
        title-l=${UR44.INPUT_CHANNEL_TITLES[left]}
        title-r=${UR44.INPUT_CHANNEL_TITLES[right]}
        channel-id-l=${UR44.INPUT_CHANNEL_IDS[left]}
        channel-id-r=${UR44.INPUT_CHANNEL_IDS[right]}
        volume-l=${params[`Mix${mix}Input${left}Volume`]}
        volume-r=${params[`Mix${mix}Input${right}Volume`]}
        phantom-power-available=${extra.phantom ? "true" : "false"}
        phantom-power-enabled=${extra.phantom ? params[extra.phantom] : 0}
        active-mix=${mix}
        pan-l=${params[`Mix${mix}Input${left}Pan`]}
        pan-r=${params[`Mix${mix}Input${right}Pan`]}
        mute-l=${params[`Mix${mix}Input${left}Mute`]}
        mute-r=${params[`Mix${mix}Input${right}Mute`]}
        solo-l=${params[`Mix${mix}Input${left}Solo`]}
        solo-r=${params[`Mix${mix}Input${right}Solo`]}
        hpf-available=${extra.hpf ? "true" : "false"}
        hpf-l-enabled=${extra.hpf ? params[`Input${left}HPFEnabled`] : 0}
        hpf-r-enabled=${extra.hpf ? params[`Input${right}HPFEnabled`] : 0}
        invert-phase-l-enabled=${params[`Input${left}InvertPhase`]}
        invert-phase-r-enabled=${params[`Input${right}InvertPhase`]}
        reverb-send-l=${params[`Input${left}ReverbSend`]}
        reverb-send-r=${params[`Input${right}ReverbSend`]}
      ></stereo-input>`;
    };

    const selectMix = (newMix) => {
      this.device.selectActiveMix(newMix);
      this.activeMix = newMix;
      this.renderAll();
    };

    const template = html`
    <app-header connection-name=${this.connectionName}></app-header>
    <scene-manager .device=${this.device}></scene-manager>
    <div class="mix-select" role="radiogroup" aria-label="Mix">
      ${[0, 1].map((m) => html`<label>
        <input
          type="radio"
          name="mix-select"
          .checked=${live(mix === m)}
          @click=${() => selectMix(m)}
        >
        Mix ${m + 1}
      </label>`)}
    </div>
    <div class="mixer-container">
      ${stereoInput(0, { phantom: "PhantomPower01", hpf: true })}
      ${stereoInput(2, { phantom: "PhantomPower23", hpf: true })}
      ${stereoInput(4)}
      <channel-strip
        .device=${this.device}
        title="DAW"
        type="daw"
        channel-id="daw"
        subchannel-id-l="dawL"
        subchannel-id-r="dawR"
        active-mix=${mix}
        volume=${params[`Mix${mix}DAWVolume`]}
        pan=${params[`Mix${mix}DAWPan`]}
        mute=${params[`Mix${mix}DAWMute`]}
        solo=${params[`Mix${mix}DAWSolo`]}
        reverb-send=${params.DAWReverbSendEnabled ? params.DAWReverbSend : 0}
      ></channel-strip>
      <channel-strip
        .device=${this.device}
        type="master"
        title="Master"
        channel-id="master"
        subchannel-id-l="masterL"
        subchannel-id-r="masterR"
        active-mix=${mix}
        volume=${params[`Mix${mix}MainVolume`]}
        pan=${params[`Mix${mix}MainPan`]}
        mute=${params[`Mix${mix}MainMute`]}
      ></channel-strip>
    </div>

    <channel-fx
      .device=${this.device}
    ></channel-fx>

    <master-reverb
      .device=${this.device}
      active-mix=${mix}
    ></master-reverb>

    <interface-settings
      .device=${this.device}
    ></interface-settings>
    `;

    render(template, this);
  }
});
