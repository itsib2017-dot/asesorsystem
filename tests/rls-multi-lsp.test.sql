-- RLS Multi-LSP & Multi-Role Verification Test Suite
-- Target: Remote Supabase database (oiplhsmmfuqriaqrxjud)
-- Standard: ground_rules_v5.md §C.1 & CLAUDE_CODE_KICKOFF.md Step 2
-- Isolation: Executes entirely within a single transaction and ROLLBACK at end.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS test_results (
  test_id text,
  role_tested text,
  target_lsp text,
  resource text,
  expected text,
  actual text,
  status text
);
GRANT ALL ON test_results TO authenticated;


DO $test$
DECLARE
  -- LSP IDs
  v_lsp_a uuid := 'a0000000-0000-0000-0000-000000000001';
  v_lsp_b uuid := 'b0000000-0000-0000-0000-000000000002';

  -- User / Assessor IDs
  v_assessor_a uuid := '10000000-0000-0000-0000-000000000001';
  v_admin_a    uuid := '10000000-0000-0000-0000-000000000002';
  v_tuk_a      uuid := '10000000-0000-0000-0000-000000000003';

  v_assessor_b uuid := '20000000-0000-0000-0000-000000000001';
  v_admin_b    uuid := '20000000-0000-0000-0000-000000000002';
  v_tuk_b      uuid := '20000000-0000-0000-0000-000000000003';

  -- Resource IDs
  v_scheme_a uuid := 'a1000000-0000-0000-0000-000000000001';
  v_scheme_b uuid := 'b1000000-0000-0000-0000-000000000001';

  v_batch_a1 uuid := 'a2000000-0000-0000-0000-000000000001';
  v_batch_a2 uuid := 'a2000000-0000-0000-0000-000000000002';
  v_batch_b1 uuid := 'b2000000-0000-0000-0000-000000000001';

  v_assessee_a1 uuid := 'a3000000-0000-0000-0000-000000000001';
  v_assessee_a2 uuid := 'a3000000-0000-0000-0000-000000000002';
  v_assessee_b1 uuid := 'b3000000-0000-0000-0000-000000000001';

  v_count integer;
BEGIN
  -- 1. SEED DATA (Running with elevated session/postgres role)
  INSERT INTO auth.users (id, email) VALUES
    (v_assessor_a, 'assessor_a@lsp-a.id'),
    (v_admin_a,    'admin_a@lsp-a.id'),
    (v_tuk_a,      'tuk_a@lsp-a.id'),
    (v_assessor_b, 'assessor_b@lsp-b.id'),
    (v_admin_b,    'admin_b@lsp-b.id'),
    (v_tuk_b,      'tuk_b@lsp-b.id');

  INSERT INTO public.assessors (id, full_name) VALUES
    (v_assessor_a, 'Assessor A (LSP A)'),
    (v_admin_a,    'Admin A (LSP A)'),
    (v_tuk_a,      'TUK Admin A (LSP A)'),
    (v_assessor_b, 'Assessor B (LSP B)'),
    (v_admin_b,    'Admin B (LSP B)'),
    (v_tuk_b,      'TUK Admin B (LSP B)');

  INSERT INTO public.lsps (id, code, name) VALUES
    (v_lsp_a, 'LSP-TEST-A', 'LSP Test Alpha'),
    (v_lsp_b, 'LSP-TEST-B', 'LSP Test Beta');

  INSERT INTO public.lsp_memberships (lsp_id, assessor_id, role) VALUES
    (v_lsp_a, v_assessor_a, 'assessor'),
    (v_lsp_a, v_admin_a,    'lsp_admin'),
    (v_lsp_a, v_tuk_a,      'tuk_admin'),
    (v_lsp_b, v_assessor_b, 'assessor'),
    (v_lsp_b, v_admin_b,    'lsp_admin'),
    (v_lsp_b, v_tuk_b,      'tuk_admin');

  INSERT INTO public.schemes (id, lsp_id, code, name) VALUES
    (v_scheme_a, v_lsp_a, 'SCH-A', 'Scheme Alpha'),
    (v_scheme_b, v_lsp_b, 'SCH-B', 'Scheme Beta');

  INSERT INTO public.batches (id, lsp_id, scheme_id, name, created_by) VALUES
    (v_batch_a1, v_lsp_a, v_scheme_a, 'Batch A1 (Assigned to A)', v_admin_a),
    (v_batch_a2, v_lsp_a, v_scheme_a, 'Batch A2 (Unassigned to A)', v_admin_a),
    (v_batch_b1, v_lsp_b, v_scheme_b, 'Batch B1', v_admin_b);

  INSERT INTO public.batch_assessors (batch_id, lsp_id, assessor_id) VALUES
    (v_batch_a1, v_lsp_a, v_assessor_a),
    (v_batch_b1, v_lsp_b, v_assessor_b);

  INSERT INTO public.assessees (id, lsp_id, batch_id, assigned_assessor_id, display_name) VALUES
    (v_assessee_a1, v_lsp_a, v_batch_a1, v_assessor_a, 'Assessee A1 (Assigned)'),
    (v_assessee_a2, v_lsp_a, v_batch_a2, NULL,          'Assessee A2 (Unassigned)'),
    (v_assessee_b1, v_lsp_b, v_batch_b1, v_assessor_b, 'Assessee B1');

  INSERT INTO public.app_config (scope, lsp_id, scheme_id, key, value) VALUES
    ('lsp',    v_lsp_a, NULL, 'scoring.policy', '{"cutoff":70}'::jsonb),
    ('lsp',    v_lsp_b, NULL, 'scoring.policy', '{"cutoff":80}'::jsonb),
    ('global', NULL,    NULL, 'app.name',       '"AsesorSystem"'::jsonb)
  ON CONFLICT (scope, lsp_id, scheme_id, key) DO NOTHING;

  INSERT INTO public.audit_log (lsp_id, actor_id, action, resource, correlation_id) VALUES
    (v_lsp_a, v_admin_a, 'create', 'batch', 'corr-a-01'),
    (v_lsp_b, v_admin_b, 'create', 'batch', 'corr-b-01');

  -- Phase 1-5 tables seeding
  INSERT INTO public.scheme_form_manifests (lsp_id, scheme_id, form_key, file_patterns, required, instrument_role) VALUES
    (v_lsp_a, v_scheme_a, '04a', array['04a'], true, 'dit'),
    (v_lsp_b, v_scheme_b, '04a', array['04a'], true, 'dit');

  INSERT INTO public.drive_files (lsp_id, batch_id, assessee_id, drive_file_id, file_name, mime_type, triage_status) VALUES
    (v_lsp_a, v_batch_a1, v_assessee_a1, 'df-a1', 'KTP_A1.jpg', 'image/jpeg', 'assigned'),
    (v_lsp_b, v_batch_b1, v_assessee_b1, 'df-b1', 'KTP_B1.jpg', 'image/jpeg', 'assigned');

  INSERT INTO public.decisions (lsp_id, batch_id, assessee_id, unit_code, unit_title, ai_recommendation, decision) VALUES
    (v_lsp_a, v_batch_a1, v_assessee_a1, 'M.71KKK01.001.1', 'Unit 1', 'K', 'K'),
    (v_lsp_b, v_batch_b1, v_assessee_b1, 'M.71KKK01.001.1', 'Unit 1', 'K', 'K');

  INSERT INTO public.ak05_reports (lsp_id, batch_id, assessor_id, tuk_type, status) VALUES
    (v_lsp_a, v_batch_a1, v_assessor_a, 'sewaktu', 'draft'),
    (v_lsp_b, v_batch_b1, v_assessor_b, 'sewaktu', 'draft');

  INSERT INTO public.assessor_llm_config (assessor_id, provider, model, encrypted_api_key) VALUES
    (v_assessor_a, 'anthropic', 'claude-3-7-sonnet-20250219', 'iv:tag:cipher_a'),
    (v_assessor_b, 'anthropic', 'claude-3-7-sonnet-20250219', 'iv:tag:cipher_b');

END $test$;

-- 2. RUN ASSERTIONS AS DIFFERENT ROLES
-- Switch role to authenticated
SET LOCAL ROLE authenticated;

-- =========================================================================
-- SUITE 1: ASSESSOR A (Role: assessor, LSP: LSP-A)
-- =========================================================================
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- T1.1: Cross-LSP Read Schemes (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-01', 'assessor', 'LSP-B', 'schemes', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.schemes WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T1.2: Cross-LSP Read Batches (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-02', 'assessor', 'LSP-B', 'batches', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.batches WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T1.3: Cross-LSP Read Assessees (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-03', 'assessor', 'LSP-B', 'assessees', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessees WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T1.4: Cross-LSP Read Config (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-04', 'assessor', 'LSP-B', 'app_config', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.app_config WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T1.5: Cross-LSP Read Audit Log (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-05', 'assessor', 'LSP-B', 'audit_log', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.audit_log WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T1.6: Intra-LSP Assigned Batch (Batch A1) -> MUST see 1
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-06', 'assessor', 'LSP-A', 'batches (assigned)', '1', count(*)::text,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
FROM public.batches WHERE id = 'a2000000-0000-0000-0000-000000000001';

-- T1.7: Intra-LSP Unassigned Batch (Batch A2) -> MUST NOT see (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-07', 'assessor', 'LSP-A', 'batches (unassigned)', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.batches WHERE id = 'a2000000-0000-0000-0000-000000000002';

-- T1.8: Intra-LSP Assigned Assessee (Assessee A1) -> MUST see 1
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-08', 'assessor', 'LSP-A', 'assessees (assigned)', '1', count(*)::text,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessees WHERE id = 'a3000000-0000-0000-0000-000000000001';

-- T1.9: Intra-LSP Unassigned Assessee (Assessee A2) -> MUST NOT see (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-09', 'assessor', 'LSP-A', 'assessees (unassigned)', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessees WHERE id = 'a3000000-0000-0000-0000-000000000002';

-- T1.10: Intra-LSP Audit Log -> Assessor cannot see audit log (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-10', 'assessor', 'LSP-A', 'audit_log', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.audit_log WHERE lsp_id = 'a0000000-0000-0000-0000-000000000001';


-- =========================================================================
-- SUITE 2: LSP ADMIN A (Role: lsp_admin, LSP: LSP-A)
-- =========================================================================
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

-- T2.1: Cross-LSP Read Schemes (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-11', 'lsp_admin', 'LSP-B', 'schemes', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.schemes WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T2.2: Cross-LSP Read Batches (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-12', 'lsp_admin', 'LSP-B', 'batches', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.batches WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T2.3: Cross-LSP Read Assessees (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-13', 'lsp_admin', 'LSP-B', 'assessees', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessees WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T2.4: Cross-LSP Read Audit Log (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-14', 'lsp_admin', 'LSP-B', 'audit_log', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.audit_log WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T2.5: Intra-LSP Read All Batches (LSP-A) -> MUST see 2 batches
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-15', 'lsp_admin', 'LSP-A', 'batches (all)', '2', count(*)::text,
       CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END
FROM public.batches WHERE lsp_id = 'a0000000-0000-0000-0000-000000000001';

-- T2.6: Intra-LSP Read All Assessees (LSP-A) -> MUST see 2 assessees
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-16', 'lsp_admin', 'LSP-A', 'assessees (all)', '2', count(*)::text,
       CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessees WHERE lsp_id = 'a0000000-0000-0000-0000-000000000001';

-- T2.7: Intra-LSP Read Audit Log (LSP-A) -> MUST see 1 audit log
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-17', 'lsp_admin', 'LSP-A', 'audit_log', '1', count(*)::text,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
FROM public.audit_log WHERE lsp_id = 'a0000000-0000-0000-0000-000000000001';


-- =========================================================================
-- SUITE 3: TUK ADMIN A (Role: tuk_admin, LSP: LSP-A)
-- =========================================================================
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

-- T3.1: Cross-LSP Read Batches (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-18', 'tuk_admin', 'LSP-B', 'batches', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.batches WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T3.2: Cross-LSP Read Assessees (LSP-B) -> MUST return empty (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-19', 'tuk_admin', 'LSP-B', 'assessees', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessees WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

-- T3.3: Intra-LSP Read All Batches (LSP-A) -> MUST see 2 batches
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-20', 'tuk_admin', 'LSP-A', 'batches (all)', '2', count(*)::text,
       CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END
FROM public.batches WHERE lsp_id = 'a0000000-0000-0000-0000-000000000001';

-- T3.4: Intra-LSP Read All Assessees (LSP-A) -> MUST see 2 assessees
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-21', 'tuk_admin', 'LSP-A', 'assessees (all)', '2', count(*)::text,
       CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessees WHERE lsp_id = 'a0000000-0000-0000-0000-000000000001';

-- T3.5: Intra-LSP Read Audit Log (LSP-A) -> TUK admin cannot see audit log (0)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-22', 'tuk_admin', 'LSP-A', 'audit_log', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.audit_log WHERE lsp_id = 'a0000000-0000-0000-0000-000000000001';

-- =========================================================================
-- SUITE 4: MUTATION & CROSS-TENANT INJECTION DEFENSE
-- =========================================================================
-- T4.1: Cross-LSP Batch Insert by Assessor A -> MUST FAIL
DO $mut$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  BEGIN
    INSERT INTO public.batches (id, lsp_id, scheme_id, name, created_by)
    VALUES ('a2000000-0000-0000-0000-000000000099', 'b0000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Cross-LSP Injection', '10000000-0000-0000-0000-000000000001');
    INSERT INTO test_results VALUES ('RLS-23', 'assessor', 'LSP-B', 'batches (cross-insert)', 'REJECT', 'ALLOWED', 'FAIL');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results VALUES ('RLS-23', 'assessor', 'LSP-B', 'batches (cross-insert)', 'REJECT', 'REJECTED', 'PASS');
  END;
END $mut$;

-- T4.2: Cross-LSP Scheme Insert by Admin A -> MUST FAIL
DO $mut$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  BEGIN
    INSERT INTO public.schemes (id, lsp_id, code, name)
    VALUES ('b1000000-0000-0000-0000-000000000099', 'b0000000-0000-0000-0000-000000000002', 'INJECT-SCH', 'Injected Scheme');
    INSERT INTO test_results VALUES ('RLS-24', 'lsp_admin', 'LSP-B', 'schemes (cross-insert)', 'REJECT', 'ALLOWED', 'FAIL');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results VALUES ('RLS-24', 'lsp_admin', 'LSP-B', 'schemes (cross-insert)', 'REJECT', 'REJECTED', 'PASS');
  END;
END $mut$;

-- T4.3: Audit Log Tamper/Delete by Admin A -> MUST FAIL (audit_log is append-only)
DO $mut$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  BEGIN
    DELETE FROM public.audit_log WHERE lsp_id = 'a0000000-0000-0000-0000-000000000001';
    INSERT INTO test_results VALUES ('RLS-25', 'lsp_admin', 'LSP-A', 'audit_log (delete tamper)', 'REJECT', 'ALLOWED', 'FAIL');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results VALUES ('RLS-25', 'lsp_admin', 'LSP-A', 'audit_log (delete tamper)', 'REJECT', 'REJECTED', 'PASS');
  END;
END $mut$;

-- =========================================================================
-- SUITE 5: PHASE 1-5 & BYOK TABLES ISOLATION (Assessor A)
-- =========================================================================
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-26', 'assessor', 'LSP-B', 'scheme_form_manifests', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.scheme_form_manifests WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-27', 'assessor', 'LSP-B', 'drive_files', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.drive_files WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-28', 'assessor', 'LSP-B', 'decisions', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.decisions WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-29', 'assessor', 'LSP-B', 'ak05_reports', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.ak05_reports WHERE lsp_id = 'b0000000-0000-0000-0000-000000000002';

INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-30', 'assessor', 'OTHER-ASSESSOR', 'assessor_llm_config', '0', count(*)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessor_llm_config WHERE assessor_id = '20000000-0000-0000-0000-000000000001';

-- Verify own BYOK config visible (1)
INSERT INTO test_results (test_id, role_tested, target_lsp, resource, expected, actual, status)
SELECT 'RLS-31', 'assessor', 'SELF', 'assessor_llm_config', '1', count(*)::text,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
FROM public.assessor_llm_config WHERE assessor_id = '10000000-0000-0000-0000-000000000001';

-- Switch back to postgres session to query results
RESET ROLE;

SELECT test_id, role_tested, target_lsp, resource, expected, actual, status 
FROM test_results
ORDER BY test_id;

ROLLBACK;
