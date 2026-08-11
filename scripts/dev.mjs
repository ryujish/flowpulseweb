import{spawn}from'node:child_process';
const node=file=>spawn(process.execPath,['--env-file-if-exists=.env',file],{stdio:'inherit'}),children=[node('api/server.mjs'),node('api/collector.mjs'),spawn('npm',['run','dev:web','--','--port','4173'],{stdio:'inherit'})];
for(const signal of['SIGINT','SIGTERM'])process.on(signal,()=>{children.forEach(child=>child.kill(signal));process.exit()});
children.forEach(child=>child.on('exit',code=>{if(code)process.exitCode=code}));
