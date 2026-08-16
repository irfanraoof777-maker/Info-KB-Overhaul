import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260821_fix_admin_launch_configuration_ambiguity.sql", "utf8");
const lifecycle = readFileSync("supabase/migrations/20260820_allow_lab_reclaim_after_terminal_rentals.sql", "utf8");

test("admin launch configuration save avoids the rental_id output-column ambiguity", () => {
  assert.match(migration, /RETURNS TABLE \(rental_id uuid, provider text, updated_at timestamptz\)/);
  assert.match(migration, /UPDATE private\.lab_launch_configurations AS configuration_row[\s\S]*WHERE configuration_row\.rental_id = p_rental_id[\s\S]*RETURNING configuration_row\.\* INTO configured/);
  assert.match(migration, /IF NOT FOUND THEN[\s\S]*INSERT INTO private\.lab_launch_configurations AS configuration_insert[\s\S]*RETURNING configuration_insert\.\* INTO configured/);
  assert.doesNotMatch(migration, /ON CONFLICT \(rental_id\)/);
});

test("launch configuration remains required for Ready and terminal rentals remain immutable", () => {
  assert.match(lifecycle, /Ready rental requires launch configuration/);
  assert.match(migration, /current_rental\.state IN \('cancelled', 'expired'\)/);
  assert.match(lifecycle, /Terminal Lab rental cannot be changed/);
});
