<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Record extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $hidden = ['token_hash', 'access_token', 'refresh_token', 'code_verifier', 'state_hash', 'request_hash', 'nonce_hash', 'code_hash', 'client_challenge'];

    protected function casts(): array
    {
        return ['to' => 'array', 'cc' => 'array', 'items' => 'array', 'contact_ids' => 'array', 'metadata' => 'array', 'snapshot' => 'array', 'value_minor' => 'integer', 'total_minor' => 'integer', 'version' => 'integer', 'received_at' => 'datetime', 'due_at' => 'datetime', 'starts_at' => 'datetime', 'expires_at' => 'datetime', 'last_synced_at' => 'datetime'];
    }

    public static function table(string $table): Builder
    {
        return (new self)->setTable($table)->newQuery();
    }
}
