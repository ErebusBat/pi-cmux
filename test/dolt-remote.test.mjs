import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const justfile = path.join(repoRoot, "justfile");

test("sync-dolt-remote converts Git's SSH alias URL for Dolt", async (t) => {
	const workspace = await mkdtemp(path.join(os.tmpdir(), "pi-cmux-dolt-remote-"));
	t.after(async () => rm(workspace, { recursive: true, force: true }));
	const bin = path.join(workspace, "bin");
	const log = path.join(workspace, "bd.log");
	await mkdir(bin);
	await writeFile(
		path.join(bin, "bd"),
		"#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$BD_LOG\"\n",
	);
	await chmod(path.join(bin, "bd"), 0o755);
	await execFile("git", ["init"], { cwd: workspace });
	await execFile("git", ["remote", "add", "origin", "git@github-eb:ErebusBat/pi-cmux.git"], { cwd: workspace });

	await execFile("just", ["--justfile", justfile, "sync-dolt-remote"], {
		cwd: workspace,
		env: { ...process.env, BD_LOG: log, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
	});

	assert.equal(
		await readFile(log, "utf8"),
		"dolt remote remove origin\ndolt remote add origin git+ssh://git@github-eb/ErebusBat/pi-cmux.git\ndolt remote list\n",
	);
});
