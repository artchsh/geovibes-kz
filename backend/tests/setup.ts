process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/geovibes";
process.env.AUTH_SECRET ??= "development-only-auth-secret-with-at-least-32-characters";
process.env.APP_ORIGIN ??= "http://localhost:3001";
process.env.MOBILE_ORIGINS ??= "geovibes://,http://localhost:8081";
