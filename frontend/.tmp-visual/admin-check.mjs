const BASE='http://localhost:3000';
const r=await fetch(BASE+'/api/auth/sign-in/username',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:process.env.ADMIN_PASS})});
console.log('login admin:', r.status);
const c=(r.headers.getSetCookie?.()??[]).map(x=>x.split(';')[0]).join('; ');
const t=await (await fetch(BASE+'/api/report?period=yearly&year=2026',{headers:{cookie:c}})).json();
console.log('totals ADMIN:', JSON.stringify(t.totals));
