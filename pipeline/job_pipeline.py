"""Pipeline for converting raw job records into cleaned job records."""

from cleaners.job_cleaner import JobCleaner
from models.job_info import JobInfo
from models.job_raw import JobRaw


class JobPipeline:
    """Process JobRaw objects into JobInfo objects."""

    def process(self, jobs: list[JobRaw]) -> list[JobInfo]:
        """Clean a list of JobRaw objects and return JobInfo objects."""
        cleaner = JobCleaner()
        cleaned_jobs: list[JobInfo] = []

        for job in jobs:
            cleaned_job = cleaner.clean(job)
            if not cleaned_job.skills:
                continue
            cleaned_jobs.append(cleaned_job)

        return cleaned_jobs
