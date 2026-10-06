import {test} from 'node:test';
import assert from 'node:assert/strict';
import {administratorFor,readAccess,saveAccess,isAdministrator} from '../app/src/access.js';
test('only the two matching administrator combinations enter',()=>{
 assert.equal(administratorFor('송윤오','예쁜강아지').name,'송윤오');
 assert.equal(administratorFor('박예은','예쁜고양이').name,'박예은');
 assert.equal(administratorFor('송윤오','예쁜고양이'),null);
 assert.equal(administratorFor('박예은','예쁜강아지'),null);
 assert.equal(administratorFor('다른 이름','예쁜강아지'),null);
 assert.equal(administratorFor(' 송윤오 ',' 예쁜강아지 ').role,'admin');
});
test('session lifecycle omits nicknames, tolerates broken storage and rejects unknown identities',()=>{
 let value=null;
 const store={getItem:()=>value,setItem:(key,data)=>value=data,removeItem:()=>value=null};
 const person=administratorFor('박예은','예쁜고양이');saveAccess(person,store);
 assert.equal(value.includes('예쁜고양이'),false);
 assert.deepEqual(readAccess(store),person);
 saveAccess({role:'guest'},store);assert.equal(readAccess(store).role,'guest');
 saveAccess(null,store);assert.equal(readAccess(store),null);
 value='{"role":"admin","id":"unknown"}';assert.equal(readAccess(store),null);
 value='{broken';assert.equal(readAccess(store),null);
 assert.equal(isAdministrator({role:'guest',id:'yoono'}),false);
 const denied={getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}};
 assert.equal(readAccess(denied),null);assert.doesNotThrow(()=>saveAccess(person,denied));
});
