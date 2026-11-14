<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OpportunityApplicationStatusHistory extends Model
{
    protected $table = 'opportunity_application_status_history';

    protected $fillable = ['application_id', 'actor_id', 'from_status', 'to_status'];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
