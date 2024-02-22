/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import '../protocol/comlink-stream.js';
import {LitElement, html, css, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import * as comlink from 'comlink';
import {ifDefined} from 'lit/directives/if-defined.js';
import {Deferred} from '../util/deferred.js';
import './ignition-stage.js';
import type {
  ApiToWebview,
  BoundingBoxWithDepth,
} from '../frame/iframe-api-to-webview.js';
import type {ModeChangeEvent} from './ignition-toolbar.js';
import './ignition-toolbar.js';

/**
 * Renders the UI that runs in the webview and communicates with the stories
 * iframe.
 */
@customElement('ignition-ui')
export class IgnitionUi extends LitElement {
  static styles = css`
    :host {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    ignition-toolbar {
      /* should not grow or shrink */
      flex: 0 0 auto;
    }
    ignition-stage {
      /* should flex to grow or shrink */
      flex: 1;
    }
    iframe {
      border: none;
      outline: none;
      width: 100%;
    }
  `;

  @property()
  storyUrl?: string;

  #frameApi?: comlink.Remote<ApiToWebview>;

  @state() private boxesInPageToHighlight: BoundingBoxWithDepth[] = [];
  #frameApiChanged = new Deferred<void>();

  @state() private mode: 'interact' | 'select' = 'select';

  override render() {
    if (this.storyUrl == null) {
      return html`<p>No story URL provided.</p>`;
    }
    return html`
      <ignition-toolbar
        .mode=${this.mode}
        @mode-change=${this.#modeChanged}
      ></ignition-toolbar>
      <ignition-stage
        .boxesInPageToHighlight=${this.boxesInPageToHighlight}
        .blockInput=${this.mode !== 'interact'}
        @mousemove=${this.#onStageMouseMove}
        @mouseout=${() => (this.boxesInPageToHighlight = [])}
      >
        <iframe
          src=${ifDefined(this.storyUrl)}
          @load=${this.#onFrameLoad}
          @error=${this.#onFrameError}
        ></iframe>
      </ignition-stage>
    `;
  }

  override update(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('storyUrl')) {
      this.#frameLoadedDeferred = new Deferred();
    }
    super.update(changedProperties);
  }

  override async updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('storyUrl')) {
      const iframeWindow = await this.#frameLoaded;
      const [ourPort, theirPort] = (() => {
        const channel = new MessageChannel();
        return [channel.port1, channel.port2];
      })();
      iframeWindow.postMessage('ignition-webview-port', '*', [theirPort]);

      this.#frameApi = comlink.wrap<ApiToWebview>(ourPort);
      this.#frameApiChanged.resolve();
      this.#frameApiChanged = new Deferred();

      // Grab the webview styles that VS Code injects and pass the into the
      // Ignition iframe for consistent styling.
      const rootStyle = document.documentElement.getAttribute('style');
      const defaultStyles =
        document.querySelector('#_defaultStyles')?.textContent;
      this.#frameApi.setEnvStyles(rootStyle, defaultStyles);
    }
  }

  get #frame() {
    return this.shadowRoot?.querySelector('iframe');
  }

  #frameLoadedDeferred = new Deferred<Window>();

  get #frameLoaded() {
    return this.#frameLoadedDeferred.promise;
  }

  #onFrameLoad() {
    if (this.#frame?.contentWindow == null) {
      throw new Error('iframe loaded but it has no contentWindow');
    }
    this.#frameLoadedDeferred.resolve(this.#frame.contentWindow);
  }

  #onFrameError(error: Error) {
    this.#frameLoadedDeferred.reject(error);
  }

  #mouseMoveId = 0;
  async #onStageMouseMove(mouseEvent: MouseEvent) {
    if (this.#frameApi == null) {
      return;
    }
    const id = ++this.#mouseMoveId;
    const stage = mouseEvent.target as HTMLElementTagNameMap['ignition-stage'];
    const windowX = mouseEvent.clientX;
    const windowY = mouseEvent.clientY;
    // Convert the mouse position to the stage's coordinate space.
    const stageRect = stage.getBoundingClientRect();
    const x = windowX - stageRect.left;
    const y = windowY - stageRect.top;
    const boxes = await this.#frameApi.boundingBoxesAtPoint(x, y);
    // Handle race conditions
    if (id !== this.#mouseMoveId) {
      return;
    }
    this.boxesInPageToHighlight = boxes;
  }

  #modeChanged(event: ModeChangeEvent) {
    this.mode = event.mode;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ignition-ui': IgnitionUi;
  }
}
