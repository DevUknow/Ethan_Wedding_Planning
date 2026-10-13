import React, {useState} from 'react';
import {ArrowUpRight, ArrowRight, MapPin, Phone, TrainFront, CarFront, Copy, Check, Sparkles} from 'lucide-react';
import {venue} from './venue';
import './venue.css';

function ExternalLink({href, children, className = 'text-button'}) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={15}/><span className="sr-only"> (새 창)</span></a>;
}

export function VenuePreview({onOpen}) {
  return <section className="venue-section" aria-labelledby="venue-preview-title">
    <div className="section-heading">
      <div><h3 id="venue-preview-title">우리가 함께할 웨딩홀</h3><p>더파티움 안양, 5층 브리에홀에서 시작하는 우리의 다음 장.</p></div>
      <button className="text-button" onClick={onOpen}>웨딩홀 소개 보기 <ArrowUpRight size={15}/></button>
    </div>
    <button className="venue-preview" onClick={onOpen} aria-label="더파티움 안양 5층 브리에홀 소개 보기">
      <img src={venue.photo} alt="샹들리에와 생화로 꾸며진 어두운 브리에홀 전경" width="1440" height="959" loading="lazy"/>
      <span className="venue-preview-copy"><span className="eyebrow">OUR WEDDING VENUE · 5F</span><strong>{venue.name}<br/>{venue.hall}</strong><span>{venue.mood}</span><span className="venue-preview-address"><MapPin size={14}/>{venue.address}</span><span className="venue-preview-cta">빛과 꽃으로 채워질 우리의 하루 <ArrowRight size={18}/></span></span>
    </button>
  </section>;
}

export function VenueDetails() {
  const [copyStatus, setCopyStatus] = useState('');
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(`${venue.name} ${venue.address} ${venue.building} ${venue.floor} ${venue.hall}`);
      setCopyStatus('주소를 복사했습니다.');
    } catch {
      setCopyStatus('주소를 복사하지 못했습니다. 아래 주소를 선택해 복사해 주세요.');
    }
  }
  return <div className="venue-details">
    <section className="venue-hero" aria-labelledby="venue-hall-title">
      <div className="venue-hero-copy">
        <span className="venue-badge"><MapPin size={13}/> 우리의 예식 장소 · 5F</span>
        <p className="eyebrow">THE PARTYUM ANYANG</p>
        <h2 id="venue-hall-title">{venue.hall}<span>Briller Hall</span></h2>
        <p className="venue-intro">어두운 홀을 채우는<br/>빛과 꽃의 순간.</p>
        <p className="venue-description">샹들리에의 반짝임과 생화 장식이 어우러지는 공간. 우리가 함께할 결혼식은 더파티움 안양 5층 브리에홀에서 열립니다.</p>
        <ExternalLink href={venue.officialUrl} className="venue-official-link">공식 홀 소개</ExternalLink>
      </div>
      <figure className="venue-hero-photo"><img src={venue.photo} alt="어두운 브리에홀의 샹들리에와 생화 장식, 중앙 버진로드 전경" width="1440" height="959" fetchPriority="high"/><figcaption>더파티움 안양 · 5F BRILLER HALL</figcaption></figure>
    </section>

    <dl className="venue-facts">
      <div><dt>웨딩홀</dt><dd>{venue.name}</dd></div>
      <div><dt>예식 장소</dt><dd>{venue.floor} {venue.hall}</dd></div>
      <div><dt>홀 분위기</dt><dd>어두운 홀 · 호텔 예식 분위기</dd></div>
    </dl>

    <section className="venue-gallery-section" aria-labelledby="venue-gallery-title">
      <div className="section-heading"><div><h3 id="venue-gallery-title">브리에홀에서 맞이할 하루</h3><p>우리의 순간이 머물 공간을 미리 둘러보세요.</p></div><span className="venue-photo-credit">사진 · 더파티움 안양</span></div>
      <div className="venue-gallery">{venue.photos.map(photo => <figure className="venue-photo-card" key={photo.id}><img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy"/><figcaption><h4>{photo.title}</h4><p>{photo.text}</p></figcaption></figure>)}</div>
      <div className="venue-features"><Sparkles size={18}/><p>샹들리에와 생화 장식, 측면 미디어월·아트스크린이 어우러지는 예식 공간입니다.</p></div>
    </section>

    <div className="venue-travel-grid">
      <section className="card venue-location" aria-labelledby="venue-location-title">
        <div className="section-heading"><h3 id="venue-location-title"><MapPin size={18}/> 오시는 길</h3></div>
        <p className="venue-location-name">{venue.name} · {venue.floor} {venue.hall}</p>
        <address>{venue.address}<br/>{venue.building} {venue.floor}</address>
        <div className="venue-actions"><ExternalLink href={venue.mapUrl} className="primary-button"><MapPin size={15}/> 네이버 지도</ExternalLink><button className="outline-button" onClick={copyAddress}>{copyStatus === '주소를 복사했습니다.' ? <Check size={15}/> : <Copy size={15}/>} 주소 복사</button></div>
        <p className="venue-copy-status" role="status">{copyStatus}</p>
        <div className="venue-transit"><TrainFront size={18}/><div><h4>지하철·버스</h4><p>지하철 4호선 평촌역 3번 출구, 횡단보도 맞은편.<br/>버스 이용 시 ‘평촌역’ 정류장에서 하차하세요.</p></div></div>
        <div className="venue-transit"><CarFront size={18}/><div><h4>자가용</h4><p>내비게이션에 ‘더파티움 안양’ 또는 ‘시민대로 311’을 검색하세요.</p></div></div>
        <a className="venue-phone" href={`tel:${venue.phone}`}><Phone size={16}/> {venue.phone}<span>웨딩홀 문의</span></a>
      </section>
      <section className="card venue-parking" aria-labelledby="venue-parking-title">
        <div className="section-heading"><h3 id="venue-parking-title"><CarFront size={18}/> 주차 안내</h3><span className="tag">공식 FAQ 기준 2시간 무료</span></div>
        <ul>{venue.parking.map(parking => <li key={parking.name}><h4>{parking.name}</h4><p>{parking.address}</p>{parking.note ? <small>{parking.note}</small> : null}</li>)}</ul>
        <p className="venue-parking-note">주차장별 이용 조건과 당일 안내는 방문 전 확인해 주세요.</p>
        <ExternalLink href={venue.locationUrl}>공식 교통·주차 안내</ExternalLink>
      </section>
    </div>
    <div className="venue-source-note"><p>홀 소개·사진·교통 정보는 더파티움 안양 공식 안내를 참고했습니다.</p><ExternalLink href={venue.faqUrl}>자주 묻는 질문</ExternalLink></div>
  </div>;
}
