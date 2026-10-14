import http from '@/api/http';

export interface PasskeyItem {
    id: number;
    name: string;
    credential_id: string;
    aaguid?: string | null;
    last_used_at?: string | null;
    created_at: string;
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Check if the current browser environment supports WebAuthn / Passkeys.
 */
export function isPasskeySupported(): boolean {
    return !!(
        typeof window !== 'undefined' &&
        window.isSecureContext &&
        window.PublicKeyCredential &&
        typeof navigator.credentials?.create === 'function' &&
        typeof navigator.credentials?.get === 'function'
    );
}

/**
 * Fetch all enrolled passkeys for the current authenticated user.
 */
export async function getPasskeys(): Promise<PasskeyItem[]> {
    const res = await http.get('/api/client/account/passkeys');
    return res.data?.data || [];
}

/**
 * Delete / revoke a passkey by its ID.
 */
export async function deletePasskey(id: number): Promise<void> {
    await http.delete(`/api/client/account/passkeys/${id}`);
}

/**
 * Initiate and execute passkey enrollment for the current user.
 */
export async function enrollPasskey(name: string = 'Security Key'): Promise<PasskeyItem> {
    if (!isPasskeySupported()) {
        throw new Error('WebAuthn / Passkeys are not supported on this browser or connection.');
    }

    // 1. Get registration options and challenge from backend
    const optionsRes = await http.post('/api/client/account/passkeys/register-options');
    const options = optionsRes.data;
    if (!options?.challenge) {
        throw new Error('Could not obtain registration challenge from server.');
    }

    const challengeBuf = base64UrlToBuffer(options.challenge);
    const userIdBuf = base64UrlToBuffer(options.user.id);

    // 2. Call browser navigator.credentials.create()
    const credential = (await navigator.credentials.create({
        publicKey: {
            challenge: challengeBuf,
            rp: {
                name: options.rp.name || 'Lunar Panel',
                id: options.rp.id || window.location.hostname,
            },
            user: {
                id: userIdBuf,
                name: options.user.name,
                displayName: options.user.displayName || options.user.name,
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' },   // ES256
                { alg: -257, type: 'public-key' }, // RS256
            ],
            timeout: 60000,
            attestation: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                requireResidentKey: false,
                userVerification: 'preferred',
            },
        },
    })) as any;

    if (!credential || !credential.response) {
        throw new Error('Passkey creation cancelled or failed.');
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    const clientDataJSON = bufferToBase64Url(response.clientDataJSON);
    const attestationObject = bufferToBase64Url(response.attestationObject);

    let spkiDer: string | undefined = undefined;
    if (typeof (response as any).getPublicKey === 'function') {
        const pkBuf = (response as any).getPublicKey();
        if (pkBuf) {
            spkiDer = bufferToBase64Url(pkBuf);
        }
    }

    let transports: string[] | undefined = undefined;
    if (typeof (response as any).getTransports === 'function') {
        transports = (response as any).getTransports();
    }

    // 3. Send back to server
    const storeRes = await http.post('/api/client/account/passkeys', {
        name: name.trim() || 'Security Key',
        clientDataJSON,
        attestationObject,
        spkiDer,
        transports,
    });

    return storeRes.data?.data;
}

/**
 * Authenticate login with passkey.
 */
export async function authenticateWithPasskey(userInput?: string): Promise<{
    complete: boolean;
    intended?: string;
    promptPasskey?: boolean;
}> {
    if (!isPasskeySupported()) {
        throw new Error('WebAuthn / Passkeys are not supported on this browser or connection.');
    }

    await http.get('/sanctum/csrf-cookie');

    // 1. Get challenge
    const challengeRes = await http.post('/auth/passkey/challenge', {
        user: userInput?.trim() || undefined,
    });

    const { challenge, rpId, allowCredentials } = challengeRes.data;
    if (!challenge) {
        throw new Error('Failed to obtain authentication challenge.');
    }

    const challengeBuf = base64UrlToBuffer(challenge);

    const creds = Array.isArray(allowCredentials) && allowCredentials.length > 0
        ? allowCredentials.map((c: any) => ({
            id: base64UrlToBuffer(c.id),
            type: 'public-key' as const,
            transports: c.transports || undefined,
        }))
        : undefined;

    // 2. Request assertion from authenticator
    const assertion = (await navigator.credentials.get({
        publicKey: {
            challenge: challengeBuf,
            rpId: rpId || window.location.hostname,
            allowCredentials: creds,
            timeout: 60000,
            userVerification: 'preferred',
        },
    })) as any;

    if (!assertion || !assertion.response) {
        throw new Error('Passkey authentication cancelled or timed out.');
    }

    const credentialId = bufferToBase64Url(assertion.rawId);
    const authResp = assertion.response as AuthenticatorAssertionResponse;
    const clientDataJSON = bufferToBase64Url(authResp.clientDataJSON);
    const authenticatorData = bufferToBase64Url(authResp.authenticatorData);
    const signature = bufferToBase64Url(authResp.signature);

    // 3. Post to backend
    const loginRes = await http.post('/auth/passkey/login', {
        credentialId,
        clientDataJSON,
        authenticatorData,
        signature,
    });

    return {
        complete: !!loginRes.data?.data?.complete,
        intended: loginRes.data?.data?.intended,
        promptPasskey: !!loginRes.data?.data?.prompt_passkey,
    };
}
