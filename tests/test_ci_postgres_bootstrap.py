"""Exercise registry fallback and health failure without pulling real images."""

import os
from pathlib import Path
import shutil
import subprocess

import pytest


SCRIPT = Path(__file__).resolve().parents[1] / ".github/scripts/start-test-postgres.sh"
BASH = shutil.which("bash")
pytestmark = pytest.mark.skipif(BASH is None or os.name == "nt", reason="Linux CI shell contract")

STUBS = r'''
timeout() { shift; "$@"; }
sleep() { :; }
docker() {
  printf 'docker %s\n' "$*" >&2
  case "$1" in
    pull)
      [[ "$MOCK_PULL" == first ]] && return 0
      [[ "$MOCK_PULL" == fallback && "$2" == docker.io/library/postgres:17 ]] && return 0
      return 1 ;;
    run) return 0 ;;
    inspect) printf '%s\n' "$MOCK_HEALTH" ;;
    logs) printf 'mock database diagnostics\n' >&2 ;;
  esac
}
source "$1"
'''


def run_bootstrap(pull: str, health: str = "healthy") -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [BASH, "--noprofile", "--norc", "-c", STUBS, "ci-bootstrap-test", str(SCRIPT)],
        text=True,
        capture_output=True,
        env={**os.environ, "MOCK_PULL": pull, "MOCK_HEALTH": health},
        timeout=5,
        check=False,
    )


def test_primary_success_does_not_pull_fallback():
    result = run_bootstrap("first")
    assert result.returncode == 0, result.stderr
    assert "docker pull docker.io" not in result.stderr
    assert "docker run --detach --pull=never" in result.stderr
    assert "--publish 127.0.0.1:5432:5432" in result.stderr
    assert "is ready (public.ecr.aws/" in result.stdout


def test_rate_limited_primary_uses_official_fallback_before_starting():
    result = run_bootstrap("fallback")
    assert result.returncode == 0, result.stderr
    assert result.stderr.index("docker pull public.ecr.aws/") < result.stderr.index("docker pull docker.io/")
    assert result.stderr.index("docker pull docker.io/") < result.stderr.index("docker run ")
    assert "is ready (docker.io/library/postgres:17)" in result.stdout


def test_all_pulls_fail_without_starting_database_or_claiming_ready():
    result = run_bootstrap("fail")
    assert result.returncode != 0
    assert "docker run " not in result.stderr
    assert "is ready" not in result.stdout


@pytest.mark.parametrize("health", ["unhealthy", "starting"])
def test_unhealthy_or_exhausted_database_blocks_tests_and_prints_diagnostics(health):
    result = run_bootstrap("first", health)
    assert result.returncode != 0
    assert "mock database diagnostics" in result.stderr
    assert "is ready" not in result.stdout
