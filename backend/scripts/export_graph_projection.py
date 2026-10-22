"""Package the canonical graph model and registry into a collector checkout.

Generated copies are not independently edited skill dictionaries.
Usage: python -m scripts.export_graph_projection --destination D:/XINGTU_Data_Collection/graph
"""
import argparse
import hashlib
from pathlib import Path

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--destination',required=True)
    args=parser.parse_args()
    destination=Path(args.destination).resolve()
    destination.mkdir(parents=True,exist_ok=True)
    source=Path(__file__).resolve().parents[1]/'services'
    for name in ('job_graph_model.py','skill_ontology.json'):
        data=(source/name).read_bytes()
        (destination/name).write_bytes(data)
        print(name,hashlib.sha256(data).hexdigest())

if __name__=='__main__':main()
