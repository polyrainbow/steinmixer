import { html, render, live } from "../lit.js";
import {
  SceneLibrary,
  SLOT_COUNT,
  MAX_NAME_LENGTH,
  normalizeName,
  exportUR44File,
  importUR44File,
} from "../scenes.js";

/*
  <scene-manager>: store/recall scenes like dspMixFx does.

  Properties:
    .device   object with captureScene() and recallScene({ dump, extras })
    .library  SceneLibrary (a default one using localStorage is created if
              none is set)

  Events (bubbling):
    scene-recalled  detail { slot, name }
    scene-stored    detail { slot, name }

  Call markModified() whenever the user changes a parameter.
*/

let instanceCount = 0;

const pad = (slot) => String(slot).padStart(2, "0");

const slotLabel = ({ slot, name }) => `${pad(slot)}  ${name ?? "---"}`;

const errorMessage = (e) => (e instanceof Error ? e.message : String(e));

const fileName = () => {
  const date = new Date().toISOString().slice(0, 10);
  return `Steinmixer ${date}.UR44`;
};

customElements.define(
  "scene-manager",
  class SceneManager extends HTMLElement {
    #device = null;
    #library = null;
    #busy = false;
    #recalling = false;
    // null | "store" | "rename" | "clear" | "initialize" | "open" | "import"
    #mode = null;
    #form = {};
    #status = null;
    #selectedSlot = 1;
    #fileAction = null;
    #focusId = null;
    #returnFocusId = null;
    #idPrefix;
    #onLibraryChange = () => this.render();

    constructor() {
      super();
      instanceCount += 1;
      this.#idPrefix = `scene-manager-${instanceCount}`;
    }

    get device() {
      return this.#device;
    }

    set device(device) {
      this.#device = device ?? null;
      this.render();
    }

    get library() {
      if (!this.#library) this.library = new SceneLibrary();
      return this.#library;
    }

    set library(library) {
      if (this.#library === library) return;
      this.#library?.removeEventListener("change", this.#onLibraryChange);
      this.#library = library ?? null;
      if (this.isConnected) {
        this.#library?.addEventListener("change", this.#onLibraryChange);
      }
      this.render();
    }

    connectedCallback() {
      // properties set before the element was upgraded shadow the accessors
      for (const prop of ["device", "library"]) {
        if (Object.hasOwn(this, prop)) {
          const value = this[prop];
          delete this[prop];
          this[prop] = value;
        }
      }
      this.library.removeEventListener("change", this.#onLibraryChange);
      this.library.addEventListener("change", this.#onLibraryChange);
      this.render();
    }

    disconnectedCallback() {
      this.#library?.removeEventListener("change", this.#onLibraryChange);
    }

    /* Call whenever the user changes a parameter of the device. */
    markModified() {
      // a recall changes parameters, too, that's not a modification
      if (this.#recalling) return;
      this.library.markModified();
    }

    #id(name) {
      return `${this.#idPrefix}-${name}`;
    }

    #setStatus(type, text) {
      this.#status = { type, text };
    }

    #openPanel(mode, form, focusName, returnFocusName) {
      this.#mode = mode;
      this.#form = form;
      this.#focusId = this.#id(focusName);
      this.#returnFocusId = returnFocusName ? this.#id(returnFocusName) : null;
      this.render();
    }

    #closePanel() {
      this.#mode = null;
      this.#form = {};
      this.#focusId = this.#returnFocusId;
      this.#returnFocusId = null;
      this.render();
    }

    async #run(busyText, errorPrefix, task) {
      if (this.#busy) return;
      this.#busy = true;
      this.#setStatus("busy", busyText);
      this.render();
      try {
        await task();
      } catch (e) {
        this.#setStatus("error", `${errorPrefix}: ${errorMessage(e)}`);
      } finally {
        this.#busy = false;
        this.render();
      }
    }

    /* runs a synchronous library operation, reporting errors */
    #apply(task) {
      try {
        task();
      } catch (e) {
        this.#setStatus("error", errorMessage(e));
        this.render();
        return false;
      }
      return true;
    }

    async #recall() {
      const slot = this.#selectedSlot;
      const entry = this.library.get(slot);
      if (!entry || !this.device) return;
      await this.#run(
        `Recalling scene ${pad(slot)} "${entry.name}"…`,
        "Recall failed",
        async () => {
          this.#recalling = true;
          try {
            await this.device.recallScene(entry.scene);
          } finally {
            this.#recalling = false;
          }
          this.library.setCurrent(slot, entry.name);
          this.#setStatus(
            "info",
            `Recalled scene ${pad(slot)} "${entry.name}".`,
          );
          this.dispatchEvent(new CustomEvent("scene-recalled", {
            bubbles: true,
            detail: { slot, name: entry.name },
          }));
        },
      );
    }

    #startStore() {
      if (this.#mode === "store") {
        this.#focusId = this.#id("store-name");
        this.render();
        return;
      }
      const current = this.library.current;
      const slot = this.#selectedSlot;
      const name = this.library.get(slot)?.name
        ?? current.name
        ?? `Scene ${pad(slot)}`;
      this.#openPanel("store", { name, slot }, "store-name", "store-button");
    }

    async #store() {
      const { slot } = this.#form;
      let name;
      try {
        name = normalizeName(this.#form.name ?? "");
      } catch (e) {
        this.#setStatus("error", errorMessage(e));
        this.render();
        return;
      }
      if (!this.device) return;
      await this.#run(
        `Storing scene ${pad(slot)} "${name}"…`,
        "Store failed",
        async () => {
          const scene = await this.device.captureScene();
          const stored = this.library.store(slot, name, scene);
          this.library.setCurrent(slot, stored);
          this.#selectedSlot = slot;
          this.#closePanel();
          this.#setStatus("info", `Stored scene ${pad(slot)} "${stored}".`);
          this.dispatchEvent(new CustomEvent("scene-stored", {
            bubbles: true,
            detail: { slot, name: stored },
          }));
        },
      );
    }

    #rename() {
      const { slot, name } = this.#form;
      let newName;
      const ok = this.#apply(() => {
        newName = this.library.rename(slot, name ?? "");
      });
      if (!ok) return;
      this.#setStatus("info", `Renamed scene ${pad(slot)} to "${newName}".`);
      this.#closePanel();
    }

    #clear() {
      const { slot } = this.#form;
      if (!this.#apply(() => this.library.clear(slot))) return;
      this.#setStatus("info", `Cleared scene slot ${pad(slot)}.`);
      this.#closePanel();
    }

    #initialize() {
      if (!this.#apply(() => this.library.initializeAll())) return;
      this.#setStatus("info", "All scenes were initialized.");
      this.#closePanel();
    }

    async #saveFile() {
      await this.#run("Preparing scene file…", "Saving failed", async () => {
        // the current device state goes into the file's <CurrentScene>
        let current;
        if (this.device?.captureScene) {
          try {
            current = await this.device.captureScene();
          } catch {
            current = undefined;
          }
        }
        const text = exportUR44File(this.library, { current });
        const blob = new Blob([text], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName();
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        const count = this.library.list().filter((s) => !s.empty).length;
        this.#setStatus(
          "info",
          `Saved ${count} scene${count === 1 ? "" : "s"} to "${link.download}".`,
        );
      });
    }

    #pickFile(action) {
      this.#fileAction = action;
      const input = this.querySelector(`#${this.#id("file-input")}`);
      input.value = "";
      input.click();
    }

    async #onFileChosen(input) {
      const file = input.files?.[0];
      const action = this.#fileAction;
      input.value = "";
      if (!file || !action) return;
      let result;
      try {
        result = importUR44File(await file.text());
      } catch (e) {
        this.#setStatus("error", `Could not read "${file.name}": ${
          errorMessage(e)}`);
        this.render();
        return;
      }
      if (result.scenes.length === 0) {
        const reason = result.errors[0]?.message ?? "no scenes found";
        this.#setStatus(
          "error",
          `"${file.name}" contains no usable scenes (${reason}).`,
        );
        this.#mode = null;
        this.render();
        return;
      }
      this.#status = null;
      const returnFocus = action === "open" ? "open-button" : "import-button";
      if (action === "open") {
        this.#openPanel(
          "open",
          { fileName: file.name, result },
          "open-cancel",
          returnFocus,
        );
      } else {
        const index = Math.max(
          0,
          result.scenes.findIndex((s) => s.slot === this.#selectedSlot),
        );
        this.#openPanel(
          "import",
          { fileName: file.name, result, index, slot: this.#selectedSlot },
          "import-scene",
          returnFocus,
        );
      }
    }

    #openFile() {
      const { result, fileName: name } = this.#form;
      if (!this.#apply(() => this.library.replaceAll(result.scenes))) return;
      const count = result.scenes.length;
      this.#setStatus(
        "info",
        `Loaded ${count} scene${count === 1 ? "" : "s"} from "${name}".`,
      );
      this.#closePanel();
    }

    #importScene() {
      const { result, index, slot } = this.#form;
      const scene = result.scenes[index];
      if (!scene) return;
      let stored;
      const ok = this.#apply(() => {
        stored = this.library.store(slot, scene.name, scene.scene);
      });
      if (!ok) return;
      this.#selectedSlot = slot;
      this.#setStatus(
        "info",
        `Imported "${stored}" into slot ${pad(slot)}.`,
      );
      this.#closePanel();
    }

    #slotOptions(slots, selected) {
      return slots.map((s) => html`
        <option value=${s.slot} .selected=${live(s.slot === selected)}>${
          slotLabel(s)
        }</option>
      `);
    }

    #overwriteWarning(slots, slot) {
      const target = slots[slot - 1];
      if (!target || target.empty) return html``;
      return html`<p class="scene-warning" id=${this.#id("overwrite")}>
        Slot ${pad(slot)} already contains "${target.name}", it will be
        overwritten.
      </p>`;
    }

    #renderErrors(errors) {
      if (errors.length === 0) return html``;
      return html`
        <details class="scene-import-errors">
          <summary>${errors.length} invalid
            ${errors.length === 1 ? "entry was" : "entries were"} skipped
          </summary>
          <ul>${errors.map((e) => html`<li>${e.message}</li>`)}</ul>
        </details>
      `;
    }

    #renderPanel(slots) {
      const form = this.#form;
      const id = (name) => this.#id(name);
      const onKeydown = (e) => {
        if (e.key === "Escape" && !this.#busy) {
          e.preventDefault();
          this.#closePanel();
        }
      };
      const submit = (handler) => (e) => {
        e.preventDefault();
        handler();
      };
      const cancel = (name) => html`
        <button type="button" id=${id(name)}
          @click=${() => this.#closePanel()}>Cancel</button>
      `;

      switch (this.#mode) {
      case "store": {
        const occupied = !slots[form.slot - 1]?.empty;
        return html`
          <form class="scene-panel" aria-labelledby=${id("store-title")}
            @submit=${submit(() => this.#store())} @keydown=${onKeydown}>
            <fieldset ?disabled=${this.#busy}>
              <h3 id=${id("store-title")}>Store current settings</h3>
              <div class="scene-field">
                <label for=${id("store-name")}>Name</label>
                <input id=${id("store-name")} type="text" required
                  maxlength=${MAX_NAME_LENGTH} autocomplete="off"
                  .value=${live(form.name)}
                  @input=${(e) => { form.name = e.target.value; }}>
              </div>
              <div class="scene-field">
                <label for=${id("store-slot")}>Slot</label>
                <select id=${id("store-slot")}
                  aria-describedby=${occupied ? id("overwrite") : ""}
                  @change=${(e) => {
                    form.slot = parseInt(e.target.value);
                    this.render();
                  }}>
                  ${this.#slotOptions(slots, form.slot)}
                </select>
              </div>
              ${this.#overwriteWarning(slots, form.slot)}
              <div class="scene-actions">
                <button type="submit" class="primary">${
                  occupied ? `Overwrite slot ${pad(form.slot)}` : "Store"
                }</button>
                ${cancel("store-cancel")}
              </div>
            </fieldset>
          </form>
        `;
      }
      case "rename":
        return html`
          <form class="scene-panel" aria-labelledby=${id("rename-title")}
            @submit=${submit(() => this.#rename())} @keydown=${onKeydown}>
            <h3 id=${id("rename-title")}>Rename scene ${pad(form.slot)}</h3>
            <div class="scene-field">
              <label for=${id("rename-name")}>New name</label>
              <input id=${id("rename-name")} type="text" required
                maxlength=${MAX_NAME_LENGTH} autocomplete="off"
                .value=${live(form.name)}
                @input=${(e) => { form.name = e.target.value; }}>
            </div>
            <div class="scene-actions">
              <button type="submit" class="primary">Rename</button>
              ${cancel("rename-cancel")}
            </div>
          </form>
        `;
      case "clear":
        return html`
          <form class="scene-panel scene-confirm"
            aria-labelledby=${id("clear-title")}
            @submit=${submit(() => this.#clear())} @keydown=${onKeydown}>
            <p id=${id("clear-title")}>
              Clear slot ${pad(form.slot)} "${form.name}"?
            </p>
            <div class="scene-actions">
              <button type="submit" class="danger">Clear slot</button>
              ${cancel("clear-cancel")}
            </div>
          </form>
        `;
      case "initialize":
        return html`
          <form class="scene-panel scene-confirm"
            aria-labelledby=${id("init-title")}
            @submit=${submit(() => this.#initialize())} @keydown=${onKeydown}>
            <p id=${id("init-title")}>
              Delete all ${SLOT_COUNT} stored scenes? This can't be undone,
              save a file first to keep them.
            </p>
            <div class="scene-actions">
              <button type="submit" class="danger">Initialize all scenes</button>
              ${cancel("init-cancel")}
            </div>
          </form>
        `;
      case "open": {
        const count = form.result.scenes.length;
        return html`
          <form class="scene-panel scene-confirm"
            aria-labelledby=${id("open-title")}
            @submit=${submit(() => this.#openFile())} @keydown=${onKeydown}>
            <p id=${id("open-title")}>
              "${form.fileName}" contains ${count}
              scene${count === 1 ? "" : "s"}. Replace all scenes in the
              library with them?
            </p>
            ${this.#renderErrors(form.result.errors)}
            <div class="scene-actions">
              <button type="submit" class="danger">Replace all scenes</button>
              ${cancel("open-cancel")}
            </div>
          </form>
        `;
      }
      case "import": {
        const scenes = form.result.scenes;
        const occupied = !slots[form.slot - 1]?.empty;
        return html`
          <form class="scene-panel" aria-labelledby=${id("import-title")}
            @submit=${submit(() => this.#importScene())}
            @keydown=${onKeydown}>
            <h3 id=${id("import-title")}>
              Import a scene from "${form.fileName}"
            </h3>
            <div class="scene-field">
              <label for=${id("import-scene")}>Scene in file</label>
              <select id=${id("import-scene")}
                @change=${(e) => {
                  form.index = parseInt(e.target.value);
                }}>
                ${scenes.map((s, i) => html`
                  <option value=${i} .selected=${live(i === form.index)}>${
                    slotLabel(s)
                  }</option>
                `)}
              </select>
            </div>
            <div class="scene-field">
              <label for=${id("import-slot")}>Into slot</label>
              <select id=${id("import-slot")}
                aria-describedby=${occupied ? id("overwrite") : ""}
                @change=${(e) => {
                  form.slot = parseInt(e.target.value);
                  this.render();
                }}>
                ${this.#slotOptions(slots, form.slot)}
              </select>
            </div>
            ${this.#overwriteWarning(slots, form.slot)}
            ${this.#renderErrors(form.result.errors)}
            <div class="scene-actions">
              <button type="submit" class="primary">${
                occupied ? `Import and overwrite slot ${pad(form.slot)}` : "Import"
              }</button>
              ${cancel("import-cancel")}
            </div>
          </form>
        `;
      }
      default:
        return html``;
      }
    }

    render() {
      if (!this.isConnected) return;
      const library = this.library;
      const slots = library.list();
      const current = library.current;
      const selected = slots[this.#selectedSlot - 1];
      const busy = this.#busy;
      const hasDevice = Boolean(this.device);
      const id = (name) => this.#id(name);
      const status = this.#status;

      const template = html`
        <section class="scene-manager" aria-labelledby=${id("title")}
          aria-busy=${busy ? "true" : "false"}>
          <h2 id=${id("title")}>Scenes</h2>

          <p class="scene-current">
            <span class="scene-current-label">Current scene</span>
            <span class="scene-current-name">${
              current.name ?? "None"
            }</span>
            ${current.slot !== null
              ? html`<span class="scene-current-slot">
                (slot ${pad(current.slot)})</span>`
              : html``}
            ${current.modified
              ? html`<span class="scene-modified"
                title="Parameters were changed since this scene was recalled or stored"
              >(modified)</span>`
              : html``}
          </p>

          <div class="scene-row">
            <label for=${id("slot")}>Scene</label>
            <select id=${id("slot")} ?disabled=${busy}
              @change=${(e) => {
                this.#selectedSlot = parseInt(e.target.value);
                if (this.#mode === "rename" || this.#mode === "clear") {
                  this.#mode = null;
                }
                this.render();
              }}>
              ${this.#slotOptions(slots, this.#selectedSlot)}
            </select>
            <button type="button" class="primary" id=${id("recall-button")}
              ?disabled=${busy || !hasDevice || selected.empty}
              @click=${() => this.#recall()}>Recall</button>
            <button type="button" id=${id("store-button")}
              ?disabled=${busy || !hasDevice}
              aria-expanded=${this.#mode === "store" ? "true" : "false"}
              @click=${() => this.#startStore()}>Store…</button>
            <button type="button" id=${id("rename-button")}
              ?disabled=${busy || selected.empty}
              @click=${() => this.#openPanel(
                "rename",
                { slot: selected.slot, name: selected.name },
                "rename-name",
                "rename-button",
              )}>Rename…</button>
            <button type="button" id=${id("clear-button")}
              ?disabled=${busy || selected.empty}
              @click=${() => this.#openPanel(
                "clear",
                { slot: selected.slot, name: selected.name },
                "clear-cancel",
                "clear-button",
              )}>Clear…</button>
          </div>

          ${this.#renderPanel(slots)}

          <div class="scene-row scene-file-row">
            <button type="button" id=${id("save-button")} ?disabled=${busy}
              @click=${() => this.#saveFile()}>Save file</button>
            <button type="button" id=${id("open-button")} ?disabled=${busy}
              @click=${() => this.#pickFile("open")}>Open file…</button>
            <button type="button" id=${id("import-button")} ?disabled=${busy}
              @click=${() => this.#pickFile("import")}>Import scene…</button>
            <button type="button" id=${id("init-button")} ?disabled=${busy}
              @click=${() => this.#openPanel(
                "initialize",
                {},
                "init-cancel",
                "init-button",
              )}>Initialize all scenes…</button>
            <input type="file" id=${id("file-input")} hidden tabindex="-1"
              accept=".UR44,.ur44,.xml" aria-label="Scene file"
              @change=${(e) => this.#onFileChosen(e.target)}>
          </div>

          <p class="scene-status ${status?.type ?? ""}" role="status"
            aria-live="polite">${status?.text ?? ""}</p>
          ${library.persistent
            ? html``
            : html`<p class="scene-note">
              Scenes can't be saved in this browser and will be lost when
              the page is closed. Use "Save file" to keep them.
            </p>`}
        </section>
      `;

      render(template, this);

      if (this.#focusId) {
        const target = this.querySelector(`#${this.#focusId}`);
        const disabled = target?.matches(":disabled") ?? false;
        if (!disabled) {
          this.#focusId = null;
          target?.focus();
        } else if (!busy) {
          // e.g. "Clear…" after clearing the slot
          this.#focusId = null;
          this.querySelector(`#${id("slot")}`).focus();
        }
        // else: busy, focus the target when it is enabled again
      }
    }
  },
);
