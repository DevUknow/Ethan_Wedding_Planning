import React, {useEffect, useRef, useState} from 'react';
import {ArrowDown, CalendarPlus, Check, ChevronLeft, ChevronRight, Copy, Heart, MapPin, Phone, Share2, TrainFront, CarFront, X} from 'lucide-react';
import {venue} from './venue.js';
import './invitation.css';

export const invitationVenuePhotos = {
  heroPhoto:{id:'venue-cover',url:venue.photo,alt:'우리가 예식을 올릴 더파티움 안양 5층 브리에홀 전경'},
  gallery:venue.photos.map(photo => ({id:`venue-${photo.id}`,url:photo.src,alt:photo.alt})),
};

export function withInvitationPhotos(invitation) {
  return {...invitation,heroPhoto:invitation.heroPhoto || invitationVenuePhotos.heroPhoto,gallery:invitation.gallery?.length ? invitation.gallery : invitationVenuePhotos.gallery};
}

function Botanical({className=''}) {
  return <svg className={`invitation-botanical ${className}`} viewBox="0 0 170 170" fill="none" aria-hidden="true"><path d="M34 152C78 122 116 76 136 16M56 136c-1-25 3-50 17-67m10 42c22-1 44-10 62-24m-42-3c-5-20-3-37 6-54" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M56 129C34 110 29 92 36 79c17 9 25 26 20 50Zm18-27C55 87 51 70 58 58c15 9 21 25 16 44Zm17 5c25-22 45-27 59-20-12 19-33 26-59 20Zm14-31c-17-19-20-37-10-50 13 14 16 30 10 50Zm12-21c18-17 35-21 47-15-9 14-25 20-47 15Z" fill="currentColor" fillOpacity=".22"/><g transform="translate(123 25)"><path d="M0 0C-18-7-18-24-7-23 3-23 6-11 0 0Zm0 0c2-19 18-25 21-14C25-4 13 2 0 0Zm0 0c19-4 29 8 20 15C11 22 2 12 0 0Zm0 0C8 18-2 31-11 23-19 15-11 4 0 0Zm0 0c-17 9-31 0-23-10C-16-18-4-10 0 0Z" fill="#c4b493" fillOpacity=".5"/><circle r="3" fill="#a8946f"/></g></svg>;
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year,month,day] = value.split('-').map(Number);
  const result = new Date(year,month-1,day);
  return result.getFullYear() === year && result.getMonth() === month-1 && result.getDate() === day ? result : null;
}

function dateText(date,time) {
  if (!date) return '';
  const day = date.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  if (!time) return day;
  const [hour,minute] = time.split(':').map(Number);
  return `${day} ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시${minute ? ` ${minute}분` : ''}`;
}

function PhotoLightbox({photos,index,onChange,onClose}) {
  const ref = useRef(null),photo = photos[index];
  useEffect(() => {
    const previous = document.activeElement,dialog = ref.current;
    dialog.showModal();
    return () => {dialog.close();if (previous?.isConnected) previous.focus()};
  }, []);
  function move(delta) {onChange((index+delta+photos.length)%photos.length)}
  return <dialog ref={ref} className="invitation-lightbox" aria-label="청첩장 사진 크게 보기" onCancel={event => {event.preventDefault();event.stopPropagation();onClose()}} onClick={event => {if (event.target === event.currentTarget) onClose()}} onKeyDown={event => {if (event.key === 'ArrowLeft') {event.preventDefault();move(-1)} if (event.key === 'ArrowRight') {event.preventDefault();move(1)}}}><div className="invitation-lightbox-bar"><span>{index+1} / {photos.length}</span><button type="button" aria-label="사진 닫기" onClick={onClose}><X size={24}/></button></div><img src={photo.url} alt={photo.alt}/><div className="invitation-lightbox-bottom">{photos.length > 1 ? <button type="button" aria-label="이전 사진" onClick={() => move(-1)}><ChevronLeft size={24}/></button> : <span/>}<p>{photo.alt}</p>{photos.length > 1 ? <button type="button" aria-label="다음 사진" onClick={() => move(1)}><ChevronRight size={24}/></button> : <span/>}</div></dialog>;
}

function WeddingCalendar({date,time,groom,bride}) {
  const firstDay = new Date(date.getFullYear(),date.getMonth(),1).getDay();
  const lastDate = new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  function downloadCalendar() {
    const day = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
    const escape = value => value.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const start = time ? `DTSTART;TZID=Asia/Seoul:${day}T${time.replace(':','')}00` : `DTSTART;VALUE=DATE:${day}`;
    const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const contents = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Our Chapter//Wedding Invitation//KO','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:wedding-${day}@our-chapter`,`DTSTAMP:${stamp}`,start,`SUMMARY:${escape(`${groom} ♥ ${bride} 결혼식`)}`,`LOCATION:${escape(`${venue.name} ${venue.floor} ${venue.hall}, ${venue.address}`)}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
    const url = URL.createObjectURL(new Blob([contents],{type:'text/calendar;charset=utf-8'})),anchor = document.createElement('a');
    anchor.href=url;anchor.download='우리의-결혼식.ics';anchor.click();setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  return <section className="invitation-section invitation-calendar" aria-labelledby="invitation-date-title"><span className="invitation-kicker">SAVE THE DATE</span><h2 id="invitation-date-title">우리의 소중한 날</h2><p className="invitation-date-line">{dateText(date,time)}</p><div className="invitation-month"><strong>{date.getFullYear()}. {String(date.getMonth()+1).padStart(2,'0')}</strong><div className="invitation-calendar-grid" aria-label={`${date.getMonth()+1}월 달력`}>{['일','월','화','수','목','금','토'].map((day,index) => <span className={`invitation-weekday ${index===0?'sunday':''}`} key={day}>{day}</span>)}{Array.from({length:firstDay},(_,index) => <span key={`blank-${index}`} aria-hidden="true"/>)}{Array.from({length:lastDate},(_,index) => <span key={index} className={`${index+1===date.getDate()?'wedding-date':''} ${(firstDay+index)%7===0?'sunday':''}`} aria-label={index+1===date.getDate()?`${index+1}일 결혼식`:undefined}>{index+1}</span>)}</div></div><button type="button" className="invitation-button" onClick={downloadCalendar}><CalendarPlus size={16}/> 캘린더에 저장</button></section>;
}

export default function Invitation({invitation,onAdminEnter,onLeave,invitationUrl}) {
  const settings = withInvitationPhotos(invitation),date = parseDate(settings.date);
  const photos = [settings.heroPhoto,...settings.gallery].filter((photo,index,array) => photo && array.findIndex(item => item?.id === photo.id) === index);
  const [photoIndex,setPhotoIndex] = useState(null),[copyStatus,setCopyStatus] = useState(''),[shareStatus,setShareStatus] = useState('');
  const isVenueCover = settings.heroPhoto?.id.startsWith('venue-');
  async function copyAddress() {
    try {await navigator.clipboard.writeText(`${venue.name} ${venue.address} ${venue.building} ${venue.floor} ${venue.hall}`);setCopyStatus('주소를 복사했어요.')} catch {setCopyStatus('아래 주소를 길게 눌러 복사해 주세요.')}
  }
  async function shareInvitation() {
    const url = invitationUrl || `${window.location.origin}${window.location.pathname}?invite=1`;
    try {
      if (navigator.share) {await navigator.share({title:`${settings.groom} ♥ ${settings.bride} 결혼합니다`,text:'소중한 날, 함께해 주세요.',url});setShareStatus('')}
      else {await navigator.clipboard.writeText(url);setShareStatus('청첩장 링크를 복사했어요.')}
    } catch(error) {if (error.name !== 'AbortError') setShareStatus('공유하지 못했어요. 주소창의 링크를 복사해 주세요.')}
  }
  const days = date ? Math.round((date-new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()))/86400000) : null;
  return <main className="invitation-page"><article className="invitation-paper" aria-label={`${settings.groom} ${settings.bride} 모바일 청첩장`}>
    {onLeave ? <div className="invitation-preview-bar"><span>청첩장 미리보기</span><button type="button" onClick={onLeave}><X size={16}/> 미리보기 닫기</button></div> : null}
    <header className="invitation-cover"><div className="invitation-cover-top"><span>THE WEDDING OF</span><p>{settings.groom}<Heart size={12} fill="currentColor"/>{settings.bride}</p></div><button className="invitation-cover-photo" type="button" onClick={() => setPhotoIndex(0)} aria-label="대표 사진 크게 보기"><img src={settings.heroPhoto.url} alt={settings.heroPhoto.alt} width="1440" height="959" fetchPriority="high"/><span className="invitation-photo-veil"/></button><div className="invitation-cover-bottom"><Botanical/><p className="invitation-cover-script">Our beautiful beginning</p><h1>우리, 결혼합니다</h1><p className="invitation-cover-date">{date ? dateText(date,settings.time) : '소중한 날, 함께해 주세요'}</p><p className="invitation-cover-venue">{venue.name} · {venue.floor} {venue.hall}</p>{isVenueCover ? <span className="invitation-venue-caption">우리의 시작을 함께할 브리에홀</span> : null}<a href="#invitation-message" className="invitation-scroll" aria-label="초대 글로 내려가기"><ArrowDown size={17}/></a></div></header>
    <section className="invitation-section invitation-message" id="invitation-message" aria-labelledby="invitation-message-title"><Botanical/><span className="invitation-kicker">INVITATION</span><h2 id="invitation-message-title">함께하는 첫날에<br/>초대합니다</h2><p className="invitation-greeting">{settings.greeting}</p><div className="invitation-signatures"><p><small>신랑</small><strong>{settings.groom}</strong></p><span>&</span><p><small>신부</small><strong>{settings.bride}</strong></p></div>{settings.contactGroom || settings.contactBride ? <div className="invitation-contact">{settings.contactGroom ? <a href={`tel:${settings.contactGroom.replace(/[ -]/g,'')}`}><Phone size={14}/> 신랑에게 연락하기</a> : null}{settings.contactBride ? <a href={`tel:${settings.contactBride.replace(/[ -]/g,'')}`}><Phone size={14}/> 신부에게 연락하기</a> : null}</div> : null}</section>
    {date ? <WeddingCalendar date={date} time={settings.time} groom={settings.groom} bride={settings.bride}/> : null}
    {settings.gallery.length ? <section className="invitation-section invitation-gallery" aria-labelledby="invitation-gallery-title"><span className="invitation-kicker">OUR MOMENTS</span><h2 id="invitation-gallery-title">{settings.gallery.every(photo => photo.id.startsWith('venue-')) ? '우리의 날이 머물 공간' : '함께한 순간들'}</h2><div className="invitation-photo-grid">{settings.gallery.map(photo => <button key={photo.id} type="button" onClick={() => setPhotoIndex(photos.findIndex(item => item.id===photo.id))} aria-label={`${photo.alt} 크게 보기`}><img src={photo.url} alt={photo.alt} loading="lazy" width="600" height="750"/></button>)}</div>{settings.gallery.every(photo => photo.id.startsWith('venue-')) ? <p className="invitation-photo-credit">사진 · 더파티움 안양</p> : null}</section> : null}
    <section className="invitation-section invitation-location" aria-labelledby="invitation-location-title"><span className="invitation-kicker">LOCATION</span><h2 id="invitation-location-title">오시는 길</h2><MapPin className="invitation-location-pin" size={24}/><h3>{venue.name}</h3><p className="invitation-hall">{venue.floor} {venue.hall}</p><address>{venue.address}<br/>{venue.building}</address><a className="invitation-venue-phone" href={`tel:${venue.phone}`}><Phone size={13}/>{venue.phone}</a><div className="invitation-map-card" aria-hidden="true"><div className="invitation-map-road road-horizontal"/><div className="invitation-map-road road-vertical"/><span className="invitation-map-station">평촌역 3번 출구</span><span className="invitation-map-cross">횡단보도</span><span className="invitation-map-hall"><MapPin size={19} fill="currentColor"/><strong>더파티움 안양</strong></span><span className="invitation-map-street">시민대로</span></div><p className="invitation-map-caption">이해를 돕기 위한 약도입니다. 정확한 길은 지도로 확인해 주세요.</p><div className="invitation-map-buttons"><a href={venue.mapUrl} target="_blank" rel="noopener noreferrer">네이버 지도<span className="sr-only"> 새 창</span></a><a href={`https://map.kakao.com/?q=${encodeURIComponent(venue.name+' '+venue.address)}`} target="_blank" rel="noopener noreferrer">카카오맵<span className="sr-only"> 새 창</span></a><button type="button" onClick={copyAddress}>{copyStatus.startsWith('주소를 복사했') ? <Check size={13}/> : <Copy size={13}/>} 주소 복사</button></div><p className="invitation-feedback" role="status">{copyStatus}</p><div className="invitation-transport"><div><TrainFront size={18}/><h3>대중교통</h3><p>지하철 4호선 평촌역 3번 출구<br/>횡단보도 맞은편에 있습니다.<br/>버스 이용 시 ‘평촌역’에서 하차해 주세요.</p></div><div><CarFront size={18}/><h3>주차 안내</h3><p>본 건물 지하주차장을 이용해 주세요.<br/>제휴 주차장 위치와 당일 이용 조건은<br/>웨딩홀 공식 안내를 확인해 주세요.</p><a href={venue.locationUrl} target="_blank" rel="noopener noreferrer">교통·주차 상세 안내<span className="sr-only"> 새 창</span></a></div>{settings.directionsNote ? <div className="invitation-directions-note"><MapPin size={17}/><h3>더 전하는 안내</h3><p>{settings.directionsNote}</p></div> : null}</div></section>
    <section className="invitation-closing"><Botanical/><Heart size={19} strokeWidth="1"/><p>귀한 걸음으로 축복해 주시는<br/>모든 분께 감사드립니다.</p><strong>{settings.groom} & {settings.bride}</strong>{days !== null ? <span className="invitation-days">{days > 0 ? `우리의 결혼식까지 ${days}일` : days===0 ? '오늘, 우리 결혼합니다' : '함께해 주셔서 감사합니다'}</span> : null}</section>
    <div className="invitation-share"><button type="button" className="invitation-button" onClick={shareInvitation}><Share2 size={15}/> 청첩장 공유하기</button><p className="invitation-feedback" role="status">{shareStatus}</p></div><footer className="invitation-footer"><span>OUR CHAPTER · WITH LOVE</span>{onAdminEnter ? <button type="button" onClick={onAdminEnter}>관리자 로그인</button> : null}</footer>
  </article>{photoIndex !== null && photos[photoIndex] ? <PhotoLightbox photos={photos} index={photoIndex} onChange={setPhotoIndex} onClose={() => setPhotoIndex(null)}/> : null}</main>;
}
