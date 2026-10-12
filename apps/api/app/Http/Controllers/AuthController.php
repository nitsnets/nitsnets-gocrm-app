<?php

namespace App\Http\Controllers;

use App\Models\Record;
use App\Models\User;
use App\Services\SessionIssuer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $r): JsonResponse
    {
        $v = $this->validateInput($r, ['email' => 'required|email', 'password' => 'required|string|max:1024']);
        $u = User::where('email', strtolower($v['email']))->first();
        abort_unless($u && Hash::check($v['password'], $u->password), 401, 'Credenciales incorrectas.');

        return response()->json(['data' => app(SessionIssuer::class)->issue($u)]);
    }

    public function me(Request $r): JsonResponse
    {
        $ws = $this->workspaces($r->user()->id);

        return response()->json(['data' => ['user' => $r->user()->only('id', 'name', 'email'), 'workspace' => collect($ws)->firstWhere('id', $r->attributes->get('api_session')->workspace_id), 'workspaces' => $ws]]);
    }

    public function switchWorkspace(Request $r): JsonResponse
    {
        $v = $this->validateInput($r, ['workspace_id' => 'required|uuid']);
        $ws = $this->workspaces($r->user()->id);
        $active = collect($ws)->firstWhere('id', $v['workspace_id']);
        abort_unless($active, 403, 'No perteneces a esa empresa.');
        $r->attributes->get('api_session')->update(['workspace_id' => $active['id']]);

        return response()->json(['data' => ['workspace' => $active, 'workspaces' => $ws]]);
    }

    public function logout(Request $r): Response
    {
        $r->attributes->get('api_session')->delete();

        return response()->noContent();
    }

    private function workspaces(string $user): array
    {
        return Record::table('workspaces')->whereIn('id', Record::table('memberships')->select('workspace_id')->where('user_id', $user))->orderBy('created_at')->get(['id', 'name'])->toArray();
    }
}
