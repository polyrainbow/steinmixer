import { html, render, live } from "../lit.js";

customElements.define("pan-slider", class extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = ["pan", "channel-id", "active-mix"];

  attributeChangedCallback(name, oldValue, newValue) {
    if (["pan", "channel-id", "active-mix"].includes(name)) {
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const channelId = this.getAttribute("channel-id");
    const mix = this.getAttribute("active-mix");
    const pan = parseInt(this.getAttribute("pan"));

    const handleInput = (e) => {
      const newPan = parseInt(e.target.value);

      this.dispatchEvent(new CustomEvent("pan", {
        detail: {
          pan: newPan,
          channelId,
          mix,
        },
      }));

      this.render();
    };

    const handleDblClick = (e) => {
      const newPan = 0;

      this.dispatchEvent(new CustomEvent("pan", {
        detail: {
          pan: newPan,
          channelId,
          mix,
        },
      }));

      this.render();
    };

    const template = html`
    <input
      type="range"
      max="16"
      min="-16"
      .value=${live(pan)}
      @input=${handleInput}
      @dblclick=${handleDblClick}
    >
    <span>${pan === 0
      ? "C"
      : (pan > 0
        ? pan.toString() + "R"
        : Math.abs(pan).toString() + "L")}</span>`;

    render(template, this);
  }
});
