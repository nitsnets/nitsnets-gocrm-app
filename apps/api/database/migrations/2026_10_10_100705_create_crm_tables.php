<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->timestamps();
        });
        Schema::create('memberships', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->string('role')->default('member');
            $t->unique(['workspace_id', 'user_id']);
            $t->timestamps();
        });
        Schema::create('api_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
            $t->string('token_hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamps();
        });
        Schema::create('companies', function (Blueprint $t) {
            $this->base($t);
            $t->string('name');
            $t->string('domain')->nullable();
            $t->string('industry')->nullable();
            $t->string('status')->default('prospect');
            $t->text('website')->nullable();
            $t->text('notes')->nullable();
        });
        Schema::create('contacts', function (Blueprint $t) {
            $this->base($t);
            $t->string('first_name');
            $t->string('last_name')->default('');
            $t->string('email')->nullable();
            $t->string('phone')->nullable();
            $t->string('job_title')->nullable();
            $t->text('linkedin_url')->nullable();
            $t->text('avatar_url')->nullable();
            $t->text('notes')->nullable();
            $t->index(['workspace_id', 'email']);
        });
        Schema::create('affiliations', function (Blueprint $t) {
            $this->base($t);
            $t->foreignUuid('contact_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $t->string('role')->nullable();
            $t->date('started_on')->nullable();
            $t->date('ended_on')->nullable();
        });
        Schema::create('opportunities', function (Blueprint $t) {
            $this->base($t);
            $t->string('title');
            $this->links($t);
            $t->string('stage')->default('new');
            $t->bigInteger('value_minor')->default(0);
            $t->string('currency', 3)->default('EUR');
            $t->date('expected_close_on')->nullable();
        });
        Schema::create('tasks', function (Blueprint $t) {
            $this->base($t);
            $t->string('title');
            $this->links($t);
            $t->foreignUuid('author_id')->references('id')->on('users');
            $t->timestamp('due_at')->nullable();
            $t->string('status')->default('pending');
        });
        Schema::create('notes', function (Blueprint $t) {
            $this->base($t);
            $t->text('body');
            $this->links($t);
            $t->foreignUuid('author_id')->references('id')->on('users');
            $t->string('visibility')->default('private');
            $t->uuid('client_request_id')->nullable();
            $t->string('request_hash', 64)->nullable();
            $t->unique(['workspace_id', 'author_id', 'client_request_id']);
        });
        Schema::create('events', function (Blueprint $t) {
            $this->base($t);
            $t->string('name');
            $t->string('location')->nullable();
            $t->timestamp('starts_at');
            $t->text('notes')->nullable();
            $t->json('contact_ids');
        });
        Schema::create('quotes', function (Blueprint $t) {
            $this->base($t);
            $t->string('title');
            $t->foreignUuid('company_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignUuid('opportunity_id')->nullable()->constrained()->nullOnDelete();
            $t->string('status')->default('draft');
            $t->string('currency', 3)->default('EUR');
            $t->json('items');
            $t->bigInteger('total_minor')->default(0);
            $t->unsignedInteger('version')->default(1);
            $t->text('notes')->nullable();
        });
        Schema::create('quote_versions', function (Blueprint $t) {
            $this->base($t);
            $t->foreignUuid('quote_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('version');
            $t->json('snapshot');
            $t->unique(['quote_id', 'version']);
        });
        Schema::create('messages', function (Blueprint $t) {
            $this->base($t);
            $t->string('external_key', 64)->nullable();
            $t->text('subject');
            $t->string('from_email');
            $t->string('from_name')->nullable();
            $t->json('to');
            $t->json('cc');
            $t->timestamp('received_at');
            $t->longText('body_text');
            $this->links($t);
            $t->unique(['workspace_id', 'external_key']);
        });
        Schema::create('message_participants', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('message_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->timestamps();
            $t->unique(['message_id', 'user_id']);
            $t->boolean('is_hidden')->default(false);
        });
        Schema::create('message_grants', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('message_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('granted_by')->references('id')->on('users');
            $t->timestamps();
            $t->unique(['message_id', 'user_id']);
        });
        Schema::create('audit_logs', function (Blueprint $t) {
            $this->base($t);
            $t->foreignUuid('actor_id')->references('id')->on('users');
            $t->string('action');
            $t->uuid('subject_id');
            $t->json('metadata');
        });
        Schema::create('gmail_connections', function (Blueprint $t) {
            $this->base($t);
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->string('email');
            $t->text('access_token');
            $t->text('refresh_token');
            $t->timestamp('expires_at');
            $t->string('history_id')->nullable();
            $t->timestamp('last_synced_at')->nullable();
            $t->string('status')->default('connected');
            $t->unique(['workspace_id', 'user_id']);
        });
        Schema::create('oauth_states', function (Blueprint $t) {
            $this->base($t);
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->string('state_hash', 64)->unique();
            $t->text('code_verifier');
            $t->timestamp('expires_at');
        });
    }

    private function base(Blueprint $t): void
    {
        $t->uuid('id')->primary();
        $t->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
        $t->timestamps();
    }

    private function links(Blueprint $t): void
    {
        $t->foreignUuid('contact_id')->nullable()->constrained()->nullOnDelete();
        $t->foreignUuid('company_id')->nullable()->constrained()->nullOnDelete();
    }

    public function down(): void
    {
        foreach (['oauth_states', 'gmail_connections', 'audit_logs', 'message_grants', 'message_participants', 'messages', 'quote_versions', 'quotes', 'events', 'notes', 'tasks', 'opportunities', 'affiliations', 'contacts', 'companies', 'api_sessions', 'memberships', 'workspaces'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
