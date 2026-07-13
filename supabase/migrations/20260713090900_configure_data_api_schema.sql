-- Keep PostgREST aligned with the dedicated application schema.
-- This role setting is the authoritative fallback when Dashboard updates fail.
alter role authenticator set pgrst.db_schemas = 'signalpatch';

notify pgrst, 'reload config';
