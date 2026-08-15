-- Consolidated read-only check for the failed free-Lab migration.
-- Run as one query before retrying the corrected migration.
WITH roles(role_name) AS (
  VALUES ('anon'::name), ('authenticated'::name), ('service_role'::name)
),
relations(schema_name, relation_name) AS (
  VALUES
    ('public'::name, 'labs'::name),
    ('public'::name, 'lab_rentals'::name),
    ('private'::name, 'lab_launch_configurations'::name)
),
columns AS (
  SELECT
    attrs.table_schema,
    attrs.table_name,
    attrs.column_name,
    roles.role_name,
    pg_catalog.has_column_privilege(
      roles.role_name,
      pg_catalog.format('%I.%I', attrs.table_schema, attrs.table_name),
      attrs.column_name,
      'SELECT'
    ) AS can_select,
    pg_catalog.has_column_privilege(
      roles.role_name,
      pg_catalog.format('%I.%I', attrs.table_schema, attrs.table_name),
      attrs.column_name,
      'INSERT'
    ) AS can_insert,
    pg_catalog.has_column_privilege(
      roles.role_name,
      pg_catalog.format('%I.%I', attrs.table_schema, attrs.table_name),
      attrs.column_name,
      'UPDATE'
    ) AS can_update,
    pg_catalog.has_column_privilege(
      roles.role_name,
      pg_catalog.format('%I.%I', attrs.table_schema, attrs.table_name),
      attrs.column_name,
      'REFERENCES'
    ) AS can_reference
  FROM information_schema.columns AS attrs
  JOIN relations
    ON relations.schema_name = attrs.table_schema
   AND relations.relation_name = attrs.table_name
  CROSS JOIN roles
),
table_privileges AS (
  SELECT
    relations.schema_name,
    relations.relation_name,
    roles.role_name,
    privileges.privilege,
    CASE WHEN pg_catalog.to_regclass(
      pg_catalog.format('%I.%I', relations.schema_name, relations.relation_name)
    ) IS NULL THEN NULL ELSE pg_catalog.has_table_privilege(
      roles.role_name,
      pg_catalog.format('%I.%I', relations.schema_name, relations.relation_name),
      privileges.privilege
    ) END AS allowed
  FROM relations
  CROSS JOIN roles
  CROSS JOIN (VALUES
    ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
    ('TRIGGER'), ('REFERENCES')
  ) AS privileges(privilege)
),
constraints AS (
  SELECT
    constraints.conname,
    pg_catalog.pg_get_constraintdef(constraints.oid, true) AS definition
  FROM pg_catalog.pg_constraint AS constraints
  WHERE constraints.conrelid = 'public.lab_rentals'::regclass
),
indexes AS (
  SELECT indexes.indexname, indexes.indexdef
  FROM pg_catalog.pg_indexes AS indexes
  WHERE indexes.schemaname = 'public'
    AND indexes.tablename = 'lab_rentals'
),
policies AS (
  SELECT policyname, roles, cmd, qual, with_check
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public' AND tablename IN ('labs', 'lab_rentals')
),
functions AS (
  SELECT
    signatures.signature,
    pg_catalog.to_regprocedure(signatures.signature) IS NOT NULL AS exists,
    CASE WHEN pg_catalog.to_regprocedure(signatures.signature) IS NULL THEN NULL
      ELSE pg_catalog.has_function_privilege('anon', signatures.signature, 'EXECUTE') END AS anon_execute,
    CASE WHEN pg_catalog.to_regprocedure(signatures.signature) IS NULL THEN NULL
      ELSE pg_catalog.has_function_privilege('authenticated', signatures.signature, 'EXECUTE') END AS authenticated_execute,
    CASE WHEN pg_catalog.to_regprocedure(signatures.signature) IS NULL THEN NULL
      ELSE pg_catalog.has_function_privilege('service_role', signatures.signature, 'EXECUTE') END AS service_role_execute
  FROM (VALUES
    ('public.claim_free_lab_rental(uuid,uuid)'),
    ('public.admin_set_lab_launch_configuration(uuid,text,text)'),
    ('public.get_authorized_lab_launch(uuid,uuid)'),
    ('public.admin_assign_lab_rental(uuid,uuid,timestamptz,timestamptz)'),
    ('public.admin_update_lab_rental(uuid,text,timestamptz,timestamptz)'),
    ('public.get_enrolled_course_video(uuid)')
  ) AS signatures(signature)
)
SELECT pg_catalog.jsonb_build_object(
  'rollback_objects', pg_catalog.jsonb_build_object(
    'launch_table_exists', pg_catalog.to_regclass('private.lab_launch_configurations') IS NOT NULL,
    'full_unique_index_exists', pg_catalog.to_regclass('public.lab_rentals_user_lab_unique_idx') IS NOT NULL,
    'claim_rpc_exists', pg_catalog.to_regprocedure('public.claim_free_lab_rental(uuid,uuid)') IS NOT NULL,
    'set_launch_rpc_exists', pg_catalog.to_regprocedure('public.admin_set_lab_launch_configuration(uuid,text,text)') IS NOT NULL,
    'launch_rpc_exists', pg_catalog.to_regprocedure('public.get_authorized_lab_launch(uuid,uuid)') IS NOT NULL
  ),
  'constraints', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.conname) FROM constraints AS item), '[]'::jsonb),
  'indexes', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.indexname) FROM indexes AS item), '[]'::jsonb),
  'policies', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.policyname) FROM policies AS item), '[]'::jsonb),
  'table_privileges', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.relation_name, item.role_name, item.privilege) FROM table_privileges AS item), '[]'::jsonb),
  'column_privileges', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.table_schema, item.table_name, item.column_name, item.role_name) FROM columns AS item), '[]'::jsonb),
  'functions', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.signature) FROM functions AS item), '[]'::jsonb)
) AS free_lab_failed_migration_rollback_and_privileges;
