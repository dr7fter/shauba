import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const sourcePath = new URL('../src/data/featureFlags.ts', import.meta.url)

function loadFeatureFlags(viteEnv = {}) {
  const source = readFileSync(sourcePath, 'utf8').replaceAll(
    'import.meta.env',
    'globalThis.__VITE_ENV__',
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const exports = {}
  const context = vm.createContext({
    exports,
    module: { exports },
    __VITE_ENV__: { DEV: false, VITE_SHUABA_FEATURE_FLAGS: '', ...viteEnv },
  })
  vm.runInContext(compiled, context)
  return context.module.exports.getFeatureFlags()
}

test('production installer enables the five accepted v1.5 features by default', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(loadFeatureFlags())), {
    learningCenterV1: true,
    learningEvidenceProjectionV1: true,
    lowConfidenceGateV1: true,
    nonPressureBatchGradingV1: true,
    shadowRecommendationPlanV1: true,
    rankedOnlyEloV1: false,
    friendBroadcastsV1: false,
  })
})

test('compile-time flags can additionally expose controlled features', () => {
  const flags = loadFeatureFlags({
    VITE_SHUABA_FEATURE_FLAGS: 'rankedOnlyEloV1,friendBroadcastsV1',
  })
  assert.equal(flags.rankedOnlyEloV1, true)
  assert.equal(flags.friendBroadcastsV1, true)
})
