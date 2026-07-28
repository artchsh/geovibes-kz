process.env.TEST_DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/geovibes_test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AUTH_SECRET ??= "development-only-auth-secret-with-at-least-32-characters";
process.env.APP_ORIGIN ??= "http://localhost:3001";
process.env.MOBILE_ORIGINS ??= "geovibes://,http://localhost:8081";
process.env.TRUSTED_PROXY_SECRET ??= "test-trusted-proxy-secret-at-least-32-characters";
