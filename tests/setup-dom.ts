/**
 * Sets up Obsidian DOM helper prototypes on HTMLElement for happy-dom tests.
 */

if (typeof window !== "undefined" && typeof HTMLElement !== "undefined") {
	const proto = HTMLElement.prototype as any;

	if (!proto.createDiv) {
		proto.createDiv = function (options?: any) {
			const div = document.createElement("div");
			if (typeof options === "string") {
				div.className = options;
			} else if (options?.cls) {
				div.className = options.cls;
			}
			if (options?.text) {
				div.textContent = options.text;
			}
			this.appendChild(div);
			return div;
		};
	}

	if (!proto.createSpan) {
		proto.createSpan = function (options?: any) {
			const span = document.createElement("span");
			if (typeof options === "string") {
				span.className = options;
			} else if (options?.cls) {
				span.className = options.cls;
			}
			if (options?.text) {
				span.textContent = options.text;
			}
			this.appendChild(span);
			return span;
		};
	}

	if (!proto.createEl) {
		proto.createEl = function (tag: string, options?: any) {
			const el = document.createElement(tag);
			if (typeof options === "string") {
				el.className = options;
			} else if (options?.cls) {
				el.className = options.cls;
			}
			if (options?.text) {
				el.textContent = options.text;
			}
			if (options?.attr) {
				for (const [k, v] of Object.entries(options.attr)) {
					el.setAttribute(k, String(v));
				}
			}
			this.appendChild(el);
			return el;
		};
	}

	if (!proto.createSvg) {
		proto.createSvg = function (tag: string, options?: any) {
			const svg = document.createElementNS("http://www.w3.org/2000/svg", tag);
			if (options?.attr) {
				for (const [k, v] of Object.entries(options.attr)) {
					svg.setAttribute(k, String(v));
				}
			}
			this.appendChild(svg);
			return svg;
		};
	}

	if (!proto.empty) {
		proto.empty = function () {
			this.innerHTML = "";
			return this;
		};
	}

	if (!proto.setText) {
		proto.setText = function (text: string) {
			this.textContent = text;
			return this;
		};
	}

	if (!proto.addClass) {
		proto.addClass = function (...classes: string[]) {
			this.classList.add(...classes);
			return this;
		};
	}

	if (!proto.removeClass) {
		proto.removeClass = function (...classes: string[]) {
			this.classList.remove(...classes);
			return this;
		};
	}

	if (!proto.hasClass) {
		proto.hasClass = function (cls: string) {
			return this.classList.contains(cls);
		};
	}
}
