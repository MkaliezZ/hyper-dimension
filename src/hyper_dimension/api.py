"""HTTP application entry point.

Only health reporting is exposed while authorization and audit are being built.
Student data routes must not be added without server-side access checks.
"""

from fastapi import FastAPI

from hyper_dimension import __version__

app = FastAPI(title="Hyper Dimension", version=__version__)


@app.get("/healthz", tags=["ops"])
def healthz() -> dict[str, str]:
    return {"status": "ok", "version": __version__}
