import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ESCALATION_TARGETS,
  WIDER_MODES,
  approveEscalation,
  validateEscalationArgs,
  sandboxPermissionsDescription,
} from '../lib/index.js'

const agent = { id: 'agent-1' }

function approver(outcome, calls = []) {
  return {
    async request(request) {
      calls.push(request)
      return outcome
    },
  }
}

test('closed escalation vocabulary', () => {
  assert.deepEqual(ESCALATION_TARGETS, ['workspace-write', 'danger-full-access'])
  assert.deepEqual(WIDER_MODES['read-only'], ['workspace-write', 'danger-full-access'])
  assert.deepEqual(WIDER_MODES['workspace-write'], ['danger-full-access'])
  assert.equal(sandboxPermissionsDescription('command').includes('narrowest wider'), true)
})

test('escalation argument pairing is enforced', () => {
  assert.doesNotThrow(() => validateEscalationArgs(undefined, undefined))
  assert.throws(() => validateEscalationArgs('danger-full-access', undefined), /requires a justification/)
  assert.throws(() => validateEscalationArgs(undefined, 'why'), /only valid together/)
  assert.throws(() => validateEscalationArgs('danger-full-access', '   '), /non-empty sentence/)
})

test('repeating the effective mode needs no approval', async () => {
  const calls = []
  const mode = await approveEscalation(
    { requestedMode: 'workspace-write', justification: 'same mode', effectiveMode: 'workspace-write', subject: 'command' },
    { approver: approver('rejected', calls), agent, callId: 'c1', toolName: 'bash' },
  )
  assert.equal(mode, 'workspace-write')
  assert.equal(calls.length, 0)
})

test('a non-wider target fails closed', async () => {
  await assert.rejects(
    approveEscalation(
      { requestedMode: 'read-only', justification: 'narrower', effectiveMode: 'workspace-write', subject: 'command' },
      { approver: approver('allowed-once'), agent, callId: 'c1', toolName: 'bash' },
    ),
    /not strictly wider/,
  )
})

test('allowed-once resolves the wider mode and sends the official reason shape', async () => {
  const calls = []
  const mode = await approveEscalation(
    { requestedMode: 'danger-full-access', justification: 'needs node_modules', effectiveMode: 'workspace-write', subject: 'command' },
    { approver: approver('allowed-once', calls), agent, callId: 'c1', toolName: 'bash' },
  )
  assert.equal(mode, 'danger-full-access')
  assert.equal(calls[0].reason, 'escalate sandbox to danger-full-access: needs node_modules')
  assert.equal(calls[0].displayReason.en, 'Allow this operation with danger-full-access permissions: needs node_modules')
  assert.equal(calls[0].displayReason.zh, '允许本次操作使用 danger-full-access 权限：needs node_modules')
})

test('rejected / cancelled / unavailable fail closed', async () => {
  const base = { requestedMode: 'danger-full-access', justification: 'why', effectiveMode: 'workspace-write', subject: 'command' }
  await assert.rejects(
    approveEscalation(base, { approver: approver('rejected'), agent, callId: 'c1', toolName: 'bash' }),
    /rejected escalating/,
  )
  await assert.rejects(
    approveEscalation(base, { approver: approver('cancelled'), agent, callId: 'c1', toolName: 'bash' }),
    /cancelled/,
  )
  await assert.rejects(
    approveEscalation(base, { approver: approver('unavailable'), agent, callId: 'c1', toolName: 'bash' }),
    /no approval channel/,
  )
})

test('missing approval service or agent fails closed', async () => {
  const base = { requestedMode: 'danger-full-access', justification: 'why', effectiveMode: 'workspace-write', subject: 'command' }
  await assert.rejects(
    approveEscalation(base, { approver: undefined, agent, callId: 'c1', toolName: 'bash' }),
    /no approval service/,
  )
  await assert.rejects(
    approveEscalation(base, { approver: approver('allowed-once'), agent: undefined, callId: 'c1', toolName: 'bash' }),
    /no agent/,
  )
})
