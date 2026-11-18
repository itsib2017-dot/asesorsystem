# Graph Report - webapps_asesor  (2026-11-18)

## Corpus Check
- 672 files · ~1,320,414 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 30 file(s) not represented in the graph (top: (none) 19, .example 2, .jsonl 2)

## Summary
- 4869 nodes · 11308 edges · 223 communities (181 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9b7e18d4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ref_node_fs
- session-helpers.mjs
- check-update.mjs
- compileWorkflowInternal
- archify.mjs
- ref_vitest
- ref_node_os
- render-lifecycle.mjs
- architecture-delta.mjs
- workflow-compiler.mjs
- getSupabaseServerClient
- getSessionDBPath
- codex-companion.mjs
- ref_node_url
- worker/index.ts
- postinstall.mjs
- dependencies
- ref_node_child_process
- live-benchmark-v04.ts
- routing.mjs
- session-extract.bundle.mjs
- codex.mjs
- ref_node_path
- render-architecture.mjs
- broker-lifecycle.mjs
- getUser
- server.test.ts
- ref_next
- properties
- session-loaders.mjs
- real-bytes-stats.test.ts
- enabledPlugins
- dependencies
- ref_src_session_db_js
- generated-validators.mjs
- get-session.ts
- redirect-marker-read.test.ts
- kimi/stop.mjs
- auth.repository.ts
- package.json
- session-db.bundle.mjs
- state.mjs
- purge-session.test.ts
- cache-heal-self-heal.test.ts
- diagnostics.mjs
- writeAuditLog
- brand-marks.mjs
- isolated-env.ts
- project-dir.test.ts
- plugins/openclaw.test.ts
- cli.test.ts
- provider/actions.ts
- check-render-output.mjs
- search.test.ts
- ensure-deps.mjs
- git.mjs
- steps
- job-control.mjs
- RunnerTests
- runtime.test.mjs
- graders
- runner.py
- ref_lucide_react
- visual-check.mjs
- repro-before-fix/case.yaml
- graders
- AppServerClientBase
- graders
- graders
- adversarial-injected-instructions-in-logs/case.yaml
- adversarial-secret-in-pasted-log/case.yaml
- fires-on-plain-bug-report/case.yaml
- graders
- graders
- platform-bridge.mjs
- hooks/formatters.test.ts
- security.bundle.mjs
- render.mjs
- perf-measure-not-guess/case.yaml
- integration.test.ts
- graders
- graders
- graders
- workflow-v2.mjs
- graders
- graders
- graders
- graders
- compilerOptions
- adversarial-pressure-to-skip-process/case.yaml
- alternatives-before-committing/case.yaml
- multi-component-localise-first/case.yaml
- no-repro-ask-do-not-guess/case.yaml
- three-failed-fixes-question-the-design/case.yaml
- template.sh
- attributes
- parseAttrs
- codex/stop.mjs
- benchmark.ts
- session-snapshot.bundle.mjs
- sync_skill_readme.py
- auto-clarity-destructive/case.yaml
- redact.ts
- package-large.json
- ctx-debug.sh
- codex/package.json
- sync_eval_index.py
- attributes
- session-attribution.bundle.mjs
- gen_debug_bakeoff.py
- pi-extension.test.ts
- source-example.ts
- test_runner.py
- app-server-protocol.d.ts
- compilerOptions
- PipeCdp
- bump-version.mjs
- archify/package.json
- scenarios.mjs
- middleware.ts
- .openclaw-plugin/package.json
- postinstall-heal.test.ts
- scripts
- mcp-integration.ts
- IntegrationTests
- constructor
- fs.mjs
- EvalIndexTests
- pi-mcp-bridge.test.ts
- compilerOptions
- extract-multilang.test.ts
- EvalColumnTests
- hooks
- plugins
- heal-better-sqlite3.mjs
- Ie
- prove-narrative-render.ts
- similarity/page.tsx
- UserService
- config.repository.ts
- scripts
- better-sqlite3
- codex.test.ts
- desktop-readability.mjs
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- contact_links
- Q
- assert-asymmetric-drift.mjs
- app/layout.tsx
- sendRpc
- gate-skill-evals.sh
- context-mode
- Ee
- assert-stats.mjs
- env.ts
- interface
- interface
- interface
- hitl-loop.template.sh
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- interface
- context-mode
- cleanup
- ai
- context-mode
- context-mode
- kilo.json
- context-mode
- context-mode
- opencode.json
- mammoth
- gate-readme-skills.sh
- guard-key-literals.sh
- guard-secrets.sh
- session-context.sh
- sync-eval-index.sh
- sync-readme-skills.sh
- perf-measure-not-guess/scaffold.sh
- repro-before-fix/scaffold.sh
- FUNDING.yml
- install-openclaw-plugin.sh
- test-openclaw-e2e.sh
- run-pi-smoke.sh
- ot
- next@16.4.6
- react@19.3.0
- ctx-upgrade-platform-threading.test.ts
- lt
- I
- lucide-react@^0.469.0
- react-dom@19.3.0
- zod3tov4-production.test.ts
- bulkInsertEvents
- eslint.config.mjs
- docx
- jszip

## God Nodes (most connected - your core abstractions)
1. `compileWorkflowInternal()` - 175 edges
2. `getSupabaseServerClient()` - 76 edges
3. `getUser()` - 65 edges
4. `asArray()` - 53 edges
5. `hasDatabaseUrl()` - 50 edges
6. `withRlsTransaction()` - 49 edges
7. `getSessionId()` - 48 edges
8. `parseStdin()` - 45 edges
9. `getInputProjectDir()` - 44 edges
10. `readStdin()` - 42 edges

## Surprising Connections (you probably didn't know these)
- `createSentinel()` --calls--> `sentinelDir()`  [EXTRACTED]
  tests/hooks/core-routing.test.ts → hooks/core/mcp-ready.mjs
- `hasUnrelatedLiveSentinel()` --calls--> `sentinelDir()`  [EXTRACTED]
  tests/hooks/core-routing.test.ts → hooks/core/mcp-ready.mjs
- `boundaryRect()` --calls--> `asArray()`  [EXTRACTED]
  .agents/skills/archify/renderers/architecture/render-architecture.mjs → .agents/skills/archify/renderers/shared/geometry.mjs
- `ye()` --indirect_call--> `j()`  [INFERRED]
  hooks/session-db.bundle.mjs → hooks/security.bundle.mjs
- `oe()` --indirect_call--> `ne()`  [INFERRED]
  hooks/session-extract.bundle.mjs → hooks/security.bundle.mjs

## Import Cycles
- None detected.

## Communities (223 total, 42 thin omitted)

### Community 0 - "ref_node_fs"
Cohesion: 0.03
Nodes (43): assertBundleClean(), FORBIDDEN_PATTERNS, main(), TARGETS, walkFiles(), FIXTURE, HERE, cliSrc (+35 more)

### Community 1 - "session-helpers.mjs"
Cohesion: 0.05
Nodes (63): HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, HOOK_DIR, { loadSessionDB, loadSnapshot }, __hookDir, HOOK_DIR, { loadSessionDB }, HOOK_DIR (+55 more)

### Community 2 - "check-update.mjs"
Cohesion: 0.06
Nodes (104): acknowledgeUpdate(), acquireOperation(), assertBoundedRegularFile(), assertCacheTargetAbsent(), assertRenameableCacheEntry(), assertSafeCacheEntry(), assertSafeDirectory(), assertSafeRegularFile() (+96 more)

### Community 3 - "compileWorkflowInternal"
Cohesion: 0.05
Nodes (121): connectionSides(), withDiagnosticRecordingSuppressed(), anchor(), automaticPortSpread(), chosenSide(), defaultFromSide(), defaultToSide(), pointInBox() (+113 more)

### Community 4 - "archify.mjs"
Cohesion: 0.05
Nodes (97): assertEvidenceType(), CHECK_FIXES, checkerDiagnostics(), [command, ...args], commandBrands(), commandCheck(), commandCompare(), commandDeliver() (+89 more)

### Community 5 - "ref_vitest"
Cohesion: 0.03
Nodes (11): batchRequests, fetchAndIndexSchema, makeNarrativeContext(), makeReport(), InsertEventParams, CFG, FIXTURE, HERE (+3 more)

### Community 6 - "ref_node_os"
Cohesion: 0.04
Nodes (19): ../../src/adapters/detect.js, AGY_PLUGIN, walk(), PLUGIN, REPO_ROOT, clearPluginRoots(), pluginRoots(), homedirMock (+11 more)

### Community 7 - "render-lifecycle.mjs"
Cohesion: 0.04
Nodes (129): renderBoundaryFrame(), renderBoundaryLabel(), renderComponent(), renderConnectionLabel(), renderConnectionPath(), renderSvg(), automaticPorts, compositionFrames (+121 more)

### Community 8 - "architecture-delta.mjs"
Cohesion: 0.07
Nodes (72): addNodeMarker(), addState(), annotateArchitectureSideSvg(), architectureDeltaChangeRows(), ArchitectureDeltaError, BOUNDARY_FIELDS, boundaryChangeMap(), boundaryElements() (+64 more)

### Community 9 - "workflow-compiler.mjs"
Cohesion: 0.09
Nodes (73): validateArchitecture(), validateDataflow(), validateLifecycle(), validateSequence(), brandTopRailProblem(), recordDiagnostic(), asArray(), authoredAnalysisSegments() (+65 more)

### Community 10 - "getSupabaseServerClient"
Cohesion: 0.08
Nodes (65): drizzle-orm, confirmCertificateNameAction(), saveUnitDecisionAction(), DrizzleDb, hasDatabaseUrl(), isUuid(), ADR-0004, withRlsTransaction() (+57 more)

### Community 11 - "getSessionDBPath"
Cohesion: 0.06
Nodes (56): captureCodexInstructionRules(), HOOK_DIR, { loadSessionDB }, ROUTING_BLOCK, toolNamer, HOOK_DIR, { loadSessionDB }, ROUTING_BLOCK (+48 more)

### Community 12 - "codex-companion.mjs"
Cohesion: 0.08
Nodes (65): buildNativeReviewTarget(), buildReviewJobMetadata(), buildTaskJob(), buildTaskRequest(), buildTaskRunMetadata(), createCompanionJob(), ensureCodexAvailable(), executeTaskRun() (+57 more)

### Community 13 - "ref_node_url"
Cohesion: 0.06
Nodes (49): fromAgy(), getAgyProjectDir(), normalizeAgyToolInput(), normalizeAgyToolName(), parseAgyPayload(), HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, __hookDir (+41 more)

### Community 14 - "worker/index.ts"
Cohesion: 0.06
Nodes (65): generateStructured(), resolveModel(), RuntimeLlmConfig, buildNameJuryPrompt(), binaryDecisionCodeSchema, binaryDecisionSchema, buildDitAnalysisSchema(), coverageStatusSchema (+57 more)

### Community 15 - "postinstall.mjs"
Cohesion: 0.10
Nodes (23): ../build/runtime.js, fwd(), hasStaleCacheVersionSegment(), needsHookNormalization(), normalizeHooksJson(), normalizeHooksJsonOnly(), normalizeHooksOnStartup(), normalizePluginJson() (+15 more)

### Community 16 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @ai-sdk/anthropic@^4.0.106, @ai-sdk/google@^4.0.122, @ai-sdk/openai@^4.0.121, drizzle-orm@^0.45.4, exceljs@^4.4.0, lucide-react@^1.74.0, pdf-lib@^1.17.1 (+11 more)

### Community 17 - "ref_node_child_process"
Cohesion: 0.04
Nodes (27): __dirname, outputRoot, skillRoot, TARGETS, cleanups, createTempRoot(), ensureDepsAbsPath, runCodesignHarness() (+19 more)

### Community 18 - "live-benchmark-v04.ts"
Cohesion: 0.04
Nodes (32): __dirname, executor, fixtureDir, runtimes, Scenario, scenarios, BenchmarkRow, __dirname (+24 more)

### Community 19 - "routing.mjs"
Cohesion: 0.06
Nodes (53): isMCPReady(), sentinelDir(), sentinelPath(), sentinelPathForPid(), defaultGuidanceId(), getBashNudgeMinCommandBytes(), getCodexConfigDir(), getExternalMcpNudgeEvery() (+45 more)

### Community 20 - "session-extract.bundle.mjs"
Cohesion: 0.10
Nodes (25): A(), dt(), fe(), ft(), gt(), ht(), J(), jt() (+17 more)

### Community 21 - "codex.mjs"
Cohesion: 0.09
Nodes (52): applyTurnNotification(), belongsToTurn(), buildAppServerAuthStatus(), buildAuthStatus(), buildPersistentTaskThreadName(), buildResultStatus(), buildResumeParams(), buildTaskThreadName() (+44 more)

### Community 22 - "ref_node_path"
Cohesion: 0.04
Nodes (18): PLUGIN_ROOT, ROOT, RFC-8259, PI_CONFIG_DIR, CODEX_MARKETPLACE_PATHS, RawMarketplaceManifest, RawPluginEntry, RawPluginSourceObject (+10 more)

### Community 23 - "render-architecture.mjs"
Cohesion: 0.06
Nodes (52): DEFAULT_GRID, gridLayout(), resolveComponentPos(), validateGridPlacement(), alignFacingPorts(), architectureLegendEntries, automaticPorts, autoViewBoxFor() (+44 more)

### Community 24 - "broker-lifecycle.mjs"
Cohesion: 0.07
Nodes (46): buildJsonRpcError(), buildStreamThreadIds(), isInterruptRequest(), main(), routeNotification(), send(), STREAMING_METHODS, writePidFile() (+38 more)

### Community 25 - "getUser"
Cohesion: 0.10
Nodes (38): GET(), createBatchSchema, GET(), POST(), analyseSchema, POST(), enqueueSchema, POST() (+30 more)

### Community 26 - "server.test.ts"
Cohesion: 0.04
Nodes (25): RFC-6874, Captured, CaseAString, __dirname, DoctorJsonRpcResponse, FakeReturn, ForbiddenRule, gfmPath (+17 more)

### Community 27 - "ref_next"
Cohesion: 0.07
Nodes (33): contentSecurityPolicy, nextConfig, GET(), forgotPasswordAction(), ForgotPasswordState, forgotSchema, ForgotPasswordForm(), ForgotPasswordFormProps (+25 more)

### Community 28 - "properties"
Cohesion: 0.04
Nodes (46): additionalProperties, minLength, type, maximum, minimum, type, minLength, type (+38 more)

### Community 29 - "session-loaders.mjs"
Cohesion: 0.11
Nodes (23): RFC-4122, ./build/server.js, detectPlatformFromEnv(), PLATFORM_ENV_VARS_MIRROR, hasPlatformConfig(), copyDirSync(), logError(), resolveClaudeConfigDir() (+15 more)

### Community 30 - "real-bytes-stats.test.ts"
Cohesion: 0.04
Nodes (20): better-sqlite3, REPO, __dirname, HOOK_PATH, REPO, __dirname, HookResult, HOOKS_DIR (+12 more)

### Community 31 - "enabledPlugins"
Cohesion: 0.05
Nodes (45): alwaysThinkingEnabled, autoUpdatesChannel, source, enabledPlugins, claudex-loop@claudex-loop, codex@openai-codex, context7@claude-plugins-official, context-mode@context-mode (+37 more)

### Community 32 - "dependencies"
Cohesion: 0.06
Nodes (46): @auth/prisma-adapter, class-variance-authority, clsx, date-fns, next-auth, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-toast (+38 more)

### Community 33 - "ref_src_session_db_js"
Cohesion: 0.04
Nodes (18): TestAdapter, CapturedPost, platformConfigFile(), SEED_INSERT_COLUMNS, VARIANT_COLUMNS, writePlatformConfig(), cleanups, __dirname (+10 more)

### Community 34 - "generated-validators.mjs"
Cohesion: 0.06
Nodes (44): architecture, dataflow, func3(), lifecycle, pattern17, pattern18, pattern20, pattern4 (+36 more)

### Community 35 - "get-session.ts"
Cohesion: 0.09
Nodes (32): extractSchemeNumber(), GET(), Ak05Page(), extractSchemeNumber(), metadata, DashboardPage(), metadata, uploadSignatureAction() (+24 more)

### Community 36 - "redirect-marker-read.test.ts"
Cohesion: 0.02
Nodes (41): CODEX_PRECOMPACT_PATH, CODEX_SESSIONSTART_PATH, CODEX_USER_PROMPT_PATH, __dirname, CODEX_SESSIONSTART_PATH, __dirname, __dirname, HookResult (+33 more)

### Community 37 - "kimi/stop.mjs"
Cohesion: 0.12
Nodes (13): HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, HOOK_DIR, { loadSessionDB, loadSnapshot }, HOOK_DIR, { loadSessionDB }, HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution } (+5 more)

### Community 38 - "auth.repository.ts"
Cohesion: 0.13
Nodes (20): AppShellLayout(), signOutAction(), completeOnboardingAction(), onboardingSchema, OnboardingState, signOutFromOnboardingAction(), OnboardingForm(), OnboardingFormProps (+12 more)

### Community 39 - "package.json"
Cohesion: 0.12
Nodes (22): devDependencies, eslint@^9, eslint-config-next@16.4.6, tailwindcss@4.3.3, @tailwindcss/turbopack@4.3.3, @types/node@^20, @types/react@^19, @types/react-dom@^19 (+14 more)

### Community 40 - "session-db.bundle.mjs"
Cohesion: 0.10
Nodes (20): claimLatestUnconsumedResume(), cleanupOldSessions(), deleteSession(), ensureSession(), getEventBytesSummary(), getEventCount(), getEvents(), getLatestAttributedProjectDir() (+12 more)

### Community 41 - "state.mjs"
Cohesion: 0.16
Nodes (32): createTrackedProgress(), enqueueBackgroundTask(), spawnDetachedTaskWorker(), defaultState(), ensureStateDir(), FALLBACK_STATE_ROOT_DIR, loadState(), nowIso() (+24 more)

### Community 42 - "purge-session.test.ts"
Cohesion: 0.09
Nodes (8): HandlerFn, registerOmpPlugin(), createPluginWithRejectingLog(), createTestPlugin(), mcpSentinel, cleanup, cleanup, ADR-0001

### Community 43 - "cache-heal-self-heal.test.ts"
Cohesion: 0.12
Nodes (18): buildHookCommand(), ensureShebangAndExecBit(), extractNodePath(), fwd(), isStaleNodePath(), rewriteShellSnapshots(), selfHealCacheHealHook(), selfHealShellSnapshots() (+10 more)

### Community 44 - "diagnostics.mjs"
Cohesion: 0.11
Nodes (29): loadDiagram(), loadDiagramWithBrandMarks(), validateGuidedViews(), validateRelationshipIds(), boundaryKey, fallbackDiagnostic(), installRendererDiagnosticBoundary(), normalizedDiagnostic() (+21 more)

### Community 45 - "writeAuditLog"
Cohesion: 0.20
Nodes (11): @supabase/supabase-js, saveSchemeManifestAction(), schemeSchema, SchemeRegistrationForm(), metadata, SchemesPage(), AuditLogEntry, writeAuditLog() (+3 more)

### Community 46 - "brand-marks.mjs"
Cohesion: 0.10
Nodes (31): asUrl(), attribute(), beforeDeadline(), captureBrandReference(), captureRemoteBrand(), captureTimeoutMilliseconds(), checkedFetch(), COLLECTIONS (+23 more)

### Community 47 - "isolated-env.ts"
Cohesion: 0.08
Nodes (23): cleanups, _hashCanonical(), isolatedHomeEnv(), runStatusline(), seedRealAdapter(), STATUSLINE, isolatedHomeEnv(), runStatusline() (+15 more)

### Community 48 - "project-dir.test.ts"
Cohesion: 0.07
Nodes (14): ALL_PLATFORM_ENV_VARS, existsSyncMock, ALL_PLATFORM_ENV_VARS, existsSyncMock, awaitRpc(), __dirname, initServer(), mcpEntry (+6 more)

### Community 49 - "plugins/openclaw.test.ts"
Cohesion: 0.06
Nodes (14): registerContextModeInOpenclawConfig(), mcpSentinel, POSTTOOL_CASES, PRETOOL_CASES, cleanups, createMockApiFull(), createTestPlugin(), mcpSentinel (+6 more)

### Community 50 - "cli.test.ts"
Cohesion: 0.09
Nodes (23): deriveMarketplaceClonePath(), expandFilesArray(), healPartialInstallFromMarketplace(), isPartialInstall(), listFilesRecursive(), logHealResult(), readJsonSafe(), resolveConfigDir() (+15 more)

### Community 51 - "provider/actions.ts"
Cohesion: 0.11
Nodes (29): getProviderConfigAction(), MaskedProviderConfigData, providerSettingsSchema, saveProviderSettingsAction(), testConnectionAction(), ADR-0003, MODEL_SUGGESTIONS, Props (+21 more)

### Community 52 - "check-render-output.mjs"
Cohesion: 0.08
Nodes (22): attrEntries(), checks, collectLegendCollisions(), collectNonFiniteAttrs(), collectRelationshipCrossings(), composition, crossProduct(), decodeNumericReferences() (+14 more)

### Community 53 - "search.test.ts"
Cohesion: 0.06
Nodes (16): createMixedStore(), createSeededStore(), createStore(), RELEVANCE_CORPUS, ScenarioResult, scenarioResults, unifiedCleanups, benchmark() (+8 more)

### Community 54 - "ensure-deps.mjs"
Cohesion: 0.14
Nodes (18): codesignBinary(), __dirname, ensureDeps(), ensureNativeCompat(), hasModernSqlite(), healBetterSqlite3Binding(), NATIVE_BINARIES, NATIVE_DEPS (+10 more)

### Community 55 - "git.mjs"
Cohesion: 0.20
Nodes (23): executeReviewRun(), parseStructuredOutput(), isProbablyText(), buildAdversarialCollectionGuidance(), buildBranchComparison(), collectBranchContext(), collectReviewContext(), collectWorkingTreeContext() (+15 more)

### Community 56 - "steps"
Cohesion: 0.09
Nodes (21): NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, jobs, verify, name, on, pull_request, push (+13 more)

### Community 57 - "job-control.mjs"
Cohesion: 0.11
Nodes (33): buildAdversarialReviewPrompt(), buildSetupReport(), getCodexAvailability(), getSessionRuntimeStatus(), buildStatusSnapshot(), DEFAULT_MAX_PROGRESS_LINES, DEFAULT_MAX_STATUS_JOBS, enrichJob() (+25 more)

### Community 59 - "runtime.test.mjs"
Cohesion: 0.16
Nodes (15): makeVersionFixture(), ROOT, SCRIPT, writeJson(), buildEnv(), installFakeCodex(), initGitRepo(), makeTempDir() (+7 more)

### Community 60 - "graders"
Cohesion: 0.07
Nodes (26): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+18 more)

### Community 61 - "runner.py"
Cohesion: 0.22
Nodes (15): check_approval(), cli_prefix(), command(), digest(), execute(), git(), main(), parse_result() (+7 more)

### Community 63 - "ref_lucide_react"
Cohesion: 0.09
Nodes (16): AssesseeDetailPage(), metadata, BatchDetailPage(), rescanBatchDriveAction(), DEFAULT_DOC_COLUMNS, metadata, metadata, DecisionToggle() (+8 more)

### Community 64 - "visual-check.mjs"
Cohesion: 0.16
Nodes (23): baseReceipt(), CAPTURE_VIEWPORTS, CHROME_NO_SANDBOX_ENV, cleanupCaptureSidecars(), contactSheetHtml(), executable(), EXIT, failureDiagnostic() (+15 more)

### Community 65 - "repro-before-fix/case.yaml"
Cohesion: 0.08
Nodes (23): context, scaffold_script, description, execution, allowed_tools, max_turns, prompt, timeout_seconds (+15 more)

### Community 66 - "graders"
Cohesion: 0.09
Nodes (22): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+14 more)

### Community 67 - "AppServerClientBase"
Cohesion: 0.16
Nodes (5): AppServerClientBase, BrokerCodexAppServerClient, buildJsonRpcError(), createProtocolError(), SpawnedCodexAppServerClient

### Community 68 - "graders"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 69 - "graders"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 70 - "adversarial-injected-instructions-in-logs/case.yaml"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 71 - "adversarial-secret-in-pasted-log/case.yaml"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 72 - "fires-on-plain-bug-report/case.yaml"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 73 - "graders"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 74 - "graders"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 75 - "platform-bridge.mjs"
Cohesion: 0.11
Nodes (24): ADR-0006, buildUrl(), computeProjectIdentity(), configPath(), HOME, _internal, maybeForward(), NO_CONFIG (+16 more)

### Community 76 - "hooks/formatters.test.ts"
Cohesion: 0.12
Nodes (12): codexSupportsUpdatedInput(), MIN_REWRITE_VERSION, parseCodexVersion(), versionGte(), formatDecision(), isHeadless(), ADR-0003, askDecision (+4 more)

### Community 77 - "security.bundle.mjs"
Cohesion: 0.16
Nodes (20): b(), E(), ee(), j(), K(), L(), M(), ne() (+12 more)

### Community 78 - "render.mjs"
Cohesion: 0.20
Nodes (17): appendActiveJobsTable(), appendReasoningSection(), escapeMarkdownCell(), formatCodexResumeCommand(), formatJobLine(), formatLineRange(), isStructuredReviewStoredResult(), normalizeReviewFinding() (+9 more)

### Community 79 - "perf-measure-not-guess/case.yaml"
Cohesion: 0.10
Nodes (20): context, scaffold_script, description, execution, allowed_tools, max_turns, prompt, timeout_seconds (+12 more)

### Community 80 - "integration.test.ts"
Cohesion: 0.11
Nodes (9): buildAutoInjection(), estimateTokens(), __dirname, _guidanceDir, HOOK_PATH, HookResult, mcpSentinel, _sessionGuidanceDir (+1 more)

### Community 81 - "graders"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 82 - "graders"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 83 - "graders"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 84 - "workflow-v2.mjs"
Cohesion: 0.24
Nodes (17): clone(), diagnostic(), expandableViewBox(), legacyLayoutProbe(), legacyRequirementProbe(), migrateWorkflowDocument(), requiredViewBoxFrom(), result() (+9 more)

### Community 85 - "graders"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 86 - "graders"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 87 - "graders"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 88 - "graders"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 89 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 90 - "adversarial-pressure-to-skip-process/case.yaml"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 91 - "alternatives-before-committing/case.yaml"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 92 - "multi-component-localise-first/case.yaml"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 93 - "no-repro-ask-do-not-guess/case.yaml"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 94 - "three-failed-fixes-question-the-design/case.yaml"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 95 - "template.sh"
Cohesion: 0.23
Nodes (17): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+9 more)

### Community 96 - "attributes"
Cohesion: 0.11
Nodes (18): description, label, options, placeholder, render, value, body, attributes (+10 more)

### Community 97 - "parseAttrs"
Cohesion: 0.18
Nodes (18): projectedNodeTextPx(), collectArrows(), collectCompositionFrames(), collectDesktopReadability(), collectLegendBoxes(), collectRelationshipLabelMasks(), estimatedTextWidth(), isCommand() (+10 more)

### Community 98 - "codex/stop.mjs"
Cohesion: 0.13
Nodes (10): HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, DEBUG_LOG, HOOK_DIR, { loadSessionDB, loadSnapshot }, HOOK_DIR, { loadSessionDB, loadProjectAttribution }, HOOK_DIR (+2 more)

### Community 99 - "benchmark.ts"
Cohesion: 0.29
Nodes (11): bench(), benchFuzzyCache(), BenchResult, benchTokenDedup(), cleanupSearchDB(), executor, main(), printTable() (+3 more)

### Community 100 - "session-snapshot.bundle.mjs"
Cohesion: 0.41
Nodes (17): a(), et(), G(), h(), it(), J(), K(), m() (+9 more)

### Community 101 - "sync_skill_readme.py"
Cohesion: 0.29
Nodes (11): cell(), git(), install(), inventory(), main(), pre_commit(), read(), render() (+3 more)

### Community 102 - "auto-clarity-destructive/case.yaml"
Cohesion: 0.12
Nodes (16): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+8 more)

### Community 103 - "redact.ts"
Cohesion: 0.23
Nodes (12): buildDitGapAnalysisPrompt(), DIT_PROMPT_META, DitPromptInput, NAME_JURY_PROMPT_META, buildWrittenGradingPrompt(), WRITTEN_GRADING_PROMPT_META, WrittenGradingPromptInput, assertNoPiiLeak() (+4 more)

### Community 104 - "package-large.json"
Cohesion: 0.10
Nodes (21): @playwright/test, prettier, prettier-plugin-tailwindcss, prisma, devDependencies, eslint@^9.16.0, eslint-config-next@^15.1.0, @playwright/test@^1.49.0 (+13 more)

### Community 105 - "ctx-debug.sh"
Cohesion: 0.21
Nodes (13): abbrev_path(), check(), CLAUDE_PLUGIN_ROOT, config_file(), detect_os(), kv(), NODE_PATH, redact() (+5 more)

### Community 106 - "codex/package.json"
Cohesion: 0.11
Nodes (19): description, devDependencies, @types/node@^25.5.0, typescript@^6.0.2, engines, node, @types/node, typescript (+11 more)

### Community 107 - "sync_eval_index.py"
Cohesion: 0.23
Nodes (10): entries(), front_matter(), ingest(), main(), model_of(), newest_run(), render(), sync() (+2 more)

### Community 108 - "attributes"
Cohesion: 0.12
Nodes (15): description, label, options, placeholder, value, body, attributes, id (+7 more)

### Community 109 - "session-attribution.bundle.mjs"
Cohesion: 0.25
Nodes (14): A(), b(), D(), e(), h(), K(), l(), m() (+6 more)

### Community 110 - "gen_debug_bakeoff.py"
Cohesion: 0.20
Nodes (4): validate(), block(), main(), render()

### Community 111 - "pi-extension.test.ts"
Cohesion: 0.18
Nodes (11): ../../src/adapters/pi/extension.js, ../../src/adapters/pi/mcp-bridge.js, createMockPi(), HandlerFn, registerWithBootstrapSpy(), createMockPi(), runExtension(), HandlerFn (+3 more)

### Community 112 - "source-example.ts"
Cohesion: 0.14
Nodes (11): @prisma/client, @prisma/client@^6.1.0, CreateUserInput, CreateUserSchema, ListUsersQuerySchema, PaginatedResponse, UpdateUserInput, UpdateUserSchema (+3 more)

### Community 114 - "app-server-protocol.d.ts"
Cohesion: 0.14
Nodes (9): AppServerMethod, AppServerMethodMap, AppServerNotification, AppServerNotificationHandler, AppServerRequestParams, AppServerResponse, CodexAppServerClientOptions, ThreadResumeParams (+1 more)

### Community 115 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, allowJs, checkJs, module, moduleResolution, noEmit, noImplicitAny, skipLibCheck (+5 more)

### Community 116 - "PipeCdp"
Cohesion: 0.26
Nodes (4): ChromeVisualBrowser, chromeVisualBrowserArgs(), evaluate(), PipeCdp

### Community 117 - "bump-version.mjs"
Cohesion: 0.31
Nodes (12): bumpVersion(), checkVersions(), findMarketplacePlugin(), main(), parseArgs(), readJson(), readPackageVersion(), requireObject() (+4 more)

### Community 118 - "archify/package.json"
Cohesion: 0.15
Nodes (12): bin, archify, description, engines, node, license, name, overrides (+4 more)

### Community 119 - "scenarios.mjs"
Cohesion: 0.24
Nodes (10): detectGuideLanguage(), formatScenarioList(), listScenarioRecipes(), localized(), normalized(), publicGuideData(), RAW_RECIPES, recommendScenario() (+2 more)

### Community 120 - "middleware.ts"
Cohesion: 0.24
Nodes (5): @supabase/ssr@^0.12.7, @supabase/ssr, updateSession(), config, proxy()

### Community 121 - ".openclaw-plugin/package.json"
Cohesion: 0.15
Nodes (12): author, name, url, description, homepage, keywords, license, name (+4 more)

### Community 122 - "postinstall-heal.test.ts"
Cohesion: 0.18
Nodes (11): buildFakeHome(), cleanups, __dirname, FakeHome, makeTmp(), REPO_HEAL_IP, REPO_HEAL_SQLITE3, REPO_POSTINSTALL (+3 more)

### Community 123 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, db:push, db:studio, dev, generate, lint, start (+4 more)

### Community 124 - "mcp-integration.ts"
Cohesion: 0.24
Nodes (11): assert(), collectResponses(), __dirname, fixtureDir, JsonRpcRequest, JsonRpcResponse, main(), send() (+3 more)

### Community 126 - "constructor"
Cohesion: 0.20
Nodes (11): B(), Ce(), constructor(), De(), F(), initSchema(), J(), k() (+3 more)

### Community 127 - "fs.mjs"
Cohesion: 0.27
Nodes (5): CLAUDE_PROJECTS_DIR, resolveClaudeSessionPath(), resolveUserPath(), TRANSCRIPT_PATH_ENV, ensureAbsolutePath()

### Community 129 - "pi-mcp-bridge.test.ts"
Cohesion: 0.18
Nodes (8): realEnv, AnyClient, extractTestTerminalEscape(), stripTestTerminalEscapes(), testCouldBeEmoji(), testWideCodePoint(), testZeroWidthCodePoint(), visibleWidth()

### Community 130 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, outDir, skipLibCheck, strict, target (+1 more)

### Community 131 - "extract-multilang.test.ts"
Cohesion: 0.31
Nodes (8): CategoryExpectation, findEvent(), hasBlocker(), hasBlockerResolved(), hasDecision(), hasRole(), intentMode(), LANGUAGE_MATRIX

### Community 133 - "hooks"
Cohesion: 0.25
Nodes (7): hooks, AfterModel, AfterTool, BeforeTool, PreCompress, SessionStart, $schema

### Community 134 - "plugins"
Cohesion: 0.25
Nodes (7): enabled, context-mode, plugins, entries, slots, $schema, contextEngine

### Community 135 - "heal-better-sqlite3.mjs"
Cohesion: 0.12
Nodes (13): buildSafeEnv(), CONDA_ENV_KEYS, CONDA_PATH_PATTERNS, detectWindowsVsYear(), healBetterSqlite3Binding(), isCondaActive(), isSafePythonPath(), resolveSafePython() (+5 more)

### Community 136 - "Ie"
Cohesion: 0.25
Nodes (8): H(), Ie(), nt(), te(), tt(), Ue(), we(), xe()

### Community 137 - "prove-narrative-render.ts"
Cohesion: 0.25
Nodes (7): conversation, lifetime, multiAdapter, realBytesConversation, realBytesLifetime, report, text

### Community 138 - "similarity/page.tsx"
Cohesion: 0.18
Nodes (14): CreateBatchPanel(), CreateBatchPanelProps, metadata, SimilarityReportPage(), BatchesPage(), metadata, listSchemes(), computeJaccardNgram() (+6 more)

### Community 140 - "config.repository.ts"
Cohesion: 0.27
Nodes (10): getDb(), appConfig, ConfigKey, ConfigMap, FormMapping06, GetConfigOptions, NameJuryThresholds, SchemeManifest (+2 more)

### Community 141 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 142 - "better-sqlite3"
Cohesion: 0.29
Nodes (6): dependencies, better-sqlite3@^11.0.0, description, main, name, version

### Community 144 - "desktop-readability.mjs"
Cohesion: 0.33
Nodes (5): DESKTOP_READABILITY_VIEWPORT, DESKTOP_READER_DIAGRAM_WIDTH, DESKTOP_READER_HORIZONTAL_CHROME, DESKTOP_READER_MIN_WIDTH, MIN_PROJECTED_NODE_TEXT_PX

### Community 145 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 146 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 147 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 148 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 149 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 150 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 151 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 152 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 153 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 154 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 155 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 156 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 157 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 158 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 159 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 160 - "Q"
Cohesion: 0.50
Nodes (5): Ke(), Ne(), Q(), ye(), z()

### Community 161 - "assert-asymmetric-drift.mjs"
Cohesion: 0.53
Nodes (5): main(), parseArgs(), readArgs0(), readJson(), REQUIRED_PLUGIN_RUNTIME_FILES

### Community 162 - "app/layout.tsx"
Cohesion: 0.33
Nodes (3): geistMono, geistSans, metadata

### Community 163 - "sendRpc"
Cohesion: 0.47
Nodes (6): awaitRpc(), collectRpcResponses(), initAndCallDoctor(), initialize(), initServer(), sendRpc()

### Community 164 - "gate-skill-evals.sh"
Cohesion: 0.70
Nodes (4): eval_in_flight(), is_ignored(), newest_mtime(), gate-skill-evals.sh script

### Community 165 - "context-mode"
Cohesion: 0.40
Nodes (4): CONTEXT_MODE_PLATFORM, context-mode, context-mode, CONTEXT_MODE_COPILOT_PLUGIN

### Community 166 - "Ee"
Cohesion: 0.40
Nodes (5): be(), Ee(), ge(), le(), V()

### Community 167 - "assert-stats.mjs"
Cohesion: 0.60
Nodes (4): assert(), loadPayload(), main(), REQUIRED_TOOLS

### Community 168 - "env.ts"
Cohesion: 0.40
Nodes (3): Env, env, envSchema

### Community 169 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 170 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 171 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 172 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 173 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 174 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 175 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 176 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 177 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 178 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 179 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 180 - "interface"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 181 - "context-mode"
Cohesion: 0.50
Nodes (3): CONTEXT_MODE_PLATFORM, context-mode, node

### Community 182 - "cleanup"
Cohesion: 0.50
Nodes (4): cleanup(), close(), me(), x()

### Community 210 - "ot"
Cohesion: 0.25
Nodes (9): ct(), et(), it(), ot(), rt(), st(), vt(), W() (+1 more)

### Community 213 - "ctx-upgrade-platform-threading.test.ts"
Cohesion: 0.12
Nodes (13): cliSrc, __dirname, ROOT, startSrc, upgradeBody, upgradeIdx, cliSrc, ctxUpgradeHandler (+5 more)

### Community 214 - "lt"
Cohesion: 0.33
Nodes (7): at(), B(), F(), lt(), M(), pt(), Y()

### Community 215 - "I"
Cohesion: 0.29
Nodes (7): E(), G(), I(), nt(), P(), U(), z()

### Community 222 - "zod3tov4-production.test.ts"
Cohesion: 0.33
Nodes (3): batchRequests, __dirname, fetchAndIndexSchema

### Community 224 - "bulkInsertEvents"
Cohesion: 0.60
Nodes (5): bulkInsertEvents(), _e(), _getSessionProjectDir(), insertEvent(), withRetry()

## Knowledge Gaps
- **36 isolated node(s):** `node`, `CONTEXT_MODE_PLATFORM`, `context-mode`, `CONTEXT_MODE_PLATFORM`, `CONTEXT_MODE_COPILOT_PLUGIN` (+31 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 2074 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `compileWorkflowInternal()` connect `compileWorkflowInternal` to `render-lifecycle.mjs`, `workflow-compiler.mjs`, `diagnostics.mjs`, `workflow-v2.mjs`, `render-architecture.mjs`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `node`, `CONTEXT_MODE_PLATFORM`, `context-mode` to the rest of the system?**
  _36 weakly-connected nodes found - possible missing edges._
- **Should `ref_node_fs` be split into smaller, more focused modules?**
  _Cohesion score 0.025243832472748137 - nodes in this community are weakly interconnected._
- **Why does `@prisma/client` connect `source-example.ts` to `dependencies`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Should `session-helpers.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05276907001044932 - nodes in this community are weakly interconnected._
- **Should `check-update.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.059883236030025024 - nodes in this community are weakly interconnected._
- **Should `compileWorkflowInternal` be split into smaller, more focused modules?**
  _Cohesion score 0.05358126721763085 - nodes in this community are weakly interconnected._