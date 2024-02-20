import { query, update, text, Record, StableBTreeMap, Variant, Vec, None, Some, Ok, Err, ic, Principal, Opt, nat64, Duration, Result, bool, Canister } from "azle";
import {
    Ledger, binaryAddressFromAddress, binaryAddressFromPrincipal, hexAddressFromPrincipal
} from "azle/canisters/ledger";




const Message = Variant({
    NotFound: text,
    InvalidPayload: text,
    PaymentFailed: text,
    PaymentCompleted: text
});

//USER MODEL
const User = Record({
    name: text,
    number: nat64,
    wallet: Principal,  
});

const UserPayload = Record({
    name: text,
    number: nat64,
});

const Auth = Record({
    name: text,
    number: nat64,
    wallet: Principal,  
});

//BUSINESS MODEL
const Business = Record({
    name: text,
    till: nat64,
    wallet: Principal,  
});

const BusinessPaylod = Record({
    name: text,
    till: nat64,
});

//TXHISTORY MODEL
const Txh = Record({
    number: nat64,
    wallet: Principal,
    amount: nat64,  
    to: text
});



//USER DATABASE
//we map the users phonenumber to their details
const usersDatabase = StableBTreeMap(3, nat64, User);


//BUSINESS DATABASE
//we map the business till number to their businesses
const businessDatabase = StableBTreeMap(4, nat64, Business);

//TXHISTORY DATABASE
//we store the tx history of each user
const txHistoryDatabase = StableBTreeMap(5, nat64, Txh);

//AUTHENTICATED USERS DATABASE
const authDatabase = StableBTreeMap(6, Principal, Auth);

const ORDER_RESERVATION_PERIOD = 120n; // reservation period in seconds

/* 
    initialization of the Ledger canister. The principal text value is hardcoded because 
    we set it in the `dfx.json`
*/
const icpCanister = Ledger(Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"));

export default Canister({
 

    //FETCHES DETAILS ABOUT A PARTICULAR USER
    getUser: query([nat64], Result(User, Message), (number) => {
        const userOpt = usersDatabase.get(number);
        if ("None" in userOpt) {
            return Err({ NotFound: `User with Number=${number} not found` });
        }
        return Ok(userOpt.Some);
    }),

    //FETCH DETILS ABOUT A PARTICULAR BUSINESS
    getBusiness: query([nat64], Result(Business, Message), (till) => {
        const businessOpt = businessDatabase.get(till);
        if ("None" in businessOpt) {
            return Err({ NotFound: `Business with Till=${till} not found` });
        }
        return Ok(businessOpt.Some);
    }),

    //FETCH TX HISTORY FOR A PARTICULAR USER
    getHistory: query([nat64], Result(Txh, Message), (number) => {
        const historyOpt = txHistoryDatabase.get(number);
        if ("None" in historyOpt) {
            return Err({ NotFound: `History with number=${number} not found` });
        }
        return Ok(historyOpt.Some);
    }),

    //GET AUTH USER
    //we use this for authentication purposes,, where we check if their identity is registered within our platform
    getAuth: query([Principal], Result(Auth, Message), (princ) => {
        const authOpt = authDatabase.get(princ);
        if ("None" in authOpt) {
            return Err({ NotFound: `User with principal=${princ} not found` });
        }
        return Ok(authOpt.Some);
    }),


  
//REGISTER A NEW USER TO THE SYSTEM

    addUser: update([UserPayload], Result(User, Message), (payload) => {
        if (typeof payload !== "object" || Object.keys(payload).length === 0) {
            return Err({ NotFound: "invalid payoad" })
        }
        const user = { wallet: ic.caller(), ...payload };
        usersDatabase.insert(user.number, user);
        return Ok(user);
    }),
  

    addBusiness: update([BusinessPaylod], Result(Business, Message), (payload) => {
        if (typeof payload !== "object" || Object.keys(payload).length === 0) {
            return Err({ NotFound: "invalid payoad" })
        }
        const business = { wallet: ic.caller(), ...payload };
        businessDatabase.insert(business.till, business);
        return Ok(business);
    }),

    //CREATE TX HISTORY
    createTxHistory: update([Txh], Result(Txh, Message), (txhpayload) => {
        if (typeof txhpayload !== "object" || Object.keys(txhpayload).length === 0) {
            return Err({ NotFound: "invalid payoad" })
        }
        const history = { ...txhpayload };
        businessDatabase.insert(history.number, history);
        return Ok(history); 
    }),
 
 
 
   

  
    getAddressFromPrincipal: query([Principal], text, (principal) => {
        return hexAddressFromPrincipal(principal, 0);
    }), 

    makePayment: update([text, nat64], Result(Message, Message), async (to, amount) => {
        const toPrincipal = Principal.fromText(to);
        const toAddress = hexAddressFromPrincipal(toPrincipal, 0);
        const transferFeeResponse = await ic.call(icpCanister.transfer_fee, { args: [{}] });
        const transferResult = ic.call(icpCanister.transfer, {
            args: [{
                memo: 0n,
                amount: {
                    e8s: amount
                },
                fee: {
                    e8s: transferFeeResponse.transfer_fee.e8s
                },
                from_subaccount: None,
                to: binaryAddressFromAddress(toAddress),
                created_at_time: None
            }]
        });
        if ("Err" in transferResult) {
            return Err({ PaymentFailed: `payment failed, err=${transferResult.Err}` })
        }
        return Ok({ PaymentCompleted: "payment completed" });
    })
});





