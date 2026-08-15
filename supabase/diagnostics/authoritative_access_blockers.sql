-- InfoKB authoritative access migration blocker diagnostic
--
-- COMPLETELY READ ONLY. This query returns aggregate values and schema
-- metadata only. It does not return student IDs, course IDs, enrollment IDs,
-- emails, or individual application rows.

WITH duplicate_groups AS (
  SELECT count(*)::bigint AS rows_in_group
  FROM public.enrollments
  WHERE student_id IS NOT NULL
    AND course_id IS NOT NULL
  GROUP BY student_id, course_id
  HAVING count(*) > 1
),
duplicate_summary AS (
  SELECT
    count(*)::bigint AS duplicate_group_count,
    COALESCE(sum(rows_in_group), 0)::bigint AS duplicate_rows_involved,
    COALESCE(max(rows_in_group), 0)::bigint AS maximum_rows_in_one_group
  FROM duplicate_groups
),
timestamp_summary AS (
  SELECT
    count(enrolled_at)::bigint AS non_null_count,
    count(*) FILTER (WHERE enrolled_at IS NULL)::bigint AS null_count,
    min(enrolled_at) AS minimum_enrolled_at,
    max(enrolled_at) AS maximum_enrolled_at
  FROM public.enrollments
),
enrolled_at_type AS (
  SELECT
    columns.data_type,
    columns.udt_schema,
    columns.udt_name
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'enrollments'
    AND columns.column_name = 'enrolled_at'
),
timezone_metadata AS (
  SELECT
    current_setting('TimeZone') AS session_timezone,
    COALESCE(database_config.timezone, settings.reset_val) AS effective_database_timezone,
    settings.reset_val AS reset_database_timezone,
    CASE
      WHEN database_config.timezone IS NOT NULL THEN 'database configuration'
      ELSE settings.source
    END AS timezone_source
  FROM pg_catalog.pg_settings AS settings
  LEFT JOIN LATERAL (
    SELECT split_part(config_entries.config, '=', 2) AS timezone
    FROM pg_catalog.pg_db_role_setting AS role_settings
    JOIN pg_catalog.pg_database AS databases
      ON databases.oid = role_settings.setdatabase
    CROSS JOIN LATERAL unnest(role_settings.setconfig) AS config_entries(config)
    WHERE databases.datname = current_database()
      AND role_settings.setrole = 0
      AND lower(config_entries.config) LIKE 'timezone=%'
    LIMIT 1
  ) AS database_config ON true
  WHERE settings.name = 'TimeZone'
),
enrollment_indexes AS (
  SELECT
    indexes.indexrelid,
    index_classes.relname AS index_name,
    indexes.indisunique AS is_unique,
    indexes.indisprimary AS is_primary,
    indexes.indisvalid AS is_valid,
    indexes.indisready AS is_ready,
    pg_catalog.pg_get_indexdef(indexes.indexrelid) AS definition,
    ARRAY(
      SELECT attributes.attname
      FROM unnest(indexes.indkey::smallint[]) WITH ORDINALITY AS keys(attnum, position)
      JOIN pg_catalog.pg_attribute AS attributes
        ON attributes.attrelid = indexes.indrelid
       AND attributes.attnum = keys.attnum
      WHERE keys.attnum > 0
      ORDER BY keys.position
    ) AS indexed_columns
  FROM pg_catalog.pg_index AS indexes
  JOIN pg_catalog.pg_class AS index_classes
    ON index_classes.oid = indexes.indexrelid
  WHERE indexes.indrelid = 'public.enrollments'::regclass
),
unique_pair_summary AS (
  SELECT
    EXISTS (
      SELECT 1
      FROM enrollment_indexes
      WHERE is_unique
        AND indexed_columns = ARRAY['student_id', 'course_id']::name[]
    ) AS exact_unique_student_course_index_exists
),
findings AS (
  SELECT
    'enrollment_duplicates'::text AS section,
    'duplicate_summary'::text AS metric,
    jsonb_build_object(
      'duplicateNonNullStudentCourseGroups', duplicate_summary.duplicate_group_count,
      'totalRowsInDuplicateGroups', duplicate_summary.duplicate_rows_involved,
      'maximumRowsInOneDuplicateGroup', duplicate_summary.maximum_rows_in_one_group
    ) AS details
  FROM duplicate_summary

  UNION ALL

  SELECT
    'enrollment_timestamps',
    'timezone_and_type',
    jsonb_build_object(
      'currentDatabaseTimezone', timezone_metadata.effective_database_timezone,
      'databaseTimezoneResetValue', timezone_metadata.reset_database_timezone,
      'databaseTimezoneSource', timezone_metadata.timezone_source,
      'currentSessionTimezone', timezone_metadata.session_timezone,
      'enrolledAtDataType', enrolled_at_type.data_type,
      'enrolledAtUdtSchema', enrolled_at_type.udt_schema,
      'enrolledAtUdtName', enrolled_at_type.udt_name
    )
  FROM timezone_metadata
  CROSS JOIN enrolled_at_type

  UNION ALL

  SELECT
    'enrollment_timestamps',
    'aggregate_range',
    jsonb_build_object(
      'nonNullCount', timestamp_summary.non_null_count,
      'nullCount', timestamp_summary.null_count,
      'minimumEnrolledAt', timestamp_summary.minimum_enrolled_at,
      'maximumEnrolledAt', timestamp_summary.maximum_enrolled_at
    )
  FROM timestamp_summary

  UNION ALL

  SELECT
    'enrollment_uniqueness',
    'student_course_unique_constraint_or_index',
    jsonb_build_object(
      'exactUniqueStudentCourseConstraintOrIndexExists',
      unique_pair_summary.exact_unique_student_course_index_exists
    )
  FROM unique_pair_summary

  UNION ALL

  SELECT
    'enrollment_constraints',
    constraints.conname,
    jsonb_build_object(
      'constraintName', constraints.conname,
      'constraintType', CASE constraints.contype
        WHEN 'p' THEN 'primary key'
        WHEN 'f' THEN 'foreign key'
        WHEN 'u' THEN 'unique'
        WHEN 'c' THEN 'check'
        WHEN 'x' THEN 'exclusion'
        ELSE constraints.contype::text
      END,
      'validated', constraints.convalidated,
      'definition', pg_catalog.pg_get_constraintdef(constraints.oid, true)
    )
  FROM pg_catalog.pg_constraint AS constraints
  WHERE constraints.conrelid = 'public.enrollments'::regclass

  UNION ALL

  SELECT
    'enrollment_indexes',
    enrollment_indexes.index_name,
    jsonb_build_object(
      'indexName', enrollment_indexes.index_name,
      'unique', enrollment_indexes.is_unique,
      'primary', enrollment_indexes.is_primary,
      'valid', enrollment_indexes.is_valid,
      'ready', enrollment_indexes.is_ready,
      'indexedColumns', enrollment_indexes.indexed_columns,
      'definition', enrollment_indexes.definition
    )
  FROM enrollment_indexes
)
SELECT
  findings.section,
  findings.metric,
  findings.details
FROM findings
ORDER BY
  CASE findings.section
    WHEN 'enrollment_duplicates' THEN 1
    WHEN 'enrollment_timestamps' THEN 2
    WHEN 'enrollment_uniqueness' THEN 3
    WHEN 'enrollment_constraints' THEN 4
    WHEN 'enrollment_indexes' THEN 5
    ELSE 99
  END,
  findings.metric;
