import os
import time
from llama_cloud import LlamaCloud
from app.data_models import Invoice

EXTRACT_CONFIG = {
    "data_schema": Invoice.model_json_schema(),
    "extraction_target": "per_doc",
    "tier": "cost_effective",  # use "agentic" for scanned/complex layouts
    "cite_sources": True,
}

def get_llama_client() -> LlamaCloud:
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise RuntimeError("LLAMA_CLOUD_API_KEY is not configured in environment variables")
    return LlamaCloud(api_key=api_key)

def extract_invoice(pdf_path: str, timeout_seconds: float = 180, poll_interval: float = 2.0) -> Invoice:
    client = get_llama_client()
    file_obj = client.files.create(file=pdf_path, purpose="extract")

    job = client.extract.create(file_input=file_obj.id, configuration=EXTRACT_CONFIG)

    start = time.monotonic()
    while job.status not in ("COMPLETED", "FAILED", "CANCELLED"):
        if time.monotonic() - start > timeout_seconds:
            raise TimeoutError(f"Extraction for {pdf_path} timed out (status: {job.status})")
        time.sleep(poll_interval)
        job = client.extract.get(job.id)

    if job.status != "COMPLETED":
        raise RuntimeError(f"Extraction failed for {pdf_path}: {job.error_message}")

    return Invoice.model_validate(job.extract_result)