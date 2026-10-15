import React, {useEffect, useRef, useState} from 'react';
import {Check, Eye, ImagePlus, LockKeyhole, MoveDown, MoveUp, X} from 'lucide-react';
import Invitation, {withInvitationPhotos} from './Invitation.jsx';
import {getInvitation, saveInvitation} from './invitation-model.js';
import {venue} from './venue.js';

function Preview({invitation,onClose,invitationUrl}) {
  const ref = useRef(null);
  useEffect(() => {const previous=document.activeElement,dialog=ref.current;dialog.showModal();return () => {dialog.close();if(previous?.isConnected) previous.focus()}},[]);
  return <dialog ref={ref} className="invitation-editor-preview-dialog" aria-label="모바일 청첩장 미리보기" onCancel={event => {event.preventDefault();onClose()}}><Invitation invitation={invitation} onLeave={onClose} invitationUrl={invitationUrl}/></dialog>;
}

export default function InvitationEditor({data,onChange,onUploadPhoto,invitationUrl}) {
  const [values,setValues] = useState(() => getInvitation(data)),[dirty,setDirty] = useState(false),[pending,setPending] = useState(''),[error,setError] = useState(''),[status,setStatus] = useState(''),[preview,setPreview] = useState(false);
  const settingsKey = JSON.stringify(getInvitation(data));
  useEffect(() => {if (!dirty) setValues(getInvitation(data))},[settingsKey,dirty]);
  function field(key,value) {setValues(current=>({...current,[key]:value}));setDirty(true);setError('');setStatus('')}
  async function save(event) {
    event.preventDefault();setPending('save');setError('');setStatus('');
    const fields={...values};
    for (const key of ['groom','bride','greeting','directionsNote','contactGroom','contactBride']) fields[key]=fields[key].trim();
    try {if(await onChange(current=>saveInvitation(current,fields))) {setValues(fields);setDirty(false);setStatus('청첩장을 저장했어요. 공유한 링크에도 같은 내용이 표시됩니다.')} else setError('저장하지 못했습니다. 연결 상태와 상단 안내를 확인해 주세요.')}
    catch(error) {setError(error.message)} finally {setPending('')}
  }
  async function upload(event,kind) {
    const files=Array.from(event.target.files || []);event.target.value='';if(!files.length)return;
    if (!onUploadPhoto) {setError('사진 업로드를 사용할 수 없습니다. 연결 상태를 확인해 주세요.');return}
    if(kind==='gallery' && values.gallery.length+files.length>12) {setError('갤러리에는 사진을 최대 12장까지 넣을 수 있어요. 기존 사진을 삭제한 뒤 추가해 주세요.');return}
    setPending(kind);setError('');setStatus('');
    try {
      for(const file of files) {
        const photo=await onUploadPhoto(file,{kind});
        if(!photo?.id || !photo.url) throw new Error('사진 업로드 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
        setValues(current=>({...current,[kind==='hero'?'heroPhoto':'gallery']:kind==='hero'?{...photo,alt:photo.alt||`${current.groom}와 ${current.bride}의 웨딩 사진`}: [...current.gallery,{...photo,alt:photo.alt||`우리의 웨딩 사진 ${current.gallery.length+1}`}]}));setDirty(true);
      }
      setStatus('사진을 추가했어요. ‘청첩장 저장’을 눌러 공개 청첩장에 반영해 주세요.');
    } catch(error){setError(error.message || '사진을 업로드하지 못했습니다. 다시 시도해 주세요.')} finally {setPending('')}
  }
  function galleryAlt(id,alt) {field('gallery',values.gallery.map(photo=>photo.id===id?{...photo,alt}:photo))}
  function movePhoto(index,delta) {const gallery=[...values.gallery];[gallery[index],gallery[index+delta]]=[gallery[index+delta],gallery[index]];field('gallery',gallery)}
  const blocked=!!pending,displayPhotos=withInvitationPhotos(values);
  return <div className="invitation-editor"><section className="invitation-editor-intro"><div><span className="eyebrow">OUR WEDDING INVITATION</span><h2>우리가 전하는, 한 장의 초대</h2><p>이름과 초대 글, 예식 일시와 사진을 채워 모바일 청첩장을 만들어 보세요. 게스트는 청첩장만 보게 됩니다. 예산·하객·여행 등 준비 기록은 관리자 화면에서 관리합니다.</p></div><button type="button" className="outline-button" disabled={blocked} onClick={()=>setPreview(true)}><Eye size={16}/> 청첩장 미리보기</button></section>
    <form onSubmit={save} className="invitation-editor-form"><fieldset disabled={blocked}><div className="invitation-editor-layout"><div className="invitation-editor-form"><section className="card"><fieldset><legend>우리의 이름과 예식 일시</legend><div className="invitation-editor-grid"><label>신랑 이름<input required maxLength={40} value={values.groom} onChange={event=>field('groom',event.target.value)}/></label><label>신부 이름<input required maxLength={40} value={values.bride} onChange={event=>field('bride',event.target.value)}/></label></div><div className="invitation-editor-grid"><label>예식 날짜<input type="date" value={values.date} onChange={event=>field('date',event.target.value)}/></label><label>예식 시간<input type="time" value={values.time} onChange={event=>field('time',event.target.value)}/></label></div><p className="invitation-editor-help">이름과 날짜를 저장하면 결혼 준비 화면에도 함께 반영됩니다. 아직 정하지 않은 일시는 비워둘 수 있어요.</p><div className="invitation-editor-static"><strong>{venue.name} · {venue.floor} {venue.hall}</strong><p>{venue.address} {venue.building}</p></div></fieldset></section><section className="card"><fieldset><legend>마음을 담은 초대 글</legend><label>초대 글<textarea aria-label="초대 글" rows={7} maxLength={3000} value={values.greeting} onChange={event=>field('greeting',event.target.value)}/></label><label>추가 교통 안내<textarea aria-label="추가 교통 안내" rows={4} maxLength={2000} value={values.directionsNote} onChange={event=>field('directionsNote',event.target.value)} placeholder="하객에게 따로 전할 주차·셔틀 안내가 있다면 적어 주세요."/></label><div className="invitation-editor-grid"><label>신랑 연락처<input type="tel" maxLength={40} value={values.contactGroom} onChange={event=>field('contactGroom',event.target.value)} placeholder="선택 · 010-0000-0000"/></label><label>신부 연락처<input type="tel" maxLength={40} value={values.contactBride} onChange={event=>field('contactBride',event.target.value)} placeholder="선택 · 010-0000-0000"/></label></div><p className="invitation-editor-help">연락처는 입력한 경우에만 청첩장에 공개됩니다.</p></fieldset></section></div>
    <div className="invitation-editor-form invitation-editor-photos"><section className="card"><fieldset><legend>대표 사진</legend><p className="invitation-editor-help">지금은 실제 브리에홀 사진으로 시작합니다. 두 분의 사진을 준비하면 바꿔 주세요.</p><figure className="invitation-editor-cover"><img src={displayPhotos.heroPhoto.url} alt={displayPhotos.heroPhoto.alt}/></figure><label>대표 사진 업로드<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="대표 사진 업로드" onChange={event=>upload(event,'hero')}/></label>{values.heroPhoto ? <label>대표 사진 설명<input maxLength={200} value={values.heroPhoto.alt} onChange={event=>field('heroPhoto',{...values.heroPhoto,alt:event.target.value})} placeholder="사진을 보지 못하는 분께 설명해 주세요."/></label> : null}<p className="invitation-editor-help">장당 10MB 이하의 JPG·PNG·WebP·AVIF 사진을 사용할 수 있어요. 업로드한 사진은 청첩장 링크를 받은 누구나 볼 수 있습니다.</p></fieldset></section><section className="card"><fieldset><legend>사진 갤러리 <span className="invitation-editor-help">{values.gallery.length} / 12</span></legend><p className="invitation-editor-help">사진을 등록하지 않으면 식장 사진이 표시됩니다. 두 분의 사진을 올리면 갤러리를 바꿀 수 있어요. 화살표로 순서를 정해 주세요.</p>{!values.gallery.length ? <div className="invitation-editor-default-photos">{displayPhotos.gallery.map(photo=><img key={photo.id} src={photo.url} alt={photo.alt} loading="lazy"/>)}</div> : null}<div className="invitation-editor-photo-list">{values.gallery.map((photo,index)=><div className="invitation-editor-photo" key={photo.id}><img src={photo.url} alt={photo.alt} loading="lazy"/><button type="button" aria-label={`갤러리 사진 ${index+1} 삭제`} onClick={()=>field('gallery',values.gallery.filter(item=>item.id!==photo.id))}><X size={15}/></button><label>사진 {index+1} 설명<input maxLength={200} value={photo.alt} onChange={event=>galleryAlt(photo.id,event.target.value)}/></label><div className="invitation-editor-photo-actions"><button type="button" disabled={index===0} aria-label={`갤러리 사진 ${index+1} 앞으로 이동`} onClick={()=>movePhoto(index,-1)}><MoveUp size={13}/> 앞으로</button><button type="button" disabled={index===values.gallery.length-1} aria-label={`갤러리 사진 ${index+1} 뒤로 이동`} onClick={()=>movePhoto(index,1)}>뒤로 <MoveDown size={13}/></button></div></div>)}</div><label><ImagePlus size={14}/> 갤러리 사진 업로드<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" aria-label="갤러리 사진 업로드" disabled={values.gallery.length>=12} onChange={event=>upload(event,'gallery')}/></label></fieldset></section><aside className="invitation-editor-preview-note"><LockKeyhole size={18}/><p><strong>청첩장에 넣은 정보만 공개됩니다.</strong><br/>사진·초대 글·예식 일시·입력한 연락처는 링크를 받은 분이 볼 수 있어요. 계약서나 개인정보가 담긴 사진은 올리지 마세요.</p></aside></div></div></fieldset>
    {error ? <p className="invitation-editor-feedback error" role="alert">{error}</p> : null}{status ? <p className="invitation-editor-feedback" role="status">{status}</p> : null}<div className="invitation-editor-save"><p>{pending==='hero'||pending==='gallery' ? '사진을 업로드하고 있어요…' : dirty ? '작성한 내용은 저장한 뒤 청첩장에 반영됩니다.' : '저장한 청첩장을 미리 보고 링크로 전해 보세요.'}</p><button className="primary-button" disabled={blocked}>{pending==='save'?'저장 중…':'청첩장 저장'}<Check size={16}/></button></div></form>{preview ? <Preview invitation={values} onClose={()=>setPreview(false)} invitationUrl={invitationUrl}/> : null}</div>;
}
