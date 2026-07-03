import { Menu, Notice, Plugin } from 'obsidian';
import { buildPageDetails, buildVaultDetails } from './stats';
import { AffectedFilesModal, DetailModal } from './modals';

export default class DeviceStatusPlugin extends Plugin {
	statusBarItemEl!: HTMLElement;

	onload() {
		this.statusBarItemEl = this.addStatusBarItem();
		this.statusBarItemEl.addClass('device-status-button');
		this.statusBarItemEl.setAttribute('aria-label', 'Open device status menu');
		this.statusBarItemEl.setAttribute('title', 'Open device status menu');

		this.updateStatusBarText();

		this.registerDomEvent(this.statusBarItemEl, 'click', (event: MouseEvent) => {
			this.openStatusMenu(event);
		});

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.updateStatusBarText();
			}),
		);
	}

	onunload() {
	}

	private updateStatusBarText() {
		this.statusBarItemEl.setText('Device Status');
	}

	private openStatusMenu(event: MouseEvent) {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('Page Details')
				.setIcon('file-text')
				.onClick(async () => {
					const details = await buildPageDetails(this.app);
					new DetailModal(this.app, details).open();
				}),
		);

		menu.addItem((item) =>
			item
				.setTitle('Vault Details')
				.setIcon('library')
				.onClick(async () => {
					const details = await buildVaultDetails(this.app, (files) => {
						new AffectedFilesModal(this.app, files).open();
					});
					new DetailModal(this.app, details).open();
				}),
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Refresh status label')
				.setIcon('refresh-cw')
				.onClick(() => {
					this.updateStatusBarText();
					new Notice('Device status refreshed');
				}),
		);

		menu.addItem((item) =>
			item
				.setTitle('Git status hint')
				.setIcon('settings')
				.onClick(() => {
					new Notice(
						'Git-based memory stats require the vault root to be a working Git repository.',
					);
				}),
		);

		menu.showAtMouseEvent(event);
	}
}
