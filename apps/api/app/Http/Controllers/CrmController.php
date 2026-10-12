<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Record;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CrmController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        $entity = $r->route('entity');
        $q = $this->query($r, $entity);
        $params = $r->validate(['page' => 'sometimes|integer|min:1', 'per_page' => 'sometimes|integer|min:1|max:100', 'search' => 'sometimes|nullable|string|max:200', 'contact_id' => 'sometimes|uuid', 'company_id' => 'sometimes|uuid', 'status' => 'sometimes|string|max:30', 'stage' => 'sometimes|string|max:30']);
        foreach (['contact_id', 'company_id'] as $key) {
            if ($r->filled($key) && in_array($entity, ['notes', 'messages', 'tasks', 'opportunities', 'affiliations'])) {
                $q->where($key, $params[$key]);
            }
        }
        foreach (['status', 'stage'] as $key) {
            if ($r->filled($key) && (($key === 'status' && in_array($entity, ['tasks', 'quotes', 'companies'])) || ($key === 'stage' && $entity === 'opportunities'))) {
                $q->where($key, $params[$key]);
            }
        }
        if ($r->filled('search')) {
            $fields = match ($entity) {
                'contacts' => ['first_name', 'last_name', 'email'],'companies','events' => ['name'],'notes' => ['body'],'messages' => ['subject', 'from_email'],default => ['title']
            };
            $search = mb_strtolower($params['search']);
            $q->where(function ($q) use ($fields, $search) {
                foreach ($fields as $field) {
                    $q->orWhereRaw('LOWER('.$field.') LIKE ?', ['%'.$search.'%']);
                }
            });
        }
        $results = $q->orderByDesc('created_at')->paginate($params['per_page'] ?? 25);

        return response()->json(['data' => $results->getCollection()->map(fn ($row) => $this->present($r, $entity, $row))->values(), 'meta' => ['total' => $results->total(), 'page' => $results->currentPage(), 'per_page' => $results->perPage()]]);
    }

    public function show(Request $r, string $id): JsonResponse
    {
        $e = $r->route('entity');

        return response()->json(['data' => $this->present($r, $e, $this->query($r, $e)->findOrFail($id))]);
    }

    public function store(Request $r): JsonResponse
    {
        $e = $r->route('entity');
        $v = $this->validated($r, $e);
        if (in_array($e, ['notes', 'tasks'])) {
            $v['author_id'] = $r->user()->id;
        }
        if ($e === 'notes') {
            $v['visibility'] = $v['visibility'] ?? 'private';
        }
        if ($e === 'events') {
            $v['contact_ids'] = $v['contact_ids'] ?? [];
        }
        $v['workspace_id'] = $this->workspace($r);
        if ($e === 'notes' && isset($v['client_request_id'])) {
            $payload = $v;
            ksort($payload);
            $v['request_hash'] = hash('sha256', json_encode($payload));
        }
        $created = true;
        $row = DB::transaction(function () use ($e, $v, &$created) {
            if ($e === 'notes' && isset($v['client_request_id'])) {
                DB::table('users')->where('id', $v['author_id'])->lockForUpdate()->first();
                $existing = Record::table('notes')->where('workspace_id', $v['workspace_id'])->where('author_id', $v['author_id'])->where('client_request_id', $v['client_request_id'])->first();
                if ($existing) {
                    if ($existing->request_hash !== $v['request_hash']) {
                        throw new ApiException(409, 'idempotency_conflict', 'Este identificador ya se usó con otro contenido.');
                    }

                    $created = false;

                    return $existing;
                }
            }
            $row = Record::table($e)->create($v);
            if ($e === 'quotes') {
                $this->snapshot($row);
            }

            return $row;
        });

        return response()->json(['data' => $this->present($r, $e, $row->fresh())], $created ? 201 : 200);
    }

    public function update(Request $r, string $id): JsonResponse
    {
        $e = $r->route('entity');
        $row = DB::transaction(function () use ($r, $id, $e) {
            $row = $this->query($r, $e)->lockForUpdate()->findOrFail($id);
            if ($e === 'notes') {
                abort_unless($row->author_id === $r->user()->id, 403, 'Solo el autor puede editar la nota.');
            }
            $v = $this->validated($r, $e, $row);
            if ($e === 'quotes') {
                $v['version'] = $row->version + 1;
            }
            $row->update($v);
            if ($e === 'quotes') {
                $this->snapshot($row);
            }

            return $row;
        });

        return response()->json(['data' => $this->present($r, $e, $row->fresh())]);
    }

    public function destroy(Request $r, string $id): Response
    {
        $e = $r->route('entity');
        $row = $this->query($r, $e)->findOrFail($id);
        if ($e === 'notes') {
            abort_unless($row->author_id === $r->user()->id, 403, 'Solo el autor puede borrar la nota.');
        }
        DB::transaction(function () use ($r, $e, $row) {
            if ($e === 'contacts') {
                foreach ($this->query($r, 'events')->lockForUpdate()->get() as $event) {
                    $remaining = array_values(array_diff($event->contact_ids, [$row->id]));
                    if ($remaining !== $event->contact_ids) {
                        $event->update(['contact_ids' => $remaining]);
                    }
                }
            }
            $row->delete();
        });

        return response()->noContent();
    }

    public function affiliations(Request $r, string $id): JsonResponse
    {
        $this->query($r, 'contacts')->findOrFail($id);
        if ($r->isMethod('get')) {
            $rows = $this->query($r, 'affiliations')->where('contact_id', $id)->get();

            return response()->json(['data' => $rows->map(fn ($a) => $this->present($r, 'affiliations', $a)), 'meta' => ['total' => $rows->count(), 'page' => 1, 'per_page' => max(1, $rows->count())]]);
        }
        $v = $this->validated($r, 'affiliations');
        $v['workspace_id'] = $this->workspace($r);
        $v['contact_id'] = $id;

        return response()->json(['data' => $this->present($r, 'affiliations', Record::table('affiliations')->create($v))], 201);
    }

    public function members(Request $r): JsonResponse
    {
        return response()->json(['data' => DB::table('users')->join('memberships', 'users.id', '=', 'memberships.user_id')->where('memberships.workspace_id', $this->workspace($r))->get(['users.id', 'users.name', 'users.email'])]);
    }

    public function grant(Request $r, string $id): JsonResponse
    {
        $message = $this->query($r, 'messages')->findOrFail($id);
        $this->assertParticipant($r, $id);
        $v = $this->validateInput($r, ['user_id' => ['required', 'uuid', Rule::exists('memberships', 'user_id')->where('workspace_id', $this->workspace($r))]]);
        DB::transaction(function () use ($r, $id, $v) {
            $grant = Record::table('message_grants')->firstOrCreate(['message_id' => $id, 'user_id' => $v['user_id']], ['granted_by' => $r->user()->id]);
            $this->audit($r, 'message.grant', $id, ['user_id' => $v['user_id'], 'grant_id' => $grant->id]);
        });

        return response()->json(['data' => $this->present($r, 'messages', $message)]);
    }

    public function revoke(Request $r, string $id, string $grantId): Response
    {
        $this->query($r, 'messages')->findOrFail($id);
        $this->assertParticipant($r, $id);
        DB::transaction(function () use ($r, $id, $grantId) {
            $g = Record::table('message_grants')->where('message_id', $id)->findOrFail($grantId);
            $this->audit($r, 'message.revoke', $id, ['user_id' => $g->user_id, 'grant_id' => $g->id]);
            $g->delete();
        });

        return response()->noContent();
    }

    public function dashboard(Request $r): JsonResponse
    {
        $opps = $this->query($r, 'opportunities')->whereNotIn('stage', ['won', 'lost']);
        $tasks = $this->query($r, 'tasks')->where('status', 'pending');
        $notes = $this->query($r, 'notes')->latest()->limit(5)->get()->map(fn ($n) => ['id' => $n->id, 'type' => 'note', 'title' => mb_substr($n->body, 0, 120), 'created_at' => $n->created_at, 'contact_id' => $n->contact_id]);

        return response()->json(['data' => ['contacts_count' => $this->query($r, 'contacts')->count(), 'companies_count' => $this->query($r, 'companies')->count(), 'open_opportunities_count' => (clone $opps)->count(), 'pipeline_value_minor' => (int) (clone $opps)->where('currency', 'EUR')->sum('value_minor'), 'tasks_due_count' => (clone $tasks)->where('due_at', '<=', now())->count(), 'recent_activities' => $notes, 'upcoming_tasks' => (clone $tasks)->orderBy('due_at')->limit(6)->get()]]);
    }

    public function query(Request $r, string $e): Builder
    {
        $q = Record::table($e)->where('workspace_id', $this->workspace($r));
        $uid = $r->user()->id;
        if ($e === 'notes') {
            $q->where(fn ($q) => $q->where('author_id', $uid)->orWhere('visibility', 'workspace'));
        }
        if ($e === 'messages') {
            $q->where(fn ($q) => $q->whereIn('id', Record::table('message_participants')->select('message_id')->where('user_id', $uid))->orWhereIn('id', Record::table('message_grants')->select('message_id')->where('user_id', $uid)));
        }

        return $q;
    }

    private function present(Request $r, string $e, Record $row): array
    {
        $data = $row->toArray();
        if ($e === 'contacts') {
            $data['name'] = trim($row->first_name.' '.$row->last_name);
            $data['affiliations'] = $this->query($r, 'affiliations')->where('contact_id', $row->id)->get()->map(fn ($a) => $this->present($r, 'affiliations', $a))->all();
        }
        if ($e === 'affiliations') {
            $data['company_name'] = $this->query($r, 'companies')->whereKey($row->company_id)->value('name');
        }
        if ($e === 'notes') {
            $data['author_name'] = DB::table('users')->where('id', $row->author_id)->value('name');
        }
        if ($e === 'messages') {
            unset($data['external_key']);
            $data['participants'] = DB::table('users')->join('message_participants', 'users.id', '=', 'message_participants.user_id')->join('memberships', fn ($join) => $join->on('memberships.user_id', '=', 'users.id')->where('memberships.workspace_id', '=', $this->workspace($r)))->where('message_id', $row->id)->where(fn ($q) => $q->where('message_participants.is_hidden', false)->orWhere('users.id', $r->user()->id))->get(['users.id', 'users.name', 'users.email'])->all();
            $data['grants'] = DB::table('message_grants')->join('users', 'users.id', '=', 'message_grants.user_id')->where('message_id', $row->id)->get(['message_grants.id', 'users.id as user_id', 'users.name'])->all();
            $data['can_share'] = Record::table('message_participants')->where('message_id', $row->id)->where('user_id', $r->user()->id)->exists();
        }

        return $data;
    }

    private function validated(Request $r, string $e, ?Record $row = null): array
    {
        $required = $row ? 'sometimes' : 'required';
        $link = fn ($table) => ['nullable', 'uuid', Rule::exists($table, 'id')->where('workspace_id', $this->workspace($r))];
        $links = ['company_id' => $link('companies'), 'contact_id' => $link('contacts')];
        $rules = match ($e) {
            'contacts' => ['first_name' => "$required|string|max:120", 'last_name' => 'sometimes|nullable|string|max:120', 'email' => 'nullable|email:rfc|max:254', 'phone' => 'nullable|string|max:40', 'job_title' => 'nullable|string|max:200', 'linkedin_url' => 'nullable|url:http,https|max:2000', 'avatar_url' => 'nullable|url:https|max:2000', 'notes' => 'nullable|string|max:20000'],
            'companies' => ['name' => "$required|string|max:200", 'domain' => 'nullable|string|max:254', 'industry' => 'nullable|string|max:200', 'status' => 'sometimes|in:prospect,active,inactive', 'website' => 'nullable|url:http,https|max:2000', 'notes' => 'nullable|string|max:20000'],
            'affiliations' => ['company_id' => [$required, 'uuid', Rule::exists('companies', 'id')->where('workspace_id', $this->workspace($r))], 'role' => 'nullable|string|max:200', 'started_on' => 'nullable|date_format:Y-m-d', 'ended_on' => 'nullable|date_format:Y-m-d'],
            'opportunities' => array_merge($links, ['title' => "$required|string|max:200", 'stage' => 'sometimes|in:new,qualified,proposal,won,lost', 'value_minor' => 'sometimes|integer|min:0|max:100000000000', 'currency' => 'sometimes|in:EUR', 'expected_close_on' => 'nullable|date_format:Y-m-d']),
            'tasks' => array_merge($links, ['title' => "$required|string|max:300", 'due_at' => 'nullable|date', 'status' => 'sometimes|in:pending,completed']),
            'notes' => array_merge($links, ['body' => "$required|string|max:50000", 'visibility' => 'sometimes|in:private,workspace', 'client_request_id' => 'sometimes|uuid']),
            'events' => ['name' => "$required|string|max:200", 'location' => 'nullable|string|max:300', 'starts_at' => "$required|date", 'notes' => 'nullable|string|max:20000', 'contact_ids' => 'sometimes|array|max:500', 'contact_ids.*' => ['uuid', Rule::exists('contacts', 'id')->where('workspace_id', $this->workspace($r))]],
            'quotes' => ['title' => "$required|string|max:200", 'company_id' => $link('companies'), 'opportunity_id' => $link('opportunities'), 'status' => 'sometimes|in:draft,approved,sent', 'currency' => 'sometimes|in:EUR', 'notes' => 'nullable|string|max:20000', 'items' => "$required|array|min:1|max:100", 'items.*' => 'array:description,quantity,unit_price_minor', 'items.*.description' => 'required|string|max:1000', 'items.*.quantity' => 'required|numeric|decimal:0,2|gt:0|max:100000', 'items.*.unit_price_minor' => 'required|integer|min:0|max:100000000'],
            default => []
        };
        $unknown = array_diff(array_keys($r->all()), array_keys($rules));
        if ($unknown) {
            throw ValidationException::withMessages(array_fill_keys($unknown, 'Campo no permitido.'));
        }
        $v = $r->validate($rules);
        if ($row) {
            unset($v['client_request_id']);
        }
        if ($e === 'contacts' && array_key_exists('last_name', $v)) {
            $v['last_name'] = $v['last_name'] ?? '';
        }
        if ($e === 'contacts' && ! empty($v['email'])) {
            $v['email'] = strtolower($v['email']);
        }
        if ($e === 'affiliations') {
            $start = $v['started_on'] ?? $row?->started_on;
            $end = array_key_exists('ended_on', $v) ? $v['ended_on'] : $row?->ended_on;
            if ($start && $end && $end < $start) {
                throw ValidationException::withMessages(['ended_on' => 'La fecha final debe ser posterior a la inicial.']);
            }
        }
        if ($e === 'quotes' && isset($v['items'])) {
            $total = 0;
            foreach ($v['items'] as &$item) {
                $hundredths = (int) round((float) $item['quantity'] * 100);
                $item['quantity'] = $hundredths / 100;
                $item['unit_price_minor'] = (int) $item['unit_price_minor'];
                $item['line_total_minor'] = intdiv($hundredths * $item['unit_price_minor'] + 50, 100);
                $total += $item['line_total_minor'];
            } unset($item);
            $v['total_minor'] = $total;
        }

        return $v;
    }

    private function workspace(Request $r): string
    {
        return $r->attributes->get('api_session')->workspace_id;
    }

    private function assertParticipant(Request $r, string $id): void
    {
        abort_unless(Record::table('message_participants')->where('message_id', $id)->where('user_id', $r->user()->id)->exists(), 403, 'Solo un participante original puede gestionar el acceso.');
    }

    private function audit(Request $r, string $action, string $subject, array $metadata): void
    {
        Record::table('audit_logs')->create(['workspace_id' => $this->workspace($r), 'actor_id' => $r->user()->id, 'action' => $action, 'subject_id' => $subject, 'metadata' => $metadata]);
    }

    private function snapshot(Record $quote): void
    {
        Record::table('quote_versions')->create(['workspace_id' => $quote->workspace_id, 'quote_id' => $quote->id, 'version' => $quote->version ?? 1, 'snapshot' => $quote->toArray()]);
    }
}
