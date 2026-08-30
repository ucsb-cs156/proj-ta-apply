# Iteration 1: Bootstrap the app with Google OAuth, three roles, and bulk grad-student email upload

## Summary

`proj-ta-apply` is currently an empty repo containing only `docs/design/InitialDesign.md`. This
issue covers the entire first iteration from `docs/design/InitialDesign.md`:

1. Stand up a Spring Boot + React app following UCSB CS156 conventions.
2. Login with Google OAuth.
3. Three roles beyond plain user: **Admin**, **Instructor**, **Grad Student**. Admins can grant
   Instructor or Grad Student status by entering an email address.
4. **New feature not present in any existing app:** an admin can upload a file of email addresses
   and have every one of them inserted into the grad students table.

Iterations 2–4 (UCSB course data, caching, TA/ULA applications) are explicitly **out of scope**.

---

## Decisions already made

These were settled before writing this issue. Do not re-litigate them; if one turns out to be
unworkable, say so in the PR rather than silently changing course.

| Decision | Choice |
| --- | --- |
| Base skeleton | **`proj-citelines`** |
| Role model | **Independent roles, no auto-grant.** A user may hold any combination of Admin / Instructor / Grad Student. No `RoleHierarchy` bean. Admin does *not* inherit `ROLE_GRAD_STUDENT`. |
| Upload file format | **CSV with an `email` header**, parsed with opencsv, matching the existing `validateHeaders()` convention |
| Databases | **Wire up both Postgres/H2 and MongoDB now**, even though iteration 1 stores nothing in Mongo |
| Undergraduates | **No fourth role.** Undergrads are plain `ROLE_USER`; that is what will gate ULA applications in iteration 4. No migration needed later. |

### Note for iteration 4: `ROLE_USER` does not mean "undergrad" on its own

Undergrads are plain `ROLE_USER`, but because `ROLE_USER` is granted **unconditionally** to every
authenticated user (the fix for the admin-403 trap below), admins, instructors, and grad students all
carry it too. So iteration 4 cannot gate the ULA application on `hasRole('ROLE_USER')` alone — that
would offer the ULA form to grad students, who should be seeing the TA form instead.

The correct reading of the design doc is that the two applications are distinguished by grad-student
status:

- **TA application** → `hasRole('ROLE_GRAD_STUDENT')`
- **ULA application** → authenticated **and not** `ROLE_GRAD_STUDENT`

Nothing in iteration 1 depends on this; it is recorded here so the role model is not mistakenly
"fixed" later by adding an `Undergrad` table.

### Why `proj-citelines` is the base

It is the newest lineage and already has almost exactly the shape needed: `Admin` plus **one**
extra email-keyed role (`Researcher`), implemented with *generic, reusable* frontend components
(`RoleEmailForm.tsx`, `RoleEmailTable.tsx`) that take the endpoint as a prop. Adding Instructor and
Grad Student is largely a matter of instantiating the Researcher slice twice. It also already has
TypeScript + Vite, Liquibase migrations, and both Postgres and MongoDB wired up.

---

## Reference repos

All five were read at these commits on `main` (2026-08-29). Prefer these as the source of truth over
any stale local clone — note that local clones of frontiers and dining were on feature branches.

| Repo | Commit | Role in this issue |
| --- | --- | --- |
| `ucsb-cs156/proj-citelines` | `77db23b` | **Primary skeleton.** Copy from here. |
| `ucsb-cs156/proj-scaffold` | `aa6e755` | Same lineage; source of the `Instructor` naming and the `CourseStaffCSVController` upload pattern |
| `ucsb-cs156/proj-frontiers` | `f4c0582` | Most mature CSV upload controllers (`RosterStudentsCSVController`) |
| `ucsb-cs156/proj-dining` | `362ce75` | **The only repo with the independent (non-hierarchical) multi-role pattern** — follow its `RoleInterceptor` and its unconditional `ROLE_USER` grant |
| `ucsb-cs156/proj-courses` | `152cdb5` | UCSB API conventions; relevant to iterations 2–3, not this one |

---

## ⚠️ The one real trap: `ROLE_USER` and the role hierarchy

This is the single most likely way to break the app, so read it before writing any security code.

In citelines/scaffold/frontiers, the roles are **mutually exclusive** and `ROLE_USER` is granted
**only in the `else` branch**:

```java
// citelines GoogleSignInServiceImpl.java — DO NOT COPY THIS SHAPE
if (adminRepository.existsByEmail(email)) {
  authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
} else if (researcherRepository.existsByEmail(email)) {
  authorities.add(new SimpleGrantedAuthority("ROLE_RESEARCHER"));
} else {
  authorities.add(new SimpleGrantedAuthority("ROLE_USER"));   // admins never get this
}
```

An admin therefore has **no** `ROLE_USER`. That works today only because `SecurityConfig` declares a
linear hierarchy that back-fills it:

```java
RoleHierarchyImpl.withDefaultRolePrefix()
    .role("ADMIN").implies("RESEARCHER")
    .role("RESEARCHER").implies("USER")
    .build();
```

`UserInfoController` is annotated `@PreAuthorize("hasRole('ROLE_USER')")`. **If you drop the
hierarchy bean — which this issue requires — without also granting `ROLE_USER` unconditionally,
every admin gets a 403 from `/api/currentUser` and the whole frontend appears logged out.**

`proj-dining` already does this correctly (`SecurityConfig.java:112` adds `ROLE_USER`
unconditionally, and `RoleInterceptor.java` uses independent `if`s with no hierarchy). Follow dining
for the role plumbing and citelines for everything else.

### Required role logic

Every authenticated user gets `ROLE_USER`. Each of the three roles is then added independently:

```java
authorities.add(new SimpleGrantedAuthority("ROLE_USER"));       // always
if (adminEmails.contains(email) || adminRepository.existsByEmail(email)) {
  authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
}
if (instructorRepository.existsByEmail(email)) {
  authorities.add(new SimpleGrantedAuthority("ROLE_INSTRUCTOR"));
}
if (gradStudentRepository.existsByEmail(email)) {
  authorities.add(new SimpleGrantedAuthority("ROLE_GRAD_STUDENT"));
}
```

- No `RoleHierarchy` bean. Delete it from `SecurityConfig`.
- Endpoints that should serve more than one role use
  `@PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_INSTRUCTOR')")`, per dining's `ReviewController`.
- This logic appears in **two** places and they must agree: `GoogleSignInServiceImpl` (at login) and
  `RoleUpdateInterceptor` (on every request, so role changes take effect without re-login). The
  interceptor must strip all three role authorities before re-adding them — extend citelines'
  existing filter to cover `ROLE_INSTRUCTOR` and `ROLE_GRAD_STUDENT` as well as `ROLE_ADMIN`.
- Note citelines' `RoleUpdateInterceptor` checks only the `admins` **table**, while dining also
  honors the `app.admin.emails` property. Use dining's version so the bootstrap admin from
  `ADMIN_EMAILS` keeps working on a fresh database.

---

## Part A — Port the skeleton from `proj-citelines`

Copy the citelines tree, renaming the package `edu.ucsb.cs.citelines` → `edu.ucsb.cs.taapply` and
the app class `CitelinesApplication` → `TaApplyApplication`.

### `pom.xml`

Keep the citelines `pom.xml` essentially as-is, changing:

```xml
<groupId>edu.ucsb.cs</groupId>
<artifactId>taapply</artifactId>
<version>0.0.1</version>
...
<properties>
  <java.version>21</java.version>
  <mainClass>edu.ucsb.cs.taapply.TaApplyApplication</mainClass>
  <app.package>edu.ucsb.cs.taapply</app.package>
  <app.packagePath>edu/ucsb/cs/taapply</app.packagePath>
  <targetClasses>${targetClasses:edu.ucsb.cs.taapply.*}</targetClasses>
  <maven.javadoc.failOnError>false</maven.javadoc.failOnError>
  <app.frontend.nodeVersion>v22.23.1</app.frontend.nodeVersion>
</properties>
```

The `app.package` / `app.packagePath` properties are already threaded through the Jacoco `<excludes>`
and Pitest `<excludedClasses>`, so renaming them there is mostly automatic. Update the
`CitelinesApplication*` Jacoco exclude to `TaApplyApplication*` (the trailing `*` rather than `.*`
is deliberate — it also excludes anonymous inner classes).

Keep the three Maven profiles unchanged in structure: `localhost` → `development`, `integration` →
`integration`, `production` → `production`, each setting `<springProfiles>`, which
`application.properties` picks up via the `@springProfiles@` placeholder.

Retain these dependencies: `spring-boot-starter-{data-jpa,oauth2-client,security,web}`,
`spring-boot-starter-data-mongodb`, `de.flapdoodle.embed.mongo.spring3x` 4.24.0, `liquibase-core`,
`postgresql`, `h2`, `spring-dotenv` 4.0.0, `lombok`, springdoc/Swagger.

**Add `opencsv`** — needed for Part C. Citelines has no CSV upload and therefore no such dependency;
take the coordinates from scaffold:

```xml
<dependency>
  <groupId>com.opencsv</groupId>
  <artifactId>opencsv</artifactId>
  <version>5.7.1</version>
</dependency>
```

Drop `jsoup` and `commons-io` unless something ends up needing them.

`lib-jobs` (`com.github.ucsb-cs156:lib-jobs:v0.3.3`, via the JitPack repository) is used by the
citelines jobs UI. Keep it and keep `JobsController` + the admin Jobs page — iterations 2–3 will
need async jobs for the UCSB API pulls — but port only `TestJob`.

### Backend files to KEEP (rename package only)

```
config/       CorsConfig, MongoConfig, MongoDevConfig, OpenAPIConfig, SecurityConfig, WebConfig
controller/   AdminsController, ApiController, FrontendController, FrontendProxyController,
              HealthController, JobsController, SystemInfoController, UserInfoController
entity/       Admin, User
errors/       EntityNotFoundException, ForbiddenException
interceptors/ RoleUpdateInterceptor
jobs/         TestJob
model/        CurrentUser, SystemInfo
repository/   AdminRepository, UserRepository
services/     ApiRetryHelper, CurrentUserService(+Impl), GoogleSignInService(+Impl),
              GrantedAuthoritiesService, JobUserProviderImpl, SystemInfoService(+Impl),
              wiremock/{WiremockService,WiremockServiceDummy,WiremockServiceImpl}
startup/      ScaffoldApplicationRunner, ScaffoldStartup, WiremockApplicationRunner
utilities/    CanonicalFormConverter, Sleep
```

`CanonicalFormConverter.convertToValidEmail(...)` is used by every role-creation endpoint — keep it
and use it in the new controllers.

### Backend files to DROP (citelines-specific)

```
collections/  all (BibTexEntry, CitationEdge, CitationFilterState, UnresolvedCitation + repositories)
config/       ProjectSecurity, YamlMessageConverterConfig
controller/   BibTexEntriesController, CitationEdgesController, CitationFilterStateController,
              CitationFormatController, ProjectCollaboratorsController, ProjectsController,
              TagsController
              (ResearchersController — do not port as-is; it is the template for Part B)
entity/       Project, ProjectCollaborator, Tag  (Researcher — template for Part B)
errors/       DoiNotFoundException
jobs/         everything except TestJob
repository/   ProjectRepository, ProjectCollaboratorRepository, TagRepository
              (ResearcherRepository — template for Part B)
services/     all BibTex*/Citation*/DOI*/OpenAlex/Crossref/Dblp/SemanticScholar/CheckLinks/
              DuplicateDetection/LaTeXNormalization/ResolvedWork services
```

Since `MongoConfig`/`MongoDevConfig` do `@EnableMongoRepositories("edu.ucsb.cs.taapply.collections")`,
keep an empty `collections/` package (a `package-info.java` is enough) so the annotation resolves and
iteration 3 has a home for cached course documents.

### Frontend files to KEEP

```
src/main/components/Auth/       LoginScreen
src/main/components/Common/     OurTable, OurTableUtils, SortCaret, SortCaretUtils, Icons
src/main/components/Jobs/       JobsTable, SingleButtonJobForm
src/main/components/Nav/        AppNavbar, AppNavbarLocalhost, Footer, GoogleLogin, HelpMenu
src/main/components/Users/      RoleEmailForm, RoleEmailTable, UsersTable
src/main/layouts/BasicLayout/
src/main/pages/Admin/           AdminDeveloperPage, AdminJobsPage, AdminUsersPage,
                                AdminsCreatePage, AdminsIndexPage
src/main/pages/Auth/            AccessDeniedPage, LoadingPage, NotFoundPage, PromptSignInPage,
                                ProtectedPage, SignInPage, SignInSuccessPage
src/main/pages/Help/            (rename AboutCitelines → AboutTaApply)
src/main/pages/Home/            HomePageLoggedIn, HomePageLoggedOut
src/main/utils/                 currentUser.ts, useBackend.ts, systemInfo.ts   (these three only)
```

Drop `components/Citations`, `components/Projects`, `components/Tags`, `pages/Projects`, and their
`tests/` and `stories/` counterparts.

Two easy-to-miss drops inside directories that are otherwise kept:

- `components/Common/ColorChooser.jsx` — citelines-specific; the rest of `Common/` is kept.
- Everything in `main/utils/` except the three named above. Citelines has a dozen citation-specific
  utils there (`citationFilter.js`, `citationFormats.js`, `bibtex`/`doi` helpers, `relevance.js`,
  `colorUtils.js`, etc.) that must not be carried over.

Keep the frontend config files as-is: `vite.config.ts`, `vitest.setup.js`, `eslint.config.js`,
`stryker.config.mjs` (thresholds `high: 80, low: 60, break: 2`), and the three `tsconfig*.json`.

### Other root files

- `Dockerfile` — copy verbatim; change only the final `ENTRYPOINT` jar name to
  `/home/app/target/taapply-0.0.1.jar`.
- `startup.sh` — copy verbatim. Note it reads `DOKKU_POSTGRES_AQUA_URL`; confirm the actual Dokku
  Postgres service name for this app and update (see Open Questions).
- `scripts/reset-local-h2.sh`, `CLAUDE.md` (the Test Plan vs Quality Checks convention),
  `docs/oauth.md`, `docs/mongodb.md`.
- `.github/workflows/` — copy the full set (see Part E).

---

## Part B — The three roles

### Entities and repositories

Model `Instructor` and `GradStudent` exactly on citelines' `Researcher` / scaffold's `Instructor` —
a single-column table keyed by email:

```java
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "instructors")
public class Instructor {
  @Id private String email;
}
```

Same for `GradStudent` with `@Entity(name = "grad_students")`. Each repository needs
`existsByEmail(String)` and `findByEmail(String)` (used by the interceptor and the delete endpoint).

### Liquibase migrations

Citelines' `changelog-master.json` uses `includeAll` over `db/migration/changes/`, so new files are
picked up automatically. Port `001-create-users-table.json` and `002-create-admins-table.json`
unchanged, then add, following the same `preConditions` + `MARK_RAN` shape:

- `003-create-instructors-table.json` — table `instructors`, column `email VARCHAR(255)` PK not null
- `004-create-grad-students-table.json` — table `grad_students`, same shape

Drop **all** of citelines' other changesets — `004`, `005`, `008`, `039`, `040`, `041`, `042`. Those
cover projects/tags/citations plus the one-time migration of a pre-existing `jobs` table onto the
`lib-jobs` schema. A greenfield database needs none of it.

Note that `lib-jobs` ships its own Liquibase changelog **inside the jar**
(`db/migration/lib-jobs/changelog-master.json`, containing `001-create-jobs-table.json` and
`002-job-logs-table.json`), so there is no file to copy. Citelines' `changelog-master.json`
`include`s only `002-job-logs-table.json` because it already had a `jobs` table of its own. For a new
app, simply include the library's master changelog:

```json
{
  "databaseChangeLog": [
    { "includeAll": { "path": "db/migration/changes/" } },
    { "include": { "file": "db/migration/lib-jobs/changelog-master.json" } }
  ]
}
```

Verify on first run that both `jobs` and the job-logs table are created in H2, and drop the
`changes-post-lib-jobs/` directory entirely.

### Controllers

Create `InstructorsController` and `GradStudentsController` modeled on citelines'
`ResearchersController` / scaffold's `InstructorsController`. All endpoints are
`@PreAuthorize("hasRole('ROLE_ADMIN')")`:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/admin/instructors/post?email=` | `CanonicalFormConverter.convertToValidEmail(email).strip()` |
| GET | `/api/admin/instructors/get` | returns all |
| DELETE | `/api/admin/instructors/delete?email=` | 404 if absent |
| POST | `/api/admin/gradstudents/post?email=` | |
| GET | `/api/admin/gradstudents/get` | |
| DELETE | `/api/admin/gradstudents/delete?email=` | |
| POST | `/api/admin/gradstudents/upload/csv` | Part C |

Every endpoint needs `@Operation(summary = ...)` and a class-level `@Tag(...)` so it is documented
and exercisable in Swagger.

### Update `AdminsController`

Its `UserDTO` currently carries `boolean admin, boolean researcher`. Change to
`boolean admin, boolean instructor, boolean gradStudent`, populated from the three repositories, so
`/api/admin/users` shows every role at a glance.

---

## Part C — Bulk grad-student email upload (the new feature)

**Endpoint:** `POST /api/admin/gradstudents/upload/csv`, `consumes = "multipart/form-data"`,
`@PreAuthorize("hasRole('ROLE_ADMIN')")`.

Model it on `proj-scaffold`'s `CourseStaffCSVController` and `proj-frontiers`'
`RosterStudentsCSVController` (opencsv `CSVReader`, `try`-with-resources over a
`BufferedInputStream`, header validation, per-row build-and-save).

**Format:** CSV whose first row is a header containing a column named `email` (case-insensitive).
A single `email` column is the expected shape; extra columns are ignored.

**Required behavior:**

- Empty file → `400` with a clear message (`"CSV file is empty"`), per the scaffold precedent.
- Missing/incorrect `email` header → `400` naming the expected format.
- Each row's email is normalized with `CanonicalFormConverter.convertToValidEmail(...).strip()`
  before insert, so the same normalization as the single-email endpoint applies.
- **Upsert, don't fail on duplicates.** An email already in `grad_students` is a no-op, not an error;
  re-uploading the same file must be safe.
- **Skip and report, don't abort.** A malformed or blank row must not roll back the rows that
  already succeeded.
- Return a JSON summary rather than a bare count, so the UI can tell the admin what happened:
  ```json
  { "inserted": 12, "alreadyPresent": 3, "invalid": 1, "invalidEmails": ["not-an-email"] }
  ```
  (Scaffold's controller returns `Map.of("count", count)`; the richer shape is worth it here since
  the whole point of the feature is bulk entry where individual rows can be wrong.)

**Frontend:** a `GradStudentCSVUploadForm.tsx` modeled on scaffold's `CourseStaffCSVUploadForm.jsx`
(react-hook-form, `<Form.Control type="file" accept=".csv">`, `data-testid` prefix
`GradStudentCSVUploadForm`), rendered on `GradStudentsIndexPage`. On success, toast the summary and
invalidate the `/api/admin/gradstudents/get` query so the table refreshes.

---

## Part D — Frontend wiring

### New pages (mirror citelines' Researchers pages exactly)

- `pages/Admin/InstructorsIndexPage.tsx` — `RoleEmailTable` with
  `getEndpoint="/api/admin/instructors/get"`, `deleteEndpoint="/api/admin/instructors/delete"`,
  `testIdPrefix="InstructorsIndexPage"`; "New Instructor" link to the create page.
- `pages/Admin/InstructorsCreatePage.tsx` — `RoleEmailForm` posting to
  `/api/admin/instructors/post`.
- `pages/Admin/GradStudentsIndexPage.tsx` — same, plus the CSV upload form from Part C.
- `pages/Admin/GradStudentsCreatePage.tsx` — same.

`RoleEmailForm` and `RoleEmailTable` are already generic and take endpoints as props, so **no changes
to those two components should be needed.** `RoleEmailTable`'s `isInAdminEmails` flag suppresses the
delete button for admins pinned via `ADMIN_EMAILS`; it is simply absent (undefined → falsy → delete
button shown) for instructors and grad students, which is correct.

### Routes in `App.tsx`

Add four routes, each wrapped in `<ProtectedPage enforceRole="ROLE_ADMIN" ...>`:
`/admin/instructors`, `/admin/instructors/create`, `/admin/gradstudents`,
`/admin/gradstudents/create`.

### `AppNavbar.tsx`

Change the brand to `TA Apply`. Add "Instructors" and "Grad Students" items to the existing
admin-only `NavDropdown`, beside "Users" / "Admins" / "Jobs" / "Developer Info".

### `UsersTable.tsx`

Replace the `researcher` column with `Instructor` and `Grad Student` boolean columns matching the
updated `UserDTO`.

---

## Part E — CI/CD, config, deployment

### Workflows

Copy the full `.github/workflows/` set from citelines (identical to scaffold's), updating any
hardcoded repo names, Dokku app names, and the jar name:

```
00-all-checks-pass          10-backend-unit             12-backend-jacoco
13-backend-incremental-pitest  14-backend-pitest        15-backend-format
18-validate-db-schema       32-frontend-coverage        33-frontend-pr-mutation-testing
34-frontend-main-mutation-testing  35-frontend-format   36-frontend-eslint
40-check-production-build   41-integration              45-deploy-pr-to-dokku
53-chromatic-main-branch    55-chromatic-pr             56-javadoc-main-branch
58-javadoc-pr               01/02/04-gh-pages-*         82/85-slack-*   96/98/99-issue-label-*
```

`43-deploy-main-to-frontiers-prod.yml` and `44-deploy-main-to-frontiers-qa.yml` are
frontiers/citelines-specific; rename and repoint them (see Open Questions).

### `application.properties`

Copy citelines' file, changing the logging package to `edu.ucsb.cs.taapply`, `app.sourceRepo` to
`https://github.com/ucsb-cs156/proj-ta-apply`, and dropping all the `citelines.api.*` keys. Keep the
`${SYMBOL:${env.SYMBOL:default}}` idiom (env var first, then `.env` via spring-dotenv, then default).
Keep `app.admin.emails` defaulting to `phtcon@ucsb.edu`.

### Profile properties

- `application-development.properties` — H2 file DB at `./target/db-development`, H2 console on,
  `de.flapdoodle.mongodb.embedded.version=7.0.12`.
- `application-integration.properties` — H2 in-memory `jdbc:h2:mem:${random.uuid}`, embedded Mongo,
  the WireMock mock-OAuth provider block on port 8090, `app.admin.emails=admingaucho@ucsb.edu`.
- `application-production.properties` — Postgres from `JDBC_DATABASE_*`, plus
  `spring.data.mongodb.uri=${MONGO_URL:...mongodb://localhost:27017/taapply}`.
- `application-wiremock.properties` — port as-is from citelines.

### Integration / end-to-end tests

Port citelines' `src/test/java/.../web/` Playwright web ITs, keeping `HomePageWebIT`, `OauthWebIT`,
and `SwaggerWebIT`, and dropping the citations-specific ones. Add a web IT covering the admin
granting a grad-student role, if it fits the existing harness without undue effort.

---

## Acceptance criteria

- [ ] `mvn clean verify` passes from a clean checkout with no external Postgres or MongoDB running.
- [ ] `mvn spring-boot:run -Plocalhost` starts the app; H2 console and Swagger UI are reachable.
- [ ] A user can sign in with Google OAuth; `/api/currentUser` returns 200 **for admins as well as
      plain users** (see the `ROLE_USER` trap above).
- [ ] An admin can add and remove Instructors at `/admin/instructors`.
- [ ] An admin can add and remove Grad Students at `/admin/gradstudents`.
- [ ] An admin can upload a CSV of emails and see every one of them appear in the grad students
      table, with a summary of inserted / already-present / invalid rows.
- [ ] A non-admin visiting any `/admin/*` route sees the Access Denied page, and the corresponding
      API calls return 403.
- [ ] A single user can simultaneously hold Instructor and Grad Student roles, and
      `/admin/users` shows `true` in both columns for them.
- [ ] Role changes take effect without logging out and back in (the `RoleUpdateInterceptor` path).
- [ ] Jacoco coverage and Pitest mutation coverage meet the thresholds enforced by workflows 12–14.
- [ ] Frontend coverage and Stryker mutation testing pass workflows 32–34.
- [ ] `npm run check-format`, `npm run lint`, and `mvn spotless:check` (workflow 15) all pass.
- [ ] Swagger UI documents every new endpoint with a summary, and each is exercisable via "Try it out".

## Test plan (manual)

1. Set `ADMIN_EMAILS` to your own email in `.env`; run `mvn spring-boot:run -Plocalhost`.
2. Visit `http://localhost:8080`, sign in with Google. Confirm the navbar shows the **Admin**
   dropdown and that the page does not appear logged out.
3. Admin → Grad Students → **New Grad Student**. Enter `student1@ucsb.edu`. Confirm the toast and the
   new table row.
4. Prepare `grads.csv`:
   ```csv
   email
   student2@ucsb.edu
   student1@ucsb.edu
   not-an-email
   ```
   Upload it on the Grad Students page. Expect a summary reporting 1 inserted, 1 already present,
   1 invalid, and a table containing `student1@` and `student2@` exactly once each.
5. Re-upload the same file. Expect 0 inserted, 2 already present, 1 invalid, and no duplicate rows.
6. Admin → Instructors → add `instructor@ucsb.edu`; confirm it appears.
7. Add your own email as *both* an Instructor and a Grad Student. Visit Admin → Users and confirm
   `Admin`, `Instructor`, and `Grad Student` all read `true` on your row — **without logging out**.
8. Delete a Grad Student; confirm the row disappears.
9. Sign in as a non-admin and visit `/admin/gradstudents` directly. Expect the Access Denied page.

---

## Open questions / things needing a human

These do not block the code but must be resolved before the app is deployable:

1. **Google OAuth credentials** — a new OAuth client ID/secret for this app, with the appropriate
   authorized redirect URIs for localhost, QA, and production.
2. **Dokku app names and hostnames** — needed for the `43-`/`44-` deploy workflows and for
   `45-deploy-pr-to-dokku.yml`.
3. **Dokku Postgres service name** — `startup.sh` currently hardcodes `DOKKU_POSTGRES_AQUA_URL`
   (citelines' service). Confirm the name for this app.
4. **Dokku Mongo service** — `dokku mongo:create` / `mongo:link` to populate `MONGO_URL`
   (`docs/mongodb.md` covers the procedure).
5. **Chromatic project token** — required by workflows `53-` and `55-`.

## Suggested commit / review structure

The scope is large. Consider splitting the PR into reviewable commits along these lines, or into
separate PRs if the reviewer prefers:

1. Skeleton port (Part A) — package rename, pom, config, Docker, workflows, Liquibase `001`/`002`.
2. Roles (Part B) — entities, repositories, migrations, controllers, security plumbing, tests.
3. Frontend role pages (Part D).
4. Bulk CSV upload (Part C), backend and frontend.
