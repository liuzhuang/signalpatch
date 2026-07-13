-- The exposed-schema configuration and schema cache reload independently.
-- Reload the cache after signalpatch becomes an exposed PostgREST schema.
notify pgrst, 'reload schema';
