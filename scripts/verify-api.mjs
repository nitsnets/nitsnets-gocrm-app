import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.CRM_API_URL ?? 'http://127.0.0.1:8000/api/v1';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname) && process.env.CRM_ALLOW_REMOTE_TEST !== 'yes') throw new Error('Este test crea datos temporales: solo local por defecto.');
const spec = await SwaggerParser.dereference(new URL('../contracts/openapi.json', import.meta.url).pathname);
const ajv = new Ajv2020({ allErrors: true, strict: false, multipleOfPrecision: 4 });
addFormats(ajv);
const validators = new Map();
let checks = 0;
async function call(route, method='get', { token, workspace, body, params={}, status=200 }={}) {
  let path = route;
  for (const [name,value] of Object.entries(params)) path = path.replace(`{${name}}`,encodeURIComponent(value));
  const response = await fetch(base+path, { method:method.toUpperCase(), headers:{ Accept:'application/json', ...(body?{'Content-Type':'application/json'}:{}), ...(token?{Authorization:`Bearer ${token}`} : {}), ...(workspace?{'X-Workspace-ID':workspace}:{}) }, ...(body?{body:JSON.stringify(body)}:{}) });
  const data = response.status===204 ? null : await response.json();
  assert.equal(response.status, status, `${method.toUpperCase()} ${route}: esperado ${status}, recibido ${response.status} (${data?.error?.code??''})`);
  const key=`${route}:${method}:${status}`;
  const schema=spec.paths[route]?.[method]?.responses[String(status)]?.content?.['application/json']?.schema;
  assert(schema || status===204, `Respuesta ${status} de ${method} ${route} sin contrato`);
  if(schema) {
    let validate=validators.get(key);
    if(!validate) {validate=ajv.compile(schema);validators.set(key,validate);}
    assert(validate(data), `${key}: ${JSON.stringify(validate.errors)}`);
  }
  checks++;
  return data?.data;
}
const credentials={email:process.env.CRM_TEST_EMAIL??'eladio@nitsnets.demo',password:process.env.CRM_TEST_PASSWORD??'DemoCRM!2026'};
await call('/auth/google');
await call('/auth/google/start','post',{body:{client:'unknown',code_challenge:'invalid'},status:422});
await call('/auth/google/exchange','post',{body:{code:'0'.repeat(64),code_verifier:'a'.repeat(43)},status:400});
await call('/auth/google/callback','get',{status:400});
await call('/contacts','get',{status:401});
const first=await call('/auth/login','post',{body:credentials});
const second=await call('/auth/login','post',{body:credentials});
let ctx={token:first.token,workspace:first.workspace.id};
const sessions=[first.token,second.token];
const cleanup=[];
try {
  await call('/me','get',ctx);
  for (const route of ['/dashboard','/members','/contacts','/companies','/opportunities','/tasks','/notes','/events','/quotes','/messages','/integrations/gmail']) await call(route,'get',ctx);
  const contacts=await call('/contacts','get',ctx);
  if(contacts.length) {await call('/contacts/{id}','get',{...ctx,params:{id:contacts[0].id}});await call('/contacts/{id}/affiliations','get',{...ctx,params:{id:contacts[0].id}});}
  const messages=await call('/messages','get',ctx);
  if(messages.length) await call('/messages/{id}','get',{...ctx,params:{id:messages[0].id}});
  const marker=randomUUID().slice(0,8);
  const contact=await call('/contacts','post',{...ctx,status:201,body:{first_name:'Prueba',last_name:`Contrato ${marker}`,email:`contract-${marker}@example.test`}});
  cleanup.push(['/contacts/{id}',contact.id]);
  const company=await call('/companies','post',{...ctx,status:201,body:{name:`Prueba contrato ${marker}`,status:'prospect'}});
  cleanup.push(['/companies/{id}',company.id]);
  await call('/contacts/{id}/affiliations','post',{...ctx,status:201,params:{id:contact.id},body:{company_id:company.id,role:'Prueba',started_on:'2026-01-01'}});
  const body={body:`Prueba privada ${marker}`,contact_id:contact.id,visibility:'private',client_request_id:randomUUID()};
  const note=await call('/notes','post',{...ctx,status:201,body});
  cleanup.push(['/notes/{id}',note.id]);
  const repeated=await call('/notes','post',{...ctx,status:200,body});
  assert.equal(note.id,repeated.id,'Reintentar una nota no debe duplicarla');checks++;
  await call('/notes','post',{...ctx,status:409,body:{...body,body:'Contenido distinto'}});
  await call('/quotes','post',{...ctx,status:422,body:{title:'Inválido',items:[{description:'Inválido',quantity:-1,unit_price_minor:100}]}});
  if(first.workspaces.length>1) {
    const next=first.workspaces.find(w=>w.id!==first.workspace.id);
    await call('/session/workspace','post',{token:first.token,body:{workspace_id:next.id}});
    await call('/contacts','get',{...ctx,status:409});
    await call('/contacts/{id}','get',{token:first.token,workspace:next.id,params:{id:contact.id},status:404});
    const still=await call('/me','get',{token:second.token});
    assert.equal(still.workspace.id,first.workspace.id,'Cambiar empresa no debe alterar otra sesión');checks++;
    await call('/session/workspace','post',{token:first.token,body:{workspace_id:first.workspace.id}});
  }
  console.log(`API verificada contra OpenAPI: ${checks} comprobaciones, aislamiento multiempresa e idempotencia de notas incluidos.`);
} finally {
  for(const [route,id] of cleanup.reverse()) {try{await call(route,'delete',{...ctx,params:{id},status:204});}catch(error){console.error(`Limpieza pendiente ${route}: ${error.message}`);}}
  for(const token of sessions) {try{await call('/auth/logout','post',{token,status:204});}catch{}}
}
