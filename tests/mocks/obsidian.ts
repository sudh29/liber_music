/**
 * Mock implementation of the Obsidian API for Vitest unit testing.
 */

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
		this.path = path;
		this.name = name || path.split("/").pop() || "";
		this.basename = this.name.replace(/\.[^/.]+$/, "");
		const extMatch = this.name.match(/\.([^.]+)$/);
		this.extension = extMatch && extMatch[1] ? extMatch[1] : "";
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}

export class Vault {
	adapter = {
		read: async () => "",
		readBinary: async () => new ArrayBuffer(0),
		exists: async () => false,
	};
	read = async (_file: TFile) => "";
	readBinary = async (_file: TFile) => new ArrayBuffer(0);
	getAbstractFileByPath = (_path: string): TAbstractFile | null => null;
	getFiles = (): TFile[] => [];
	on = () => ({});
	off = () => ({});
}

export class App {
	vault: Vault = new Vault();
	workspace = {
		getLeavesOfType: () => [],
		getRightLeaf: () => null,
		revealLeaf: () => {},
		on: () => ({}),
	};
}

export class Notice {
	constructor(public message: string, public timeout?: number) {}
}

export class Plugin {
	app: App;
	manifest: Record<string, unknown>;

	constructor(app: App, manifest: Record<string, unknown>) {
		this.app = app;
		this.manifest = manifest;
	}

	loadData = async () => ({});
	saveData = async () => {};
	addCommand = () => {};
	addSettingTab = () => {};
	registerView = () => {};
	addRibbonIcon = () => ({});
}

export class PluginSettingTab {
	app: App;
	plugin: Plugin;
	containerEl = { empty: () => {}, createEl: () => ({}) };

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	display() {}
	hide() {}
}

export class Setting {
	constructor(public containerEl: unknown) {}
	setName() { return this; }
	setDesc() { return this; }
	addText() { return this; }
	addToggle() { return this; }
	addDropdown() { return this; }
	addButton() { return this; }
}

export class ItemView {
	constructor(public leaf: unknown) {}
	getViewType() { return "view"; }
	getDisplayText() { return "View"; }
	getIcon() { return "document"; }
	onOpen = async () => {};
	onClose = async () => {};
}

export class Modal {
	constructor(public app: App) {}
	open() {}
	close() {}
}

export class FuzzySuggestModal<T> {
	constructor(public app: App) {}
	open() {}
	close() {}
	getItems(): T[] { return []; }
	getItemText(_item: T): string { return ""; }
	onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent) {}
}
