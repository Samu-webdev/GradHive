<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Connection;
use App\Models\User;
use App\Notifications\GradHiveNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConnectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $connections = Connection::with(['requester', 'recipient'])
            ->where(fn ($query) => $query->where('requester_id', $userId)->orWhere('recipient_id', $userId))
            ->get()
            ->filter(fn (Connection $connection) => ($connection->requester_id === $userId
                ? $connection->recipient : $connection->requester)?->status === 'active');

        return response()->json([
            'accepted' => $connections->where('status', 'accepted')->map(fn (Connection $connection) => [
                'id' => $connection->id,
                'user' => $this->memberCard($connection->requester_id === $userId ? $connection->recipient : $connection->requester),
            ])->values(),
            'incoming' => $connections->where('status', 'pending')->where('recipient_id', $userId)->map(fn (Connection $connection) => [
                'id' => $connection->id, 'user' => $this->memberCard($connection->requester),
                'created_at' => $connection->created_at?->toIso8601String(),
            ])->values(),
            'outgoing' => $connections->where('status', 'pending')->where('requester_id', $userId)->map(fn (Connection $connection) => [
                'id' => $connection->id, 'user' => $this->memberCard($connection->recipient),
                'created_at' => $connection->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_if($request->user()->role === 'admin', 403, 'Administrators cannot request member connections.');
        $data = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);
        $target = User::whereKey($data['user_id'])->where('status', 'active')->where('role', '!=', 'admin')->first();
        if (! $target || $target->id === $request->user()->id) {
            return response()->json(['message' => 'A valid other active member is required.'], 422);
        }

        $existing = Connection::where(fn ($query) => $query
            ->where('requester_id', $request->user()->id)->where('recipient_id', $target->id))
            ->orWhere(fn ($query) => $query
                ->where('requester_id', $target->id)->where('recipient_id', $request->user()->id))
            ->first();
        if ($existing && $existing->status !== 'declined') {
            return response()->json(['message' => 'A connection request or connection already exists.'], 409);
        }

        if ($existing) {
            $existing->update([
                'requester_id' => $request->user()->id,
                'recipient_id' => $target->id,
                'status' => 'pending',
            ]);
            $connection = $existing->fresh();
        } else {
            $connection = Connection::create([
                'requester_id' => $request->user()->id,
                'recipient_id' => $target->id,
                'status' => 'pending',
            ]);
        }
        $target->notify(new GradHiveNotification([
            'event' => 'connection_request_received',
            'connection_id' => $connection->id,
            'user_id' => $request->user()->id,
        ]));

        return response()->json(['data' => ['id' => $connection->id, 'status' => $connection->status]], 201);
    }

    public function accept(Request $request, int $id): JsonResponse
    {
        $connection = Connection::findOrFail($id);
        abort_unless($connection->recipient_id === $request->user()->id, 403, 'Only the recipient may accept this request.');
        abort_unless($connection->status === 'pending', 409, 'This connection request is no longer pending.');
        DB::transaction(fn () => $connection->update(['status' => 'accepted']));
        $connection->requester->notify(new GradHiveNotification([
            'event' => 'connection_request_accepted',
            'connection_id' => $connection->id,
            'user_id' => $request->user()->id,
        ]));

        return response()->json(['data' => ['id' => $connection->id, 'status' => $connection->status]]);
    }

    public function decline(Request $request, int $id): JsonResponse
    {
        $connection = Connection::findOrFail($id);
        abort_unless($connection->recipient_id === $request->user()->id, 403, 'Only the recipient may decline this request.');
        abort_unless($connection->status === 'pending', 409, 'This connection request is no longer pending.');
        $connection->update(['status' => 'declined']);
        $connection->requester->notify(new GradHiveNotification([
            'event' => 'connection_request_declined',
            'connection_id' => $connection->id,
            'user_id' => $request->user()->id,
        ]));

        return response()->json(['data' => ['id' => $connection->id, 'status' => $connection->status]]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $connection = Connection::findOrFail($id);
        $isRequester = $connection->requester_id === $request->user()->id;
        $isRecipient = $connection->recipient_id === $request->user()->id;
        abort_unless($isRequester || $isRecipient, 403, 'You are not part of this connection.');
        abort_unless($connection->status !== 'pending' || $isRequester, 403, 'Only the requester may cancel a pending request.');
        $connection->delete();

        return response()->json(['message' => 'Connection removed.']);
    }

    private function memberCard(User $member): array
    {
        $private = ($member->role === 'student' && $member->student_profile_visibility !== 'public')
            || (in_array($member->role, ['school', 'company', 'organization'], true)
                && $member->institution_profile_visibility !== 'public');

        return $private
            ? ['id' => $member->id, 'name' => $member->name, 'role' => $member->role]
            : $member->toCard();
    }
}
