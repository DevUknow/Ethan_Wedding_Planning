import {validBackup} from './model.js';

export function createSynchronizer(backend,{onData,onStatus,onError}) {
  let revision=-1,queue=Promise.resolve(),alive=true,unsubscribe;
  function accept(row){
    if(!alive||!row)return;
    if(!validBackup(row.data))throw Error('공유 기록의 형식이 올바르지 않습니다.');
    if(Number(row.revision)<revision)return;
    revision=Number(row.revision);onData(row.data);
  }
  async function refresh(){const row=await backend.read();accept(row);return row}
  async function start(){
    onStatus('connecting');
    try{await refresh();onStatus('synced');
      unsubscribe=backend.listen(row=>{try{accept(row)}catch(error){onStatus('error');onError(error)}},status=>{
        if(!alive)return;
        if(status==='SUBSCRIBED')refresh().then(()=>onStatus('synced')).catch(error=>{onStatus('offline');onError(error)});
        else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))onStatus('offline');
      });
    }catch(error){onStatus('error');onError(error);throw error}
  }
  function change(mutator){
    const request=queue.then(async()=>{
      if(!alive)throw Error('연결이 종료되었습니다.');
      onStatus('saving');
      try{
        for(let attempt=0;attempt<4;attempt++){
          const current=await backend.read();
          const next=mutator(structuredClone(current.data));
          if(!validBackup(next))throw Error('저장할 기록의 형식이 올바르지 않습니다.');
          const saved=await backend.write(Number(current.revision),next);
          if(saved){accept(saved);onStatus('synced');return saved.data}
        }
        throw Error('다른 기기에서 수정 중입니다. 잠시 후 다시 시도해 주세요.');
      }catch(error){onStatus('error');onError(error);throw error}
    });
    queue=request.catch(()=>{});return request;
  }
  return {start,refresh,change,stop(){alive=false;unsubscribe?.()}};
}
