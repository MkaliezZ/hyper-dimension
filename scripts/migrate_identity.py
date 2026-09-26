"""Apply versioned identity schemas using HD_DATABASE_DSN from the environment."""
from __future__ import annotations

import os
from pathlib import Path

from hyper_dimension.identity_store import apply_identity_migration, apply_teacher_class_migration


def main() -> None:
    dsn = os.getenv("HD_DATABASE_DSN")
    if not dsn:
        raise SystemExit("HD_DATABASE_DSN is required")
    path = Path(__file__).parents[1] / "migrations" / "0001_identity_gateway.sql"
    apply_identity_migration(dsn, path)
    class_path = Path(__file__).parents[1] / "migrations" / "0002_teacher_class_assignments.sql"
    apply_teacher_class_migration(dsn, class_path)
    print("Identity migrations 0001 and 0002 verified")


if __name__ == "__main__":
    main()
