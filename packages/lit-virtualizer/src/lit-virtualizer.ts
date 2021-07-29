import { html, css, LitElement, TemplateResult, render } from 'lit';
import { customElement } from 'lit/decorators/custom-element.js';
import { property } from 'lit/decorators/property.js';
import { scroll as scrollDirective } from './scroll.js';
import { scrollerRef, VirtualizerHostElement } from './VirtualScroller.js';
import { LayoutSpecifier, Layout, LayoutConstructor } from './layouts/Layout.js';

// export { scrollerRef } from './VirtualScroller.js';

/**
 * A LitElement wrapper of the scroll directive.
 *
 * Import this module to declare the lit-virtualizer custom element.
 * Pass an items array, renderItem method, and scroll target as properties
 * to the <lit-virtualizer> element.
 */
@customElement('lit-virtualizer')
export class LitVirtualizer extends LitElement {
    @property()
    renderItem?: ((item: any, index?: number) => TemplateResult);

    @property({attribute: false})
    items: Array<unknown> = [];

    @property({reflect: true, type: Boolean})
    scroller = false;

    @property()
    keyFunction: ((item:unknown) => unknown) | undefined = undefined;

    private _layout?: Layout | LayoutConstructor | LayoutSpecifier;

    private _scrollToIndex: {index: number, position: string} | null = null;
  
    @property({attribute:false})
    set layout(layout: Layout | LayoutConstructor | LayoutSpecifier | undefined) {
        // TODO (graynorton): Shouldn't have to set this here
        this._layout = layout;
        this.requestUpdate();
    }

    get layout(): Layout | LayoutConstructor | LayoutSpecifier | undefined {
        // TODO: graynorton@: Coercing null to undefined here. Should review
        // use of null for defaults in VirtualScroller and see if we can eliminate.
        return (this as VirtualizerHostElement)[scrollerRef]!.layout || undefined;
    }

    static styles = css`
        :host {
            display: block;
            contain: strict;
        }
        :host([scroller]) {
            overflow: auto;
            min-height: 150px;
        }
        :host(not([scroller])),
        div {
            position: relative;
        }
        div > ::slotted(*) {
            position: absolute;
            box-sizing: border-box;
        }
    `;

    /**
     * Scroll to the specified index, placing that item at the given position
     * in the scroll view.
     */
    async scrollToIndex(index: number, position: string = 'start') {
        this._scrollToIndex = {index, position};
        this.requestUpdate();
        await this.updateComplete;
        this._scrollToIndex = null;
    }

    updated() {
        render(this._renderChildren(), this);
    }

    render(): TemplateResult {
        return this.scroller
            ? html`<div lit-virtualizer-container><slot></slot></div>`
            : html`<slot></slot>`
        ;
    }

    _renderChildren(): TemplateResult {
        const { items, renderItem, keyFunction } = this;
        const layout = this._layout;
        return html`${scrollDirective({ items, renderItem, layout, keyFunction, scrollToIndex: this._scrollToIndex })}`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lit-virtualizer': LitVirtualizer;
    }
}