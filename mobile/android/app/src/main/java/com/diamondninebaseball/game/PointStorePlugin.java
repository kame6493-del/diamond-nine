package com.diamondninebaseball.game;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.*;
import java.util.ArrayList;
import java.util.List;

/** Read-only catalog. No payment flow exists in this test release.
 * Enable sales only after authenticated server-side fulfillment and recovery
 * have passed Play license-tester tests. Never credit WebView save data directly.
 */
@CapacitorPlugin(name = "PointStore")
public class PointStorePlugin extends Plugin {
    private BillingClient billing;
    private PluginCall pending;

    @PluginMethod public void catalog(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pending != null) { call.reject("商品情報を確認中です"); return; }
            pending = call;
            if (billing == null) {
                billing = BillingClient.newBuilder(getContext())
                    .setListener((result, purchases) -> { /* Purchasing is disabled. */ })
                    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                    .enableAutoServiceReconnection().build();
            }
            if (billing.isReady()) { query(); return; }
            billing.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) query();
                    else fail();
                }
                @Override public void onBillingServiceDisconnected() { fail(); }
            });
        });
    }
    private void fail() {
        PluginCall call = pending; pending = null;
        if (call != null) call.reject("Google Playの商品情報を取得できませんでした");
    }
    private void query() {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : new String[]{"points_3000", "points_13000", "points_28000"}) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        }
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(), (result, details) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { fail(); return; }
            JSArray list = new JSArray();
            for (ProductDetails p : details.getProductDetailsList()) {
                var offer = p.getOneTimePurchaseOfferDetails();
                if (offer != null) list.put(new JSObject().put("id", p.getProductId()).put("price", offer.getFormattedPrice()));
            }
            PluginCall call = pending; pending = null;
            if (call != null) call.resolve(new JSObject().put("products", list));
        });
    }
    @Override protected void handleOnDestroy() {
        fail();
        if (billing != null) billing.endConnection();
    }
}
