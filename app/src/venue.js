import hallPhoto from './assets/venue/briller-hall.webp';
import chandelierPhoto from './assets/venue/chandelier.webp';
import flowersPhoto from './assets/venue/flowers.webp';
import brideRoomPhoto from './assets/venue/bride-room.webp';

export const venue = {
  name: '더파티움 안양',
  hall: '브리에홀',
  floor: '5층',
  address: '경기도 안양시 동안구 시민대로 311',
  building: '금강스마트빌딩',
  phone: '031-731-5000',
  mood: '어두운 홀 · 샹들리에 · 생화 장식',
  photo: hallPhoto,
  officialUrl: 'https://www.thepartyumanyang.com/Briller',
  locationUrl: 'https://www.thepartyumanyang.com/location',
  faqUrl: 'https://www.thepartyumanyang.com/FAQ',
  mapUrl: `https://map.naver.com/p/search/${encodeURIComponent('더파티움 안양 시민대로 311')}`,
  photos: [
    {id: 'chandelier', src: chandelierPhoto, width: 960, height: 689, title: '샹들리에의 빛', alt: '어두운 브리에홀 천장에 반짝이는 크리스털 샹들리에', text: '어두운 공간 위로 반짝이는 조명이 더하는 깊이.'},
    {id: 'flowers', src: flowersPhoto, width: 960, height: 640, title: '생화와 테이블 장식', alt: '브리에홀 테이블을 채운 생화와 따뜻한 촛불 장식', text: '풍성한 꽃과 따뜻한 빛이 함께하는 예식 공간.'},
    {id: 'bride-room', src: brideRoomPhoto, width: 960, height: 639, title: '브리에홀 신부대기실', alt: '큰 창과 꽃으로 꾸며진 밝은 브리에홀 신부대기실', text: '본식 전 소중한 분들과 인사를 나누는 공간.'},
  ],
  parking: [
    {name: '제1주차장 · 본 건물', address: '동안구 시민대로 311', note: '지하주차장'},
    {name: '제2주차장 · 지아이에스', address: '동안구 부림로 146', note: '구 네온테크 · 토·일 이용 가능, 공휴일 이용 불가'},
    {name: '제3주차장 · 이마트 평촌점', address: '동안구 시민대로 300', note: ''},
    {name: '제4주차장 · 평촌 칼라힐', address: '동안구 시민대로 312', note: '하이파킹 주차타워 · 2층부터 주차 가능'},
  ],
};
