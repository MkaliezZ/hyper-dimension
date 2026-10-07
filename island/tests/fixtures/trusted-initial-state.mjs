// Trusted server-only setup for historical tests that mutate progress directly.
// Public first-open routes always initialize the full authority book; V95 verifies that boundary.
import {serverZeroState} from '../../server/saveBootstrap.mjs';
export async function seedLegacyAuthority(tenants,token,theme){
 const c=await tenants.get(token),p=c.account.profile,s=serverZeroState(theme,{playerProfile:p});s.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+c.accountId;
 await c.saves.open(theme,{legacyState:s});return c;
}
