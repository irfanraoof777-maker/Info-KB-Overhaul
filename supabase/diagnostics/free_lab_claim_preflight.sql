-- InfoKB secure free-Lab claim preflight
--
-- Run this once in the Supabase SQL editor and return the single JSON result.
-- This is read-only: it does not inspect catalog rows, student data, rentals,
-- launch URLs, credentials, or secrets, and it makes no database changes.

WITH target_relations(schema_name, relation_name) AS (
  VALUES
    ('public', 'labs'),
    ('public', 'lab_rentals'),
    ('public', 'access_audit_events'),
    ('private', 'lab_launch_configurations')
),
columns AS (
  SELECT
    cols.table_schema,
    cols.table_name,
    cols.ordinal_position,
    cols.column_name,
    cols.data_type,
    cols.udt_name,
    cols.is_nullable,
    cols.column_default
  FROM information_schema.columns AS cols
  JOIN target_relations AS targets
    ON targets.schema_name = cols.table_schema
   AND targets.relation_name = cols.table_name
),
constraints AS (
  SELECT
    namespaces.nspname AS table_schema,
    relations.relname AS table_name,
    constraints.conname AS constraint_name,
    constraints.contype AS constraint_type,
    pg_catalog.pg_get_constraintdef(constraints.oid, true) AS definition
  FROM pg_catalog.pg_constraint AS constraints
  JOIN pg_catalog.pg_class AS relations
    ON relations.oid = constraints.conrelid
  JOIN pg_catalog.pg_namespace AS namespaces
    ON namespaces.oid = relations.relnamespace
  JOIN target_relations AS targets
    ON targets.schema_name = namespaces.nspname
   AND targets.relation_name = relations.relname
),
indexes AS (
  SELECT
    indexes.schemaname AS table_schema,
    indexes.tablename AS table_name,
    indexes.indexname AS index_name,
    indexes.indexdef AS definition
  FROM pg_catalog.pg_indexes AS indexes
  JOIN target_relations AS targets
    ON targets.schema_name = indexes.schemaname
   AND targets.relation_name = indexes.tablename
),
policies AS (
  SELECT
    policies.schemaname AS table_schema,
    policies.tablename AS table_name,
    policies.policyname AS policy_name,
    policies.permissive,
    policies.roles,
    policies.cmd,
    policies.qual,
    policies.with_check
  FROM pg_catalog.pg_policies AS policies
  JOIN target_relations AS targets
    ON targets.schema_name = policies.schemaname
   AND targets.relation_name = policies.tablename
),
table_grants AS (
  SELECT
    grants.table_schema,
    grants.table_name,
    grants.grantee,
    grants.privilege_type,
    grants.is_grantable
  FROM information_schema.role_table_grants AS grants
  JOIN target_relations AS targets
    ON targets.schema_name = grants.table_schema
   AND targets.relation_name = grants.table_name
  WHERE grants.grantee IN ('anon', 'authenticated', 'service_role')
),
column_grants AS (
  SELECT
    grants.table_schema,
    grants.table_name,
    grants.column_name,
    grants.grantee,
    grants.privilege_type
  FROM information_schema.role_column_grants AS grants
  JOIN target_relations AS targets
    ON targets.schema_name = grants.table_schema
   AND targets.relation_name = grants.table_name
  WHERE grants.grantee IN ('anon', 'authenticated', 'service_role')
),
routines AS (
  SELECT
    namespaces.nspname AS routine_schema,
    procedures.proname AS routine_name,
    pg_catalog.pg_get_function_identity_arguments(procedures.oid) AS identity_arguments,
    procedures.prosecdef AS security_definer,
    procedures.proconfig AS configuration,
    pg_catalog.pg_get_functiondef(procedures.oid) AS definition,
    pg_catalog.has_function_privilege(
      'anon', procedures.oid, 'EXECUTE'
    ) AS anon_can_execute,
    pg_catalog.has_function_privilege(
      'authenticated', procedures.oid, 'EXECUTE'
    ) AS authenticated_can_execute,
    pg_catalog.has_function_privilege(
      'service_role', procedures.oid, 'EXECUTE'
    ) AS service_role_can_execute
  FROM pg_catalog.pg_proc AS procedures
  JOIN pg_catalog.pg_namespace AS namespaces
    ON namespaces.oid = procedures.pronamespace
  WHERE namespaces.nspname = 'public'
    AND (
      procedures.proname LIKE 'admin_%lab%'
      OR procedures.proname LIKE '%lab%claim%'
      OR procedures.proname LIKE '%lab%launch%'
    )
)
SELECT pg_catalog.jsonb_build_object(
  'columns', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.table_schema, item.table_name, item.ordinal_position)
    FROM columns AS item
  ), '[]'::jsonb),
  'constraints', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.table_schema, item.table_name, item.constraint_name)
    FROM constraints AS item
  ), '[]'::jsonb),
  'indexes', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.table_schema, item.table_name, item.index_name)
    FROM indexes AS item
  ), '[]'::jsonb),
  'policies', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.table_schema, item.table_name, item.policy_name)
    FROM policies AS item
  ), '[]'::jsonb),
  'table_grants', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.table_schema, item.table_name, item.grantee, item.privilege_type)
    FROM table_grants AS item
  ), '[]'::jsonb),
  'column_grants', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.table_schema, item.table_name, item.column_name, item.grantee, item.privilege_type)
    FROM column_grants AS item
  ), '[]'::jsonb),
  'routines', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.routine_schema, item.routine_name, item.identity_arguments)
    FROM routines AS item
  ), '[]'::jsonb)
) AS free_lab_claim_preflight;
