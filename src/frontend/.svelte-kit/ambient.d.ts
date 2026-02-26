
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const SHELL: string;
	export const npm_command: string;
	export const COREPACK_ENABLE_AUTO_PIN: string;
	export const SESSION_MANAGER: string;
	export const WINDOWID: string;
	export const QT_ACCESSIBILITY: string;
	export const COLORTERM: string;
	export const XDG_CONFIG_DIRS: string;
	export const XDG_SESSION_PATH: string;
	export const CONDA_EXE: string;
	export const _CE_M: string;
	export const ICEAUTHORITY: string;
	export const LANGUAGE: string;
	export const NODE: string;
	export const MANDATORY_PATH: string;
	export const SSH_AUTH_SOCK: string;
	export const SHELL_SESSION_ID: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const npm_config_local_prefix: string;
	export const DESKTOP_SESSION: string;
	export const SSH_AGENT_PID: string;
	export const GTK_RC_FILES: string;
	export const XCURSOR_SIZE: string;
	export const CLAUDE_CODE_MAX_OUTPUT_TOKENS: string;
	export const XDG_SEAT: string;
	export const PWD: string;
	export const NIX_PROFILES: string;
	export const LOGNAME: string;
	export const XDG_SESSION_DESKTOP: string;
	export const XDG_SESSION_TYPE: string;
	export const GOOGLE_APPLICATION_CREDENTIALS: string;
	export const PNPM_HOME: string;
	export const GPG_AGENT_INFO: string;
	export const SYSTEMD_EXEC_PID: string;
	export const XAUTHORITY: string;
	export const NoDefaultCurrentDirectoryInExePath: string;
	export const CLAUDECODE: string;
	export const GTK2_RC_FILES: string;
	export const HOME: string;
	export const IM_CONFIG_PHASE: string;
	export const SSH_ASKPASS: string;
	export const LANG: string;
	export const LS_COLORS: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const KONSOLE_DBUS_SERVICE: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const __MISE_DIFF: string;
	export const NIX_SSL_CERT_FILE: string;
	export const KONSOLE_DBUS_SESSION: string;
	export const PROFILEHOME: string;
	export const DENO_INSTALL: string;
	export const XDG_SEAT_PATH: string;
	export const INVOCATION_ID: string;
	export const QTWEBENGINE_DICTIONARIES_PATH: string;
	export const DA: string;
	export const KONSOLE_VERSION: string;
	export const MANAGERPID: string;
	export const GOROOT: string;
	export const KDE_SESSION_UID: string;
	export const __MISE_ORIG_PATH: string;
	export const npm_lifecycle_script: string;
	export const _CONDA_EXE: string;
	export const LESSCLOSE: string;
	export const XDG_SESSION_CLASS: string;
	export const _CONDA_ROOT: string;
	export const PAI_DIR: string;
	export const TERM: string;
	export const npm_package_name: string;
	export const _CE_CONDA: string;
	export const DEFAULTS_PATH: string;
	export const LESSOPEN: string;
	export const DA_COLOR: string;
	export const USER: string;
	export const COLORFGBG: string;
	export const CONDA_SHLVL: string;
	export const KDE_SESSION_VERSION: string;
	export const __MISE_SESSION: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const GSM_SKIP_SSH_AGENT_WORKAROUND: string;
	export const GIT_EDITOR: string;
	export const XDG_VTNR: string;
	export const XDG_SESSION_ID: string;
	export const npm_config_user_agent: string;
	export const OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: string;
	export const npm_execpath: string;
	export const CONDA_PYTHON_EXE: string;
	export const XDG_RUNTIME_DIR: string;
	export const CLAUDE_CODE_ENTRYPOINT: string;
	export const DEBUGINFOD_URLS: string;
	export const ENABLE_TOOL_SEARCH: string;
	export const API_TIMEOUT_MS: string;
	export const npm_package_json: string;
	export const BUN_INSTALL: string;
	export const QT_AUTO_SCREEN_SCALE_FACTOR: string;
	export const JOURNAL_STREAM: string;
	export const XCURSOR_THEME: string;
	export const GTK3_MODULES: string;
	export const MISE_SHELL: string;
	export const XDG_DATA_DIRS: string;
	export const KDE_FULL_SESSION: string;
	export const PATH: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const KDE_APPLICATIONS_AS_SCOPE: string;
	export const npm_node_execpath: string;
	export const OLDPWD: string;
	export const GOPATH: string;
	export const KONSOLE_DBUS_WINDOW: string;
	export const _: string;
	export const NODE_ENV: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		SHELL: string;
		npm_command: string;
		COREPACK_ENABLE_AUTO_PIN: string;
		SESSION_MANAGER: string;
		WINDOWID: string;
		QT_ACCESSIBILITY: string;
		COLORTERM: string;
		XDG_CONFIG_DIRS: string;
		XDG_SESSION_PATH: string;
		CONDA_EXE: string;
		_CE_M: string;
		ICEAUTHORITY: string;
		LANGUAGE: string;
		NODE: string;
		MANDATORY_PATH: string;
		SSH_AUTH_SOCK: string;
		SHELL_SESSION_ID: string;
		MEMORY_PRESSURE_WRITE: string;
		npm_config_local_prefix: string;
		DESKTOP_SESSION: string;
		SSH_AGENT_PID: string;
		GTK_RC_FILES: string;
		XCURSOR_SIZE: string;
		CLAUDE_CODE_MAX_OUTPUT_TOKENS: string;
		XDG_SEAT: string;
		PWD: string;
		NIX_PROFILES: string;
		LOGNAME: string;
		XDG_SESSION_DESKTOP: string;
		XDG_SESSION_TYPE: string;
		GOOGLE_APPLICATION_CREDENTIALS: string;
		PNPM_HOME: string;
		GPG_AGENT_INFO: string;
		SYSTEMD_EXEC_PID: string;
		XAUTHORITY: string;
		NoDefaultCurrentDirectoryInExePath: string;
		CLAUDECODE: string;
		GTK2_RC_FILES: string;
		HOME: string;
		IM_CONFIG_PHASE: string;
		SSH_ASKPASS: string;
		LANG: string;
		LS_COLORS: string;
		XDG_CURRENT_DESKTOP: string;
		KONSOLE_DBUS_SERVICE: string;
		MEMORY_PRESSURE_WATCH: string;
		__MISE_DIFF: string;
		NIX_SSL_CERT_FILE: string;
		KONSOLE_DBUS_SESSION: string;
		PROFILEHOME: string;
		DENO_INSTALL: string;
		XDG_SEAT_PATH: string;
		INVOCATION_ID: string;
		QTWEBENGINE_DICTIONARIES_PATH: string;
		DA: string;
		KONSOLE_VERSION: string;
		MANAGERPID: string;
		GOROOT: string;
		KDE_SESSION_UID: string;
		__MISE_ORIG_PATH: string;
		npm_lifecycle_script: string;
		_CONDA_EXE: string;
		LESSCLOSE: string;
		XDG_SESSION_CLASS: string;
		_CONDA_ROOT: string;
		PAI_DIR: string;
		TERM: string;
		npm_package_name: string;
		_CE_CONDA: string;
		DEFAULTS_PATH: string;
		LESSOPEN: string;
		DA_COLOR: string;
		USER: string;
		COLORFGBG: string;
		CONDA_SHLVL: string;
		KDE_SESSION_VERSION: string;
		__MISE_SESSION: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		GSM_SKIP_SSH_AGENT_WORKAROUND: string;
		GIT_EDITOR: string;
		XDG_VTNR: string;
		XDG_SESSION_ID: string;
		npm_config_user_agent: string;
		OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: string;
		npm_execpath: string;
		CONDA_PYTHON_EXE: string;
		XDG_RUNTIME_DIR: string;
		CLAUDE_CODE_ENTRYPOINT: string;
		DEBUGINFOD_URLS: string;
		ENABLE_TOOL_SEARCH: string;
		API_TIMEOUT_MS: string;
		npm_package_json: string;
		BUN_INSTALL: string;
		QT_AUTO_SCREEN_SCALE_FACTOR: string;
		JOURNAL_STREAM: string;
		XCURSOR_THEME: string;
		GTK3_MODULES: string;
		MISE_SHELL: string;
		XDG_DATA_DIRS: string;
		KDE_FULL_SESSION: string;
		PATH: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		KDE_APPLICATIONS_AS_SCOPE: string;
		npm_node_execpath: string;
		OLDPWD: string;
		GOPATH: string;
		KONSOLE_DBUS_WINDOW: string;
		_: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
