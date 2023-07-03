import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

const eraNum: any = 1111;
const validatorId: any = '14hM4oLJCK6wtS7gNfwTDhthRjy5QJ1t3NAcoPjEepo9AH67'
const stakeId: any = '15Q33K9DZQgDLJXEpgdrdHkJWKyPXqXgaEaqYMtq8FMP79X3'

async function main() 
{
    const provider: WsProvider = new WsProvider('wss://rpc.polkadot.io');
    const api: ApiPromise = await ApiPromise.create({ provider });

    const totalPlank: any = await api.query.staking.erasValidatorReward(eraNum);
    let totalDot: number = Math.round(totalPlank / 10000000); 
    const valiEraPts: any = await api.query.staking.erasRewardPoints(eraNum);
    let valiReward: number = -1;
    let addressFound: boolean = false;

    for (const [id, points] of valiEraPts.individual.entries()) {
        if (id.toString() === validatorId) {
            valiReward = (points.toNumber() / valiEraPts.total) * totalDot;
            addressFound = true;
        } 
    }

    if (addressFound == false) { 
        console.log('ERR: VALIDATOR NOT FOUND');
        await api.disconnect();
        return;
    }  

    const keyring: Keyring = new Keyring({ type: 'sr25519' });
    const account: any = keyring.addFromAddress(validatorId);

    const newAcc: any = api.createType('AccountId32', account.publicKey);
    const validatorPref: any = await api.query.staking.erasValidatorPrefs(eraNum, newAcc);
    const eraStakers: any = await api.query.staking.erasStakers.entries(eraNum);
    
    addressFound = false;
    const commissionRate: number = (validatorPref.commission / 1000000000);
    const commission: number = commissionRate * valiReward;
    let nominatorCut: number, nominatorProp: number = -1;

    eraStakers.forEach(([key, exposure]: any[]) => {
        const [, accountId]: any[] = key.args.map((k: any) => k.toHuman());
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

    if (addressFound == false) { 
        console.log('ERR: STAKER NOT FOUND');
        await api.disconnect();
        return;
    }  

    nominatorCut = nominatorProp * (valiReward * (1 - commissionRate));

    let LFreward: number = nominatorCut + (nominatorProp * commission);
    LFreward *= commissionRate;
    
    console.log(`nominator reward: ${nominatorCut}`);
    console.log(`LF reward: `, LFreward);
    
    await api.disconnect();
}

main().catch(console.error);
