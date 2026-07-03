import { App, Modal, Setting } from 'obsidian';
import type { DetailViewData } from './stats';

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
