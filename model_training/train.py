"""
train.py — Bengaluru Home Price Training Entry Point
======================================================
Thin wrapper that calls pipeline.run_pipeline().
Run directly:  python model_training/train.py
"""

from pipeline import run_pipeline

if __name__ == "__main__":
    run_pipeline()
