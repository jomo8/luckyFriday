"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var api_1 = require("@polkadot/api");
var keyring_1 = require("@polkadot/keyring");
var eraNum = 1111;
var validatorId = '14hM4oLJCK6wtS7gNfwTDhthRjy5QJ1t3NAcoPjEepo9AH67';
var stakeId = '15Q33K9DZQgDLJXEpgdrdHkJWKyPXqXgaEaqYMtq8FMP79X3';
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var provider, api, totalPlank, totalDot, valiEraPts, valiReward, addressFound, _i, _a, _b, id, points, keyring, account, newAcc, validatorPref, eraStakers, commissionRate, commission, nominatorCut, nominatorProp, LFreward;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    provider = new api_1.WsProvider('wss://rpc.polkadot.io');
                    return [4 /*yield*/, api_1.ApiPromise.create({ provider: provider })];
                case 1:
                    api = _c.sent();
                    return [4 /*yield*/, api.query.staking.erasValidatorReward(eraNum)];
                case 2:
                    totalPlank = _c.sent();
                    totalDot = Math.round(totalPlank / 10000000);
                    return [4 /*yield*/, api.query.staking.erasRewardPoints(eraNum)];
                case 3:
                    valiEraPts = _c.sent();
                    valiReward = -1;
                    addressFound = false;
                    for (_i = 0, _a = valiEraPts.individual.entries(); _i < _a.length; _i++) {
                        _b = _a[_i], id = _b[0], points = _b[1];
                        if (id.toString() === validatorId) {
                            valiReward = (points.toNumber() / valiEraPts.total) * totalDot;
                            addressFound = true;
                        }
                    }
                    if (!(addressFound == false)) return [3 /*break*/, 5];
                    console.log('ERR: VALIDATOR NOT FOUND');
                    return [4 /*yield*/, api.disconnect()];
                case 4:
                    _c.sent();
                    return [2 /*return*/];
                case 5:
                    keyring = new keyring_1.Keyring({ type: 'sr25519' });
                    account = keyring.addFromAddress(validatorId);
                    newAcc = api.createType('AccountId32', account.publicKey);
                    return [4 /*yield*/, api.query.staking.erasValidatorPrefs(eraNum, newAcc)];
                case 6:
                    validatorPref = _c.sent();
                    return [4 /*yield*/, api.query.staking.erasStakers.entries(eraNum)];
                case 7:
                    eraStakers = _c.sent();
                    addressFound = false;
                    commissionRate = (validatorPref.commission / 1000000000);
                    commission = commissionRate * valiReward;
                    nominatorProp = -1;
                    eraStakers.forEach(function (_a) {
                        var key = _a[0], exposure = _a[1];
                        var _b = key.args.map(function (k) { return k.toHuman(); }), accountId = _b[1];
                        if (accountId === validatorId) {
                            for (var i = 0; i < exposure.others.length; i++) {
                                var currStaker = exposure.others[i];
                                if (currStaker.who.toHuman() == stakeId) {
                                    nominatorProp = (currStaker.value.toNumber() / exposure.total);
                                }
                            }
                            addressFound = true;
                        }
                    });
                    if (!(addressFound == false)) return [3 /*break*/, 9];
                    console.log('ERR: STAKER NOT FOUND');
                    return [4 /*yield*/, api.disconnect()];
                case 8:
                    _c.sent();
                    return [2 /*return*/];
                case 9:
                    nominatorCut = nominatorProp * (valiReward * (1 - commissionRate));
                    LFreward = nominatorCut + (nominatorProp * commission);
                    LFreward *= commissionRate;
                    console.log("nominator reward: ".concat(nominatorCut));
                    console.log("LF reward: ", LFreward);
                    return [4 /*yield*/, api.disconnect()];
                case 10:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
