import assert from "node:assert/strict";
import test from "node:test";

import cmuxNotifyExtension from "../extensions/cmux-notify.ts";
import cmuxSidebarExtension from "../extensions/cmux-sidebar.ts";

function createExtensionApi() {
	const handlers = new Map();
	const eventHandlers = new Map();
	const calls = [];

	const pi = {
		on(event, handler) {
			handlers.set(event, handler);
		},
		async exec(command, args) {
			calls.push({ command, args });
			return { code: 0, stdout: "", stderr: "", killed: false };
		},
		events: {
			on(channel, handler) {
			const listeners = eventHandlers.get(channel) ?? [];
			listeners.push(handler);
			eventHandlers.set(channel, listeners);
			return () => {};
			},
		},
	};

	return {
		pi,
		calls,
		async emit(event, payload, context) {
			await handlers.get(event)?.(payload, context);
		},
		async emitOmp(channel, payload) {
			for (const handler of eventHandlers.get(channel) ?? []) {
				await handler(payload);
			}
		},
	};
}

function context(hasUI) {
	return {
		hasUI,
		sessionManager: {
			getBranch: () => [],
		},
	};
}

function withCmuxEnvironment(t) {
	const previous = {
		CMUX_WORKSPACE_ID: process.env.CMUX_WORKSPACE_ID,
		CMUX_SURFACE_ID: process.env.CMUX_SURFACE_ID,
		PI_CMUX_SIDEBAR_FINAL_CLEAR_MS: process.env.PI_CMUX_SIDEBAR_FINAL_CLEAR_MS,
	};
	process.env.CMUX_WORKSPACE_ID = "workspace-test";
	process.env.CMUX_SURFACE_ID = "surface-test";
	process.env.PI_CMUX_SIDEBAR_FINAL_CLEAR_MS = "60000";
	t.after(() => {
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	});
}

test("does not notify when OMP runs a headless subagent", async () => {
	const api = createExtensionApi();
	cmuxNotifyExtension(api.pi);

	await api.emit("agent_start", {}, context(false));
	await api.emit("agent_end", { messages: [] }, context(false));

	assert.equal(api.calls.length, 0);
});

test("continues to notify for an interactive OMP main run", async () => {
	const api = createExtensionApi();
	cmuxNotifyExtension(api.pi);

	await api.emit("agent_start", {}, context(true));
	await api.emit("agent_end", { messages: [] }, context(true));

	assert.equal(api.calls.length, 1);
	assert.deepEqual(api.calls[0].args.slice(0, 2), ["rpc", "notification.create"]);
});

test("does not let a headless OMP subagent control the cmux sidebar", async t => {
	withCmuxEnvironment(t);
	const api = createExtensionApi();
	cmuxSidebarExtension(api.pi);

	await api.emit("session_start", {}, context(false));
	await api.emit("agent_start", {}, context(false));
	await api.emit("agent_end", { messages: [] }, context(false));

	assert.equal(api.calls.length, 0);
});

test("shows OMP subagent progress in the interactive sidebar", async t => {
	withCmuxEnvironment(t);
	const api = createExtensionApi();
	cmuxSidebarExtension(api.pi);

	await api.emit("session_start", {}, context(true));
	await api.emit("agent_start", {}, context(true));
	api.calls.length = 0;

	await api.emitOmp("task:subagent:lifecycle", {
		id: "Scout",
		agent: "scout",
		agentSource: "bundled",
		status: "started",
		index: 0,
	});
	await api.emitOmp("task:subagent:progress", {
		id: "Scout",
		agent: "scout",
		agentSource: "bundled",
		progress: { status: "running", lastIntent: "Inspecting lifecycle events" },
		index: 0,
	});
	await new Promise(resolve => setImmediate(resolve));

	assert.ok(
		api.calls.some(call => call.args[0] === "set-status" && call.args[2].includes("1 subagent (1 running)")),
	);
	assert.ok(api.calls.some(call => call.args[0] === "log" && call.args.at(-1).includes("Scout")));
});
