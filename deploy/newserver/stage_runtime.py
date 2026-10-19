"""Stage a NEW deployment directory from committed Git snapshots, without secrets."""
import argparse
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile


def archive_into(repository, ref, destination, paths=()):
    data = subprocess.check_output(
        ['git', '-C', str(repository), 'archive', '--format=tar', ref, *paths]
    )
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:') as source:
        for member in source:
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or member.issym() or member.islnk():
                raise RuntimeError('Unexpected archive path or link')
            if path.name.startswith('.env') or path.suffix in ('.pem', '.key', '.p12', '.pfx'):
                continue
            if any(p in ('browser_data', 'logs', 'backups', 'uploads') for p in path.parts):
                continue
            target = destination.joinpath(*path.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as input_file, target.open('wb') as output_file:
                    shutil.copyfileobj(input_file, output_file)
                target.chmod(member.mode & 0o777)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-root', default='/data/xingtu')
    parser.add_argument('--collector-ref', default='refs/remotes/origin/data_collection')
    args = parser.parse_args()
    if os.name != 'posix' or not Path('/data').is_mount():
        raise SystemExit('Linux with a mounted /data disk is required; no disk initialization is performed')
    root = Path(args.runtime_root).resolve()
    if root != Path('/data/xingtu'):
        raise SystemExit('This deployment profile and timers require /data/xingtu')
    # Refuse before writing anything to an existing deployment or secret directory.
    if root.exists() and any(root.iterdir()):
        raise SystemExit('Runtime directory is not empty; existing deployments must be updated manually')
    package = Path(__file__).resolve().parent
    repository = package.parents[1]
    app_ref = subprocess.check_output(
        ['git', '-C', str(repository), 'rev-parse', 'HEAD'], text=True
    ).strip()
    collector_ref = subprocess.check_output(
        ['git', '-C', str(repository), 'rev-parse', args.collector_ref], text=True
    ).strip()
    root.mkdir(parents=True, exist_ok=True)
    for directory in ['app', 'collector', 'secrets', 'uploads', 'mysql', 'mongo',
                      'mongo-config', 'neo4j', 'neo4j-logs', 'collector_state/browser_data',
                      'collector_state/logs', 'deployment_logs']:
        (root / directory).mkdir(parents=True, exist_ok=True)
    (root / 'secrets').chmod(0o700)
    archive_into(repository, app_ref, root / 'app', ['backend', 'frontend'])
    archive_into(repository, collector_ref, root / 'collector')
    for name in ['compose.yaml', 'daily_backup_new.py', 'graph_export_readonly.py',
                 'install_new_collection_timers.py']:
        shutil.copy2(package / name, root / name)
    shutil.copy2(package / 'collector.Dockerfile', root / 'collector/Dockerfile')
    shutil.copy2(package / 'collector.runtime-constraints.txt', root / 'collector/runtime-constraints.txt')
    for template in (package / 'secrets').glob('*.example'):
        shutil.copy2(template, root / 'secrets' / template.name)
    (root / 'source_revisions.json').write_text(
        json.dumps({'app': app_ref, 'collector': collector_ref}, indent=2)
    )
    print('Sources staged; fill private environment files, restore databases, then validate and start services')


if __name__ == '__main__':
    main()
