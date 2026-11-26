"""Application-owned persistent DAG around official DeerFlow reasoning agents.

Read-only branches run concurrently. Clarification, evidence supervision and the
transactional resume write form a strict dependency chain; model output cannot
call write tools directly.
"""
import asyncio
import copy
import hashlib
import json
import re
from datetime import datetime, timezone
from sqlalchemy import text
from services.career_store import CareerStore
from services import career_context, career_deerflow, career_github
from services.career_review import validated_facts, apply_rewrites, review_packet

_tasks = {}
_capacity = asyncio.Semaphore(3)


def _owner_id(owner):
    return int(owner.split(':')[1])


def safe_questions(values):
    result=[]
    for i,value in enumerate(values[:5] if isinstance(values,list) else []):
        question=value.get('question') if isinstance(value,dict) else value
        if isinstance(question,str) and question.strip(): result.append({'id':str(i),'question':question[:500]})
    return result


async def execute_run(owner, run_id, store=None):
    store=store or CareerStore()
    if not await asyncio.to_thread(store.claim_run, owner, run_id): return
    run=await asyncio.to_thread(store.get_run, owner, run_id)
    if not await asyncio.to_thread(store.acquire_thread_run, owner, run['thread_id'],run_id):
        await asyncio.to_thread(store.update_run,owner,run_id,'failed',{'events':[{'event':'error','message':'此对话已有任务处理中，请等待完成后继续。'}]})
        return
    request=run['payload'].get('request',{})
    fingerprint=run['payload'].get('fingerprint')
    identity=career_deerflow.current_actor.set(owner)
    events=[]

    async def emit(event, **fields):
        events.append({'event':event,**fields})
        await asyncio.to_thread(store.update_run,owner,run_id,'running',{'request':request,'events':events,'fingerprint':fingerprint})

    async def finish(status, answer=None, **extra):
        if answer:
            events.append({'event':'answer','answer':answer})
            await asyncio.to_thread(store.append_message,owner,run['thread_id'],'assistant',answer,{'run_id':run_id,'events':[e for e in events if e['event'] not in ('status','answer')]})
        await asyncio.to_thread(store.update_run,owner,run_id,status,{'request':request,'events':events,'fingerprint':fingerprint,**extra})

    try:
        async with _capacity:
            thread=await asyncio.to_thread(store.get_thread,owner,run['thread_id'])
            metadata=thread.get('metadata') or {}
            message=request['message']
            messages=await asyncio.to_thread(store.messages,owner,run['thread_id'])
            previous=next((m for m in messages if m['role']=='user' and m.get('metadata',{}).get('run_id')==run_id),None)
            if previous is None:
                previous=await asyncio.to_thread(store.append_message,owner,run['thread_id'],'user',message,{'run_id':run_id})
                messages.append(previous)
            if re.fullmatch(r'(你好|您好|嗨|谢谢|感谢|再见|拜拜)[！!。.\s]*',message):
                await finish('completed','你好，我是小星。你可以和我聊求职方向、查找真实岗位，或为选定岗位制作简历。' if not re.search('谢谢|感谢|再见|拜拜',message) else '不客气，有需要再来找我。')
                return
            await emit('status',message='正在并行整理个人资料与检索岗位图谱…')

            async def graph_branch():
                try:
                    return await asyncio.wait_for(asyncio.to_thread(career_context.retrieve_graph,message),20)
                except Exception:
                    return []

            # Two independent evidence readers overlap; no write nodes here.
            profile_task=asyncio.to_thread(career_context.load_profile,_owner_id(owner),store,metadata.get('memory_enabled',True))
            context,graph=await asyncio.gather(profile_task,graph_branch())
            if request.get('attachment_ids'):
                from services import chat_materials
                # Reuse existing account-scoped, expiring uploads. Uploaded material
                # may inform an answer but cannot become confirmed resume facts.
                materials=await asyncio.to_thread(chat_materials.load_materials,owner,request['attachment_ids'])
                content=await asyncio.to_thread(chat_materials.material_context,materials,message)
                for index,item in enumerate(content):
                    context['evidence'].append({'id':f'chat-material:{index}','type':'user_material',
                        'text':json.dumps(item,ensure_ascii=False),'requires_confirmation':True})
            active_facts=[{'id':f['id'],'kind':f['kind'],'key':f['fact_key'],'value':f['value']}
                          for f in context['facts'] if f.get('confirmed') and f.get('status')=='active'][:60]
            history=[{'role':m['role'],'content':m['content'][:2000]} for m in messages[-10:]]
            plan=await career_deerflow.plan_turn(message,{'history':history,'memory':active_facts,
                'profile':review_packet({},career_context.private_rag(context['evidence'],message),{},None)['evidence'],
                'graph_context':graph,'selected_job_key':metadata.get('job_key')})
            if metadata.get('memory_enabled',True):
                candidates=[]
                for fact in validated_facts(plan.get('facts'),message):
                    saved=await asyncio.to_thread(store.upsert_fact,owner,fact['kind'],fact['key'],fact['value'],
                        {'type':'user_message','thread_id':run['thread_id'],'message_id':previous['id']},
                        {'quote':fact['quote']},False)
                    candidates.append(saved)
                if candidates:await emit('memory_candidates',facts=candidates)
            explicit_make=bool(re.search(r'(?:做|写|生成|制作|定制|创建|完善|优化).{0,15}简历|简历.{0,10}(?:做|写|生成|制作|定制)',message))
            cancel_make=bool(re.search(r'(?:取消|停止|不用|不要|别).{0,8}(?:制作|生成|做|写)?.{0,8}简历',message))
            if cancel_make:metadata['resume_pending']=False
            making=explicit_make or bool(metadata.get('resume_pending'))
            if cancel_make:making=False
            intent='create_resume' if making else plan.get('intent','chat')
            # A model-only request cannot authorize a resume write.
            if intent=='create_resume' and not making: intent='chat'
            job_key=request.get('source_job_key') or metadata.get('job_key')
            if request.get('source_job_key'):
                target=await asyncio.to_thread(career_context.get_target,request['source_job_key'])
                metadata['job_key']=target['job_key']
                metadata['job_snapshot']=target
            else:
                target=metadata.get('job_snapshot')
            query=str(plan.get('query') or message)[:180]
            if intent=='recommend_jobs' or (making and not target):
                await emit('status',message='正在检索库内真实招聘数据…')
                jobs=await asyncio.to_thread(career_context.retrieve_jobs,query,context)
                await emit('jobs',jobs=jobs)
                metadata['resume_pending']=making
                await asyncio.to_thread(store.update_thread,owner,run['thread_id'],metadata)
                await finish('needs_input' if making else 'completed',
                    '请先选择要定制简历的具体岗位。' if making and jobs else
                    ('找到这些库内岗位，卡片显示来源和采集时间，当前是否仍在招聘尚未核实。' if jobs else '本次没有找到符合方向的真实岗位。你可以补充岗位名称或城市，我再帮你查找。'))
                return
            if intent!='create_resume':
                # Evidence reviewer also guards free-form personalized/GraphRAG answers.
                answer=str(plan.get('answer') or '你想先了解哪些岗位，还是为一个目标岗位准备简历？')[:6000]
                check=await career_deerflow.supervise({'answer':answer,'evidence':review_packet({},context['evidence'],{},target)['evidence'],
                    'graph_context':graph,'current_user_message':message,'target_job':target})
                if check.get('approved') is not True or check.get('issues') or check.get('questions'):
                    questions=safe_questions(check.get('questions'))
                    if questions: await emit('questions',questions=questions)
                    answer='为了避免把不确定的信息当成事实，我还需要你补充确认。' if questions else '目前的资料不足以支持这个结论。你可以补充目标岗位或相关经历，我再为你核对。'
                await asyncio.to_thread(store.update_thread,owner,run['thread_id'],metadata)
                await finish('completed',answer)
                return

            metadata['resume_pending']=True
            await asyncio.to_thread(store.update_thread,owner,run['thread_id'],metadata)
            # Missing/conflicting facts are a real gate, never "best guesses".
            issues=[f for f in context['facts'] if f.get('status')=='conflict']
            profile=context['profile']
            required=[]
            if issues: required.append('你的资料中存在不同说法，请在“个人记忆”中确认需要使用的内容。')
            if not profile['basic'].get('fullName'): required.append('这份简历使用什么姓名？请先在个人中心填写。')
            if not (profile.get('skills') or profile.get('projects') or profile.get('work')):
                required.append('请先在个人中心补充技能或项目经历，或在个人记忆中确认你已经讲过的经历。')
            current_facts=await asyncio.to_thread(store.list_facts,owner)
            pending=[f for f in current_facts if f['status']=='candidate' and f['kind'] in ('project','work','education')]
            if pending:
                required.append('已整理出你描述或上传的经历，请在个人记忆中核对后确认；不属于自己的经历请删除。')
            github_url=request.get('github_url')
            if not github_url:
                match=re.search(r'https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',message)
                github_url=match.group(0) if match else None
            if github_url:
                await emit('status',message='正在读取 GitHub 项目证据，未执行仓库代码…')
                try:
                    github=await career_github.inspect_repository(github_url)
                    analysis=await career_deerflow.analyze_repository({'repository':github,'current_user_message':message})
                    files={item['id']:item for item in github['evidence']}
                    findings=[item for item in analysis.get('findings',[]) if isinstance(item,dict)
                        and item.get('source_id') in files and isinstance(item.get('quote'),str) and item['quote']
                        and item['quote'] in files[item['source_id']]['text']][:8]
                    github['findings']=findings
                    # Store repository evidence as candidate, never turn it into user skills.
                    fact=await asyncio.to_thread(store.upsert_fact,owner,'project','github:'+github['repository'],
                        {'name':github['repository'],'url':github_url,'description':'','technologies':[],'highlights':[]},
                        {'type':'github','repository':github['repository'],'commit':github['commit']}, github,False)
                    await emit('memory_candidates',facts=[fact])
                    required.append('已读取仓库。请在个人记忆中补充并确认你本人负责的模块和成果；仅有仓库代码不能证明个人贡献。')
                    if findings:
                        await emit('repository_evidence',repository=github['repository'],findings=[
                            {**item,'url':files[item['source_id']]['url'],'path':files[item['source_id']]['path']} for item in findings])
                except ValueError as exc:
                    required.append(str(exc))
            if required:
                await emit('questions',questions=safe_questions(required))
                await finish('needs_input','请先确认这些信息，确认后回复“继续制作”，我会接着完成简历。')
                return
            await emit('status',message='正在按目标岗位整理简历，并核对每项事实来源…')
            # Actual independent reasoning agents, not merely concurrent DB calls.
            await emit('status',message='个人资料 Agent 与岗位分析 Agent 正在并行核对…')
            personal_analysis,job_analysis=await asyncio.gather(
                career_deerflow.analyze_profile({'evidence':review_packet({},context['evidence'],{},target)['evidence'],'target_job':target,
                    'recent_user_messages':[m['content'] for m in messages[-8:] if m['role']=='user']}),
                career_deerflow.analyze_job({'target_job':target}))
            analysis_questions=safe_questions(personal_analysis.get('questions'))
            if analysis_questions:
                await emit('questions',questions=analysis_questions)
                await finish('needs_input','请补充以上必要信息后回复继续；不确定的可以跳过。')
                return
            job_analysis['requirements']=[item for item in job_analysis.get('requirements',[]) if isinstance(item,dict)
                and isinstance(item.get('quote'),str) and item['quote'] and item['quote'] in target.get('description','')]
            from services.resume_gen import build_resume_from_profile
            base=build_resume_from_profile(profile,{'job_title':target['title'],'skills':[],
                'years_of_experience':profile['basic'].get('years'),'language':'zh'},polish=False)['data']['resume']
            # Deterministic emphasis without making up "HR preferences" or adding skills.
            wanted={str(s).lower() for s in target.get('skills',[]) if isinstance(s,str)}
            for kind in ('projects','work_experience'):
                base[kind]['items'].sort(key=lambda item:sum(s in json.dumps(item,ensure_ascii=False).lower() for s in wanted),reverse=True)
            # Existing generic summary says "熟悉" for any listed skill. Do not infer proficiency.
            base['summary']={'text':profile['basic'].get('bio') or ''}
            packet=review_packet(base,context['evidence'],{},target)
            proposal=await career_deerflow.compose_resume({'base':packet['draft'],'evidence':packet['evidence'],'target_job':target,
                'job_analysis':job_analysis,'personal_analysis':personal_analysis})
            questions=safe_questions(proposal.get('questions'))
            if questions:
                await emit('questions',questions=questions)
                await finish('needs_input','制作前还需要确认以上信息；不确定的可以明确说跳过，不会补造数字或经历。')
                return
            draft,provenance,guard_issues=apply_rewrites(base,proposal,context['evidence'])
            if guard_issues:
                await emit('questions',questions=safe_questions(['简历改写中有内容缺少依据，已阻止保存。请补充项目职责或成果，或说明只使用原始表述。']))
                await finish('needs_input','审核未通过，本次没有保存简历。')
                return
            await emit('status',message='审核监督 Agent 正在独立检查事实、个人贡献和岗位针对性…')
            review=await career_deerflow.supervise(review_packet(draft,context['evidence'],provenance,target))
            if review.get('approved') is not True or review.get('issues') or review.get('questions'):
                await emit('questions',questions=safe_questions(review.get('questions')) or [{'id':'review','question':'审核发现有表述需要核实，请补充项目中的个人职责和真实成果。'}])
                await finish('needs_input','审核仍有不确定项，本次没有保存简历。')
                return
            await emit('status',message='证据审核已通过，正在保存岗位专属简历…')
            result=await asyncio.to_thread(save_resume,owner,run_id,draft,target,provenance,store)
            metadata['resume_pending']=False
            await asyncio.to_thread(store.update_thread,owner,run['thread_id'],metadata)
            await emit('resume_ready',**result)
            await finish('completed','已在简历中心创建岗位专属简历，你可以打开后微调、换模板和导出。')
    except asyncio.CancelledError:
        await finish('failed','本次任务已中断，已有资料和完成的简历仍会保留，请重新发起。')
        raise
    except Exception as exc:
        # No provider traces, SQL, credentials, or private payloads in client errors.
        message=str(exc) if isinstance(exc,(ValueError,career_deerflow.CareerAIUnavailable)) else '小星本次未能完成任务，资料已保留，请稍后重试。'
        events.append({'event':'error','message':message[:240]})
        await finish('failed')
    finally:
        await asyncio.to_thread(store.release_thread_run,owner,run['thread_id'],run_id)
        career_deerflow.current_actor.reset(identity)


def save_resume(owner,run_id,sections,job,provenance,store):
    from database import get_session,Resume,ResumeSection
    session=get_session()
    try:
        # SQL row lock serializes duplicate writers. Binding and resume commit together.
        query='SELECT status,payload FROM career_runs WHERE owner=:owner AND id=:id'
        if session.bind.dialect.name!='sqlite': query+=' FOR UPDATE'
        row=session.execute(text(query),{'owner':owner,'id':run_id}).first()
        if not row: raise ValueError('任务不存在')
        existing=session.execute(text('SELECT resume_id FROM resume_target_bindings WHERE owner=:owner AND run_id=:id'),{'owner':owner,'id':run_id}).first()
        if existing:
            rid=existing[0]
        else:
            store.assert_facts_current(owner,provenance,session)
            resume=Resume(user_id=_owner_id(owner),title=(job.get('company','')+' · '+job['title']+' · 小星定制')[:200],template_key='classic',language='zh')
            session.add(resume);session.flush();rid=resume.id
            from services.resume_gen import SECTION_TITLES
            for i,(kind,content) in enumerate(sections.items()):
                if kind in SECTION_TITLES:
                    session.add(ResumeSection(resume_id=rid,section_type=kind,title=SECTION_TITLES[kind],content=content,sort_order=i,visible=1))
            store.bind_resume(owner,rid,run_id,job,provenance,session=session)
        result={'resume_id':rid,'url':f'#/resume-center?resumeId={rid}','title':job['title']+' · 小星定制'}
        payload=json.loads(row[1]) if isinstance(row[1],str) else (row[1] or {})
        payload['resume']=result
        payload['events']=[*payload.get('events',[]),{'event':'resume_ready',**result}]
        store.update_run(owner,run_id,'ready',payload,session=session)
        session.commit()
        return result
    except Exception:
        session.rollback();raise
    finally:
        session.close()


def start_run(owner, run_id):
    key=(owner,run_id)
    if key in _tasks:return
    async def runner():
        try:
            await asyncio.wait_for(execute_run(owner,run_id),240)
        finally:
            _tasks.pop(key,None)
    _tasks[key]=asyncio.create_task(runner())
