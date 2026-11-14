<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class University extends Model
{
    protected $fillable = ['name', 'country', 'city', 'website', 'description', 'is_demo'];
    protected $casts = ['is_demo' => 'boolean'];

    public function positions(): HasMany { return $this->hasMany(Position::class); }
}
