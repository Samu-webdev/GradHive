<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'in:student,school,company,mentor,organization'],
            'country' => ['required', 'string', 'max:80'],
            'institution' => ['required_unless:role,mentor', 'nullable', 'string', 'max:150'],
            'field_of_study' => ['required_if:role,student', 'nullable', 'string', 'max:120'],
            'level' => ['required_if:role,student', 'nullable', 'in:licence,master,doctorat'],
        ], [
            'name.required' => 'Le nom est obligatoire.',
            'email.required' => 'Adresse e-mail invalide.', 'email.email' => 'Adresse e-mail invalide.',
            'email.unique' => 'Cette adresse e-mail est déjà utilisée.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
            'role.in' => 'Rôle invalide.',
            'country.required' => 'Le pays est obligatoire.',
            'institution.required_unless' => 'Ce champ est obligatoire pour ce rôle.',
            'field_of_study.required_if' => 'La filière est obligatoire.',
            'level.required_if' => 'Niveau invalide.', 'level.in' => 'Niveau invalide.',
        ]);

        $user = User::create([...$data, 'email' => strtolower($data['email']), 'status' => 'active']);

        return response()->json([
            'message' => 'Compte créé.', 'user' => $user->toPublic(),
        ] + $this->issueToken($user), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required']]);
        $user = User::where('email', strtolower($credentials['email']))->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => ['Identifiants incorrects.']]);
        }
        if ($user->status === 'suspended') {
            return response()->json(['message' => 'Votre compte est suspendu.'], 403);
        }
        return response()->json(['user' => $user->toPublic()] + $this->issueToken($user));
    }

    /** Jeton d'accès à durée de vie limitée (TOKEN_TTL_MINUTES) : un jeton volé finit par expirer. */
    private function issueToken(User $user): array
    {
        $expires = now()->addMinutes(config('gradhive.token_ttl_minutes'));
        return [
            'token' => $user->createToken('gradhive', ['*'], $expires)->plainTextToken,
            'expires_at' => $expires->toIso8601String(),
        ];
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Déconnecté.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->toPublic()]);
    }
}
