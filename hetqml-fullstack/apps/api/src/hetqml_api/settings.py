from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> Path:
    """`apps/api/.data/` resolved relative to the package, not cwd.

    Tests override `data_dir` with a `tmp_path`; production reads the env
    var `DATA_DIR` (set in fly.toml or `.env`). The default keeps the
    sqlite file inside the api app and out of the rest of the workspace.
    """
    # src/hetqml_api/settings.py → apps/api/.data
    return Path(__file__).resolve().parents[2] / ".data"


class Settings(BaseSettings):
    """Process-wide configuration loaded from environment variables.

    On Fly.io: set with `fly secrets set ALLOWED_ORIGINS=...`.
    """

    allowed_origins: str = "http://localhost:3000"
    ibm_crn: str = ""
    data_dir: Path = _default_data_dir()
    sqlite_filename: str = "hetqml.sqlite"

    # Path (absolute or relative-to-CWD) to the manuscript-track bootstrap-CI
    # report emitted by `scripts/run_bootstrap_ci.py` in the sibling
    # `hybrid-qml-kg-poc` repo. Until the headline GPU run lands, the file
    # does not exist and the bootstrap-CI endpoint returns a "pending" shape.
    # Override with the env var BOOTSTRAP_CI_PATH (e.g. on Fly:
    # `fly secrets set BOOTSTRAP_CI_PATH=/srv/hybrid-qml-kg-poc/docs/results/bootstrap_ci_analysis.md`).
    bootstrap_ci_path: Path = Path("docs/results/bootstrap_ci_analysis.md")

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", case_sensitive=False)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def sqlite_path(self) -> Path:
        return self.data_dir / self.sqlite_filename


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
