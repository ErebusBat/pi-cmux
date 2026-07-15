import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import cmuxNotifyExtension from "./cmux-notify.ts";
import cmuxSplitExtension from "./cmux-split.ts";
import cmuxZoxideExtension from "./cmux-zoxide.ts";
import cmuxReviewExtension from "./cmux-review.ts";
import cmuxContinueExtension from "./cmux-continue.ts";
import cmuxOpenExtension from "./cmux-open.ts";
import cmuxSidebarExtension from "./cmux-sidebar.ts";
import { initI18n } from "./i18n.ts";

const CMUX_AVAILABILITY_TIMEOUT_MS = 5000;

async function isCmuxAvailable(pi: ExtensionAPI): Promise<boolean> {
	try {
		const result = await pi.exec("cmux", ["--version"], {
			timeout: CMUX_AVAILABILITY_TIMEOUT_MS,
		});
		return result.code === 0 && !result.killed;
	} catch {
		return false;
	}
}

export default async function piCmuxExtensionBundle(pi: ExtensionAPI): Promise<void> {
	if (!(await isCmuxAvailable(pi))) return;

	initI18n(pi);
	cmuxNotifyExtension(pi);
	cmuxSplitExtension(pi);
	cmuxZoxideExtension(pi);
	cmuxReviewExtension(pi);
	cmuxContinueExtension(pi);
	cmuxOpenExtension(pi);
	cmuxSidebarExtension(pi);
}
