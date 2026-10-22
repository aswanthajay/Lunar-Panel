<?php

namespace Pterodactyl\Http\Requests\Auth;

use Illuminate\Validation\Rule;
use Illuminate\Foundation\Http\FormRequest;

class LoginCheckpointRequest extends FormRequest
{
    /**
     * Determine if the request is authorized.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Rules to apply to the request.
     */
    public function rules(): array
    {
        return [
            'confirmation_token' => 'required|string|size:64',
            'authentication_code' => [
                'nullable',
                'string',
                'max:16',
                Rule::requiredIf(function () {
                    return empty($this->input('recovery_token'));
                }),
            ],
            'recovery_token' => [
                'nullable',
                'string',
                'max:191',
                Rule::requiredIf(function () {
                    return empty($this->input('authentication_code'));
                }),
            ],
        ];
    }
}
