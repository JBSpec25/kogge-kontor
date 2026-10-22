const fs=require('fs'),acorn=require('acorn');
for (const f of process.argv.slice(2)) { const s=fs.readFileSync(f,'utf8'); const b=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a,b)=>b[1].length-a[1].length)[0][1];
 try { acorn.parse(b,{ecmaVersion:'latest'}); console.log('ok',f);} catch(e){ console.log('FEHLER',f,e.message, b.slice(e.pos-200,e.pos+100)); } }
