#!/usr/bin/env python3
"""Upload hetqml-web/hf_space to a Hugging Face Docker Space (replaces static/).

Expects HF_TOKEN / HUGGINGFACE_HUB_TOKEN in the environment. Used by CI and
callable locally after `pnpm --filter hetqml-web export:hf`.

  HF_SPACE_REPO_ID=org/SpaceName python scripts/sync_hf_space_lite.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> int:
    repo_id = (
        os.environ.get("HF_SPACE_REPO_ID") or "").strip()
    if not repo_id:
        repo_id = "quantumGlobalGroup/Hetionet-Lite"

    workspace = Path(__file__).resolve().parents[1]
    folder = workspace / "hetqml-fullstack" / "apps" / "web" / "hf_space"
    static = folder / "static"
    if not static.is_dir() or not any(static.iterdir()):
        print(
            "error: hf_space/static is missing or empty; run "
            "`pnpm --filter hetqml-web export:hf` first",
            file=sys.stderr,
        )
        return 1

    token = (
        os.environ.get("HF_TOKEN")
        or os.environ.get("HUGGINGFACE_HUB_TOKEN")
        or ""
    ).strip()
    if not token:
        print(
            "error: set HF_TOKEN or HUGGINGFACE_HUB_TOKEN "
            "(Settings → Secrets on GitHub)",
            file=sys.stderr,
        )
        return 1

    try:
        from huggingface_hub import HfApi
    except ImportError:
        print("error: pip install huggingface_hub", file=sys.stderr)
        return 1

    api = HfApi(token=token)
    api.upload_folder(
        folder_path=str(folder),
        repo_id=repo_id,
        repo_type="space",
        ignore_patterns=[".git/**", "**/.git/**", "**/__pycache__/**"],
    )
    print(f"uploaded {folder} -> {repo_id} (repo_type=space)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
