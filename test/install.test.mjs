import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const installScript = path.join(repoRoot, "install.mjs");

test("local install resolves the Pi SDK from the installed package", async (t) => {
	const home = await mkdtemp(path.join(os.tmpdir(), "pi-cmux-install-"));
	t.after(async () => rm(home, { recursive: true, force: true }));
	const homeRoot = path.parse(home).root;
	const env = { ...process.env, HOME: home, USERPROFILE: home, HOMEDRIVE: homeRoot, HOMEPATH: home.slice(homeRoot.length) };
	assert.equal(env.USERPROFILE, home);
	assert.equal(env.HOMEDRIVE, path.parse(home).root);
	assert.equal(env.HOMEPATH, home.slice(path.parse(home).root.length));

	await execFile(process.execPath, [installScript], { cwd: repoRoot, env });

	const packageDir = path.join(home, ".pi", "agent", "packages", "pi-cmux");
	await assert.doesNotReject(
		execFile(process.execPath, ["--input-type=module", "--eval", "await import('@earendil-works/pi-coding-agent')"], {
			cwd: packageDir,
			env,
		}),
	);
});
