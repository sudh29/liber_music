/**
 * Smart Playlist Configuration Modal
 * 
 * Interactive query builder modal allowing users to:
 * - Define smart playlist rules (fields, operators, values)
 * - Configure match conjunction (ALL / ANY)
 * - Configure sorting and track limit
 * - View live match count preview against library
 */

import { App, Modal, Notice } from "obsidian";
import type MusicPlayerPlugin from "@/main";
import type {
	SmartPlaylistDefinition,
	SmartPlaylistRule,
	SmartRuleField,
	SmartRuleOperator,
} from "@/types/settings";
import { evaluateSmartPlaylist } from "@/utils/library/smartPlaylist";
import { t } from "@/utils/i18n/i18n";
import "./SmartPlaylistModal.css";

export interface SmartPlaylistModalOptions {
	initialDefinition?: SmartPlaylistDefinition;
	onSave?: (definition: SmartPlaylistDefinition) => Promise<void> | void;
}

export class SmartPlaylistModal extends Modal {
	private definition: SmartPlaylistDefinition;
	private rules: SmartPlaylistRule[];
	private previewBadge!: HTMLElement;
	private rulesContainer!: HTMLElement;
	private nameInput!: HTMLInputElement;
	private matchSelect!: HTMLSelectElement;
	private sortFieldSelect!: HTMLSelectElement;
	private sortOrderSelect!: HTMLSelectElement;
	private limitInput!: HTMLInputElement;

	constructor(
		app: App,
		public plugin: MusicPlayerPlugin,
		private options: SmartPlaylistModalOptions = {}
	) {
		super(app);

		if (options.initialDefinition) {
			this.definition = JSON.parse(JSON.stringify(options.initialDefinition)) as SmartPlaylistDefinition;
		} else {
			this.definition = {
				id: `smart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
				name: t("smartPlaylist.defaultName"),
				matchType: "all",
				rules: [
					{
						id: "r_1",
						field: "rating",
						operator: "greaterThan",
						value: 3,
					},
				],
				sortBy: "title",
				sortOrder: "asc",
			};
		}

		this.rules = [...this.definition.rules];
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass("smart-playlist-modal");

		this.setTitle(
			this.options.initialDefinition
				? t("smartPlaylist.editTitle")
				: t("smartPlaylist.createTitle")
		);

		// Header name and match type row
		const metaRow = contentEl.createDiv({ cls: "smart-playlist-meta-row" });
		this.nameInput = metaRow.createEl("input", {
			cls: "smart-playlist-name-input",
			type: "text",
			value: this.definition.name,
		});
		this.nameInput.placeholder = t("smartPlaylist.namePlaceholder");

		this.matchSelect = metaRow.createEl("select", {
			cls: "smart-playlist-match-select",
		});
		const optAll = this.matchSelect.createEl("option", {
			value: "all",
			text: t("smartPlaylist.matchAll"),
		});
		const optAny = this.matchSelect.createEl("option", {
			value: "any",
			text: t("smartPlaylist.matchAny"),
		});
		if (this.definition.matchType === "any") {
			optAny.selected = true;
		} else {
			optAll.selected = true;
		}

		this.matchSelect.addEventListener("change", () => {
			this.definition.matchType = this.matchSelect.value as "all" | "any";
			this.updateMatchPreview();
		});

		// Rules list container
		this.rulesContainer = contentEl.createDiv({ cls: "smart-rules-container" });
		this.renderRules();

		// Add Rule Button
		const addBtnRow = contentEl.createDiv({ cls: "smart-playlist-meta-row" });
		const addRuleBtn = addBtnRow.createEl("button", {
			text: t("smartPlaylist.addRule"),
		});
		addRuleBtn.addEventListener("click", () => {
			this.rules.push({
				id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
				field: "title",
				operator: "contains",
				value: "",
			});
			this.renderRules();
			this.updateMatchPreview();
		});

		// Sort and Limit Row
		const sortRow = contentEl.createDiv({ cls: "smart-playlist-sort-row" });
		sortRow.createSpan({ text: t("smartPlaylist.sortBy") });

		this.sortFieldSelect = sortRow.createEl("select");
		const sortFields: Array<{ id: SmartRuleField; label: string }> = [
			{ id: "title", label: t("metadata.title") },
			{ id: "artist", label: t("metadata.artist") },
			{ id: "album", label: t("metadata.album") },
			{ id: "year", label: t("metadata.year") },
			{ id: "rating", label: t("metadata.rating") },
			{ id: "duration", label: t("metadata.duration") },
		];
		sortFields.forEach((sf) => {
			const opt = this.sortFieldSelect.createEl("option", { value: sf.id, text: sf.label });
			if (this.definition.sortBy === sf.id) opt.selected = true;
		});

		this.sortOrderSelect = sortRow.createEl("select");
		const optAsc = this.sortOrderSelect.createEl("option", { value: "asc", text: t("smartPlaylist.orderAsc") });
		const optDesc = this.sortOrderSelect.createEl("option", { value: "desc", text: t("smartPlaylist.orderDesc") });
		if (this.definition.sortOrder === "desc") optDesc.selected = true;
		else optAsc.selected = true;

		sortRow.createSpan({ text: t("smartPlaylist.limit") });
		this.limitInput = sortRow.createEl("input", {
			cls: "smart-playlist-limit-input",
			type: "number",
			value: this.definition.limit ? String(this.definition.limit) : "",
		});
		this.limitInput.placeholder = t("smartPlaylist.unlimited");

		// Actions Row with preview badge and save/cancel
		const actionRow = contentEl.createDiv({ cls: "smart-playlist-actions" });
		this.previewBadge = actionRow.createDiv({ cls: "smart-preview-badge" });

		const btnGroup = actionRow.createDiv();
		const cancelBtn = btnGroup.createEl("button", { text: t("common.cancel") });
		cancelBtn.addEventListener("click", () => this.close());

		const saveBtn = btnGroup.createEl("button", { text: t("common.save"), cls: "mod-cta" });
		saveBtn.addEventListener("click", () => void this.savePlaylist());

		this.updateMatchPreview();
	}

	private renderRules(): void {
		this.rulesContainer.empty();

		this.rules.forEach((rule, idx) => {
			const row = this.rulesContainer.createDiv({ cls: "smart-rule-row" });

			// Field select
			const fieldSelect = row.createEl("select", { cls: "smart-rule-field" });
			const fields: Array<{ id: SmartRuleField; label: string }> = [
				{ id: "title", label: t("metadata.title") },
				{ id: "artist", label: t("metadata.artist") },
				{ id: "album", label: t("metadata.album") },
				{ id: "genre", label: t("metadata.genre") },
				{ id: "year", label: t("metadata.year") },
				{ id: "rating", label: t("metadata.rating") },
				{ id: "duration", label: t("metadata.duration") },
				{ id: "path", label: t("metadata.path") },
			];
			fields.forEach((f) => {
				const opt = fieldSelect.createEl("option", { value: f.id, text: f.label });
				if (rule.field === f.id) opt.selected = true;
			});
			fieldSelect.addEventListener("change", () => {
				rule.field = fieldSelect.value as SmartRuleField;
				this.updateMatchPreview();
			});

			// Operator select
			const opSelect = row.createEl("select", { cls: "smart-rule-operator" });
			const operators: Array<{ id: SmartRuleOperator; label: string }> = [
				{ id: "contains", label: t("smartPlaylist.opContains") },
				{ id: "notContains", label: t("smartPlaylist.opNotContains") },
				{ id: "equals", label: t("smartPlaylist.opEquals") },
				{ id: "notEquals", label: t("smartPlaylist.opNotEquals") },
				{ id: "greaterThan", label: t("smartPlaylist.opGreaterThan") },
				{ id: "lessThan", label: t("smartPlaylist.opLessThan") },
				{ id: "between", label: t("smartPlaylist.opBetween") },
			];
			operators.forEach((op) => {
				const opt = opSelect.createEl("option", { value: op.id, text: op.label });
				if (rule.operator === op.id) opt.selected = true;
			});
			opSelect.addEventListener("change", () => {
				rule.operator = opSelect.value as SmartRuleOperator;
				this.updateMatchPreview();
			});

			// Value input
			const valInput = row.createEl("input", {
				cls: "smart-rule-value",
				type: rule.field === "year" || rule.field === "rating" || rule.field === "duration" ? "number" : "text",
				value: String(rule.value),
			});
			valInput.addEventListener("input", () => {
				rule.value = valInput.value;
				this.updateMatchPreview();
			});

			// Delete button
			const deleteBtn = row.createSpan({
				cls: "smart-rule-delete",
				text: "✕",
			});
			deleteBtn.addEventListener("click", () => {
				this.rules.splice(idx, 1);
				this.renderRules();
				this.updateMatchPreview();
			});
		});
	}

	private updateMatchPreview(): void {
		const libraryItems = Object.entries(this.plugin.settings.trackIndex || {}).map(([id, path]) => {
			const info = this.plugin.settings.tracks[id] || { title: path, artist: "", album: "" };
			return { id, path, info };
		});

		const currentDef: SmartPlaylistDefinition = {
			...this.definition,
			rules: this.rules,
			matchType: (this.matchSelect?.value as "all" | "any") || this.definition.matchType,
		};

		const matched = evaluateSmartPlaylist(currentDef, libraryItems);
		this.previewBadge.setText(`${matched.length} ${t("smartPlaylist.matchingTracks")}`);
	}

	private async savePlaylist(): Promise<void> {
		const name = this.nameInput.value.trim() || t("smartPlaylist.defaultName");
		const limitNum = parseInt(this.limitInput.value.trim(), 10);

		const updatedDef: SmartPlaylistDefinition = {
			...this.definition,
			name,
			matchType: this.matchSelect.value as "all" | "any",
			rules: this.rules,
			sortBy: this.sortFieldSelect.value as SmartRuleField,
			sortOrder: this.sortOrderSelect.value as "asc" | "desc",
			limit: isNaN(limitNum) || limitNum <= 0 ? undefined : limitNum,
		};

		if (!this.plugin.settings.smartPlaylists) {
			this.plugin.settings.smartPlaylists = {};
		}
		this.plugin.settings.smartPlaylists[updatedDef.id] = updatedDef;
		await this.plugin.saveSettings();

		new Notice(t("smartPlaylist.saveSuccess"));

		if (this.options.onSave) {
			await this.options.onSave(updatedDef);
		}

		this.close();
	}
}
