FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src src
RUN --mount=type=cache,target=/root/.m2/repository \
    --mount=type=secret,id=maven_settings,target=/root/.m2/settings.xml \
    --mount=type=secret,id=java_truststore,target=/tmp/java-cacerts \
    if [ -f /tmp/java-cacerts ]; then mvn -Djavax.net.ssl.trustStore=/tmp/java-cacerts -B -DskipTests package; else mvn -B -DskipTests package; fi
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 app
COPY --from=build /build/target/societycart-0.1.0.jar app.jar
COPY --chmod=0444 healthcheck.sh /app/healthcheck.sh
USER app
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
