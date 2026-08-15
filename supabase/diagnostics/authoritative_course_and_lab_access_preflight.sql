-- InfoKB authoritative course-and-lab access preflight
--
-- COMPLETELY READ ONLY: this file contains one catalog query. It does not
-- create or modify schemas, tables, functions, policies, grants, rows, or
-- configuration. It does not select application rows, auth.users identities,
-- secrets, credentials, or personal data.
--
-- The query returns every finding in one result grid. Each row has:
--   section     - finding category
--   object_name - qualified object/column/policy/etc. name
--   details     - structured JSON metadata for that finding

WITH findings AS (
  -- Relations, relation kind, ownership role, and RLS status.
  SELECT
    'relations'::text AS section,
    pg_catalog.format('%I.%I', namespaces.nspname, classes.relname) AS object_name,
    pg_catalog.jsonb_build_object(
      'schema', namespaces.nspname,
      'relation', classes.relname,
      'relationKind', CASE classes.relkind
        WHEN 'r' THEN 'table'
        WHEN 'p' THEN 'partitioned table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        ELSE classes.relkind::text
      END,
      'rlsEnabled', classes.relrowsecurity,
      'rlsForced', classes.relforcerowsecurity,
      'ownerRole', pg_catalog.pg_get_userbyid(classes.relowner)
    ) AS details
  FROM pg_catalog.pg_class AS classes
  JOIN pg_catalog.pg_namespace AS namespaces
    ON namespaces.oid = classes.relnamespace
  WHERE (namespaces.nspname, classes.relname) IN (
    ('auth', 'users'),
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )

  UNION ALL

  -- Exact column types, defaults, nullability, identity, and generation state.
  SELECT
    'columns'::text,
    pg_catalog.format(
      '%I.%I.%I',
      columns.table_schema,
      columns.table_name,
      columns.column_name
    ),
    pg_catalog.jsonb_build_object(
      'schema', columns.table_schema,
      'table', columns.table_name,
      'column', columns.column_name,
      'ordinalPosition', columns.ordinal_position,
      'dataType', columns.data_type,
      'udtSchema', columns.udt_schema,
      'udtName', columns.udt_name,
      'nullable', columns.is_nullable,
      'default', columns.column_default,
      'identity', columns.is_identity,
      'identityGeneration', columns.identity_generation,
      'generated', columns.is_generated,
      'generationExpression', columns.generation_expression
    )
  FROM information_schema.columns AS columns
  WHERE (columns.table_schema, columns.table_name) IN (
    ('auth', 'users'),
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )

  UNION ALL

  -- Primary keys, foreign keys, unique, check, and exclusion constraints.
  SELECT
    'constraints'::text,
    pg_catalog.format(
      '%I.%I.%I',
      namespaces.nspname,
      classes.relname,
      constraints.conname
    ),
    pg_catalog.jsonb_build_object(
      'schema', namespaces.nspname,
      'table', classes.relname,
      'constraint', constraints.conname,
      'constraintType', CASE constraints.contype
        WHEN 'p' THEN 'primary key'
        WHEN 'f' THEN 'foreign key'
        WHEN 'u' THEN 'unique'
        WHEN 'c' THEN 'check'
        WHEN 'x' THEN 'exclusion'
        ELSE constraints.contype::text
      END,
      'definition', pg_catalog.pg_get_constraintdef(constraints.oid, true)
    )
  FROM pg_catalog.pg_constraint AS constraints
  JOIN pg_catalog.pg_class AS classes
    ON classes.oid = constraints.conrelid
  JOIN pg_catalog.pg_namespace AS namespaces
    ON namespaces.oid = classes.relnamespace
  WHERE (namespaces.nspname, classes.relname) IN (
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )

  UNION ALL

  -- Existing indexes, including uniqueness and partial predicates.
  SELECT
    'indexes'::text,
    pg_catalog.format('%I.%I', indexes.schemaname, indexes.indexname),
    pg_catalog.jsonb_build_object(
      'schema', indexes.schemaname,
      'table', indexes.tablename,
      'index', indexes.indexname,
      'definition', indexes.indexdef
    )
  FROM pg_catalog.pg_indexes AS indexes
  WHERE (indexes.schemaname, indexes.tablename) IN (
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )

  UNION ALL

  -- RLS policies and their exact commands and expressions.
  SELECT
    'policies'::text,
    pg_catalog.format(
      '%I.%I.%I',
      policies.schemaname,
      policies.tablename,
      policies.policyname
    ),
    pg_catalog.jsonb_build_object(
      'schema', policies.schemaname,
      'table', policies.tablename,
      'policy', policies.policyname,
      'permissive', policies.permissive,
      'roles', policies.roles,
      'command', policies.cmd,
      'usingExpression', policies.qual,
      'checkExpression', policies.with_check
    )
  FROM pg_catalog.pg_policies AS policies
  WHERE (policies.schemaname, policies.tablename) IN (
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )

  UNION ALL

  -- Explicit table grants for browser and backend roles.
  SELECT
    'table_grants'::text,
    pg_catalog.format(
      '%I.%I:%s:%s',
      grants.table_schema,
      grants.table_name,
      grants.grantee,
      grants.privilege_type
    ),
    pg_catalog.jsonb_build_object(
      'schema', grants.table_schema,
      'table', grants.table_name,
      'grantee', grants.grantee,
      'privilege', grants.privilege_type,
      'grantable', grants.is_grantable
    )
  FROM information_schema.role_table_grants AS grants
  WHERE (grants.table_schema, grants.table_name) IN (
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )
    AND grants.grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')

  UNION ALL

  -- Explicit column grants for browser and backend roles.
  SELECT
    'column_grants'::text,
    pg_catalog.format(
      '%I.%I.%I:%s:%s',
      grants.table_schema,
      grants.table_name,
      grants.column_name,
      grants.grantee,
      grants.privilege_type
    ),
    pg_catalog.jsonb_build_object(
      'schema', grants.table_schema,
      'table', grants.table_name,
      'column', grants.column_name,
      'grantee', grants.grantee,
      'privilege', grants.privilege_type,
      'grantable', grants.is_grantable
    )
  FROM information_schema.role_column_grants AS grants
  WHERE (grants.table_schema, grants.table_name) IN (
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )
    AND grants.grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')

  UNION ALL

  -- Relevant function definitions and security configuration.
  SELECT
    'functions'::text,
    pg_catalog.format(
      '%I.%I(%s)',
      namespaces.nspname,
      procedures.proname,
      pg_catalog.pg_get_function_identity_arguments(procedures.oid)
    ),
    pg_catalog.jsonb_build_object(
      'schema', namespaces.nspname,
      'function', procedures.proname,
      'identityArguments', pg_catalog.pg_get_function_identity_arguments(procedures.oid),
      'resultType', pg_catalog.pg_get_function_result(procedures.oid),
      'ownerRole', pg_catalog.pg_get_userbyid(procedures.proowner),
      'securityDefiner', procedures.prosecdef,
      'configuration', procedures.proconfig,
      'definition', pg_catalog.pg_get_functiondef(procedures.oid)
    )
  FROM pg_catalog.pg_proc AS procedures
  JOIN pg_catalog.pg_namespace AS namespaces
    ON namespaces.oid = procedures.pronamespace
  WHERE namespaces.nspname IN ('public', 'private')
    AND procedures.proname IN (
      'get_enrolled_course_video',
      'rls_auto_enable',
      'set_updated_at',
      'update_updated_at_column'
    )

  UNION ALL

  -- Relevant function EXECUTE privileges.
  SELECT
    'function_privileges'::text,
    pg_catalog.format(
      '%I.%I:%s:%s',
      grants.routine_schema,
      grants.specific_name,
      grants.grantee,
      grants.privilege_type
    ),
    pg_catalog.jsonb_build_object(
      'schema', grants.routine_schema,
      'routine', grants.routine_name,
      'specificName', grants.specific_name,
      'grantee', grants.grantee,
      'privilege', grants.privilege_type,
      'grantable', grants.is_grantable
    )
  FROM information_schema.role_routine_grants AS grants
  WHERE grants.routine_schema IN ('public', 'private')
    AND grants.routine_name IN (
      'get_enrolled_course_video',
      'rls_auto_enable',
      'set_updated_at',
      'update_updated_at_column'
    )
    AND grants.grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')

  UNION ALL

  -- Triggers on required access tables (definitions only).
  SELECT
    'triggers'::text,
    pg_catalog.format(
      '%I.%I.%I:%s',
      triggers.event_object_schema,
      triggers.event_object_table,
      triggers.trigger_name,
      triggers.event_manipulation
    ),
    pg_catalog.jsonb_build_object(
      'schema', triggers.event_object_schema,
      'table', triggers.event_object_table,
      'trigger', triggers.trigger_name,
      'timing', triggers.action_timing,
      'event', triggers.event_manipulation,
      'statement', triggers.action_statement
    )
  FROM information_schema.triggers AS triggers
  WHERE (triggers.event_object_schema, triggers.event_object_table) IN (
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )

  UNION ALL

  -- Planner estimates only; no application records or identities are read.
  SELECT
    'estimated_row_counts'::text,
    pg_catalog.format('%I.%I', namespaces.nspname, classes.relname),
    pg_catalog.jsonb_build_object(
      'schema', namespaces.nspname,
      'table', classes.relname,
      'estimatedRows', classes.reltuples::bigint
    )
  FROM pg_catalog.pg_class AS classes
  JOIN pg_catalog.pg_namespace AS namespaces
    ON namespaces.oid = classes.relnamespace
  WHERE (namespaces.nspname, classes.relname) IN (
    ('public', 'courses'),
    ('public', 'labs'),
    ('public', 'orders'),
    ('public', 'enrollments'),
    ('public', 'lab_rentals'),
    ('private', 'lab_provisioning'),
    ('private', 'access_audit_events')
  )
)
SELECT
  findings.section,
  findings.object_name,
  findings.details
FROM findings
ORDER BY
  CASE findings.section
    WHEN 'relations' THEN 1
    WHEN 'columns' THEN 2
    WHEN 'constraints' THEN 3
    WHEN 'indexes' THEN 4
    WHEN 'policies' THEN 5
    WHEN 'table_grants' THEN 6
    WHEN 'column_grants' THEN 7
    WHEN 'functions' THEN 8
    WHEN 'function_privileges' THEN 9
    WHEN 'triggers' THEN 10
    WHEN 'estimated_row_counts' THEN 11
    ELSE 99
  END,
  findings.object_name;
