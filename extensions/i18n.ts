import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type Locale = "es" | "fr" | "pt-BR";
type Key = keyof typeof fallback;
type Params = Record<string, string | number>;

const namespace = "pi-cmux";

const fallback = {
	"open.usage": "Usage: /{name} <command...>",
	"open.failed": "tool split failed: {error}",
	"open.right.description": "Open a new right split and run any shell command there",
	"open.down.description": "Open a new lower split and run any shell command there",
	"open.alias.cmo": "Alias for /cmo",
	"open.success.right": "Opened a tool split to the right",
	"open.success.down": "Opened a tool split below",
} as const;

const translations: Record<Locale, Partial<Record<Key, string>>> = {
	es: {
		"open.usage": "Uso: /{name} <comando...>",
		"open.failed": "falló la división de herramienta: {error}",
		"open.right.description": "Abrir una nueva división a la derecha y ejecutar allí cualquier comando de shell",
		"open.down.description": "Abrir una nueva división inferior y ejecutar allí cualquier comando de shell",
		"open.alias.cmo": "Alias de /cmo",
		"open.success.right": "Se abrió una división de herramienta a la derecha",
		"open.success.down": "Se abrió una división de herramienta abajo",
	},
	fr: {
		"open.usage": "Utilisation : /{name} <commande...>",
		"open.failed": "échec du split d’outil : {error}",
		"open.right.description": "Ouvrir un nouveau split à droite et y exécuter n’importe quelle commande shell",
		"open.down.description": "Ouvrir un nouveau split inférieur et y exécuter n’importe quelle commande shell",
		"open.alias.cmo": "Alias de /cmo",
		"open.success.right": "Split d’outil ouvert à droite",
		"open.success.down": "Split d’outil ouvert en bas",
	},
	"pt-BR": {
		"open.usage": "Uso: /{name} <comando...>",
		"open.failed": "falha ao abrir divisão de ferramenta: {error}",
		"open.right.description": "Abrir uma nova divisão à direita e executar qualquer comando de shell nela",
		"open.down.description": "Abrir uma nova divisão inferior e executar qualquer comando de shell nela",
		"open.alias.cmo": "Alias para /cmo",
		"open.success.right": "Divisão de ferramenta aberta à direita",
		"open.success.down": "Divisão de ferramenta aberta abaixo",
	},
};

let currentLocale: string | undefined;

function format(template: string, params: Params = {}): string {
	return template.replace(/\{(\w+)\}/g, (_match, key) => String(params[key] ?? `{${key}}`));
}

export function t(key: Key, params?: Params): string {
	const locale = currentLocale as Locale | undefined;
	const template = locale ? translations[locale]?.[key] : undefined;
	return format(template ?? fallback[key], params);
}

export function initI18n(pi: ExtensionAPI): void {
	pi.events?.emit?.("pi-core/i18n/registerBundle", {
		namespace,
		defaultLocale: "en",
		fallback,
		translations,
	});
	pi.events?.on?.("pi-core/i18n/localeChanged", (event: unknown) => {
		currentLocale = event && typeof event === "object" && "locale" in event
			? String((event as { locale?: unknown }).locale ?? "")
			: undefined;
	});
	pi.events?.emit?.("pi-core/i18n/requestApi", {
		namespace,
		onApi(api: { getLocale?: () => string | undefined }) {
			currentLocale = api.getLocale?.();
		},
	});
}
