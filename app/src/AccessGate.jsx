import React,{useState} from 'react';
import {ArrowRight,Heart,UserRound,LockKeyhole} from 'lucide-react';
import {administratorFor} from './access';
import heartIcon from './assets/heart.svg';

export default function AccessGate({onEnter,cloud}) {
  const [error,setError]=useState(''),[step,setStep]=useState('identity'),[busy,setBusy]=useState(false),[identity,setIdentity]=useState(null);
  async function enter(e){
    e.preventDefault();setError('');
    const form=new FormData(e.currentTarget);
    setBusy(true);
    try{
      if(step==='code'){
        const person=await cloud.verifyCode(identity.email,form.get('code').trim(),identity.name);
        onEnter(person);return;
      }
      const person=administratorFor(form.get('name'),form.get('nickname'));
      if(!person)throw Error('이름과 별명 조합을 확인해 주세요.');
      if(!cloud){onEnter(person);return}
      const email=form.get('email').trim();
      await cloud.sendCode(email);setIdentity({email,name:person.name});setStep('code');
    }catch(error){setError(error.message||'인증을 완료하지 못했습니다. 다시 시도해 주세요.')}
    finally{setBusy(false)}
  }
  return <main className="access-page">
    <a className="access-brand" href="#"><img src={heartIcon} alt="" width="43" height="43"/><span>our chapter</span></a>
    <section className="access-card" aria-labelledby="access-title">
      <div className="access-illustration" aria-hidden="true"><Heart size={32} strokeWidth={1.3}/><span>OUR NEXT CHAPTER</span></div>
      <div className="eyebrow">송윤오 ♥ 박예은</div>
      <h1 id="access-title">우리의 결혼 준비에<br/><i>오신 것을 환영해요.</i></h1>
      <p className="access-description">함께 준비하는 두 사람은 이름과 별명으로,<br/>소중한 손님은 게스트로 들어오세요.</p>
      <form onSubmit={enter} onChange={()=>setError('')}>
        {step==='identity'?<>
          <label htmlFor="access-name">이름</label>
          <input id="access-name" name="name" autoComplete="off" required maxLength={40} placeholder="이름을 입력해 주세요" aria-describedby={error?'access-error':undefined}/>
          <label htmlFor="access-nickname">별명</label>
          <input id="access-nickname" name="nickname" autoComplete="off" required maxLength={40} placeholder="함께 정한 별명을 입력해 주세요" aria-describedby={error?'access-error':undefined}/>
          {cloud&&<><label htmlFor="access-email">관리자 이메일</label><input id="access-email" name="email" type="email" autoComplete="email" required placeholder="등록된 이메일 주소"/></>}
        </>:<>
          <p className="code-description">{identity.email}로 인증 메일을 보냈습니다.</p>
          <label htmlFor="access-code">이메일 인증 코드</label>
          <input autoFocus id="access-code" name="code" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={10} placeholder="메일에 있는 인증 코드"/>
          <button className="text-button code-back" type="button" disabled={busy} onClick={()=>{setStep('identity');setError('')}}>이메일 다시 입력</button>
        </>}
        {error&&<p className="access-error" id="access-error" role="alert">{error}</p>}
        <button disabled={busy} className="primary-button access-submit" type="submit"><LockKeyhole size={16}/> {busy?'확인 중…':step==='code'?'인증하고 들어가기':cloud?'인증 메일 받기':'관리자로 들어가기'} <ArrowRight size={16}/></button>
      </form>
      <div className="access-divider"><span>또는</span></div>
      <button className="outline-button access-guest" onClick={()=>onEnter({role:'guest',name:'게스트'})}><UserRound size={16}/> 게스트로 보기</button>
      <p className="access-caption">게스트는 준비 내용을 읽기 전용으로 볼 수 있어요.{cloud&&<><br/>관리자 편집은 이메일 인증 후 사용할 수 있습니다.</>}</p>
    </section>
    <p className="access-footer">A day to remember. A lifetime to love.</p>
  </main>;
}
