# release の R8 ルール(2026-10-31 から minify/shrinkResources を有効にした。カチマケ 1.2.5 と同じ考え方)
# 各ライブラリの AAR に入っている consumer rules(Capacitor・RevenueCat・Play Billing・AndroidX など)も自動で効く。
# ここでは「名前で呼ばれる所」を明示して残す。名前の難読化は止めない(-dontobfuscate を付けない)。

# 落ちたときの行番号を Play の難読化解除で読めるようにする
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions
-renamesourcefileattribute SourceFile

# --- Capacitor 本体 ---
# capacitor.plugins.json のクラス名を Class.forName で読み、@PluginMethod をリフレクションで呼ぶ。
# Bridge は WebView に @JavascriptInterface で JS ブリッジを出す。
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.NativePlugin public class * {
    @com.getcapacitor.PluginMethod public <methods>;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep public class * extends org.apache.cordova.* {
    public <methods>;
    public <fields>;
}
-keep class org.apache.cordova.** { *; }

# --- このアプリの部品(MainActivity・自前のプラグイン・ウィジェットなど) ---
-keep class com.diamondninebaseball.game.** { *; }

# --- 各プラグイン(capacitor.plugins.json。JS から名前で呼ばれる) ---
-keep class com.capacitorjs.plugins.app.** { *; }
-keep class com.capacitorjs.plugins.browser.** { *; }
-keep class com.capacitorjs.plugins.filesystem.** { *; }
-keep class com.capacitorjs.plugins.localnotifications.** { *; }
-keep class com.capacitorjs.plugins.share.** { *; }
-keep class com.getcapacitor.community.admob.** { *; }
-keep class com.getcapacitor.community.inappreview.** { *; }
-keep class ee.forgr.nativepurchases.** { *; }

# --- RevenueCat(公式の案内どおり SDK のクラスを残す) ---
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**

# --- Google Play Billing ---
-keep class com.android.vending.billing.** { *; }
-keep class com.android.billingclient.api.** { *; }

# --- Google Mobile Ads(AdMob)・UMP(同意)。AAR の consumer rules が効くので警告だけ抑える ---
-dontwarn com.google.android.gms.**
-dontwarn com.google.android.ump.**

# --- 通知・ウィジェット(マニフェストの名前で起動される) ---
-keep class * extends android.content.BroadcastReceiver
-keep class * extends android.appwidget.AppWidgetProvider
-keep class * extends android.app.Service

-dontwarn org.apache.cordova.**
