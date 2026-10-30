<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

    protected $fillable = [
        'user_id',
        'name',
        'email',
        'phone',
        'avatar_url',
        'password',
    ];

    /** The API (and the app) call the key `id`; the column is `user_id`. */
    protected $primaryKey = 'user_id';

    protected $appends = ['id'];

    public function getIdAttribute(): ?string
    {
        return $this->attributes['user_id'] ?? null;
    }

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function businesses()
    {
        return $this->belongsToMany(Business::class, 'business_users')
            ->withPivot('business_user_id', 'role');
    }
}
