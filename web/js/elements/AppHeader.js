import { html, render, live } from "../lit.js";

customElements.define("app-header", class AppHeader extends HTMLElement {
  constructor() {
    super();
  }

  static observedAttributes = ["connection-name"];

  attributeChangedCallback() {
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const connectionName = this.getAttribute("connection-name") || null;

    const template = html`
      <h1>Steinmixer</h1>
      <div class="badge ${connectionName ? "connected" : "disconnected"}">${
        connectionName
          ? html`Connected with ${connectionName}`
          : html`Not connected`
      }</div>`;

    render(template, this);
  }
});
