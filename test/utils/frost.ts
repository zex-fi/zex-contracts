import { secp256k1_tr as frost } from "frost-lib";

export function frostDkg(max: number, threshold: number) {
    const participants = Array.from({ length: max }, (v, i) => frost.numToId(i + 1));

    //============================================================================
    // Key generation, Round 1
    //============================================================================

    // Keep track of each participant's round 1 secret package.
    // In practice, each participant will keep its copy; no one
    // will have all the participant's packages.
    const round1SecretPackages = {};

    // Keep track of all round1 packages sent to the given participant.
    // This is used to simulate the broadcast; in practice, the packages
    // will be sent through some communication channel.
    const receivedRound1Packages = {};

    // For each participant, perform the first part of the DKG protocol.
    // In practice, each participant will perform this on their own environments.
    for (let participantIdentifier of participants) {
        let { secret_package, package: pkg } = frost.dkgPart1(
            participantIdentifier,
            max,
            threshold
        )

        // Store the participant's secret package for later use.
        // In practice, each participant will store it in their own environment.
        round1SecretPackages[participantIdentifier] = secret_package;

        // "Send" the round 1 package to all other participants. In this
        // test this is simulated using a BTreeMap; in practice this will be
        // sent through some communication channel.
        for (let receiverParticipantIdentifier of participants) {
            if (receiverParticipantIdentifier == participantIdentifier) {
                continue;
            }
            if (!receivedRound1Packages[receiverParticipantIdentifier])
                receivedRound1Packages[receiverParticipantIdentifier] = {};
            receivedRound1Packages[receiverParticipantIdentifier][participantIdentifier] = pkg;
        }
    }

    //============================================================================
    // Key generation, Round 2
    //============================================================================

    // Keep track of each participant's round 2 secret package.
    // In practice each participant will keep its copy; no one
    // will have all the participant's packages.
    const round2SecretPackages = {};

    // Keep track of all round 2 packages sent to the given participant.
    // This is used to simulate the broadcast; in practice, the packages
    // will be sent through some communication channel.
    const receivedRound2Packages = {};

    // For each participant, perform the second part of the DKG protocol.
    // In practice, each participant will perform this on their own environments.
    for (let participantIdentifier of participants) {
        let round1SecretPackage = round1SecretPackages[participantIdentifier]
        let round1Packages = receivedRound1Packages[participantIdentifier];

        let { secret_package, packages } = frost.dkgPart2(round1SecretPackage, round1Packages);

        // Store the participant's secret package for later use.
        // In practice, each participant will store it in their own environment.
        round2SecretPackages[participantIdentifier] = secret_package;

        // "Send" the round 2 package to all other participants. In this
        //  test, this is simulated using a BTreeMap; in practice, this will be
        // sent through some communication channel.
        // Note that, in contrast to the previous part, here each other participant
        // gets its own specific package.
        for (let [receiverIdentifier, round2Package] of Object.entries(packages)) {
            if (!receivedRound2Packages[receiverIdentifier])
                receivedRound2Packages[receiverIdentifier] = {}
            receivedRound2Packages[receiverIdentifier][participantIdentifier] = round2Package;
        }
    }

    //============================================================================
    // Key generation, final computation
    //============================================================================

    // Keep track of each participant's long-lived key package.
    // In practice, each participant will keep its copy; no one
    // will have all the participant's packages.
    let keyPackages = {};
    let pubkeyPackage = null;

    // For each participant, perform the third part of the DKG protocol.
    // In practice, each participant will perform this in their own environments.
    for (let participantIdentifier of participants) {
        let round2SecretPackage = round2SecretPackages[participantIdentifier];
        let round1Packages = receivedRound1Packages[participantIdentifier];
        let round2Packages = receivedRound2Packages[participantIdentifier];

        let { key_package, pubkey_package } = frost.dkgPart3(
            round2SecretPackage,
            round1Packages,
            round2Packages,
        );

        keyPackages[participantIdentifier] = key_package;
        if (!pubkeyPackage)
            pubkeyPackage = pubkey_package;
    }

    return { max, threshold, participants, keyPackages, pubkeyPackage };

    // With its own key package and the pubkey package, each participant can now proceed
    // to sign with FROST.
}

export function frostSign(message: Buffer, dKey: any) {
    const participants = dKey.participants.slice(0, dKey.threshold);
    let noncesMap = {};
    let commitmentsMap = {};

    //==========================================================================
    // Round 1: generating nonces and signing commitments for each participant
    //==========================================================================

    // In practice, each iteration of this loop will be executed by its respective participant.
    for (let participantIdentifier of participants) {
        let keyPackage = dKey.keyPackages[participantIdentifier];
        // Generate one (1) nonce and one SigningCommitments instance for each
        // participant, up to _threshold_.

        let { nonces, commitments } = frost.round1Commit(keyPackage.signing_share);

        // In practice, the nonces must be kept by the participant to use in the
        // next round, while the commitment must be sent to the coordinator
        // (or to every other participant if there is no coordinator) using
        // an authenticated channel.
        noncesMap[participantIdentifier] = nonces;
        commitmentsMap[participantIdentifier] = commitments;
    }

    // This is what the signature aggregator / coordinator needs to do:
    // - decide what message to sign
    // - take one (unused) commitment per signing participant
    let signatureShares = {};
    let signingPackage = frost.signingPackageNew(commitmentsMap, message);

    //==========================================================================
    // Round 2: each participant generates their signature share
    //==========================================================================

    // In practice, each iteration of this loop will be executed by its respective participant.
    for (let participantIdentifier of Object.keys(noncesMap)) {
        let keyPackage = dKey.keyPackages[participantIdentifier];

        let nonces = noncesMap[participantIdentifier];

        // Each participant generates their signature share.
        let signatureShare = frost.round2Sign(signingPackage, nonces, keyPackage);

        // In practice, the signature share must be sent to the Coordinator
        // using an authenticated channel.
        signatureShares[participantIdentifier] = signatureShare;
    }

    //==========================================================================
    // Aggregation: collects the signing shares from all participants,
    // generates the final signature.
    //==========================================================================

    // Aggregate (also verifies the signature shares)
    return frost.aggregate(signingPackage, signatureShares, dKey.pubkeyPackage);
}

export function frostVerify(signature: any, message: Buffer, pubkeyPackage: any) {
    return frost.verifyGroupSignature(signature, message, pubkeyPackage);
}

/**
 * Sample:
 * let message = Buffer.from("message to sign", 'utf-8').toString('hex');
 * let dKey = frostDkg(3, 2);
 * let signature = frostSign(message, dKey)
 * let verified = frostVerify(msg, dKey.pubkeyPackage)
 */

