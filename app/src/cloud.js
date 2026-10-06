import {createClient} from '@supabase/supabase-js';
import config from '../cloud-config.json';

export function createCloudServices(){
  const url=import.meta.env.VITE_SUPABASE_URL||config.url;
  const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||config.publishableKey;
  if(!url&&!key)return null;
  try{
    if(!url||!key)throw Error('공유 저장소 주소와 공개 연결 키를 모두 설정해 주세요.');
    if(new URL(url).protocol!=='https:')throw Error('공유 저장소는 HTTPS 주소를 사용해야 합니다.');
    if(!key.startsWith('sb_publishable_')){
      let role;try{role=JSON.parse(atob(key.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role}catch{}
      if(role!=='anon')throw Error('공개 publishable 또는 anon 키만 사용할 수 있습니다. 비밀 키는 넣지 마세요.');
    }
    const client=createClient(url,key);
    const check=({data,error})=>{if(error)throw error;return data};
    return {
      client,
      async read(){return check(await client.from('wedding_state').select('data,revision').eq('id','main').single())},
      async write(revision,data){return check(await client.rpc('save_wedding_state',{_expected_revision:revision,_new_data:data}))?.[0]||null},
      listen(onData,onStatus){const channel=client.channel('our-chapter-shared').on('postgres_changes',{event:'UPDATE',schema:'public',table:'wedding_state',filter:'id=eq.main'},event=>onData(event.new)).subscribe(onStatus);return ()=>{void client.removeChannel(channel)}},
      async getAdministrator(){
        const session=check(await client.auth.getSession());if(!session.session)return null;
        const {user}=check(await client.auth.getUser());if(!user)return null;
        const role=check(await client.rpc('get_wedding_role'));
        if(role?.role!=='admin')return null;
        return {role:'admin',id:role.name==='송윤오'?'yoono':'yeeun',name:role.name,cloud:true};
      },
      async sendCode(email){check(await client.auth.signInWithOtp({email,options:{shouldCreateUser:true}}))},
      async verifyCode(email,token,name){
        check(await client.auth.verifyOtp({email,token,type:'email'}));
        const person=await this.getAdministrator();
        if(!person||person.name!==name){await client.auth.signOut({scope:'local'});throw Error('등록된 관리자 이메일과 이름을 확인해 주세요.')}
        return person;
      },
      async signOut(){check(await client.auth.signOut({scope:'local'}))},
      watchAuth(callback){const {data}=client.auth.onAuthStateChange(()=>{setTimeout(()=>{this.getAdministrator().then(callback).catch(()=>callback(null))},0)});return ()=>data.subscription.unsubscribe()},
    };
  }catch(error){return {error:error.message}}
}
