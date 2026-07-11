export type UserRole = 'jobseeker' | 'company' | null;

export interface User {
  id: number;
  username: string;
  role: UserRole;
  token: string;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary_min: number;
  salary_max: number;
  skills: string[];
  education: string;
  experience: string;
  description: string;
  source: string;
  collected_at: string;
}

export interface SkillTag {
  id: number;
  name: string;
  category: string;
}

export interface MatchResult {
  job_id: number;
  job_title: string;
  company: string;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  advice: string;
  dimensions: {
    skill: number;
    experience: number;
    education: number;
    salary: number;
  };
}

export interface LearningPathItem {
  phase: string;
  title: string;
  duration: string;
  skills: string[];
  resources: { name: string; type: string }[];
}

export interface TrendData {
  job_title: string;
  period: string;
  new_skills: string[];
  removed_skills: string[];
  updated_skills: { old: string; new: string }[];
  demand_change: 'up' | 'down' | 'stable';
  growth_rate: number;
}

export interface NewJobDiscovery {
  name: string;
  description: string;
  core_skills: string[];
  plus_skills: string[];
  scenarios: string[];
  emergence_time: string;
  data_source: string;
}

export interface GraphNode {
  id: number;
  name: string;
  type: 'job' | 'skill';
  category?: string;
  level?: number;
  val?: number;
}

export interface GraphLink {
  source: number;
  target: number;
  weight: number;
  relation: string;
}
