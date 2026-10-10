const fs=require("fs"),path=require("path"),assert=require("assert");
const root=path.join(__dirname,".."),dir=path.join(root,"kira"),files=fs.readdirSync(dir).filter(f=>f.endsWith(".js"));
assert(files.length,"No Kira modules found"); const command=require(path.join(root,"command.js")); for(const file of files) require(path.join(dir,file)); assert(command.commands.length,"No commands registered");
const legacy=/(darkmods|angel|crazy|neon|neon bug)/i; for(const file of ["index.js","config.js","command.js"].map(f=>path.join(root,f)).concat(files.map(f=>path.join(dir,f)))) assert(!legacy.test(fs.readFileSync(file,"utf8")),`Legacy branding remains in ${path.relative(root,file)}`);
const index=fs.readFileSync(path.join(root,"index.js"),"utf8"); assert(index.includes("KIRABOTS")); assert(index.includes("node-telegram-bot-api")); console.log(`Smoke test passed: ${command.commands.length} commands from ${files.length} modules.`);
