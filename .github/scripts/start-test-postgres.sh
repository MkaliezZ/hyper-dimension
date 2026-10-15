#!/usr/bin/env bash
set -euo pipefail

# Both locations serve Docker's official PostgreSQL image. A shared runner can
# exhaust either registry's anonymous allowance before this job reaches tests.
selected_image=''
for image in public.ecr.aws/docker/library/postgres:17 docker.io/library/postgres:17; do
  if timeout 180s docker pull "$image"; then
    selected_image="$image"
    break
  fi
  printf 'PostgreSQL image pull failed: %s; trying the next official location.\n' "$image" >&2
done
if [[ -z "$selected_image" ]]; then
  printf 'Unable to obtain PostgreSQL 17 from either official location.\n' >&2
  exit 1
fi

docker run --detach --pull=never --name hd-ci-postgres \
  --publish 127.0.0.1:5432:5432 \
  --env POSTGRES_USER=hd_test --env POSTGRES_PASSWORD=hd_test_only --env POSTGRES_DB=hd_test \
  --health-cmd 'pg_isready -U hd_test -d hd_test' \
  --health-interval 5s --health-timeout 5s --health-retries 10 \
  "$selected_image"

for ((attempt=0; attempt<60; attempt++)); do
  status=$(docker inspect --format '{{.State.Health.Status}}' hd-ci-postgres)
  case "$status" in
    healthy) printf 'PostgreSQL 17 is ready (%s).\n' "$selected_image"; exit 0 ;;
    unhealthy) break ;;
  esac
  sleep 1
done
docker logs --tail 60 hd-ci-postgres >&2 || true
printf 'PostgreSQL 17 did not become healthy; integration tests will not start.\n' >&2
exit 1
