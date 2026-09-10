// Run with: node tests/cache-regression.js
async function runCacheRegressionTests(source){
  const assert=(condition,message)=>{if(!condition) throw new Error(message);};
  const data={inventory:[{name:"Saved item",qty:42,par:5,used:0,barcode:"TEST-1"}],users:[{name:"Test",username:"test",password:"test-password",role:"Administrator",status:"Active"}]};
  const createStore=()=>{
    const values=new Map();
    return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  };
  function open(storage,offline=false,serverData=data){
    const elements=new Map();
    const element=id=>{
      if(!elements.has(id)) elements.set(id,{value:"",textContent:"",innerHTML:"",addEventListener(){},classList:{add(){},remove(){},toggle(){}}});
      return elements.get(id);
    };
    const document={getElementById:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){}};
    let requests=0;
    const actions=[];
    const fetch=async(url,options)=>{requests++;actions.push(JSON.parse(options.body).action);if(offline) throw new Error("Offline");return {ok:true,json:async()=>JSON.parse(JSON.stringify(serverData))};};
    const api=new Function("localStorage","document","window","fetch","setTimeout","clearTimeout","setInterval","AbortController","alert",source+`
      return {login,sync:syncFromGoogleSheets,apply:applyServerData,key:cacheKey,renderInventory,
        snapshot:()=>({inventory,users,pending,lastSync,storageAvailable,currentSessionUser}),
        edit:()=>{gsSettings.enabled=false;inventory[0].qty=41;saveInventoryToDatabase();}};
    `)(storage,document,{addEventListener(){}},fetch,()=>1,()=>{},()=>1,class{abort(){}},message=>{throw new Error(message);});
    element("username").value="test";
    element("password").value="test-password";
    return {...api,element,actions,requests:()=>requests};
  }
  const storage=createStore();
  const first=open(storage);
  assert(first.snapshot().inventory.length===0,"Fresh device must not display demo inventory");
  await first.login();
  await first.sync(true);
  assert(first.snapshot().currentSessionUser?.username==="test","First login must accept database credentials");
  assert(JSON.parse(storage.getItem(first.key())).inventory[0].qty===42,"First login must persist downloaded inventory");
  const reopened=open(storage,true);
  assert(reopened.requests()===0 && reopened.snapshot().inventory[0].qty===42,"Reload must restore inventory before requesting the server");
  await reopened.login();
  await reopened.sync(true);
  assert(!reopened.snapshot().currentSessionUser,"Offline login must not authorize from cached credentials");
  reopened.renderInventory();
  assert(reopened.element("inventoryBody").innerHTML.includes("Saved item"),"Offline failure must preserve saved inventory");
  reopened.edit();
  const afterEdit=open(storage,true);
  assert(afterEdit.snapshot().inventory[0].qty===41 && afterEdit.snapshot().pending.inventory,"Unsent edit must survive a reload");
  const oldStore=createStore();
  const dimensions=JSON.parse(first.key().slice("emsCache:v2:".length));
  oldStore.setItem("emsCache:v1:"+JSON.stringify(["https://example.invalid/old-deployment",...dimensions]),JSON.stringify({...data,pending:{inventory:true},lastSync:"2026-01-01T00:00:00.000Z"}));
  const migrated=open(oldStore,true);
  assert(migrated.snapshot().inventory[0].qty===42 && migrated.snapshot().pending.inventory,"Previous deployment cache must migrate with pending edits");
  assert(oldStore.getItem(migrated.key()),"Migration must persist the stable cache");
  const denied=open({length:0,getItem:()=>null,setItem:()=>{throw Error("Quota exceeded");}},true);
  denied.apply(data);
  assert(!denied.snapshot().storageAvailable && denied.element("deviceStorageStatus").textContent.includes("could not be saved"),"Storage failure must remain visible");
  const corrupt=createStore();
  corrupt.setItem(first.key(),"invalid JSON");
  assert(open(corrupt,true).snapshot().inventory.length===0,"Corrupt cache must not create demo inventory");
  for(const serverUsers of [[],[{...data.users[0],password:"changed-password"}],[{...data.users[0],status:"Inactive"}],[{name:"test",password:"test-password",status:"Active"}]]){
    const attempt=open(storage,false,{...data,users:serverUsers});
    await attempt.login();
    assert(!attempt.snapshot().currentSessionUser,"Empty, changed, inactive, or missing-username accounts must be rejected despite cached credentials");
    assert(attempt.actions.join() === "getData","Rejected login must not upload or create accounts");
    assert(attempt.element("loginButton").textContent==="Sign In" && !attempt.element("loginButton").disabled,"Login button must reset after rejection");
  }
  const changed=open(storage,false,{...data,users:[{...data.users[0],password:"changed-password"}]});
  changed.element("password").value="changed-password";
  await changed.login();
  await changed.sync(true);
  assert(changed.snapshot().currentSessionUser?.username==="test","Updated database password must work despite an old cache");
  assert(changed.element("password").value==="","Successful login must clear the password input");
  return "Passed: database login, rejected stale/inactive/missing accounts, no account creation, connection failure, cache persistence/reload, pending edits, migration, and storage errors.";
}
if(typeof module!=="undefined" && require.main===module){
  const fs=require("node:fs");
  const path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
  runCacheRegressionTests(html.split("<script>")[1].split("</script>")[0]).then(console.log).catch(error=>{console.error(error);process.exitCode=1;});
}
