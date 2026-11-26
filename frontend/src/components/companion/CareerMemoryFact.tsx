import { useState } from 'react'
import { careerApi } from '../../lib/careerApi'
const labels: Record<string,string> = {name:'项目名称',description:'本人负责的工作与实现',company:'单位',position:'职位',institution:'学校',degree:'学历',field:'专业',startDate:'开始时间',endDate:'结束时间',url:'项目地址',technologies:'使用技术（每行一项）',highlights:'真实成果（每行一项）',gpa:'绩点',location:'地点'}
const sources: Record<string,string> = {user_message:'聊天中提到',user_confirmation:'本人确认',resume:'上传的简历',github:'GitHub仓库',profile:'个人资料',account:'个人资料'}
export default function CareerMemoryFact({fact,onUpdate,onError}:{fact:any;onUpdate:()=>Promise<void>;onError:(message:string)=>void}) {
  const [editing,setEditing]=useState(false),[saving,setSaving]=useState(false)
  const [value,setValue]=useState<any>(fact.value)
  const object=typeof value==='object' && value!==null && !Array.isArray(value)
  const fields=object?Object.keys(labels).filter(key=>key in value || key==='description'):[]
  async function save() {
    setSaving(true)
    try {await careerApi(`/memory/${fact.id}/confirm`,'POST',{value});setEditing(false);await onUpdate()}
    catch(e){onError((e as Error).message)}finally{setSaving(false)}
  }
  return <div className="my-3 border-t pt-3 text-sm">
    <strong>{fact.fact_key}</strong><p className="my-1 text-xs opacity-70">{fact.confirmed&&fact.status==='active'?'已确认':fact.status==='conflict'?'存在不同说法，需要核对':'待你确认'}　来源：{sources[fact.source?.type]||'本人资料'}</p>
    {editing?<div className="grid gap-2">
      {object?fields.map(key=><label key={key} className="grid gap-1"><span>{labels[key]}</span><textarea rows={key==='description'?3:2} className="w-full rounded border bg-transparent p-2" value={Array.isArray(value[key])?value[key].join('\n'):value[key]||''} onChange={e=>setValue({...value,[key]:Array.isArray(value[key])?e.target.value.split('\n').filter(Boolean):e.target.value})}/></label>):<textarea aria-label="修改资料" rows={3} className="w-full rounded border bg-transparent p-2" value={String(value)} onChange={e=>setValue(e.target.value)}/>}
      <div className="flex gap-4"><button className="text-blue-600" disabled={saving} onClick={save}>保存并确认</button><button disabled={saving} onClick={()=>{setEditing(false);setValue(fact.value)}}>取消</button></div>
    </div>:<>
      {object?<dl className="grid gap-1 break-words">{fields.filter(key=>value[key]&&(!Array.isArray(value[key])||value[key].length)).map(key=><div key={key}><dt className="inline opacity-65">{labels[key]}：</dt><dd className="inline whitespace-pre-wrap">{Array.isArray(value[key])?value[key].join('、'):String(value[key])}</dd></div>)}</dl>:<p className="whitespace-pre-wrap break-words">{String(value)}</p>}
      <div className="mt-2 flex flex-wrap gap-4 text-blue-600"><button disabled={saving} onClick={save}>确认属实</button><button onClick={()=>setEditing(true)}>修改后确认</button><button disabled={saving} onClick={async()=>{try{await careerApi(`/memory/${fact.id}`,'DELETE');await onUpdate()}catch(e){onError((e as Error).message)}}}>忘记</button></div>
    </>}
  </div>
}
