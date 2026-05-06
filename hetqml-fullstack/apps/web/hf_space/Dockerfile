# https://huggingface.co/docs/hub/spaces-sdks-docker
FROM python:3.11-slim

RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

COPY --chown=user:user requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY --chown=user:user app.py app.py
COPY --chown=user:user static static

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
