import { randomUUID } from 'node:crypto';

function summarizeCommand(command) {
  return {
    id: command.id,
    type: command.type,
    status: command.status,
    createdAt: command.createdAt,
    dispatchedAt: command.dispatchedAt || null,
    completedAt: command.completedAt || null,
    error: command.error || null,
    result: command.result ?? null,
  };
}

function createCommandQueue() {
  const commands = [];

  function createCommand(type, payload) {
    const now = new Date().toISOString();
    const command = {
      id: randomUUID(),
      type,
      payload: payload || {},
      status: 'queued',
      createdAt: now,
      dispatchedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };
    commands.push(command);
    return command;
  }

  function findCommand(id) {
    return commands.find((command) => command.id === id) || null;
  }

  function claimNextCommand() {
    const command = commands.find((entry) => entry.status === 'queued');
    if (!command) return null;

    command.status = 'dispatched';
    command.dispatchedAt = new Date().toISOString();
    return command;
  }

  function completeCommand(id, body) {
    const command = findCommand(id);
    if (!command) return null;

    command.status = body?.ok === false ? 'failed' : 'completed';
    command.completedAt = new Date().toISOString();
    command.result = body?.result ?? null;
    command.error = body?.ok === false ? (body?.error || 'Unknown command failure.') : null;
    return command;
  }

  function snapshot() {
    return commands.map(summarizeCommand);
  }

  return {
    createCommand,
    findCommand,
    claimNextCommand,
    completeCommand,
    snapshot,
  };
}

export { createCommandQueue, summarizeCommand };
