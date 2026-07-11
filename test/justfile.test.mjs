import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const justfile = path.join(repoRoot, "justfile");

async function runRecipe(recipe, profile) {
	const root = await mkdtemp(path.join(os.tmpdir(), "pi-cmux-justfile-"));
	const bin = path.join(root, "bin");
	const log = path.join(root, "commands.log");
	await mkdir(bin);
	await writeFile(
		path.join(bin, "cmux"),
		`#!/bin/sh\nprintf 'cmux %s %s\\n' "$OMP_PROFILE" "$*" >> "$TEST_COMMAND_LOG"\n`,
	);
	await writeFile(
		path.join(bin, "omp"),
		`#!/bin/sh\nprintf 'omp %s %s\\n' "$OMP_PROFILE" "$*" >> "$TEST_COMMAND_LOG"\n`,
	);
	await chmod(path.join(bin, "cmux"), 0o755);
	await chmod(path.join(bin, "omp"), 0o755);

	const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_COMMAND_LOG: log };
	delete env.OMP_PROFILE;
	try {
		await execFile("just", ["--justfile", justfile, recipe, profile], {
			env,
		});
		return await readFile(log, "utf8");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

test("install-hook installs the cmux OMP hook into the requested profile", async () => {
	assert.equal(await runRecipe("install-hook", "work"), "cmux work hooks setup omp --yes\n");
});

test("install-with-hook installs the hook before pi-cmux into the requested profile", async () => {
	assert.equal(
		await runRecipe("install-with-hook", "work"),
		`cmux work hooks setup omp --yes\nomp  --profile=work plugin install ${repoRoot} --force\n`,
	);
});

test("install-with-hook is documented as the recommended installation recipe", async () => {
	const { stdout } = await execFile("just", ["--justfile", justfile, "--list"], { cwd: repoRoot });
	assert.match(stdout, /install-with-hook profile='' # recommended for most installs/);
});
