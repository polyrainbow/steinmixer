import { html, render, live } from "../lit.js";
import { getDBFSFromSliderValue } from "../UR44/utils.js";
import { getDBFSLabel } from "../utils.js";

customElements.define("send-slider", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = ["send", "channel-id", "active-mix"];

  attributeChangedCallback(name, oldValue, newValue) {
    if (["send", "channel-id", "active-mix"].includes(name)) {
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const channelId = this.getAttribute("channel-id");
    const mix = this.getAttribute("active-mix");
    const send = parseInt(this.getAttribute("send"));

    const handleInput = (e) => {
      const newSend = parseInt(e.target.value);

      this.dispatchEvent(new CustomEvent("send", {
        detail: {
          send: newSend,
          channelId,
          mix,
        },
      }));

      this.render();
    };

    const handleDblClick = (e) => {
      const newSend = 0;

      this.dispatchEvent(new CustomEvent("send", {
        detail: {
          send: newSend,
          channelId,
          mix,
        },
      }));

      this.render();
    };

    const template = html`
    <input
      type="range"
      max="127"
      min="0"
      .value=${live(send)}
      @input=${handleInput}
      @dblclick=${handleDblClick}
      title="Reverb send"
    >
    <span>${getDBFSLabel(send)}</span>`;

    render(template, this);
  }
});
