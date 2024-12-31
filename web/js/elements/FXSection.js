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

    const template = html`
    <vu-meter
      channel-id=${
        type !== "analog"
          ? this.getAttribute("subchannel-id-l")
          : this.getAttribute("channel-id")
      }
    ></vu-meter>
    ${
      type !== "analog"
        ? html`<vu-meter
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
                  "channelId": this.getAttribute("channel-id"),
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
                      "channelId": this.getAttribute("channel-id"),
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
          </div>`
        : ""
    }
    `;

    render(template, this);
  }
});
