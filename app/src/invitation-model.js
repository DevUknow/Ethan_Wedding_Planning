// Keep this boundary independent from the planning model: a public invitation
// must never inherit the private document's budget, guests, notes or records.
const settingsFields = ['groom','bride','time','greeting','heroPhoto','gallery','directionsNote','contactGroom','contactBride'];
const legacyPublicFields = ['groom','bride','date','time','greeting','heroPhoto','gallery','directionsNote','contactGroom','contactBride'];
const publicFields = [...legacyPublicFields,'theme','story'];
const photoFields = ['id','url','alt'];
const storyFields = ['enabled','firstMetDate','firstMetText','groomMessage','brideMessage','promise'];
const storyTextFields = ['firstMetText','groomMessage','brideMessage','promise'];
const emptyStory = () => ({enabled:false,firstMetDate:'',firstMetText:'',groomMessage:'',brideMessage:'',promise:''});
const theme = value => value === 'ivory' || value === 'briller-night';
const defaultNames = {groom:'송윤오',bride:'박예은'};
const defaultGreeting = '서로의 가장 가까운 친구가 되어\n함께 걸어갈 첫날에 초대합니다.\n소중한 걸음으로 자리를 빛내 주세요.';
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value,max) => typeof value === 'string' && value.length <= max;
const name = value => text(value,40) && value.trim().length > 0 && value === value.trim();
const hasFields = (value,fields) => record(value) && fields.every(key => Object.hasOwn(value,key));
const exactFields = (value,fields) => hasFields(value,fields) && Object.keys(value).length === fields.length;
const phone = value => text(value,40) && (value === '' || (/^\+?[0-9][0-9 -]*$/.test(value) && !/[^+0-9 -]/.test(value)));
const time = value => typeof value === 'string' && (value === '' || (value.length === 5 && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)));

function date(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
function photoUrl(value) {
  if (!text(value,2000) || !/^https?:\/\//i.test(value) || /\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return ['http:','https:'].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password;
  } catch { return false; }
}
function validPhoto(value,exact=false) {
  return (exact ? exactFields(value,photoFields) : hasFields(value,photoFields))
    && text(value.id,100) && value.id.trim().length > 0 && value.id === value.id.trim()
    && photoUrl(value.url) && text(value.alt,200);
}
function pickPhoto(value) {
  if (!validPhoto(value)) return null;
  return {id:value.id,url:value.url,alt:value.alt};
}
function validStory(value,exact=false) {
  return (exact ? exactFields(value,storyFields) : hasFields(value,storyFields))
    && typeof value.enabled === 'boolean' && date(value.firstMetDate)
    && storyTextFields.every(key => text(value[key],1000));
}
function pickStory(value) {
  return {
    enabled:value?.enabled === true,
    firstMetDate:date(value?.firstMetDate) ? value.firstMetDate : '',
    firstMetText:text(value?.firstMetText,1000) ? value.firstMetText : '',
    groomMessage:text(value?.groomMessage,1000) ? value.groomMessage : '',
    brideMessage:text(value?.brideMessage,1000) ? value.brideMessage : '',
    promise:text(value?.promise,1000) ? value.promise : '',
  };
}
function validSettings(value,exact=false) {
  return hasFields(value,settingsFields) && name(value.groom) && name(value.bride)
    && time(value.time) && text(value.greeting,3000) && text(value.directionsNote,2000)
    && phone(value.contactGroom) && phone(value.contactBride)
    && (value.heroPhoto === null || validPhoto(value.heroPhoto,exact))
    && Array.isArray(value.gallery) && value.gallery.length <= 12
    && value.gallery.every(photo => validPhoto(photo,exact))
    && new Set(value.gallery.map(photo => photo.id)).size === value.gallery.length
    && (!Object.hasOwn(value,'theme') || theme(value.theme))
    && (!Object.hasOwn(value,'story') || validStory(value.story,exact));
}

// Settings are optional in older private backups. When present, all known fields
// are required; extra private fields remain compatible but are never published.
export function validInvitationSettings(value) { return validSettings(value); }
export function validInvitation(value) {
  return (exactFields(value,legacyPublicFields) || exactFields(value,publicFields))
    && validSettings(value,true) && date(value.date)
    && (!Object.hasOwn(value,'story') || value.story.enabled || storyFields.every(key => value.story[key] === emptyStory()[key]));
}
function coupleNames(value) {
  if (typeof value !== 'string') return {...defaultNames};
  const parts = value.split(/\s*[♥&]\s*/).map(part => part.trim());
  return parts.length === 2 && parts.every(name) ? {groom:parts[0],bride:parts[1]} : {...defaultNames};
}

export function getInvitation(data) {
  const names = coupleNames(data?.couple);
  const settings = record(data?.invitation) ? data.invitation : {};
  const seen = new Set();
  const gallery = (Array.isArray(settings.gallery) ? settings.gallery : []).map(pickPhoto)
    .filter(photo => {
      if (!photo || seen.has(photo.id)) return false;
      seen.add(photo.id);
      return true;
    }).slice(0,12);
  // Every field and photo is picked explicitly. Spreading settings or the root
  // here would accidentally make private planning records publicly readable.
  return {
    groom:name(settings.groom) ? settings.groom : names.groom,
    bride:name(settings.bride) ? settings.bride : names.bride,
    date:date(data?.date) ? data.date : '',
    time:time(settings.time) ? settings.time : '',
    greeting:text(settings.greeting,3000) ? settings.greeting : defaultGreeting,
    heroPhoto:pickPhoto(settings.heroPhoto),
    gallery,
    directionsNote:text(settings.directionsNote,2000) ? settings.directionsNote : '',
    contactGroom:phone(settings.contactGroom) ? settings.contactGroom : '',
    contactBride:phone(settings.contactBride) ? settings.contactBride : '',
    theme:theme(settings.theme) ? settings.theme : 'ivory',
    story:pickStory(settings.story),
  };
}

export function toPublicInvitation(data) {
  const invitation = getInvitation(data);
  if (!invitation.story.enabled) invitation.story = emptyStory();
  return invitation;
}

// Older deployments publish ten fields. Accept that envelope while always
// returning the current, explicitly picked shape at the browser boundary.
export function normalizePublicInvitation(value) {
  if (!validInvitation(value)) throw Error('청첩장 내용을 불러올 수 없습니다.');
  return toPublicInvitation({date:value.date,invitation:value});
}

export function saveInvitation(data,fields) {
  if (!record(fields)) throw Error('청첩장 내용을 확인해 주세요.');
  const current = getInvitation(data);
  const submitted = {};
  for (const key of publicFields) submitted[key] = Object.hasOwn(fields,key) ? fields[key] : current[key];
  if (Object.hasOwn(fields,'story')) {
    if (!record(fields.story)) throw Error('우리의 이야기 내용을 확인해 주세요.');
    submitted.story = {...current.story,...fields.story};
  }
  for (const key of ['groom','bride','contactGroom','contactBride']) {
    if (typeof submitted[key] === 'string') submitted[key] = submitted[key].trim();
  }
  if (!validSettings(submitted) || !date(submitted.date)) {
    throw Error('이름과 예식 날짜·시간, 연락처, 사진 주소를 확인해 주세요.');
  }
  const invitation = record(data?.invitation) ? {...data.invitation} : {};
  for (const key of settingsFields) invitation[key] = submitted[key];
  invitation.theme = submitted.theme;
  invitation.story = {...(record(data?.invitation?.story) ? data.invitation.story : {}),...pickStory(submitted.story)};
  invitation.heroPhoto = pickPhoto(submitted.heroPhoto);
  invitation.gallery = submitted.gallery.map(pickPhoto);
  // Apply against the latest document; unrelated records and any concurrent
  // changes survive. The shared wedding date remains the single date source.
  return {
    ...data,
    ...(Object.hasOwn(fields,'date') ? {date:submitted.date} : {}),
    ...(Object.hasOwn(fields,'groom') || Object.hasOwn(fields,'bride') ? {couple:`${submitted.groom} ♥ ${submitted.bride}`} : {}),
    invitation,
  };
}
