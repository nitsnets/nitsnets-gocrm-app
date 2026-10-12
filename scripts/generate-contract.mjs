import { writeFileSync } from 'node:fs';
// This source builds the checked-in, standalone OpenAPI contract. Keep in sync with apps/api.
const str = (extra = {}) => ({ type: 'string', ...extra });
const nullable = (schema) => ({ ...schema, type: [schema.type, 'null'] });
const id = () => str({ format: 'uuid' });
const date = () => str({ format: 'date' });
const datetime = () => str({ format: 'date-time' });
const integer = (minimum = 0) => ({ type: 'integer', minimum });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const array = (items) => ({ type: 'array', items });
const object = (properties, required = [], extra = {}) => ({ type: 'object', properties, ...(required.length ? { required } : {}), ...extra });
const schema = {};
const resource = (props, required = []) => object({ id: id(), ...props, created_at: datetime(), updated_at: datetime() }, ['id', ...required]);
const request = (props, required = []) => object(props, required, { additionalProperties: false });
const associations = { contact_id: nullable(id()), company_id: nullable(id()) };
const person = { first_name: str({ minLength: 1, maxLength: 120 }), last_name: nullable(str({ maxLength: 120 })), email: nullable(str({ format: 'email', maxLength: 254 })), phone: nullable(str({ maxLength: 40 })), job_title: nullable(str({ maxLength: 200 })), linkedin_url: nullable(str({ format: 'uri', maxLength: 2000 })), notes: nullable(str({maxLength: 20000})), avatar_url: nullable(str({ format: 'uri' })) };
const company = { name: str({ minLength: 1, maxLength: 200 }), domain: nullable(str({ maxLength: 254 })), industry: nullable(str({ maxLength: 200 })), status: str({ enum: ['prospect', 'active', 'inactive'] }), website: nullable(str({ format: 'uri' })), notes: nullable(str({maxLength: 20000})) };
const affiliation = { company_id: id(), role: nullable(str({ maxLength: 200 })), started_on: nullable(date()), ended_on: nullable(date()) };
const opportunity = { title: str({ minLength: 1, maxLength: 200 }), ...associations, stage: str({ enum: ['new', 'qualified', 'proposal', 'won', 'lost'] }), value_minor: {...integer(),maximum:100000000000}, currency: str({ enum: ['EUR'], default: 'EUR' }), expected_close_on: nullable(date()) };
const task = { title: str({ minLength: 1, maxLength: 300 }), ...associations, due_at: nullable(datetime()), status: str({ enum: ['pending', 'completed'] }) };
const note = { body: str({ minLength: 1, maxLength: 50000 }), ...associations, visibility: str({ enum: ['private', 'workspace'], default: 'private' }), client_request_id: id() };
const event = { name: str({ minLength: 1, maxLength: 200 }), location: nullable(str({ maxLength: 300 })), starts_at: datetime(), notes: nullable(str({maxLength: 20000})), contact_ids: {...array(id()),maxItems:500} };
const item = { description: str({ minLength: 1, maxLength: 1000 }), quantity: { type: 'number', exclusiveMinimum: 0, maximum: 100000, multipleOf: 0.01 }, unit_price_minor: {...integer(),maximum:100000000} };
const quote = { title: str({ minLength: 1, maxLength: 200 }), company_id: nullable(id()), opportunity_id: nullable(id()), status: str({ enum: ['draft', 'approved', 'sent'], default: 'draft' }), currency: str({ enum: ['EUR'], default: 'EUR' }), items: {...array(ref('QuoteItemInput')),minItems:1,maxItems:100}, notes: nullable(str({maxLength: 20000})) };
schema.Error = object({ error: object({ code: str(), message: str(), details: {} }, ['code', 'message']) }, ['error']);
schema.User = object({ id: id(), name: str(), email: str({ format: 'email' }) }, ['id', 'name', 'email']);
schema.Workspace = object({ id: id(), name: str() }, ['id', 'name']);
schema.Session = object({ user: ref('User'), workspace: ref('Workspace'), workspaces: array(ref('Workspace')) }, ['user', 'workspace', 'workspaces']);
schema.Login = object({ ...schema.Session.properties, token: str() }, ['token', 'user', 'workspace', 'workspaces']);
schema.WorkspaceSelection = object({ workspace: ref('Workspace'), workspaces: array(ref('Workspace')) }, ['workspace', 'workspaces']);
schema.Affiliation = resource({ ...affiliation, contact_id: id(), company_name: nullable(str()) }, ['company_id']);
schema.Contact = resource({ ...person, name: str(), affiliations: array(ref('Affiliation')) }, ['first_name', 'last_name', 'name']);
schema.Company = resource(company, ['name', 'status']);
schema.Opportunity = resource({ ...opportunity, company: nullable(object({})), contact: nullable(object({})) }, ['title', 'stage', 'value_minor', 'currency']);
schema.Task = resource({ ...task, author_id: id(), contact: nullable(object({})), company: nullable(object({})) }, ['title', 'status']);
schema.Note = resource({ ...note, client_request_id: nullable(id()), author_id: id(), author_name: str() }, ['body', 'visibility']);
schema.Event = resource({ ...event, contacts: array(ref('Contact')) }, ['name', 'starts_at']);
schema.QuoteItemInput = request(item, ['description', 'quantity', 'unit_price_minor']);
schema.QuoteItem = object({ ...item, id: id(), line_total_minor: integer() }, ['description', 'quantity', 'unit_price_minor', 'line_total_minor']);
schema.Quote = resource({ ...quote, items: array(ref('QuoteItem')), total_minor: integer() }, ['title', 'currency', 'status', 'items', 'total_minor']);
schema.MessageGrant = object({ id: id(), user_id: id(), name: str() }, ['id', 'user_id', 'name']);
schema.Message = resource({ subject: str(), from_email: str(), from_name: nullable(str()), to: array(str()), cc: array(str()), received_at: datetime(), body_text: str(), contact_id: nullable(id()), participants: array(ref('User')), grants: array(ref('MessageGrant')), can_share: { type: 'boolean' } }, ['subject', 'from_email', 'received_at', 'body_text', 'participants', 'grants', 'can_share']);
schema.Activity = object({ id: str(), type: str(), title: str(), created_at: datetime() });
schema.Dashboard = object({ contacts_count: integer(), companies_count: integer(), open_opportunities_count: integer(), pipeline_value_minor: {...integer(),maximum:100000000000}, tasks_due_count: integer(), recent_activities: array(ref('Activity')), upcoming_tasks: array(ref('Task')) }, ['contacts_count', 'companies_count', 'open_opportunities_count', 'pipeline_value_minor', 'tasks_due_count', 'recent_activities', 'upcoming_tasks']);
schema.GmailStatus = object({ configured: { type: 'boolean' }, connected: { type: 'boolean' }, email: nullable(str()), last_synced_at: nullable(datetime()), status: str({enum:['not_configured','disconnected','queued','syncing','connected','sync_error','reauthorization_required']}) }, ['configured', 'connected', 'status']);
schema.Health = object({ status: str() }, ['status']);
for (const [name, props, required] of [['Contact', person, ['first_name']], ['Company', company, ['name']], ['Affiliation', affiliation, ['company_id']], ['Opportunity', opportunity, ['title']], ['Task', task, ['title']], ['Note', note, ['body']], ['Event', event, ['name','starts_at']], ['Quote', quote, ['title','items']]]) {
  schema[`${name}Create`] = request(props, required);
  schema[`${name}Update`] = request(props);
}
const envelope = (s) => object({ data: s }, ['data']);
const list = (s) => object({ data: array(s), meta: object({ total: integer(), page: integer(1), per_page: integer(1) }, ['total', 'page', 'per_page']) }, ['data', 'meta']);
const content = (s) => ({ 'application/json': { schema: s } });
const response = (s, description = 'Operación completada') => ({ description, content: content(s) });
const errorResponses = Object.fromEntries([['400','Solicitud inválida'],['401','Sesión ausente o inválida'],['403','Operación no permitida'],['404','Recurso inexistente o no visible'],['409','Contexto de empresa obsoleto o conflicto'],['422','Validación fallida'],['429','Demasiadas solicitudes'],['500','Error interno sin detalles sensibles'],['502','Error de proveedor'],['503','Integración no configurada o temporalmente no disponible']].map(([status,description]) => [status,response(ref('Error'),description)]));
const workspace = { name: 'X-Workspace-ID', in: 'header', required: true, description: 'Empresa activa de la sesión; su valor no concede autorización. Un contexto antiguo devuelve 409.', schema: id() };
const pathParam = (name) => ({ name, in: 'path', required: true, schema: id() });
const paging = [{ name: 'page', in: 'query', schema: { ...integer(1), default: 1 } }, { name: 'per_page', in: 'query', schema: { ...integer(1), maximum: 100, default: 25 } }];
const search = { name: 'search', in: 'query', schema: str(), description: 'Texto de búsqueda dentro de los registros autorizados.' };
const paths = {};
function op(path, method, options) {
  const { name, tag, output, input, isList = false, publicOp = false, session = false, code = method === 'post' ? '201' : '200', description = '', query = [], params = [] } = options;
  paths[path] ??= {};
  paths[path][method] = {
    operationId: name, tags: [tag], summary: options.summary ?? name, ...(description ? { description } : {}),
    ...(publicOp ? { security: [] } : {}),
    parameters: [...(!publicOp && !session ? [workspace] : []), ...params.map(pathParam), ...(isList && options.paged !== false ? paging : []), ...query],
    ...(input ? { requestBody: { required: true, content: content(typeof input === 'string' ? ref(input) : input) } } : {}),
    responses: { [code]: code === '204' ? { description: 'Operación completada sin cuerpo' } : response(isList ? list(ref(output)) : envelope(typeof output === 'string' ? ref(output) : output)), ...errorResponses },
  };
}
op('/auth/login','post',{name:'login',tag:'Sesión',publicOp:true,code:'200',input:request({email:str({format:'email'}),password:str({minLength:1,maxLength:1024})},['email','password']),output:'Login',description:'Crea una sesión bearer. No usar credenciales demo fuera del entorno local.'});
op('/auth/google','get',{name:'getGoogleLoginStatus',tag:'Sesión',publicOp:true,output:object({configured:{type:'boolean'}},['configured']),description:'Disponibilidad del acceso mediante Google. No indica el estado del conector Gmail.'});
op('/auth/google/start','post',{name:'startGoogleLogin',tag:'Sesión',publicOp:true,code:'200',input:request({client:str({enum:['web','ios']}),code_challenge:str({pattern:'^[A-Za-z0-9_-]{43}$'})},['client','code_challenge']),output:object({authorization_url:str({format:'uri'}),state:str({pattern:'^[a-f0-9]{64}$'})},['authorization_url','state']),description:'El cliente guarda un verificador aleatorio y envía su SHA-256 en base64url sin padding. Estado de un solo uso, válido diez minutos. Solicita únicamente openid email profile; no concede lectura de correo. El retorno lo determina el servidor, nunca un parámetro del cliente.'});
op('/auth/google/exchange','post',{name:'exchangeGoogleLogin',tag:'Sesión',publicOp:true,code:'200',input:request({code:str({pattern:'^[a-f0-9]{64}$'}),code_verifier:str({minLength:43,maxLength:128,pattern:'^[A-Za-z0-9._~-]+$'})},['code','code_verifier']),output:'Login',description:'Canjea el código de entrega de un solo uso, válido sesenta segundos, con el verificador original. Comprueba de nuevo la pertenencia a una empresa. Devuelve la misma sesión que el login por contraseña. El código no es un access token de Google.'});
paths['/auth/google/callback'] = {get:{operationId:'googleLoginCallback',tags:['Sesión'],summary:'Callback de acceso con Google',description:'Ruta de navegador protegida por state, nonce y PKCE. Valida la firma y claims del ID token. Solo admite cuentas preexistentes con membresía; no registra usuarios por dominio. Redirige al retorno fijo web o iOS con code y state, o error y state. Nunca incluye un bearer ni tokens de Google en la URL. Con estado inválido devuelve un error JSON.',security:[],parameters:[{name:'state',in:'query',required:true,schema:str({maxLength:200})},{name:'code',in:'query',schema:str({maxLength:4096})},{name:'error',in:'query',schema:str({maxLength:200})}],responses:{'302':{description:'Entrega al cliente mediante código temporal o error access_denied, not_allowed o provider_error',headers:{Location:{schema:str({format:'uri'})}}},...errorResponses}}};
op('/auth/logout','post',{name:'logout',tag:'Sesión',session:true,code:'204'});
op('/me','get',{name:'getSession',tag:'Sesión',session:true,output:'Session'});
op('/session/workspace','post',{name:'selectWorkspace',tag:'Sesión',session:true,code:'200',input:request({workspace_id:id()},['workspace_id']),output:'WorkspaceSelection',description:'Valida pertenencia y cambia solo esta sesión. Los consumidores borran datos anteriores y descartan respuestas en vuelo.'});
op('/dashboard','get',{name:'getDashboard',tag:'Escritorio',output:'Dashboard'});
op('/members','get',{name:'listMembers',tag:'Empresas usuarias',output:array(ref('User'))});
op('/health','get',{name:'health',tag:'Sistema',publicOp:true,output:'Health'});
for (const [path, name, label] of [['contacts','Contact','Contactos'],['companies','Company','Clientes'],['opportunities','Opportunity','Oportunidades'],['tasks','Task','Tareas'],['notes','Note','Notas'],['events','Event','Eventos'],['quotes','Quote','Presupuestos']]) {
  op(`/${path}`,'get',{name:`list${name}s`,tag:label,output:name,isList:true,query:[search,...(['tasks','notes','opportunities'].includes(path)?[{name:'contact_id',in:'query',schema:id()},{name:'company_id',in:'query',schema:id()}]:[]),...(['companies','tasks','quotes'].includes(path)?[{name:'status',in:'query',schema: str({enum:path==='companies'?['prospect','active','inactive']:path==='tasks'?['pending','completed']:['draft','approved','sent']})}]:[]),...(path==='opportunities'?[{name:'stage',in:'query',schema:str({enum:['new','qualified','proposal','won','lost']})}]:[])]});
  op(`/${path}`,'post',{name:`create${name}`,tag:label,output:name,input:`${name}Create`,description:name==='Note'?'Privada por defecto. client_request_id permite reintentar la creación por usuario y empresa sin duplicar; un payload distinto con el mismo ID devuelve 409.':name==='Quote'?'El servidor calcula importes en céntimos. Cantidades de hasta dos decimales; redondeo half-up por partida. Total sin impuestos. No envía correo.':''});
  op(`/${path}/{id}`,'get',{name:`get${name}`,tag:label,output:name,params:['id']});
  op(`/${path}/{id}`,'patch',{name:`update${name}`,tag:label,output:name,input:`${name}Update`,params:['id']});
  op(`/${path}/{id}`,'delete',{name:`delete${name}`,tag:label,params:['id'],code:'204'});
}
op('/contacts/{id}/affiliations','get',{name:'listAffiliations',tag:'Afiliaciones',output:'Affiliation',isList:true,paged:false,params:['id']});
op('/contacts/{id}/affiliations','post',{name:'createAffiliation',tag:'Afiliaciones',output:'Affiliation',input:'AffiliationCreate',params:['id']});
op('/affiliations/{id}','patch',{name:'updateAffiliation',tag:'Afiliaciones',output:'Affiliation',input:'AffiliationUpdate',params:['id']});
op('/messages','get',{name:'listMessages',tag:'Correo privado',output:'Message',isList:true,query:[search,{name:'contact_id',in:'query',schema:id()},{name:'company_id',in:'query',schema:id()}]});
op('/messages/{id}','get',{name:'getMessage',tag:'Correo privado',output:'Message',params:['id'],description:'404 si no es participante ni tiene grant. No existe bypass por administrador ni herencia del acceso al contacto.'});
op('/messages/{id}/grants','post',{name:'grantMessageAccess',tag:'Correo privado',output:'Message',code:'200',params:['id'],input:request({user_id:id()},['user_id']),description:'Solo un participante original puede conceder acceso a otro miembro de la empresa. No se comparte el hilo ni mensajes futuros.'});
op('/messages/{id}/grants/{grantId}','delete',{name:'revokeMessageAccess',tag:'Correo privado',params:['id','grantId'],code:'204'});
op('/integrations/gmail','get',{name:'getGmailStatus',tag:'Gmail',output:'GmailStatus'});
op('/integrations/gmail/connect','post',{name:'connectGmail',tag:'Gmail',input:request({client:str({enum:['web','ios'],default:'web'})}),output:object({authorization_url:str({format:'uri'}),state:str()},['authorization_url','state']),code:'200',description:'Devuelve URL OAuth y state temporal. client es opcional: web por defecto, ios vuelve a com.nitsnets.crm://oauth/gmail con state y resultado gmail. Sin credenciales devuelve 503.'});
paths['/integrations/gmail/connect'].post.requestBody.required = false;
op('/integrations/gmail/sync','post',{name:'syncGmail',tag:'Gmail',output:object({status:str({enum:['queued']})},['status']),code:'202',description:'Encola sincronización. Requiere worker para procesarla; 202 no significa completada. Devuelve 409 si hay que renovar autorización.'});
op('/integrations/gmail','delete',{name:'disconnectGmail',tag:'Gmail',code:'204'});
paths['/integrations/gmail/callback'] = {get: {operationId:'gmailCallback',tags:['Gmail'],summary:'Callback de Google OAuth',description:'Ruta de navegador. Consume state de un solo uso y PKCE; redirige a la web configurada o al callback iOS fijo según client. Incluye gmail=connected|cancelled|error|account_mismatch; iOS también state. Se requiere code o error. No requiere token bearer.',security:[],parameters:[{name:'state',in:'query',required:true,schema:str({maxLength:200})},{name:'code',in:'query',required:false,schema:str({maxLength:3000})},{name:'error',in:'query',required:false,schema:str({maxLength:200})}],responses:{'302':{description:'Resultado de conexión; redirección al cliente registrado',headers:{Location:{schema:str({format:'uri'})}}},...errorResponses}}};
paths['/notes'].post.responses['200'] = response(envelope(ref('Note')), 'Reintento idempotente de una nota existente');
schema.ContactCreate.example = {first_name:'Bernardo',last_name:'García',email:'bernardo@example.test',job_title:'Director de producto'};
schema.NoteCreate.example = {body:'Preparar una propuesta de mantenimiento para revisar el martes.',visibility:'private',client_request_id:'7d8221c0-e504-4b67-9587-b2f82e8cb0f4'};
schema.QuoteCreate.example = {title:'Propuesta de mantenimiento',currency:'EUR',items:[{description:'Consultoría inicial',quantity:1.25,unit_price_minor:101}]};
schema.Error.example = {error:{code:'workspace_mismatch',message:'La empresa activa ha cambiado.'}};
const spec = {
  openapi:'3.1.0',
  info:{title:'NitsNets CRM API',version:'0.2.0',description:'API del CRM con empresa activa por sesión, correo privado y acceso mediante contraseña o Google. No incluye webhooks, envío de correo ni generación con IA. Los callbacks OAuth son rutas de navegador públicas protegidas por state de un solo uso; el acceso Google es independiente del permiso Gmail.'},
  servers:[{url:'http://127.0.0.1:8000/api/v1',description:'Desarrollo local; producción requiere HTTPS'}],
  security:[{bearerAuth:[]}],
  tags:[...new Set(Object.values(paths).flatMap(p=>Object.values(p).flatMap(o=>o.tags)))].map(name=>({name})),
  paths,
  components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',description:'Token opaco de sesión; guardar de forma segura. Workspace activo validado en servidor.'}},schemas:schema},
};
writeFileSync(new URL('../contracts/openapi.json', import.meta.url), JSON.stringify(spec,null,2)+'\n');
console.log(`Contrato generado: ${Object.keys(paths).length} rutas, ${Object.values(paths).reduce((n,p)=>n+Object.keys(p).length,0)} operaciones.`);
