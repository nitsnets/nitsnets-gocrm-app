<?php

use App\Jobs\SyncGmail;
use App\Models\Record;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

Artisan::command('gmail:sync', function () {
    Record::table('gmail_connections')->where('status', '!=', 'reauthorization_required')->eachById(fn ($c) => SyncGmail::dispatch($c->id));
    $this->info('Gmail synchronization queued.');
});
Schedule::command('gmail:sync')->everyFiveMinutes()->withoutOverlapping();

Artisan::command('crm:provision {workspace} {email} {name} {--password-env=CRM_ADMIN_PASSWORD}', function () {
    $email = strtolower($this->argument('email'));
    $password = getenv($this->option('password-env')) ?: $this->secret('New password (at least 12 characters)');
    if (! filter_var($email, FILTER_VALIDATE_EMAIL) || ! is_string($password) || strlen($password) < 12) {
        $this->error('Valid email and password of at least 12 characters are required.');

        return 1;
    }
    $workspace = DB::transaction(function () use ($email, $password) {
        $workspace = Record::table('workspaces')->firstOrCreate(['name' => $this->argument('workspace')]);
        $user = User::firstOrCreate(['email' => $email], ['name' => $this->argument('name'), 'password' => Hash::make($password), 'email_verified_at' => now()]);
        Record::table('memberships')->firstOrCreate(['workspace_id' => $workspace->id, 'user_id' => $user->id], ['role' => 'admin']);

        return $workspace;
    });
    $this->info('Provisioned workspace '.$workspace->id.'. Existing users retain their password.');

    return 0;
})->purpose('Provision a trusted, operator-verified user and workspace without exposing credentials in arguments.');
