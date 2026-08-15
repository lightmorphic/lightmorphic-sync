# Security

`sync-api` stores only: an `accountId` derived from the user's passphrase
(SHA-256, not the passphrase itself), a salted `scrypt` hash of `authKey`
(itself derived from the passphrase, independent of the data-encryption
key), and AES-GCM encrypted blobs. A full database leak does not expose
passphrases, encryption keys, or plaintext data. There is no server-side
password recovery.

`webstore-proxy` forwards extension install/update traffic to Google's
Chrome Web Store endpoints. It does not inspect or store the content of
that traffic beyond normal reverse-proxy logging.

To report a vulnerability, contact github@lightmorphic.co.uk.
