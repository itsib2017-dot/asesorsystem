# Graph Report - webapps_asesor  (2026-11-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4899 nodes · 10997 edges · 210 communities (177 shown, 33 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 95 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `14bc57d3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 191
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205

## God Nodes (most connected - your core abstractions)
1. `vitest` - 225 edges
2. `compileWorkflowInternal()` - 175 edges
3. `getSupabaseServerClient()` - 60 edges
4. `getUser()` - 60 edges
5. `asArray()` - 53 edges
6. `getSessionId()` - 48 edges
7. `parseStdin()` - 45 edges
8. `getInputProjectDir()` - 44 edges
9. `readStdin()` - 42 edges
10. `getSessionDBPath()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `lucide-react@^1.74.0` --declares--> `lucide-react`  [EXTRACTED]
  package.json → tests/fixtures/package-large.json
- `createSentinel()` --calls--> `sentinelDir()`  [EXTRACTED]
  tests/hooks/core-routing.test.ts → hooks/core/mcp-ready.mjs
- `hasUnrelatedLiveSentinel()` --calls--> `sentinelDir()`  [EXTRACTED]
  tests/hooks/core-routing.test.ts → hooks/core/mcp-ready.mjs
- `signOutAction()` --calls--> `getSupabaseServerClient()`  [EXTRACTED]
  src/app/(app)/layout.tsx → src/lib/supabase/server.ts
- `De()` --indirect_call--> `l()`  [INFERRED]
  hooks/session-db.bundle.mjs → hooks/session-attribution.bundle.mjs

## Import Cycles
- None detected.

## Communities (210 total, 33 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (70): rewriteShellSnapshots(), selfHealShellSnapshots(), assertBundleClean(), FORBIDDEN_PATTERNS, main(), walkFiles(), homedirMock, FIXTURE (+62 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (82): HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, HOOK_DIR, { loadSessionDB, loadSnapshot }, HOOK_DIR, { loadSessionDB }, HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution } (+74 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (104): acknowledgeUpdate(), acquireOperation(), assertBoundedRegularFile(), assertCacheTargetAbsent(), assertRenameableCacheEntry(), assertSafeCacheEntry(), assertSafeDirectory(), assertSafeRegularFile() (+96 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (107): throwDiagnosticError(), withDiagnosticRecordingSuppressed(), pointRectDistance(), pointSegmentDistance(), rectsOverlap(), segmentRectClearance(), relationshipLegendObstacles(), cloneWorkflow() (+99 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (97): assertEvidenceType(), CHECK_FIXES, checkerDiagnostics(), [command, ...args], commandBrands(), commandCheck(), commandCompare(), commandDeliver() (+89 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (12): vitest, batchRequests, fetchAndIndexSchema, makeNarrativeContext(), makeReport(), InsertEventParams, CFG, FIXTURE (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (21): AGY_PLUGIN, walk(), PLUGIN, REPO_ROOT, clearPluginRoots(), pluginRoots(), AdapterParityCase, adapters (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (75): renderBoundaryFrame(), renderBoundaryLabel(), renderComponent(), renderConnectionLabel(), renderConnectionPath(), renderSvg(), compositionFrames, __dirname (+67 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (72): addNodeMarker(), addState(), annotateArchitectureSideSvg(), architectureDeltaChangeRows(), ArchitectureDeltaError, BOUNDARY_FIELDS, boundaryChangeMap(), boundaryElements() (+64 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (72): validateArchitecture(), validateDataflow(), validateLifecycle(), validateSequence(), brandTopRailProblem(), recordDiagnostic(), asArray(), authoredAnalysisSegments() (+64 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (61): drizzle-orm, confirmCertificateNameAction(), saveUnitDecisionAction(), uploadSignatureAction(), metadata, ProfileSettingsPage(), SignatureUpload(), DrizzleDb (+53 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (57): captureCodexInstructionRules(), HOOK_DIR, { loadSessionDB }, ROUTING_BLOCK, toolNamer, HOOK_DIR, { loadSessionDB }, ROUTING_BLOCK (+49 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (67): buildNativeReviewTarget(), buildReviewJobMetadata(), buildSetupReport(), buildTaskJob(), buildTaskRequest(), buildTaskRunMetadata(), createCompanionJob(), ensureCodexAvailable() (+59 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (51): fromAgy(), getAgyProjectDir(), normalizeAgyToolInput(), normalizeAgyToolName(), parseAgyPayload(), HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, __hookDir (+43 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (50): generateStructured(), resolveModel(), RuntimeLlmConfig, buildDitGapAnalysisPrompt(), DIT_PROMPT_META, DitPromptInput, buildNameJuryPrompt(), NAME_JURY_PROMPT_META (+42 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (42): buildHookCommand(), ensureShebangAndExecBit(), extractNodePath(), fwd(), isStaleNodePath(), selfHealCacheHealHook(), fwd(), hasStaleCacheVersionSegment() (+34 more)

### Community 16 - "Community 16"
Cohesion: 0.04
Nodes (59): eslintConfig, dependencies, ai@^7.0.176, @ai-sdk/anthropic@^4.0.106, @ai-sdk/google@^4.0.122, @ai-sdk/openai@^4.0.121, docx@^9.15.4, drizzle-orm@^0.45.4 (+51 more)

### Community 17 - "Community 17"
Cohesion: 0.03
Nodes (31): __dirname, outputRoot, skillRoot, TARGETS, TARGETS, cleanups, createTempRoot(), ensureDepsAbsPath (+23 more)

### Community 18 - "Community 18"
Cohesion: 0.05
Nodes (42): bench(), benchFuzzyCache(), BenchResult, benchTokenDedup(), cleanupSearchDB(), executor, main(), printTable() (+34 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (47): defaultGuidanceId(), getBashNudgeMinCommandBytes(), getCodexConfigDir(), getExternalMcpNudgeEvery(), getPlatformSettingsPath(), getReadFilePath(), getShellCommand(), getWebFetchUrl() (+39 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (48): A(), at(), B(), ct(), dt(), E(), et(), F() (+40 more)

### Community 21 - "Community 21"
Cohesion: 0.09
Nodes (55): CodexAppServerClient, applyTurnNotification(), belongsToTurn(), buildAppServerAuthStatus(), buildAuthStatus(), buildPersistentTaskThreadName(), buildResultStatus(), buildResumeParams() (+47 more)

### Community 22 - "Community 22"
Cohesion: 0.04
Nodes (17): PLUGIN_ROOT, ROOT, RFC-8259, CODEX_MARKETPLACE_PATHS, RawMarketplaceManifest, RawPluginEntry, RawPluginSourceObject, REPO_ROOT (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.06
Nodes (50): DEFAULT_GRID, gridLayout(), resolveComponentPos(), validateGridPlacement(), alignFacingPorts(), architectureLegendEntries, automaticPorts, autoViewBoxFor() (+42 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (39): buildJsonRpcError(), buildStreamThreadIds(), isInterruptRequest(), main(), routeNotification(), send(), STREAMING_METHODS, writePidFile() (+31 more)

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (35): zod, GET(), createBatchSchema, GET(), POST(), analyseSchema, POST(), enqueueSchema (+27 more)

### Community 26 - "Community 26"
Cohesion: 0.04
Nodes (25): RFC-6874, Captured, CaseAString, __dirname, DoctorJsonRpcResponse, FakeReturn, ForbiddenRule, gfmPath (+17 more)

### Community 27 - "Community 27"
Cohesion: 0.07
Nodes (29): nextConfig, next, metadata, GET(), loginAction(), loginSchema, LoginState, LoginForm() (+21 more)

### Community 28 - "Community 28"
Cohesion: 0.04
Nodes (46): additionalProperties, minLength, type, maximum, minimum, type, minLength, type (+38 more)

### Community 29 - "Community 29"
Cohesion: 0.05
Nodes (46): if, name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group (+38 more)

### Community 30 - "Community 30"
Cohesion: 0.04
Nodes (21): __dirname, HookResult, HOOKS_DIR, ROOT, __dirname, mcpSentinel, POSTTOOL_PATH, PRETOOL_PATH (+13 more)

### Community 31 - "Community 31"
Cohesion: 0.05
Nodes (45): alwaysThinkingEnabled, autoUpdatesChannel, source, enabledPlugins, claudex-loop@claudex-loop, codex@openai-codex, context7@claude-plugins-official, context-mode@context-mode (+37 more)

### Community 32 - "Community 32"
Cohesion: 0.06
Nodes (43): @auth/prisma-adapter, class-variance-authority, clsx, date-fns, next-auth, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-toast (+35 more)

### Community 33 - "Community 33"
Cohesion: 0.04
Nodes (16): TestAdapter, __dirname, RawEventRow, SESSIONSTART_PATH, CapturedPost, platformConfigFile(), SEED_INSERT_COLUMNS, VARIANT_COLUMNS (+8 more)

### Community 34 - "Community 34"
Cohesion: 0.06
Nodes (44): architecture, dataflow, func3(), lifecycle, pattern17, pattern18, pattern20, pattern4 (+36 more)

### Community 35 - "Community 35"
Cohesion: 0.09
Nodes (34): GET(), Ak05Page(), metadata, BatchDetailPage(), DEFAULT_DOC_COLUMNS, metadata, metadata, SimilarityReportPage() (+26 more)

### Community 36 - "Community 36"
Cohesion: 0.05
Nodes (20): CODEX_PRECOMPACT_PATH, CODEX_SESSIONSTART_PATH, CODEX_USER_PROMPT_PATH, __dirname, CODEX_SESSIONSTART_PATH, __dirname, __dirname, PRECOMPACT_PATH (+12 more)

### Community 37 - "Community 37"
Cohesion: 0.05
Nodes (18): better-sqlite3, REPO, __dirname, HOOK_PATH, REPO, __dirname, HookResult, HOOKS_DIR (+10 more)

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (30): @supabase/supabase-js, AppShellLayout(), signOutAction(), saveSchemeManifestAction(), schemeSchema, SchemeRegistrationForm(), metadata, SchemesPage() (+22 more)

### Community 39 - "Community 39"
Cohesion: 0.05
Nodes (38): concurrency, cancel-in-progress, group, name, runs-on, steps, strategy, timeout-minutes (+30 more)

### Community 40 - "Community 40"
Cohesion: 0.09
Nodes (25): bulkInsertEvents(), claimLatestUnconsumedResume(), cleanupOldSessions(), deleteSession(), _e(), ensureSession(), getEventBytesSummary(), getEventCount() (+17 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (35): createTrackedProgress(), enqueueBackgroundTask(), handleCancel(), spawnDetachedTaskWorker(), readStoredJob(), defaultState(), ensureStateDir(), FALLBACK_STATE_ROOT_DIR (+27 more)

### Community 42 - "Community 42"
Cohesion: 0.06
Nodes (13): HandlerFn, registerOmpPlugin(), createPluginWithRejectingLog(), createTestPlugin(), mcpSentinel, HandlerFn, MockCommandOpts, MockPiAdapter (+5 more)

### Community 43 - "Community 43"
Cohesion: 0.10
Nodes (36): connectionEndpointSide(), connectionSides(), automaticPorts, flowSides(), automaticPorts, bandFor(), bandTitles(), __dirname (+28 more)

### Community 44 - "Community 44"
Cohesion: 0.10
Nodes (32): loadDiagram(), loadDiagramWithBrandMarks(), outputPathGuards, RELATIONSHIP_COLLECTIONS, SEMANTIC_COLLECTIONS, START_TYPES, validateGuidedViews(), validateRelationshipIds() (+24 more)

### Community 45 - "Community 45"
Cohesion: 0.10
Nodes (33): renderLegend(), arrowClass, compositionFrames, __dirname, layout, LEGEND_CATALOG, messageGeometry(), messageLabel() (+25 more)

### Community 46 - "Community 46"
Cohesion: 0.11
Nodes (30): asUrl(), attribute(), beforeDeadline(), captureBrandReference(), captureRemoteBrand(), captureTimeoutMilliseconds(), checkedFetch(), COLLECTIONS (+22 more)

### Community 47 - "Community 47"
Cohesion: 0.08
Nodes (23): cleanups, _hashCanonical(), isolatedHomeEnv(), runStatusline(), seedRealAdapter(), STATUSLINE, isolatedHomeEnv(), runStatusline() (+15 more)

### Community 48 - "Community 48"
Cohesion: 0.07
Nodes (14): ALL_PLATFORM_ENV_VARS, existsSyncMock, ALL_PLATFORM_ENV_VARS, existsSyncMock, awaitRpc(), __dirname, initServer(), mcpEntry (+6 more)

### Community 49 - "Community 49"
Cohesion: 0.06
Nodes (14): registerContextModeInOpenclawConfig(), mcpSentinel, POSTTOOL_CASES, PRETOOL_CASES, cleanups, createMockApiFull(), createTestPlugin(), mcpSentinel (+6 more)

### Community 50 - "Community 50"
Cohesion: 0.09
Nodes (21): deriveMarketplaceClonePath(), expandFilesArray(), healPartialInstallFromMarketplace(), isPartialInstall(), listFilesRecursive(), logHealResult(), readJsonSafe(), resolveConfigDir() (+13 more)

### Community 51 - "Community 51"
Cohesion: 0.12
Nodes (24): ADR-0003, getProviderConfigAction(), MaskedProviderConfigData, providerSettingsSchema, saveProviderSettingsAction(), testConnectionAction(), MODEL_SUGGESTIONS, Props (+16 more)

### Community 52 - "Community 52"
Cohesion: 0.08
Nodes (22): attrEntries(), checks, collectLegendCollisions(), collectNonFiniteAttrs(), collectRelationshipCrossings(), composition, crossProduct(), decodeNumericReferences() (+14 more)

### Community 53 - "Community 53"
Cohesion: 0.07
Nodes (9): createMixedStore(), createSeededStore(), createStore(), RELEVANCE_CORPUS, ScenarioResult, scenarioResults, unifiedCleanups, tempFiles (+1 more)

### Community 54 - "Community 54"
Cohesion: 0.09
Nodes (22): HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, DEBUG_LOG, HOOK_DIR, { loadSessionDB, loadSnapshot }, HOOK_DIR, { loadSessionDB, loadProjectAttribution }, HOOK_DIR (+14 more)

### Community 55 - "Community 55"
Cohesion: 0.17
Nodes (27): isProbablyText(), buildAdversarialCollectionGuidance(), buildBranchComparison(), collectBranchContext(), collectReviewContext(), collectWorkingTreeContext(), detectDefaultBranch(), ensureGitRepository() (+19 more)

### Community 56 - "Community 56"
Cohesion: 0.07
Nodes (29): jobs, test, os, name, on, pull_request, push, workflow_dispatch (+21 more)

### Community 57 - "Community 57"
Cohesion: 0.13
Nodes (26): buildAdversarialReviewPrompt(), DEFAULT_MAX_PROGRESS_LINES, DEFAULT_MAX_STATUS_JOBS, enrichJob(), formatElapsedDuration(), getJobTypeLabel(), inferLegacyJobPhase(), isProgressBlockTitle() (+18 more)

### Community 59 - "Community 59"
Cohesion: 0.13
Nodes (15): makeVersionFixture(), ROOT, SCRIPT, writeJson(), buildEnv(), installFakeCodex(), initGitRepo(), makeTempDir() (+7 more)

### Community 60 - "Community 60"
Cohesion: 0.07
Nodes (26): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+18 more)

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (15): check_approval(), cli_prefix(), command(), digest(), execute(), git(), main(), parse_result() (+7 more)

### Community 62 - "Community 62"
Cohesion: 0.08
Nodes (5): __dirname, HookResult, HOOKS_DIR, ROOT, importWithPlatform()

### Community 63 - "Community 63"
Cohesion: 0.13
Nodes (16): lucide-react, react, AssesseeDetailPage(), metadata, DashboardPage(), metadata, DecisionToggle(), DecisionToggleProps (+8 more)

### Community 64 - "Community 64"
Cohesion: 0.16
Nodes (23): baseReceipt(), CAPTURE_VIEWPORTS, CHROME_NO_SANDBOX_ENV, cleanupCaptureSidecars(), contactSheetHtml(), executable(), EXIT, failureDiagnostic() (+15 more)

### Community 65 - "Community 65"
Cohesion: 0.08
Nodes (23): context, scaffold_script, description, execution, allowed_tools, max_turns, prompt, timeout_seconds (+15 more)

### Community 66 - "Community 66"
Cohesion: 0.09
Nodes (22): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+14 more)

### Community 67 - "Community 67"
Cohesion: 0.16
Nodes (5): AppServerClientBase, BrokerCodexAppServerClient, buildJsonRpcError(), createProtocolError(), SpawnedCodexAppServerClient

### Community 68 - "Community 68"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 69 - "Community 69"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 70 - "Community 70"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 71 - "Community 71"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 72 - "Community 72"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 73 - "Community 73"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 74 - "Community 74"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 75 - "Community 75"
Cohesion: 0.15
Nodes (21): ADR-0006, buildUrl(), computeProjectIdentity(), configPath(), hasPlatformConfig(), HOME, _internal, maybeForward() (+13 more)

### Community 76 - "Community 76"
Cohesion: 0.12
Nodes (12): codexSupportsUpdatedInput(), MIN_REWRITE_VERSION, parseCodexVersion(), versionGte(), formatDecision(), isHeadless(), ADR-0003, askDecision (+4 more)

### Community 77 - "Community 77"
Cohesion: 0.16
Nodes (19): b(), E(), ee(), K(), L(), M(), ne(), q() (+11 more)

### Community 78 - "Community 78"
Cohesion: 0.17
Nodes (19): executeReviewRun(), parseStructuredOutput(), appendActiveJobsTable(), appendReasoningSection(), escapeMarkdownCell(), formatCodexResumeCommand(), formatJobLine(), formatLineRange() (+11 more)

### Community 79 - "Community 79"
Cohesion: 0.10
Nodes (20): context, scaffold_script, description, execution, allowed_tools, max_turns, prompt, timeout_seconds (+12 more)

### Community 80 - "Community 80"
Cohesion: 0.11
Nodes (9): buildAutoInjection(), estimateTokens(), __dirname, _guidanceDir, HOOK_PATH, HookResult, mcpSentinel, _sessionGuidanceDir (+1 more)

### Community 81 - "Community 81"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 82 - "Community 82"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 83 - "Community 83"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 84 - "Community 84"
Cohesion: 0.24
Nodes (17): clone(), diagnostic(), expandableViewBox(), legacyLayoutProbe(), legacyRequirementProbe(), migrateWorkflowDocument(), requiredViewBoxFrom(), result() (+9 more)

### Community 85 - "Community 85"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 86 - "Community 86"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 87 - "Community 87"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 88 - "Community 88"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 89 - "Community 89"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 90 - "Community 90"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 91 - "Community 91"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 92 - "Community 92"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 93 - "Community 93"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 94 - "Community 94"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 95 - "Community 95"
Cohesion: 0.23
Nodes (17): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+9 more)

### Community 96 - "Community 96"
Cohesion: 0.11
Nodes (18): description, label, options, placeholder, render, value, body, attributes (+10 more)

### Community 97 - "Community 97"
Cohesion: 0.18
Nodes (18): projectedNodeTextPx(), collectArrows(), collectCompositionFrames(), collectDesktopReadability(), collectLegendBoxes(), collectRelationshipLabelMasks(), estimatedTextWidth(), isCommand() (+10 more)

### Community 98 - "Community 98"
Cohesion: 0.11
Nodes (17): runs-on, steps, jobs, bundle, name, on, push, workflow_dispatch (+9 more)

### Community 99 - "Community 99"
Cohesion: 0.16
Nodes (15): isMCPReady(), sentinelDir(), sentinelPath(), sentinelPathForPid(), createSentinel(), fixtures, hasUnrelatedLiveSentinel(), mcpSentinel (+7 more)

### Community 100 - "Community 100"
Cohesion: 0.41
Nodes (17): a(), et(), G(), h(), it(), J(), K(), m() (+9 more)

### Community 101 - "Community 101"
Cohesion: 0.29
Nodes (11): cell(), git(), install(), inventory(), main(), pre_commit(), read(), render() (+3 more)

### Community 102 - "Community 102"
Cohesion: 0.12
Nodes (16): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+8 more)

### Community 103 - "Community 103"
Cohesion: 0.12
Nodes (16): GH_TOKEN, jobs, update-stats, name, on, schedule, workflow_dispatch, permissions (+8 more)

### Community 104 - "Community 104"
Cohesion: 0.12
Nodes (14): @playwright/test, prettier, prettier-plugin-tailwindcss, prisma, devDependencies, eslint@^9.16.0, eslint-config-next@^15.1.0, @playwright/test@^1.49.0 (+6 more)

### Community 105 - "Community 105"
Cohesion: 0.21
Nodes (13): abbrev_path(), check(), CLAUDE_PLUGIN_ROOT, config_file(), detect_os(), kv(), NODE_PATH, redact() (+5 more)

### Community 106 - "Community 106"
Cohesion: 0.14
Nodes (13): description, devDependencies, @types/node@^25.5.0, typescript@^6.0.2, engines, node, license, name (+5 more)

### Community 107 - "Community 107"
Cohesion: 0.23
Nodes (10): entries(), front_matter(), ingest(), main(), model_of(), newest_run(), render(), sync() (+2 more)

### Community 108 - "Community 108"
Cohesion: 0.12
Nodes (15): description, label, options, placeholder, value, body, attributes, id (+7 more)

### Community 109 - "Community 109"
Cohesion: 0.25
Nodes (14): A(), b(), D(), e(), h(), K(), l(), m() (+6 more)

### Community 110 - "Community 110"
Cohesion: 0.20
Nodes (4): validate(), block(), main(), render()

### Community 111 - "Community 111"
Cohesion: 0.18
Nodes (8): realEnv, AnyClient, extractTestTerminalEscape(), stripTestTerminalEscapes(), testCouldBeEmoji(), testWideCodePoint(), testZeroWidthCodePoint(), visibleWidth()

### Community 112 - "Community 112"
Cohesion: 0.14
Nodes (11): @prisma/client, @prisma/client@^6.1.0, CreateUserInput, CreateUserSchema, ListUsersQuerySchema, PaginatedResponse, UpdateUserInput, UpdateUserSchema (+3 more)

### Community 114 - "Community 114"
Cohesion: 0.14
Nodes (9): AppServerMethod, AppServerMethodMap, AppServerNotification, AppServerNotificationHandler, AppServerRequestParams, AppServerResponse, CodexAppServerClientOptions, ThreadResumeParams (+1 more)

### Community 115 - "Community 115"
Cohesion: 0.14
Nodes (13): compilerOptions, allowJs, checkJs, module, moduleResolution, noEmit, noImplicitAny, skipLibCheck (+5 more)

### Community 116 - "Community 116"
Cohesion: 0.26
Nodes (4): ChromeVisualBrowser, chromeVisualBrowserArgs(), evaluate(), PipeCdp

### Community 117 - "Community 117"
Cohesion: 0.31
Nodes (12): bumpVersion(), checkVersions(), findMarketplacePlugin(), main(), parseArgs(), readJson(), readPackageVersion(), requireObject() (+4 more)

### Community 118 - "Community 118"
Cohesion: 0.15
Nodes (12): bin, archify, description, engines, node, license, name, overrides (+4 more)

### Community 119 - "Community 119"
Cohesion: 0.24
Nodes (10): detectGuideLanguage(), formatScenarioList(), listScenarioRecipes(), localized(), normalized(), publicGuideData(), RAW_RECIPES, recommendScenario() (+2 more)

### Community 120 - "Community 120"
Cohesion: 0.26
Nodes (5): RFC-4122, copyDirSync(), logError(), resolveClaudeConfigDir(), runHook()

### Community 121 - "Community 121"
Cohesion: 0.15
Nodes (12): author, name, url, description, homepage, keywords, license, name (+4 more)

### Community 122 - "Community 122"
Cohesion: 0.18
Nodes (11): buildFakeHome(), cleanups, __dirname, FakeHome, makeTmp(), REPO_HEAL_IP, REPO_HEAL_SQLITE3, REPO_POSTINSTALL (+3 more)

### Community 123 - "Community 123"
Cohesion: 0.17
Nodes (12): scripts, build, db:push, db:studio, dev, generate, lint, start (+4 more)

### Community 124 - "Community 124"
Cohesion: 0.24
Nodes (11): assert(), collectResponses(), __dirname, fixtureDir, JsonRpcRequest, JsonRpcResponse, main(), send() (+3 more)

### Community 126 - "Community 126"
Cohesion: 0.20
Nodes (11): B(), Ce(), constructor(), De(), F(), initSchema(), J(), k() (+3 more)

### Community 127 - "Community 127"
Cohesion: 0.27
Nodes (5): CLAUDE_PROJECTS_DIR, resolveClaudeSessionPath(), resolveUserPath(), TRANSCRIPT_PATH_ENV, ensureAbsolutePath()

### Community 130 - "Community 130"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, outDir, skipLibCheck, strict, target (+1 more)

### Community 131 - "Community 131"
Cohesion: 0.31
Nodes (8): CategoryExpectation, findEvent(), hasBlocker(), hasBlockerResolved(), hasDecision(), hasRole(), intentMode(), LANGUAGE_MATRIX

### Community 133 - "Community 133"
Cohesion: 0.25
Nodes (7): hooks, AfterModel, AfterTool, BeforeTool, PreCompress, SessionStart, $schema

### Community 134 - "Community 134"
Cohesion: 0.25
Nodes (7): enabled, context-mode, plugins, entries, slots, $schema, contextEngine

### Community 135 - "Community 135"
Cohesion: 0.32
Nodes (6): HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, QWEN_OPTS, qwenProjectHash(), resolveQwenChatJsonlPath(), resolveQwenHome()

### Community 136 - "Community 136"
Cohesion: 0.25
Nodes (8): H(), Ie(), nt(), te(), tt(), Ue(), we(), xe()

### Community 137 - "Community 137"
Cohesion: 0.25
Nodes (7): conversation, lifetime, multiAdapter, realBytesConversation, realBytesLifetime, report, text

### Community 138 - "Community 138"
Cohesion: 0.46
Nodes (6): computeJaccardNgram(), computeTfIdfCosine(), evaluateSimilarityPair(), makeNgrams(), SimilarityMetrics, tokenizeWords()

### Community 140 - "Community 140"
Cohesion: 0.29
Nodes (4): importFresh(), MockDb, platformConfigFile(), writePlatformConfig()

### Community 141 - "Community 141"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 142 - "Community 142"
Cohesion: 0.29
Nodes (6): dependencies, better-sqlite3@^11.0.0, description, main, name, version

### Community 143 - "Community 143"
Cohesion: 0.33
Nodes (6): scripts, build, bump-version, check-version, prebuild, test

### Community 144 - "Community 144"
Cohesion: 0.33
Nodes (5): DESKTOP_READABILITY_VIEWPORT, DESKTOP_READER_DIAGRAM_WIDTH, DESKTOP_READER_HORIZONTAL_CHROME, DESKTOP_READER_MIN_WIDTH, MIN_PROJECTED_NODE_TEXT_PX

### Community 145 - "Community 145"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 146 - "Community 146"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 147 - "Community 147"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 148 - "Community 148"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 149 - "Community 149"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 150 - "Community 150"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 151 - "Community 151"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 152 - "Community 152"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 153 - "Community 153"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 154 - "Community 154"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 155 - "Community 155"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 156 - "Community 156"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 157 - "Community 157"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 158 - "Community 158"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 159 - "Community 159"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 160 - "Community 160"
Cohesion: 0.40
Nodes (6): j(), Ke(), Ne(), Q(), ye(), z()

### Community 161 - "Community 161"
Cohesion: 0.53
Nodes (5): main(), parseArgs(), readArgs0(), readJson(), REQUIRED_PLUGIN_RUNTIME_FILES

### Community 162 - "Community 162"
Cohesion: 0.33
Nodes (3): geistMono, geistSans, metadata

### Community 163 - "Community 163"
Cohesion: 0.47
Nodes (6): awaitRpc(), collectRpcResponses(), initAndCallDoctor(), initialize(), initServer(), sendRpc()

### Community 164 - "Community 164"
Cohesion: 0.70
Nodes (4): eval_in_flight(), is_ignored(), newest_mtime(), gate-skill-evals.sh script

### Community 165 - "Community 165"
Cohesion: 0.40
Nodes (4): CONTEXT_MODE_PLATFORM, context-mode, context-mode, CONTEXT_MODE_COPILOT_PLUGIN

### Community 166 - "Community 166"
Cohesion: 0.40
Nodes (5): be(), Ee(), ge(), le(), V()

### Community 167 - "Community 167"
Cohesion: 0.60
Nodes (4): assert(), loadPayload(), main(), REQUIRED_TOOLS

### Community 168 - "Community 168"
Cohesion: 0.40
Nodes (3): Env, env, envSchema

### Community 169 - "Community 169"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 170 - "Community 170"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 171 - "Community 171"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 172 - "Community 172"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 173 - "Community 173"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 174 - "Community 174"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 175 - "Community 175"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 176 - "Community 176"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 177 - "Community 177"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 178 - "Community 178"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 179 - "Community 179"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 180 - "Community 180"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 181 - "Community 181"
Cohesion: 0.50
Nodes (3): CONTEXT_MODE_PLATFORM, context-mode, node

### Community 182 - "Community 182"
Cohesion: 0.50
Nodes (4): cleanup(), close(), me(), x()

### Community 191 - "Community 191"
Cohesion: 0.67
Nodes (3): @tanstack/react-query@^5.108.0, @tanstack/react-query, @tanstack/react-query@^5.62.0

## Knowledge Gaps
- **31 isolated node(s):** `ADR-0001`, `ADR-0004`, `CLAUDE_PLUGIN_ROOT`, `NODE_PATH`, `RFC-4122` (+26 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 2132 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Community 5` to `Community 0`, `Community 129`, `Community 131`, `Community 6`, `Community 138`, `Community 11`, `Community 140`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 22`, `Community 26`, `Community 27`, `Community 30`, `Community 33`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 42`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 53`, `Community 62`, `Community 76`, `Community 80`, `Community 99`, `Community 111`, `Community 122`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **What connects `ADR-0001`, `ADR-0004`, `CLAUDE_PLUGIN_ROOT` to the rest of the system?**
  _31 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02058746393915552 - nodes in this community are weakly interconnected._
- **Why does `ne()` connect `Community 77` to `Community 20`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0416084458934948 - nodes in this community are weakly interconnected._
- **Why does `oe()` connect `Community 20` to `Community 77`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.059883236030025024 - nodes in this community are weakly interconnected._