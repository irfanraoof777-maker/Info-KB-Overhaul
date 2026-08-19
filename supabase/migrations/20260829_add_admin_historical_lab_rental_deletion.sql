BEGIN;

ALTER TABLE public.lab_rentals
  ADD COLUMN IF NOT EXISTS admin_history_hidden_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_hide_historical_lab_rental(p_rental_id uuid)
RETURNS public.lab_rentals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_rental public.lab_rentals;
  hidden_rental public.lab_rentals;
BEGIN
  IF p_rental_id IS NULL THEN
    RAISE EXCEPTION 'Lab rental ID is required';
  END IF;

  SELECT rental_row.* INTO current_rental
  FROM public.lab_rentals AS rental_row
  WHERE rental_row.id = p_rental_id
  FOR UPDATE;

  IF current_rental.id IS NULL THEN
    RAISE EXCEPTION 'Lab rental not found';
  END IF;

  -- A Ready rental is historical once it has no remaining access window.
  IF current_rental.state NOT IN ('cancelled', 'expired')
     AND NOT (
       current_rental.state = 'ready'
       AND (current_rental.expires_at IS NULL OR current_rental.expires_at <= pg_catalog.now())
     ) THEN
    RAISE EXCEPTION 'Only cancelled or expired Lab rentals can be removed from Admin History';
  END IF;

  UPDATE public.lab_rentals AS rental_row
  SET admin_history_hidden_at = pg_catalog.now()
  WHERE rental_row.id = p_rental_id
  RETURNING rental_row.* INTO hidden_rental;

  RETURN hidden_rental;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_hide_historical_lab_rental(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hide_historical_lab_rental(uuid) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';