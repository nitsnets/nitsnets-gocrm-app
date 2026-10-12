<?php

namespace Tests\Feature;

use App\Jobs\SyncGmail;
use App\Models\Record;
use App\Models\User;
use App\Services\GmailService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class CrmApiTest extends TestCase
{
    use RefreshDatabase;

    private array $session;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->seed();
        $this->session = $this->login('eladio');
    }

    private function login(string $name): array
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $name.'@nitsnets.demo', 'password' => 'DemoCRM!2026'])->assertOk()->json('data');
    }

    private function headers(?array $s = null): array
    {
        $s = $s ?? $this->session;

        return ['Authorization' => 'Bearer '.$s['token'], 'X-Workspace-ID' => $s['workspace']['id']];
    }

    private function firstId(string $resource): string
    {
        return $this->getJson('/api/v1/'.$resource, $this->headers())->assertOk()->json('data.0.id');
    }

    public function test_authentication_is_hashed_expires_and_logout_revokes_only_current_session(): void
    {
        $this->getJson('/api/v1/contacts')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => 'eladio@nitsnets.demo', 'password' => 'wrong'])->assertUnauthorized();
        $this->assertDatabaseMissing('api_sessions', ['token_hash' => $this->session['token']]);
        $other = $this->login('eladio');
        $this->postJson('/api/v1/auth/logout', [], $this->headers())->assertNoContent();
        $this->getJson('/api/v1/me', $this->headers())->assertUnauthorized();
        $this->getJson('/api/v1/me', $this->headers($other))->assertOk();
        Record::table('api_sessions')->where('token_hash', hash('sha256', $other['token']))->update(['expires_at' => now()->subSecond()]);
        $this->getJson('/api/v1/me', $this->headers($other))->assertUnauthorized();
    }

    public function test_workspace_switch_is_per_session_and_rejects_stale_headers_and_foreign_ids(): void
    {
        $contact = $this->firstId('contacts');
        $second = $this->session['workspaces'][1]['id'];
        $other = $this->login('eladio');
        $this->getJson('/api/v1/contacts', ['Authorization' => 'Bearer '.$this->session['token']])->assertStatus(400);
        $this->postJson('/api/v1/session/workspace', ['workspace_id' => $second], $this->headers())->assertOk();
        $this->getJson('/api/v1/contacts', $this->headers())->assertConflict();
        $headers = $this->headers();
        $headers['X-Workspace-ID'] = $second;
        $this->getJson('/api/v1/contacts', $headers)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.first_name', 'Lucía');
        $this->getJson('/api/v1/contacts/'.$contact, $headers)->assertNotFound();
        $this->postJson('/api/v1/notes', ['body' => 'cross tenant', 'contact_id' => $contact], $headers)->assertUnprocessable();
        $this->getJson('/api/v1/contacts', $this->headers($other))->assertOk()->assertJsonCount(2, 'data');
        $jose = $this->login('jose');
        $this->postJson('/api/v1/session/workspace', ['workspace_id' => $second], $this->headers($jose))->assertForbidden();
    }

    public function test_contacts_crud_affiliation_history_and_cross_tenant_links(): void
    {
        $c = $this->postJson('/api/v1/contacts', ['first_name' => 'Marta', 'last_name' => 'Ríos', 'email' => 'MARTA@example.com'], $this->headers())->assertCreated()->assertJsonPath('data.email', 'marta@example.com')->json('data.id');
        $company = $this->firstId('companies');
        $aff = $this->postJson('/api/v1/contacts/'.$c.'/affiliations', ['company_id' => $company, 'role' => 'Consultora', 'started_on' => '2024-01-01', 'ended_on' => '2025-01-01'], $this->headers())->assertCreated()->json('data.id');
        $this->postJson('/api/v1/contacts/'.$c.'/affiliations', ['company_id' => $company, 'role' => 'Consejera', 'started_on' => '2024-03-01'], $this->headers())->assertCreated();
        $this->getJson('/api/v1/contacts/'.$c, $this->headers())->assertJsonCount(2, 'data.affiliations');
        $this->patchJson('/api/v1/affiliations/'.$aff, ['ended_on' => '2020-01-01'], $this->headers())->assertUnprocessable();
        $this->patchJson('/api/v1/contacts/'.$c, ['phone' => '600123123'], $this->headers())->assertOk();
        $this->deleteJson('/api/v1/contacts/'.$c, [], $this->headers())->assertNoContent();
        $this->getJson('/api/v1/contacts/'.$c, $this->headers())->assertNotFound();
    }

    public function test_message_acl_is_per_message_grantees_cannot_share_and_revocation_is_effective(): void
    {
        $jose = $this->login('jose');
        $alberto = $this->login('alberto');
        $this->getJson('/api/v1/messages', $this->headers())->assertJsonCount(3, 'data');
        $this->getJson('/api/v1/messages', $this->headers($jose))->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/messages', $this->headers($alberto))->assertJsonCount(1, 'data');
        $private = Record::table('messages')->where('subject', 'Consulta privada sobre el proyecto')->first();
        $this->getJson('/api/v1/messages/'.$private->id, $this->headers($alberto))->assertNotFound();
        $response = $this->postJson('/api/v1/messages/'.$private->id.'/grants', ['user_id' => $jose['user']['id']], $this->headers())->assertOk();
        $grant = $response->json('data.grants.0.id');
        $this->getJson('/api/v1/messages/'.$private->id, $this->headers($jose))->assertOk()->assertJsonPath('data.can_share', false);
        $this->postJson('/api/v1/messages/'.$private->id.'/grants', ['user_id' => $alberto['user']['id']], $this->headers($jose))->assertForbidden();
        $this->deleteJson('/api/v1/messages/'.$private->id.'/grants/'.$grant, [], $this->headers())->assertNoContent();
        $this->getJson('/api/v1/messages/'.$private->id, $this->headers($jose))->assertNotFound();
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_admin_has_no_message_bypass_and_grants_cannot_cross_workspace(): void
    {
        $alberto = User::where('email', 'alberto@nitsnets.demo')->first();
        $private = Record::table('messages')->create(['workspace_id' => $this->session['workspace']['id'], 'subject' => 'Alberto privado', 'from_email' => 'a@x.com', 'to' => [$alberto->email], 'cc' => [], 'received_at' => now(), 'body_text' => 'private']);
        Record::table('message_participants')->create(['message_id' => $private->id, 'user_id' => $alberto->id]);
        $this->getJson('/api/v1/messages/'.$private->id, $this->headers())->assertNotFound();
        $outsider = User::factory()->create();
        $own = $this->firstId('messages');
        $this->postJson('/api/v1/messages/'.$own.'/grants', ['user_id' => $outsider->id], $this->headers())->assertUnprocessable();
    }

    public function test_notes_default_private_and_idempotent_retry_detects_conflict(): void
    {
        $jose = $this->login('jose');
        $uuid = (string) Str::uuid();
        $body = ['body' => 'Recuerdo personal', 'client_request_id' => $uuid];
        $id = $this->postJson('/api/v1/notes', $body, $this->headers())->assertCreated()->assertJsonPath('data.visibility', 'private')->json('data.id');
        $this->postJson('/api/v1/notes', $body, $this->headers())->assertOk()->assertJsonPath('data.id', $id);
        $this->postJson('/api/v1/notes', ['body' => 'Otro contenido', 'client_request_id' => $uuid], $this->headers())->assertConflict()->assertJsonPath('error.code', 'idempotency_conflict');
        $this->getJson('/api/v1/notes/'.$id, $this->headers($jose))->assertNotFound();
        $this->patchJson('/api/v1/notes/'.$id, ['visibility' => 'workspace'], $this->headers())->assertOk();
        $this->getJson('/api/v1/notes/'.$id, $this->headers($jose))->assertOk();
        $this->deleteJson('/api/v1/notes/'.$id, [], $this->headers($jose))->assertForbidden();
    }

    public function test_quotes_use_integer_half_up_totals_and_preserve_versions(): void
    {
        $q = $this->postJson('/api/v1/quotes', ['title' => 'Prueba', 'items' => [['description' => 'Servicio', 'quantity' => 1.25, 'unit_price_minor' => 102], ['description' => 'Otro', 'quantity' => 2, 'unit_price_minor' => 50]]], $this->headers())->assertCreated()->assertJsonPath('data.total_minor', 228)->assertJsonPath('data.items.0.line_total_minor', 128)->json('data.id');
        $this->patchJson('/api/v1/quotes/'.$q, ['status' => 'approved'], $this->headers())->assertOk()->assertJsonPath('data.version', 2);
        $this->assertSame(2, Record::table('quote_versions')->where('quote_id', $q)->count());
        $this->postJson('/api/v1/quotes', ['title' => 'invalid', 'items' => [['description' => 'x', 'quantity' => 1.123, 'unit_price_minor' => 10]]], $this->headers())->assertUnprocessable();
        $this->patchJson('/api/v1/quotes/'.$q, ['total_minor' => 1], $this->headers())->assertUnprocessable();
    }

    public function test_core_resources_filters_and_validation(): void
    {
        $c = $this->firstId('contacts');
        $task = $this->postJson('/api/v1/tasks', ['title' => 'Llamar', 'contact_id' => $c, 'due_at' => '2026-10-11T12:00:00Z'], $this->headers())->assertCreated()->json('data.id');
        $this->getJson('/api/v1/tasks?contact_id='.$c.'&per_page=100', $this->headers())->assertOk();
        $this->patchJson('/api/v1/tasks/'.$task, ['status' => 'completed'], $this->headers())->assertOk()->assertJsonPath('data.status', 'completed');
        $this->postJson('/api/v1/events', ['name' => 'Evento', 'starts_at' => '2026-10-12T10:00:00Z', 'contact_ids' => [$c]], $this->headers())->assertCreated()->assertJsonPath('data.contact_ids.0', $c);
        $this->postJson('/api/v1/opportunities', ['title' => 'Venta', 'value_minor' => 12345], $this->headers())->assertCreated();
        $this->getJson('/api/v1/dashboard', $this->headers())->assertOk()->assertJsonStructure(['data' => ['contacts_count', 'upcoming_tasks', 'recent_activities']]);
        $this->getJson('/api/v1/contacts?per_page=101', $this->headers())->assertUnprocessable();
        $this->postJson('/api/v1/contacts', ['first_name' => 'Forged', 'workspace_id' => $this->session['workspaces'][1]['id']], $this->headers())->assertUnprocessable();
    }

    private function connection(): Record
    {
        return Record::table('gmail_connections')->create(['workspace_id' => $this->session['workspace']['id'], 'user_id' => $this->session['user']['id'], 'email' => 'eladio@nitsnets.demo', 'access_token' => Crypt::encryptString('access-test'), 'refresh_token' => Crypt::encryptString('refresh-test'), 'expires_at' => now()->addHour()]);
    }

    private function mail(string $id = 'gmail-1', string $to = 'eladio@nitsnets.demo'): array
    {
        return ['id' => $id, 'internalDate' => '1791620000000', 'payload' => ['mimeType' => 'text/plain', 'headers' => [['name' => 'From', 'value' => 'Bernardo García <bernardo@atlas.example>'], ['name' => 'To', 'value' => $to], ['name' => 'Subject', 'value' => 'Real Gmail test'], ['name' => 'Message-ID', 'value' => '<collision@example.com>']], 'body' => ['data' => rtrim(strtr(base64_encode('Texto privado de prueba'), '+/', '-_'), '=')]]];
    }

    public function test_gmail_unconfigured_is_explicit_and_oauth_state_is_single_use(): void
    {
        $this->getJson('/api/v1/integrations/gmail', $this->headers())->assertOk()->assertJsonPath('data.connected', false);
        $this->postJson('/api/v1/integrations/gmail/connect', [], $this->headers())->assertStatus(503);
        config(['gmail.client_id' => 'test', 'gmail.client_secret' => 'secret']);
        Queue::fake();
        $url = $this->postJson('/api/v1/integrations/gmail/connect', [], $this->headers())->assertOk()->json('data.authorization_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);
        $this->assertSame('S256', $query['code_challenge_method']);
        Http::fake(['https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'a', 'refresh_token' => 'r', 'expires_in' => 3600]), 'https://gmail.googleapis.com/gmail/v1/users/me/profile' => Http::response(['emailAddress' => 'eladio@gmail.com', 'historyId' => '20'])]);
        $path = '/api/v1/integrations/gmail/callback?state='.$query['state'].'&code=test';
        $this->get($path)->assertRedirect('http://127.0.0.1:3000/?view=settings&gmail=connected');
        $this->getJson($path)->assertStatus(400);
        $connection = Record::table('gmail_connections')->first();
        $this->assertNotEquals('r', $connection->refresh_token);
        $this->assertSame('r', Crypt::decryptString($connection->refresh_token));
        Queue::assertPushed(SyncGmail::class);
    }

    public function test_gmail_import_is_scoped_idempotent_and_hides_bcc_identity(): void
    {
        $connection = $this->connection();
        $service = app(GmailService::class);
        $mail = $this->mail('gmail-1', 'jose@nitsnets.demo');
        $service->import($connection, $mail);
        $service->import($connection, $mail);
        $this->assertSame(1, Record::table('messages')->where('subject', 'Real Gmail test')->count());
        $id = Record::table('messages')->where('subject', 'Real Gmail test')->value('id');
        $jose = $this->login('jose');
        $alberto = $this->login('alberto');
        $this->getJson('/api/v1/messages/'.$id, $this->headers($jose))->assertOk()->assertJsonCount(1, 'data.participants')->assertJsonPath('data.participants.0.name', 'José Antonio');
        $this->getJson('/api/v1/messages/'.$id, $this->headers($alberto))->assertNotFound();
        $this->getJson('/api/v1/messages/'.$id, $this->headers())->assertOk()->assertJsonPath('data.can_share', true);
        $service->import($connection, $this->mail('gmail-2', 'alberto@nitsnets.demo'));
        $this->getJson('/api/v1/messages/'.$id, $this->headers($alberto))->assertNotFound();
    }

    public function test_gmail_initial_and_incremental_sync_use_real_provider_protocol_with_fake_http(): void
    {
        $connection = $this->connection();
        Http::fake(['*users/me/profile' => Http::response(['historyId' => '30']), '*users/me/messages?*' => Http::response(['messages' => [['id' => 'gmail-1']]]), '*users/me/messages/gmail-1?*' => Http::response($this->mail()), '*users/me/history?*' => Http::response(['historyId' => '31', 'history' => []])]);
        app(GmailService::class)->sync($connection);
        $this->assertSame('30', $connection->fresh()->history_id);
        app(GmailService::class)->sync($connection->fresh());
        $this->assertSame('31', $connection->fresh()->history_id);
        $this->assertSame(1, Record::table('messages')->where('subject', 'Real Gmail test')->count());
    }

    public function test_gmail_display_names_cannot_forge_internal_recipients_and_sent_owner_is_visible(): void
    {
        $connection = $this->connection();
        $mail = $this->mail('spoof', '"alberto@nitsnets.demo, admin" <bernardo@atlas.example>, "José, Antonio" <jose@nitsnets.demo>');
        app(GmailService::class)->import($connection, $mail);
        $id = Record::table('messages')->where('subject', 'Real Gmail test')->value('id');
        $alberto = $this->login('alberto');
        $this->getJson('/api/v1/messages/'.$id, $this->headers($alberto))->assertNotFound();
        $jose = $this->login('jose');
        $this->getJson('/api/v1/messages/'.$id, $this->headers($jose))->assertOk()->assertJsonCount(1, 'data.participants');
        $sent = $this->mail('sent', 'bernardo@atlas.example');
        $sent['payload']['headers'][0]['value'] = 'Eladio <eladio@nitsnets.demo>';
        app(GmailService::class)->import($connection, $sent);
        $sentId = Record::table('messages')->where('external_key', hash('sha256', $connection->id.':sent'))->value('id');
        $this->getJson('/api/v1/messages/'.$sentId, $this->headers())->assertOk()->assertJsonCount(1, 'data.participants')->assertJsonPath('data.participants.0.id', $this->session['user']['id']);
    }

    public function test_gmail_rejects_expired_state_and_preserves_original_workspace_on_callback(): void
    {
        config(['gmail.client_id' => 'test', 'gmail.client_secret' => 'secret']);
        Queue::fake();
        $url = $this->postJson('/api/v1/integrations/gmail/connect', [], $this->headers())->assertOk()->json('data.authorization_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $params);
        $this->postJson('/api/v1/session/workspace', ['workspace_id' => $this->session['workspaces'][1]['id']], $this->headers())->assertOk();
        Http::fake(['*oauth2.googleapis.com/token' => Http::response(['access_token' => 'a', 'refresh_token' => 'r']), '*users/me/profile' => Http::response(['emailAddress' => 'eladio@gmail.com'])]);
        $this->get('/api/v1/integrations/gmail/callback?state='.$params['state'].'&code=test')->assertRedirect();
        $this->assertDatabaseHas('gmail_connections', ['workspace_id' => $this->session['workspace']['id']]);
        $headers = $this->headers();
        $headers['X-Workspace-ID'] = $this->session['workspaces'][1]['id'];
        $url = $this->postJson('/api/v1/integrations/gmail/connect', [], $headers)->assertOk()->json('data.authorization_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $expired);
        Record::table('oauth_states')->update(['expires_at' => now()->subSecond()]);
        $this->getJson('/api/v1/integrations/gmail/callback?state='.$expired['state'].'&code=test')->assertStatus(400);
    }

    public function test_gmail_expired_history_recovers_and_refreshes_access_token_without_leaking_secrets(): void
    {
        $connection = $this->connection();
        $connection->update(['expires_at' => now()->subMinute(), 'history_id' => 'expired']);
        Http::fake(['*oauth2.googleapis.com/token' => Http::response(['access_token' => 'renewed-token', 'expires_in' => 3600]), '*users/me/profile' => Http::response(['historyId' => '100']), '*users/me/history?*' => Http::response([], 404), '*users/me/messages?*' => Http::response(['messages' => [['id' => 'gmail-1']]]), '*users/me/messages/gmail-1?*' => Http::response($this->mail())]);
        app(GmailService::class)->sync($connection);
        $this->assertSame('100', $connection->fresh()->history_id);
        $this->assertSame('renewed-token', Crypt::decryptString($connection->fresh()->access_token));
        $status = $this->getJson('/api/v1/integrations/gmail', $this->headers())->assertOk()->getContent();
        $this->assertStringNotContainsString('renewed-token', $status);
        $this->assertStringNotContainsString('refresh-test', $status);
    }

    public function test_gmail_ios_callback_is_bound_to_client_and_consumes_denied_states(): void
    {
        config(['gmail.client_id' => 'test', 'gmail.client_secret' => 'secret']);
        Queue::fake();
        $this->postJson('/api/v1/integrations/gmail/connect', ['client' => 'https://evil.example'], $this->headers())->assertUnprocessable();
        $response = $this->postJson('/api/v1/integrations/gmail/connect', ['client' => 'ios'], $this->headers())->assertOk();
        $state = $response->json('data.state');
        Http::fake(['*oauth2.googleapis.com/token' => Http::response(['access_token' => 'a', 'refresh_token' => 'r']), '*users/me/profile' => Http::response(['emailAddress' => 'eladio@gmail.com'])]);
        $path = '/api/v1/integrations/gmail/callback?state='.$state.'&code=test';
        $this->get($path)->assertRedirect('com.nitsnets.crm://oauth/gmail?state='.$state.'&gmail=connected');
        $this->getJson($path)->assertStatus(400);
        $this->getJson('/api/v1/integrations/gmail', $this->headers())->assertJsonPath('data.status', 'queued');
        $state = $this->postJson('/api/v1/integrations/gmail/connect', ['client' => 'ios'], $this->headers())->json('data.state');
        $this->get('/api/v1/integrations/gmail/callback?state='.$state.'&error=access_denied')->assertRedirect('com.nitsnets.crm://oauth/gmail?state='.$state.'&gmail=cancelled');
        $this->getJson('/api/v1/integrations/gmail/callback?state='.$state.'&code=test')->assertStatus(400);
    }

    public function test_gmail_reconnection_cannot_silently_change_the_mailbox(): void
    {
        config(['gmail.client_id' => 'test', 'gmail.client_secret' => 'secret']);
        $connection = $this->connection();
        Queue::fake();
        $state = $this->postJson('/api/v1/integrations/gmail/connect', ['client' => 'ios'], $this->headers())->json('data.state');
        Http::fake(['*oauth2.googleapis.com/token' => Http::response(['access_token' => 'a', 'refresh_token' => 'r']), '*users/me/profile' => Http::response(['emailAddress' => 'another@gmail.com'])]);
        $this->get('/api/v1/integrations/gmail/callback?state='.$state.'&code=test')->assertRedirect('com.nitsnets.crm://oauth/gmail?state='.$state.'&gmail=account_mismatch');
        $this->assertSame('eladio@nitsnets.demo', $connection->fresh()->email);
        Queue::assertNothingPushed();
    }

    public function test_gmail_job_reports_progress_failure_and_reauthorization_without_provider_secrets(): void
    {
        $connection = $this->connection();
        Queue::fake();
        $this->postJson('/api/v1/integrations/gmail/sync', [], $this->headers())->assertAccepted();
        $this->getJson('/api/v1/integrations/gmail', $this->headers())->assertJsonPath('data.status', 'queued');
        Http::fake(function ($request) use ($connection) {
            $this->assertSame('syncing', $connection->fresh()->status);

            if (str_contains($request->url(), 'oauth2.googleapis.com/token')) {
                return Http::response(['error' => 'invalid_grant', 'sensitive' => 'do-not-log'], 400);
            }

            return str_contains($request->url(), '/profile') ? Http::response(['historyId' => '30']) : Http::response(['messages' => []]);
        });
        (new SyncGmail($connection->id))->handle(app(GmailService::class));
        $this->getJson('/api/v1/integrations/gmail', $this->headers())->assertJsonPath('data.status', 'connected');
        $connection->update(['expires_at' => now()->subMinute()]);
        try {
            (new SyncGmail($connection->id))->handle(app(GmailService::class));
            $this->fail('A revoked token must fail.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Gmail synchronization failed.', $error->getMessage());
            $this->assertNull($error->getPrevious());
        }
        $this->getJson('/api/v1/integrations/gmail', $this->headers())->assertJsonPath('data.status', 'reauthorization_required');
        $this->postJson('/api/v1/integrations/gmail/sync', [], $this->headers())->assertConflict();
        (new SyncGmail($connection->id))->failed(null);
        $this->assertSame('reauthorization_required', $connection->fresh()->status);
    }

    public function test_gmail_provider_failure_is_returned_to_ios_and_job_errors_are_sanitized(): void
    {
        config(['gmail.client_id' => 'test', 'gmail.client_secret' => 'secret']);
        Queue::fake();
        $state = $this->postJson('/api/v1/integrations/gmail/connect', ['client' => 'ios'], $this->headers())->json('data.state');
        Http::fake(fn () => throw new \RuntimeException('private-provider-payload'));
        $this->get('/api/v1/integrations/gmail/callback?state='.$state.'&code=test')->assertRedirect('com.nitsnets.crm://oauth/gmail?state='.$state.'&gmail=error');
        $this->assertSame(0, Record::table('gmail_connections')->count());
        Queue::assertNothingPushed();
        $connection = $this->connection();
        try {
            (new SyncGmail($connection->id))->handle(app(GmailService::class));
            $this->fail('Provider failure must propagate.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Gmail synchronization failed.', $error->getMessage());
            $this->assertNull($error->getPrevious());
        }
        $this->assertSame('sync_error', $connection->fresh()->status);
        $this->assertNull($connection->fresh()->last_synced_at);
    }

    public function test_gmail_skips_spam_trash_and_disconnected_connections(): void
    {
        $connection = $this->connection();
        $service = app(GmailService::class);
        foreach (['SPAM', 'TRASH'] as $label) {
            $mail = $this->mail($label);
            $mail['labelIds'] = [$label];
            $service->import($connection, $mail);
        }
        $connection->delete();
        $service->import($connection, $this->mail('after-disconnect'));
        $this->assertSame(0, Record::table('messages')->where('subject', 'Real Gmail test')->count());
    }

    public function test_gmail_connection_is_private_to_user_and_workspace(): void
    {
        $connection = $this->connection();
        $jose = $this->login('jose');
        $this->getJson('/api/v1/integrations/gmail', $this->headers($jose))->assertJsonPath('data.connected', false)->assertJsonPath('data.email', null);
        $this->postJson('/api/v1/integrations/gmail/sync', [], $this->headers($jose))->assertConflict();
        $this->deleteJson('/api/v1/integrations/gmail', [], $this->headers($jose))->assertNoContent();
        $this->assertNotNull($connection->fresh());
        $other = $this->session['workspaces'][1]['id'];
        $this->postJson('/api/v1/session/workspace', ['workspace_id' => $other], $this->headers())->assertOk();
        $headers = $this->headers();
        $headers['X-Workspace-ID'] = $other;
        $this->getJson('/api/v1/integrations/gmail', $headers)->assertJsonPath('data.connected', false);
        $this->deleteJson('/api/v1/integrations/gmail', [], $headers)->assertNoContent();
        $this->assertNotNull($connection->fresh());
    }

    public function test_deleted_contact_is_removed_from_events_without_deleting_messages_or_quotes(): void
    {
        $contact = Record::table('contacts')->where('email', 'bernardo@atlas.example')->first();
        $this->deleteJson('/api/v1/contacts/'.$contact->id, [], $this->headers())->assertNoContent();
        $events = $this->getJson('/api/v1/events', $this->headers())->assertOk()->json('data');
        foreach ($events as $event) {
            $this->assertNotContains($contact->id, $event['contact_ids']);
        }
        $this->getJson('/api/v1/messages', $this->headers())->assertJsonCount(3, 'data');
        $this->getJson('/api/v1/quotes', $this->headers())->assertJsonCount(1, 'data');
    }
}
