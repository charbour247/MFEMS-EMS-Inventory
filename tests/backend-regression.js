// Run with: node tests/backend-regression.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','EMS_Inventory_Google_Apps_Script.gs'),'utf8'),context);
function spreadsheet(raw,display=raw) {
  return {getSheetByName:()=>({getDataRange:()=>({getValues:()=>raw,getDisplayValues:()=>display})})};
}
const headers = [' Name ','Username','PASSWORD','role','status'];
const raw = [headers,['Test',123,456,'Administrator','Active']];
const display = [headers,['Test','00123','00456','Administrator','Active']];
const user = context.readObjects_(spreadsheet(raw,display),'Users',true)[0];
assert.equal(user.username,'00123');
assert.equal(user.password,'00456');
const exact = context.readObjects_(spreadsheet([headers,['Test','User',' PassWord ','Administrator','Active']]),'Users',true)[0];
assert.equal(exact.password,' PassWord ');
assert.equal(exact.username,'User');
assert.throws(()=>context.readObjects_({getSheetByName:()=>null},'Users',true),/Missing sheet tab/);
assert.throws(()=>context.readObjects_(spreadsheet([['name']]),'Users',true),/missing headers/);
assert.throws(()=>context.readObjects_(spreadsheet([[...headers,' username ']]),'Users',true),/duplicate account headers/);
const item = context.readObjects_(spreadsheet([['name','qty'],['Bandage',12]]),'Inventory',false)[0];
assert.equal(item.qty,12);
console.log('Passed: normalized headers, displayed credentials, exact password text, missing/duplicate columns, missing tabs, numeric inventory.');
// Password changes must verify the live account and touch only its password cell.
let accountRows, writes, releases;
context.ContentService={MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})};
context.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){releases++;}})};
context.SpreadsheetApp={flush(){},openById:()=>({getSheetByName:()=>({
  getDataRange:()=>({getDisplayValues:()=>accountRows}),
  getRange:(row,column,height,width)=>({setNumberFormat:format=>assert.equal(format,'@'),setValues:values=>writes.push({row,column,height,width,values})})
})})};
function change(overrides={},rows){
  accountRows=rows || [headers,['Test','User','old-password','Inventory User','Active'],['Other','other','other-password','Administrator','Active']];
  writes=[];releases=0;
  return context.doPost({postData:{contents:JSON.stringify({sheetId:'test',action:'changePassword',username:' USER ',currentPassword:'old-password',newPassword:'new-password',...overrides})}});
}
assert.equal(change().ok,true);
assert.deepEqual(writes.map(write=>[write.row,write.column,write.height,write.width,String(write.values[0][0])]),[[2,3,1,1,'new-password']]);
assert.equal(releases,1);
assert.equal(change({newPassword:'=new-password'}).ok,true);
assert.equal(writes[0].values[0][0],"'=new-password");
for(const overrides of [{currentPassword:'wrong'},{currentPassword:'OLD-PASSWORD'},{username:'missing'},{newPassword:'short'},{currentPassword:''}]){
  assert.equal(change(overrides).ok,false);
  assert.equal(writes.length,0);
}
assert.equal(change({},[headers,['Test','User','old-password','Inventory User','Inactive']]).ok,false);
assert.equal(writes.length,0);
assert.equal(releases,1);
assert.equal(change({},[headers,['Test','User','old-password','Inventory User','Active'],['Duplicate','user','old-password','Administrator','Active']]).ok,false);
assert.equal(writes.length,0);
assert.equal(context.doGet({parameter:{action:'changePassword'}}).ok,false);
console.log('Passed: verified password changes, exact credentials, single-cell updates, formula escaping, rejected invalid/inactive/duplicate accounts, POST required.');
