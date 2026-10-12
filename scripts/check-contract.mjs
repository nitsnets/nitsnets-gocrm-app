import SwaggerParser from '@apidevtools/swagger-parser';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const path = new URL('../contracts/openapi.json', import.meta.url);
const spec = JSON.parse(readFileSync(path, 'utf8'));
await SwaggerParser.validate(spec);
const operationIds = new Set();
let count = 0;
for (const [route, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    assert(operation.operationId, `${method} ${route}: operationId obligatorio`);
    assert(!operationIds.has(operation.operationId), `operationId duplicado: ${operation.operationId}`);
    operationIds.add(operation.operationId);
    const params = operation.parameters ?? [];
    const hasContext = params.some(p => p.in === 'header' && p.name === 'X-Workspace-ID' && p.required);
    assert(hasContext || ['/auth/login','/auth/google','/auth/google/start','/auth/google/callback','/auth/google/exchange','/auth/logout','/me','/session/workspace','/health','/integrations/gmail/callback'].includes(route), `${route} sin contexto de empresa`);
    assert(operation.responses['401'] && operation.responses['422'], `${route} sin errores documentados`);
    count += 1;
  }
}
console.log(`OpenAPI válido: ${Object.keys(spec.paths).length} rutas y ${count} operaciones; IDs únicos y contexto de empresa verificado.`);

const apiDir = new URL('../apps/api/', import.meta.url).pathname;
if(existsSync(apiDir+'vendor/autoload.php')) {
  const routes = JSON.parse(execFileSync('php',['artisan','route:list','--json','--path=api/v1'],{cwd:apiDir,encoding:'utf8'}));
  const implemented = new Set();
  for(const route of routes) for(const method of route.method.toLowerCase().split('|')) {
    if(method==='head') continue;
    const path='/'+route.uri.replace(/^api\/v1\/?/,'');
    assert(spec.paths[path]?.[method], `Ruta implementada sin contrato: ${method} ${path}`);
    implemented.add(`${method} ${path}`);
  }
  for(const [path, methods] of Object.entries(spec.paths)) for(const method of Object.keys(methods)) assert(implemented.has(`${method} ${path}`), `Operación sin implementación: ${method} ${path}`);
  console.log(`Cobertura bidireccional verificada frente a ${implemented.size} operaciones Laravel.`);
} else {console.log('Cobertura Laravel pendiente: instala las dependencias de apps/api.');}
