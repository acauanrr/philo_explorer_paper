"""
Dataset Routes for serving synthetic and demo data
"""

from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/datasets", tags=["datasets"])

@router.get("/synthetic/temporal")
async def get_temporal_dataset():
    """
    Get the synthetic temporal dataset for demonstration
    """
    try:
        # Try extended dataset first, fallback to original
        extended_path = Path(__file__).parent.parent / "data" / "synthetic" / "temporal_dataset_extended.json"
        original_path = Path(__file__).parent.parent / "data" / "synthetic" / "temporal_dataset.json"

        dataset_path = extended_path if extended_path.exists() else original_path

        if not dataset_path.exists():
            raise HTTPException(status_code=404, detail="Temporal dataset not found")

        with open(dataset_path, 'r', encoding='utf-8') as f:
            dataset = json.load(f)

        return dataset

    except FileNotFoundError:
        logger.error(f"Dataset file not found: {dataset_path}")
        raise HTTPException(status_code=404, detail="Dataset file not found")
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing dataset JSON: {e}")
        raise HTTPException(status_code=500, detail="Error parsing dataset")
    except Exception as e:
        logger.error(f"Error loading temporal dataset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/synthetic/documents/{timepoint}")
async def get_documents_by_timepoint(timepoint: str):
    """
    Get documents for a specific timepoint (t1 or t2)
    """
    if timepoint not in ["t1", "t2"]:
        raise HTTPException(status_code=400, detail="Timepoint must be 't1' or 't2'")

    try:
        # Try extended dataset first, fallback to original
        extended_path = Path(__file__).parent.parent / "data" / "synthetic" / "temporal_dataset_extended.json"
        original_path = Path(__file__).parent.parent / "data" / "synthetic" / "temporal_dataset.json"

        dataset_path = extended_path if extended_path.exists() else original_path

        with open(dataset_path, 'r', encoding='utf-8') as f:
            dataset = json.load(f)

        timepoint_key = f"timepoint_{timepoint}"

        if timepoint_key not in dataset:
            raise HTTPException(status_code=404, detail=f"Timepoint {timepoint} not found in dataset")

        documents = dataset[timepoint_key].get("documents", [])

        # Format for the pipeline
        formatted_docs = [
            {
                "id": doc["id"],
                "content": doc["content"],
                "metadata": {
                    "title": doc.get("title", ""),
                    "category": doc.get("category", ""),
                    "tags": doc.get("tags", [])
                }
            }
            for doc in documents
        ]

        return {
            "timepoint": timepoint,
            "timestamp": dataset[timepoint_key].get("timestamp"),
            "label": dataset[timepoint_key].get("label"),
            "documents": formatted_docs,
            "count": len(formatted_docs)
        }

    except Exception as e:
        logger.error(f"Error loading documents for timepoint {timepoint}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_available_datasets():
    """
    List all available datasets
    """
    try:
        data_dir = Path(__file__).parent.parent / "data"
        datasets = []

        # Check for synthetic datasets
        synthetic_dir = data_dir / "synthetic"
        if synthetic_dir.exists():
            for file_path in synthetic_dir.glob("*.json"):
                datasets.append({
                    "name": file_path.stem,
                    "type": "synthetic",
                    "path": f"synthetic/{file_path.name}"
                })

        return {
            "datasets": datasets,
            "count": len(datasets)
        }

    except Exception as e:
        logger.error(f"Error listing datasets: {e}")
        raise HTTPException(status_code=500, detail=str(e))