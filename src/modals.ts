import { App, Modal, Setting } from 'obsidian';
import type { DetailViewData, MemoryBar } from './stats';

export class DetailModal extends Modal {
	constructor(
		app: App,
		private readonly viewData: DetailViewData,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('device-status-modal');

		contentEl.createEl('h3', { text: this.viewData.title });

		for (const row of this.viewData.rows) {
			const setting = new Setting(contentEl)
				.setName(row.label)
				.setDesc(row.value);

			if (row.bar) {
				renderMemoryBar(setting.descEl, row.bar);
			}

			if (row.actionLabel && row.onClick) {
				const actionLabel = row.actionLabel;

				setting.addButton((button) =>
					button.setButtonText(actionLabel).onClick(() => {
						row.onClick?.();
					}),
				);
			}
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class AffectedFilesModal extends Modal {
	constructor(
		app: App,
		private readonly files: string[],
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('device-status-modal');

		contentEl.createEl('h3', { text: 'Affected files' });

		if (this.files.length === 0) {
			contentEl.createEl('p', { text: 'No changed markdown files.' });
			return;
		}

		const list = contentEl.createEl('ul', {
			cls: 'device-status-file-list',
		});

		for (const file of this.files) {
			list.createEl('li', { text: file });
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}

function renderMemoryBar(container: HTMLElement, bar: MemoryBar): void {
	const wrapper = container.createDiv({ cls: 'device-status-bar' });
	const header = wrapper.createDiv({ cls: 'device-status-bar__header' });

	header.createSpan({
		cls: 'device-status-bar__percentage',
		text: bar.value,
	});
	header.createSpan({
		cls: 'device-status-bar__summary',
		text: bar.summary,
	});

	const track = wrapper.createDiv({ cls: 'device-status-bar__track' });
	track.createDiv({ cls: 'device-status-bar__fill' }).style.width = `${Math.max(
		0,
		Math.min(bar.percentage, 100),
	)}%`;

	const footer = wrapper.createDiv({ cls: 'device-status-bar__footer' });
	renderBarCaption(footer, bar.primaryLabel, bar.primaryValue);
	renderBarCaption(footer, bar.secondaryLabel, bar.secondaryValue);
}

function renderBarCaption(
	container: HTMLElement,
	label: string,
	value: string,
): void {
	const caption = container.createDiv({ cls: 'device-status-bar__caption' });
	caption.createSpan({ text: label });
	caption.createSpan({ text: value });
}
