// Price proposals for Play Console; never use these values to initiate a payment.
// The actual price must come from Google's ProductDetails when sales go live.
export const pointProducts = [
 {id:'points_3000',points:3000,proposedPriceYen:120},
 {id:'points_13000',points:13000,proposedPriceYen:480},
 {id:'points_28000',points:28000,proposedPriceYen:980},
] as const;
export interface StoreProduct {id:string;price:string}
export interface AndroidPointStore {catalog():Promise<{products:StoreProduct[]}>}
declare global {interface Window {diamondPointStore?:AndroidPointStore}}
