import { html, render, live } from "../lit.js";
import { getDBFSLabel } from "../utils.js";
import {
  REVERB_TIME_MAX_INDEX,
  reverbTimeToSeconds,
  secondsToReverbTime,
  formatSeconds,
  formatInitialDelay,
  formatReverbFreq,
  formatReverbRatio,
} from "../devices/reverbMath.js";
import "./ReverbGraph.js";


customElements.define("master-reverb", class extends HTMLElement {
  /*
    The reverb time the user has chosen. Changing type or room size changes
    the time range, so we pick the raw time value closest to this time.
    It is only valid as long as type, room size and raw time are unchanged,
    otherwise (e.g. after loading a scene) the current time is used.
  */
  #chosenTime = null;

  static observedAttributes = [
    "active-mix",
  ];

  attributeChangedCallback() {
    this.render();
  }

  connectedCallback() {
    this.id = "master-reverb";
    this.classList.add("side-panel");
    this.render();
  }

  #set(paramName, value) {
    this.device.updateParamValue(paramName, value);
    this.render();
  }

  #currentSeconds() {
    const s = this.device.settings;
    return reverbTimeToSeconds(s.ReverbType, s.ReverbRoomSize, s.ReverbTime);
  }

  #rememberTime(seconds) {
    const s = this.device.settings;
    this.#chosenTime = {
      seconds,
      type: s.ReverbType,
      roomSize: s.ReverbRoomSize,
      time: s.ReverbTime,
    };
  }

  #chosenSeconds() {
    const s = this.device.settings;
    const chosen = this.#chosenTime;
    if (
      chosen
      && chosen.type === s.ReverbType
      && chosen.roomSize === s.ReverbRoomSize
      && chosen.time === s.ReverbTime
    ) {
      return chosen.seconds;
    }
    return this.#currentSeconds();
  }

  #setTime(value) {
    this.device.updateParamValue("ReverbTime", value);
    this.#rememberTime(this.#currentSeconds());
    this.render();
  }

  // Sets type or room size and keeps the reverb time as close as possible.
  #setSpace(paramName, value) {
    const seconds = this.#chosenSeconds();
    this.device.updateParamValue(paramName, value);
    const s = this.device.settings;
    const time = secondsToReverbTime(s.ReverbType, s.ReverbRoomSize, seconds);
    if (time !== s.ReverbTime) {
      this.device.updateParamValue("ReverbTime", time);
    }
    this.#rememberTime(seconds);
    this.render();
  }

  #slider({
    param,
    label,
    format = String,
    hint,
    onChange = (value) => this.#set(param, value),
  }) {
    const spec = this.device.params.get(param);
    const value = this.device.settings[param];
    return html`<label>
      ${label}
      ${hint ? html`<span class="description">${hint}</span>` : ""}
      <input
        type="range"
        min=${spec.min}
        max=${spec.max}
        step="1"
        title="Double-click to reset"
        .value=${live(value)}
        aria-valuetext=${format(value)}
        @input=${(e) => onChange(parseInt(e.target.value))}
        @dblclick=${() => onChange(spec.defaultValue)}
      >
      <span class="value">${format(value)}</span>
    </label>`;
  }

  render() {
    const mix = parseInt(this.getAttribute("active-mix"));
    const s = this.device.settings;
    const minTime = reverbTimeToSeconds(s.ReverbType, s.ReverbRoomSize, 0);
    const maxTime = reverbTimeToSeconds(
      s.ReverbType, s.ReverbRoomSize, REVERB_TIME_MAX_INDEX,
    );

    const template = html`
      <h2>Reverb</h2>
      <reverb-graph .settings=${{ ...s }}></reverb-graph>
      <section class="settings">
        <fieldset>
          <legend>Routing</legend>
          <label>
            Input Mix
            <span class="description">
              The sends of the selected mix will be fed into the reverb
            </span>
            <select
              @change=${(e) => {
                this.#set("ReverbInputMix", parseInt(e.target.value));
              }}
              .value=${live(String(s.ReverbInputMix))}
            >
              <option value="0">Mix 1</option>
              <option value="1">Mix 2</option>
            </select>
          </label>
          ${this.#slider({
            param: `Mix${mix}ReverbVolume`,
            label: `Return level (Mix ${mix + 1})`,
            format: (val) => getDBFSLabel(
              val,
              (v) => this.device.getDBFSFromSliderValue(v),
            ),
          })}
        </fieldset>

        <fieldset>
          <legend>Space</legend>
          <label>
            Type
            <select
              @change=${(e) => {
                this.#setSpace("ReverbType", parseInt(e.target.value));
              }}
              .value=${live(String(s.ReverbType))}
            >
              <option value="0">Hall</option>
              <option value="1">Room</option>
              <option value="2">Plate</option>
            </select>
          </label>
          ${this.#slider({
            param: "ReverbRoomSize",
            label: "Room Size",
            onChange: (value) => this.#setSpace("ReverbRoomSize", value),
          })}
          ${this.#slider({
            param: "ReverbTime",
            label: "Time",
            hint: `${formatSeconds(minTime)} – ${formatSeconds(maxTime)}`,
            format: (val) => formatSeconds(
              reverbTimeToSeconds(s.ReverbType, s.ReverbRoomSize, val),
            ),
            onChange: (value) => this.#setTime(value),
          })}
          ${this.#slider({
            param: "ReverbInitialDelay",
            label: "Pre-delay",
            format: formatInitialDelay,
          })}
          ${this.#slider({
            param: "ReverbDecay",
            label: "Decay",
            hint: "Shape of the reverb envelope",
          })}
          ${this.#slider({
            param: "ReverbDiffusion",
            label: "Diffusion",
            hint: "Spread of the reverb",
          })}
        </fieldset>

        <fieldset>
          <legend>Tone</legend>
          ${this.#slider({
            param: "ReverbHPF",
            label: "High-pass",
            format: formatReverbFreq,
          })}
          ${this.#slider({
            param: "ReverbLPF",
            label: "Low-pass",
            format: formatReverbFreq,
          })}
          ${this.#slider({
            param: "ReverbHighRatio",
            label: "High decay",
            hint: "Decay time of the highs, relative to Time",
            format: formatReverbRatio,
          })}
          ${this.#slider({
            param: "ReverbLowRatio",
            label: "Low decay",
            hint: "Decay time below Low freq, relative to Time",
            format: (val) => `${formatReverbRatio(val)} below ${
              formatReverbFreq(s.ReverbLowFreq)
            }`,
          })}
          ${this.#slider({
            param: "ReverbLowFreq",
            label: "Low freq",
            format: formatReverbFreq,
          })}
        </fieldset>
      </section>
    `;

    render(template, this);
  }
});
