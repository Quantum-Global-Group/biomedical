"""Serve the Next.js static export (lite) for Hugging Face Docker Spaces (port 7860)."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

app = FastAPI()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
