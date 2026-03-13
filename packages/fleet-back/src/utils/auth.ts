const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function generateSecureRandomString(length = 24): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);

	let result = "";
	for (const byte of bytes) {
		result += ALPHABET[byte % ALPHABET.length];
	}
	return result;
}

export function generateSessionToken(): {
	id: string;
	secret: string;
	token: string;
} {
	const id = generateSecureRandomString();
	const secret = generateSecureRandomString();
	const token = `${id}.${secret}`;
	return { id, secret, token };
}

export async function hashSecret(secret: string): Promise<string> {
	const secretBytes = new TextEncoder().encode(secret);
	const hashBuffer = await crypto.subtle.digest("SHA-256", secretBytes);
	const hashArray = new Uint8Array(hashBuffer);
	return Array.from(hashArray)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}
