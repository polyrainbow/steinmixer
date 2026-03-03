import { html, render } from "../lit.js";

const STORAGE_KEY = "steinmixer-presets";
const READ_ONLY_PARAMS = ["PhantomPower01", "PhantomPower23"];

customElements.define("preset-panel", class PresetPanel extends HTMLElement {
  device;
  presetName = "";

  connectedCallback() {
    this.render();
  }

  getPresets() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  savePresets(presets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }

  saveCurrentState() {
    const name = this.presetName.trim();
    if (!name) return;

    const settings = {};
    for (const key of Object.keys(this.device.settings)) {
      if (!READ_ONLY_PARAMS.includes(key)) {
        settings[key] = this.device.settings[key];
      }
    }

    const preset = {
      name,
      timestamp: new Date().toISOString(),
      settings,
      fxState: JSON.parse(JSON.stringify(this.device.fxState)),
      channelStripSettings: JSON.parse(
        JSON.stringify(this.device.channelStripSettings),
      ),
    };

    const presets = this.getPresets();
    presets.push(preset);
    this.savePresets(presets);
    this.presetName = "";
    this.render();
  }

  loadPreset(preset) {
    this.dispatchEvent(new CustomEvent("load-preset", {
      detail: { preset },
      bubbles: true,
    }));
  }

  deletePreset(index) {
    const presets = this.getPresets();
    presets.splice(index, 1);
    this.savePresets(presets);
    this.render();
  }

  exportPresets() {
    const presets = this.getPresets();
    if (presets.length === 0) return;

    const blob = new Blob(
      [JSON.stringify(presets, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "presets.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  importPresets() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!Array.isArray(imported)) {
            alert("Invalid preset file format.");
            return;
          }
          const existing = this.getPresets();
          const existingKeys = new Set(
            existing.map(p => p.name + "|" + p.timestamp),
          );
          const merged = [...existing];
          for (const preset of imported) {
            const key = preset.name + "|" + preset.timestamp;
            if (!existingKeys.has(key)) {
              merged.push(preset);
              existingKeys.add(key);
            }
          }
          this.savePresets(merged);
          this.render();
        } catch {
          alert("Failed to parse preset file.");
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  render() {
    const presets = this.getPresets();

    const template = html`
      <h2>Presets</h2>
      <div class="preset-save">
        <input
          type="text"
          placeholder="Preset name"
          .value=${this.presetName}
          @input=${(e) => { this.presetName = e.target.value; }}
          @keydown=${(e) => { if (e.key === "Enter") this.saveCurrentState(); }}
        >
        <button @click=${() => this.saveCurrentState()}>
          Save current state
        </button>
      </div>
      ${presets.length > 0 ? html`
        <div class="preset-list">
          ${presets.map((preset, index) => html`
            <div class="preset-item">
              <div class="preset-info">
                <span class="preset-name">${preset.name}</span>
                <span class="preset-date">
                  ${new Date(preset.timestamp).toLocaleString()}
                </span>
              </div>
              <div class="preset-actions">
                <button @click=${() => this.loadPreset(preset)}>Load</button>
                <button @click=${() => this.deletePreset(index)}>Delete</button>
              </div>
            </div>
          `)}
        </div>
      ` : html`<p class="preset-empty">No saved presets.</p>`}
      <div class="preset-io">
        <button @click=${() => this.exportPresets()}>Export all presets</button>
        <button @click=${() => this.importPresets()}>Import presets</button>
      </div>
    `;

    render(template, this);
  }
});
