// Prints a fresh VAPID key pair for the Sunday question's Web Push (docs/PUSH.md).
// Usage: npm run vapid. Nothing is written or sent anywhere; set the three lines
// on the site yourself with netlify env:set, and fill in your own mailto address.
import { generateVAPIDKeys } from 'web-push';

const { publicKey, privateKey } = generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com');
