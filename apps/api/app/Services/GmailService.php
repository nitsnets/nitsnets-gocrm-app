<?php

namespace App\Services;

use App\Models\Record;
use Carbon\Carbon;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Mime\Address;

class GmailService
{
    public function sync(Record $connection): void
    {
        if (! Record::table('memberships')->where('workspace_id', $connection->workspace_id)->where('user_id', $connection->user_id)->exists()) {
            return;
        }
        $token = $this->token($connection);
        $profile = $this->get($token, 'profile')->json();
        $ids = [];
        $page = null;
        $history = $connection->history_id;
        $nextHistory = (string) $profile['historyId'];
        if ($history) {
            do {
                $response = $this->get($token, 'history', array_filter(['startHistoryId' => $history, 'historyTypes' => 'messageAdded', 'pageToken' => $page, 'maxResults' => 100]));
                if ($response->status() === 404) {
                    $history = null;
                    break;
                }
                $data = $response->json();
                foreach ($data['history'] ?? [] as $h) {
                    foreach ($h['messagesAdded'] ?? [] as $m) {
                        $ids[] = $m['message']['id'];
                    }
                }
                $page = $data['nextPageToken'] ?? null;
                $nextHistory = (string) ($data['historyId'] ?? $nextHistory);
            } while ($page);
        }
        if (! $history) {
            $page = null;
            do {
                $data = $this->get($token, 'messages', array_filter(['q' => 'newer_than:'.config('gmail.initial_days').'d -in:trash -in:spam', 'maxResults' => 100, 'pageToken' => $page]))->json();
                foreach ($data['messages'] ?? [] as $m) {
                    $ids[] = $m['id'];
                } $page = $data['nextPageToken'] ?? null;
            } while ($page);
        }
        foreach (array_unique($ids) as $id) {
            if (! Record::table('gmail_connections')->whereKey($connection->id)->exists()) {
                return;
            }
            $response = $this->get($token, 'messages/'.$id, ['format' => 'full']);
            if ($response->status() === 404) {
                continue;
            }
            $this->import($connection, $response->json());
        }
        Record::table('gmail_connections')->whereKey($connection->id)->update(['history_id' => $nextHistory, 'last_synced_at' => now(), 'status' => 'connected', 'updated_at' => now()]);
    }

    public function import(Record $connection, array $mail): void
    {
        if (array_intersect(['SPAM', 'TRASH'], $mail['labelIds'] ?? [])) {
            return;
        }
        $headers = [];
        foreach ($mail['payload']['headers'] ?? [] as $h) {
            $headers[strtolower($h['name'])] = $h['value'];
        }
        $from = $this->emails($headers['from'] ?? '');
        $to = $this->emails($headers['to'] ?? '');
        $cc = $this->emails($headers['cc'] ?? '');
        $addresses = array_unique(array_merge($from, $to, $cc));
        $contact = Record::table('contacts')->where('workspace_id', $connection->workspace_id)->whereIn('email', $addresses)->first();
        if (! $contact) {
            return;
        }
        $key = hash('sha256', $connection->id.':'.$mail['id']);
        $internal = DB::table('users')->join('memberships', 'users.id', '=', 'memberships.user_id')->where('memberships.workspace_id', $connection->workspace_id)->whereNotNull('users.email_verified_at')->whereIn('users.email', array_merge($to, $cc))->pluck('users.id')->all();
        $connected = Record::table('gmail_connections')->where('workspace_id', $connection->workspace_id)->whereIn('email', array_merge($to, $cc))->pluck('user_id')->all();
        $visibleIds = array_unique(array_merge($internal, $connected, in_array($connection->email, $addresses, true) ? [$connection->user_id] : []));
        DB::transaction(function () use ($connection, $mail, $headers, $from, $to, $cc, $contact, $key, $visibleIds) {
            if (! Record::table('gmail_connections')->whereKey($connection->id)->lockForUpdate()->exists()) {
                return;
            }
            $message = Record::table('messages')->firstOrCreate(['workspace_id' => $connection->workspace_id, 'external_key' => $key], ['subject' => mb_substr($headers['subject'] ?? '(Sin asunto)', 0, 10000), 'from_email' => $from[0] ?? 'unknown@example.invalid', 'from_name' => trim(preg_replace('/<[^>]*>/', '', $headers['from'] ?? ''), ' "'), 'to' => $to, 'cc' => $cc, 'received_at' => Carbon::createFromTimestampMs((int) ($mail['internalDate'] ?? (time() * 1000))), 'body_text' => $this->body($mail['payload'] ?? []), 'contact_id' => $contact->id]);
            foreach (array_unique(array_merge($visibleIds, [$connection->user_id])) as $uid) {
                $hidden = ! in_array($uid, $visibleIds, true);
                $p = Record::table('message_participants')->firstOrCreate(['message_id' => $message->id, 'user_id' => $uid], ['is_hidden' => $hidden]);
                if (! $hidden && $p->is_hidden) {
                    $p->update(['is_hidden' => false]);
                }
            }
        });
    }

    private function token(Record $c): string
    {
        if ($c->expires_at->isFuture() && $c->expires_at->diffInSeconds(now(), true) > 60) {
            return Crypt::decryptString($c->access_token);
        }
        try {
            $response = Http::asForm()->timeout(20)->post('https://oauth2.googleapis.com/token', ['client_id' => config('gmail.client_id'), 'client_secret' => config('gmail.client_secret'), 'refresh_token' => Crypt::decryptString($c->refresh_token), 'grant_type' => 'refresh_token']);
        } catch (\Throwable) {
            throw new \RuntimeException('Gmail token refresh connection failed.');
        }
        if (! $response->successful()) {
            if (in_array($response->status(), [400, 401])) {
                $c->update(['status' => 'reauthorization_required']);
            }
            throw new \RuntimeException('Gmail token refresh failed. Reconnect the account.');
        }
        $data = $response->json();
        $c->update(['access_token' => Crypt::encryptString($data['access_token']), 'expires_at' => now()->addSeconds($data['expires_in'] ?? 3600)]);

        return $data['access_token'];
    }

    private function get(string $token, string $path, array $query = []): Response
    {
        try {
            $response = Http::withToken($token)->timeout(30)->retry(3, 500, throw: false)->get('https://gmail.googleapis.com/gmail/v1/users/me/'.$path, $query);
        } catch (\Throwable) {
            throw new \RuntimeException('Gmail connection failed.');
        }
        if (! $response->successful() && $response->status() !== 404) {
            throw new \RuntimeException('Gmail request failed (HTTP '.$response->status().').');
        }

        return $response;
    }

    /** Split mailboxes without treating text in quoted display names as addresses. Invalid/ambiguous syntax is skipped. */
    private function emails(string $header): array
    {
        $parts = [];
        $buffer = '';
        $quoted = false;
        $escaped = false;
        $angle = 0;
        $comment = 0;
        foreach (str_split($header) as $char) {
            if ($escaped) {
                $buffer .= $char;
                $escaped = false;

                continue;
            }
            if ($char === '\\' && $quoted) {
                $buffer .= $char;
                $escaped = true;

                continue;
            }
            if ($char === '"' && $comment === 0) {
                $quoted = ! $quoted;
                $buffer .= $char;

                continue;
            }
            if (! $quoted) {
                if ($char === '(') {
                    $comment++;

                    continue;
                }
                if ($char === ')' && $comment > 0) {
                    $comment--;

                    continue;
                }
                if ($comment > 0) {
                    continue;
                }
                if ($char === '<') {
                    $angle++;
                }
                if ($char === '>') {
                    $angle--;
                }
                if ($char === ',' && $angle === 0) {
                    $parts[] = trim($buffer);
                    $buffer = '';

                    continue;
                }
            }
            $buffer .= $char;
        }
        if ($quoted || $angle !== 0 || $comment !== 0) {
            return [];
        }
        $parts[] = trim($buffer);
        $emails = [];
        foreach ($parts as $part) {
            if ($part === '') {
                continue;
            }
            try {
                $emails[] = strtolower(Address::create($part)->getAddress());
            } catch (\InvalidArgumentException) {
                continue;
            }
        }

        return array_values(array_unique($emails));
    }

    private function body(array $part): string
    {
        if (! empty($part['filename'])) {
            return '';
        }
        $mime = $part['mimeType'] ?? '';
        $raw = $part['body']['data'] ?? '';
        if ($raw && in_array($mime, ['text/plain', 'text/html'])) {
            $decoded = base64_decode(strtr($raw, '-_', '+/')) ?: '';

            return $mime === 'text/html' ? html_entity_decode(strip_tags($decoded), ENT_QUOTES | ENT_HTML5) : $decoded;
        }
        $parts = $part['parts'] ?? [];
        foreach ($parts as $child) {
            if (($child['mimeType'] ?? '') === 'text/plain') {
                return $this->body($child);
            }
        }
        $text = [];
        foreach ($parts as $child) {
            $body = $this->body($child);
            if ($body !== '') {
                $text[] = $body;
            }
        }

        return implode("\n", $text);
    }
}
