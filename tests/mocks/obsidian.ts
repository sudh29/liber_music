/**
 * Comprehensive Mock implementation of the Obsidian API for Vitest unit & E2E testing.
 */

export class MockElement {
	public tagName: string;
	public className: string = "";
	public classList: Set<string> = new Set();
	public textContent: string = "";
	public innerHTML: string = "";
	public value: string = "";
	public isConnected: boolean = true;
	public children: MockElement[] = [];
	public parentElement: MockElement | null = null;
	public style: Record<string, string> = {};
	public isContentEditable: boolean = false;
	private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

	constructor(tagName: string = "div", options?: { cls?: string; text?: string; type?: string; value?: string }) {
		this.tagName = tagName.toUpperCase();
		if (options?.cls) {
			this.addClass(options.cls);
		}
		if (options?.text) {
			this.setText(options.text);
		}
		if (options?.value) {
			this.value = options.value;
		}
	}

	addClass(...classes: string[]): this {
		for (const cls of classes) {
			cls.split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c));
		}
		this.className = Array.from(this.classList).join(" ");
		return this;
	}

	removeClass(...classes: string[]): this {
		for (const cls of classes) {
			cls.split(/\s+/).filter(Boolean).forEach((c) => this.classList.delete(c));
		}
		this.className = Array.from(this.classList).join(" ");
		return this;
	}

	hasClass(cls: string): boolean {
		return this.classList.has(cls);
	}

	toggleClass(cls: string, force?: boolean): this {
		const shouldAdd = force !== undefined ? force : !this.hasClass(cls);
		if (shouldAdd) {
			this.addClass(cls);
		} else {
			this.removeClass(cls);
		}
		return this;
	}

	setText(text: string): this {
		this.textContent = text;
		return this;
	}

	empty(): this {
		this.children = [];
		this.textContent = "";
		this.innerHTML = "";
		return this;
	}

	createDiv(options?: { cls?: string; text?: string }): MockElement {
		return this.createEl("div", options);
	}

	createSpan(options?: { cls?: string; text?: string }): MockElement {
		return this.createEl("span", options);
	}

	createEl(tag: string, options?: any): MockElement {
		const el = new MockElement(tag, options);
		el.parentElement = this;
		this.children.push(el);
		return el;
	}

	appendChild(child: MockElement): MockElement {
		child.parentElement = this;
		this.children.push(child);
		return child;
	}

	addEventListener(event: string, handler: (...args: any[]) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)!.push(handler);
	}

	removeEventListener(event: string, handler: (...args: any[]) => void): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			this.listeners.set(event, handlers.filter((h) => h !== handler));
		}
	}

	dispatchEvent(event: any): boolean {
		const type = typeof event === "string" ? event : event?.type;
		if (typeof event === "object" && !event.target) {
			try {
				event.target = this;
			} catch {}
		}
		const handlers = this.listeners.get(type);
		if (handlers) {
			for (const h of handlers) {
				h(event);
			}
			return true;
		}
		return false;
	}

	closest(selector: string): MockElement | null {
		const s = selector.toLowerCase();
		if (this.tagName.toLowerCase() === s) return this;
		if (selector.startsWith(".") && this.hasClass(selector.slice(1))) return this;
		return this.parentElement ? this.parentElement.closest(selector) : null;
	}

	focus(): void {
		this.dispatchEvent({ type: "focus" });
	}

	select(): void {
		this.dispatchEvent({ type: "select" });
	}

	click(): void {
		this.dispatchEvent(new Event("click"));
	}

	querySelector(selector: string): MockElement | null {
		const all = this.querySelectorAll(selector);
		return all.length > 0 ? (all[0] ?? null) : null;
	}

	querySelectorAll(selector: string): MockElement[] {
		const results: MockElement[] = [];
		const isClass = selector.startsWith(".");
		const className = isClass ? selector.slice(1) : "";
		const tag = selector.toUpperCase();

		const traverse = (node: MockElement) => {
			for (const child of node.children) {
				if (isClass && child.hasClass(className)) {
					results.push(child);
				} else if (!isClass && child.tagName === tag) {
					results.push(child);
				}
				traverse(child);
			}
		};

		traverse(this);
		return results;
	}
}

export class TAbstractFile {
	path: string = "";
	name: string = "";
	parent: TFolder | null = null;
	vault: Vault | null = null;
}

export class TFile extends TAbstractFile {
	stat = { ctime: 0, mtime: 0, size: 0 };
	basename: string = "";
	extension: string = "";

	constructor(path: string = "", name: string = "") {
		super();
		this.path = path.replace(/^\/+/, "");
		this.name = name || this.path.split("/").pop() || "";
		this.basename = this.name.replace(/\.[^/.]+$/, "");
		const extMatch = this.name.match(/\.([^.]+)$/);
		this.extension = extMatch && extMatch[1] ? extMatch[1] : "";
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];

	constructor(path: string = "", name: string = "") {
		super();
		this.path = path.replace(/^\/+/, "");
		this.name = name || this.path.split("/").pop() || "";
	}

	isRoot(): boolean {
		return this.path === "" || this.path === "/";
	}
}

export interface EventRef {
	id?: string;
}

export class Vault {
	private filesMap: Map<string, TFile> = new Map();
	private foldersMap: Map<string, TFolder> = new Map();
	private fileContents: Map<string, string | ArrayBuffer> = new Map();
	private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
	private root: TFolder = new TFolder("", "");

	adapter = {
		read: async (path: string) => {
			const content = this.fileContents.get(path.replace(/^\/+/, ""));
			return typeof content === "string" ? content : "";
		},
		readBinary: async (path: string) => {
			const content = this.fileContents.get(path.replace(/^\/+/, ""));
			return content instanceof ArrayBuffer ? content : new ArrayBuffer(0);
		},
		exists: async (path: string) => {
			const norm = path.replace(/^\/+/, "");
			return this.filesMap.has(norm) || this.foldersMap.has(norm);
		},
	};

	constructor() {
		this.foldersMap.set("", this.root);
	}

	getRoot(): TFolder {
		return this.root;
	}

	getFolderByPath(path: string): TFolder | null {
		const norm = path.replace(/^\/+|\/+$/g, "");
		if (norm === "") return this.root;
		return this.foldersMap.get(norm) ?? null;
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		const norm = path.replace(/^\/+/, "");
		return this.filesMap.get(norm) ?? this.foldersMap.get(norm) ?? null;
	}

	getFiles(): TFile[] {
		return Array.from(this.filesMap.values());
	}

	async read(file: TFile): Promise<string> {
		const content = this.fileContents.get(file.path);
		return typeof content === "string" ? content : "";
	}

	async readBinary(file: TFile): Promise<ArrayBuffer> {
		const content = this.fileContents.get(file.path);
		if (content instanceof ArrayBuffer) return content;
		if (typeof content === "string") {
			const encoder = new TextEncoder();
			return encoder.encode(content).buffer;
		}
		return new ArrayBuffer(0);
	}

	getResourcePath(file: TFile): string {
		return `app://obsidian.md/${file.path}`;
	}

	on(event: string, callback: (...args: any[]) => any): EventRef {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)!.push(callback);
		return { id: Math.random().toString() };
	}

	off(event: string, callback: (...args: any[]) => any): void {
		const list = this.listeners.get(event);
		if (list) {
			this.listeners.set(event, list.filter((cb) => cb !== callback));
		}
	}

	trigger(event: string, ...args: any[]): void {
		const list = this.listeners.get(event);
		if (list) {
			for (const cb of list) {
				cb(...args);
			}
		}
	}

	// Virtual File System seeding helpers for tests
	createFolder(path: string): TFolder {
		const norm = path.replace(/^\/+|\/+$/g, "");
		if (this.foldersMap.has(norm)) {
			return this.foldersMap.get(norm)!;
		}
		const folder = new TFolder(norm);
		folder.vault = this;
		this.foldersMap.set(norm, folder);

		// Wire up hierarchy
		const parts = norm.split("/");
		if (parts.length > 1) {
			const parentPath = parts.slice(0, -1).join("/");
			const parentFolder = this.createFolder(parentPath);
			folder.parent = parentFolder;
			if (!parentFolder.children.includes(folder)) {
				parentFolder.children.push(folder);
			}
		} else {
			folder.parent = this.root;
			if (!this.root.children.includes(folder)) {
				this.root.children.push(folder);
			}
		}

		this.trigger("create", folder);
		return folder;
	}

	createFile(path: string, content: string | ArrayBuffer = ""): TFile {
		const norm = path.replace(/^\/+/, "");
		const file = new TFile(norm);
		file.vault = this;
		this.filesMap.set(norm, file);
		this.fileContents.set(norm, content);

		// Wire parent folder
		const parts = norm.split("/");
		if (parts.length > 1) {
			const parentPath = parts.slice(0, -1).join("/");
			const parentFolder = this.createFolder(parentPath);
			file.parent = parentFolder;
			if (!parentFolder.children.includes(file)) {
				parentFolder.children.push(file);
			}
		} else {
			file.parent = this.root;
			if (!this.root.children.includes(file)) {
				this.root.children.push(file);
			}
		}

		this.trigger("create", file);
		return file;
	}

	deleteFile(path: string): void {
		const norm = path.replace(/^\/+/, "");
		const file = this.filesMap.get(norm);
		if (file) {
			this.filesMap.delete(norm);
			this.fileContents.delete(norm);
			if (file.parent) {
				file.parent.children = file.parent.children.filter((c) => c !== file);
			}
			this.trigger("delete", file);
		}
	}

	modifyFile(path: string, newContent: string | ArrayBuffer): void {
		const norm = path.replace(/^\/+/, "");
		const file = this.filesMap.get(norm);
		if (file) {
			this.fileContents.set(norm, newContent);
			this.trigger("modify", file);
		}
	}

	renameFile(oldPath: string, newPath: string): void {
		const normOld = oldPath.replace(/^\/+/, "");
		const normNew = newPath.replace(/^\/+/, "");
		const file = this.filesMap.get(normOld);
		if (file) {
			this.filesMap.delete(normOld);
			const content = this.fileContents.get(normOld);
			this.fileContents.delete(normOld);

			file.path = normNew;
			file.name = normNew.split("/").pop() || "";
			file.basename = file.name.replace(/\.[^/.]+$/, "");
			const extMatch = file.name.match(/\.([^.]+)$/);
			file.extension = extMatch && extMatch[1] ? extMatch[1] : "";

			this.filesMap.set(normNew, file);
			if (content !== undefined) {
				this.fileContents.set(normNew, content);
			}
			this.trigger("rename", file, normOld);
		}
	}
}

export class WorkspaceLeaf {
	view: ItemView | null = null;
	containerEl: MockElement = new MockElement("div", { cls: "workspace-leaf" });

	constructor(public app: App) {}

	async open(view: ItemView): Promise<ItemView> {
		this.view = view;
		return view;
	}

	async setViewState(_state: any): Promise<void> {}

	detach(): void {
		this.view = null;
	}
}

export class Workspace {
	private leaves: WorkspaceLeaf[] = [];
	private activeView: any = null;
	private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

	constructor(public app?: App) {}

	getLeavesOfType(_viewType: string): WorkspaceLeaf[] {
		return this.leaves;
	}

	getRightLeaf(_split: boolean): WorkspaceLeaf {
		const leaf = new WorkspaceLeaf(this.app as App);
		this.leaves.push(leaf);
		return leaf;
	}

	getActiveViewOfType<T>(type: any): T | null {
		if (this.activeView instanceof type) {
			return this.activeView as T;
		}
		return null;
	}

	setActiveView(view: any): void {
		this.activeView = view;
	}

	revealLeaf(_leaf: WorkspaceLeaf): void {}

	on(event: string, callback: (...args: any[]) => any): EventRef {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)!.push(callback);
		return { id: Math.random().toString() };
	}

	off(event: string, callback: (...args: any[]) => any): void {
		const list = this.listeners.get(event);
		if (list) {
			this.listeners.set(event, list.filter((cb) => cb !== callback));
		}
	}

	trigger(event: string, ...args: any[]): void {
		const list = this.listeners.get(event);
		if (list) {
			for (const cb of list) {
				cb(...args);
			}
		}
	}
}

export class App {
	vault: Vault = new Vault();
	workspace: Workspace;

	constructor() {
		this.workspace = new Workspace(this);
	}
}

export class Notice {
	message: string;
	timeout?: number;

	constructor(message: string, timeout?: number) {
		this.message = message;
		this.timeout = timeout;
	}

	setMessage(msg: string): this {
		this.message = msg;
		return this;
	}

	hide(): void {}
}

export class Plugin {
	app: App;
	manifest: Record<string, unknown>;
	commands: Array<{ id: string; name: string; callback: () => void }> = [];
	ribbonIcons: Array<{ icon: string; title: string; callback: () => void }> = [];
	views: Map<string, any> = new Map();
	settingTab: any = null;
	private data: Record<string, any> = {};

	constructor(app: App, manifest: Record<string, unknown> = {}) {
		this.app = app;
		this.manifest = manifest;
	}

	async loadData(): Promise<any> {
		return this.data;
	}

	async saveData(data: any): Promise<void> {
		this.data = data;
	}

	addCommand(command: { id: string; name: string; callback: () => void }): void {
		this.commands.push(command);
	}

	addSettingTab(tab: any): void {
		this.settingTab = tab;
	}

	registerView(type: string, viewCreator: any): void {
		this.views.set(type, viewCreator);
	}

	addRibbonIcon(icon: string, title: string, callback: () => void): any {
		const item = { icon, title, callback };
		this.ribbonIcons.push(item);
		return item;
	}

	registerEvent(_ref: any): void {}
	registerDomEvent(_el: any, _type: string, _cb: any): void {}
	registerInterval(_id: any): void {}
	registerMarkdownCodeBlockProcessor(_language: string, _handler: any): void {}
	registerObsidianProtocolHandler(_action: string, _handler: any): void {}
}

export class PluginSettingTab {
	app: App;
	plugin: Plugin;
	containerEl: MockElement = new MockElement("div", { cls: "settings-container" });

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	display(): void {}
	hide(): void {}
}

export class Setting {
	constructor(public containerEl: any) {}
	setName(_name: string): this { return this; }
	setDesc(_desc: string): this { return this; }
	addText(cb: (text: any) => void): this {
		cb({
			setPlaceholder: () => ({}),
			setValue: () => ({}),
			onChange: () => ({}),
		});
		return this;
	}
	addToggle(cb: (toggle: any) => void): this {
		cb({
			setValue: () => ({}),
			onChange: () => ({}),
			toggleEl: new MockElement("div"),
		});
		return this;
	}
	addDropdown(cb: (dropdown: any) => void): this {
		cb({
			addOption: () => ({}),
			setValue: () => ({}),
			onChange: () => ({}),
		});
		return this;
	}
	addButton(cb: (btn: any) => void): this {
		cb({
			setButtonText: () => ({}),
			setCta: () => ({}),
			onClick: () => ({}),
		});
		return this;
	}
}

export class ItemView {
	app: App;
	containerEl: MockElement = new MockElement("div", { cls: "view-container" });
	contentEl: MockElement = new MockElement("div", { cls: "view-content" });

	constructor(public leaf: any) {
		this.app = leaf?.app;
		this.containerEl.appendChild(this.contentEl);
	}

	getViewType(): string { return "view"; }
	getDisplayText(): string { return "View"; }
	getIcon(): string { return "document"; }
	addAction(_icon: string, _title: string, _cb: () => void): HTMLElement {
		return new MockElement("div") as any;
	}
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
}

export class Modal {
	modalEl: MockElement = new MockElement("div", { cls: "modal" });
	contentEl: MockElement = new MockElement("div", { cls: "modal-content" });
	titleEl: MockElement = new MockElement("div", { cls: "modal-title" });

	constructor(public app: App) {
		this.modalEl.appendChild(this.titleEl);
		this.modalEl.appendChild(this.contentEl);
	}

	setTitle(title: string): this {
		this.titleEl.setText(title);
		return this;
	}

	open(): void {
		void this.onOpen();
	}

	close(): void {
		this.onClose();
	}

	onOpen(): Promise<void> | void {}
	onClose(): void {}
}

export class FuzzySuggestModal<T> extends Modal {
	inputEl: MockElement = new MockElement("input", { cls: "prompt-input" });

	constructor(app: App) {
		super(app);
		this.contentEl.appendChild(this.inputEl);
	}

	getItems(): T[] { return []; }
	getItemText(_item: T): string { return ""; }
	onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
}

export function normalizePath(path: string): string {
	return path.replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "");
}

export function setIcon(el: any, iconId: string): void {
	if (el) {
		el.setAttribute?.("data-icon", iconId);
	}
}

export class Component {
	load(): void {
		void this.onload();
	}
	onload(): Promise<void> | void {}
	unload(): void {
		this.onunload();
	}
	onunload(): void {}
	addChild<T extends Component>(child: T): T {
		return child;
	}
	removeChild<T extends Component>(child: T): T {
		return child;
	}
	register(cb: () => any): void {}
	registerEvent(eventRef: any): void {}
	registerDomEvent(el: any, type: string, callback: any): void {}
	registerInterval(id: number): number {
		return id;
	}
}

export class MarkdownRenderChild extends Component {
	containerEl: HTMLElement;
	constructor(containerEl: HTMLElement) {
		super();
		this.containerEl = containerEl;
	}
}

export const Platform = {
	isDesktop: true,
	isMobile: false,
	isIosApp: false,
	isAndroidApp: false,
	isMacOS: false,
	isSafari: false,
};
