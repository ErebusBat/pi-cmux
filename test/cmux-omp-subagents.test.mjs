import assert from "node:assert/strict";
import test from "node:test";

import piCmuxExtensionBundle from "../extensions/index.ts";
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
		getSessionName: () => undefined,
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
		handlers,
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

test("silently disables integrations when cmux is unavailable", async () => {
	const api = createExtensionApi();
	const probes = [];
	api.pi.exec = async (command, args) => {
		probes.push({ command, args });
		throw new Error('Executable not found in $PATH: "cmux"');
	};

	await assert.doesNotReject(piCmuxExtensionBundle(api.pi));
	assert.deepEqual(probes, [{ command: "cmux", args: ["--version"] }]);
	assert.equal(api.handlers.size, 0);
});

function context(hasUI, sessionName = undefined) {
	return {
		hasUI,
		sessionManager: {
			getBranch: () => [],
			getSessionName: () => sessionName,
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

test("clears a completed sidebar label when a subagent starts", async t => {
	withCmuxEnvironment(t);
	const api = createExtensionApi();
	cmuxSidebarExtension(api.pi);
	const interactiveContext = context(true, "Review");

	await api.emit("session_start", {}, interactiveContext);
	await api.emit("agent_start", {}, interactiveContext);
	await api.emit("agent_end", { messages: [] }, interactiveContext);
	await new Promise(resolve => setImmediate(resolve));
	api.calls.length = 0;

	await api.emitOmp("task:subagent:lifecycle", {
		id: "Scout",
		agent: "scout",
		status: "started",
	});
	await new Promise(resolve => setImmediate(resolve));

	const statuses = api.calls.filter(call => call.args[0] === "set-status").map(call => call.args[2]);
	assert.equal(statuses.at(-1), "Review: working · 1 subagent (1 running)");
	assert.ok(statuses.every(status => !status.includes("done") && !status.includes("waiting for input")));
});

test("marks the sidebar working as soon as the user submits a message", async t => {
	withCmuxEnvironment(t);
	const api = createExtensionApi();
	cmuxSidebarExtension(api.pi);
	const interactiveContext = context(true, "Review");

	await api.emit("session_start", {}, interactiveContext);
	await api.emit("agent_start", {}, interactiveContext);
	await api.emit("agent_end", { messages: [] }, interactiveContext);
	await new Promise(resolve => setImmediate(resolve));
	api.calls.length = 0;

	await api.emit("before_agent_start", { prompt: "Continue the review" }, interactiveContext);
	await new Promise(resolve => setImmediate(resolve));

	const clearIndex = api.calls.findIndex(call => call.args[0] === "clear-status");
	const workingIndex = api.calls.findIndex(
		call => call.args[0] === "set-status" && call.args[2] === "Review: working",
	);
	assert.ok(clearIndex >= 0 && clearIndex < workingIndex);
});

test("waits for running subagents before showing an idle sidebar label", async t => {
	withCmuxEnvironment(t);
	const api = createExtensionApi();
	cmuxSidebarExtension(api.pi);
	const interactiveContext = context(true, "Review");

	await api.emit("session_start", {}, interactiveContext);
	await api.emit("agent_start", {}, interactiveContext);
	await api.emitOmp("task:subagent:lifecycle", {
		id: "Scout",
		agent: "scout",
		status: "started",
	});
	api.calls.length = 0;

	await api.emit("agent_end", { messages: [] }, interactiveContext);
	await new Promise(resolve => setImmediate(resolve));
	let statuses = api.calls.filter(call => call.args[0] === "set-status").map(call => call.args[2]);
	assert.equal(statuses.at(-1), "Review: working · 1 subagent (1 running)");

	api.calls.length = 0;
	await api.emitOmp("task:subagent:lifecycle", {
		id: "Scout",
		agent: "scout",
		status: "completed",
	});
	await new Promise(resolve => setImmediate(resolve));
	statuses = api.calls.filter(call => call.args[0] === "set-status").map(call => call.args[2]);
	assert.equal(statuses.at(-1), "Review: waiting for input · 1 subagent (1 done)");
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


test("uses one workspace status key across cmux surfaces", async t => {
	withCmuxEnvironment(t);
	process.env.CMUX_SURFACE_ID = "surface-one";
	const firstApi = createExtensionApi();
	cmuxSidebarExtension(firstApi.pi);
	await firstApi.emit("session_start", {}, context(true));
	await firstApi.emit("agent_start", {}, context(true));
	await new Promise(resolve => setImmediate(resolve));

	process.env.CMUX_SURFACE_ID = "surface-two";
	const secondApi = createExtensionApi();
	cmuxSidebarExtension(secondApi.pi);
	await secondApi.emit("session_start", {}, context(true));
	await secondApi.emit("agent_start", {}, context(true));
	await new Promise(resolve => setImmediate(resolve));

	const firstStatus = firstApi.calls.find(call => call.args[0] === "set-status");
	const secondStatus = secondApi.calls.find(call => call.args[0] === "set-status");
	assert.equal(firstStatus.args[1], "pi-cmux-workspace-test");
	assert.equal(secondStatus.args[1], firstStatus.args[1]);
});

test("does not emit duplicate working heartbeat logs", async t => {
	withCmuxEnvironment(t);
	const api = createExtensionApi();
	cmuxSidebarExtension(api.pi);

	await api.emit("session_start", {}, context(true, "Review"));
	await api.emit("agent_start", {}, context(true, "Review"));
	await new Promise(resolve => setTimeout(resolve, 1100));

	assert.equal(
		api.calls.filter(call => call.args[0] === "log" && call.args.at(-1).startsWith("Working -")).length,
		0,
	);
});
