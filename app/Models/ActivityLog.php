<?php

namespace Pterodactyl\Models;

use Carbon\Carbon;
use Illuminate\Support\Facades\Event;
use Pterodactyl\Events\ActivityLogged;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Model as IlluminateModel;

/**
 * \Pterodactyl\Models\ActivityLog.
 *
 * @property int $id
 * @property string|null $batch
 * @property string $event
 * @property string $ip
 * @property string|null $description
 * @property string|null $actor_type
 * @property int|null $actor_id
 * @property int|null $api_key_id
 * @property \Illuminate\Support\Collection|null $properties
 * @property \Carbon\Carbon $timestamp
 * @property IlluminateModel|\Eloquent $actor
 * @property \Illuminate\Database\Eloquent\Collection|\Pterodactyl\Models\ActivityLogSubject[] $subjects
 * @property int|null $subjects_count
 * @property \Pterodactyl\Models\ApiKey|null $apiKey
 *
 * @method static Builder|ActivityLog forActor(\Illuminate\Database\Eloquent\Model $actor)
 * @method static Builder|ActivityLog forEvent(string $action)
 * @method static Builder|ActivityLog newModelQuery()
 * @method static Builder|ActivityLog newQuery()
 * @method static Builder|ActivityLog query()
 * @method static Builder|ActivityLog whereActorId($value)
 * @method static Builder|ActivityLog whereActorType($value)
 * @method static Builder|ActivityLog whereApiKeyId($value)
 * @method static Builder|ActivityLog whereBatch($value)
 * @method static Builder|ActivityLog whereDescription($value)
 * @method static Builder|ActivityLog whereEvent($value)
 * @method static Builder|ActivityLog whereId($value)
 * @method static Builder|ActivityLog whereIp($value)
 * @method static Builder|ActivityLog whereProperties($value)
 * @method static Builder|ActivityLog whereTimestamp($value)
 *
 * @mixin \Eloquent
 */
class ActivityLog extends Model
{
    use MassPrunable;

    public const RESOURCE_NAME = 'activity_log';

    /**
     * Tracks all the events we no longer wish to display to users. These are either legacy
     * events or just events where we never ended up using the associated data.
     */
    public const DISABLED_EVENTS = ['server:file.upload'];

    public $timestamps = false;

    protected $guarded = [
        'id',
        'timestamp',
    ];

    protected $casts = [
        'properties' => 'collection',
        'timestamp' => 'datetime',
    ];

    protected $with = ['subjects'];

    public static array $validationRules = [
        'event' => ['required', 'string'],
        'batch' => ['nullable', 'uuid'],
        'ip' => ['required', 'string'],
        'description' => ['nullable', 'string'],
        'properties' => ['array'],
    ];

    public function actor(): MorphTo
    {
        $morph = $this->morphTo();
        if (method_exists($morph, 'withTrashed')) {
            return $morph->withTrashed();
        }

        return $morph;
    }

    public function subjects(): HasMany
    {
        return $this->hasMany(ActivityLogSubject::class);
    }

    public function apiKey(): HasOne
    {
        return $this->hasOne(ApiKey::class, 'id', 'api_key_id');
    }

    public function scopeForEvent(Builder $builder, string $action): Builder
    {
        return $builder->where('event', $action);
    }

    /**
     * Determine if a console command is an automated background probe or telemetry command
     * that should not be recorded or displayed in user-facing activity logs.
     */
    public static function isIgnoredConsoleCommand(mixed $command): bool
    {
        if (empty($command) || !is_string($command)) {
            return false;
        }

        $cmd = strtolower(trim($command));
        $cmd = ltrim($cmd, '/');

        $ignoredExact = [
            'tps',
            'spark',
            'spark tps',
            'spark health',
            'spark ping',
            'spark tickmonitoring',
            'spark heapsummary',
            'paper tps',
            'spigot:tps',
            'minecraft:tps',
            'forge tps',
            'neoforge tps',
        ];

        if (in_array($cmd, $ignoredExact, true)) {
            return true;
        }

        if (
            str_starts_with($cmd, 'spark ') ||
            str_starts_with($cmd, 'spark:') ||
            (str_starts_with($cmd, 'paper ') && str_ends_with($cmd, 'tps'))
        ) {
            return true;
        }

        return false;
    }

    /**
     * Scope a query to exclude noisy automated telemetry console commands from the activity log.
     */
    public function scopeWithoutInternalCommands(Builder $builder): Builder
    {
        return $builder->where(function (Builder $query) {
            $query->where('activity_logs.event', '!=', 'server:console.command')
                ->orWhere(function (Builder $cmdQuery) {
                    $cmdQuery->where('activity_logs.event', 'server:console.command')
                        ->whereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(activity_logs.properties, '$.command')), '')))) NOT IN ('tps', '/tps', 'spark', '/spark', 'paper tps', 'spigot:tps', 'minecraft:tps', 'forge tps', 'neoforge tps')")
                        ->whereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(activity_logs.properties, '$.command')), '')))) NOT LIKE 'spark %'")
                        ->whereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(activity_logs.properties, '$.command')), '')))) NOT LIKE '/spark %'")
                        ->whereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(activity_logs.properties, '$.command')), '')))) NOT LIKE 'spark:%'")
                        ->whereRaw("LOWER(TRIM(BOTH '\"' FROM TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(activity_logs.properties, '$.command')), '')))) NOT LIKE '/spark:%'");
                });
        });
    }

    /**
     * Scopes a query to only return results where the actor is a given model.
     */
    public function scopeForActor(Builder $builder, IlluminateModel $actor): Builder
    {
        return $builder->whereMorphedTo('actor', $actor);
    }

    /**
     * Returns models to be pruned.
     *
     * @see https://laravel.com/docs/9.x/eloquent#pruning-models
     */
    public function prunable()
    {
        if (is_null(config('activity.prune_days'))) {
            throw new \LogicException('Cannot prune activity logs: no "prune_days" configuration value is set.');
        }

        return static::where('timestamp', '<=', Carbon::now()->subDays(config('activity.prune_days')));
    }

    /**
     * Boots the model event listeners. This will trigger an activity log event every
     * time a new model is inserted which can then be captured and worked with as needed.
     */
    protected static function boot()
    {
        parent::boot();

        static::created(function (self $model) {
            Event::dispatch(new ActivityLogged($model));
        });
    }
}
