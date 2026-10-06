<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'login' => ['nullable', 'string'],
            'email' => ['nullable', 'string'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $rawInput = trim((string) ($this->input('login') ?? $this->input('email')));
        $password = (string) $this->input('password');

        if (empty($rawInput)) {
            throw ValidationException::withMessages([
                'email' => 'Please enter your email, Employee ID, or username.',
            ]);
        }

        // Clean numeric candidate (e.g. EMP1001 or EMP-1001 -> 1001)
        $empNoCandidate = preg_replace('/^EMP-?/i', '', $rawInput);

        $user = User::where(function ($query) use ($rawInput, $empNoCandidate): void {
            $query->where('email', $rawInput)
                ->orWhere('username', $rawInput)
                ->orWhere('phone', $rawInput);

            if (! empty($empNoCandidate)) {
                $query->orWhereHas('employee', function ($empQuery) use ($empNoCandidate, $rawInput): void {
                    $empQuery->where('emp_no', $empNoCandidate)
                        ->orWhere('emp_no', $rawInput)
                        ->orWhere('phone', $rawInput);
                });
            }
        })->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            RateLimiter::hit($this->throttleKey());

            $errorField = $this->has('login') ? 'login' : 'email';
            throw ValidationException::withMessages([
                $errorField => trans('auth.failed'),
            ]);
        }

        Auth::login($user, $this->boolean('remember'));
        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());
        $errorField = $this->has('login') ? 'login' : 'email';

        throw ValidationException::withMessages([
            $errorField => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        $rawInput = trim((string) ($this->input('login') ?? $this->input('email')));

        return Str::transliterate(Str::lower($rawInput).'|'.$this->ip());
    }
}
