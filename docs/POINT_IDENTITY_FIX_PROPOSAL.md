# Native point-identity correction

## Observed behavior

The unchanged daemon rejected valid historical transaction blobs at two sync
boundaries. Fresh native replay accepts the same bytes; an initial verifier
failure is then cached and prevents subsequent downloads from making progress.
The second boundary reports Bulletproof verification step 2. A 30,000-check fresh
replay has not reproduced that runtime failure, so its direct attribution is
still under investigation.

A deterministic native probe nevertheless demonstrates a correctness defect in
`ge_p3_is_point_at_infinity`: it compares raw ten-limb field representations.
Native encoding maps multiple bounded representations of the identity to the
same `01...00` bytes, while that predicate rejects them. For example, zero can
be represented with limb 0 = 2^26 and limb 1 = -1, or as the field modulus.
Equal Y/Z field values can likewise have different limb arrays. These cases
are mathematically identical points, not altered proofs or relaxed tolerances.

## Proposed correction and boundaries

Use the existing native `fe_isnonzero` and `fe_sub` helpers to check X = T = 0
and Y = Z modulo 2^255 - 19, with nonzero Z for valid projective coordinates.
Do not multiply by a cofactor to define identity, accept torsion points, skip
verification, change proof equations, discard bad-semantics caching or insert
retry acceptance. Keep the same core pin and native C/C++ implementation.

Affected files are a separate narrowly scoped core patch, guarded build-helper
migration, native regression fixtures and build/validation documentation.
The predicate is used by Bulletproof final equations and Pippenger bucket
handling. Canonical field checks add bounded work to those paths; sustained
throughput/latency on a complete chain has not been benchmarked. The SDK patch
is required for both daemon and explorer archives; operators must
rebuild and restart their native processes using the existing database. The
correction is an implementation fix to field equivalence, not a new protocol,
cryptographic primitive, frontend crypto implementation or storage architecture.

## Review and validation

Run the equivalent-coordinate test against the old SDK and observe failure,
then require it to pass with the correction. Include canonical identity,
rescaling, carried/modulus-zero X/T and equivalent Y/Z representations. Reject
nonidentity/base points, order-two torsion, nonzero X/T and zero projective
coordinates. Verify public blobs from both sync boundaries and mutated-proof
rejection, run native integration/HTTP/schema tests and fresh stress checks.
Resume the existing daemon only after these checks and observe real progress.
Do not describe the runtime recurrence as permanently resolved merely because
a restart or an isolated test succeeds; record subsequent daemon evidence and
any remaining limitations.
