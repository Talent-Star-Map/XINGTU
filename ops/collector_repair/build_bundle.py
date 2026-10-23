"""Build an auditable repair bundle; credentials never enter this artifact."""
import ast
import importlib.util
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
package=HERE/'repair_pipeline'
synonyms=ROOT/'backend/services/skill_synonyms.py'
spec=importlib.util.spec_from_file_location('catalog_synonyms',synonyms)
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
tree=ast.parse((ROOT/'backend/services/resume_parser.py').read_text(encoding='utf-8-sig'))
terms=[]
for node in tree.body:
    if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='_JD_SKILLS' for t in node.targets):
        terms=ast.literal_eval(node.value)
lexicon={term:module.canonical_name(term) for term in terms if len(term)>1}
for standard,aliases in module.SYNONYM_MAP.items():
    for term in [standard,*aliases]:
        if len(term)>1: lexicon[term]=module.canonical_name(standard)
for term in ['vLLM','DeepSpeed','Megatron','Triton','TensorRT','RLHF','DPO','SFT','MCP','LoRA','QLoRA','RAG','向量数据库','数据治理','数据仓库','知识图谱','模型量化','预训练','微调','多模态','推荐系统','图神经网络','强化学习','检索增强','自动驾驶','具身智能','HarmonyOS','ROS','RTOS','FPGA','UE5','Unreal','Unity']:
    lexicon[term]=module.canonical_name(term)
(package/'skill_lexicon.json').write_text(json.dumps(lexicon,ensure_ascii=False,indent=2),encoding='utf-8')
(package/'skill_synonyms.py').write_text(synonyms.read_text(encoding='utf-8-sig'),encoding='utf-8')
(package/'role_catalog.py').write_text((ROOT/'backend/services/role_catalog.py').read_text(encoding='utf-8').replace('from services.skill_synonyms import','from .skill_synonyms import'),encoding='utf-8')
output=HERE/'repair_bundle.zip'
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for path in package.glob('*'):
        if path.suffix in ('.py','.json'): archive.write(path,'repair_pipeline/'+path.name)
    archive.write(HERE/'job_sync.py','sync/job_sync.py')
print(f'bundle: {output}; explicit extraction terms: {len(lexicon)}')
