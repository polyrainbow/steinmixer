import { html, render } from "../lit.js";

/*
  One mixer channel. type: "analog", "stereo" (linked pair of analog inputs,
  shown as one channel like dspMixFx does), "daw" or "master".
*/
customElements.define("channel-strip", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = [
    "phantom-power-enabled",
    "channel-id",
    "channel-id-r",
    "active-mix",
    "volume",
    "pan",
    "pan-r",
    "mute",
    "solo",
    "hpf-enabled",
    "invert-phase-enabled",
    "invert-phase-r-enabled",
    "reverb-send",
    "title",
  ];

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const type = this.getAttribute("type");
    const attr = (name) => this.getAttribute(name);

    const panSlider = (channelId, pan, label) => html`<pan-slider
      .device=${this.device}
      channel-id=${channelId}
      active-mix=${attr("active-mix")}
      pan=${pan}
      label=${label}
    ></pan-slider>`;

    let sendTemplate;
    if (type === "analog" || type === "stereo" || type === "daw") {
      sendTemplate = html`<send-slider
        .device=${this.device}
        send=${attr("reverb-send")}
        channel-id=${attr("channel-id")}
      ></send-slider>`;
    } else {
      sendTemplate = html`<a
        class="button master-reverb"
        href="#master-reverb"
      >Reverb<br>settings</a>`;
    }

    const template = html`
    <fx-section
      .device=${this.device}
      type=${type}
      channel-id=${attr("channel-id")}
      channel-id-r=${attr("channel-id-r") ?? ""}
      subchannel-id-l=${attr("subchannel-id-l")}
      subchannel-id-r=${attr("subchannel-id-r")}
      active-mix=${attr("active-mix")}
      hpf-available=${attr("hpf-available")}
      hpf-enabled=${attr("hpf-enabled")}
      invert-phase-enabled=${attr("invert-phase-enabled")}
      invert-phase-r-enabled=${attr("invert-phase-r-enabled") ?? ""}
    ></fx-section>
    ${sendTemplate}
    ${type === "stereo"
      ? html`<div class="pan-pair">
        ${panSlider(attr("channel-id"), attr("pan"), "Pan L")}
        ${panSlider(attr("channel-id-r"), attr("pan-r"), "Pan R")}
      </div>`
      : panSlider(attr("channel-id"), attr("pan"), "Pan")}
    <volume-slider
      .device=${this.device}
      type=${type}
      phantom-power-available=${attr("phantom-power-available") === "true"}
      phantom-power-enabled=${attr("phantom-power-enabled")}
      channel-id=${attr("channel-id")}
      active-mix=${attr("active-mix")}
      volume=${attr("volume")}
      mute=${attr("mute")}
      solo=${attr("solo")}
    ></volume-slider>
    <span class="title">${attr("title")}</span>`;

    render(template, this);
  }
});
