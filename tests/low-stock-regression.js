// Run with: node tests/low-stock-regression.js
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
let rows, failMail=false, locked=false;
const state={};
const sent=[];
const triggers=[];
const context=vm.createContext({
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getDataRange:()=>({getValues:()=>rows})})})},
  MailApp:{getRemainingDailyQuota:()=>100,sendEmail:message=>{if(failMail) throw Error('Mail failed');sent.push(message);}},
  LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}})},
  PropertiesService:{getScriptProperties:()=>({getProperties:()=>({...state}),setProperty:(key,value)=>{state[key]=value;},deleteProperty:key=>{delete state[key];}})},
  ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased:()=>({everyMinutes:minutes=>({create(){assert.equal(minutes,5);triggers.push({getHandlerFunction:()=>name});}})})})}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','EMS_Inventory_Google_Apps_Script.gs'),'utf8'),context);
const headers=['name','loc','qty','par','barcode'];
rows=[headers,['Bandages','Medic 1',2,5,'A'],['Saline','Medic 2',5,5,'B']];
context.setupLowStockAlerts();context.setupLowStockAlerts();
assert.equal(triggers.length,1);
context.checkLowStockAlerts();
assert.equal(sent.length,1);
assert.equal(sent[0].to,'dfoley@martinsvilleva.gov');
assert.match(sent[0].body,/Bandages/);
assert.doesNotMatch(sent[0].body,/Saline/);
context.checkLowStockAlerts();
assert.equal(sent.length,1);
rows[1][2]=5;context.checkLowStockAlerts();
assert.equal(Object.keys(state).length,0);
rows[1][2]=1;rows[2][2]=0;
failMail=true;
assert.throws(()=>context.checkLowStockAlerts(),/Mail failed/);
assert.equal(Object.keys(state).length,0);
assert.equal(locked,false);
failMail=false;context.checkLowStockAlerts();
assert.equal(sent.length,2);
assert.match(sent[1].subject,/2 item/);
assert.equal(Object.keys(state).length,2);
rows[1][2]='';
assert.throws(()=>context.checkLowStockAlerts(),/Invalid quantity/);
assert.equal(Object.keys(state).length,2);
assert.equal(locked,false);
rows[1][2]=1;rows[2][4]='A';
assert.throws(()=>context.checkLowStockAlerts(),/unique barcode/);
assert.equal(sent.length,2);
console.log('Passed: timer setup, recipient, strict threshold, deduplication, restock reset, grouped alerts, retry after email failure, invalid inventory protection.');
// Exercise the actual save endpoint and its shared alert history.
context.ContentService={MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})};
context.SpreadsheetApp.flush=()=>{};
const errors=[];
context.console={error:message=>errors.push(message)};
let failSave=false;
context.writeObjects_=(_ss,_tab,columns,items)=>{
  assert.equal(locked,true);
  if(failSave) throw Error('Save failed');
  rows=[columns,...items.map(item=>columns.map(column=>item[column]??''))];
};
const sheetId=vm.runInContext('LOW_STOCK_EMAIL.sheetId',context);
function save(qty,id=sheetId){
  return context.doPost({postData:{contents:JSON.stringify({action:'saveInventory',sheetId:id,inventory:[{name:'Bandages',loc:'Medic 1',qty,par:5,barcode:'A'}]})}});
}
save(5); // Restocking resets shared alert history.
const before=sent.length;
assert.equal(save(4).ok,true);
assert.equal(sent.length,before+1,'Backend save must send immediately');
context.checkLowStockAlerts();
assert.equal(sent.length,before+1,'Timer must not repeat a backend alert');
save(5);
failMail=true;
assert.equal(save(3).ok,true,'Email failure must not fail the inventory save');
assert.equal(errors.length,1);
assert.equal(Object.keys(state).length,0);
failMail=false;context.checkLowStockAlerts();
assert.equal(sent.length,before+2,'Timer must retry a failed save notification');
failSave=true;
assert.equal(save(2).ok,false);
assert.equal(sent.length,before+2,'Failed saves must not send alerts');
assert.equal(locked,false);
failSave=false;
save(5);
save(1,'another-spreadsheet');
assert.equal(sent.length,before+2,'Other spreadsheets must not send configured alerts');
console.log('Passed: save-triggered emails, shared timer deduplication, successful saves on email failure, retry, failed-save suppression, configured spreadsheet isolation.');
