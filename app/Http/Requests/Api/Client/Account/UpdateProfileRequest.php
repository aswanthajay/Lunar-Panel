<?php

namespace Pterodactyl\Http\Requests\Api\Client\Account;

use Pterodactyl\Models\User;
use Illuminate\Container\Container;
use Illuminate\Contracts\Hashing\Hasher;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Exceptions\Http\Base\InvalidPasswordProvidedException;

class UpdateProfileRequest extends ClientApiRequest
{
    /**
     * @throws \Pterodactyl\Exceptions\Http\Base\InvalidPasswordProvidedException
     */
    public function authorize(): bool
    {
        if (!parent::authorize()) {
            return false;
        }

        $hasher = Container::getInstance()->make(Hasher::class);

        // Verify password matches when changing profile details.
        if (!$hasher->check($this->input('password'), $this->user()->password)) {
            throw new InvalidPasswordProvidedException(trans('validation.internal.invalid_password'));
        }

        return true;
    }

    public function rules(): array
    {
        $rules = User::getRulesForUpdate($this->user());

        return [
            'username' => $rules['username'],
            'name_first' => $rules['name_first'],
            'name_last' => $rules['name_last'],
            'password' => 'required|string',
        ];
    }
}
