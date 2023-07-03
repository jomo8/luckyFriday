const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const eraNum = 1111;
const validatorId = '14hM4oLJCK6wtS7gNfwTDhthRjy5QJ1t3NAcoPjEepo9AH67'
const stakeId = '15Q33K9DZQgDLJXEpgdrdHkJWKyPXqXgaEaqYMtq8FMP79X3'


async function main() 
{
    const provider = new WsProvider('wss://rpc.polkadot.io');
    const api = await ApiPromise.create({ provider });

    // Calculating the amount of DOT earned for the corresponding validator.
    const totalPlank = await api.query.staking.erasValidatorReward(eraNum);
    let totalDot = Math.round(totalPlank / 10000000); // Divide by 10 million.
    const valiEraPts = await api.query.staking.erasRewardPoints(eraNum);
    let valiReward = -1;
    let addressFound = false;

    // Calculate the total DOT reward per the given validator.
    for (const [id, points] of valiEraPts.individual.entries()) {
        if (id.toString() === validatorId) {
            valiReward = (points.toNumber() / valiEraPts.total) * totalDot;
            addressFound = true;
        } 
    }

    // Print an error and exit program if validator is not found.
    if (addressFound == false) { 
        console.log('ERR: VALIDATOR NOT FOUND');
        await api.disconnect();
        return;
    }  
    

    // Initialize variables to retrieve staker information.
    const keyring = new Keyring({ type: 'sr25519' });
    const account = keyring.addFromAddress(validatorId);

    // API calls.
    const newAcc = api.createType('AccountId32', account.publicKey);
    const validatorPref = await api.query.staking.erasValidatorPrefs(eraNum, newAcc);
    const eraStakers = await api.query.staking.erasStakers.entries(eraNum);
    
    addressFound = false;
    const commissionRate = (validatorPref.commission / 1000000000);
    const commission = commissionRate * valiReward;
    let nominatorCut, nominatorProp = -1;


    // Calculate the given staker rewards.
    eraStakers.forEach(([key, exposure]) => {
        // key.args is [EraIndex, AccountId]
        const [, accountId] = key.args.map((k) => k.toHuman());
        if (accountId === validatorId) {
            for (let i = 0; i < exposure.others.length; i++) {
                let currStaker = exposure.others[i];
                if (currStaker.who.toHuman() == stakeId) {
                    nominatorProp = (currStaker.value.toNumber() / exposure.total);
                }
            }
            addressFound = true;
        }
    });

    // Print an error and exit program if staker is not found.
    if (addressFound == false) { 
        console.log('ERR: STAKER NOT FOUND');
        await api.disconnect();
        return;
    }  

    nominatorCut = nominatorProp * (valiReward * (1 - commissionRate));

    let LFreward = nominatorCut + (nominatorProp * commission);
    LFreward *= commissionRate;
    
    console.log(`nominator reward: ${nominatorCut}`);
    console.log(`LF reward: `, LFreward);
    
    await api.disconnect();
}

main().catch(console.error);