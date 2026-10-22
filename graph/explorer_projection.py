"""Generated registry/model mirror is packaged from the application's canonical graph model."""
import pymysql
from database.mysql import get_connection
from sync.job_sync import get_server_connection
from .job_graph_model import compile_postings, sync_projection


def sync_explorer(driver):
    source=get_connection();destination=get_server_connection()
    try:
        with source.cursor(pymysql.cursors.DictCursor) as q:
            q.execute('SELECT * FROM job_raw');raw=q.fetchall()
            q.execute('SELECT * FROM job_info');clean=q.fetchall()
        with destination.cursor(pymysql.cursors.DictCursor) as q:
            q.execute('SELECT * FROM jobs WHERE data_type=1');jobs=q.fetchall()
    finally:
        source.close();destination.close()
    return sync_projection(driver,compile_postings(raw,jobs,clean))
