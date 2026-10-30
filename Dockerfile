FROM ubuntu:22.04

# Set environment variables to avoid interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update 
RUN apt-get install -y openjdk-25-jdk  
RUN apt-get install -y  curl  
RUN apt-get install -y  bash  
RUN apt-get install -y  python3 
RUN apt-get clean
RUN rm -rf /var/lib/apt/lists/*

# Set JAVA_HOME environment variable
ENV JAVA_HOME=/usr/lib/jvm/java-25-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

# Maven: a pinned upstream release rather than Ubuntu 22.04's package (3.6.3), whose bundled
# Guava calls sun.misc.Unsafe and so makes JDK 25 print a deprecation warning at every build
# (issue #155). 3.9.16 ships Guava 33.6.0, which does not. The checksum is Maven Central's.
ENV MAVEN_VERSION=3.9.16
ENV MAVEN_SHA512=831a8591fe20c8243b1dbe7d71e3244f31d1665b0804b2e825e38cbbe5ce0cafb8338851f90780735568773e0a6cd07bbec107cda0b896b008b861075358b6f6
RUN curl -fsSL -o /tmp/maven.tar.gz "https://repo1.maven.org/maven2/org/apache/maven/apache-maven/${MAVEN_VERSION}/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
    && echo "${MAVEN_SHA512}  /tmp/maven.tar.gz" | sha512sum -c - \
    && mkdir -p /opt/maven \
    && tar -xzf /tmp/maven.tar.gz -C /opt/maven --strip-components=1 \
    && rm /tmp/maven.tar.gz
ENV MAVEN_HOME=/opt/maven
ENV PATH="$MAVEN_HOME/bin:$PATH"
RUN mvn -v

# Verify installation
RUN java -version

WORKDIR /app

# Verify installation
RUN java -version
RUN curl --version

ENV NODE_VERSION=24.21.0
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

RUN . "$NVM_DIR/nvm.sh" && nvm --version
RUN node --version
RUN npm --version

# Issue #157: the Dokku host built every image from an empty ~/.m2, and a busy day of deploys
# got the host rate-limited by Maven Central (HTTP 429). So the dependencies are fetched in a
# layer of their own, from the pom alone, before the rest of the source is copied in: Docker
# keeps that layer between builds until pom.xml changes, so a rebuild re-downloads nothing. The
# retry count lets a throttled request wait out Central's Retry-After (Maven 3.9's resolver
# retries 429 and 503) rather than fail the build.
COPY pom.xml /home/app/pom.xml
COPY .mvn /home/app/.mvn
RUN mvn --no-transfer-progress -B -Pproduction \
    -Daether.connector.http.retryHandler.count=10 \
    -f /home/app/pom.xml dependency:go-offline

COPY . /home/app

RUN mvn --no-transfer-progress -B -Pproduction -DskipTests \
    -Daether.connector.http.retryHandler.count=10 \
    -f /home/app/pom.xml clean package

RUN ["chmod", "+x", "/home/app/startup.sh"]
ENTRYPOINT ["/home/app/startup.sh","/home/app/target/taapply-0.0.1.jar"]
