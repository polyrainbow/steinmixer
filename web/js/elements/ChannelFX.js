import { html, render, live } from "../lit.js";

customElements.define("channel-fx", class SteinMixer extends HTMLElement {
  constructor() {
    super();
  }

  async connectedCallback() {
    this.render();
  }

  render() {
    const template = html`
      <h2>Channel 1: Channel strip</h2>
      <div class="settings">
        <select>
          <option>Insert</option>
          <option>Monitor</option>
        </select>

        <select>
          <option>Channel Strip</option>
          <option>Drive</option>
          <option>Lead</option>
        </select>

        <label>
          Q
          <input type="range">
        </label>
      
        <button>Disable</button>
      </div>
      `;

    render(template, this);
  }
});
