import React,{useState} from 'react';
import {ArrowRight,Heart,UserRound,LockKeyhole} from 'lucide-react';
import {administratorFor} from './access';
import heartIcon from './assets/heart.svg';

export default function AccessGate({onEnter}) {
  const [error,setError]=useState('');
  function enter(e){
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const person=administratorFor(form.get('name'),form.get('nickname'));
    if(!person){setError('이름과 별명 조합을 확인해 주세요.');return}
    onEnter(person);
  }
  return <main className="access-page">
    <a className="access-brand" href="#"><img src={heartIcon} alt="" width="43" height="43"/><span>our chapter</span></a>
    <section className="access-card" aria-labelledby="access-title">
      <div className="access-illustration" aria-hidden="true"><Heart size={32} strokeWidth={1.3}/><span>OUR NEXT CHAPTER</span></div>
      <div className="eyebrow">송윤오 ♥ 박예은</div>
      <h1 id="access-title">우리의 결혼 준비에<br/><i>오신 것을 환영해요.</i></h1>
      <p className="access-description">함께 준비하는 두 사람은 이름과 별명으로,<br/>소중한 손님은 게스트로 들어오세요.</p>
      <form onSubmit={enter} onChange={()=>setError('')}>
        <label htmlFor="access-name">이름</label>
        <input id="access-name" name="name" autoComplete="off" required maxLength={40} placeholder="이름을 입력해 주세요" aria-describedby={error?'access-error':undefined}/>
        <label htmlFor="access-nickname">별명</label>
        <input id="access-nickname" name="nickname" autoComplete="off" required maxLength={40} placeholder="함께 정한 별명을 입력해 주세요" aria-describedby={error?'access-error':undefined}/>
        {error&&<p className="access-error" id="access-error" role="alert">{error}</p>}
        <button className="primary-button access-submit" type="submit"><LockKeyhole size={16}/> 관리자로 들어가기 <ArrowRight size={16}/></button>
      </form>
      <div className="access-divider"><span>또는</span></div>
      <button className="outline-button access-guest" onClick={()=>onEnter({role:'guest',name:'게스트'})}><UserRound size={16}/> 게스트로 보기</button>
      <p className="access-caption">게스트는 준비 내용을 읽기 전용으로 볼 수 있어요.</p>
    </section>
    <p className="access-footer">A day to remember. A lifetime to love.</p>
  </main>;
}
