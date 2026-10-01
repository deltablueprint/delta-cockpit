const fs=require("fs");
const s=fs.readFileSync("delta-blueprint.html","utf8");
const m=s.match(/<script[^>]*>[\s\S]*?<\/script>/g)||[];
let bad=0;
m.forEach((b,i)=>{
  const code=b.replace(/^<script[^>]*>/,"").replace(/<\/script>$/,"");
  try{ new Function(code); }catch(e){ bad++; console.log("block",i,"ERR",e.message); }
});
console.log(`blocks=${m.length} bad=${bad}`);
