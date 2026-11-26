"""Schema definition for explicit migration and isolated tests; never auto-created at startup."""
from sqlalchemy import MetaData, Table, Column, String, DateTime as _DateTime, Integer, UniqueConstraint, Index
from sqlalchemy import Text as _Text
from sqlalchemy.dialects.mysql import LONGTEXT, DATETIME

# MySQL TEXT is 64KiB; task snapshots and evidence must fit without truncation.
Text = _Text().with_variant(LONGTEXT(), 'mysql')
DateTime = _DateTime().with_variant(DATETIME(fsp=6), 'mysql')

metadata = MetaData()
threads = Table('career_threads', metadata,
    Column('id', String(32), primary_key=True), Column('owner', String(64), nullable=False, index=True),
    Column('title', String(200), nullable=False), Column('metadata', Text, nullable=False), Column('active_run_id',String(32)),
    Column('created_at', DateTime, nullable=False), Column('updated_at', DateTime, nullable=False))
messages = Table('career_messages', metadata,
    Column('id', String(32), primary_key=True), Column('owner', String(64), nullable=False),
    Column('thread_id', String(32), nullable=False, index=True), Column('role', String(16), nullable=False),
    Column('content', Text, nullable=False), Column('metadata', Text, nullable=False), Column('created_at', DateTime, nullable=False))
facts = Table('career_facts', metadata,
    Column('id', String(32), primary_key=True), Column('owner', String(64), nullable=False),
    Column('kind', String(50), nullable=False), Column('fact_key', String(200), nullable=False),
    Column('value', Text, nullable=False), Column('source', Text, nullable=False), Column('source_key', String(64), nullable=False),
    Column('evidence', Text, nullable=False), Column('confirmed', Integer, nullable=False), Column('status', String(24), nullable=False),
    Column('created_at', DateTime, nullable=False), Column('updated_at', DateTime, nullable=False),
    UniqueConstraint('owner', 'kind', 'fact_key', 'source_key', name='uq_career_fact_source'))
runs = Table('career_runs', metadata,
    Column('id', String(32), primary_key=True), Column('owner', String(64), nullable=False),
    Column('thread_id', String(32), nullable=False), Column('job_key', String(100), nullable=False),
    Column('idempotency_key', String(160), nullable=False), Column('status', String(32), nullable=False),
    Column('payload', Text, nullable=False), Column('created_at', DateTime, nullable=False), Column('updated_at', DateTime, nullable=False),
    UniqueConstraint('owner', 'idempotency_key', name='uq_career_run_request'),
    Index('ix_career_run_queue', 'status', 'updated_at'))
bindings = Table('resume_target_bindings', metadata,
    Column('id', String(32), primary_key=True), Column('owner', String(64), nullable=False),
    Column('resume_id', Integer, nullable=False), Column('run_id', String(32), nullable=False, unique=True),
    Column('job_snapshot', Text, nullable=False), Column('provenance', Text, nullable=False), Column('created_at', DateTime, nullable=False))
