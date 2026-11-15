import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/lib/workAttendance.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { attendanceTime, attendanceLocalInput } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('actual timestamps cross local midnight correctly and missing times stay unrecorded', () => {
  assert.equal(attendanceTime(null, 'SE Asia Standard Time'), 'Not recorded')
  const text = attendanceTime('2026-11-15T23:05:00Z', 'SE Asia Standard Time')
  assert.match(text, /16\/11\/2026/)
  assert.match(text, /06:05:00/)
})
test('actual-time editing uses an explicit device-local value and preserves seconds', () => {
  const iso = '2026-11-15T23:05:37Z'
  assert.equal(new Date(attendanceLocalInput(iso)).toISOString(), iso.replace('Z', '.000Z'))
  assert.equal(attendanceLocalInput(null), '')
})

let moduleNumber = 0
async function realtimeFixture() {
  const handlers = new Map()
  let restored
  const calls = []
  const connection = {
    state: 'Disconnected', on: (type, callback) => handlers.set(type, callback),
    onreconnected: callback => { restored = callback },
    start: async () => { connection.state = 'Connected' },
    stop: async () => { connection.state = 'Disconnected'; calls.push(['stop']) },
    invoke: async (...args) => { calls.push(args) },
  }
  class Builder {
    withUrl() { return this } withAutomaticReconnect() { return this } configureLogging() { return this } build() { return connection }
  }
  globalThis.__attendanceRealtimeFixture = {
    signalr: { HubConnectionBuilder: Builder, HubConnectionState: { Connected: 'Connected', Disconnected: 'Disconnected' }, LogLevel: { Warning: 3 } },
    config: { getApiBaseUrl: () => 'http://unit.test/api', isMockService: () => false }, session: { getToken: () => 'unit-test-token' },
  }
  let code = ts.transpileModule(readFileSync(new URL('../../src/api/parkingOpsRealtime.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  code = code.replace(/import .* from '@microsoft\/signalr';/, 'const { HubConnectionBuilder, HubConnectionState, LogLevel } = globalThis.__attendanceRealtimeFixture.signalr;')
    .replace(/import .* from '@\/config\/env';/, 'const { getApiBaseUrl, isMockService } = globalThis.__attendanceRealtimeFixture.config;')
    .replace(/import .* from '@\/lib\/session';/, 'const { session } = { session: globalThis.__attendanceRealtimeFixture.session };')
  const { parkingOpsRealtime } = await import(`data:text/javascript;base64,${Buffer.from(`${code}\n// module ${moduleNumber++}`).toString('base64')}`)
  return { client: parkingOpsRealtime, calls, emit: (type, data) => handlers.get(type)(data), restore: () => restored() }
}
test('private attendance signals are delivered and reconnect notifies clients after rejoining the lot', async () => {
  const f = await realtimeFixture()
  const events = []
  const unsubscribe = f.client.subscribe(event => events.push(event), '7')
  await new Promise(resolve => setImmediate(resolve))
  f.emit('WorkAttendanceChanged', { lotId: 7 })
  assert.deepEqual(events[0], { type: 'WorkAttendanceChanged', lotId: 7 })
  f.calls.length = 0
  await f.restore()
  assert.deepEqual(f.calls[0], ['JoinLot', 7])
  assert.deepEqual(events.at(-1), { type: 'ConnectionRestored' })
  unsubscribe()
  delete globalThis.__attendanceRealtimeFixture
})
test('POS and calendar can share a lot subscription without unsubscribing each other', async () => {
  const f = await realtimeFixture()
  const first = f.client.subscribe(() => {}, '7')
  const second = f.client.subscribe(() => {}, '7')
  await new Promise(resolve => setImmediate(resolve))
  f.calls.length = 0
  first()
  assert.equal(f.calls.length, 0)
  await f.restore()
  assert.deepEqual(f.calls, [['JoinLot', 7]])
  second()
  assert.ok(f.calls.some(x => x[0] === 'LeaveLot'))
  assert.ok(f.calls.some(x => x[0] === 'stop'))
  delete globalThis.__attendanceRealtimeFixture
})
