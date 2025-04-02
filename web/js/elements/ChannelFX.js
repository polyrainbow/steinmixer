import UR44, { AMP_TYPES } from "../devices/UR44.js";
import { html, render } from "../lit.js";

const getChannelStripTemplate = (channelIndex, device) => {
  const deviceSettings = device.settings;
  const channelTitle = UR44.INPUT_CHANNEL_TITLES[channelIndex];
  const stackIndex = device.fxState[channelIndex].stackIndex;

  return html`
    <div class="channel-fx-panel">
      <h2>${channelTitle}: Channel strip</h2>
      <div class="settings-group">
        <div class="settings">
          <h3>Compressor</h3>
          <label>
            Attack
            <input
              type="range"
              min="57"
              max="283"
              value="${deviceSettings["ChannelStripCompAttack"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripCompAttack",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Release
            <input
              type="range"
              min="24"
              max="300"
              value="${deviceSettings["ChannelStripCompRelease"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripCompRelease",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Ratio
            <input
              type="range"
              min="0"
              max="120"
              value="${deviceSettings["ChannelStripCompRatio"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripCompRatio",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Knee
            <input
              type="range"
              min="0"
              max="2"
              value="${deviceSettings["ChannelStripCompKnee"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripCompKnee",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
        </div>
        <div class="settings">
          <h3>Sidechain</h3>
          <label>
            Q
            <input
              type="range"
              min="0"
              max="60"
              value="${deviceSettings["ChannelStripCompSideChQ"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripCompSideChQ",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            F
            <input
              type="range"
              min="4"
              max="124"
              value="${deviceSettings["ChannelStripCompSideChFreq"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripCompSideChFreq",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            G
            <input
              type="range"
              min="0"
              max="360"
              value="${deviceSettings["ChannelStripCompSideChGain"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripCompSideChGain",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Drive
            <input
              type="range"
              min="0"
              max="200"
              value="${deviceSettings["ChannelStripCompDrive"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripCompDrive",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
        </div>
        <div class="settings">
          <h3>Equalizer</h3>
          <h4>Low</h4>
          <label>
            Frequency
            <input
              type="range"
              min="4"
              max="72"
              value="${deviceSettings["ChannelStripEQLowFreq"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripEQLowFreq",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Gain
            <input
              type="range"
              min="0"
              max="360"
              value="${deviceSettings["ChannelStripEQLowGain"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripEQLowGain",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
        </div>
        <div class="settings">
          <h4>Mid</h4>
          <label>
            Q
            <input
              type="range"
              min="0"
              max="60"
              value="${deviceSettings["ChannelStripEQMidQ"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripEQMidQ",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Frequency
            <input
              type="range"
              min="4"
              max="72"
              value="${deviceSettings["ChannelStripEQMidFreq"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripEQMidFreq",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Gain
            <input
              type="range"
              min="0"
              max="360"
              value="${deviceSettings["ChannelStripEQMidGain"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripEQMidGain",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
        </div>
        <div class="settings">
          <h4>High</h4>
          <label>
            Frequency
            <input
              type="range"
              min="60"
              max="124"
              value="${deviceSettings["ChannelStripEQHighFreq"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripEQHighFreq",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Gain
            <input
              type="range"
              min="0"
              max="360"
              value="${deviceSettings["ChannelStripEQHighGain"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripEQHighGain",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
        </div>
        <div class="settings">
          <label>
            Total Gain
            <input
              type="range"
              min="0"
              max="360"
              value="${deviceSettings["ChannelStripTotalGain"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripTotalGain",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
          <label>
            Morphing
            <input
              type="range"
              min="0"
              max="200"
              value="${deviceSettings["ChannelStripMorphing"]}"
              @change=${(e) => {
                const value = e.target.value;
                device.updateParamValue(
                  "ChannelStripMorphing",
                  parseInt(value),
                  stackIndex,
                );
              }}
            >
          </label>
        </div>
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


const getFXTemplate = (device, channelIndex) => {
  const settings = device.settings;
  const { type } = device.fxState[channelIndex];
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
    return getChannelStripTemplate(channelIndex, device);
  } else {
    throw new Error(
      "Unknown FX type: " + type,
    );
  }
};

customElements.define("channel-fx", class SteinMixer extends HTMLElement {
  constructor() {
    super();
  }

  async connectedCallback() {
    this.render();
  }

  render() {
    const fxState = this.device.fxState;

    let template;

    if (fxState.every(({ type }) => type === "off")) {
      template = html`No channel FX are enabled`;
    } else {
      template = html`${
        [0,1,2,3,4,5].map(
          channelIndex => getFXTemplate(this.device, channelIndex),
        )
      }`;
    }

    render(template, this);
  }
});
