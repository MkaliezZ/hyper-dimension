# PostgreSQL CI bootstrap

The integration job requires a healthy PostgreSQL 17 database before running the full Python test suite. It first pulls the Docker Official Image from its ECR Public mirror, then falls back to Docker Hub's official `library/postgres:17` when the first pull fails. Both locations can reject anonymous pulls from shared hosted runners.

This preparation is an explicit workflow step so a registry failure can reach the fallback. A service-container pull happens before workflow steps, which prevented recovery in [run 38782335109](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38782335109), where ECR returned `toomanyrequests: Data limit exceeded`. The test suite never started in that run.

The script waits for the original `pg_isready` health check, prints database diagnostics on failure, and exits with a failure if both pulls fail or the database stays unhealthy. The job keeps the same test database and full `python -m pytest -q` command; its final cleanup removes only the named temporary CI container.

Local contract coverage: primary success, official fallback, both pulls rejected, unhealthy database, and readiness timeout. These use mocked Docker commands and do not prove a real database connection. The hosted integration job remains the evidence for the actual image pull and database tests.

References: [GitHub service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers), [ECR Public quotas](https://docs.aws.amazon.com/general/latest/gr/ecr-public.html).
