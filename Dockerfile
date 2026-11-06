# syntax=docker/dockerfile:1
# --- Stage 1: build the jar. Maven 3.9.16 and JDK 25 come with the base image.
FROM maven:3.9.16-eclipse-temurin-25-noble AS builder

WORKDIR /home/app

# Copy pom.xml and package files first, and download dependencies in their own layer. They
# rarely change, so Docker reuses these layers (and the cache mounts below keep the downloads on
# the build host even when pom.xml changes). Issue #157: the retry count lets a throttled request
# (HTTP 429 from Maven Central) wait out Retry-After rather than fail the build.
COPY pom.xml .
COPY .mvn .mvn

RUN --mount=id=156-base-mvn,type=cache,target=/root/.m2/repository mvn dependency:go-offline -B -Pproduction -Daether.connector.http.retryHandler.count=10 --no-transfer-progress

COPY frontend/package-lock.json frontend/package.json frontend/

# Install node and the npm packages in their own layer (calls the two executions that the pom's
# production profile names).
RUN --mount=id=156-base-mvn,type=cache,target=/root/.m2/repository --mount=id=156-base-npm,type=cache,target=/root/.npm mvn -Pproduction com.github.eirslett:frontend-maven-plugin:install-node-and-npm@install-node-and-npm com.github.eirslett:frontend-maven-plugin:npm@npm-install -B -Daether.connector.http.retryHandler.count=10 --no-transfer-progress

# Now the source. Only this layer and the next re-run when code changes.
COPY . .

# No "clean" here: it would delete target/, where the layer above put node.
RUN --mount=id=156-base-mvn,type=cache,target=/root/.m2/repository mvn -Pproduction -DskipTests -Dcache.use=true -Dgcf.skip=true package -B -Daether.connector.http.retryHandler.count=10 --no-transfer-progress

# --- Stage 2: the image that runs. JRE only; bash is needed by startup.sh.
FROM eclipse-temurin:25-jre-alpine

# Pacific time is the app's time zone (issue #293); startup.sh also passes -Duser.timezone to the JVM
ENV TZ=America/Los_Angeles

WORKDIR /app

RUN apk add bash curl

COPY --from=builder /home/app/startup.sh .

COPY --from=builder /home/app/target/taapply-0.0.1.jar .

ENTRYPOINT ["./startup.sh", "taapply-0.0.1.jar"]
