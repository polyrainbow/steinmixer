import UR44, { AMP_TYPES, MORPH_MAX } from "../devices/UR44.js";
import { html, render, live } from "../lit.js";
import {
  formatParam,
  PARAM_RANGES,
  KNEE_NAMES,
} from "../devices/channelStripMath.js";
import {
  parseSweetSpotData,
  buildSweetSpotData,
} from "../devices/sweetSpotData.js";
import "./CompressorCurve.js";
import "./EQCurve.js";
import "./GainReductionMeter.js";

/* keys used by channelStripMath / the curve elements -> device params */
const STRIP_PARAMS = {
  compBypass: "ChannelStripCompEnabled",
  drive: "ChannelStripCompDrive",
  attack: "ChannelStripCompAttack",
  release: "ChannelStripCompRelease",
  ratio: "ChannelStripCompRatio",
  knee: "ChannelStripCompKnee",
  threshOfst: "ChannelStripCompThreshOffset",
  makeupOfst: "ChannelStripCompMakeupOffset",
  sidechainF: "ChannelStripCompSideChFreq",
  sidechainG: "ChannelStripCompSideChGain",
  sidechainQ: "ChannelStripCompSideChQ",
  eqBypass: "ChannelStripEQEnabled",
  lowFreq: "ChannelStripEQLowFreq",
  lowGain: "ChannelStripEQLowGain",
  midFreq: "ChannelStripEQMidFreq",
  midGain: "ChannelStripEQMidGain",
  midQ: "ChannelStripEQMidQ",
  highFreq: "ChannelStripEQHighFreq",
  highGain: "ChannelStripEQHighGain",
  totalGain: "ChannelStripTotalGain",
};

export const toMathParams = (strip) => {
  return Object.fromEntries(
    Object.entries(STRIP_PARAMS).map(([key, name]) => [key, strip[name]]),
  );
};

const getChannelTitle = (channelIndex, stereo) => {
  if (!stereo) return UR44.INPUT_CHANNEL_TITLES[channelIndex];
  return `${UR44.INPUT_CHANNEL_TITLES[channelIndex]}/${channelIndex + 2}`;
};

const downloadBytes = (bytes, fileName) => {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/octet-stream" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const getChannelStripTemplate = (channelIndex, device, host) => {
  const { stackIndex, stereo } = device.fxState[channelIndex];
  const strip = device.channelStripSettings[stackIndex];
  const params = toMathParams(strip);
  const sweetSpot = device.sweetSpots[stackIndex] ?? { id: "", name: "" };
  const title = getChannelTitle(channelIndex, stereo);
  const compOn = strip.ChannelStripCompEnabled === 0;
  const eqOn = strip.ChannelStripEQEnabled === 0;

  const update = (key, value) => {
    device.updateParamValue(STRIP_PARAMS[key], value, stackIndex);
    host.render();
  };

  const slider = (key, label) => {
    const range = PARAM_RANGES[key];
    return html`<label>
      <span class="label">${label}</span>
      <input
        type="range"
        min=${range.min}
        max=${range.max}
        .value=${live(params[key])}
        aria-valuetext=${formatParam(key, params[key])}
        @input=${(e) => update(key, parseInt(e.target.value))}
        @dblclick=${() => update(key, range.default)}
      >
      <span class="value">${formatParam(key, params[key])}</span>
    </label>`;
  };

  const toggle = (key, on, label) => html`<button
    class="toggle ${on ? "enabled" : ""}"
    aria-pressed=${on ? "true" : "false"}
    @click=${() => update(key, on ? 1 : 0)}
  >${label} ${on ? "on" : "off"}</button>`;

  const morph = strip.ChannelStripMorphing;

  return html`
    <div class="channel-fx-panel channel-strip-panel" data-stack=${stackIndex}>
      <h2>${title}: Channel strip${stereo ? " (stereo)" : ""}</h2>
      <div class="sweet-spot">
        <div>
          <span class="label">Sweet Spot Data</span>
          <strong class="sweet-spot-name">${sweetSpot.name || "–"}</strong>
          <span class="sweet-spot-id">${sweetSpot.id}</span>
        </div>
        <label class="button file-button">
          Load .ssd…
          <input
            type="file"
            accept=".ssd"
            hidden
            @change=${async (e) => {
              const file = e.target.files[0];
              e.target.value = "";
              if (!file) return;
              try {
                const data = parseSweetSpotData(
                  new Uint8Array(await file.arrayBuffer()), file.name,
                );
                host.status = `Loading ${data.name}…`;
                host.render();
                await device.loadSweetSpotData(stackIndex, data);
                host.status = "";
              } catch (err) {
                console.error(err);
                host.status = `Could not load ${file.name}: ${err.message}`;
              }
              host.render();
            }}
          >
        </label>
        <button @click=${() => {
          const data = device.getSweetSpotData(stackIndex);
          downloadBytes(
            buildSweetSpotData(data), `${data.name || "Sweet Spot"}.ssd`,
          );
        }}>Save .ssd</button>
        <label class="morph">
          <span class="label">Morph</span>
          <input
            type="range"
            min="0"
            max=${MORPH_MAX}
            .value=${live(morph)}
            aria-valuetext=${(morph / 12).toFixed(2)}
            @input=${(e) => {
              device.updateParamValue(
                "ChannelStripMorphing", parseInt(e.target.value), stackIndex,
              );
              host.render();
            }}
          >
          <span class="value">${(morph / 12).toFixed(2)}</span>
        </label>
        ${slider("totalGain", "Total gain")}
      </div>
      <div class="cs-sections">
        <section class="cs-compressor ${compOn ? "" : "bypassed"}">
          <h3>Compressor ${toggle("compBypass", compOn, "Comp.")}</h3>
          <div class="cs-graph">
            <compressor-curve .params=${params} curve-only></compressor-curve>
            <gr-meter data-meter="gr" title="Gain reduction"></gr-meter>
          </div>
          <div class="settings">
            ${slider("drive", "Drive")}
            ${slider("attack", "Attack")}
            ${slider("release", "Release")}
            ${slider("ratio", "Ratio")}
            <label>
              <span class="label">Knee</span>
              <select
                @change=${(e) => update("knee", parseInt(e.target.value))}
              >
                ${KNEE_NAMES.map((name, i) => html`<option
                  value=${i}
                  .selected=${params.knee === i}
                >${name}</option>`)}
              </select>
            </label>
            ${slider("sidechainF", "Side chain F")}
            ${slider("sidechainG", "Side chain G")}
            ${slider("sidechainQ", "Side chain Q")}
          </div>
        </section>
        <section class="cs-eq ${eqOn ? "" : "bypassed"}">
          <h3>Equalizer ${toggle("eqBypass", eqOn, "EQ")}</h3>
          <eq-curve
            .params=${params}
            .sampleRate=${device.sampleRate}
            @eq-change=${(e) => update(e.detail.param, e.detail.value)}
          ></eq-curve>
          <div class="settings">
            ${slider("lowFreq", "Low F")}
            ${slider("lowGain", "Low G")}
            ${slider("midFreq", "Mid F")}
            ${slider("midGain", "Mid G")}
            ${slider("midQ", "Mid Q")}
            ${slider("highFreq", "High F")}
            ${slider("highGain", "High G")}
          </div>
        </section>
        <section class="cs-output">
          <h3>Output</h3>
          <level-meter data-meter="out" title="Channel strip output">
          </level-meter>
        </section>
      </div>
    </div>
  `;
};

const getAmpTemplate = (channelTitle, ampTypeIndex, device) => {
  const deviceSettings = device.settings;

  const cleanSettingsTemplate = html`
    <label>
      FX
      <input
        type="range"
        min="0"
        max="2"
        value="${deviceSettings["AmpCleanModulation"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanModulation", parseInt(value));
        }}
      >
    </label>
    <label>
      Vibrato Speed
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanVibratoSpeed"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanVibratoSpeed", parseInt(value));
        }}
      >
    </label>
    <label>
      Vibrato Depth
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanVibratoDepth"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanVibratoDepth", parseInt(value));
        }}
      >
    </label>
    <label>
      Volume
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanVolume"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanVolume", parseInt(value));
        }}
      >
    </label>
    <label>
      Distortion
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanDistortion"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanDistortion", parseInt(value));
        }}
      >
    </label>
    <label>
      Treble
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanTreble"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanTreble", parseInt(value));
        }}
      >
    </label>
    <label>
      Middle
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanMiddle"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanMiddle", parseInt(value));
        }}
      >
    </label>
    <label>
      Bass
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanBass"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanBass", parseInt(value));
        }}
      >
    </label>
    <label>
      Presence
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanPresence"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanPresence", parseInt(value));
        }}
      >
    </label>
    <label>
      Blend
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCleanBlend"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanBlend", parseInt(value));
        }}
      >
    </label>
    <label>
      Output
      <input
        type="range"
        min="0"
        max="127"
        value="${deviceSettings["AmpCleanOutput"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCleanOutput", parseInt(value));
        }}
      >
    </label>
  `;

  const crunchSettingsTemplate = html`
    <label>
      Normal/Bright
      <input
        type="range"
        min="0"
        max="1"
        value="${deviceSettings["AmpCrunchMode"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCrunchMode", parseInt(value));
        }}
      >
    </label>
    <label>
      Gain
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCrunchGain"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCrunchGain", parseInt(value));
        }}
      >
    </label>
    <label>
      Treble
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCrunchTreble"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCrunchTreble", parseInt(value));
        }}
      >
    </label>
    <label>
      Middle
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCrunchMiddle"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCrunchMiddle", parseInt(value));
        }}
      >
    </label>
    <label>
      Bass
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCrunchBass"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCrunchBass", parseInt(value));
        }}
      >
    </label>
    <label>
      Presence
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpCrunchPresence"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCrunchPresence", parseInt(value));
        }}
      >
    </label>
    <label>
      Output
      <input
        type="range"
        min="0"
        max="127"
        value="${deviceSettings["AmpCrunchOutput"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpCrunchOutput", parseInt(value));
        }}
      >
    </label>
  `;

  const leadSettingsTemplate = html`
    <label>
      High/Low
      <input
        type="range"
        min="0"
        max="1"
        value="${deviceSettings["AmpLeadType"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpLeadType", parseInt(value));
        }}
      >
    </label>
    <label>
      Gain
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpLeadGain"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpLeadGain", parseInt(value));
        }}
      >
    </label>
    <label>
      Master
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpLeadMaster"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpLeadMaster", parseInt(value));
        }}
      >
    </label>
    <label>
      Treble
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpLeadTreble"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpLeadTreble", parseInt(value));
        }}
      >
    </label>
    <label>
      Middle
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpLeadMiddle"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpLeadMiddle", parseInt(value));
        }}
      >
    </label>
    <label>
      Bass
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpLeadBass"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpLeadBass", parseInt(value));
        }}
      >
    </label>
    <label>
      Presence
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpLeadPresence"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpLeadPresence", parseInt(value));
        }}
      >
    </label>
    <label>
      Output
      <input
        type="range"
        min="0"
        max="127"
        value="${deviceSettings["AmpLeadOutput"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpLeadOutput", parseInt(value));
        }}
      >
    </label>
    `;

  const driveSettingsTemplate = html`
    <label>
      Amp Type
      <input
        type="range"
        min="0"
        max="5"
        value="${deviceSettings["AmpDriveType"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpDriveType", parseInt(value));
        }}
      >
    </label>
    <label>
      Gain
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpDriveGain"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpDriveGain", parseInt(value));
        }}
      >
    </label>
    <label>
      Master
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpDriveMaster"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpDriveMaster", parseInt(value));
        }}
      >
    </label>
    <label>
      Treble
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpDriveTreble"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpDriveTreble", parseInt(value));
        }}
      >
    </label>
    <label>
      Middle
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpDriveMiddle"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpDriveMiddle", parseInt(value));
        }}
      >
    </label>
    <label>
      Bass
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpDriveBass"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpDriveBass", parseInt(value));
        }}
      >
    </label>
    <label>
      Presence
      <input
        type="range"
        min="0"
        max="64"
        value="${deviceSettings["AmpDrivePresence"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpDrivePresence", parseInt(value));
        }}
      >
    </label>
    <label>
      Output
      <input
        type="range"
        min="0"
        max="127"
        value="${deviceSettings["AmpDriveOutput"]}"
        @change=${(e) => {
          const value = e.target.value;
          device.updateParamValue("AmpDriveOutput", parseInt(value));
        }}
      >
    </label>
  `;

  const templates = [
    cleanSettingsTemplate,
    crunchSettingsTemplate,
    leadSettingsTemplate,
    driveSettingsTemplate,
  ];

  const settingsTemplate = templates[ampTypeIndex]
    ?? html`Not yet supported amp type: ${AMP_TYPES[ampTypeIndex]}`;

  return html`
    <div class="channel-fx-panel">
      <h2>${channelTitle}: ${AMP_TYPES[ampTypeIndex]}</h2>
      <div class="settings">
        ${settingsTemplate}
      </div>
    </div>
  `;
};


const getFXTemplate = (device, channelIndex, host) => {
  const settings = device.settings;
  const { type, stereo } = device.fxState[channelIndex];
  const channelTitle = UR44.INPUT_CHANNEL_TITLES[channelIndex];

  if (type === "off") {
    return html``;
  } else if (type === "amp") {
    return getAmpTemplate(
      channelTitle,
      settings["AmpType"],
      device,
    );
  } else if (type === "channel-strip") {
    // a stereo strip is edited once, via its left channel
    if (stereo && channelIndex % 2 === 1) return html``;
    return getChannelStripTemplate(channelIndex, device, host);
  } else {
    throw new Error(
      "Unknown FX type: " + type,
    );
  }
};

customElements.define("channel-fx", class ChannelFX extends HTMLElement {
  constructor() {
    super();
  }

  status = "";
  #frame = null;

  connectedCallback() {
    this.render();
    this.#frame = requestAnimationFrame(() => this.#updateMeters());
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#frame);
  }

  #updateMeters() {
    for (const panel of this.querySelectorAll(".channel-strip-panel")) {
      const meters = this.device.getChannelStripMeters(
        parseInt(panel.dataset.stack),
      );
      if (!meters) continue;
      const gr = panel.querySelector("[data-meter=gr]");
      const out = panel.querySelector("[data-meter=out]");
      if (gr) gr.value = meters.gainReduction;
      if (out) out.value = meters.output;
    }
    this.#frame = requestAnimationFrame(() => this.#updateMeters());
  }

  render() {
    const fxState = this.device.fxState;

    let template;

    if (!this.device.fxAvailable) {
      template = html`<p class="fx-unavailable">
        Channel strips and guitar amps are not available at
        ${this.device.sampleRate / 1000} kHz. Use a sample rate of 96 kHz or
        lower.
      </p>`;
    } else if (fxState.every(({ type }) => type === "off")) {
      template = html`No channel FX are enabled`;
    } else {
      template = html`${
        [0, 1, 2, 3, 4, 5].map(
          (channelIndex) => getFXTemplate(this.device, channelIndex, this),
        )
      }${this.status ? html`<p class="status">${this.status}</p>` : ""}`;
    }

    render(template, this);
  }
});
