# Graph Report - webapps_asesor  (2026-11-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4861 nodes · 10887 edges · 241 communities (188 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6fd03271`
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
- Community 190
- Community 191
- Community 192
- Community 193
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
- Community 206
- Community 207
- Community 208
- Community 209
- Community 211
- Community 213
- Community 214
- Community 215
- Community 219
- Community 220
- Community 221
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 230
- Community 231
- Community 232

## God Nodes (most connected - your core abstractions)
1. `vitest` - 224 edges
2. `compileWorkflowInternal()` - 175 edges
3. `getUser()` - 56 edges
4. `getSupabaseServerClient()` - 54 edges
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
- `De()` --indirect_call--> `l()`  [INFERRED]
  hooks/session-db.bundle.mjs → hooks/session-attribution.bundle.mjs
- `k()` --indirect_call--> `l()`  [INFERRED]
  hooks/session-db.bundle.mjs → hooks/session-attribution.bundle.mjs

## Import Cycles
- None detected.

## Communities (241 total, 53 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (168): fromAgy(), getAgyProjectDir(), normalizeAgyToolInput(), normalizeAgyToolName(), parseAgyPayload(), HOOK_DIR, { loadSessionDB, loadExtract, loadProjectAttribution }, __hookDir (+160 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (54): vitest, walkFiles(), AGY_PLUGIN, walk(), adapterWithCodexPluginRoot(), pluginListOutput(), PLUGIN, REPO_ROOT (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (49): PLUGIN_ROOT, ROOT, RFC-8259, assertBundleClean(), FORBIDDEN_PATTERNS, main(), TARGETS, FIXTURE (+41 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (113): withDiagnosticRecordingSuppressed(), anchor(), pointInBox(), pointRectDistance(), pointSegmentDistance(), rectsOverlap(), segmentIntersectsRect(), segmentRectClearance() (+105 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (104): acknowledgeUpdate(), acquireOperation(), assertBoundedRegularFile(), assertCacheTargetAbsent(), assertRenameableCacheEntry(), assertSafeCacheEntry(), assertSafeDirectory(), assertSafeRegularFile() (+96 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (84): componentContext(), renderComponent(), renderNode(), bandFor(), bandTitles(), __dirname, laneLabels, layout (+76 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (37): __dirname, outputRoot, skillRoot, TARGETS, isMCPReady(), sentinelDir(), sentinelPath(), sentinelPathForPid() (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (72): addNodeMarker(), addState(), annotateArchitectureSideSvg(), architectureDeltaChangeRows(), ArchitectureDeltaError, BOUNDARY_FIELDS, boundaryChangeMap(), boundaryElements() (+64 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (61): drizzle-orm, confirmCertificateNameAction(), saveUnitDecisionAction(), uploadSignatureAction(), metadata, ProfileSettingsPage(), SignatureItem, SignatureUpload() (+53 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (65): eslintConfig, dependencies, ai@^7.0.176, @ai-sdk/anthropic@^4.0.106, @ai-sdk/google@^4.0.122, @ai-sdk/openai@^4.0.121, docx@^9.15.4, drizzle-orm@^0.45.4 (+57 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (67): buildNativeReviewTarget(), buildReviewJobMetadata(), buildSetupReport(), buildTaskJob(), buildTaskRequest(), buildTaskRunMetadata(), createCompanionJob(), ensureCodexAvailable() (+59 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (53): RFC-4122, detectPlatformFromEnv(), PLATFORM_ENV_VARS_MIRROR, defaultGuidanceId(), getBashNudgeMinCommandBytes(), getCodexConfigDir(), getExternalMcpNudgeEvery(), getPlatformSettingsPath() (+45 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (50): generateStructured(), resolveModel(), RuntimeLlmConfig, buildDitGapAnalysisPrompt(), DIT_PROMPT_META, DitPromptInput, buildNameJuryPrompt(), NAME_JURY_PROMPT_META (+42 more)

### Community 13 - "Community 13"
Cohesion: 0.03
Nodes (28): __dirname, HOOK_PATH, __dirname, HookResult, HOOKS_DIR, ROOT, __dirname, HookResult (+20 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (56): DEFAULT_GRID, gridLayout(), resolveComponentPos(), validateGridPlacement(), alignFacingPorts(), architectureLegendEntries, automaticPorts, autoViewBoxFor() (+48 more)

### Community 15 - "Community 15"
Cohesion: 0.03
Nodes (26): CODEX_PRECOMPACT_PATH, CODEX_SESSIONSTART_PATH, CODEX_USER_PROMPT_PATH, __dirname, CODEX_SESSIONSTART_PATH, __dirname, __dirname, PRECOMPACT_PATH (+18 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (55): CodexAppServerClient, applyTurnNotification(), belongsToTurn(), buildAppServerAuthStatus(), buildAuthStatus(), buildPersistentTaskThreadName(), buildResultStatus(), buildResumeParams() (+47 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (55): validateArchitecture(), validateDataflow(), validateLifecycle(), validateSequence(), brandTopRailProblem(), recordDiagnostic(), asArray(), authoredAnalysisSegments() (+47 more)

### Community 18 - "Community 18"
Cohesion: 0.04
Nodes (31): RFC-6874, awaitRpc(), Captured, CaseAString, collectRpcResponses(), __dirname, DoctorJsonRpcResponse, FakeReturn (+23 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (50): assertEvidenceType(), CHECK_FIXES, checkerDiagnostics(), [command, ...args], commandBrands(), commandCheck(), commandCompare(), commandDeliver() (+42 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (39): buildJsonRpcError(), buildStreamThreadIds(), isInterruptRequest(), main(), routeNotification(), send(), STREAMING_METHODS, writePidFile() (+31 more)

### Community 21 - "Community 21"
Cohesion: 0.06
Nodes (27): nextConfig, lucide-react, next, react, CreateBatchPanel(), CreateBatchPanelProps, AssesseeDetailPage(), metadata (+19 more)

### Community 22 - "Community 22"
Cohesion: 0.04
Nodes (46): additionalProperties, minLength, type, maximum, minimum, type, minLength, type (+38 more)

### Community 23 - "Community 23"
Cohesion: 0.05
Nodes (46): if, name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group (+38 more)

### Community 24 - "Community 24"
Cohesion: 0.06
Nodes (33): decision, __hookDir, input, projectDir, response, codexRedirectReason(), formatDecision(), formatters (+25 more)

### Community 25 - "Community 25"
Cohesion: 0.05
Nodes (45): alwaysThinkingEnabled, autoUpdatesChannel, source, enabledPlugins, claudex-loop@claudex-loop, codex@openai-codex, context7@claude-plugins-official, context-mode@context-mode (+37 more)

### Community 26 - "Community 26"
Cohesion: 0.06
Nodes (43): @auth/prisma-adapter, class-variance-authority, clsx, date-fns, next-auth, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-toast (+35 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (44): architecture, dataflow, func3(), lifecycle, pattern17, pattern18, pattern20, pattern4 (+36 more)

### Community 28 - "Community 28"
Cohesion: 0.10
Nodes (36): loadDiagram(), loadDiagramWithBrandMarks(), outputPathGuards, RELATIONSHIP_COLLECTIONS, SEMANTIC_COLLECTIONS, START_TYPES, validateGuidedViews(), validateRelationshipIds() (+28 more)

### Community 29 - "Community 29"
Cohesion: 0.05
Nodes (38): concurrency, cancel-in-progress, group, name, runs-on, steps, strategy, timeout-minutes (+30 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (35): createTrackedProgress(), enqueueBackgroundTask(), handleCancel(), spawnDetachedTaskWorker(), readStoredJob(), defaultState(), ensureStateDir(), FALLBACK_STATE_ROOT_DIR (+27 more)

### Community 31 - "Community 31"
Cohesion: 0.06
Nodes (13): HandlerFn, registerOmpPlugin(), createPluginWithRejectingLog(), createTestPlugin(), mcpSentinel, HandlerFn, MockCommandOpts, MockPiAdapter (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (26): zod, GET(), createBatchSchema, GET(), POST(), analyseSchema, POST(), enqueueSchema (+18 more)

### Community 33 - "Community 33"
Cohesion: 0.10
Nodes (27): Ak05Page(), metadata, DitAnalysisPage(), metadata, BatchDetailPage(), DEFAULT_DOC_COLUMNS, metadata, metadata (+19 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (30): asUrl(), attribute(), beforeDeadline(), captureBrandReference(), captureRemoteBrand(), captureTimeoutMilliseconds(), checkedFetch(), COLLECTIONS (+22 more)

### Community 35 - "Community 35"
Cohesion: 0.10
Nodes (25): A(), dt(), fe(), ft(), gt(), ht(), J(), jt() (+17 more)

### Community 36 - "Community 36"
Cohesion: 0.09
Nodes (21): deriveMarketplaceClonePath(), expandFilesArray(), healPartialInstallFromMarketplace(), isPartialInstall(), listFilesRecursive(), logHealResult(), readJsonSafe(), resolveConfigDir() (+13 more)

### Community 37 - "Community 37"
Cohesion: 0.10
Nodes (20): claimLatestUnconsumedResume(), cleanupOldSessions(), deleteSession(), ensureSession(), getEventBytesSummary(), getEventCount(), getEvents(), getLatestAttributedProjectDir() (+12 more)

### Community 38 - "Community 38"
Cohesion: 0.11
Nodes (32): connectionEndpointSide(), connectionSides(), automaticPorts, compositionFrames, __dirname, flowLabelSize(), flowSides(), layout (+24 more)

### Community 39 - "Community 39"
Cohesion: 0.12
Nodes (27): renderLegend(), renderLegend(), legendFootprint(), measuredEntryWidth(), measureLegend(), renderLegend(), resolveLegend(), nodeTextFit (+19 more)

### Community 40 - "Community 40"
Cohesion: 0.08
Nodes (22): attrEntries(), checks, collectLegendCollisions(), collectNonFiniteAttrs(), collectRelationshipCrossings(), composition, crossProduct(), decodeNumericReferences() (+14 more)

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (27): isProbablyText(), buildAdversarialCollectionGuidance(), buildBranchComparison(), collectBranchContext(), collectReviewContext(), collectWorkingTreeContext(), detectDefaultBranch(), ensureGitRepository() (+19 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (23): ADR-0003, getProviderConfigAction(), MaskedProviderConfigData, providerSettingsSchema, saveProviderSettingsAction(), testConnectionAction(), MODEL_SUGGESTIONS, Props (+15 more)

### Community 43 - "Community 43"
Cohesion: 0.07
Nodes (29): jobs, test, os, name, on, pull_request, push, workflow_dispatch (+21 more)

### Community 44 - "Community 44"
Cohesion: 0.11
Nodes (20): HOOK_DIR, { loadSessionDB }, ROUTING_BLOCK, toolNamer, HOOK_DIR, { loadSessionDB }, ROUTING_BLOCK, toolNamer (+12 more)

### Community 45 - "Community 45"
Cohesion: 0.13
Nodes (26): buildAdversarialReviewPrompt(), DEFAULT_MAX_PROGRESS_LINES, DEFAULT_MAX_STATUS_JOBS, enrichJob(), formatElapsedDuration(), getJobTypeLabel(), inferLegacyJobPhase(), isProgressBlockTitle() (+18 more)

### Community 46 - "Community 46"
Cohesion: 0.16
Nodes (27): cliPath, compactMessage(), diagramTypes, here, initialAuthoredOutput(), parseReceipt(), previewPage(), redactDiagnostic() (+19 more)

### Community 48 - "Community 48"
Cohesion: 0.13
Nodes (15): makeVersionFixture(), ROOT, SCRIPT, writeJson(), buildEnv(), installFakeCodex(), initGitRepo(), makeTempDir() (+7 more)

### Community 49 - "Community 49"
Cohesion: 0.07
Nodes (26): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+18 more)

### Community 50 - "Community 50"
Cohesion: 0.22
Nodes (15): check_approval(), cli_prefix(), command(), digest(), execute(), git(), main(), parse_result() (+7 more)

### Community 51 - "Community 51"
Cohesion: 0.16
Nodes (23): baseReceipt(), CAPTURE_VIEWPORTS, CHROME_NO_SANDBOX_ENV, cleanupCaptureSidecars(), contactSheetHtml(), executable(), EXIT, failureDiagnostic() (+15 more)

### Community 52 - "Community 52"
Cohesion: 0.08
Nodes (23): context, scaffold_script, description, execution, allowed_tools, max_turns, prompt, timeout_seconds (+15 more)

### Community 53 - "Community 53"
Cohesion: 0.09
Nodes (22): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+14 more)

### Community 54 - "Community 54"
Cohesion: 0.09
Nodes (11): registerContextModeInOpenclawConfig(), cleanups, createMockApiFull(), createTestPlugin(), mcpSentinel, MockCommandEntry, MockContextEngine, MockHookEntry (+3 more)

### Community 55 - "Community 55"
Cohesion: 0.16
Nodes (20): b(), E(), ee(), j(), K(), L(), M(), ne() (+12 more)

### Community 56 - "Community 56"
Cohesion: 0.16
Nodes (5): AppServerClientBase, BrokerCodexAppServerClient, buildJsonRpcError(), createProtocolError(), SpawnedCodexAppServerClient

### Community 57 - "Community 57"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 58 - "Community 58"
Cohesion: 0.22
Nodes (19): clone(), diagnostic(), expandableViewBox(), legacyLayoutProbe(), legacyRequirementProbe(), migrateWorkflowDocument(), requiredViewBoxFrom(), result() (+11 more)

### Community 59 - "Community 59"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 60 - "Community 60"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 61 - "Community 61"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 62 - "Community 62"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+13 more)

### Community 63 - "Community 63"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 64 - "Community 64"
Cohesion: 0.09
Nodes (21): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+13 more)

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (17): buildHookCommand(), ensureShebangAndExecBit(), extractNodePath(), fwd(), isStaleNodePath(), rewriteShellSnapshots(), selfHealCacheHealHook(), selfHealShellSnapshots() (+9 more)

### Community 66 - "Community 66"
Cohesion: 0.12
Nodes (12): codexSupportsUpdatedInput(), MIN_REWRITE_VERSION, parseCodexVersion(), versionGte(), formatDecision(), isHeadless(), ADR-0003, askDecision (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.11
Nodes (18): assert(), collectResponses(), __dirname, fixtureDir, JsonRpcRequest, JsonRpcResponse, main(), send() (+10 more)

### Community 68 - "Community 68"
Cohesion: 0.17
Nodes (19): executeReviewRun(), parseStructuredOutput(), appendActiveJobsTable(), appendReasoningSection(), escapeMarkdownCell(), formatCodexResumeCommand(), formatJobLine(), formatLineRange() (+11 more)

### Community 69 - "Community 69"
Cohesion: 0.10
Nodes (20): context, scaffold_script, description, execution, allowed_tools, max_turns, prompt, timeout_seconds (+12 more)

### Community 70 - "Community 70"
Cohesion: 0.16
Nodes (20): ADR-0006, buildUrl(), computeProjectIdentity(), configPath(), HOME, _internal, maybeForward(), NO_CONFIG (+12 more)

### Community 71 - "Community 71"
Cohesion: 0.11
Nodes (9): buildAutoInjection(), estimateTokens(), __dirname, _guidanceDir, HOOK_PATH, HookResult, mcpSentinel, _sessionGuidanceDir (+1 more)

### Community 72 - "Community 72"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 73 - "Community 73"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 74 - "Community 74"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 75 - "Community 75"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 76 - "Community 76"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 77 - "Community 77"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, arm, criteria (+11 more)

### Community 78 - "Community 78"
Cohesion: 0.10
Nodes (19): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+11 more)

### Community 79 - "Community 79"
Cohesion: 0.15
Nodes (11): healClaudeJsonMcpArgs(), healInstalledPlugins(), healMcpJsonArgs(), healPluginJsonMcpServers(), healSettingsEnabledPlugins(), __dirname, pkgRoot, buildFakeRegistry() (+3 more)

### Community 80 - "Community 80"
Cohesion: 0.09
Nodes (17): cliSrc, __dirname, ROOT, upgradeBody, upgradeIdx, cliSrc, __dirname, ROOT (+9 more)

### Community 81 - "Community 81"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 82 - "Community 82"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 83 - "Community 83"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 84 - "Community 84"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 85 - "Community 85"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 86 - "Community 86"
Cohesion: 0.11
Nodes (18): description, execution, allowed_tools, max_turns, prompt, timeout_seconds, expected_outcome, graders (+10 more)

### Community 87 - "Community 87"
Cohesion: 0.23
Nodes (17): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+9 more)

### Community 88 - "Community 88"
Cohesion: 0.12
Nodes (9): __dirname, executor, fixtureDir, runtimes, Scenario, scenarios, runtimes, executor (+1 more)

### Community 89 - "Community 89"
Cohesion: 0.11
Nodes (18): description, label, options, placeholder, render, value, body, attributes (+10 more)

### Community 90 - "Community 90"
Cohesion: 0.19
Nodes (14): GET(), DashboardPage(), metadata, ACCENT_MAP, StatsCard(), StatsCardProps, getActiveSignature(), Ak05ExportPayload (+6 more)

### Community 91 - "Community 91"
Cohesion: 0.18
Nodes (18): projectedNodeTextPx(), collectArrows(), collectCompositionFrames(), collectDesktopReadability(), collectLegendBoxes(), collectRelationshipLabelMasks(), estimatedTextWidth(), isCommand() (+10 more)

### Community 92 - "Community 92"
Cohesion: 0.24
Nodes (16): canonicalFuturePath(), canonicalize(), directoryIdentityKey(), directorySemanticsCache, futurePathsAlias(), hasFileIdentity(), nearestExistingDirectory(), OutputPathError (+8 more)

### Community 93 - "Community 93"
Cohesion: 0.11
Nodes (17): runs-on, steps, jobs, bundle, name, on, push, workflow_dispatch (+9 more)

### Community 94 - "Community 94"
Cohesion: 0.27
Nodes (10): fwd(), hasStaleCacheVersionSegment(), needsHookNormalization(), normalizeHooksJson(), normalizeHooksJsonOnly(), normalizeHooksOnStartup(), normalizePluginJson(), pluginRootVersion() (+2 more)

### Community 95 - "Community 95"
Cohesion: 0.41
Nodes (17): a(), et(), G(), h(), it(), J(), K(), m() (+9 more)

### Community 96 - "Community 96"
Cohesion: 0.29
Nodes (11): cell(), git(), install(), inventory(), main(), pre_commit(), read(), render() (+3 more)

### Community 97 - "Community 97"
Cohesion: 0.12
Nodes (16): description, execution, allowed_tools, max_turns, prompt, graders, criteria, focus (+8 more)

### Community 98 - "Community 98"
Cohesion: 0.12
Nodes (16): GH_TOKEN, jobs, update-stats, name, on, schedule, workflow_dispatch, permissions (+8 more)

### Community 99 - "Community 99"
Cohesion: 0.18
Nodes (10): @supabase/supabase-js@^2.119.0, @supabase/supabase-js, saveSchemeManifestAction(), schemeSchema, SchemeRegistrationForm(), metadata, SchemesPage(), AuditLogEntry (+2 more)

### Community 100 - "Community 100"
Cohesion: 0.12
Nodes (14): @playwright/test, prettier, prettier-plugin-tailwindcss, prisma, devDependencies, eslint@^9.16.0, eslint-config-next@^15.1.0, @playwright/test@^1.49.0 (+6 more)

### Community 101 - "Community 101"
Cohesion: 0.21
Nodes (13): abbrev_path(), check(), CLAUDE_PLUGIN_ROOT, config_file(), detect_os(), kv(), NODE_PATH, redact() (+5 more)

### Community 102 - "Community 102"
Cohesion: 0.13
Nodes (7): createMixedStore(), createSeededStore(), createStore(), RELEVANCE_CORPUS, ScenarioResult, scenarioResults, unifiedCleanups

### Community 103 - "Community 103"
Cohesion: 0.14
Nodes (13): description, devDependencies, @types/node@^25.5.0, typescript@^6.0.2, engines, node, license, name (+5 more)

### Community 104 - "Community 104"
Cohesion: 0.23
Nodes (10): entries(), front_matter(), ingest(), main(), model_of(), newest_run(), render(), sync() (+2 more)

### Community 105 - "Community 105"
Cohesion: 0.12
Nodes (15): description, label, options, placeholder, value, body, attributes, id (+7 more)

### Community 106 - "Community 106"
Cohesion: 0.25
Nodes (14): A(), b(), D(), e(), h(), K(), l(), m() (+6 more)

### Community 107 - "Community 107"
Cohesion: 0.20
Nodes (4): validate(), block(), main(), render()

### Community 109 - "Community 109"
Cohesion: 0.18
Nodes (8): realEnv, AnyClient, extractTestTerminalEscape(), stripTestTerminalEscapes(), testCouldBeEmoji(), testWideCodePoint(), testZeroWidthCodePoint(), visibleWidth()

### Community 110 - "Community 110"
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
Cohesion: 0.15
Nodes (12): author, name, url, description, homepage, keywords, license, name (+4 more)

### Community 121 - "Community 121"
Cohesion: 0.18
Nodes (11): buildFakeHome(), cleanups, __dirname, FakeHome, makeTmp(), REPO_HEAL_IP, REPO_HEAL_SQLITE3, REPO_POSTINSTALL (+3 more)

### Community 123 - "Community 123"
Cohesion: 0.30
Nodes (9): getDb(), appConfig, ConfigKey, ConfigMap, FormMapping06, GetConfigOptions, SchemeManifest, SimilarityThresholds (+1 more)

### Community 124 - "Community 124"
Cohesion: 0.29
Nodes (11): bench(), benchFuzzyCache(), BenchResult, benchTokenDedup(), cleanupSearchDB(), executor, main(), printTable() (+3 more)

### Community 125 - "Community 125"
Cohesion: 0.17
Nodes (12): scripts, build, db:push, db:studio, dev, generate, lint, start (+4 more)

### Community 126 - "Community 126"
Cohesion: 0.24
Nodes (10): ALL_TRACKED, DELETE_KEYS, envForHome(), HOMEDRIVE_HOMEPATH_KEYS, IsolatedEnvHandle, IsolatedEnvOpts, REDIRECT_KEYS, getActiveFakeHome() (+2 more)

### Community 128 - "Community 128"
Cohesion: 0.20
Nodes (11): B(), Ce(), constructor(), De(), F(), initSchema(), J(), k() (+3 more)

### Community 129 - "Community 129"
Cohesion: 0.24
Nodes (7): awaitRpc(), __dirname, initServer(), mcpEntry, MockResult, RpcResponse, sendRpc()

### Community 130 - "Community 130"
Cohesion: 0.27
Nodes (5): CLAUDE_PROJECTS_DIR, resolveClaudeSessionPath(), resolveUserPath(), TRANSCRIPT_PATH_ENV, ensureAbsolutePath()

### Community 132 - "Community 132"
Cohesion: 0.22
Nodes (9): dependencies, better-sqlite3@^11.0.0, description, main, name, version, better-sqlite3, createLegacySessionDb() (+1 more)

### Community 133 - "Community 133"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, outDir, skipLibCheck, strict, target (+1 more)

### Community 134 - "Community 134"
Cohesion: 0.33
Nodes (8): buildSafeEnv(), CONDA_ENV_KEYS, CONDA_PATH_PATTERNS, detectWindowsVsYear(), healBetterSqlite3Binding(), isCondaActive(), isSafePythonPath(), resolveSafePython()

### Community 135 - "Community 135"
Cohesion: 0.31
Nodes (7): loginAction(), loginSchema, LoginState, LoginForm(), LoginFormProps, dynamic, LoginPage()

### Community 136 - "Community 136"
Cohesion: 0.31
Nodes (8): CategoryExpectation, findEvent(), hasBlocker(), hasBlockerResolved(), hasDecision(), hasRole(), intentMode(), LANGUAGE_MATRIX

### Community 137 - "Community 137"
Cohesion: 0.22
Nodes (5): cleanups, dbPathFor(), seedSessionWithProjectDir(), STRICT_OPTS, ADR-0001

### Community 138 - "Community 138"
Cohesion: 0.25
Nodes (9): ct(), et(), it(), ot(), rt(), st(), vt(), W() (+1 more)

### Community 139 - "Community 139"
Cohesion: 0.22
Nodes (7): BenchmarkRow, __dirname, EcosystemScenario, executor, fixtureDir, runtimes, scenarios

### Community 140 - "Community 140"
Cohesion: 0.25
Nodes (8): benchmark(), BenchmarkResult, __dirname, executor, fixtureDir, main(), results, runtimes

### Community 142 - "Community 142"
Cohesion: 0.25
Nodes (7): hooks, AfterModel, AfterTool, BeforeTool, PreCompress, SessionStart, $schema

### Community 143 - "Community 143"
Cohesion: 0.25
Nodes (7): enabled, context-mode, plugins, entries, slots, $schema, contextEngine

### Community 144 - "Community 144"
Cohesion: 0.25
Nodes (8): H(), Ie(), nt(), te(), tt(), Ue(), we(), xe()

### Community 145 - "Community 145"
Cohesion: 0.25
Nodes (7): conversation, lifetime, multiAdapter, realBytesConversation, realBytesLifetime, report, text

### Community 146 - "Community 146"
Cohesion: 0.46
Nodes (6): computeJaccardNgram(), computeTfIdfCosine(), evaluateSimilarityPair(), makeNgrams(), SimilarityMetrics, tokenizeWords()

### Community 148 - "Community 148"
Cohesion: 0.29
Nodes (4): importFresh(), MockDb, platformConfigFile(), writePlatformConfig()

### Community 149 - "Community 149"
Cohesion: 0.29
Nodes (7): benchmark(), BenchmarkResult, __dirname, fixtureDir, main(), results, skillDir

### Community 150 - "Community 150"
Cohesion: 0.36
Nodes (6): _hashCanonical(), isolatedHomeEnv(), runStatusline(), seedRealAdapter(), STATUSLINE, buildIsolatedEnvObject()

### Community 151 - "Community 151"
Cohesion: 0.33
Nodes (7): at(), B(), F(), lt(), M(), pt(), Y()

### Community 152 - "Community 152"
Cohesion: 0.29
Nodes (7): E(), G(), I(), nt(), P(), U(), z()

### Community 153 - "Community 153"
Cohesion: 0.33
Nodes (6): __dirname, executor, fixtureDir, main(), runtimes, useCase()

### Community 154 - "Community 154"
Cohesion: 0.33
Nodes (6): scripts, build, bump-version, check-version, prebuild, test

### Community 155 - "Community 155"
Cohesion: 0.33
Nodes (5): DESKTOP_READABILITY_VIEWPORT, DESKTOP_READER_DIAGRAM_WIDTH, DESKTOP_READER_HORIZONTAL_CHROME, DESKTOP_READER_MIN_WIDTH, MIN_PROJECTED_NODE_TEXT_PX

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
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 160 - "Community 160"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 161 - "Community 161"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 162 - "Community 162"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 163 - "Community 163"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 164 - "Community 164"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 165 - "Community 165"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 166 - "Community 166"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 167 - "Community 167"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 168 - "Community 168"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 169 - "Community 169"
Cohesion: 0.33
Nodes (5): interface, display_name, short_description, policy, allow_implicit_invocation

### Community 170 - "Community 170"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 172 - "Community 172"
Cohesion: 0.53
Nodes (5): main(), parseArgs(), readArgs0(), readJson(), REQUIRED_PLUGIN_RUNTIME_FILES

### Community 173 - "Community 173"
Cohesion: 0.33
Nodes (3): batchRequests, __dirname, fetchAndIndexSchema

### Community 174 - "Community 174"
Cohesion: 0.40
Nodes (5): CapturedPost, platformConfigFile(), SEED_INSERT_COLUMNS, VARIANT_COLUMNS, writePlatformConfig()

### Community 176 - "Community 176"
Cohesion: 0.47
Nodes (4): isolatedHomeEnv(), runStatusline(), runStatuslineFull(), STATUSLINE

### Community 177 - "Community 177"
Cohesion: 0.70
Nodes (4): eval_in_flight(), is_ignored(), newest_mtime(), gate-skill-evals.sh script

### Community 178 - "Community 178"
Cohesion: 0.60
Nodes (4): launchTarget(), openArtifact(), OPENERS, openLoopbackUrl()

### Community 179 - "Community 179"
Cohesion: 0.40
Nodes (4): CONTEXT_MODE_PLATFORM, context-mode, context-mode, CONTEXT_MODE_COPILOT_PLUGIN

### Community 180 - "Community 180"
Cohesion: 0.40
Nodes (5): be(), Ee(), ge(), le(), V()

### Community 181 - "Community 181"
Cohesion: 0.60
Nodes (5): bulkInsertEvents(), _e(), _getSessionProjectDir(), insertEvent(), withRetry()

### Community 182 - "Community 182"
Cohesion: 0.50
Nodes (5): Ke(), Ne(), Q(), ye(), z()

### Community 183 - "Community 183"
Cohesion: 0.60
Nodes (4): assert(), loadPayload(), main(), REQUIRED_TOOLS

### Community 184 - "Community 184"
Cohesion: 0.40
Nodes (3): Env, env, envSchema

### Community 188 - "Community 188"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 189 - "Community 189"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 190 - "Community 190"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 191 - "Community 191"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 192 - "Community 192"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 193 - "Community 193"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 194 - "Community 194"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 195 - "Community 195"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 196 - "Community 196"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 197 - "Community 197"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 198 - "Community 198"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 199 - "Community 199"
Cohesion: 0.50
Nodes (3): interface, display_name, short_description

### Community 200 - "Community 200"
Cohesion: 0.50
Nodes (3): CONTEXT_MODE_PLATFORM, context-mode, node

### Community 201 - "Community 201"
Cohesion: 0.50
Nodes (4): cleanup(), close(), me(), x()

### Community 211 - "Community 211"
Cohesion: 0.67
Nodes (3): @tanstack/react-query@^5.108.0, @tanstack/react-query, @tanstack/react-query@^5.62.0

## Knowledge Gaps
- **31 isolated node(s):** `ADR-0001`, `CLAUDE_PLUGIN_ROOT`, `NODE_PATH`, `RFC-4122`, `ADR-0003` (+26 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 2120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Community 1` to `Community 129`, `Community 2`, `Community 6`, `Community 136`, `Community 9`, `Community 137`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 146`, `Community 18`, `Community 148`, `Community 21`, `Community 150`, `Community 24`, `Community 31`, `Community 36`, `Community 42`, `Community 171`, `Community 44`, `Community 173`, `Community 174`, `Community 175`, `Community 176`, `Community 54`, `Community 185`, `Community 186`, `Community 187`, `Community 65`, `Community 66`, `Community 67`, `Community 71`, `Community 202`, `Community 79`, `Community 80`, `Community 213`, `Community 215`, `Community 88`, `Community 216`, `Community 90`, `Community 217`, `Community 94`, `Community 99`, `Community 228`, `Community 229`, `Community 102`, `Community 233`, `Community 234`, `Community 235`, `Community 108`, `Community 109`, `Community 236`, `Community 111`, `Community 112`, `Community 121`, `Community 122`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **What connects `ADR-0001`, `CLAUDE_PLUGIN_ROOT`, `NODE_PATH` to the rest of the system?**
  _31 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.028363861194837314 - nodes in this community are weakly interconnected._
- **Why does `ne()` connect `Community 55` to `Community 35`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.019724375538329026 - nodes in this community are weakly interconnected._
- **Why does `oe()` connect `Community 35` to `Community 151`, `Community 138`, `Community 55`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.019562179785747556 - nodes in this community are weakly interconnected._