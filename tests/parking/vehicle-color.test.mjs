import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const code = ts.transpileModule(
  readFileSync(new URL('../../src/lib/vehicleColor.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText
const { vehiclePaint, vehiclePaintCss, VEHICLE_COLOR_NAMES } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
)

test('reads English names by their keyword, whatever surrounds it', () => {
  assert.equal(vehiclePaint('Gentian Blue Metallic'), vehiclePaint('blue'))
  assert.equal(vehiclePaint('PEARL WHITE'), vehiclePaint('white'))
  assert.equal(vehiclePaint('Dark Blue'), 0x1d3f73)
  assert.notEqual(vehiclePaint('Dark Blue'), vehiclePaint('Blue'))
})

test('reads Vietnamese names, with or without accents', () => {
  assert.equal(vehiclePaint('Đỏ'), vehiclePaint('red'))
  assert.equal(vehiclePaint('do'), vehiclePaint('red'))
  assert.equal(vehiclePaint('Đen bóng'), vehiclePaint('black'))
  assert.equal(vehiclePaint('Trắng ngọc trai'), vehiclePaint('white'))
  assert.equal(vehiclePaint('Xanh dương'), vehiclePaint('blue'))
  assert.equal(vehiclePaint('Xanh lá'), vehiclePaint('green'))
  assert.equal(vehiclePaint('Bạc'), vehiclePaint('silver'))
})

test('does not find a colour inside another word', () => {
  assert.equal(vehiclePaint('Doraemon'), null)
  assert.equal(vehiclePaint('Credit'), null)
})

test('an unknown or missing colour has no paint', () => {
  assert.equal(vehiclePaint('Unicorn'), null)
  assert.equal(vehiclePaint(''), null)
  assert.equal(vehiclePaint(null), null)
  assert.equal(vehiclePaintCss('Unicorn'), null)
})

test('gives swatches a CSS colour', () => {
  assert.equal(vehiclePaintCss('Black'), '#111418')
})

test('every suggested name is recognised', () => {
  for (const name of VEHICLE_COLOR_NAMES) assert.notEqual(vehiclePaint(name), null, name)
})
