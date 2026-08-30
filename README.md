# taapply

## Setup before running

Before running the application for the first time, configure your OAuth credentials:

```
cp .env.SAMPLE .env
```

Then fill in the values in `.env`:

| Variable | Description | Setup Guide |
|----------|-------------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | [`docs/oauth.md`](docs/oauth.md) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | [`docs/oauth.md`](docs/oauth.md) |
| `ADMIN_EMAILS` | Comma-separated admin email addresses | [`docs/oauth.md`](docs/oauth.md) |

See [`docs/oauth.md`](docs/oauth.md) for full setup instructions, including Dokku deployment.

This app also uses MongoDB, in addition to PostgreSQL, to store BibTeX
bibliography entries. On localhost, and for tests, an embedded in-memory
MongoDB instance is used automatically, so no setup is required. See
[`docs/mongodb.md`](docs/mongodb.md) for details, including Dokku deployment.

## Getting started on localhost

Open two terminal windows:

```bash
# Terminal 1 – backend
mvn spring-boot:run
```

```bash
# Terminal 2 – frontend
cd frontend
npm install   # first time only
npm start
```

The app is available at <http://localhost:8080>. Use port **8080** (not 3000) so that Google OAuth redirects work correctly.

## Running tests

### Unit and controller tests

```bash
mvn test
```

### Integration tests (Playwright + WireMock)

Integration tests start a real Spring Boot server on port 8080, mock Google OAuth via WireMock
on port 8090, and drive a headless Chromium browser with Playwright.

**Prerequisites:**

1. Install Playwright browsers (one-time setup):
   ```bash
   mvn test-compile exec:java -e \
     -Dexec.mainClass=com.microsoft.playwright.CLI \
     -Dexec.classpathScope=test \
     -Dexec.args="install chromium"
   ```

2. Run with the integration flag:
   ```bash
   INTEGRATION=true mvn -ntp -B test-compile failsafe:integration-test failsafe:verify
   ```

   To run with a visible browser (useful for debugging):
   ```bash
   INTEGRATION=true HEADLESS=false mvn -ntp -B test-compile failsafe:integration-test failsafe:verify
   ```

The integration tests are in `src/test/java/edu/ucsb/cs/taapply/web/`:

| Test class | What it verifies |
|---|---|
| `OauthWebIT` | User can log in and log out via mock OAuth |
| `HomePageWebIT` | After login, the placeholder home page is visible |
| `SwaggerWebIT` | The Swagger UI page loads correctly |

#### Wiremock development mode

To run the full app with WireMock replacing Google OAuth (useful for local frontend development
without real Google credentials):

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=wiremock
```

The app starts with a pre-configured admin user (`admingaucho@ucsb.edu`). Navigate to
<http://localhost:8080> and use the mock login page at <http://localhost:8090/oauth/authorize>.

## Local H2 Console (development profile)

When running locally with:

```bash
mvn spring-boot:run
```

the H2 console is available at:

- `http://localhost:8080/h2-console`

Use these login values:

- **JDBC URL:** `jdbc:h2:file:./target/db-development`
- **Username:** `sa`
- **Password:** *(leave blank)*

## Database Migrations (Liquibase)

This project uses Liquibase for schema management and data migrations.

- Master changelog: `src/main/resources/db/migration/changelog-master.json`
- Individual migrations: `src/main/resources/db/migration/changes/*.json`

### How it runs

- **Development:** runs automatically on app startup against the development datasource.
- **Test:** runs automatically before tests against the test datasource.
- **Production:** runs automatically on app startup against PostgreSQL.

Spring is configured with:

- `spring.jpa.hibernate.ddl-auto=none`
- `spring.liquibase.change-log=db/migration/changelog-master.json`

### Adding a new migration

1. Add a new JSON changelog file in `src/main/resources/db/migration/changes/`.
2. Use an incremental numeric prefix (for example `004-...json`).
3. Prefer preconditions (`onFail: MARK_RAN`) for compatibility with partially migrated environments.
4. Start the app or run tests to validate the migration.

### Troubleshooting migrations

#### Check migration history

- Inspect Liquibase tracking tables in your database:
	- `DATABASECHANGELOG`
	- `DATABASECHANGELOGLOCK`

In local development, you can view these tables from the H2 console.

#### Reset local H2 and rerun from scratch

For the development profile, the local H2 file lives under `target/`.

Use the helper script:

```bash
./scripts/reset-local-h2.sh
```

To reset and immediately start the app:

```bash
./scripts/reset-local-h2.sh --run
```

Manual equivalent:

1. Stop the app.
2. Delete local H2 files:
- `target/db-development.mv.db`
- `target/db-development.trace.db` (if present)
3. Start the app again with `mvn spring-boot:run`.

Liquibase will recreate the schema and reapply migrations.

#### Common failure patterns

- **Checksum mismatch:** if a previously applied changelog file was edited, Liquibase will fail validation. Preferred fix is to add a new migration file instead of modifying an already-applied one.
- **Partially migrated environment:** use strong preconditions with `onFail: MARK_RAN` in migration files so old/new states can both be handled safely.
- **Locked changelog:** if `DATABASECHANGELOGLOCK` is stuck after an interrupted run, clear the lock row in your local/dev database and restart.
