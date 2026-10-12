<?php

namespace App\Jobs;

use App\Models\Record;
use App\Services\GmailService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class SyncGmail implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 300;

    public int $uniqueFor = 900;

    public function __construct(public string $connectionId) {}

    public function middleware(): array
    {
        return [(new WithoutOverlapping('gmail:'.$this->connectionId))->releaseAfter(30)->expireAfter(360)];
    }

    public function uniqueId(): string
    {
        return $this->connectionId;
    }

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    public function handle(GmailService $gmail): void
    {
        $c = Record::table('gmail_connections')->find($this->connectionId);
        if ($c && $c->status !== 'reauthorization_required') {
            $c->update(['status' => 'syncing']);
            try {
                $gmail->sync($c);
            } catch (\Throwable $error) {
                Record::table('gmail_connections')->whereKey($c->id)->where('status', '!=', 'reauthorization_required')->update(['status' => 'sync_error']);
                throw new \RuntimeException('Gmail synchronization failed.');
            }
        }
    }

    public function failed(?\Throwable $exception): void
    {
        Record::table('gmail_connections')->whereKey($this->connectionId)->where('status', '!=', 'reauthorization_required')->update(['status' => 'sync_error']);
    }
}
