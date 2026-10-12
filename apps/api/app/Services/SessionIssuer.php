<?php

namespace App\Services;

use App\Models\Record;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SessionIssuer
{
    public function issue(User $user): array
    {
        return DB::transaction(function () use ($user) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $memberships = Record::table('memberships')->where('user_id', $user->id)->lockForUpdate()->pluck('workspace_id');
            $workspaces = Record::table('workspaces')->whereIn('id', $memberships)->orderBy('created_at')->get(['id', 'name'])->toArray();
            abort_unless(count($workspaces), 403, 'Sin empresas asignadas.');
            $token = bin2hex(random_bytes(32));
            Record::table('api_sessions')->create([
                'user_id' => $user->id,
                'workspace_id' => $workspaces[0]['id'],
                'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addDays(7),
            ]);

            return ['token' => $token, 'user' => $user->only('id', 'name', 'email'), 'workspace' => $workspaces[0], 'workspaces' => $workspaces];
        });
    }
}
