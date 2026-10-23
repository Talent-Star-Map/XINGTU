"""Live SQL evidence adapter. Current row observations do not invent old versions."""
from datetime import timezone
from database import CrawledJob,SessionLocal
from services.evidence_graph import industry_scope


def load_current_evidence():
    with SessionLocal() as session:
        rows=session.query(CrawledJob).filter(CrawledJob.data_type==1,CrawledJob.source_url.isnot(None)).all()
        observations=[]
        for row in rows:
            data={k:getattr(row,k,None) for k in ('id','title','source','source_url','company_name','job_description','skill_tags','crawl_time')}
            # This collector has an audited UTC observation time contract.
            scope=industry_scope(data)
            if scope['status']!='included' or not row.crawl_time or not row.job_description:
                continue
            captured=row.crawl_time.replace(tzinfo=timezone.utc).isoformat()
            observations.append({**data,'job_id_ref':row.id,'source_job_id':row.id,
                'snapshot_id':f'sql:{row.id}:{captured}','captured_at':captured,
                'skills_required':row.skill_tags,'evidence_scope':'current_sql_observation',
                'scope':scope})
    return observations
