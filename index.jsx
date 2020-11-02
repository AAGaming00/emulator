/**
 * Emulator plugin
 * @author AAGaming, original by Zerthox
 */
const { getModuleByDisplayName, getModule, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')
const { Plugin } = require('powercord/entities')


/** Plugin class */
module.exports = class Emulator extends Plugin {
	getSettings()  {
		return () => {
			return (
				<this.Component.RadioGroup
					value={this.platform}
					onChange={(e) => this.setPlatform(e.value)}
					options={[
						{
							value: this.Module.Platform.PlatformTypes.WINDOWS,
							name: "Windows"
						},
						{
							value: this.Module.Platform.PlatformTypes.OSX,
							name: "MacOS"
						},
						{
							value: this.Module.Platform.PlatformTypes.LINUX,
							name: "Linux"
						},
						{
							value: this.Module.Platform.PlatformTypes.WEB,
							name: "Browser"
						}
					]}
				/>
			);
		};
	}

    async setPlatform (e) {
        await this.update(e);
        // reload settings
        this.Module.LayerManager.popLayer();
        this.Module.Settings.open('emulator');
    }

	async update(e) {
        this.settings.set('platform', e)
        this.platform = e
		await this.forceUpdateRoot();
		this.toast(`Emulating ${this.Module.Platform.isWindows() ? "Windows" : this.Module.Platform.isOSX() ? "MacOS" : this.Module.Platform.isLinux() ? "Linux" : "Browser"}`, {type: "info", timeout: 5000});
	}

	toast(msg, opt) {
		this.log(msg);
		const id = (Math.random().toString(36) + Date.now()).substring(2, 7)
		powercord.api.notices.sendToast(id, {...opt, content: msg});
		setTimeout(() => { // porkord toaster bad
			powercord.api.notices.closeToast(id)
		}, opt.timeout + 1000);
	}

	startPlugin() {
        /** Module storage */
        this.Module = {
            LayerStore: getModule(["getLayers"], false),
            LayerManager: getModule(["pushLayer", "popLayer"], false),
            Platform: getModule(["getPlatform", "isWindows", "isOSX", "isLinux", "isWeb", "PlatformTypes"], false),
            Overlay: getModule(["initialize", "isSupported", "getFocusedPID"], false),
            AppearanceStore: getModule(["keyboardModeEnabled"], false),
            AppearanceManager: getModule(["enableKeyboardMode"], false),
            Settings: getModule(['open', 'saveAccountChanges'], false)
        };

        /** Component storage */
        this.Component = {
            RadioGroup: getModuleByDisplayName("RadioGroup", false)
        };

        this.defaults = {
			platform: /^win/.test(this.Module.Platform.platform) ? this.Module.Platform.PlatformTypes.WINDOWS
			: this.Module.Platform.platform === "darwin" ? this.Module.Platform.PlatformTypes.OSX
			: this.Module.Platform.platform === "linux" ? this.Module.Platform.PlatformTypes.LINUX
			: this.Module.Platform.PlatformTypes.WEB
        };
        this.platform = this.settings.get('platform', this.defaults.platform)
        powercord.api.settings.registerSettings('emulator', {
            category: this.entityID,
            label: 'Emulator',
            render: this.getSettings()
          })
		// patch platform specific functions
		for (const platform of ["Windows", "OSX", "Linux", "Web"]) {
			inject(`emulator-platform-${platform}`, this.Module.Platform, `is${platform}`, () => this.platform === this.Module.Platform.PlatformTypes[platform.toUpperCase()], false);
		}

		// patch settings render function
		inject('emulator-settings', this.Module.Overlay, "isSupported", () => this.Module.Platform.isWindows(), false);

		// force update
		this.update(this.settings.get('platform', this.defaults.platform));
	}

	pluginWillUnload() {
		powercord.api.settings.unregisterSettings('emulator')
        for (const platform of ["Windows", "OSX", "Linux", "Web"]) {
			uninject(`emulator-platform-${platform}`);
		}
		uninject('emulator-settings')
		// force update root
		this.forceUpdateRoot();

		// show toast
		this.toast(`Stopped Emulating`, {type: "info", timeout: 5000});
	}

	async forceUpdateRoot() {

		// catch errors
		try {

			// start at react root
			let fiber = document.querySelector("#app-mount")._reactRootContainer._internalRoot.current;

			// walk down until app component found
			while (!(fiber.type && fiber.type.displayName === "App")) {
				fiber = fiber.child;
			}

			// force update app
			fiber.stateNode.forceUpdate();

			// trigger helmet rerender by flipping keyboard mode
			if (this.Module.AppearanceStore.keyboardModeEnabled) {
				this.Module.AppearanceManager.disableKeyboardMode();
				this.Module.AppearanceManager.enableKeyboardMode();
			}
			else {
				this.Module.AppearanceManager.enableKeyboardMode();
				this.Module.AppearanceManager.disableKeyboardMode();
			}
		}
		catch(e) {

			// log error
			this.warn("Failed to force update app");
			console.error(e);
		}
	}

}